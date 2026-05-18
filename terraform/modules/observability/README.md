# `observability` module

Wires every Lambda, API stage, and DynamoDB table to CloudWatch alarms,
ships a starter dashboard, and (optionally) creates an AWS Budget for
Bedrock spend.

## What it creates

| Resource | Notes |
|---|---|
| `aws_sns_topic` | One topic for all alerts. Email subscription via `var.alert_email`. |
| Per-Lambda `aws_cloudwatch_metric_alarm` ×3 | Errors > 0 (5 min), Throttles > 0, p99 duration > threshold. |
| API Gateway alarms ×3 | 4xx > 50/5min, 5xx > 0, IntegrationLatency p99 > 5s. |
| Per-DDB-table alarms ×2 | UserErrors, ThrottledRequests. |
| `aws_cloudwatch_dashboard` | Single-pane view of Lambda errors/duration, API 4xx/5xx, DDB throttling, custom EMF metrics from Powertools. |
| `aws_cloudwatch_query_definition` ×3 | Errors-by-route, slow-requests, agent-invocations. |
| `aws_budgets_budget` | Bedrock service-scoped monthly budget with 50/80/100% notifications. Set `monthly_bedrock_budget_usd = 0` to skip. |

## Inputs

| Variable | Required | Notes |
|---|---|---|
| `deployment_id` | yes | Suffixed onto resource names |
| `lambdas` | yes | Map of logical name → Lambda function name |
| `api_id` | yes | HTTP API id |
| `table_names` | yes | Map of logical name → DDB table name |
| `alert_email` | no (default null) | Email to subscribe |
| `monthly_bedrock_budget_usd` | no (default 50) | Set 0 to skip |
| `duration_p99_threshold_ms` | no (default 8000) | Lambda p99 alarm threshold |

## Locked design decisions

- **Channel:** SNS topic + email subscription. Slack via Chatbot is out of scope for v1.
- **Synthetics canaries:** out of scope for v1.
- **Budgets:** included by default ($50/mo, customer can override or zero out).

## Self-containment

This module has no dependencies on sibling modules. Pass the inputs from
their respective module outputs in your top-level config.
