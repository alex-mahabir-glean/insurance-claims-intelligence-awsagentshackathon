#!/usr/bin/env python3
"""
Test script to invoke AgentCore agents directly via boto3
This validates the agent invocation after deployment
"""

import boto3
import json
import sys
import os

# Load deployment outputs
deployment_outputs_path = os.path.join(os.path.dirname(__file__), '..', 'deployment-outputs.json')

if not os.path.exists(deployment_outputs_path):
    print("❌ deployment-outputs.json not found!")
    print("   Please run ./deploy.sh first to deploy the infrastructure.")
    sys.exit(1)

with open(deployment_outputs_path, 'r') as f:
    outputs = json.load(f)

# Get configuration from deployment outputs
REGION = outputs.get('region', 'us-east-1')
INTAKE_AGENT_ARN = outputs.get('intakeAgentArn')
REVIEW_AGENT_ARN = outputs.get('reviewAgentArn')

if not INTAKE_AGENT_ARN or not REVIEW_AGENT_ARN:
    print("❌ Agent ARNs not found in deployment-outputs.json!")
    print("   Please ensure deployment completed successfully.")
    sys.exit(1)

# Initialize Bedrock AgentCore client
client = boto3.client('bedrock-agentcore', region_name=REGION)

print(f"Testing agents in region: {REGION}")
print(f"Intake Agent: {INTAKE_AGENT_ARN}")
print(f"Review Agent: {REVIEW_AGENT_ARN}\n")

def test_intake_agent():
    """Test the intake agent with a sample prompt"""
    print("=" * 80)
    print("Testing Intake Agent")
    print("=" * 80)

    payload = json.dumps({
        "prompt": "I need to file a vehicle accident claim"
    })

    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=INTAKE_AGENT_ARN,
            runtimeSessionId='test-session-12345678901234567890123456789012',  # Must be 33+ chars
            payload=payload.encode('utf-8'),
            contentType='application/json',
            accept='application/json'
        )

        # Read the streaming response
        response_body = response['response'].read()
        agent_response = response_body.decode('utf-8')

        print(f"\nSession ID: {response.get('runtimeSessionId')}")
        print(f"\nAgent Response:\n{agent_response}")
        print("\n✅ Intake agent test PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Intake agent test FAILED: {str(e)}")
        return False

def test_review_agent():
    """Test the review agent with a sample prompt"""
    print("\n" + "=" * 80)
    print("Testing Review Agent")
    print("=" * 80)

    payload = json.dumps({
        "prompt": "Show me all pending claims"
    })

    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=REVIEW_AGENT_ARN,
            runtimeSessionId='test-session-98765432109876543210987654321098',  # Must be 33+ chars
            payload=payload.encode('utf-8'),
            contentType='application/json',
            accept='application/json'
        )

        # Read the streaming response
        response_body = response['response'].read()
        agent_response = response_body.decode('utf-8')

        print(f"\nSession ID: {response.get('runtimeSessionId')}")
        print(f"\nAgent Response:\n{agent_response}")
        print("\n✅ Review agent test PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Review agent test FAILED: {str(e)}")
        return False

if __name__ == "__main__":
    print("\n🧪 Testing AgentCore Agent Invocation via boto3\n")

    # Test both agents
    intake_success = test_intake_agent()
    review_success = test_review_agent()

    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    print(f"Intake Agent: {'✅ PASSED' if intake_success else '❌ FAILED'}")
    print(f"Review Agent: {'✅ PASSED' if review_success else '❌ FAILED'}")

    if intake_success and review_success:
        print("\n🎉 All tests passed! Ready to implement Lambda proxy.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Fix issues before proceeding.")
        sys.exit(1)
