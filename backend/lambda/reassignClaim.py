"""
Reassign Claim Lambda Function
Reassigns a claim to a different reviewer
Supports "next-available" option for intelligent auto-assignment
"""

import json
import boto3
import os
import random
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

# Reverse mapping: Display name to reviewer ID
DISPLAY_NAME_TO_ID = {
    'Sarah Chen': 'sarah-chen',
    'Mike Torres': 'mike-torres',
    'Lisa Park': 'lisa-park',
    'Sarah Johnson': 'reviewer-sarah-johnson',
    'Michael Chen': 'reviewer-michael-chen',
    'Emily Rodriguez': 'reviewer-emily-rodriguez',
    'David Thompson': 'reviewer-david-thompson',
    'Jessica Martinez': 'reviewer-jessica-martinez',
    'Intelligent Reassignment (Recommended)': 'next-available'
}

def get_reviewer_display_name(reviewer_id):
    """Convert reviewer ID to display name"""
    return REVIEWER_NAMES.get(reviewer_id, reviewer_id)

def get_reviewer_id_from_display_name(display_name):
    """Convert display name to reviewer ID"""
    return DISPLAY_NAME_TO_ID.get(display_name, display_name.lower().replace(' ', '-'))

def find_next_available_reviewer(current_reviewer_id=None):
    """
    Find the next available reviewer using data-driven selection.
    
    Selection criteria (in order):
    1. Lowest current workload
    2. If tie: Lowest total claims reviewed (less experienced gets opportunity)
    3. If still tie: Highest accuracy (quality tie-breaker)
    4. If still tie: Random selection
    
    Args:
        current_reviewer_id: Optional current reviewer to exclude from selection
    
    Returns:
        dict: Selected reviewer object or None if no reviewers available
    """
    try:
        # Get all reviewers
        response = reviewers_table.scan()
        reviewers = response.get('Items', [])
        
        if not reviewers:
            return None
        
        # Filter out current reviewer and reviewers at capacity
        available_reviewers = []
        for reviewer in reviewers:
            reviewer_id = reviewer.get('reviewerId')
            current_workload = int(reviewer.get('currentWorkload', 0))
            max_capacity = int(reviewer.get('maxCapacity', 10))
            
            # Skip current reviewer and those at capacity
            if reviewer_id == current_reviewer_id:
                continue
            if current_workload >= max_capacity:
                continue
                
            available_reviewers.append(reviewer)
        
        if not available_reviewers:
            return None
        
        # Sort by selection criteria
        def sort_key(r):
            current_workload = int(r.get('currentWorkload', 0))
            total_reviewed = int(r.get('totalClaimsReviewed', 0))
            accuracy = float(r.get('accuracy', 0.0))
            # Return tuple for multi-level sorting
            # Lower workload first, then lower total reviewed, then higher accuracy
            return (current_workload, total_reviewed, -accuracy)
        
        available_reviewers.sort(key=sort_key)
        
        # Check for ties at the top
        best_reviewer = available_reviewers[0]
        best_workload = int(best_reviewer.get('currentWorkload', 0))
        best_total = int(best_reviewer.get('totalClaimsReviewed', 0))
        best_accuracy = float(best_reviewer.get('accuracy', 0.0))
        
        # Find all reviewers with same workload, total reviewed, and accuracy
        tied_reviewers = [
            r for r in available_reviewers
            if (int(r.get('currentWorkload', 0)) == best_workload and
                int(r.get('totalClaimsReviewed', 0)) == best_total and
                abs(float(r.get('accuracy', 0.0)) - best_accuracy) < 0.001)
        ]
        
        # If there's a tie, randomly select
        if len(tied_reviewers) > 1:
            selected = random.choice(tied_reviewers)
        else:
            selected = best_reviewer
        
        return selected
        
    except Exception as e:
        print(f"Error finding next available reviewer: {e}")
        return None

def lambda_handler(event, context):
    """
    Reassign a claim to a different reviewer.
    Supports "next-available" as toReviewerId for intelligent auto-assignment.
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        claim_id = body.get('claimId')
        from_reviewer_id = body.get('fromReviewerId')
        to_reviewer_id = body.get('toReviewerId')
        reason = body.get('reason', 'Reassignment requested')
        
        if not claim_id or not to_reviewer_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'claimId and toReviewerId are required'
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
        
        # Convert display name to reviewer ID if needed
        to_reviewer_id = get_reviewer_id_from_display_name(to_reviewer_id)
        
        # Get current assignee from claim
        current_assignee = claim.get('assignedTo')
        
        # If from_reviewer_id is provided, verify it matches current assignee
        if from_reviewer_id and current_assignee != from_reviewer_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': f"Claim is currently assigned to {get_reviewer_display_name(current_assignee)}, not {get_reviewer_display_name(from_reviewer_id)}"
                })
            }
        
        # Handle "next-available" option (after conversion from display name)
        if to_reviewer_id == 'next-available':
            selected_reviewer = find_next_available_reviewer(current_assignee)
            
            if not selected_reviewer:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': 'No available reviewers found. All reviewers are at capacity.'
                    })
                }
            
            to_reviewer_id = selected_reviewer.get('reviewerId')
            to_reviewer = selected_reviewer
            reason = f"Auto-assigned to next available reviewer (Workload: {selected_reviewer.get('currentWorkload', 0)}/{selected_reviewer.get('maxCapacity', 10)})"
        else:
            # Check if target reviewer exists and has capacity
            to_reviewer_response = reviewers_table.get_item(Key={'reviewerId': to_reviewer_id})
            to_reviewer = to_reviewer_response.get('Item')
            
            if not to_reviewer:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': f"Reviewer {to_reviewer_id} not found"
                    })
                }
            
            current_workload = to_reviewer.get('currentWorkload', 0)
            max_capacity = to_reviewer.get('maxCapacity', 10)
            
            if current_workload >= max_capacity:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': f"Reviewer {get_reviewer_display_name(to_reviewer_id)} is at full capacity ({current_workload}/{max_capacity})"
                    })
                }
        
        timestamp = datetime.utcnow().isoformat()
        
        # Update claim assignment
        claims_table.update_item(
            Key={'claimId': claim_id},
            UpdateExpression='SET assignedTo = :new_reviewer, assignedDate = :date, lastUpdated = :updated',
            ExpressionAttributeValues={
                ':new_reviewer': to_reviewer_id,
                ':date': timestamp,
                ':updated': timestamp
            }
        )
        
        # Update from_reviewer workload (decrease) if there was a previous assignee
        if current_assignee:
            try:
                reviewers_table.update_item(
                    Key={'reviewerId': current_assignee},
                    UpdateExpression='SET currentWorkload = currentWorkload - :dec',
                    ExpressionAttributeValues={
                        ':dec': 1
                    }
                )
            except Exception as e:
                print(f"Error updating from_reviewer workload: {e}")
        
        # Update to_reviewer workload (increase)
        try:
            reviewers_table.update_item(
                Key={'reviewerId': to_reviewer_id},
                UpdateExpression='SET currentWorkload = currentWorkload + :inc, activeClaims = list_append(if_not_exists(activeClaims, :empty_list), :claim)',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':claim': [claim_id],
                    ':empty_list': []
                }
            )
        except Exception as e:
            print(f"Error updating to_reviewer workload: {e}")
        
        # Log to audit trail
        audit_table.put_item(Item={
            'claimId': claim_id,
            'timestamp': timestamp,
            'action': 'claim_reassigned',
            'actor': current_assignee or 'system',
            'actorType': 'reviewer',
            'details': {
                'fromReviewer': current_assignee,
                'toReviewer': to_reviewer_id,
                'reason': reason
            }
        })
        
        reviewer_name = get_reviewer_display_name(to_reviewer_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'claimId': claim_id,
                'assignedTo': to_reviewer_id,
                'assignedToName': reviewer_name,
                'message': f"Reassigned Claim {claim_id} to {reviewer_name}"
            })
        }
        
    except Exception as e:
        print(f"Error in reassignClaim: {e}")
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
