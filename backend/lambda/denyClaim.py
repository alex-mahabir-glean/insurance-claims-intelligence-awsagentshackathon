"""
Deny Claim Lambda Function
Processes claim denial and generates customer response
"""

import json
import boto3
import os
from datetime import datetime

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
CLAIMS_TABLE = os.environ.get('CLAIMS_TABLE', 'LegalService-Claims')
REVIEWERS_TABLE = os.environ.get('REVIEWERS_TABLE', 'LegalService-Reviewers')
AUDIT_TABLE = os.environ.get('AUDIT_TABLE', 'LegalService-AuditTrail')

claims_table = dynamodb.Table(CLAIMS_TABLE)
reviewers_table = dynamodb.Table(REVIEWERS_TABLE)
audit_table = dynamodb.Table(AUDIT_TABLE)

def lambda_handler(event, context):
    """
    Deny a claim
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        claim_id = body.get('claimId')
        reviewer_id = body.get('reviewerId')
        reason = body.get('reason', '')
        notes = body.get('notes', '')
        
        if not claim_id or not reviewer_id or not reason:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'claimId, reviewerId, and reason are required'
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

We have completed our review of claim {claim_id}. After careful consideration, we must inform you that your claim has been denied.

Claim Details:
- Policy Number: {policy_number}
- Claim Amount: ${claim_value:,.2f}
- Status: Denied

Reason for Denial:
{reason}

{notes if notes else ''}

Your Rights:
- You have the right to appeal this decision within 30 days
- You may submit additional documentation to support your claim
- You may request a detailed explanation of the denial

To Appeal:
Please contact our appeals department at 1-800-APPEAL-1 or email appeals@legalservices.com within 30 days of receiving this letter.

We understand this may be disappointing news. If you have questions about this decision, please don't hesitate to contact us.

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
                ':status': 'denied',
                ':decision': 'deny',
                ':reason': reason,
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
            'action': 'claim_denied',
            'actor': reviewer_id,
            'actorType': 'reviewer',
            'details': {
                'decision': 'deny',
                'reason': reason,
                'notes': notes
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
                'status': 'denied',
                'customerResponseBody': customer_response,
                'message': f"Claim {claim_id} denied. Customer notification sent."
            })
        }
        
    except Exception as e:
        print(f"Error in denyClaim: {e}")
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
