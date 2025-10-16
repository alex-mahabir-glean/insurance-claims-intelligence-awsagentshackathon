"""
Approve Claim Lambda Function
Processes claim approval and generates customer response
"""

import json
import boto3
import os
from datetime import datetime

# Initialize AWS clients
bedrock_runtime = boto3.client('bedrock-agent-runtime')
dynamodb = boto3.resource('dynamodb')

# Environment variables
REVIEW_AGENT_ID = os.environ.get('REVIEW_AGENT_ID', '')
CLAIMS_TABLE = os.environ.get('CLAIMS_TABLE', 'LegalService-Claims')
REVIEWERS_TABLE = os.environ.get('REVIEWERS_TABLE', 'LegalService-Reviewers')
AUDIT_TABLE = os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail')

claims_table = dynamodb.Table(CLAIMS_TABLE)
reviewers_table = dynamodb.Table(REVIEWERS_TABLE)
audit_table = dynamodb.Table(AUDIT_TABLE)

def lambda_handler(event, context):
    """
    Approve a claim
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        claim_id = body.get('claimId')
        reviewer_id = body.get('reviewerId')
        notes = body.get('notes', '')
        
        if not claim_id or not reviewer_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'claimId and reviewerId are required'
                })
            }
        
        # Get claim details
        claim_response = claims_table.get_item(Key={'claimId': claim_id})
        claim = claim_response.get('Item')
        
        if not claim:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'Claim not found'
                })
            }
        
        # Generate customer response letter
        claimant_name = claim.get('claimantInfo', {}).get('name', 'Valued Customer')
        claim_value = claim.get('claimValue', 0)
        policy_number = claim.get('policyNumber', '')
        
        customer_response = f"""Dear {claimant_name},

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
        
        timestamp = datetime.utcnow().isoformat()
        
        # Update claim status
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET #status = :status, finalDecision = :decision, decisionReason = :reason, reviewedDate = :reviewed, customerResponseSent = :sent, customerResponseBody = :response, lastUpdated = :updated',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': 'approved',
                ':decision': 'approve',
                ':reason': notes or 'Claim approved by reviewer',
                ':reviewed': timestamp,
                ':sent': True,
                ':response': customer_response,
                ':updated': timestamp
            }
        )
        
        # Update reviewer workload
        try:
            reviewers_table.update_item(
                Key={'reviewerId': reviewer_id},
                UpdateExpression='SET currentWorkload = currentWorkload - :dec',
                ExpressionAttributeValues={
                    ':dec': 1
                }
            )
        except Exception as e:
            print(f"Error updating reviewer workload: {e}")
        
        # Log to audit trail
        audit_table.put_item(Item={
            'claimId': claim_id,
            'timestamp': timestamp,
            'action': 'claim_approved',
            'actor': reviewer_id,
            'actorType': 'reviewer',
            'details': {
                'decision': 'approve',
                'notes': notes,
                'claimValue': claim_value
            }
        })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'claimId': claim_id,
                'status': 'approved',
                'customerResponseBody': customer_response,
                'message': f"Claim {claim_id} approved successfully. Customer notification sent."
            })
        }
        
    except Exception as e:
        print(f"Error in approveClaim: {e}")
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
