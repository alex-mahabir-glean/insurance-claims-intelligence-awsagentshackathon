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

# Step 1a: Delete AgentCore agent runtimes using boto3
echo -e "${BLUE}Deleting AgentCore agent runtimes...${NC}"

# Use Python script to delete agents via bedrock-agentcore-control API
if [ -n "$PROFILE" ]; then
    export AWS_PROFILE="$PROFILE"
fi
export AWS_REGION="$REGION"
export DEPLOYMENT_ID="$DEPLOYMENT_ID"

# Use venv if available for updated boto3, otherwise use system python3
if [ -d "deployment/agentcore-venv" ]; then
    deployment/agentcore-venv/bin/python3 deployment/delete_agentcore_agents.py
else
    python3 deployment/delete_agentcore_agents.py
fi

echo ""

# Step 1b: Clean up supporting infrastructure with agentcore destroy
if [ -d "deployment/agentcore-venv" ]; then
    echo -e "${BLUE}Cleaning up AgentCore supporting infrastructure (ECR, CodeBuild, IAM)...${NC}"
    cd deployment
    source agentcore-venv/bin/activate

    # Clean up intake agent infrastructure
    if [ -d "agentcore-deploy/intake-agent" ] && [ -f "agentcore-deploy/intake-agent/.bedrock_agentcore.yaml" ]; then
        echo -e "${BLUE}Cleaning intake agent infrastructure...${NC}"
        cd agentcore-deploy/intake-agent
        if [ -n "$PROFILE" ]; then
            AWS_PROFILE="$PROFILE" agentcore destroy --force || echo -e "${YELLOW}⚠️  Some intake agent resources may not exist${NC}"
        else
            agentcore destroy --force || echo -e "${YELLOW}⚠️  Some intake agent resources may not exist${NC}"
        fi
        cd ../..
    fi

    # Clean up review agent infrastructure
    if [ -d "agentcore-deploy/review-agent" ] && [ -f "agentcore-deploy/review-agent/.bedrock_agentcore.yaml" ]; then
        echo -e "${BLUE}Cleaning review agent infrastructure...${NC}"
        cd agentcore-deploy/review-agent
        if [ -n "$PROFILE" ]; then
            AWS_PROFILE="$PROFILE" agentcore destroy --force || echo -e "${YELLOW}⚠️  Some review agent resources may not exist${NC}"
        else
            agentcore destroy --force || echo -e "${YELLOW}⚠️  Some review agent resources may not exist${NC}"
        fi
        cd ../..
    fi

    deactivate
    cd ..
    echo -e "${GREEN}✓ AgentCore infrastructure cleanup complete${NC}"
else
    echo -e "${YELLOW}⚠️  AgentCore venv not found, skipping infrastructure cleanup${NC}"
fi

echo ""
echo -e "${GREEN}✅ AgentCore agent deletion initiated${NC}"

echo ""

# =============================================================================
# Step 2: Delete CloudFormation Stack (in parallel with agent deletion)
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/3: Deleting CloudFormation Stack${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Initiating stack deletion: $STACK_NAME${NC}"
$AWS_CMD cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

echo -e "${GREEN}✓ CloudFormation stack deletion initiated${NC}"
echo ""

# =============================================================================
# Step 3: Wait for Both Deletions to Complete
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3/3: Waiting for Deletions to Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${BLUE}Waiting for AgentCore agents and CloudFormation stack to delete...${NC}"
echo -e "${YELLOW}This may take 5-10 minutes...${NC}"
echo ""

# Wait for agents in background
(
  if [ -n "$PROFILE" ]; then
    export AWS_PROFILE="$PROFILE"
  fi
  export AWS_REGION="$REGION"
  export DEPLOYMENT_ID="$DEPLOYMENT_ID"

  # Use venv Python if available for bedrock-agentcore-control service
  if [ -d "deployment/agentcore-venv" ]; then
    PYTHON_CMD="deployment/agentcore-venv/bin/python3"
  else
    PYTHON_CMD="python3"
  fi

  $PYTHON_CMD << 'PYTHON_WAIT_AGENTS'
import boto3
import os
import time
import sys

session_kwargs = {'region_name': os.environ.get('AWS_REGION', 'us-east-1')}
profile = os.environ.get('AWS_PROFILE')
if profile:
    session_kwargs['profile_name'] = profile

session = boto3.Session(**session_kwargs)
client = session.client('bedrock-agentcore-control')

deployment_id = os.environ.get('DEPLOYMENT_ID')
intake_agent_name = f"legal_intake_agent_{deployment_id}"
review_agent_name = f"legal_review_agent_{deployment_id}"

print(f"⏳ Waiting for agents to be deleted...")
max_wait = 600  # 10 minutes
start_time = time.time()

while time.time() - start_time < max_wait:
    try:
        response = client.list_agent_runtimes()
        agents = response.get('agentRuntimes', [])

        remaining = [a for a in agents if a.get('agentRuntimeName') in [intake_agent_name, review_agent_name]]

        if not remaining:
            print("✅ All agents deleted successfully")
            sys.exit(0)

        statuses = [f"{a.get('agentRuntimeName')}: {a.get('status')}" for a in remaining]
        print(f"  Still deleting: {', '.join(statuses)}")
        time.sleep(10)
    except Exception as e:
        print(f"❌ Error checking agent status: {e}")
        sys.exit(1)

print("⚠️  Timeout waiting for agents to delete")
sys.exit(1)
PYTHON_WAIT_AGENTS
) &
AGENT_WAIT_PID=$!

# Wait for CloudFormation stack
$AWS_CMD cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION" && {
    echo -e "${GREEN}✓ CloudFormation stack deleted${NC}"
} || {
    echo -e "${YELLOW}⚠️  Stack deletion may have failed or timed out${NC}"
    echo -e "${YELLOW}   Check AWS Console for status${NC}"
}

# Wait for agent deletion to complete
wait $AGENT_WAIT_PID
AGENT_EXIT_CODE=$?

if [ $AGENT_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ AgentCore agents deleted${NC}"
else
    echo -e "${YELLOW}⚠️  Agent deletion may have failed or timed out${NC}"
fi

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
