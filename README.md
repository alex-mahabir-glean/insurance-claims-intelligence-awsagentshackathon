# AI-Powered Insurance Claims Intelligence

An accelerator for an intelligent insurance claim management system that combines [Glean](https://www.glean.com/)'s enterprise knowledge capabilities with Amazon Bedrock AgentCore's orchestration power. Built for the [AWS AI Agent Global Hackathon 2025](https://aws.amazon.com/ai/generative-ai/agents/).

> 🛠️ **Solution Library accelerator** — fork it, deploy it in your own AWS account, customize it for your business.

## 📑 Table of contents

- [What you'll deploy](#-what-youll-deploy)
- [Architecture](#️-architecture)
- [Quick start (Terraform)](#-quick-start-terraform)
- [Project layout](#-project-layout)
- [Customizing](#-customizing)
- [Observability](#-observability)
- [Glean integration](#-glean-integration)
- [Hackathon compliance](#-hackathon-compliance)
- [License & team](#-license--team)

---

## 🎨 What you'll deploy

Two intelligent web portals with embedded AI agents, powered by a Terraform-managed AWS backend that intelligently triages incoming claims, transparently routes them to the optimal reviewer (balancing expertise and workload), provides AI-powered recommendations with confidence scoring, and maintains a complete audit trail across the entire claim lifecycle.

| | |
|---|---|
| **Submitter portal** — conversational claim filing | **Reviewer dashboard** — AI-assisted claim review |
| <img src="assets/js/images/submitter-portal-initial-screenshot.png" width="100%"> | <img src="assets/js/images/reviewer-portal-initial-screenshot.png" width="100%"> |

## 🏗️ Architecture

![Architecture](assets/js/images/architecture-diagram.png)

```
Frontend (HTML + JS, served locally or via CloudFront — see TF-9 #41)
    ↓
Glean Conversational Agents (optional) → Glean Actions
    ↓
Amazon API Gateway (HTTP API v2) — TF-4
    ↓
Lambda authorizer (TF-3) → 3 application Lambdas (TF-3 — Option B topology)
    ├── api_handler   (CRUD: submit / list / approve / deny / reassign)
    └── agent_invoker (Bedrock AgentCore invocation)
    ↓
Bedrock AgentCore Runtime (TF-5)        DynamoDB (TF-2)
    ├── Intake agent (Strands SDK)       ├── Claims (+ GSIs, PITR, KMS)
    └── Review agent (Strands SDK)       ├── Reviewers
    ↓                                    └── AuditTrail (PITR, optional TTL)
Amazon Bedrock — Amazon Nova Pro
```

Cross-cutting: per-Lambda + API + DDB alarms, dashboard, and Bedrock spend budget via the **observability** module (TF-6); GitHub Actions CI/CD via OIDC (TF-7).

## 🚀 Quick start (Terraform)

> Full walkthrough lives in [`docs/customer-deployment.md`](docs/customer-deployment.md).

**Prereqs:** `terraform >= 1.6`, `aws` CLI v2, `python` 3.12, `pip install bedrock-agentcore-starter-toolkit`.

```bash
git clone https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon.git
cd insurance-claims-intelligence-awsagentshackathon

# 1. One-time backend bootstrap (creates S3 + DynamoDB lock table)
make bootstrap-backend

# 2. Per-env config
cp terraform/env/dev.tfbackend.example terraform/env/dev.tfbackend   # paste the bucket name from step 1
cp terraform/terraform.tfvars.example terraform/terraform.tfvars

# 3. Deploy
make init ENV=dev
make plan
make apply        # first apply ~10-15 min (CodeBuild builds 2 agent images)

# 4. Reseed sample data + verify
make load-sample-data
make verify
```

Expected output of `make verify`:
```
ok  GET /claims (no auth) → 401  (SEC-3 enforced)
ok  GET /claims (authed)  → 200  (4 claims returned)
ok  DynamoDB LegalService-Claims-legal
ok  DynamoDB LegalService-Reviewers-legal
ok  DynamoDB LegalService-AuditTrail-legal
All checks passed.
```

## 📁 Project layout

```
terraform/                         All Infrastructure-as-Code lives here
├── main.tf, variables.tf, outputs.tf, versions.tf
├── env/                           Per-environment backend configs
├── bootstrap/
│   ├── state-backend/             One-shot S3 + DynamoDB lock table
│   └── github-oidc/               One-shot OIDC role for GitHub Actions
├── modules/                       Reusable building blocks
│   ├── data/                      DynamoDB + KMS + Secrets + PITR
│   ├── lambda_function/           Lambda + log group + DLQ + alarms
│   ├── api/                       HTTP API v2 + authorizer + CORS + WAF
│   ├── agents/                    AgentCore Runtime via null_resource + scoped IAM
│   └── observability/             Alarms + SNS + dashboard + budget
├── lambdas/                       Lambda handler source (3 dirs — Option B topology)
│   ├── api_handler/               CRUD endpoints (Powertools APIGatewayHttpResolver + Pydantic)
│   ├── agent_invoker/             Bedrock invocation
│   └── authorizer/                HTTP API v2 simple authorizer
├── agents/                        AgentCore agent source (intake, review)
└── scripts/                       Helpers (load_sample_data, verify_deployment, generate_glean_specs)

archive/                           Legacy CloudFormation + bash glue (reference only)
docs/
└── customer-deployment.md         Full step-by-step walkthrough
.github/workflows/                 PR check + dev apply + manual prod apply
glean/                             Glean Action OpenAPI specs (input + generated/)
assets/, *.html                    Frontend
```

## 🔧 Customizing

This is an accelerator. Fork the repo, change what you need:

- **Tags:** `local.common_tags` in `terraform/main.tf` (single source of truth).
- **Region:** `aws_region` in `terraform.tfvars`. Match your `.tfbackend`.
- **Agents:** `terraform/agents/{intake,review}/agent.py`. `make plan` detects file-hash changes and queues a redeploy.
- **Lambda code:** `terraform/lambdas/<name>/index.py`. Re-run `make apply`.
- **CORS allowlist:** `var.allowed_origins` (add your hosting domain).
- **WAF:** `var.enable_waf = true` to attach the AWS Common + KnownBadInputs rule sets.
- **Bedrock budget:** `var.monthly_bedrock_budget_usd`. Default $50/month, 0 disables.

## 🔭 Observability

After `make apply`, open the CloudWatch dashboard:

```bash
terraform -chdir=terraform output -raw dashboard_url
```

Per-Lambda alarms (errors, throttles, p99 duration), per-DDB-table alarms (UserErrors, ThrottledRequests), API stage alarms (4xx, 5xx, p99 IntegrationLatency), Bedrock spend budget — all wired to a single SNS topic. Subscribe `var.alert_email` for email or attach Slack via AWS Chatbot post-apply.

## 🤝 Glean integration

Generate Glean-ready OpenAPI Action specs after deploy:

```bash
make glean-specs   # writes to glean/generated/
```

Follow [`GLEAN_SETUP.md`](GLEAN_SETUP.md) to import them and create the conversational agents.

## 🏆 Hackathon compliance

- ✅ Amazon Bedrock as the LLM (Nova Pro)
- ✅ AWS services (Bedrock AgentCore, Lambda, API Gateway, DynamoDB, KMS, Secrets Manager, CloudWatch, SQS, SNS, IAM)
- ✅ AgentCore Runtime as the primitive
- ✅ Reasoning LLMs for claim analysis
- ✅ Autonomous capabilities (smart-assignment, recommendations)
- ✅ External integrations (Glean Actions, Bedrock)
- ✅ **Customer-deployable IaC** — Terraform modules customers can fork

## 📝 License & team

MIT — see [LICENSE](LICENSE).

Built with <3 by [Glean](https://www.glean.com/) with help from [Kiro](https://kiro.dev/) and a Well-Architected review by Claude.

---

## ⚠️ Security note

The default authentication is a shared bearer token. **Before exposing this publicly**, swap to Cognito JWT (tracked under [SEC-2 #2](https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon/issues/2)) and turn on WAF (`var.enable_waf = true`). The HTML portals at the repo root are intended for local development; production hosting (CloudFront + Cognito + Lambda@Edge) is documented in [AWS_HOSTING.md](AWS_HOSTING.md) and tracked for Terraform-ization under [TF-9 #41](https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon/issues/41).
