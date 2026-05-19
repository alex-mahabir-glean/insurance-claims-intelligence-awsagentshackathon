#!/usr/bin/env python3
"""
Delete AgentCore agents using boto3 bedrock-agentcore-control client.
This is more reliable than agentcore destroy when the local config is missing agent ARNs.
"""

import boto3
import sys
import os

def delete_agents(deployment_id, region='us-east-1', profile=None):
    """Delete AgentCore agents by name."""

    # Set up AWS session
    session_kwargs = {'region_name': region}
    if profile:
        session_kwargs['profile_name'] = profile

    session = boto3.Session(**session_kwargs)
    client = session.client('bedrock-agentcore-control')

    # Agent names based on deployment ID
    intake_agent_name = f"legal_intake_agent_{deployment_id}"
    review_agent_name = f"legal_review_agent_{deployment_id}"

    print(f"🔍 Looking for agents with deployment ID: {deployment_id}")
    print(f"  - Intake agent: {intake_agent_name}")
    print(f"  - Review agent: {review_agent_name}")
    print()

    # First, list all agents to find the IDs
    print("📋 Listing all AgentCore agents...")
    try:
        response = client.list_agent_runtimes()
        agents = response.get('agentRuntimes', [])
    except Exception as e:
        print(f"❌ Error listing agents: {e}")
        return False

    # Find agents by name and get their IDs
    intake_agent_id = None
    review_agent_id = None

    for agent in agents:
        if agent.get('agentRuntimeName') == intake_agent_name:
            intake_agent_id = agent.get('agentRuntimeId')
            print(f"  ✓ Found intake agent: {intake_agent_id}")
        elif agent.get('agentRuntimeName') == review_agent_name:
            review_agent_id = agent.get('agentRuntimeId')
            print(f"  ✓ Found review agent: {review_agent_id}")

    print()
    deleted_count = 0

    # Delete intake agent
    if intake_agent_id:
        print(f"🗑️  Deleting intake agent: {intake_agent_name} (ID: {intake_agent_id})")
        try:
            response = client.delete_agent_runtime(agentRuntimeId=intake_agent_id)
            print(f"✅ Successfully deleted intake agent")
            deleted_count += 1
        except client.exceptions.ResourceNotFoundException:
            print(f"⚠️  Intake agent not found (may have been deleted already)")
        except Exception as e:
            print(f"❌ Error deleting intake agent: {e}")
            return False
    else:
        print(f"⚠️  Intake agent '{intake_agent_name}' not found")

    # Delete review agent
    if review_agent_id:
        print(f"🗑️  Deleting review agent: {review_agent_name} (ID: {review_agent_id})")
        try:
            response = client.delete_agent_runtime(agentRuntimeId=review_agent_id)
            print(f"✅ Successfully deleted review agent")
            deleted_count += 1
        except client.exceptions.ResourceNotFoundException:
            print(f"⚠️  Review agent not found (may have been deleted already)")
        except Exception as e:
            print(f"❌ Error deleting review agent: {e}")
            return False
    else:
        print(f"⚠️  Review agent '{review_agent_name}' not found")

    print()
    print(f"✅ Agent deletion complete. Deleted {deleted_count} agent(s).")
    return True

if __name__ == "__main__":
    # Get parameters from environment or command line
    deployment_id = os.environ.get('DEPLOYMENT_ID', sys.argv[1] if len(sys.argv) > 1 else None)
    region = os.environ.get('AWS_REGION', 'us-east-1')
    profile = os.environ.get('AWS_PROFILE', None)

    if not deployment_id:
        print("❌ Error: DEPLOYMENT_ID not provided")
        print("Usage: python3 delete_agentcore_agents.py <deployment_id>")
        print("   or: DEPLOYMENT_ID=<id> python3 delete_agentcore_agents.py")
        sys.exit(1)

    success = delete_agents(deployment_id, region, profile)
    sys.exit(0 if success else 1)
