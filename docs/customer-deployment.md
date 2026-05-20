# Customer deployment walkthrough

Step-by-step for deploying this accelerator into your own AWS account.

## Prerequisites

- AWS account with permissions to create IAM roles, S3 buckets, DynamoDB tables, Lambda functions, API Gateway, KMS, Secrets Manager, Bedrock AgentCore Runtimes
- Tools on your machine:
  - `terraform >= 1.6` ([install](https://developer.hashicorp.com/terraform/install))
  - `aws` CLI v2 ([install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
  - `python` 3.12 (`pyenv install 3.12.x`)
  - `bedrock-agentcore-starter-toolkit`: `pip install bedrock-agentcore-starter-toolkit`
  - `make` (or use your shell — every target is just a `terraform` command)

## 1. Clone & configure

```bash
git clone https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon.git
cd insurance-claims-intelligence-awsagentshackathon

cp terraform/env/dev.tfbackend.example terraform/env/dev.tfbackend
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit both files. The `.tfbackend` file needs the S3 bucket name from step 2; come back to it.

## 2. Bootstrap state backend (one-time per account/region)

The S3 bucket that holds Terraform state can't create itself, so we run a separate one-shot module first:

```bash
make bootstrap-backend
```

Note the `bucket_name` output and paste it into `terraform/env/dev.tfbackend`.

## 3. Initialize & plan

```bash
make init ENV=dev
make plan
```

The first plan shows ~60-80 resources to create.

## 4. Apply

```bash
make apply
```

**Takes ~10-15 minutes.** The bulk of the time is the agentcore CLI building two container images (one per agent) via CodeBuild and pushing to ECR. Subsequent applies are sub-minute.

## 5. Load sample data

```bash
make load-sample-data
```

Inserts 4 sample claims and 3 reviewers so the demo has something to look at.

## 6. Verify

```bash
make verify
```

Should report:
- `GET /claims` without auth returns 401/403 ✓
- `GET /claims` with bearer returns 200 ✓
- All 3 DynamoDB tables exist ✓

## 7. Generate Glean specs (optional)

If you're wiring this into a Glean workspace:

```bash
make glean-specs
```

Outputs go to `glean/generated/`. Follow `GLEAN_SETUP.md` to import them.

## 8. Frontend (optional)

The HTML portals at the repo root (`submitter.html`, `reviewer.html`) are the demo UI. They expect a `config.js` with the API URL + auth token. Until TF-9 (#41) lands, generate it manually with the API URL from `terraform output api_invoke_url` and the bearer from the `agentcore_api_token` secret.

## Multi-environment

To stand up a `staging` or `prod` workspace:

```bash
cp terraform/env/prod.tfbackend.example terraform/env/prod.tfbackend
# (edit with the same bucket but a different state key)
make init ENV=prod
make plan
make apply
```

Each environment has its own state file under the same backend bucket.

## Tear down

```bash
make destroy
```

AgentCore Runtimes are deleted via the destroy provisioner; KMS keys enter a 7-day pending-deletion window.

## Customizing for your org

This is an accelerator — fork it, change what you need.

- **Tags:** edit `local.common_tags` in `terraform/main.tf` to match your tagging policy.
- **IAM:** the `github-oidc` bootstrap attaches `AdministratorAccess`. Tighten this for production.
- **Region:** set `aws_region` in `terraform.tfvars`. Update `env/<env>.tfbackend` to match.
- **Agents:** edit `terraform/agents/intake/agent.py` and `terraform/agents/review/agent.py`. The `null_resource` triggers detect hash changes and redeploy on `make apply`.
- **Lambda code:** edit `terraform/lambdas/<name>/index.py`. `archive_file` rebuilds the zip on apply.

## Where things live

```
terraform/
├── modules/         Reusable IaC building blocks (data, lambda_function, api, agents, observability)
├── lambdas/         Lambda handler source (api_handler, agent_invoker, authorizer)
├── agents/          AgentCore agent source (intake, review)
├── scripts/         Helpers (load_sample_data.py, verify_deployment.py, generate_glean_specs.py)
├── env/             Per-environment backend configs
└── bootstrap/       One-shot modules (state-backend, github-oidc)

archive/             Legacy CFN + bash (reference only)
docs/                Runbooks
glean/               Glean Action OpenAPI specs (input + generated/)
```
