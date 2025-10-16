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

# Check if deployment-outputs.json exists
if [ ! -f "deployment-outputs.json" ]; then
    echo -e "${YELLOW}⚠️  deployment-outputs.json not found.${NC}"
    echo -e "${YELLOW}   Will attempt cleanup with default values.${NC}"
    echo ""
    
    # Prompt for values
    read -p "Enter AWS Region (default: us-east-1): " REGION
    REGION=${REGION:-us-east-1}
    
    read -p "Enter Stack Name (default: legal-service-stack): " STACK_NAME
    STACK_NAME=${STACK_NAME:-legal-service-stack}
    
    read -p "Enter Deployment ID (default: legal): " DEPLOYMENT_ID
    DEPLOYMENT_ID=${DEPLOYMENT_ID:-legal}
else
    # Load from deployment outputs
    REGION=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['region'])")
    STACK_NAME=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['stackName'])")
    DEPLOYMENT_ID=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['deploymentId'])")
fi

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Region: ${YELLOW}$REGION${NC}"
echo -e "  Stack Name: ${YELLOW}$STACK_NAME${NC}"
echo -e "  Deployment ID: ${YELLOW}$DEPLOYMENT_ID${NC}"
echo ""

# Confirmation
echo -e "${RED}⚠️  WARNING: This will delete all deployed resources!${NC}"
echo -e "${RED}   - CloudFormation stack and all resources${NC}"
echo -e "${RED}   - AgentCore agents${NC}"
echo -e "${RED}   - DynamoDB data${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 0
fi

echo ""

# =============================================================================
# Step 1: Delete AgentCore Agents
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1/2: Deleting AgentCore Agents${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -d "deployment/agentcore-venv" ]; then
    cd deployment
    source agentcore-venv/bin/activate
    
    # Delete intake agent
    if [ -d "agentcore-deploy/intake-agent" ] && [ -f "agentcore-deploy/intake-agent/.bedrock_agentcore.yaml" ]; then
        echo -e "${BLUE}Deleting intake agent...${NC}"
        cd agentcore-deploy/intake-agent
        agentcore destroy --non-interactive || echo -e "${YELLOW}⚠️  Intake agent may not exist${NC}"
        cd ../..
    fi
    
    # Delete review agent
    if [ -d "agentcore-deploy/review-agent" ] && [ -f "agentcore-deploy/review-agent/.bedrock_agentcore.yaml" ]; then
        echo -e "${BLUE}Deleting review agent...${NC}"
        cd agentcore-deploy/review-agent
        agentcore destroy --non-interactive || echo -e "${YELLOW}⚠️  Review agent may not exist${NC}"
        cd ../..
    fi
    
    deactivate
    cd ..
    echo -e "${GREEN}✓ AgentCore agents deleted${NC}"
else
    echo -e "${YELLOW}⚠️  AgentCore venv not found, skipping agent deletion${NC}"
    echo -e "${YELLOW}   Agents may need to be deleted manually from AWS Console${NC}"
fi

echo ""

# =============================================================================
# Step 2: Delete CloudFormation Stack
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/2: Deleting CloudFormation Stack${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Deleting stack: $STACK_NAME${NC}"
aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo -e "${BLUE}Waiting for stack deletion to complete...${NC}"
echo -e "${YELLOW}This may take 5-10 minutes...${NC}"

aws cloudformation wait stack-delete-complete \
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
