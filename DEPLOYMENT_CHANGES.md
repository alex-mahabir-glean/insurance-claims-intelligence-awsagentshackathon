# Deployment Changes Summary

This document tracks the changes made to enable AgentCore direct chat functionality.

## Changes Included in Fresh Deployments

### 1. CloudFormation Template (`backend/cloudformation/legal-service-stack.yaml`)

#### CORS Configuration
- **Lines 732, 777, 1913, 1951**: Changed `X-Api-Key` to lowercase `x-api-key` in CORS allowed headers
- Ensures browser preflight requests work correctly with the `x-api-key` header

#### API Gateway Authorizer
- **Line 1851**: Set `AuthorizerResultTtlInSeconds: 0` to disable caching
- **Lines 1000-1014**: Updated authorizer Lambda to check for both `x-api-key` and `Authorization` headers

#### InvokeIntakeAgentFunction
- **Line 1076**: Changed role from `LambdaExecutionRole` to `AgentCoreProxyLambdaRole`
- **Line 1081**: Changed environment variable from `CLAIMS_TABLE` to `INTAKE_AGENT_ARN`
- **Lines 1089-1148**: ✅ Updated Lambda code to invoke AgentCore intake agent (matching review agent pattern)
  - Accepts `prompt` parameter instead of claim fields
  - Invokes AgentCore runtime via `bedrock-agentcore` client
  - Returns agent response with session management

### 2. Deploy Script (`deploy.sh`)

#### DynamoDB Permissions for AgentCore
- **Lines 341-391**: Added automatic step to grant DynamoDB permissions to AgentCore execution role
- Creates inline policy `DynamoDBTableAccess-${DEPLOYMENT_ID}` with permissions for:
  - `dynamodb:GetItem`, `Query`, `Scan`, `PutItem`, `UpdateItem`, `DeleteItem`
  - On tables: `Claims`, `AuditTrail`, `Reviewers`

### 3. Frontend JavaScript

#### Response Formatting (`assets/js/reviewer.js` and `assets/js/submitter.js`)
- **New function**: `cleanAgentCoreResponse()` to format agent responses
  - Removes `<thinking>` tags and their content
  - Converts escaped newlines (`\n`) to HTML line breaks (`<br>`)
  - Trims whitespace

#### API Request Changes
- Changed parameter from `message` to `prompt` for AgentCore API calls
- Changed header from `x-api-key` to `Authorization: Bearer <token>`

#### Warning Banner
- Added prominent warning banner to all AgentCore direct chat interfaces
- Informs users this bypasses Glean's conversational agents

### 4. Configuration (`config.js`)
- Updated `authToken` to use real API token from Secrets Manager
- Changed from placeholder `demo-token-123` to actual token

## Architecture Notes

### Separation of Concerns

The system maintains clean separation between:

1. **Form Submission** (`/submit-claim` endpoint → `SubmitClaimFunction`)
   - Direct DynamoDB writes for claim creation
   - No AI involvement
   - Validates and stores claim data

2. **AgentCore Chat** (`/invoke-intake-agent` and `/invoke-review-agent` endpoints)
   - Conversational AI assistance
   - Invokes AgentCore agents
   - Provides guidance and answers questions

This separation ensures that the core claim submission workflow remains fast and reliable, while the AI chat provides optional assistance.

## Testing Fresh Deployment

To verify a fresh deployment has all changes:

1. **Check CORS**: Browser console should not show CORS errors for `x-api-key` header
2. **Check Authorization**: Requests should use `Authorization: Bearer <token>` header
3. **Check DynamoDB Permissions**: AgentCore role should have inline policy `DynamoDBTableAccess-*`
4. **Check Response Formatting**: Agent responses should not show `<thinking>` tags or `\n` characters
5. **Check Warning Banner**: AgentCore direct chat should show yellow warning banner

## Manual Steps Required (if any)

None - all changes are now automated in the deploy script!

## Rollback Instructions

If issues occur:

1. **Revert CloudFormation**: Use previous version of `legal-service-stack.yaml`
2. **Revert Deploy Script**: Use previous version of `deploy.sh`
3. **Clear Browser Cache**: Hard refresh (Cmd+Shift+R) to clear old JavaScript

## Future Improvements

1. Update `InvokeIntakeAgentFunction` Lambda code in CloudFormation to invoke AgentCore
2. Consider moving DynamoDB permissions to CloudFormation custom resource instead of deploy script
3. Add error handling for malformed AgentCore responses
4. Add retry logic for AgentCore API calls
