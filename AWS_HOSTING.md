# Production Hosting with CloudFront, Cognito & Lambda@Edge

> ℹ️ **This optional hosting stack is still CloudFormation-based.** The core
> application stack lives under `terraform/`; this hosting layer (CloudFront +
> Cognito + Lambda@Edge) has not been Terraform-ized yet — tracked under
> [TF-9 #41](https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon/issues/41).
>
> The instructions below remain correct for the hosting layer. The core
> API URL + auth token come from `terraform output`; see
> [`docs/customer-deployment.md`](docs/customer-deployment.md) for the
> rest of the deploy flow.

This document describes the optional production hosting setup that provides secure, authenticated access to the web application via CloudFront with Cognito authentication and Lambda@Edge.

## 🏗️ Architecture Overview

The production hosting stack implements a secure, scalable static website hosting solution:

```
User Request
    ↓
CloudFront Distribution (CDN)
    ↓
Lambda@Edge (viewer-request)
    ├─ Validates Cognito JWT token from cookie
    ├─ Blocks sensitive files (.env, .yaml, etc.)
    └─ Redirects unauthenticated users to /login.html
    ↓
S3 Bucket (Origin)
    └─ Static files (HTML, JS, CSS, images)

Authentication Flow:
    ↓
Cognito User Pool
    ├─ User authentication
    ├─ JWT token generation
    └─ Session management
```

### Key Components

1. **S3 Bucket** - Hosts static website files
2. **CloudFront Distribution** - Global CDN with custom domain and SSL
3. **Origin Access Control (OAC)** - Restricts direct S3 access
4. **AWS WAF** - Web application firewall with AWS managed rules
5. **Amazon Cognito** - User authentication and authorization
6. **Lambda@Edge** - Server-side authentication validation
7. **ACM Certificate** - SSL/TLS certificate for custom domain
8. **Route 53** - DNS management (optional, for custom domain)

## 🔒 Security Features

### Lambda@Edge Authentication

The Lambda@Edge function runs on every CloudFront request to:
- ✅ Validate Cognito JWT tokens from cookies
- ✅ Block access to sensitive files (.env, .sh, .yaml, deployment files)
- ✅ Allow public access only to login page and auth dependencies
- ✅ Redirect unauthenticated users to login page

### Protected Resources

**Requires Authentication:**
- All HTML pages (index.html, reviewer.html, submitter.html)
- config.js (contains API credentials)
- All JavaScript, CSS, images, and data files

**Public Access:**
- /login.html
- /cognito-config.js (only contains public Cognito pool IDs)
- /assets/js/auth-helpers.js (authentication library)

**Blocked (403 Forbidden):**
- .env, .sh, .yaml, .yml, .md, .py, .txt files
- deployment-outputs.json
- /backend/*, /deployment/*, /hosting/* paths

## 📋 Prerequisites

Before deploying the hosting stack, you need:

1. **AWS Account** with appropriate permissions
2. **Custom Domain** (e.g., yourdomain.com)
3. **ACM Certificate** in us-east-1 region for your domain
   - Must be in us-east-1 for CloudFront
   - Can be wildcard (*.yourdomain.com) or specific subdomain
4. **Route 53 Hosted Zone** (optional, if using Route 53 for DNS)
5. **AWS CLI** configured with appropriate profile

## 🚀 Manual Deployment Steps

### Step 1: Create ACM Certificate

If you don't have an ACM certificate:

```bash
# Request a certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Note the CertificateArn from the output
# Follow the DNS validation steps in the ACM console
```

### Step 2: Prepare CloudFormation Template

Save the CloudFormation template below to `hosting-stack.yaml` and replace the placeholder values:

- `<YOUR_DOMAIN_NAME>` - Your custom domain (e.g., demo.yourdomain.com)
- `<YOUR_ACM_CERTIFICATE_ARN>` - ARN from Step 1
- `<YOUR_DEPLOYMENT_ID>` - Unique identifier (e.g., prod, demo)
- `<YOUR_COGNITO_USERNAME>` - Initial Cognito user email
- `<YOUR_COGNITO_PASSWORD>` - Initial user password (min 8 chars)

### Step 3: Deploy CloudFormation Stack

```bash
# Set your AWS profile
export AWS_PROFILE=your-profile-name

# Deploy the stack
aws cloudformation deploy \
  --template-file hosting-stack.yaml \
  --stack-name your-hosting-stack \
  --parameter-overrides \
    DomainName=<YOUR_DOMAIN_NAME> \
    CertificateArn=<YOUR_ACM_CERTIFICATE_ARN> \
    DeploymentId=<YOUR_DEPLOYMENT_ID> \
    CognitoUsername=<YOUR_COGNITO_USERNAME> \
    CognitoPassword=<YOUR_COGNITO_PASSWORD> \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Get the CloudFront distribution domain
aws cloudformation describe-stacks \
  --stack-name your-hosting-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
  --output text
```

### Step 4: Upload Website Files to S3

```bash
# Get the S3 bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name your-hosting-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)

# Upload files
aws s3 sync . s3://$BUCKET_NAME/ \
  --exclude ".git/*" \
  --exclude "backend/*" \
  --exclude "deployment/*" \
  --exclude "hosting/*" \
  --exclude "*.env" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --profile your-profile-name
```

### Step 5: Configure DNS

Point your domain to the CloudFront distribution:

**Option A: Route 53**
```bash
# Get CloudFront distribution domain
CF_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name your-hosting-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
  --output text)

# Create Route 53 A record (alias)
aws route53 change-resource-record-sets \
  --hosted-zone-id <YOUR_HOSTED_ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "<YOUR_DOMAIN_NAME>",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'$CF_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Option B: Other DNS Provider**
- Create a CNAME record pointing to the CloudFront distribution domain
- Or create an A record (if supported) pointing to CloudFront

### Step 6: Update cognito-config.js

After deployment, create `cognito-config.js` with your Cognito details:

```bash
# Get Cognito details from stack outputs
aws cloudformation describe-stacks \
  --stack-name your-hosting-stack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

Create `cognito-config.js`:
```javascript
window.COGNITO_CONFIG = {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX',  // From stack outputs
    clientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'  // From stack outputs
};
```

Upload to S3:
```bash
aws s3 cp cognito-config.js s3://$BUCKET_NAME/cognito-config.js
```

### Step 7: Test the Deployment

1. Visit your domain: `https://<YOUR_DOMAIN_NAME>`
2. You should be redirected to the login page
3. Log in with the Cognito credentials you specified
4. After login, you should have access to all application pages

## 📄 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Secure Static Website Hosting with CloudFront, S3, Cognito, and Lambda@Edge Authentication'

Parameters:
  DomainName:
    Type: String
    Description: 'Custom domain name for the website (e.g., demo.yourdomain.com)'
    Default: '<YOUR_DOMAIN_NAME>'
  
  CertificateArn:
    Type: String
    Description: 'ARN of ACM certificate in us-east-1 for the domain'
    Default: '<YOUR_ACM_CERTIFICATE_ARN>'
  
  DeploymentId:
    Type: String
    Description: 'Unique deployment identifier (e.g., prod, demo, dev)'
    Default: '<YOUR_DEPLOYMENT_ID>'
    AllowedPattern: '^[a-z0-9]+$'
    ConstraintDescription: 'Must contain only lowercase letters and numbers'
  
  CognitoUsername:
    Type: String
    Description: 'Email address for initial Cognito user'
    Default: '<YOUR_COGNITO_USERNAME>'
  
  CognitoPassword:
    Type: String
    Description: 'Password for initial Cognito user (min 8 characters)'
    NoEcho: true
    MinLength: 8

Resources:
  # S3 Bucket for static website hosting
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'insurance-claims-hosting-${DeploymentId}'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      Tags:
        - Key: Name
          Value: !Sub 'insurance-claims-hosting-${DeploymentId}'

  # S3 Bucket Policy for CloudFront OAC
  S3BucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref S3Bucket
      PolicyDocument:
        Statement:
          - Sid: AllowCloudFrontServicePrincipal
            Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action: s3:GetObject
            Resource: !Sub '${S3Bucket.Arn}/*'
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub 'arn:aws:cloudfront::${AWS::AccountId}:distribution/${CloudFrontDistribution}'

  # CloudFront Origin Access Control
  CloudFrontOAC:
    Type: AWS::CloudFront::OriginAccessControl
    Properties:
      OriginAccessControlConfig:
        Name: !Sub 'OAC-${DeploymentId}'
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  # WAF Web ACL for CloudFront
  WAFWebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: !Sub 'insurance-claims-waf-${DeploymentId}'
      Scope: CLOUDFRONT
      DefaultAction:
        Allow: {}
      Rules:
        - Name: AWSManagedRulesCommonRuleSet
          Priority: 1
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesCommonRuleSet
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: AWSManagedRulesCommonRuleSetMetric
        - Name: AWSManagedRulesKnownBadInputsRuleSet
          Priority: 2
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesKnownBadInputsRuleSet
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: AWSManagedRulesKnownBadInputsRuleSetMetric
      VisibilityConfig:
        SampledRequestsEnabled: true
        CloudWatchMetricsEnabled: true
        MetricName: !Sub 'insurance-claims-waf-${DeploymentId}'

  # Cognito User Pool
  CognitoUserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub 'insurance-claims-users-${DeploymentId}'
      AutoVerifiedAttributes:
        - email
      UsernameAttributes:
        - email
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: false
      Schema:
        - Name: email
          AttributeDataType: String
          Required: true
          Mutable: false
      UserAttributeUpdateSettings:
        AttributesRequireVerificationBeforeUpdate:
          - email
      AccountRecoverySetting:
        RecoveryMechanisms:
          - Name: verified_email
            Priority: 1

  # Cognito User Pool Client
  CognitoUserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: !Sub 'insurance-claims-client-${DeploymentId}'
      UserPoolId: !Ref CognitoUserPool
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      PreventUserExistenceErrors: ENABLED
      RefreshTokenValidity: 30
      AccessTokenValidity: 60
      IdTokenValidity: 60
      TokenValidityUnits:
        RefreshToken: days
        AccessToken: minutes
        IdToken: minutes

  # Cognito Identity Pool
  CognitoIdentityPool:
    Type: AWS::Cognito::IdentityPool
    Properties:
      IdentityPoolName: !Sub 'insurance_claims_identity_${DeploymentId}'
      AllowUnauthenticatedIdentities: false
      CognitoIdentityProviders:
        - ClientId: !Ref CognitoUserPoolClient
          ProviderName: !GetAtt CognitoUserPool.ProviderName

  # Initial Cognito User
  CognitoUser:
    Type: AWS::Cognito::UserPoolUser
    Properties:
      UserPoolId: !Ref CognitoUserPool
      Username: !Ref CognitoUsername
      UserAttributes:
        - Name: email
          Value: !Ref CognitoUsername
        - Name: email_verified
          Value: 'true'
      DesiredDeliveryMediums:
        - EMAIL

  # Set initial user password
  CognitoUserPassword:
    Type: Custom::CognitoUserPassword
    Properties:
      ServiceToken: !GetAtt SetPasswordFunction.Arn
      UserPoolId: !Ref CognitoUserPool
      Username: !Ref CognitoUsername
      Password: !Ref CognitoPassword

  # Lambda function to set Cognito user password
  SetPasswordFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub 'set-cognito-password-${DeploymentId}'
      Runtime: python3.11
      Handler: index.handler
      Role: !GetAtt SetPasswordFunctionRole.Arn
      Timeout: 30
      Code:
        ZipFile: |
          import boto3
          import cfnresponse
          
          cognito = boto3.client('cognito-idp')
          
          def handler(event, context):
              try:
                  if event['RequestType'] in ['Create', 'Update']:
                      user_pool_id = event['ResourceProperties']['UserPoolId']
                      username = event['ResourceProperties']['Username']
                      password = event['ResourceProperties']['Password']
                      
                      cognito.admin_set_user_password(
                          UserPoolId=user_pool_id,
                          Username=username,
                          Password=password,
                          Permanent=True
                      )
                  
                  cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              except Exception as e:
                  print(f"Error: {e}")
                  cfnresponse.send(event, context, cfnresponse.FAILED, {})

  SetPasswordFunctionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'set-password-role-${DeploymentId}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: CognitoAdminPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - cognito-idp:AdminSetUserPassword
                Resource: !GetAtt CognitoUserPool.Arn

  # Lambda@Edge Execution Role
  LambdaEdgeExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'lambda-edge-auth-role-${DeploymentId}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service:
                - lambda.amazonaws.com
                - edgelambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: CognitoReadPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - cognito-idp:GetUser
                  - cognito-idp:DescribeUserPool
                Resource: !GetAtt CognitoUserPool.Arn

  # Lambda@Edge Function for Authentication
  AuthLambdaEdgeFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub 'cloudfront-auth-${DeploymentId}'
      Runtime: python3.11
      Handler: index.lambda_handler
      Role: !GetAtt LambdaEdgeExecutionRole.Arn
      Timeout: 5
      MemorySize: 128
      Code:
        ZipFile: |
          import json
          import base64
          import time
          import re
          
          def lambda_handler(event, context):
              request = event['Records'][0]['cf']['request']
              headers = request['headers']
              uri = request['uri']
              
              # First: Block sensitive files (regardless of auth)
              blocked_patterns = [
                  r'\.env$',
                  r'\.sh$',
                  r'\.yaml$',
                  r'\.yml$',
                  r'\.md$',
                  r'\.py$',
                  r'\.txt$',
                  r'deployment-outputs\.json$',
                  r'^/(backend|deployment|hosting|glean|cleanup|deploy|verify|generate)/',
                  r'^/\.'  # Hidden files
              ]
              
              for pattern in blocked_patterns:
                  if re.search(pattern, uri):
                      return {
                          'status': '403',
                          'statusDescription': 'Forbidden',
                          'body': 'Access to this resource is not allowed'
                      }
              
              # Public paths that don't require authentication
              # Login page and its dependencies must be public
              public_paths = [
                  '/login.html',
                  '/cognito-config.js',
                  '/assets/js/auth-helpers.js'
              ]
              
              if uri in public_paths or uri.startswith('/assets/images/favicon'):
                  return request
              
              # All other paths require authentication
              cookie_header = headers.get('cookie', [{}])[0].get('value', '')
              cookies = parse_cookies(cookie_header)
              
              id_token = cookies.get('cognito_id_token', '')
              
              if not id_token:
                  return redirect_to_login(uri)
              
              # Validate token
              try:
                  parts = id_token.split('.')
                  if len(parts) != 3:
                      return redirect_to_login(uri)
                  
                  payload = base64.urlsafe_b64decode(parts[1] + '==')
                  token_data = json.loads(payload)
                  
                  exp = token_data.get('exp', 0)
                  if exp < time.time():
                      return redirect_to_login(uri)
                  
                  return request
                  
              except Exception as e:
                  print(f"Token validation error: {e}")
                  return redirect_to_login(uri)
          
          def parse_cookies(cookie_string):
              cookies = {}
              if cookie_string:
                  for cookie in cookie_string.split(';'):
                      cookie = cookie.strip()
                      if '=' in cookie:
                          key, value = cookie.split('=', 1)
                          cookies[key] = value
              return cookies
          
          def redirect_to_login(original_uri):
              return {
                  'status': '302',
                  'statusDescription': 'Found',
                  'headers': {
                      'location': [{
                          'key': 'Location',
                          'value': f'/login.html?redirect={original_uri}'
                      }],
                      'cache-control': [{
                          'key': 'Cache-Control',
                          'value': 'no-cache, no-store, must-revalidate'
                      }]
                  }
              }
      Tags:
        - Key: Name
          Value: !Sub 'cloudfront-auth-${DeploymentId}'

  # Lambda@Edge Version (required for CloudFront association)
  AuthLambdaEdgeVersion:
    Type: AWS::Lambda::Version
    Properties:
      FunctionName: !Ref AuthLambdaEdgeFunction
      Description: !Sub 'CloudFront auth version - ${DeploymentId}'

  # CloudFront Distribution
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        HttpVersion: http2and3
        Comment: !Sub 'Insurance Claims Platform - ${DeploymentId}'
        Aliases:
          - !Ref DomainName
        ViewerCertificate:
          AcmCertificateArn: !Ref CertificateArn
          SslSupportMethod: sni-only
          MinimumProtocolVersion: TLSv1.2_2021
        WebACLId: !GetAtt WAFWebACL.Arn
        DefaultRootObject: index.html
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt S3Bucket.RegionalDomainName
            OriginAccessControlId: !Ref CloudFrontOAC
            S3OriginConfig: {}
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
            - OPTIONS
          CachedMethods:
            - GET
            - HEAD
          Compress: true
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
          OriginRequestPolicyId: 88a5eaf4-2fd4-4709-b370-b4c650ea3fcf  # CORS-S3Origin
          LambdaFunctionAssociations:
            - EventType: viewer-request
              LambdaFunctionARN: !Ref AuthLambdaEdgeVersion
        CustomErrorResponses:
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html
            ErrorCachingMinTTL: 300
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html
            ErrorCachingMinTTL: 300
      Tags:
        - Key: Name
          Value: !Sub 'insurance-claims-cf-${DeploymentId}'

Outputs:
  S3BucketName:
    Description: 'S3 bucket name for website files'
    Value: !Ref S3Bucket
    Export:
      Name: !Sub '${AWS::StackName}-S3Bucket'

  CloudFrontDistributionId:
    Description: 'CloudFront distribution ID'
    Value: !Ref CloudFrontDistribution
    Export:
      Name: !Sub '${AWS::StackName}-CloudFrontDistributionId'

  CloudFrontDomain:
    Description: 'CloudFront distribution domain name'
    Value: !GetAtt CloudFrontDistribution.DomainName
    Export:
      Name: !Sub '${AWS::StackName}-CloudFrontDomain'

  WebsiteURL:
    Description: 'Website URL'
    Value: !Sub 'https://${DomainName}'
    Export:
      Name: !Sub '${AWS::StackName}-WebsiteURL'

  CognitoUserPoolId:
    Description: 'Cognito User Pool ID'
    Value: !Ref CognitoUserPool
    Export:
      Name: !Sub '${AWS::StackName}-CognitoUserPoolId'

  CognitoUserPoolClientId:
    Description: 'Cognito User Pool Client ID'
    Value: !Ref CognitoUserPoolClient
    Export:
      Name: !Sub '${AWS::StackName}-CognitoUserPoolClientId'

  CognitoIdentityPoolId:
    Description: 'Cognito Identity Pool ID'
    Value: !Ref CognitoIdentityPool
    Export:
      Name: !Sub '${AWS::StackName}-CognitoIdentityPoolId'
```

## 🧹 Cleanup

To remove all hosting resources:

```bash
# Empty the S3 bucket first
aws s3 rm s3://insurance-claims-hosting-<YOUR_DEPLOYMENT_ID>/ --recursive

# Delete the CloudFormation stack
aws cloudformation delete-stack \
  --stack-name your-hosting-stack \
  --region us-east-1

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
  --stack-name your-hosting-stack \
  --region us-east-1
```

## 📊 Cost Estimate

Approximate monthly costs for low-traffic usage:

- **CloudFront**: $1-5 (first 1TB free tier)
- **S3**: $0.50-2 (storage + requests)
- **Lambda@Edge**: $0.20-1 (first 1M requests free)
- **Cognito**: Free (first 50,000 MAUs)
- **WAF**: $5 + $1 per rule
- **Route 53**: $0.50 per hosted zone

**Total**: ~$7-15/month for demo usage

## 🎯 Why This Architecture?

1. **Security First**: Lambda@Edge validates every request server-side
2. **Scalability**: CloudFront CDN handles global traffic
3. **Cost-Effective**: Pay only for what you use, generous free tiers
4. **Best Practices**: OAC, WAF, encryption at rest and in transit
5. **User Experience**: Fast global delivery, secure authentication
6. **Compliance**: Complete audit trail, industry-standard auth

## 📚 Additional Resources

- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Lambda@Edge Guide](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [AWS WAF](https://docs.aws.amazon.com/waf/latest/developerguide/)
