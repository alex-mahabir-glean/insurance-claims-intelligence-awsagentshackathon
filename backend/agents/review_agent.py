"""
Review Agent - Strands Agent for Claim Review and Analysis
Analyzes claims, queries Glean for policy information, and provides recommendations
"""

from strands import Agent, tool
import boto3
import json
import os
import requests
from datetime import datetime
from typing import Dict, Any, List

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
claims_table = dynamodb.Table(os.environ.get('CLAIMS_TABLE', 'LegalService-Claims'))
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail'))

# Glean API configuration
GLEAN_API_URL = os.environ.get('GLEAN_API_URL', 'https://api.glean.com/api/v1')
GLEAN_API_TOKEN = os.environ.get('GLEAN_API_TOKEN', '')

@tool
def get_claim_for_review(claim_id: str) -> Dict[str, Any]:
    """
    Retrieve complete claim information for review.
    
    Args:
        claim_id: The claim ID to review
    
    Returns:
        Dictionary with complete claim details
    """
    try:
        response = claims_table.get_item(Key={'claimId': claim_id})
        return response.get('Item', {})
    except Exception as e:
        print(f"Error fetching claim: {e}")
        return {}

@tool
def query_glean_for_policy(policy_number: str, claim_type: str) -> Dict[str, Any]:
    """
    Query Glean knowledge base for policy coverage information.
    
    Args:
        policy_number: The policy number to look up
        claim_type: Type of claim to check coverage for
    
    Returns:
        Dictionary with policy coverage details
    """
    try:
        # In production, this would call actual Glean API
        # For demo, return mock policy data
        
        headers = {
            'Authorization': f'Bearer {GLEAN_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        query = f"What coverage does policy {policy_number} have for {claim_type} claims?"
        
        # Mock response for demo
        # In production: response = requests.post(f'{GLEAN_API_URL}/search', headers=headers, json={'query': query})
        
        return {
            "policy_number": policy_number,
            "coverage_type": claim_type,
            "is_covered": True,
            "deductible": 500,
            "coverage_limit": 50000,
            "exclusions": [],
            "notes": f"Policy {policy_number} includes comprehensive coverage for {claim_type} claims with $500 deductible."
        }
        
    except Exception as e:
        print(f"Error querying Glean: {e}")
        return {
            "error": str(e),
            "is_covered": None
        }

@tool
def search_similar_claims(claim_type: str, claim_description: str) -> List[Dict[str, Any]]:
    """
    Search Glean knowledge base for similar past claims.
    
    Args:
        claim_type: Type of claim
        claim_description: Description of the incident
    
    Returns:
        List of similar claims with outcomes
    """
    try:
        # In production, this would search Glean for similar cases
        # For demo, return mock similar claims
        
        similar_claims = [
            {
                "claim_id": "CL-2024-0892",
                "type": claim_type,
                "outcome": "approved",
                "similarity_score": 0.89,
                "reason": "Similar circumstances with police report"
            },
            {
                "claim_id": "CL-2024-1203",
                "type": claim_type,
                "outcome": "approved",
                "similarity_score": 0.85,
                "reason": "Hit-and-run case with witness statements"
            }
        ]
        
        return similar_claims
        
    except Exception as e:
        print(f"Error searching similar claims: {e}")
        return []

@tool
def check_fraud_indicators(claim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze claim for potential fraud indicators.
    
    Args:
        claim_data: Complete claim information
    
    Returns:
        Dictionary with fraud analysis results
    """
    red_flags = []
    risk_score = 0.0
    
    # Check for common fraud indicators
    claim_value = claim_data.get('claimValue', 0)
    
    # High claim value
    if claim_value > 50000:
        red_flags.append("High claim value (>$50,000)")
        risk_score += 0.2
    
    # Missing documentation
    documents = claim_data.get('documents', [])
    if len(documents) == 0:
        red_flags.append("No supporting documents provided")
        risk_score += 0.3
    
    # Delayed reporting (would check actual dates in production)
    incident_date = claim_data.get('incidentDate', '')
    submitted_date = claim_data.get('submittedDate', '')
    # Simplified check for demo
    
    # No police report for significant incidents
    if claim_value > 5000 and not claim_data.get('policeReport'):
        red_flags.append("No police report for significant incident")
        risk_score += 0.2
    
    return {
        "risk_score": min(risk_score, 1.0),
        "risk_level": "low" if risk_score < 0.3 else "medium" if risk_score < 0.6 else "high",
        "red_flags": red_flags,
        "recommendation": "approve" if risk_score < 0.5 else "investigate"
    }

@tool
def save_review_recommendation(claim_id: str, recommendation: str, reason: str, confidence: float) -> Dict[str, Any]:
    """
    Save AI review recommendation to the claim record.
    
    Args:
        claim_id: The claim ID
        recommendation: approve, deny, or more_info_needed
        reason: Detailed explanation for the recommendation
        confidence: Confidence score (0-1)
    
    Returns:
        Dictionary with save result
    """
    try:
        timestamp = datetime.utcnow().isoformat()
        
        # Update claim with AI recommendation
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET aiRecommendation = :rec, aiRecommendationReason = :reason, aiConfidence = :conf, lastUpdated = :updated',
            ExpressionAttributeValues={
                ':rec': recommendation,
                ':reason': reason,
                ':conf': confidence,
                ':updated': timestamp
            }
        )
        
        # Log to audit trail
        audit_table.put_item(Item={
            'claimId': claim_id,
            'timestamp': timestamp,
            'action': 'ai_review_completed',
            'actor': 'system',
            'actorType': 'review_agent',
            'details': {
                'recommendation': recommendation,
                'confidence': confidence
            }
        })
        
        return {
            "success": True,
            "claimId": claim_id,
            "recommendation": recommendation,
            "message": "Review recommendation saved successfully"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@tool
def draft_customer_response(claim_id: str, decision: str, claim_data: Dict[str, Any]) -> str:
    """
    Draft a customer response letter based on the decision.
    
    Args:
        claim_id: The claim ID
        decision: approve or deny
        claim_data: Complete claim information
    
    Returns:
        Drafted response letter text
    """
    claimant_name = claim_data.get('claimantInfo', {}).get('name', 'Valued Customer')
    claim_value = claim_data.get('claimValue', 0)
    policy_number = claim_data.get('policyNumber', '')
    
    if decision == 'approve':
        return f"""Dear {claimant_name},

We have completed our review of claim {claim_id} and are pleased to inform you that your claim has been approved.

Claim Details:
- Policy Number: {policy_number}
- Claim Amount: ${claim_value:,.2f}
- Status: Approved

Payment Processing:
Your claim payment of ${claim_value:,.2f} will be processed within 5-7 business days. You will receive payment via the method specified in your policy.

Next Steps:
- You will receive a detailed settlement letter via email
- Payment will be sent to your designated account
- Please retain all documentation for your records

If you have any questions about your claim or payment, please contact our claims department at 1-800-CLAIMS-1.

Thank you for your patience during the review process.

Sincerely,
Legal Service Management Claims Department"""
    
    else:  # deny
        return f"""Dear {claimant_name},

We have completed our review of claim {claim_id}. After careful consideration, we must inform you that your claim has been denied.

Claim Details:
- Policy Number: {policy_number}
- Claim Amount: ${claim_value:,.2f}
- Status: Denied

Reason for Denial:
[Specific reason will be provided by the reviewer]

Your Rights:
- You have the right to appeal this decision within 30 days
- You may submit additional documentation to support your claim
- You may request a detailed explanation of the denial

To Appeal:
Please contact our appeals department at 1-800-APPEAL-1 or email appeals@legalservices.com within 30 days of receiving this letter.

We understand this may be disappointing news. If you have questions about this decision, please don't hesitate to contact us.

Sincerely,
Legal Service Management Claims Department"""

# Create Review Agent
review_agent = Agent(
    model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
    tools=[
        get_claim_for_review,
        query_glean_for_policy,
        search_similar_claims,
        check_fraud_indicators,
        save_review_recommendation,
        draft_customer_response
    ],
    instructions="""You are an expert insurance claim review agent. Your role is to analyze claims thoroughly and provide well-reasoned recommendations.

REVIEW PROCESS:
1. Use get_claim_for_review to retrieve complete claim information
2. Use query_glean_for_policy to verify coverage for the claim type
3. Use search_similar_claims to find precedents and patterns
4. Use check_fraud_indicators to identify any red flags
5. Analyze all information and form a recommendation
6. Use save_review_recommendation to record your analysis
7. If asked, use draft_customer_response to prepare communication

ANALYSIS FACTORS:
1. Policy Coverage: Does the policy cover this type of claim?
2. Documentation: Is there sufficient evidence (police reports, photos, medical records)?
3. Consistency: Is the claim description consistent with the evidence?
4. Fraud Risk: Are there any red flags or suspicious elements?
5. Similar Cases: How were similar claims handled?
6. Claim Value: Is the requested amount reasonable?

RECOMMENDATION GUIDELINES:
- APPROVE: Strong evidence, clear coverage, no red flags, similar cases approved
- DENY: Not covered by policy, insufficient evidence, fraud indicators, contradictions
- MORE_INFO_NEEDED: Unclear coverage, missing documentation, need clarification

CONFIDENCE SCORING:
- High (0.9-1.0): Clear-cut case with strong evidence
- Medium (0.7-0.89): Good case but some minor uncertainties
- Low (0.5-0.69): Significant uncertainties or missing information

REASONING:
Always provide detailed, specific reasoning that includes:
- Policy coverage analysis
- Documentation assessment
- Fraud risk evaluation
- Comparison to similar cases
- Specific factors that influenced your decision

TONE:
- Professional and objective
- Data-driven and analytical
- Clear and specific
- Empathetic but firm

When interacting with reviewers:
- Present your analysis clearly
- Offer to answer questions about policies or similar cases
- Provide actionable recommendations
- Be ready to draft customer communications""",
    
    system_prompt="You are an expert claim reviewer. Provide thorough, objective analysis based on policy terms, evidence, and precedent."
)

def lambda_handler(event, context):
    """
    Lambda handler for review agent
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        claim_id = body.get('claimId')
        action = body.get('action', 'review')  # review, approve, deny, draft_response
        
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
        
        # Build task based on action
        if action == 'review':
            task = f"Analyze claim {claim_id} thoroughly. Review the policy coverage, check for fraud indicators, search for similar cases, and provide a detailed recommendation with reasoning."
        elif action == 'approve':
            task = f"Process approval for claim {claim_id}. Draft an approval letter for the customer."
        elif action == 'deny':
            task = f"Process denial for claim {claim_id}. Draft a denial letter explaining the decision."
        else:
            task = body.get('message', f"Review claim {claim_id}")
        
        # Run agent
        response = review_agent.run(task)
        
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
                    'agent': 'review_agent',
                    'model': 'claude-3-5-sonnet',
                    'claimId': claim_id,
                    'action': action
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
