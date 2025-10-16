"""
Submit Claim Lambda Function
Orchestrates the full claim submission process:
1. Invokes Intake Agent (via AgentCore Runtime)
2. Invokes Assignment Agent (via AgentCore Runtime)
3. Invokes Review Agent (via AgentCore Runtime)
"""

import json
import boto3
import os
from datetime import datetime

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-agent-runtime')
dynamodb = boto3.resource('dynamodb')

# Environment variables
INTAKE_AGENT_ID = os.environ.get('INTAKE_AGENT_ID', '')
ASSIGNMENT_AGENT_ID = os.environ.get('ASSIGNMENT_AGENT_ID', '')
REVIEW_AGENT_ID = os.environ.get('REVIEW_AGENT_ID', '')
CLAIMS_TABLE = os.environ.get('CLAIMS_TABLE', 'LegalService-Claims')

claims_table = dynamodb.Table(CLAIMS_TABLE)

def invoke_agentcore_agent(agent_id: str, task: str, session_id: str = None):
    """
    Invoke an AgentCore Runtime agent
    """
    try:
        if not session_id:
            session_id = f"session-{datetime.utcnow().timestamp()}"
        
        response = bedrock_runtime.invoke_agent(
            agentId=agent_id,
            sessionId=session_id,
            inputText=task
        )
        
        # Parse response
        result = ""
        for event in response.get('completion', []):
            if 'chunk' in event:
                chunk = event['chunk']
                if 'bytes' in chunk:
                    result += chunk['bytes'].decode('utf-8')
        
        return {
            'success': True,
            'response': result
        }
        
    except Exception as e:
        print(f"Error invoking agent {agent_id}: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def lambda_handler(event, context):
    """
    Main Lambda handler for claim submission
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Extract claim data
        claim_data = {
            'claimantName': body.get('claimantName'),
            'claimantEmail': body.get('claimantEmail'),
            'claimantPhone': body.get('claimantPhone'),
            'claimantAddress': body.get('claimantAddress'),
            'policyNumber': body.get('policyNumber'),
            'claimType': body.get('claimType'),
            'incidentDate': body.get('incidentDate'),
            'incidentDescription': body.get('incidentDescription'),
            'claimValue': body.get('claimValue'),
            'policeReport': body.get('policeReport'),
            'injuries': body.get('injuries', False),
            'injuryDescription': body.get('injuryDescription')
        }
        
        # Validate required fields
        required_fields = ['claimantName', 'claimantEmail', 'policyNumber', 'claimType', 'incidentDate', 'incidentDescription', 'claimValue']
        missing_fields = [field for field in required_fields if not claim_data.get(field)]
        
        if missing_fields:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': f"Missing required fields: {', '.join(missing_fields)}"
                })
            }
        
        # Generate claim ID
        timestamp = datetime.utcnow()
        claim_id = f"CL-{timestamp.strftime('%Y-%m%d%H%M%S')}"
        
        # Step 1: Save claim to DynamoDB
        claim_record = {
            'claimId': claim_id,
            'version': 'v1',
            'claimantInfo': {
                'name': claim_data['claimantName'],
                'email': claim_data['claimantEmail'],
                'phone': claim_data.get('claimantPhone', ''),
                'address': claim_data.get('claimantAddress', '')
            },
            'policyNumber': claim_data['policyNumber'],
            'claimType': claim_data['claimType'],
            'incidentDate': claim_data['incidentDate'],
            'incidentDescription': claim_data['incidentDescription'],
            'claimValue': float(claim_data['claimValue']),
            'policeReport': claim_data.get('policeReport'),
            'injuries': claim_data.get('injuries', False),
            'injuryDescription': claim_data.get('injuryDescription'),
            'status': 'submitted',
            'submittedDate': timestamp.isoformat(),
            'lastUpdated': timestamp.isoformat()
        }
        
        claims_table.put_item(Item=claim_record)
        print(f"Claim {claim_id} saved to DynamoDB")
        
        # Step 2: Invoke Assignment Agent
        assignment_task = f"Assign claim {claim_id} to the most suitable reviewer based on expertise and workload."
        assignment_result = invoke_agentcore_agent(ASSIGNMENT_AGENT_ID, assignment_task, f"assign-{claim_id}")
        
        if not assignment_result.get('success'):
            print(f"Assignment failed: {assignment_result.get('error')}")
            # Continue anyway - claim is still submitted
        
        # Get updated claim to see assignment
        updated_claim = claims_table.get_item(Key={'claimId': claim_id}).get('Item', claim_record)
        assigned_to = updated_claim.get('assignedTo', 'pending')
        
        # Step 3: Invoke Review Agent for initial analysis
        review_task = f"Analyze claim {claim_id}. Check policy coverage, search for similar cases, assess fraud risk, and provide a recommendation."
        review_result = invoke_agentcore_agent(REVIEW_AGENT_ID, review_task, f"review-{claim_id}")
        
        if not review_result.get('success'):
            print(f"Review failed: {review_result.get('error')}")
            # Continue anyway - reviewer can trigger review later
        
        # Get final claim state
        final_claim = claims_table.get_item(Key={'claimId': claim_id}).get('Item', updated_claim)
        
        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'claimId': claim_id,
                'assignedTo': final_claim.get('assignedTo', 'pending'),
                'status': final_claim.get('status', 'submitted'),
                'aiRecommendation': final_claim.get('aiRecommendation'),
                'aiConfidence': final_claim.get('aiConfidence'),
                'message': f"Claim {claim_id} submitted successfully. Expected review time: 2-3 business days."
            })
        }
        
    except Exception as e:
        print(f"Error in submitClaim: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
