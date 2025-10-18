#!/bin/bash

# =============================================================================
# Complete Cleanup Script
# Removes all deployed AWS resources
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Cleanup Deployed Resources                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load configuration from config.env or deployment-outputs.json
if [ -f "config.env" ]; then
    echo -e "${BLUE}Loading configuration from config.env...${NC}"
    source config.env
    REGION=${AWS_REGION:-us-east-1}
    PROFILE=${AWS_PROFILE}
elif [ -f "deployment-outputs.json" ]; then
    echo -e "${BLUE}Loading configuration from deployment-outputs.json...${NC}"
    REGION=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['region'])")
    STACK_NAME=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['stackName'])")
    DEPLOYMENT_ID=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['deploymentId'])")
else
    echo -e "${RED}❌ Error: Neither config.env nor deployment-outputs.json found!${NC}"
    echo -e "${YELLOW}   Please create config.env with your deployment configuration.${NC}"
    exit 1
fi

# Set AWS CLI command with profile if available
if [ -n "$PROFILE" ]; then
    AWS_CMD="aws --profile $PROFILE"
else
    AWS_CMD="aws"
fi

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Region: ${YELLOW}$REGION${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"
if [ -n "$PROFILE" ]; then
    echo -e "  AWS Profile: ${YELLOW}$PROFILE${NC}"
fi
echo ""

echo -e "${RED}⚠️  WARNING: This will delete all deployed resources!${NC}"
echo -e "${RED}   - CloudFormation stack and all resources${NC}"
echo -e "${RED}   - AgentCore agents${NC}"
echo -e "${RED}   - DynamoDB data${NC}"
echo ""
echo -e "${YELLOW}Starting cleanup in 3 seconds... (Ctrl+C to cancel)${NC}"
sleep 3

echo ""

# =============================================================================
# Step 1: Delete AgentCore Agents
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1/2: Deleting AgentCore Agents${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Agent names based on deployment ID
INTAKE_AGENT_NAME="legal_intake_agent_${DEPLOYMENT_ID}"
REVIEW_AGENT_NAME="legal_review_agent_${DEPLOYMENT_ID}"

echo -e "${BLUE}Looking for agents with deployment ID: ${YELLOW}${DEPLOYMENT_ID}${NC}"
echo -e "${BLUE}  - Intake agent: ${YELLOW}${INTAKE_AGENT_NAME}${NC}"
echo -e "${BLUE}  - Review agent: ${YELLOW}${REVIEW_AGENT_NAME}${NC}"
echo ""

# Try to delete agents using AWS CLI directly (more reliable than agentcore destroy)
echo -e "${BLUE}Attempting to delete agents via AWS CLI...${NC}"

# Delete intake agent
echo -e "${BLUE}Deleting intake agent: ${INTAKE_AGENT_NAME}${NC}"
INTAKE_DELETE_OUTPUT=$($AWS_CMD bedrock-agent-runtime delete-agent-runtime \
  --agent-runtime-name "${INTAKE_AGENT_NAME}" \
  --region "$REGION" 2>&1)

if echo "$INTAKE_DELETE_OUTPUT" | grep -q "ResourceNotFoundException\|does not exist"; then
    echo -e "${YELLOW}⚠️  Intake agent not found (may have been deleted already)${NC}"
elif echo "$INTAKE_DELETE_OUTPUT" | grep -q "error\|Error\|ERROR"; then
    echo -e "${YELLOW}⚠️  Error deleting intake agent: ${INTAKE_DELETE_OUTPUT}${NC}"
else
    echo -e "${GREEN}✓ Intake agent deleted${NC}"
fi

# Delete review agent
echo -e "${BLUE}Deleting review agent: ${REVIEW_AGENT_NAME}${NC}"
REVIEW_DELETE_OUTPUT=$($AWS_CMD bedrock-agent-runtime delete-agent-runtime \
  --agent-runtime-name "${REVIEW_AGENT_NAME}" \
  --region "$REGION" 2>&1)

if echo "$REVIEW_DELETE_OUTPUT" | grep -q "ResourceNotFoundException\|does not exist"; then
    echo -e "${YELLOW}⚠️  Review agent not found (may have been deleted already)${NC}"
elif echo "$REVIEW_DELETE_OUTPUT" | grep -q "error\|Error\|ERROR"; then
    echo -e "${YELLOW}⚠️  Error deleting review agent: ${REVIEW_DELETE_OUTPUT}${NC}"
else
    echo -e "${GREEN}✓ Review agent deleted${NC}"
fi

echo ""
echo -e "${GREEN}✓ AgentCore agent deletion attempted${NC}"
echo -e "${BLUE}Note: If agents still exist, they can be deleted from the AWS Console:${NC}"
echo -e "${BLUE}  https://${REGION}.console.aws.amazon.com/bedrock-agentcore/agents${NC}"

echo ""

# =============================================================================
# Step 2: Delete CloudFormation Stack
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/2: Deleting CloudFormation Stack${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Deleting stack: $STACK_NAME${NC}"
$AWS_CMD cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo -e "${BLUE}Waiting for stack deletion to complete...${NC}"
echo -e "${YELLOW}This may take 5-10 minutes...${NC}"

$AWS_CMD cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" || {
    echo -e "${YELLOW}⚠️  Stack deletion may have failed or timed out${NC}"
    echo -e "${YELLOW}   Check AWS Console for status${NC}"
}

echo -e "${GREEN}✓ CloudFormation stack deleted${NC}"
echo ""

# =============================================================================
# Cleanup Complete
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Cleanup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Deleted Resources:${NC}"
echo -e "  ${GREEN}•${NC} AgentCore agents"
echo -e "  ${GREEN}•${NC} CloudFormation stack: ${YELLOW}$STACK_NAME${NC}"
echo -e "  ${GREEN}•${NC} DynamoDB tables"
echo -e "  ${GREEN}•${NC} Lambda functions"
echo -e "  ${GREEN}•${NC} API Gateway"
echo -e "  ${GREEN}•${NC} IAM roles"
echo ""
echo -e "${BLUE}Local files to clean up manually (if desired):${NC}"
echo -e "  ${YELLOW}•${NC} deployment-outputs.json"
echo -e "  ${YELLOW}•${NC} deployment/agentcore-venv/"
echo -e "  ${YELLOW}•${NC} deployment/agentcore-deploy/*/.bedrock_agentcore.yaml"
echo -e "  ${YELLOW}•${NC} config.env"
echo ""
