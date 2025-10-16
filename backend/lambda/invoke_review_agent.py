"""
Lambda function to invoke the Legal Service Review Agent via AgentCore Runtime
Serves as HTTP proxy between API Gateway and Bedrock AgentCore
"""

import json
import boto3
import os
from datetime import datetime

# Initialize Bedrock AgentCore client
agentcore_client = boto3.client('bedrock-agentcore', region_name='us-east-1')

# Get agent ARN from environment variable
REVIEW_AGENT_ARN = os.environ.get('REVIEW_AGENT_ARN')

def lambda_handler(event, context):
    """
    Handle HTTP requests from API Gateway and invoke the AgentCore agent
    
    Expected request body:
    {
        "prompt": "User message to the agent",
        "sessionId": "optional-session-id"  # For conversation continuity
    }
    """
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }
    
    try:
        # Handle OPTIONS request for CORS
        if event.get('httpMethod') == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': ''
            }
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        user_prompt = body.get('prompt', '')
        session_id = body.get('sessionId', f'session-{datetime.now().timestamp()}')
        
        if not user_prompt:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing required field: prompt'
                })
            }
        
        # Prepare payload for AgentCore
        agent_payload = json.dumps({
            "prompt": user_prompt
        }).encode('utf-8')
        
        # Invoke the AgentCore agent
        response = agentcore_client.invoke_agent_runtime(
            agentRuntimeArn=REVIEW_AGENT_ARN,
            runtimeSessionId=session_id,
            contentType='application/json',
            accept='application/json',
            payload=agent_payload
        )
        
        # Read the streaming response
        response_body = response['response'].read()
        agent_response = response_body.decode('utf-8')
        
        # Return successful response
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'sessionId': response.get('runtimeSessionId', session_id),
                'response': agent_response,
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error invoking agent: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': f'Failed to invoke agent: {str(e)}'
            })
        }
