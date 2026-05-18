# `lambda_function` module

Reusable wrapper that produces a Lambda function with the observability and
durability defaults this project requires:

- `aws_lambda_function` packaged from `var.source_dir`
- CloudWatch log group with `retention_in_days = var.log_retention_days` (default 7)
- SQS dead-letter queue with 14-day retention
- IAM role with `AWSLambdaBasicExecutionRole` + DLQ send permission
- Optional inline policy via `var.inline_policy_json` (scope to specific table/agent ARNs)
- AWS-managed Powertools Lambda Layer attached automatically (provides Pydantic, Logger, Tracer, Metrics)
- X-Ray active tracing
- Optional alarms (errors > 0, throttles > 0, p99 duration > threshold) wired to a shared SNS topic

## Inputs

See `variables.tf`. Required: `name`, `source_dir`, `powertools_layer_arn`.

## Outputs

`function_name`, `function_arn`, `invoke_arn`, `role_arn`, `role_name`, `log_group_name`, `dlq_arn`, `dlq_url`.

## Locked design decisions

- Per-Lambda SQS DLQ (not shared) — easiest failure attribution.
- Default log retention 7 days — cheap, customer-tunable.
- AWS-managed Powertools Layer (not vendored Python deps) — bundles Pydantic v2.
- X-Ray Active by default.
- Powertools layer ARN required (not defaulted) — version pinning is the caller's call.

## Usage

```hcl
module "api_handler" {
  source = "./modules/lambda_function"

  name                 = "LegalService-ApiHandler-${var.deployment_id}"
  source_dir           = "${path.module}/lambdas/api_handler"
  powertools_layer_arn = local.powertools_layer_arn
  memory_size          = 256
  timeout              = 10

  environment = {
    CLAIMS_TABLE  = module.data.claims_table_name
    LOG_LEVEL     = "INFO"
    POWERTOOLS_SERVICE_NAME = "api-handler"
  }

  inline_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
      Resource = module.data.all_table_arns
    }]
  })
}
```

## Self-containment

This module has no dependencies on sibling modules. `terraform validate`
passes standalone.
