# AgentCore agent source

Strands-based agents deployed to Bedrock AgentCore Runtime by `terraform/modules/agents/`.

## Layout

```
terraform/agents/
├── intake/
│   ├── agent.py         # Strands agent definition
│   └── requirements.txt
└── review/
    ├── agent.py
    └── requirements.txt
```

## Editing an agent

1. Edit `agent.py` (or `requirements.txt`).
2. Run `make plan` from `terraform/`. The `null_resource` triggers detect
   a hash change and queue a redeploy via `agentcore launch`.
3. Run `make apply`. The agent is rebuilt (CodeBuild + ECR push) and the
   `aws_lambda_function.agent_invoker` env vars are NOT changed (the ARN
   is stable across re-launches).

## Why the source is outside the module

The `agents/` module is reusable infrastructure; the agent code is the
project's business logic. Splitting them lets customers fork the agents
(or add more) without touching the module.
