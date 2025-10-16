#!/bin/bash

# =============================================================================
# Deployment Verification Script
# Checks that all components are properly deployed and configured
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Deployment Verification                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if deployment-outputs.json exists
if [ ! -f "deployment-outputs.json" ]; then
    echo -e "${RED}❌ deployment-outputs.json not found${NC}"
    echo -e "${YELLOW}   Please run ./deploy.sh first${NC}"
    exit 1
fi

# Load deployment outputs
REGION=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['region'])")
STACK_NAME=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['stackName'])")
DEPLOYMENT_ID=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['deploymentId'])")
API_URL=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['apiUrl'])")
INTAKE_ARN=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['intakeAgentArn'])")
REVIEW_ARN=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['reviewAgentArn'])")

# Load AWS profile from config.env if available
PROFILE=""
if [ -f "config.env" ]; then
    source config.env
    PROFILE="$AWS_PROFILE"
fi

# Setup AWS command with profile if available
AWS_CMD="aws"
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
fi

echo -e "${BLUE}Deployment Configuration:${NC}"
echo -e "  Region: ${YELLOW}$REGION${NC}"
echo -e "  Stack: ${YELLOW}$STACK_NAME${NC}"
echo -e "  Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"
if [ -n "$PROFILE" ]; then
    echo -e "  AWS Profile: ${YELLOW}$PROFILE${NC}"
fi
echo ""

# Check CloudFormation stack
echo -e "${BLUE}Checking CloudFormation stack...${NC}"
STACK_STATUS=$($AWS_CMD cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
    echo -e "${GREEN}✓ CloudFormation stack is healthy (${STACK_STATUS})${NC}"
else
    echo -e "${RED}✗ CloudFormation stack status: ${STACK_STATUS}${NC}"
fi

# Check DynamoDB tables
echo -e "${BLUE}Checking DynamoDB tables...${NC}"
for table in Claims Reviewers AuditTrail; do
    TABLE_NAME="LegalService-${table}-${DEPLOYMENT_ID}"
    TABLE_STATUS=$($AWS_CMD dynamodb describe-table \
      --table-name "$TABLE_NAME" \
      --region "$REGION" \
      --query 'Table.TableStatus' \
      --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$TABLE_STATUS" = "ACTIVE" ]; then
        ITEM_COUNT=$($AWS_CMD dynamodb scan \
          --table-name "$TABLE_NAME" \
          --region "$REGION" \
          --select COUNT \
          --query 'Count' \
          --output text)
        echo -e "${GREEN}✓ ${TABLE_NAME}: ${ITEM_COUNT} items${NC}"
    else
        echo -e "${RED}✗ ${TABLE_NAME}: ${TABLE_STATUS}${NC}"
    fi
done

# Check Lambda functions
echo -e "${BLUE}Checking Lambda functions...${NC}"
for func in SubmitClaim GetClaims ApproveClaim DenyClaim ReassignClaim InvokeIntakeAgent InvokeReviewAgent; do
    FUNC_NAME="LegalService-${func}-${DEPLOYMENT_ID}"
    FUNC_STATUS=$($AWS_CMD lambda get-function \
      --function-name "$FUNC_NAME" \
      --region "$REGION" \
      --query 'Configuration.State' \
      --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$FUNC_STATUS" = "Active" ]; then
        echo -e "${GREEN}✓ ${FUNC_NAME}${NC}"
    else
        echo -e "${RED}✗ ${FUNC_NAME}: ${FUNC_STATUS}${NC}"
    fi
done

# Check AgentCore agents
echo -e "${BLUE}Checking AgentCore agents...${NC}"
if [ -n "$INTAKE_ARN" ] && [ "$INTAKE_ARN" != "null" ]; then
    echo -e "${GREEN}✓ Intake Agent: ${INTAKE_ARN}${NC}"
else
    echo -e "${RED}✗ Intake Agent ARN not found${NC}"
fi

if [ -n "$REVIEW_ARN" ] && [ "$REVIEW_ARN" != "null" ]; then
    echo -e "${GREEN}✓ Review Agent: ${REVIEW_ARN}${NC}"
else
    echo -e "${RED}✗ Review Agent ARN not found${NC}"
fi

# Test API Gateway
echo -e "${BLUE}Testing API Gateway...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/claims")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API Gateway is responding (HTTP ${HTTP_CODE})${NC}"
else
    echo -e "${YELLOW}⚠ API Gateway returned HTTP ${HTTP_CODE}${NC}"
fi

# Check HTML files
echo -e "${BLUE}Checking HTML files...${NC}"
if grep -q "$API_URL" submitter.html 2>/dev/null; then
    echo -e "${GREEN}✓ submitter.html has correct API URL${NC}"
else
    echo -e "${YELLOW}⚠ submitter.html may not have correct API URL${NC}"
fi

if grep -q "$API_URL" reviewer.html 2>/dev/null; then
    echo -e "${GREEN}✓ reviewer.html has correct API URL${NC}"
else
    echo -e "${YELLOW}⚠ reviewer.html may not have correct API URL${NC}"
fi

# Check Glean specs
echo -e "${BLUE}Checking Glean OpenAPI specs...${NC}"
if [ -d "glean/generated" ] && [ "$(ls -A glean/generated 2>/dev/null)" ]; then
    SPEC_COUNT=$(ls glean/generated/*.json 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Generated ${SPEC_COUNT} Glean OpenAPI specs${NC}"
else
    echo -e "${YELLOW}⚠ No generated Glean specs found. Run ./generate-glean-specs.sh${NC}"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Verification Complete                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Open ${YELLOW}submitter.html${NC} in your browser"
echo -e "  2. Open ${YELLOW}reviewer.html${NC} in your browser"
echo -e "  3. Test API: ${YELLOW}curl $API_URL/claims${NC}"
echo -e "  4. For Glean: Run ${YELLOW}./generate-glean-specs.sh${NC} and follow ${YELLOW}GLEAN_SETUP.md${NC}"
echo ""
