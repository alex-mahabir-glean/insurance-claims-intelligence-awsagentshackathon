#!/bin/bash
# Test script for AgentCore API endpoints

# Check if deployment-outputs.json exists
if [ ! -f "../deployment-outputs.json" ]; then
    echo "❌ deployment-outputs.json not found!"
    echo "   Please run ./deploy.sh first to deploy the infrastructure."
    exit 1
fi

# Load configuration from deployment outputs
BASE_URL=$(python3 -c "import json; print(json.load(open('../deployment-outputs.json'))['apiUrl'])")
REGION=$(python3 -c "import json; print(json.load(open('../deployment-outputs.json'))['region'])")
DEPLOYMENT_ID=$(python3 -c "import json; print(json.load(open('../deployment-outputs.json'))['deploymentId'])")

# Get API key from Secrets Manager
echo "Retrieving API key from Secrets Manager..."
API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id "LegalService/AgentCoreApiToken/${DEPLOYMENT_ID}" \
  --region "$REGION" \
  --query SecretString \
  --output text | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

if [ -z "$API_KEY" ]; then
    echo "❌ Failed to retrieve API key"
    exit 1
fi

echo "Testing API endpoints at: $BASE_URL"
echo ""

echo "Testing Intake Agent endpoint..."
curl -X POST "${BASE_URL}/invoke-intake-agent" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${API_KEY}" \
  -d '{"prompt": "I need to file a vehicle accident claim"}' \
  | python3 -m json.tool

echo -e "\n\nTesting Review Agent endpoint..."
curl -X POST "${BASE_URL}/invoke-review-agent" \
  -H "Content-Type: application/json" \
  -H "Authorization: ${API_KEY}" \
  -d '{"prompt": "Show me all pending claims"}' \
  | python3 -m json.tool
