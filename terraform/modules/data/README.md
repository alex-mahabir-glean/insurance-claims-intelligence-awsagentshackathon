# `data` module

Reusable module providing the durable storage tier for the Insurance Claims
Intelligence accelerator: 3 DynamoDB tables, a customer-managed KMS key
shared by everything below, and 2 Secrets Manager secrets for API tokens.

## What it creates

| Resource | Notes |
|---|---|
| `aws_kms_key` | One CMK per stack, rotation enabled. Encrypts all DDB tables and both Secrets. Closes [#5 SEC-5](https://github.com/.../issues/5) part 1. |
| `aws_kms_alias` | `${var.kms_alias_prefix}-${var.deployment_id}` |
| `aws_dynamodb_table.claims` | HASH `claimId`. GSIs `StatusIndex`, `AssignedToIndex`. Stream `NEW_AND_OLD_IMAGES`. PITR on. SSE with CMK. Tagged `DataClassification=PII`. |
| `aws_dynamodb_table.reviewers` | HASH `reviewerId`. SSE with CMK. |
| `aws_dynamodb_table.audit_trail` | HASH `claimId`, RANGE `timestamp`. PITR on. SSE with CMK. TTL on `expires_at` (enabled iff `var.audit_trail_retention_seconds` is set). |
| `aws_secretsmanager_secret.api_token` | Generates a 32-char random token at apply. Used by Glean Actions. |
| `aws_secretsmanager_secret.agentcore_api_token` | Generates a 32-char random token at apply. Used by the API Gateway authorizer Lambda. |

## Inputs

| Variable | Type | Default | Notes |
|---|---|---|---|
| `deployment_id` | string | (required) | Lowercase letters/numbers only |
| `billing_mode` | string | `PAY_PER_REQUEST` | Use `PROVISIONED` for steady-traffic deploys |
| `audit_trail_retention_seconds` | number | `null` | TTL window in seconds. `null` disables TTL (current behavior). |
| `allow_destroy` | bool | `false` | When false, Claims and AuditTrail have deletion protection. Flip to `true` in dev for `terraform destroy`. |
| `kms_alias_prefix` | string | `alias/insurance-claims-intelligence` | |
| `tags` | map(string) | `{}` | Additional tags merged onto every resource |

## Outputs

`claims_table_name/arn/stream_arn`, `claims_index_arns`, `reviewers_table_name/arn`, `audit_trail_table_name/arn`, `all_table_arns`, `kms_key_id/arn/alias_name`, `api_token_secret_arn/name`, `agentcore_api_token_secret_arn/name`.

See `outputs.tf` for full descriptions.

## Locked design decisions

These came out of the Q&A on epic [#32](https://github.com/.../issues/32):

- **One CMK per stack** (not per resource). Simpler key policy, fewer keys to rotate, all data resources share the same trust boundary.
- **Deletion protection on by default** for Claims and AuditTrail. `var.allow_destroy = true` lets dev/test workspaces tear down without manual confirmation.
- **PITR enabled** for Claims and AuditTrail. Reviewers table omitted (low blast radius, easily reseeded).
- **AuditTrail TTL is opt-in**. The Lambda writer sets `expires_at` only when retention is configured; otherwise items persist. Avoids stuck dev/test data.
- **Schema preserved** from the existing CFN: same table names (`LegalService-*-${deployment_id}`), same key shapes, same GSIs, same stream type. Existing sample data loaders work unchanged.

## Typical usage

```hcl
module "data" {
  source = "git::https://github.com/.../insurance-claims-intelligence-awsagentshackathon.git//terraform/modules/data?ref=v1.0.0"

  deployment_id                 = "legal"
  audit_trail_retention_seconds = null   # opt out, customer can enable later
  allow_destroy                 = false  # keep deletion protection
}

# Wire downstream IAM with the precise ARNs (no Resource: "*"):
resource "aws_iam_role_policy" "lambda_data_access" {
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
      Resource = concat(
        module.data.all_table_arns,
        [for arn in values(module.data.claims_index_arns) : arn],
      )
    }]
  })
}
```

## Self-containment

This module has no dependencies on sibling modules. `terraform validate`
passes standalone — verified by `terraform/scripts/verify_self_contained.sh`.
