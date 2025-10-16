// Sample Claims Data for Legal Service Management Demo
// This data will be used to seed DynamoDB and for local testing

const sampleClaims = [
  {
    claimId: "CL-2025-0001",
    version: "v1",
    claimantInfo: {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+1-555-0123",
      address: "123 Main St, Springfield, IL 62701"
    },
    policyNumber: "PL-123456",
    claimType: "vehicle",
    incidentDate: "2025-10-13",
    incidentDescription: "Rear-ended at stoplight by another vehicle. The other driver fled the scene immediately after impact. Police were called and a report was filed. Vehicle sustained significant rear-end damage.",
    claimValue: 8500,
    policeReport: "SPD-2025-1013",
    injuries: true,
    injuryDescription: "Mild whiplash, treated at emergency room",
    status: "assigned",
    assignedTo: "sarah-chen",
    assignedDate: "2025-10-14T14:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Valid claim with comprehensive documentation. Police report SPD-2025-1013 confirms hit-and-run incident. Medical diagnosis of whiplash is consistent with rear-end collision mechanism. Policy includes comprehensive coverage with $500 deductible. No fraud indicators detected. Similar cases in knowledge base show 92% approval rate for hit-and-run claims with police reports.",
    aiConfidence: 0.94,
    documents: [
      {
        documentId: "DOC-001",
        type: "police_report",
        gleanUrl: "https://drive.google.com/file/d/sample-police-report-001",
        uploadedDate: "2025-10-14T13:55:00Z"
      },
      {
        documentId: "DOC-002",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-001",
        uploadedDate: "2025-10-14T13:56:00Z"
      },
      {
        documentId: "DOC-003",
        type: "medical_records",
        gleanUrl: "https://drive.google.com/file/d/sample-medical-001",
        uploadedDate: "2025-10-14T13:57:00Z"
      }
    ],
    submittedDate: "2025-10-14T13:54:00Z",
    lastUpdated: "2025-10-14T14:00:00Z"
  },
  {
    claimId: "CL-2025-0045",
    version: "v1",
    claimantInfo: {
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "+1-555-0456",
      address: "456 Oak Ave, Springfield, IL 62702"
    },
    policyNumber: "PL-789012",
    claimType: "property",
    incidentDate: "2025-10-10",
    incidentDescription: "Basement flooding from heavy rainfall. Water damage to finished basement including carpet, drywall, and personal belongings. Approximately 3 inches of standing water.",
    claimValue: 12300,
    policeReport: null,
    injuries: false,
    injuryDescription: null,
    status: "under_review",
    assignedTo: "sarah-chen",
    assignedDate: "2025-10-11T10:00:00Z",
    aiRecommendation: "deny",
    aiRecommendationReason: "Policy does not cover flood damage from natural rainfall. Standard homeowners policy excludes flooding unless separate flood insurance is purchased. Claimant's policy (PL-789012) does not include flood coverage rider. Similar weather-related water damage claims without flood coverage have 95% denial rate per company guidelines.",
    aiConfidence: 0.87,
    documents: [
      {
        documentId: "DOC-045",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-045",
        uploadedDate: "2025-10-11T09:30:00Z"
      }
    ],
    submittedDate: "2025-10-11T09:23:00Z",
    lastUpdated: "2025-10-11T10:00:00Z"
  },
  {
    claimId: "CL-2025-0067",
    version: "v1",
    claimantInfo: {
      name: "Mike Johnson",
      email: "mike.j@example.com",
      phone: "+1-555-0789",
      address: "789 Elm St, Springfield, IL 62703"
    },
    policyNumber: "PL-345678",
    claimType: "vehicle",
    incidentDate: "2025-10-12",
    incidentDescription: "Severe hailstorm caused extensive damage to vehicle. Multiple dents on hood, roof, and trunk. Windshield cracked. Vehicle was parked in driveway during storm.",
    claimValue: 4200,
    policeReport: null,
    injuries: false,
    injuryDescription: null,
    status: "under_review",
    assignedTo: "sarah-chen",
    assignedDate: "2025-10-12T17:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Comprehensive coverage includes hail damage. Weather service confirms severe hailstorm in Springfield area on October 12, 2025 with hail size up to 2 inches. Damage assessment photos consistent with hail impact patterns. Policy is active with no lapse in coverage. Deductible of $500 applies. Repair estimate of $4,200 is reasonable for described damage.",
    aiConfidence: 0.91,
    documents: [
      {
        documentId: "DOC-067",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-067",
        uploadedDate: "2025-10-12T16:50:00Z"
      },
      {
        documentId: "DOC-068",
        type: "repair_estimate",
        gleanUrl: "https://drive.google.com/file/d/sample-estimate-067",
        uploadedDate: "2025-10-12T16:51:00Z"
      }
    ],
    submittedDate: "2025-10-12T16:45:00Z",
    lastUpdated: "2025-10-12T17:00:00Z"
  },
  {
    claimId: "CL-2025-0023",
    version: "v1",
    claimantInfo: {
      name: "Robert Williams",
      email: "r.williams@example.com",
      phone: "+1-555-0234",
      address: "234 Pine St, Springfield, IL 62704"
    },
    policyNumber: "PL-456789",
    claimType: "property",
    incidentDate: "2025-10-08",
    incidentDescription: "Kitchen fire caused by faulty electrical wiring. Fire department responded and contained the blaze. Damage to kitchen cabinets, appliances, and ceiling.",
    claimValue: 18500,
    policeReport: "SFD-2025-1008",
    injuries: false,
    injuryDescription: null,
    status: "assigned",
    assignedTo: "mike-torres",
    assignedDate: "2025-10-09T09:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Fire damage covered under homeowners policy. Fire department report confirms electrical origin. No evidence of negligence or intentional damage. Policy includes dwelling coverage up to $250,000. Repair estimate reasonable for extent of damage.",
    aiConfidence: 0.89,
    documents: [
      {
        documentId: "DOC-023",
        type: "fire_report",
        gleanUrl: "https://drive.google.com/file/d/sample-fire-report-023",
        uploadedDate: "2025-10-09T08:30:00Z"
      },
      {
        documentId: "DOC-024",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-023",
        uploadedDate: "2025-10-09T08:31:00Z"
      }
    ],
    submittedDate: "2025-10-09T08:25:00Z",
    lastUpdated: "2025-10-09T09:00:00Z"
  },
  {
    claimId: "CL-2025-0034",
    version: "v1",
    claimantInfo: {
      name: "Emily Davis",
      email: "emily.d@example.com",
      phone: "+1-555-0345",
      address: "345 Maple Dr, Springfield, IL 62705"
    },
    policyNumber: "PL-567890",
    claimType: "liability",
    incidentDate: "2025-10-07",
    incidentDescription: "Guest slipped on icy walkway and sustained injuries. Walkway had not been salted or cleared of ice. Guest required medical treatment for fractured wrist.",
    claimValue: 15200,
    policeReport: null,
    injuries: true,
    injuryDescription: "Fractured left wrist requiring surgery",
    status: "under_review",
    assignedTo: "mike-torres",
    assignedDate: "2025-10-08T11:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Liability claim appears valid. Medical records confirm wrist fracture. Weather records show freezing conditions on incident date. Property owner has duty to maintain safe premises. Policy includes $300,000 liability coverage. Medical expenses and treatment costs are reasonable.",
    aiConfidence: 0.78,
    documents: [
      {
        documentId: "DOC-034",
        type: "medical_records",
        gleanUrl: "https://drive.google.com/file/d/sample-medical-034",
        uploadedDate: "2025-10-08T10:45:00Z"
      }
    ],
    submittedDate: "2025-10-08T10:40:00Z",
    lastUpdated: "2025-10-08T11:00:00Z"
  },
  {
    claimId: "CL-2025-0012",
    version: "v1",
    claimantInfo: {
      name: "David Martinez",
      email: "d.martinez@example.com",
      phone: "+1-555-0678",
      address: "678 Cedar Ln, Springfield, IL 62706"
    },
    policyNumber: "PL-234567",
    claimType: "vehicle",
    incidentDate: "2025-10-11",
    incidentDescription: "Vehicle struck by falling tree during windstorm. Tree fell across vehicle while parked on street. Significant damage to roof and windshield.",
    claimValue: 9800,
    policeReport: null,
    injuries: false,
    injuryDescription: null,
    status: "assigned",
    assignedTo: "lisa-park",
    assignedDate: "2025-10-12T08:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Comprehensive coverage includes falling object damage. Weather service confirms high winds on October 11. Photos show tree damage consistent with storm conditions. No evidence of pre-existing damage or fraud. Repair estimate aligns with market rates.",
    aiConfidence: 0.93,
    documents: [
      {
        documentId: "DOC-012",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-012",
        uploadedDate: "2025-10-12T07:45:00Z"
      }
    ],
    submittedDate: "2025-10-12T07:40:00Z",
    lastUpdated: "2025-10-12T08:00:00Z"
  },
  {
    claimId: "CL-2025-0029",
    version: "v1",
    claimantInfo: {
      name: "Sarah Thompson",
      email: "s.thompson@example.com",
      phone: "+1-555-0890",
      address: "890 Birch Ave, Springfield, IL 62707"
    },
    policyNumber: "PL-678901",
    claimType: "vehicle",
    incidentDate: "2025-10-09",
    incidentDescription: "Hit-and-run in parking lot. Vehicle sideswiped while parked at shopping center. Security camera footage available showing incident.",
    claimValue: 3200,
    policeReport: "SPD-2025-1009",
    injuries: false,
    injuryDescription: null,
    status: "under_review",
    assignedTo: "lisa-park",
    assignedDate: "2025-10-10T13:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Valid hit-and-run claim with police report and security footage. Comprehensive coverage includes uninsured motorist damage. Damage assessment consistent with sideswiping incident. Policy active with no coverage gaps.",
    aiConfidence: 0.96,
    documents: [
      {
        documentId: "DOC-029",
        type: "police_report",
        gleanUrl: "https://drive.google.com/file/d/sample-police-report-029",
        uploadedDate: "2025-10-10T12:45:00Z"
      },
      {
        documentId: "DOC-030",
        type: "video",
        gleanUrl: "https://drive.google.com/file/d/sample-video-029",
        uploadedDate: "2025-10-10T12:46:00Z"
      }
    ],
    submittedDate: "2025-10-10T12:40:00Z",
    lastUpdated: "2025-10-10T13:00:00Z"
  },
  {
    claimId: "CL-2025-0041",
    version: "v1",
    claimantInfo: {
      name: "James Anderson",
      email: "j.anderson@example.com",
      phone: "+1-555-0123",
      address: "123 Willow Rd, Springfield, IL 62708"
    },
    policyNumber: "PL-789012",
    claimType: "liability",
    incidentDate: "2025-10-06",
    incidentDescription: "Dog bite incident involving neighbor's child. Child required stitches and rabies prophylaxis treatment. Incident occurred on property owner's premises.",
    claimValue: 8900,
    policeReport: "SPD-2025-1006",
    injuries: true,
    injuryDescription: "Bite wound requiring 12 stitches on left arm",
    status: "under_review",
    assignedTo: "lisa-park",
    assignedDate: "2025-10-07T14:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Liability coverage includes dog bite incidents. Medical records confirm treatment and expenses. Police report filed. Dog vaccination records current. Policy limit of $300,000 covers claim amount. Similar cases show 85% approval rate.",
    aiConfidence: 0.82,
    documents: [
      {
        documentId: "DOC-041",
        type: "police_report",
        gleanUrl: "https://drive.google.com/file/d/sample-police-report-041",
        uploadedDate: "2025-10-07T13:45:00Z"
      },
      {
        documentId: "DOC-042",
        type: "medical_records",
        gleanUrl: "https://drive.google.com/file/d/sample-medical-041",
        uploadedDate: "2025-10-07T13:46:00Z"
      }
    ],
    submittedDate: "2025-10-07T13:40:00Z",
    lastUpdated: "2025-10-07T14:00:00Z"
  },
  {
    claimId: "CL-2025-0053",
    version: "v1",
    claimantInfo: {
      name: "Patricia Brown",
      email: "p.brown@example.com",
      phone: "+1-555-0456",
      address: "456 Spruce St, Springfield, IL 62709"
    },
    policyNumber: "PL-890123",
    claimType: "vehicle",
    incidentDate: "2025-10-05",
    incidentDescription: "Multi-vehicle accident on highway. Three cars involved. Claimant's vehicle rear-ended by distracted driver, pushing into vehicle ahead. Moderate damage to front and rear.",
    claimValue: 11200,
    policeReport: "ISP-2025-1005",
    injuries: true,
    injuryDescription: "Minor neck strain, treated and released",
    status: "assigned",
    assignedTo: "lisa-park",
    assignedDate: "2025-10-06T10:00:00Z",
    aiRecommendation: "approve",
    aiRecommendationReason: "Clear liability established in police report. Claimant not at fault. Collision coverage applies. Medical treatment reasonable for described injuries. Repair estimate verified by approved body shop. All documentation complete.",
    aiConfidence: 0.94,
    documents: [
      {
        documentId: "DOC-053",
        type: "police_report",
        gleanUrl: "https://drive.google.com/file/d/sample-police-report-053",
        uploadedDate: "2025-10-06T09:45:00Z"
      },
      {
        documentId: "DOC-054",
        type: "photos",
        gleanUrl: "https://drive.google.com/file/d/sample-photos-053",
        uploadedDate: "2025-10-06T09:46:00Z"
      }
    ],
    submittedDate: "2025-10-06T09:40:00Z",
    lastUpdated: "2025-10-06T10:00:00Z"
  }
];

const sampleReviewers = [
  {
    reviewerId: "sarah-chen",
    name: "Sarah Chen",
    email: "sarah.chen@legalservices.com",
    currentWorkload: 3,
    maxCapacity: 10,
    activeClaims: ["CL-2025-0001", "CL-2025-0045", "CL-2025-0067"],
    expertise: ["vehicle", "property"],
    totalClaimsReviewed: 247,
    approvalRate: 0.873,
    avgReviewTime: 2.3,
    accuracy: 0.968,
    joinedDate: "2023-01-15",
    lastActive: "2025-10-14T15:30:00Z"
  },
  {
    reviewerId: "mike-torres",
    name: "Mike Torres",
    email: "mike.torres@legalservices.com",
    currentWorkload: 5,
    maxCapacity: 10,
    activeClaims: ["CL-2025-0023", "CL-2025-0034", "CL-2025-0056", "CL-2025-0078", "CL-2025-0089"],
    expertise: ["property", "liability"],
    totalClaimsReviewed: 189,
    approvalRate: 0.812,
    avgReviewTime: 3.1,
    accuracy: 0.945,
    joinedDate: "2023-06-20",
    lastActive: "2025-10-14T14:15:00Z"
  },
  {
    reviewerId: "lisa-park",
    name: "Lisa Park",
    email: "lisa.park@legalservices.com",
    currentWorkload: 7,
    maxCapacity: 10,
    activeClaims: ["CL-2025-0012", "CL-2025-0029", "CL-2025-0041", "CL-2025-0053", "CL-2025-0064", "CL-2025-0075", "CL-2025-0086"],
    expertise: ["vehicle", "liability"],
    totalClaimsReviewed: 312,
    approvalRate: 0.891,
    avgReviewTime: 1.9,
    accuracy: 0.972,
    joinedDate: "2022-09-10",
    lastActive: "2025-10-14T15:45:00Z"
  }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sampleClaims, sampleReviewers };
}
