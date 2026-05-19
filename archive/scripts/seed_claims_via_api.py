#!/usr/bin/env python3
"""
Seed claims via API Gateway
"""
import requests
import json

# Get API URL from deployment outputs
API_BASE = "https://YOUR_API_GATEWAY_URL"  # Replace with your API Gateway URL from deployment-outputs.json

claims_to_seed = [
    {
        "claimantName": "Robert Williams",
        "claimantEmail": "r.williams@example.com",
        "claimantPhone": "+1-555-0234",
        "claimantAddress": "234 Pine St, Springfield, IL 62704",
        "policyNumber": "PL-456789",
        "claimType": "property",
        "incidentDate": "2025-10-08",
        "incidentDescription": "Kitchen fire caused by faulty electrical wiring. Fire department responded and contained the blaze. Damage to kitchen cabinets, appliances, and ceiling.",
        "claimValue": 18500,
        "policeReport": "SFD-2025-1008",
        "injuries": False,
        "assignedTo": "mike-torres",
        "status": "assigned"
    },
    {
        "claimantName": "Emily Davis",
        "claimantEmail": "emily.d@example.com",
        "claimantPhone": "+1-555-0345",
        "claimantAddress": "345 Maple Dr, Springfield, IL 62705",
        "policyNumber": "PL-567890",
        "claimType": "liability",
        "incidentDate": "2025-10-07",
        "incidentDescription": "Guest slipped on icy walkway and sustained injuries. Walkway had not been salted or cleared of ice. Guest required medical treatment for fractured wrist.",
        "claimValue": 15200,
        "injuries": True,
        "injuryDescription": "Fractured left wrist requiring surgery",
        "assignedTo": "mike-torres",
        "status": "under_review"
    },
    {
        "claimantName": "David Martinez",
        "claimantEmail": "d.martinez@example.com",
        "claimantPhone": "+1-555-0678",
        "claimantAddress": "678 Cedar Ln, Springfield, IL 62706",
        "policyNumber": "PL-234567",
        "claimType": "vehicle",
        "incidentDate": "2025-10-11",
        "incidentDescription": "Vehicle struck by falling tree during windstorm. Tree fell across vehicle while parked on street. Significant damage to roof and windshield.",
        "claimValue": 9800,
        "injuries": False,
        "assignedTo": "lisa-park",
        "status": "assigned"
    },
    {
        "claimantName": "Sarah Thompson",
        "claimantEmail": "s.thompson@example.com",
        "claimantPhone": "+1-555-0890",
        "claimantAddress": "890 Birch Ave, Springfield, IL 62707",
        "policyNumber": "PL-678901",
        "claimType": "vehicle",
        "incidentDate": "2025-10-09",
        "incidentDescription": "Hit-and-run in parking lot. Vehicle sideswiped while parked at shopping center. Security camera footage available showing incident.",
        "claimValue": 3200,
        "policeReport": "SPD-2025-1009",
        "injuries": False,
        "assignedTo": "lisa-park",
        "status": "under_review"
    },
    {
        "claimantName": "James Anderson",
        "claimantEmail": "j.anderson@example.com",
        "claimantPhone": "+1-555-0123",
        "claimantAddress": "123 Willow Rd, Springfield, IL 62708",
        "policyNumber": "PL-789012",
        "claimType": "liability",
        "incidentDate": "2025-10-06",
        "incidentDescription": "Dog bite incident involving neighbor's child. Child required stitches and rabies prophylaxis treatment. Incident occurred on property owner's premises.",
        "claimValue": 8900,
        "policeReport": "SPD-2025-1006",
        "injuries": True,
        "injuryDescription": "Bite wound requiring 12 stitches on left arm",
        "assignedTo": "lisa-park",
        "status": "under_review"
    },
    {
        "claimantName": "Patricia Brown",
        "claimantEmail": "p.brown@example.com",
        "claimantPhone": "+1-555-0456",
        "claimantAddress": "456 Spruce St, Springfield, IL 62709",
        "policyNumber": "PL-890123",
        "claimType": "vehicle",
        "incidentDate": "2025-10-05",
        "incidentDescription": "Multi-vehicle accident on highway. Three cars involved. Claimant's vehicle rear-ended by distracted driver, pushing into vehicle ahead. Moderate damage to front and rear.",
        "claimValue": 11200,
        "policeReport": "ISP-2025-1005",
        "injuries": True,
        "injuryDescription": "Minor neck strain, treated and released",
        "assignedTo": "lisa-park",
        "status": "assigned"
    }
]

def submit_claim(claim_data):
    """Submit a claim via API"""
    url = f"{API_BASE}/submit-claim"
    response = requests.post(url, json=claim_data)
    return response.json()

def main():
    print(f"Seeding {len(claims_to_seed)} claims via API...")

    for i, claim in enumerate(claims_to_seed, 1):
        print(f"\n[{i}/{len(claims_to_seed)}] Submitting claim for {claim['claimantName']}...")
        try:
            result = submit_claim(claim)
            if result.get('success'):
                print(f"  ✓ Created: {result['claimId']} -> assigned to {result.get('assignedTo', 'pending')}")
            else:
                print(f"  ✗ Failed: {result}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    print(f"\n✓ Seeding complete!")

if __name__ == "__main__":
    main()
