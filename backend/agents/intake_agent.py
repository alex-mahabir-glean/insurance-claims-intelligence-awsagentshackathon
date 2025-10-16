"""
Intake Agent - Strands Agent for Insurance Claim Intake
Handles conversational claim submission and validation
"""

from strands import Agent, tool
import boto3
import json
import os
from datetime import datetime
from typing import Dict, Any

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
claims_table = dynamodb.Table(os.environ.get('CLAIMS_TABLE', 'LegalService-Claims'))
reviewers_table = dynamodb.Table(os.environ.get('REVIEWERS_TABLE', 'LegalService-Reviewers'))
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail'))

@tool
def validate_policy_number(policy_number: str) -> Dict[str, Any]:
    """
    Validate if a policy number exists and is active.
    
    Args:
        policy_number: The policy number to validate (e.g., PL-123456)
    
    Returns:
        Dictionary with validation result and policy details
    """
    # In production, this would query an actual policy database
    # For demo, we'll validate format and return mock data
    
    if not policy_number or len(policy_number) < 5:
        return {
            "valid": False,
            "error": "Policy number must be at least 5 characters"
        }
    
    # Mock validation - accept any policy starting with PL-
    if policy_number.startswith('PL-'):
        return {
            "valid": True,
            "policy_number": policy_number,
            "status": "active",
            "coverage_types": ["vehicle", "property", "liability"],
            "deductible": 500
        }
    
    return {
        "valid": False,
        "error": "Invalid policy number format. Must start with PL-"
    }

@tool
def save_claim_to_database(claim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save a new claim to DynamoDB.
    
    Args:
        claim_data: Dictionary containing all claim information
    
    Returns:
        Dictionary with claim ID and save status
    """
    try:
        # Generate claim ID
        timestamp = datetime.utcnow()
        claim_id = f"CL-{timestamp.strftime('%Y-%m%d%H%M%S')}"
        
        # Prepare claim record
        claim_record = {
            'claimId': claim_id,
            'version': 'v1',
            'claimantInfo': claim_data.get('claimantInfo', {}),
            'policyNumber': claim_data.get('policyNumber'),
            'claimType': claim_data.get('claimType'),
            'incidentDate': claim_data.get('incidentDate'),
            'incidentDescription': claim_data.get('incidentDescription'),
            'claimValue': claim_data.get('claimValue', 0),
            'policeReport': claim_data.get('policeReport'),
            'injuries': claim_data.get('injuries', False),
            'injuryDescription': claim_data.get('injuryDescription'),
            'status': 'submitted',
            'submittedDate': timestamp.isoformat(),
            'lastUpdated': timestamp.isoformat()
        }
        
        # Save to DynamoDB
        claims_table.put_item(Item=claim_record)
        
        # Log to audit trail
        audit_table.put_item(Item={
            'claimId': claim_id,
            'timestamp': timestamp.isoformat(),
            'action': 'claim_submitted',
            'actor': 'system',
            'actorType': 'intake_agent',
            'details': {
                'claimType': claim_data.get('claimType'),
                'claimValue': claim_data.get('claimValue', 0)
            }
        })
        
        return {
            "success": True,
            "claimId": claim_id,
            "message": f"Claim {claim_id} saved successfully"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@tool
def validate_claim_data(claim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that all required claim fields are present and valid.
    
    Args:
        claim_data: Dictionary containing claim information
    
    Returns:
        Dictionary with validation result and any errors
    """
    errors = []
    
    # Required fields
    required_fields = [
        'claimantInfo',
        'policyNumber',
        'claimType',
        'incidentDate',
        'incidentDescription',
        'claimValue'
    ]
    
    for field in required_fields:
        if field not in claim_data or not claim_data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate claimant info
    if 'claimantInfo' in claim_data:
        claimant = claim_data['claimantInfo']
        required_claimant_fields = ['name', 'email', 'phone']
        for field in required_claimant_fields:
            if field not in claimant or not claimant[field]:
                errors.append(f"Missing claimant {field}")
    
    # Validate claim type
    valid_types = ['vehicle', 'property', 'liability', 'other']
    if claim_data.get('claimType') not in valid_types:
        errors.append(f"Invalid claim type. Must be one of: {', '.join(valid_types)}")
    
    # Validate claim value
    try:
        value = float(claim_data.get('claimValue', 0))
        if value <= 0:
            errors.append("Claim value must be greater than 0")
    except (ValueError, TypeError):
        errors.append("Claim value must be a valid number")
    
    if errors:
        return {
            "valid": False,
            "errors": errors
        }
    
    return {
        "valid": True,
        "message": "All required fields are present and valid"
    }

# Create Intake Agent
intake_agent = Agent(
    model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
    tools=[validate_policy_number, save_claim_to_database, validate_claim_data],
    instructions="""You are an insurance claim intake agent. Your role is to help claimants file insurance claims through a conversational process.

CONVERSATION FLOW:
1. Greet the claimant warmly and explain you'll help them file their claim
2. Ask what type of claim they're filing (vehicle, property, liability, or other)
3. Collect the following information in a natural, conversational way:
   - Full name
   - Email address
   - Phone number
   - Policy number (validate using validate_policy_number tool)
   - Incident date
   - Detailed description of what happened
   - Estimated claim value
   - Whether there were injuries (if applicable)
   - Police report number (if applicable)

IMPORTANT GUIDELINES:
- Be empathetic and professional
- Ask one or two questions at a time, don't overwhelm the claimant
- Validate the policy number as soon as you receive it
- If the policy is invalid, politely inform them and ask for the correct number
- Confirm all information before submitting
- Use validate_claim_data to ensure all required fields are collected
- Once validated, use save_claim_to_database to submit the claim
- Provide the claim ID and explain next steps

TONE:
- Friendly and supportive
- Clear and concise
- Patient and understanding
- Professional but not robotic

After successfully submitting the claim, inform the claimant:
- Their claim ID
- That it has been automatically assigned to a reviewer
- Expected review timeline (2-3 business days)
- That they'll receive email updates""",
    
    system_prompt="You are a helpful insurance claim intake agent. Always be professional, empathetic, and thorough."
)

def lambda_handler(event, context):
    """
    Lambda handler for intake agent
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        user_message = body.get('message', '')
        conversation_history = body.get('history', [])
        
        # Run agent
        response = intake_agent.run(
            user_message,
            conversation_history=conversation_history
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'response': response.content,
                'metadata': {
                    'agent': 'intake_agent',
                    'model': 'claude-3-5-sonnet'
                }
            })
        }
        
    except Exception as e:
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
