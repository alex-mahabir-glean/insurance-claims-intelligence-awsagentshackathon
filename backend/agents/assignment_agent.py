"""
Assignment Agent - Strands Agent for Claim Assignment
Automatically assigns claims to optimal reviewers based on expertise and workload
"""

from strands import Agent, tool
import boto3
import json
import os
from datetime import datetime
from typing import Dict, Any, List

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
claims_table = dynamodb.Table(os.environ.get('CLAIMS_TABLE', 'LegalService-Claims'))
reviewers_table = dynamodb.Table(os.environ.get('REVIEWERS_TABLE', 'LegalService-Reviewers'))
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail'))

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

@tool
def get_available_reviewers() -> List[Dict[str, Any]]:
    """
    Get all reviewers with their current workload and expertise.
    
    Returns:
        List of reviewer dictionaries with workload and expertise info
    """
    try:
        response = reviewers_table.scan()
        reviewers = response.get('Items', [])
        
        # Calculate availability score for each reviewer
        for reviewer in reviewers:
            current = reviewer.get('currentWorkload', 0)
            max_capacity = reviewer.get('maxCapacity', 10)
            reviewer['availability_score'] = (max_capacity - current) / max_capacity
            reviewer['is_available'] = current < max_capacity
        
        return reviewers
        
    except Exception as e:
        print(f"Error fetching reviewers: {e}")
        return []

@tool
def get_claim_details(claim_id: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific claim.
    
    Args:
        claim_id: The claim ID to retrieve
    
    Returns:
        Dictionary with claim details
    """
    try:
        response = claims_table.get_item(Key={'claimId': claim_id})
        return response.get('Item', {})
    except Exception as e:
        print(f"Error fetching claim: {e}")
        return {}

@tool
def assign_claim_to_reviewer(claim_id: str, reviewer_id: str, reason: str) -> Dict[str, Any]:
    """
    Assign a claim to a specific reviewer.
    
    Args:
        claim_id: The claim ID to assign
        reviewer_id: The reviewer ID to assign to
        reason: Explanation for why this reviewer was chosen
    
    Returns:
        Dictionary with assignment result
    """
    try:
        timestamp = datetime.utcnow().isoformat()
        
        # Update claim with assignment
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET assignedTo = :reviewer, #status = :status, assignedDate = :date, lastUpdated = :updated',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':reviewer': reviewer_id,
                ':status': 'assigned',
                ':date': timestamp,
                ':updated': timestamp
            }
        )
        
        # Update reviewer workload
        reviewers_table.update_item(
            Key={'reviewerId': reviewer_id},
            UpdateExpression='SET currentWorkload = currentWorkload + :inc, activeClaims = list_append(activeClaims, :claim)',
            ExpressionAttributeValues={
                ':inc': 1,
                ':claim': [claim_id]
            }
        )
        
        # Log to audit trail
        audit_table.put_item(Item={
            'claimId': claim_id,
            'timestamp': timestamp,
            'action': 'claim_assigned',
            'actor': 'system',
            'actorType': 'assignment_agent',
            'details': {
                'reviewerId': reviewer_id,
                'reason': reason
            }
        })
        
        reviewer_name = get_reviewer_display_name(reviewer_id)
        
        return {
            "success": True,
            "claimId": claim_id,
            "assignedTo": reviewer_id,
            "assignedToName": reviewer_name,
            "reason": reason,
            "message": f"Claim {claim_id} assigned to {reviewer_name}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@tool
def calculate_reviewer_score(reviewer: Dict[str, Any], claim_type: str, claim_value: float) -> float:
    """
    Calculate a score for how well a reviewer matches a claim.
    
    Args:
        reviewer: Reviewer dictionary with expertise and stats
        claim_type: Type of claim (vehicle, property, liability)
        claim_value: Value of the claim
    
    Returns:
        Score from 0-100 indicating match quality
    """
    score = 0.0
    
    # Expertise match (40 points)
    expertise = reviewer.get('expertise', [])
    if claim_type in expertise:
        score += 40
    
    # Availability (30 points)
    availability = reviewer.get('availability_score', 0)
    score += availability * 30
    
    # Performance metrics (30 points)
    accuracy = reviewer.get('accuracy', 0.9)
    approval_rate = reviewer.get('approvalRate', 0.85)
    score += (accuracy * 15) + (approval_rate * 15)
    
    # Penalty for high workload
    current_workload = reviewer.get('currentWorkload', 0)
    max_capacity = reviewer.get('maxCapacity', 10)
    if current_workload >= max_capacity * 0.8:
        score *= 0.7  # 30% penalty for near capacity
    
    return round(score, 2)

# Create Assignment Agent
assignment_agent = Agent(
    model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
    tools=[get_available_reviewers, get_claim_details, assign_claim_to_reviewer, calculate_reviewer_score],
    instructions="""You are an intelligent claim assignment agent. Your role is to automatically assign insurance claims to the most suitable reviewer.

ASSIGNMENT PROCESS:
1. Use get_claim_details to understand the claim (type, value, complexity)
2. Use get_available_reviewers to get all reviewers with their expertise and workload
3. For each available reviewer, use calculate_reviewer_score to determine match quality
4. Select the reviewer with the highest score
5. Use assign_claim_to_reviewer to make the assignment

SELECTION CRITERIA (in order of importance):
1. Expertise Match: Reviewer must have expertise in the claim type
2. Availability: Reviewer should have capacity (not at max workload)
3. Performance: Consider accuracy and approval rate
4. Workload Balance: Distribute claims evenly when scores are similar

TIE-BREAKING:
If multiple reviewers have similar scores:
- Prefer the reviewer with more total claims reviewed (experience)
- Prefer the reviewer with lower current workload
- Prefer the reviewer with higher accuracy

REASONING:
Always provide clear reasoning for your assignment decision, including:
- Why this reviewer was selected
- Their expertise match
- Their current workload
- Any other relevant factors

SPECIAL CASES:
- High-value claims (>$50,000): Prefer reviewers with higher accuracy
- Complex claims: Prefer reviewers with more experience
- If no reviewer has matching expertise: Select based on availability and performance
- If all reviewers are at capacity: Select the one closest to completing current claims""",
    
    system_prompt="You are an intelligent assignment system. Make data-driven decisions to optimize claim review efficiency and quality."
)

def lambda_handler(event, context):
    """
    Lambda handler for assignment agent
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        claim_id = body.get('claimId')
        
        if not claim_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'claimId is required'
                })
            }
        
        # Run agent with assignment task
        task = f"Assign claim {claim_id} to the most suitable reviewer. Analyze the claim details, evaluate all available reviewers, and make the optimal assignment."
        
        response = assignment_agent.run(task)
        
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
                    'agent': 'assignment_agent',
                    'model': 'claude-3-5-sonnet',
                    'claimId': claim_id
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
