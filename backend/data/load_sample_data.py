#!/usr/bin/env python3
"""
Load sample data into DynamoDB tables
"""

import json
import boto3
import sys
import os
from decimal import Decimal

def load_json_file(filepath):
    """Load and parse JSON file"""
    with open(filepath, 'r') as f:
        return json.load(f)

def convert_dynamodb_json_to_python(item):
    """Convert DynamoDB JSON format to Python dict"""
    def convert_value(value):
        if isinstance(value, dict):
            if 'S' in value:
                return value['S']
            elif 'N' in value:
                return Decimal(value['N'])
            elif 'BOOL' in value:
                return value['BOOL']
            elif 'M' in value:
                return {k: convert_value(v) for k, v in value['M'].items()}
            elif 'L' in value:
                return [convert_value(v) for v in value['L']]
            elif 'NULL' in value:
                return None
            else:
                # Regular dict, convert recursively
                return {k: convert_value(v) for k, v in value.items()}
        return value
    
    return convert_value(item)

def load_data_to_table(dynamodb, table_name, items):
    """Load items into DynamoDB table"""
    table = dynamodb.Table(table_name)
    
    print(f"Loading {len(items)} items into {table_name}...")
    
    for item_wrapper in items:
        if 'PutRequest' in item_wrapper:
            item = item_wrapper['PutRequest']['Item']
            # Convert DynamoDB JSON format to Python
            python_item = convert_dynamodb_json_to_python(item)
            
            try:
                table.put_item(Item=python_item)
                print(f"  ✓ Loaded item: {python_item.get('claimId') or python_item.get('reviewerId')}")
            except Exception as e:
                print(f"  ✗ Error loading item: {e}")
                continue
    
    print(f"✅ Completed loading data into {table_name}\n")

def main():
    # Get deployment ID from environment or use default
    deployment_id = os.environ.get('DEPLOYMENT_ID', 'legal')
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    print(f"Loading sample data for deployment: {deployment_id}")
    print(f"Region: {region}\n")
    
    # Initialize DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=region)
    
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Load claims data
    claims_file = os.path.join(script_dir, 'sample-claims.json')
    claims_data = load_json_file(claims_file)
    
    # Load reviewers data
    reviewers_file = os.path.join(script_dir, 'sample-reviewers.json')
    reviewers_data = load_json_file(reviewers_file)
    
    # Load data into tables
    for table_name, items in claims_data.items():
        # Replace the table name with actual deployment ID
        actual_table_name = table_name.replace('-legal', f'-{deployment_id}')
        load_data_to_table(dynamodb, actual_table_name, items)
    
    for table_name, items in reviewers_data.items():
        # Replace the table name with actual deployment ID
        actual_table_name = table_name.replace('-legal', f'-{deployment_id}')
        load_data_to_table(dynamodb, actual_table_name, items)
    
    print("🎉 All sample data loaded successfully!")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
