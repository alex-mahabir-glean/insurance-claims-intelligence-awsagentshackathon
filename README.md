# AI-Powered Legal Service Management System

**AWS AI Agent Global Hackathon 2025 Submission**

An intelligent insurance claim management system that combines Glean's enterprise knowledge capabilities with AWS Bedrock AgentCore's orchestration power.

---

## 🎯 Overview

This system automates insurance claim intake, assignment, and review while keeping humans in control of final decisions. It demonstrates the power of combining:

- **Glean Agents** - User-facing conversational interface
- **Strands Agents SDK** - Agent logic and business rules
- **AWS Bedrock AgentCore Runtime** - Serverless agent hosting
- **AWS Infrastructure** - API Gateway, Lambda, DynamoDB

---

## 🏗️ Architecture

```
Frontend (Glean Agent / HTML)
    ↓
Glean Actions / Direct API
    ↓
API Gateway
    ↓
Lambda Functions
    ↓
Amazon Bedrock AgentCore Runtime
    ├── Intake Agent (Strands)
    └── Review Agent (Strands)
    ↓
DynamoDB + Bedrock Models
```

---

## 🚀 Quick Start - Automated Deployment

### Prerequisites

- **AWS Account** with appropriate permissions
- **AWS CLI** configured
- **Python 3.10+** (Python 3.12 recommended for AgentCore)
- **Glean account** (optional, for conversational interface)

### Step 1: Configure Deployment

Copy the configuration template and customize it:

```bash
cp config.template.env config.env
```

Edit `config.env`:
```bash
AWS_REGION=us-east-1
AWS_PROFILE=your-aws-profile-name
STACK_NAME=legal-service-stack
DEPLOYMENT_ID=legal

# Optional: For Glean embedded agents
GLEAN_INTAKE_AGENT_ID=
GLEAN_REVIEW_AGENT_ID=
```

### Step 2: Authenticate to AWS

If using AWS SSO, login first:

```bash
aws sso login --profile your-aws-profile-name
```

### Step 3: Deploy Everything

Run the automated deployment script:

```bash
./deploy.sh
```

**That's it!** ☕ The script will:
- ✅ Deploy all AWS infrastructure (API Gateway, Lambda, DynamoDB)
- ✅ Load sample data (4 claims, 3 reviewers)
- ✅ Deploy AI agents to Bedrock AgentCore
- ✅ Configure all integrations
- ✅ Update HTML files with your API URLs

**Deployment time:** ~8-10 minutes

**Note**: The script automatically:
- Creates an S3 bucket for CloudFormation templates if needed (template is >51KB)
- Generates `config.js` with your API Gateway URL and Glean agent IDs (gitignored)
- Generates Glean-ready OpenAPI specs in `glean/generated/`

### Step 4: Test the System

After deployment completes:

1. **Start the local web server** (optional but recommended):
   ```bash
   ./serve.sh
   ```
   Then open:
   - http://localhost:8000/submitter.html - File claims
   - http://localhost:8000/reviewer.html - Review and manage claims
   
   Or simply open the HTML files directly in your browser.

2. **Test the API**:
   ```bash
   # Get your API URL from deployment-outputs.json
   API_URL=$(python3 -c "import json; print(json.load(open('deployment-outputs.json'))['apiUrl'])")
   
   # Test getting claims
   curl $API_URL/claims
   ```

### Step 5: Configure Glean (Optional)

The deployment automatically generates Glean-ready OpenAPI specifications in `glean/generated/` with your API Gateway URL already configured!

Follow the detailed instructions in **[GLEAN_SETUP.md](GLEAN_SETUP.md)** to:
- Import Glean Actions
- Create Glean Agents
- Configure authentication

---

## 🔧 Manual Configuration

If you need to manually update your local configuration:

```bash
# Copy the template
cp config.template.js config.js

# Edit config.js with your values from deployment-outputs.json
nano config.js
```

The HTML portals automatically load from `config.js` (which is gitignored).

---

## 📁 Project Structure

```
aws-ai-agent-hackathon/
├── deploy.sh                          # 🚀 Main deployment script
├── generate-glean-specs.sh            # Generate Glean OpenAPI specs
├── config.template.env                # Configuration template
├── GLEAN_SETUP.md                     # Glean integration guide
├── submitter.html                     # Claimant submission portal
├── reviewer.html                      # Case management dashboard
├── backend/
│   ├── agents/
│   │   ├── intake_agent_agentcore.py  # Claim intake agent
│   │   └── review_agent_agentcore.py  # Claim review agent
│   ├── cloudformation/
│   │   └── legal-service-stack.yaml   # Infrastructure as Code
│   ├── lambda/
│   │   ├── submitClaim.py             # Submit claim handler
│   │   ├── getClaims.py               # Get claims handler
│   │   ├── approveClaim.py            # Approve claim handler
│   │   ├── denyClaim.py               # Deny claim handler
│   │   ├── reassignClaim.py           # Reassign claim handler
│   │   ├── invoke_intake_agent.py     # Intake agent proxy
│   │   └── invoke_review_agent.py     # Review agent proxy
│   ├── data/
│   │   ├── load_sample_data.py        # Data loading script
│   │   ├── sample-claims.json         # Sample claims
│   │   └── sample-reviewers.json      # Sample reviewers
│   └── openapi/
│       └── legal-service-api.yaml     # Complete API specification
├── glean/
│   ├── openapi-*.json                 # Glean Action specifications
│   └── GLEAN_AGENT_CONFIGURATION.md   # Agent configuration details
└── deployment/
    └── agentcore-deploy/              # AgentCore deployment artifacts
```

---

## 💡 Key Features

### 🤖 Intelligent Automation
- **Conversational claim filing** - Natural language interaction via Glean or web interface
- **AI-powered analysis** - Automatic claim review with confidence scoring
- **Smart assignment** - Workload-balanced reviewer assignment
- **Fraud detection** - AI identifies potential fraud indicators

### 🏢 Enterprise-Grade
- **Serverless architecture** - Scalable and cost-effective
- **Complete audit trail** - Full compliance tracking in DynamoDB
- **Session isolation** - Secure multi-user support via AgentCore
- **Observability** - CloudWatch metrics and traces

### 🎯 Human-in-Loop Design
- AI provides recommendations, humans make final decisions
- Confidence scores guide reviewer attention
- Transparent reasoning for all AI recommendations

---

## 📊 Sample Data

The system includes pre-loaded sample data:

**Claims:**
- CL-2025-0001: Vehicle accident (hit-and-run) - AI: Approve (94%)
- CL-2025-0045: Property damage (flooding) - AI: Deny (87%)
- CL-2025-0067: Vehicle hail damage - AI: Approve (91%)
- CL-2025-1015012634: Additional test claim

**Reviewers:**
- Sarah Chen (3 active claims, 247 total reviewed, 96.8% accuracy)
- Mike Torres (5 active claims, 189 total reviewed, 94.5% accuracy)
- Lisa Park (7 active claims, 312 total reviewed, 97.2% accuracy)

---

## 🔧 Advanced Usage

### Updating Agents

After modifying agent code in `backend/agents/`:

```bash
cd deployment
source agentcore-venv/bin/activate
cd agentcore-deploy/intake-agent
agentcore launch  # Redeploy intake agent

cd ../review-agent
agentcore launch  # Redeploy review agent
```

### Viewing Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/LegalService-SubmitClaim-legal --follow

# View AgentCore logs
aws logs tail /aws/bedrock/agentcore/legal_intake_agent_legal --follow
```

### Cleanup

To remove all deployed resources:

```bash
./cleanup.sh
```

This will:
- Delete both AgentCore agents
- Delete the CloudFormation stack
- Remove all AWS resources (DynamoDB, Lambda, API Gateway, etc.)

---

## 📈 Monitoring & Observability

### CloudWatch Dashboards

View metrics in AWS Console:
- **AgentCore Runtime**: Agent invocations, latency, errors
- **Lambda Functions**: Execution duration, error rates
- **API Gateway**: Request count, 4xx/5xx errors
- **DynamoDB**: Read/write capacity, throttling

### Audit Trail

All actions are logged:
```bash
aws dynamodb scan \
  --table-name LegalService-AuditTrail-legal \
  --region us-east-1
```

### AgentCore Observability

Access the AgentCore observability dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#gen-ai-observability/agent-core
```

---

## 🏆 Hackathon Compliance

### ✅ Requirements Met

1. **LLM from AWS Bedrock** ✅ - Uses Claude 3.5 Sonnet via Bedrock
2. **AWS Services** ✅ - Bedrock AgentCore, Lambda, API Gateway, DynamoDB
3. **AgentCore Primitive** ✅ - Strands Agents SDK with AgentCore Runtime
4. **Reasoning LLMs** ✅ - Claude for decision-making
5. **Autonomous Capabilities** ✅ - Auto-assignment, AI recommendations
6. **External Integrations** ✅ - DynamoDB, Glean API

### 🎯 Key Differentiators

1. **Integration Excellence** - Seamless Glean + AgentCore integration
2. **Real-World Applicability** - Solves actual enterprise problem
3. **Clean Architecture** - Simple, reproducible, well-documented
4. **Intelligent Automation** - Smart reviewer assignment algorithm
5. **Human-in-Loop Design** - AI assists, humans decide
6. **Complete Observability** - Full audit trail and monitoring

---

## 🛠️ Technologies Used

- **Amazon Bedrock AgentCore Runtime** - Serverless agent hosting
- **Strands Agents SDK** - Agent framework
- **Amazon Bedrock** - Claude 3.5 Sonnet LLM
- **AWS Lambda** - Serverless compute (Python 3.12)
- **Amazon API Gateway** - REST API
- **Amazon DynamoDB** - NoSQL database
- **AWS CloudFormation** - Infrastructure as Code
- **Glean API** - Enterprise search and actions (optional)

---

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

This project is created for the AWS AI Agent Global Hackathon 2025.

---

## 👥 Team

Built by Eugene for Glean DemoHub

---

## 🙏 Acknowledgments

- AWS Bedrock team for AgentCore
- Strands Agents SDK contributors
- Glean for enterprise knowledge capabilities

---

## 📞 Support

For issues or questions:
1. Check [GLEAN_SETUP.md](GLEAN_SETUP.md) for Glean integration help
2. Review CloudWatch logs for errors
3. Check `deployment-outputs.json` for deployment details

---

**Status**: Production Ready ✅

*Last Updated: October 15, 2025*
