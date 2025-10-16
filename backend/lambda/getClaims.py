"""
Get Claims Lambda Function
Retrieves claims for the reviewer dashboard
"""

import json
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
CLAIMS_TABLE = os.environ.get('CLAIMS_TABLE', 'LegalService-Claims')
claims_table = dynamodb.Table(CLAIMS_TABLE)

def lambda_handler(event, context):
    """
    Get claims - supports filtering by reviewer, status, etc.
    """
    try:
        # Parse query parameters
        params = event.get('queryStringParameters', {}) or {}
        reviewer_id = params.get('reviewerId')
        status = params.get('status')
        claim_id = event.get('pathParameters', {}).get('claimId') if event.get('pathParameters') else None
        
        # If specific claim ID requested
        if claim_id:
            response = claims_table.get_item(Key={'claimId': claim_id})
            claim = response.get('Item')
            
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
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'claim': claim
                }, default=str)
            }
        
        # Get all claims with optional filtering
        scan_kwargs = {}
        filter_expressions = []
        
        if reviewer_id:
            filter_expressions.append(Attr('assignedTo').eq(reviewer_id))
        
        if status:
            filter_expressions.append(Attr('status').eq(status))
        
        if filter_expressions:
            filter_expression = filter_expressions[0]
            for expr in filter_expressions[1:]:
                filter_expression = filter_expression & expr
            scan_kwargs['FilterExpression'] = filter_expression
        
        response = claims_table.scan(**scan_kwargs)
        claims = response.get('Items', [])
        
        # Sort by submitted date (newest first)
        claims.sort(key=lambda x: x.get('submittedDate', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'claims': claims,
                'count': len(claims)
            }, default=str)
        }
        
    except Exception as e:
        print(f"Error in getClaims: {e}")
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
