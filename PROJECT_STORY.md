## Inspiration

Insurance claims processing is broken. Endless forms, weeks of waiting, and manual routing waste everyone's time. We saw an opportunity to combine **Glean's conversational AI** with **Amazon Bedrock AgentCore's autonomous agents** to transform claims from a painful bureaucratic process into an intelligent, seamless experience.

---

## What it does

An **AI-native insurance claims platform** with two intelligent portals:

**Submitter Portal**: Conversational claim filing through Glean chat or web forms. AI extracts structured data from natural language and instantly routes claims to the optimal reviewer.

**Reviewer Dashboard**: AI-powered analysis with confidence scores (e.g., "94% confidence: Approve"), fraud detection indicators, and one-click approval/denial. Smart routing balances workload and expertise across reviewers.

**The AI Agents**:
- **Intake Agent** (Strands SDK + AgentCore): Processes claims, validates policies, intelligently assigns to reviewers
- **Review Agent** (Strands SDK + AgentCore): Analyzes claims using Amazon Nova, generates recommendations with transparent reasoning
- **Glean Conversational Agents**: Natural language interface with enterprise context awareness

---

## How we built it

**Three-layer architecture**:
```
Glean Agents (conversational interface)
  ↓ Custom Glean Actions (5 OpenAPI specs)
AWS Lambda + API Gateway (orchestration)
  ↓ AgentCore Runtime invocations
Strands Agents on Bedrock AgentCore (autonomous decisions)
  ↓ Amazon Nova + DynamoDB
```

**Tech stack**: Glean WebSDK, Amazon Bedrock AgentCore, Strands Agents SDK, Amazon Nova, AWS Lambda (Python 3.12), API Gateway, DynamoDB, CloudFormation

**One-command deployment**: `./deploy.sh` deploys the entire system—7 Lambda functions, 2 AgentCore agents, API Gateway, DynamoDB, sample data, and Glean-ready OpenAPI specs—in under 10 minutes.

---

## Challenges we ran into

**1. Multi-Agent State Synchronization**: Coordinating state between Glean agents, AgentCore runtime, and DynamoDB. Solved with stateless API design and session IDs passed through the entire chain.

**2. Intelligent Reviewer Assignment**: Balancing expertise, workload, and performance in real-time. Built a dynamic scoring algorithm that adjusts weights based on claim urgency and complexity.

**3. Judges Without Glean Access**: Not all hackathon judges have Glean accounts, so we built a **bypass mode for direct AgentCore chat**. However, the AgentCore agents were designed as backend orchestration engines, not customer-facing conversational agents. Their responses are more technical and less polished than Glean's conversational interface, which provides the ideal user experience with enterprise context awareness and beautiful embedded UI.

**4. OpenAPI Spec Generation**: Glean Actions require deployment-specific API Gateway URLs unknown until after deployment. Created `generate-glean-specs.sh` to automatically inject URLs into template specs.

---

## Accomplishments that we're proud of

🏆 **Seamless multi-agent integration** across three frameworks (Glean, Strands SDK, AgentCore)

🎯 **Production-ready deployment** with complete infrastructure-as-code

🤖 **Intelligent automation with human oversight**: AI handles 80% of work, humans make 100% of final decisions

📊 **Real-world applicability**: Complete audit trail, fraud detection, workload balancing, scalable serverless architecture

---

## What we learned

**Agent orchestration requires careful design** of boundaries, communication patterns, and state management. Simple, stateless APIs between agents create the most robust systems.

**Glean + AgentCore is powerful**: Glean brings conversational UI and enterprise knowledge; AgentCore brings autonomous decision-making and scalability. Together, they create experiences neither could achieve alone.

**Confidence scoring changes everything**: Reviewers can prioritize low-confidence cases and fast-track high-confidence ones instead of blindly trusting or ignoring AI.

---

## What's next for Intelligent Insurance Claims Platform

**Document Analysis Agent**: OCR integration for automatic extraction of police reports, medical records, and repair estimates

**Advanced Fraud Detection**: Pattern recognition across historical claims and network analysis to detect organized fraud

**Predictive Analytics**: Claim volume forecasting, reviewer capacity planning, and cost prediction

**Agentic Negotiation**: AI agents that negotiate settlements within parameters with human approval for final agreements

**Continuous Learning**: Feedback loop from reviewer decisions to improve AI recommendations over time
