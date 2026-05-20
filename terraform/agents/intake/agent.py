"""
Legal Service Intake Agent for Bedrock AgentCore
Handles conversational claim intake and submission
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
# Table name will be replaced during deployment with correct DEPLOYMENT_ID
claims_table = dynamodb.Table(os.environ.get('CLAIMS_TABLE', 'LegalService-Claims-legal'))

# Define system prompt
SYSTEM_PROMPT = """You are an AI assistant specialized in insurance claim intake for a legal service management system.

Your role is to:
1. Guide claimants through filing insurance claims conversationally
2. Collect all required information including claimant details, policy information, incident details
3. Ask clarifying questions to ensure complete and accurate information
4. Submit claims when all required information is collected

Required information for claim submission:
- Claimant name (full name)
- Claimant email address
- Policy number
- Claim type (vehicle, property, liability, or health)
- Incident date (YYYY-MM-DD format)
- Incident description (detailed)
- Estimated claim value (in USD)

Optional information:
- Phone number
- Address
- Police report number (if applicable)
- Injuries (yes/no)
- Injury description (if injuries occurred)

Be empathetic, professional, and thorough. Help claimants understand the process and what information is needed.
Always confirm all details before submitting a claim. Once you have all required information, automatically submit the claim and provide the claim ID to the user."""

@tool
def submit_claim(
    claimant_name: str,
    claimant_email: str,
    policy_number: str,
    claim_type: str,
    incident_date: str,
    incident_description: str,
    claim_value: float,
    claimant_phone: str = "",
    claimant_address: str = "",
    police_report: str = "",
    injuries: bool = False,
    injury_description: str = ""
):
    """
    Submit a new insurance claim to the system.

    Args:
        claimant_name: Full name of the claimant
        claimant_email: Email address of the claimant
        policy_number: Insurance policy number
        claim_type: Type of claim (vehicle, property, liability, health)
        incident_date: Date of incident (YYYY-MM-DD)
        incident_description: Detailed description of the incident
        claim_value: Estimated claim value in USD
        claimant_phone: Phone number (optional)
        claimant_address: Address (optional)
        police_report: Police report number (optional)
        injuries: Whether there were injuries (optional)
        injury_description: Description of injuries (optional)

    Returns:
        dict: Success status and claim ID
    """
    try:
        # Validate claim type
        valid_types = ['vehicle', 'property', 'liability', 'health']
        if claim_type.lower() not in valid_types:
            return {
                'success': False,
                'error': f'Invalid claim type. Must be one of: {", ".join(valid_types)}'
            }

        # Generate claim ID
        timestamp = datetime.now(timezone.utc)
        claim_id = f"CL-{timestamp.strftime('%Y-%m%d%H%M%S')}"

        # Prepare claim record
        claim_record = {
            'claimId': claim_id,
            'version': 'v1',
            'claimantInfo': {
                'name': claimant_name,
                'email': claimant_email,
                'phone': claimant_phone,
                'address': claimant_address
            },
            'policyNumber': policy_number,
            'claimType': claim_type.lower(),
            'incidentDate': incident_date,
            'incidentDescription': incident_description,
            'claimValue': Decimal(str(claim_value)),
            'policeReport': police_report if police_report else None,
            'injuries': injuries,
            'injuryDescription': injury_description if injury_description else None,
            'status': 'submitted',
            'submittedDate': timestamp.isoformat(),
            'lastUpdated': timestamp.isoformat()
        }

        # Remove None values
        claim_record = {k: v for k, v in claim_record.items() if v is not None}
        if claim_record['claimantInfo']['phone'] == "":
            del claim_record['claimantInfo']['phone']
        if claim_record['claimantInfo']['address'] == "":
            del claim_record['claimantInfo']['address']

        # Save to DynamoDB
        claims_table.put_item(Item=claim_record)

        return {
            'success': True,
            'claimId': claim_id,
            'message': f'Claim {claim_id} submitted successfully. You will receive updates via email at {claimant_email}.'
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to submit claim: {str(e)}'
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
    tools=[submit_claim]
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
