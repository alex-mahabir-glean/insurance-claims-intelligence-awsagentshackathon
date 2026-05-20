# `agents` module

Deploys Bedrock AgentCore Runtimes by wrapping the `agentcore` CLI in a
`null_resource` and reading the resulting ARN via an `external` data source.

## Why a wrapper

The `agentcore` CLI builds the agent's container image (CodeBuild → ECR),
registers the Runtime, and writes a local `.bedrock_agentcore.yaml` with
the deployed ARN. Until Terraform's AWS provider has a native
`aws_bedrockagentcore_runtime` resource, this wrapper bridges the gap.

When provider coverage lands, swap the `null_resource` + `external` for the
native resource without changing inputs/outputs.

## Locked design decisions

- **Execution: laptop only** for v1 (`agentcore launch` runs as a `local-exec`
  provisioner from a developer's machine). TF-7's CI does NOT call the CLI.
- **Memory disabled** (`agentcore configure --disable-memory`) — matches
  current behavior; conversation context lives in the prompt.
- **IAM scoped to specific Bedrock foundation model ARNs** —
  `var.bedrock_model_ids` (default `["amazon.nova-pro-v1:0"]`). Closes
  **SEC-4 #4** for the AgentCore execution role.
- **DynamoDB scope: only the 3 stack tables + Claims GSIs.**
- **Re-launch trigger:** `filesha256` of `agent.py` AND `requirements.txt`.
  No-op apply when both unchanged.
- **Destroy:** uses `aws bedrock-agentcore-control delete-agent-runtime`
  directly (not the undocumented `agentcore destroy`).

## Required customer prerequisites

- `agentcore` CLI: `pip install bedrock-agentcore-starter-toolkit`
- `aws` CLI v2 with credentials that can write to ECR + create CodeBuild
  projects (the `agentcore launch` builds the image)
- `python` 3.12 (matches Lambda runtime; Strands SDK target)

## Inputs

See `variables.tf`. Required: `deployment_id`, `aws_region`, `agents`,
the 4 data-tier ARNs, `kms_key_arn`.

`var.agents` is a map; the convention used by the project is:

```hcl
agents = {
  intake = {
    source_dir   = "${path.module}/agents/intake"
    runtime_name = "legal_intake_agent_${var.deployment_id}"
  }
  review = {
    source_dir   = "${path.module}/agents/review"
    runtime_name = "legal_review_agent_${var.deployment_id}"
  }
}
```

## Outputs

`agent_arns` (map), `intake_agent_arn`, `review_agent_arn`,
`agentcore_role_arn`, `agentcore_role_name`.

## Self-containment

The module is self-contained. Helper scripts live under
`scripts/` inside the module. Customers can copy the module
directory wholesale into their own repo and it works.

## Caveats

- **Provider coverage maturing:** when `aws_bedrockagentcore_runtime`
  reaches GA in the AWS provider, replace `null_resource` + `external`
  with the native resource. Inputs/outputs of this module should stay
  the same so the swap is non-breaking.
- **First apply takes ~5-7 minutes per agent** (CodeBuild + ECR push).
- **Source dirs must contain `agent.py` and `requirements.txt`.**
