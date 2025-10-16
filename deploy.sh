#!/bin/bash

# =============================================================================
# AI-Powered Legal Service Management System - Automated Deployment
# AWS AI Agent Global Hackathon 2025
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration
# =============================================================================

# Load configuration from config.env if it exists
if [ -f "config.env" ]; then
    echo -e "${BLUE}Loading configuration from config.env...${NC}"
    source config.env
else
    echo -e "${YELLOW}No config.env found. Using defaults or prompting for values.${NC}"
fi

# Set defaults or prompt for required values
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-legal-service-stack}"
DEPLOYMENT_ID="${DEPLOYMENT_ID:-legal}"
PROFILE="${AWS_PROFILE:-}"

# Export for use in Python scripts
export AWS_REGION="$REGION"
export DEPLOYMENT_ID="$DEPLOYMENT_ID"

# =============================================================================
# Banner
# =============================================================================

echo -e "${CYAN}"
cat << "EOF"
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║        Legal Service Management System - Complete Deployment              ║
║                    AWS Bedrock AgentCore Demo                             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Region: ${YELLOW}$REGION${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"
if [ -n "$PROFILE" ]; then
    echo -e "  AWS Profile: ${YELLOW}$PROFILE${NC}"
fi
echo ""

# =============================================================================
# Prerequisites Check
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}✓ Checking prerequisites...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is required but not installed.${NC}"
    echo -e "${YELLOW}   Install from: https://aws.amazon.com/cli/${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI found${NC}"

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✓ Python 3 found (${PYTHON_VERSION})${NC}"

# Check for Python 3.12 (preferred for AgentCore)
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo -e "${GREEN}✓ Python 3.12 found (recommended for AgentCore)${NC}"
elif command -v /opt/homebrew/bin/python3.12 &> /dev/null; then
    PYTHON_CMD="/opt/homebrew/bin/python3.12"
    echo -e "${GREEN}✓ Python 3.12 found (recommended for AgentCore)${NC}"
else
    PYTHON_CMD="python3"
    echo -e "${YELLOW}⚠️  Python 3.12 not found. Using $(python3 --version)${NC}"
    echo -e "${YELLOW}   AgentCore works best with Python 3.10+${NC}"
fi

# Check AWS credentials
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
fi

if ! $AWS_CMD sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured or invalid${NC}"
    if [ -n "$PROFILE" ]; then
        echo -e "${YELLOW}   Run: aws sso login --profile $PROFILE${NC}"
    else
        echo -e "${YELLOW}   Run: aws configure${NC}"
    fi
    exit 1
fi

ACCOUNT_ID=$($AWS_CMD sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"
echo ""

# =============================================================================
# STEP 1: Deploy CloudFormation Stack
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 Step 1/6: Deploying AWS Infrastructure (CloudFormation)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Create S3 bucket for CloudFormation templates (required for large templates)
S3_BUCKET="cfn-templates-${ACCOUNT_ID}-${REGION}"
echo -e "${BLUE}Checking S3 bucket for CloudFormation templates...${NC}"

if ! $AWS_CMD s3 ls "s3://$S3_BUCKET" &> /dev/null; then
    echo -e "${BLUE}Creating S3 bucket: $S3_BUCKET${NC}"
    if [ "$REGION" = "us-east-1" ]; then
        $AWS_CMD s3 mb "s3://$S3_BUCKET"
    else
        $AWS_CMD s3 mb "s3://$S3_BUCKET" --region "$REGION"
    fi
else
    echo -e "${GREEN}✓ S3 bucket exists: $S3_BUCKET${NC}"
fi

DEPLOY_CMD="aws cloudformation deploy \
  --template-file backend/cloudformation/legal-service-stack.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides DeploymentID=$DEPLOYMENT_ID \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region $REGION \
  --s3-bucket $S3_BUCKET \
  --no-fail-on-empty-changeset"

if [ -n "$PROFILE" ]; then
    DEPLOY_CMD="$DEPLOY_CMD --profile $PROFILE"
fi

eval $DEPLOY_CMD

echo -e "${GREEN}✅ CloudFormation stack deployed${NC}"

# Get stack outputs
echo -e "${BLUE}Retrieving stack outputs...${NC}"
OUTPUTS_CMD="aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs' \
  --output json"

if [ -n "$PROFILE" ]; then
    OUTPUTS_CMD="$OUTPUTS_CMD --profile $PROFILE"
fi

STACK_OUTPUTS=$(eval $OUTPUTS_CMD)

# Extract key values
API_URL=$(echo "$STACK_OUTPUTS" | python3 -c "import sys, json; outputs = json.load(sys.stdin); print(next((o['OutputValue'] for o in outputs if o['OutputKey'] == 'ApiGatewayUrl'), ''))")
AGENTCORE_ROLE_ARN=$(echo "$STACK_OUTPUTS" | python3 -c "import sys, json; outputs = json.load(sys.stdin); print(next((o['OutputValue'] for o in outputs if o['OutputKey'] == 'AgentCoreRuntimeRoleArn'), ''))")

echo -e "${GREEN}✓ API Gateway URL: $API_URL${NC}"
echo -e "${GREEN}✓ AgentCore Role ARN: $AGENTCORE_ROLE_ARN${NC}"
echo ""

# =============================================================================
# STEP 2: Load Sample Data
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Step 2/6: Loading Sample Data${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "$PROFILE" ]; then
    export AWS_PROFILE="$PROFILE"
fi

python3 backend/data/load_sample_data.py

echo -e "${GREEN}✅ Sample data loaded${NC}"
echo ""

# =============================================================================
# STEP 3: Setup AgentCore Environment
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 Step 3/6: Setting up AgentCore Environment${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd deployment

if [ ! -d "agentcore-venv" ]; then
    echo -e "${BLUE}Creating Python virtual environment...${NC}"
    $PYTHON_CMD -m venv agentcore-venv
    source agentcore-venv/bin/activate
    echo -e "${BLUE}Installing AgentCore toolkit and dependencies...${NC}"
    pip install -q --upgrade pip
    pip install -q bedrock-agentcore strands-agents bedrock-agentcore-starter-toolkit boto3
else
    source agentcore-venv/bin/activate
fi

echo -e "${GREEN}✅ AgentCore environment ready${NC}"
echo ""

# =============================================================================
# STEP 4: Deploy AgentCore Agents
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🤖 Step 4/6: Deploying AgentCore Agents${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Prepare agent directories
echo -e "${BLUE}Preparing agent files...${NC}"
mkdir -p agentcore-deploy/intake-agent agentcore-deploy/review-agent
cp ../backend/agents/intake_agent_agentcore.py agentcore-deploy/intake-agent/agent.py
cp ../backend/agents/review_agent_agentcore.py agentcore-deploy/review-agent/agent.py

# Create requirements.txt for both agents
cat > agentcore-deploy/intake-agent/requirements.txt << 'REQUIREMENTS'
bedrock-agentcore
strands-agents
boto3
REQUIREMENTS

cat > agentcore-deploy/review-agent/requirements.txt << 'REQUIREMENTS'
bedrock-agentcore
strands-agents
boto3
REQUIREMENTS

# Deploy intake agent
echo ""
echo -e "${BLUE}🚀 Deploying Intake Agent...${NC}"
cd agentcore-deploy/intake-agent

AGENTCORE_CMD="agentcore configure -e agent.py --disable-memory --region $REGION --non-interactive --name legal_intake_agent_${DEPLOYMENT_ID}"
if [ -n "$PROFILE" ]; then
    AWS_PROFILE="$PROFILE" eval $AGENTCORE_CMD
else
    eval $AGENTCORE_CMD
fi

if [ -n "$PROFILE" ]; then
    AWS_PROFILE="$PROFILE" agentcore launch
else
    agentcore launch
fi

# Get intake agent ARN
if [ -f ".bedrock_agentcore.yaml" ]; then
    INTAKE_ARN=$(grep "agent_arn:" .bedrock_agentcore.yaml | awk '{print $2}' | tr -d '"')
    echo -e "${GREEN}✓ Intake Agent ARN: $INTAKE_ARN${NC}"
else
    echo -e "${RED}❌ Failed to get Intake Agent ARN${NC}"
    exit 1
fi

# Deploy review agent
echo ""
echo -e "${BLUE}🚀 Deploying Review Agent...${NC}"
cd ../review-agent

AGENTCORE_CMD="agentcore configure -e agent.py --disable-memory --region $REGION --non-interactive --name legal_review_agent_${DEPLOYMENT_ID}"
if [ -n "$PROFILE" ]; then
    AWS_PROFILE="$PROFILE" eval $AGENTCORE_CMD
else
    eval $AGENTCORE_CMD
fi

if [ -n "$PROFILE" ]; then
    AWS_PROFILE="$PROFILE" agentcore launch
else
    agentcore launch
fi

# Get review agent ARN
if [ -f ".bedrock_agentcore.yaml" ]; then
    REVIEW_ARN=$(grep "agent_arn:" .bedrock_agentcore.yaml | awk '{print $2}' | tr -d '"')
    echo -e "${GREEN}✓ Review Agent ARN: $REVIEW_ARN${NC}"
else
    echo -e "${RED}❌ Failed to get Review Agent ARN${NC}"
    exit 1
fi

cd ../..

# =============================================================================
# STEP 5: Update Lambda Functions with Agent ARNs
# =============================================================================

echo ""
echo -e "${BLUE}🔗 Updating Lambda functions with agent ARNs...${NC}"

# Update SubmitClaim function
$AWS_CMD lambda update-function-configuration \
  --function-name "LegalService-SubmitClaim-${DEPLOYMENT_ID}" \
  --environment "Variables={CLAIMS_TABLE=LegalService-Claims-${DEPLOYMENT_ID},REVIEWERS_TABLE=LegalService-Reviewers-${DEPLOYMENT_ID},AUDIT_TABLE=LegalService-AuditTrail-${DEPLOYMENT_ID},INTAKE_AGENT_ARN=${INTAKE_ARN}}" \
  --region "$REGION" > /dev/null

# Update other functions with review agent ARN
for func in GetClaims ApproveClaim DenyClaim ReassignClaim; do
    $AWS_CMD lambda update-function-configuration \
      --function-name "LegalService-${func}-${DEPLOYMENT_ID}" \
      --environment "Variables={CLAIMS_TABLE=LegalService-Claims-${DEPLOYMENT_ID},REVIEWERS_TABLE=LegalService-Reviewers-${DEPLOYMENT_ID},AUDIT_TABLE=LegalService-AuditTrail-${DEPLOYMENT_ID},REVIEW_AGENT_ARN=${REVIEW_ARN}}" \
      --region "$REGION" > /dev/null
done

# Update invoke agent Lambda functions
$AWS_CMD lambda update-function-configuration \
  --function-name "LegalService-InvokeIntakeAgent-${DEPLOYMENT_ID}" \
  --environment "Variables={AGENT_RUNTIME_ARN=${INTAKE_ARN}}" \
  --region "$REGION" > /dev/null

$AWS_CMD lambda update-function-configuration \
  --function-name "LegalService-InvokeReviewAgent-${DEPLOYMENT_ID}" \
  --environment "Variables={REVIEW_AGENT_ARN=${REVIEW_ARN}}" \
  --region "$REGION" > /dev/null

echo -e "${GREEN}✅ Lambda functions updated${NC}"

cd ..

# =============================================================================
# STEP 6: Update Frontend HTML Files
# =============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌐 Step 5/6: Updating Frontend Configuration${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Updating HTML files with API Gateway URL...${NC}"

# Update submitter.html
if [ -f "submitter.html" ]; then
    # Create backup
    cp submitter.html submitter.html.bak
    
    # Update API URL
    sed -i.tmp "s|https://[a-z0-9]*\.execute-api\.[a-z0-9-]*\.amazonaws\.com/prod|$API_URL|g" submitter.html
    rm -f submitter.html.tmp
    
    echo -e "${GREEN}✓ Updated submitter.html${NC}"
fi

# Update reviewer.html
if [ -f "reviewer.html" ]; then
    # Create backup
    cp reviewer.html reviewer.html.bak
    
    # Update API URL
    sed -i.tmp "s|https://[a-z0-9]*\.execute-api\.[a-z0-9-]*\.amazonaws\.com/prod|$API_URL|g" reviewer.html
    rm -f reviewer.html.tmp
    
    echo -e "${GREEN}✓ Updated reviewer.html${NC}"
fi

# Update Glean agent IDs if provided
if [ -n "$GLEAN_INTAKE_AGENT_ID" ] && [ -f "submitter.html" ]; then
    sed -i.tmp "s/agentId: '[^']*'/agentId: '$GLEAN_INTAKE_AGENT_ID'/g" submitter.html
    rm -f submitter.html.tmp
    echo -e "${GREEN}✓ Updated Glean Intake Agent ID in submitter.html${NC}"
fi

if [ -n "$GLEAN_REVIEW_AGENT_ID" ] && [ -f "reviewer.html" ]; then
    sed -i.tmp "s/agentId: '[^']*'/agentId: '$GLEAN_REVIEW_AGENT_ID'/g" reviewer.html
    rm -f reviewer.html.tmp
    echo -e "${GREEN}✓ Updated Glean Review Agent ID in reviewer.html${NC}"
fi

# Clean up backup files
rm -f *.bak

echo ""

# =============================================================================
# Save deployment outputs
# =============================================================================

echo -e "${BLUE}Saving deployment outputs...${NC}"

cat > deployment-outputs.json << EOF
{
  "region": "$REGION",
  "accountId": "$ACCOUNT_ID",
  "stackName": "$STACK_NAME",
  "deploymentId": "$DEPLOYMENT_ID",
  "apiUrl": "$API_URL",
  "intakeAgentArn": "$INTAKE_ARN",
  "reviewAgentArn": "$REVIEW_ARN",
  "agentCoreRoleArn": "$AGENTCORE_ROLE_ARN"
}
EOF

echo -e "${GREEN}✓ Deployment outputs saved to deployment-outputs.json${NC}"
echo ""

# =============================================================================
# STEP 6: Generate Glean OpenAPI Specifications
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📄 Step 6/6: Generating Glean OpenAPI Specifications${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Creating Glean-ready OpenAPI specs with your API Gateway URL...${NC}"

# Create output directory
mkdir -p glean/generated

# Process each OpenAPI spec
SPEC_COUNT=0
for spec_file in glean/openapi-*.json; do
    if [ -f "$spec_file" ]; then
        filename=$(basename "$spec_file")
        output_file="glean/generated/$filename"
        
        # Replace the API URL placeholder with actual deployed URL
        sed "s|https://YOUR_API_GATEWAY_URL|$API_URL|g" "$spec_file" > "$output_file"
        
        echo -e "${GREEN}✓ Generated: $output_file${NC}"
        ((SPEC_COUNT++))
    fi
done

echo -e "${GREEN}✅ Generated $SPEC_COUNT Glean OpenAPI specifications${NC}"
echo ""

# =============================================================================
# Deployment Complete
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "  ${GREEN}•${NC} CloudFormation Stack: ${YELLOW}$STACK_NAME${NC}"
echo -e "  ${GREEN}•${NC} AWS Region: ${YELLOW}$REGION${NC}"
echo -e "  ${GREEN}•${NC} AWS Account: ${YELLOW}$ACCOUNT_ID${NC}"
echo -e "  ${GREEN}•${NC} Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"
echo ""
echo -e "${BLUE}🌐 API Endpoints:${NC}"
echo -e "  ${GREEN}•${NC} Base URL: ${YELLOW}$API_URL${NC}"
echo -e "  ${GREEN}•${NC} Submit Claim: ${YELLOW}POST /submit-claim${NC}"
echo -e "  ${GREEN}•${NC} Get Claims: ${YELLOW}GET /claims${NC}"
echo -e "  ${GREEN}•${NC} Approve Claim: ${YELLOW}POST /approve-claim${NC}"
echo -e "  ${GREEN}•${NC} Deny Claim: ${YELLOW}POST /deny-claim${NC}"
echo -e "  ${GREEN}•${NC} Reassign Claim: ${YELLOW}POST /reassign-claim${NC}"
echo ""
echo -e "${BLUE}🤖 AgentCore Agents:${NC}"
echo -e "  ${GREEN}•${NC} Intake Agent: ${YELLOW}$INTAKE_ARN${NC}"
echo -e "  ${GREEN}•${NC} Review Agent: ${YELLOW}$REVIEW_ARN${NC}"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo -e "  ${GREEN}1.${NC} Test the web portals:"
echo -e "     ${YELLOW}./serve.sh${NC} then open http://localhost:8000/submitter.html and reviewer.html"
echo -e "  ${GREEN}2.${NC} Configure Glean Actions:"
echo -e "     - Import OpenAPI specs from ${YELLOW}glean/generated/${NC} (already configured with your API URL!)"
echo -e "     - Get API token: ${YELLOW}aws secretsmanager get-secret-value --secret-id LegalService/AgentCoreApiToken/$DEPLOYMENT_ID${NC}"
echo -e "     - See ${YELLOW}GLEAN_SETUP.md${NC} for detailed instructions"
echo -e "  ${GREEN}3.${NC} View observability: ${YELLOW}https://console.aws.amazon.com/cloudwatch/home?region=$REGION#gen-ai-observability/agent-core${NC}"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}🎉 Your Legal Service Management System is ready!${NC}                     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
