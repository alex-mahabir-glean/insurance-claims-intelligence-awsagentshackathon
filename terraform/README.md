# Terraform — Insurance Claims Intelligence

Customer-deployable Infrastructure-as-Code for the Insurance Claims Intelligence
accelerator. Replaces the legacy `backend/cloudformation/legal-service-stack.yaml`
+ `deploy.sh` flow.

## Prerequisites

- Terraform `>= 1.6` (tested with 1.14.8 — see `.terraform-version`)
- AWS CLI v2, with a configured profile that has admin-equivalent permissions
- Python 3.12 (for the Lambda handlers under `lambdas/` and the AgentCore agents)
- [`bedrock-agentcore-starter-toolkit`](https://github.com/aws/bedrock-agentcore-starter-toolkit) (provides the `agentcore` CLI used by `module.agents`)
- `make` (or substitute `just` if preferred)

## One-time backend bootstrap

The S3 backend that stores Terraform state cannot create itself. Run the
bootstrap module once per AWS account + region pair:

```bash
make bootstrap-backend                 # creates tfstate-${ACCOUNT_ID}-${REGION} + tfstate-locks
```

Note the outputs (`bucket_name`, `lock_table_name`, `region`).

## Per-environment setup

```bash
cp env/dev.tfbackend.example env/dev.tfbackend
# Edit env/dev.tfbackend with the bucket name from bootstrap

cp terraform.tfvars.example terraform.tfvars
# Edit aws_region, environment, deployment_id

make init ENV=dev
make plan
make apply
```

## Layout

```
terraform/
├── main.tf, variables.tf, outputs.tf, versions.tf  Top-level wiring
├── env/                 Per-environment backend configs (.example committed)
├── bootstrap/
│   └── state-backend/   One-shot S3+DynamoDB backend (TF-1)
├── modules/             Reusable building blocks (added in TF-2..6)
├── lambdas/             Lambda handler source code (added in TF-3)
├── agents/              AgentCore agent source code (added in TF-5)
├── scripts/             Helper scripts (verify_self_contained.sh)
└── examples/            Sample top-level configs
```

## Two consumption patterns

The `modules/` are designed to be self-contained — no cross-module file
references — so customers can either:

1. **Reference via git tag** (recommended for tracking upstream changes):

   ```hcl
   module "data" {
     source = "git::https://github.com/alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon.git//terraform/modules/data?ref=v1.0.0"
     ...
   }
   ```

2. **Clone-and-fork** — copy `modules/data/` (or any module) into your own
   Terraform repo. Each module passes `terraform validate` standalone:
   ```bash
   make verify-modules
   ```

## Multi-environment strategy

Separate state files per environment, one shared backend:

```
s3://tfstate-<accountId>-<region>/
  ├── insurance-claims-intelligence/dev/terraform.tfstate
  ├── insurance-claims-intelligence/staging/terraform.tfstate
  └── insurance-claims-intelligence/prod/terraform.tfstate
```

Switch via `make init ENV=staging` or `terraform init -backend-config=env/staging.tfbackend`.
