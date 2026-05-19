# Legacy artifacts (pre-Terraform)

This directory holds the previous CloudFormation + bash deployment that
was superseded by the Terraform migration tracked under epic #32 and
landed in PRs #42–#48.

## What's here

| Path | Was at | Why kept |
|---|---|---|
| `cloudformation/legal-service-stack.yaml` | `backend/cloudformation/` | The original 2,109-line CFN template. Reference only — do not deploy. |
| `openapi/legal-service-api.yaml` | `backend/openapi/` | Source of truth for the REST API contract; the active OpenAPI specs for Glean live in `glean/`. |
| `scripts/deploy.sh` | repo root | The 561-line bash glue. Replaced by `make` targets in `terraform/Makefile`. |
| `scripts/cleanup.sh` | repo root | Replaced by `make destroy`. |
| `scripts/seed_claims_via_api.py` | `backend/scripts/` | One-off helper. The active sample-data loader lives at `terraform/scripts/load_sample_data.py`. |
| `deployment/` | repo root | AgentCore deploy artifacts — `agentcore-deploy/`, `delete_agentcore_agents.py`, etc. The agents module under `terraform/modules/agents/` now manages this. |

## Active replacements

- **IaC:** `terraform/`
- **Lambda code:** `terraform/lambdas/`
- **Agent code:** `terraform/agents/`
- **Sample data:** `terraform/scripts/sample-data/` + `terraform/scripts/load_sample_data.py`
- **Verification:** `terraform/scripts/verify_deployment.py`
- **Glean specs generator:** `terraform/scripts/generate_glean_specs.py`

## Production hosting (CloudFront/Cognito)

`AWS_HOSTING.md` (still at the repo root) describes the optional
production hosting stack. It is also CloudFormation-based and is being
migrated to Terraform under TF-9 (#41). Until that lands, the existing
content there is correct.
