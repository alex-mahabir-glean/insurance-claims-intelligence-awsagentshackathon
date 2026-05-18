"""
Legal Service Review Agent for Bedrock AgentCore
Handles claim review, analysis, and decision support
"""

from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
import json
import boto3
import os
from datetime import datetime, timezone
from decimal import Decimal

# Initialize the AgentCore app
app = BedrockAgentCoreApp()

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
# Table names will be replaced during deployment with correct DEPLOYMENT_ID
claims_table = dynamodb.Table(os.environ.get('CLAIMS_TABLE', 'LegalService-Claims-legal'))
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail-legal'))

# Reviewer ID to display name mapping
REVIEWER_NAMES = {
    'sarah-chen': 'Sarah Chen',
    'mike-torres': 'Mike Torres',
    'lisa-park': 'Lisa Park',
    'reviewer-sarah-johnson': 'Sarah Johnson',
    'reviewer-michael-chen': 'Michael Chen',
    'reviewer-emily-rodriguez': 'Emily Rodriguez',
    'reviewer-david-thompson': 'David Thompson',
    'reviewer-jessica-martinez': 'Jessica Martinez'
}

def get_reviewer_display_name(reviewer_id):
    """Convert reviewer ID to display name"""
    return REVIEWER_NAMES.get(reviewer_id, reviewer_id)

# Define system prompt
SYSTEM_PROMPT = """You are an AI assistant specialized in insurance claim review and analysis for legal service management.

Your role is to:
1. Analyze claims and provide detailed recommendations
2. Help reviewers understand AI assessments and confidence scores
3. Process approve, deny, and reassignment actions
4. Provide insights on claim patterns and risk factors

Available actions:
- get_all_claims: Retrieve all claims in the system
- get_claim_details: Get detailed information about a specific claim
- approve_claim: Approve a claim with notes
- deny_claim: Deny a claim with reason
- reassign_claim: Reassign a claim to another reviewer

Be analytical, thorough, and provide clear reasoning for recommendations.
Always explain the basis for AI recommendations and highlight key factors in claim decisions.
When reviewing claims, consider policy coverage, documentation quality, fraud indicators, and claim value reasonableness."""

@tool
def get_all_claims():
    """
    Retrieve all claims in the system.
    
    Returns:
        dict: Success status and list of claims
    """
    try:
        response = claims_table.scan()
        claims = response.get('Items', [])
        
        # Convert Decimal to float and transform reviewer IDs for JSON serialization
        for claim in claims:
            if 'claimValue' in claim:
                claim['claimValue'] = str(claim['claimValue'])
            if 'aiConfidence' in claim:
                claim['aiConfidence'] = str(claim['aiConfidence'])
            if 'assignedTo' in claim:
                claim['assignedToName'] = get_reviewer_display_name(claim['assignedTo'])
        
        return {
            'success': True,
            'claims': claims,
            'count': len(claims)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to retrieve claims: {str(e)}'
        }

@tool
def get_claim_details(claim_id: str):
    """
    Get detailed information about a specific claim.
    
    Args:
        claim_id: Unique claim identifier
    
    Returns:
        dict: Success status and claim details
    """
    try:
        response = claims_table.get_item(Key={'claimId': claim_id})
        
        if 'Item' not in response:
            return {
                'success': False,
                'error': f'Claim {claim_id} not found'
            }
        
        claim = response['Item']
        
        # Convert Decimal to string and transform reviewer IDs for JSON serialization
        if 'claimValue' in claim:
            claim['claimValue'] = str(claim['claimValue'])
        if 'aiConfidence' in claim:
            claim['aiConfidence'] = str(claim['aiConfidence'])
        if 'assignedTo' in claim:
            claim['assignedToName'] = get_reviewer_display_name(claim['assignedTo'])
        
        return {
            'success': True,
            'claim': claim
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to retrieve claim details: {str(e)}'
        }

@tool
def approve_claim(claim_id: str, reviewer_id: str, notes: str = ""):
    """
    Approve a claim and update its status.
    
    Args:
        claim_id: Unique claim identifier
        reviewer_id: ID of the reviewer approving the claim
        notes: Optional approval notes
    
    Returns:
        dict: Success status and updated claim info
    """
    try:
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Update claim status
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET #status = :status, finalDecision = :decision, decisionReason = :reason, reviewedDate = :reviewed, lastUpdated = :updated',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'approved',
                ':decision': 'approve',
                ':reason': notes or 'Claim approved by reviewer',
                ':reviewed': timestamp,
                ':updated': timestamp
            }
        )
        
        # Log to audit trail
        audit_record = {
            'auditId': f"AUDIT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            'claimId': claim_id,
            'action': 'approve',
            'performedBy': reviewer_id,
            'timestamp': timestamp,
            'details': {
                'notes': notes,
                'previousStatus': 'under_review',
                'newStatus': 'approved'
            }
        }
        
        audit_table.put_item(Item=audit_record)
        
        return {
            'success': True,
            'claimId': claim_id,
            'status': 'approved',
            'message': f'Claim {claim_id} approved successfully'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to approve claim: {str(e)}'
        }

@tool
def deny_claim(claim_id: str, reviewer_id: str, reason: str):
    """
    Deny a claim with a reason and update its status.
    
    Args:
        claim_id: Unique claim identifier
        reviewer_id: ID of the reviewer denying the claim
        reason: Reason for denial (required)
    
    Returns:
        dict: Success status and updated claim info
    """
    try:
        if not reason.strip():
            return {
                'success': False,
                'error': 'Denial reason is required'
            }
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Update claim status
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET #status = :status, finalDecision = :decision, decisionReason = :reason, reviewedDate = :reviewed, lastUpdated = :updated',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'denied',
                ':decision': 'deny',
                ':reason': reason,
                ':reviewed': timestamp,
                ':updated': timestamp
            }
        )
        
        # Log to audit trail
        audit_record = {
            'auditId': f"AUDIT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            'claimId': claim_id,
            'action': 'deny',
            'performedBy': reviewer_id,
            'timestamp': timestamp,
            'details': {
                'reason': reason,
                'previousStatus': 'under_review',
                'newStatus': 'denied'
            }
        }
        
        audit_table.put_item(Item=audit_record)
        
        return {
            'success': True,
            'claimId': claim_id,
            'status': 'denied',
            'message': f'Claim {claim_id} denied'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to deny claim: {str(e)}'
        }

@tool
def reassign_claim(claim_id: str, to_reviewer_id: str, reason: str = ""):
    """
    Reassign a claim to another reviewer.
    Supports "next-available" as to_reviewer_id for intelligent auto-assignment.
    
    Args:
        claim_id: Unique claim identifier
        to_reviewer_id: ID of the reviewer to assign the claim to, or "next-available" for auto-assignment
        reason: Optional reason for reassignment
    
    Returns:
        dict: Success status and updated assignment info with reviewer display name
    """
    try:
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Update claim assignment
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET assignedTo = :assignedTo, assignedDate = :assignedDate, lastUpdated = :updated',
            ExpressionAttributeValues={
                ':assignedTo': to_reviewer_id,
                ':assignedDate': timestamp,
                ':updated': timestamp
            }
        )
        
        # Log to audit trail
        audit_record = {
            'auditId': f"AUDIT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            'claimId': claim_id,
            'action': 'reassign',
            'performedBy': 'system',
            'timestamp': timestamp,
            'details': {
                'newAssignee': to_reviewer_id,
                'reason': reason or 'Claim reassignment'
            }
        }
        
        audit_table.put_item(Item=audit_record)
        
        reviewer_name = get_reviewer_display_name(to_reviewer_id)
        
        return {
            'success': True,
            'claimId': claim_id,
            'assignedTo': to_reviewer_id,
            'assignedToName': reviewer_name,
            'message': f'Claim {claim_id} reassigned successfully to {reviewer_name}'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to reassign claim: {str(e)}'
        }

# Configure Amazon Nova Pro model
nova_model = BedrockModel(
    model_id="amazon.nova-pro-v1:0",
    temperature=0.7,
    region_name=os.environ.get('AWS_REGION', 'us-east-1')
)

# Initialize the Strands agent with system prompt, tools, and Nova model
agent = Agent(
    model=nova_model,
    system_prompt=SYSTEM_PROMPT,
    tools=[get_all_claims, get_claim_details, approve_claim, deny_claim, reassign_claim]
)

@app.entrypoint
def invoke(payload):
    """Process user input and return a response"""
    try:
        user_message = payload.get("prompt", "Hello")
        
        # Process the message through the Strands agent
        response = agent(user_message)
        
        # Return the response as a string
        return str(response)
        
    except Exception as e:
        return f"I apologize, but I encountered an error: {str(e)}. Please try again or contact support."

if __name__ == "__main__":
    app.run()
