# Migration runbook: CloudFormation → Terraform

Cutover plan for the IaC migration tracked under epic #32. Locked
strategy from the Q&A: **destroy CFN + reapply Terraform fresh**. Sample
data is reloadable; tokens regenerate; agent ARNs change. Frontend
`config.js` regenerates from `terraform output`.

## Pre-flight (do once)

1. Note which sample claim IDs / reviewer rows are present so you can verify reload after cutover.
2. Confirm `terraform >= 1.6`, `aws` CLI v2, `python` 3.12, and `bedrock-agentcore-starter-toolkit` are installed.
3. Confirm AWS credentials reach the target account/region.
4. **One-time** state backend: `make bootstrap-backend` (skip if already done).
5. **One-time** GitHub OIDC role: `cd terraform/bootstrap/github-oidc && terraform apply -var=...` (skip if not enabling CI yet).
6. Copy `terraform/env/dev.tfbackend.example` → `terraform/env/dev.tfbackend` and fill in the bucket name from step 4.
7. Copy `terraform/terraform.tfvars.example` → `terraform/terraform.tfvars` and customize.

## Cutover

```bash
# 1. Destroy the legacy CloudFormation stack
aws cloudformation delete-stack --stack-name legal-service-stack --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name legal-service-stack --region us-east-1

# 2. Clean up AgentCore Runtimes that CFN didn't own
python3 archive/deployment/delete_agentcore_agents.py

# 3. Initialize Terraform against the dev backend
make init ENV=dev

# 4. Review the plan
make plan

# 5. Apply (first apply takes ~10-15 minutes — CodeBuild builds 2 agent images)
make apply

# 6. Reseed sample data
make load-sample-data

# 7. Generate Glean OpenAPI specs with the new API URL
make glean-specs

# 8. Verify
make verify
```

## Verification (`make verify`)

Smoke-tests:
- `GET /claims` without auth → 401/403 (closes SEC-3 #3)
- `GET /claims` with bearer → 200 with claim list
- All 3 DynamoDB tables exist

If any check fails, see the rollback plan below.

## Rollback

If `terraform apply` fails partway through:

1. `make destroy` — undo whatever Terraform created.
2. Re-deploy the legacy CFN from `archive/cloudformation/legal-service-stack.yaml` via `aws cloudformation deploy ...`.
3. Reseed sample data via `python3 terraform/scripts/load_sample_data.py` (the schema is preserved so the loader works against the re-deployed tables).
4. Re-deploy AgentCore agents using the archived flow — see `archive/deployment/README.md`.

The Terraform tables and CFN tables share the same names (`LegalService-Claims-${deployment_id}`), so the loader works in both directions.

## What changes for users

- API URL: changes from a REST API to an HTTP API v2 endpoint (`https://<id>.execute-api.<region>.amazonaws.com/prod/...`).
- Auth: still shared bearer (SEC-2 #2 swaps to Cognito JWT in a follow-up).
- AgentCore Runtime ARNs: regenerate. Frontend `config.js` regenerates from `terraform output`.
- Sample claim IDs: regenerate (new format `CL-<ts>-<8 hex>`).

## Don't forget

- **Frontend `config.js` regeneration** is a manual step today. Track TF-9 (#41) for the Terraform-ized hosting layer that automates it.
- **Tokens rotate** at apply time. If anyone is integrated against the old token (Glean Action, custom integration), update them with the new value from Secrets Manager.
