# `api` module

HTTP API v2 fronting the 2 application Lambdas + the request authorizer.
Replaces the REST API + per-Lambda CORS mess from the original CFN.

## Routes

| Method + path | Integration |
|---|---|
| `POST /submit-claim` | `api_handler` |
| `GET /claims` | `api_handler` |
| `GET /claims/{claimId}` | `api_handler` |
| `POST /approve-claim` | `api_handler` |
| `POST /deny-claim` | `api_handler` |
| `POST /reassign-claim` | `api_handler` |
| `POST /invoke-intake-agent` | `agent_invoker` |
| `POST /invoke-review-agent` | `agent_invoker` |

**All 8 routes require authentication.** No `AuthorizationType: NONE` (closes SEC-3 #3).

## Inputs

See `variables.tf`. Required: `deployment_id`, the 6 lambda ARN/invoke_arn pairs.

Notable knobs:
- `allowed_origins` — list of CORS allow-list origins (default `["http://localhost:8000"]`)
- `authorizer_result_ttl_seconds` — default `300` (closes PERF-2 #24, was 0)
- `agent_route_burst_limit` / `agent_route_rate_limit` — Bedrock cost protection (defaults 20/10)
- `default_route_burst_limit` / `default_route_rate_limit` — non-agent endpoints (defaults 100/50)
- `enable_waf` — opt-in WAF with Common + KnownBadInputs managed rule groups (default `false`)

## Outputs

`api_id`, `api_endpoint`, `stage_invoke_url`, `execution_arn`, `authorizer_id`, `stage_arn`, `access_log_group_name`, `waf_web_acl_arn`.

## Locked design decisions

- **HTTP API v2** instead of REST API — cheaper, simpler, native JWT support for SEC-2 future
- **CORS at API level** (single source of truth) instead of per-Lambda headers — closes SEC-1 #1
- **All routes authenticated** — closes SEC-3 #3
- **Authorizer TTL = 300s** (was 0) — closes PERF-2 #24
- **WAF opt-in** (default off) — accelerator simplicity; production users flip the switch
- **2 Lambda integrations**, not 7 — supports Option B topology from TF-3

## What this does NOT do

- Request validation. HTTP API v2 doesn't have built-in validators; validation happens in the Lambda via Pydantic (closes SEC-7 #7 + PERF-3 #25 in TF-3).
- JWT authentication. Custom Lambda authorizer is preserved; SEC-2 #2 swaps it to Cognito JWT in a follow-up.

## Self-containment

This module has no dependencies on sibling modules. `terraform validate`
passes standalone (with the lambda ARN inputs marked required).
