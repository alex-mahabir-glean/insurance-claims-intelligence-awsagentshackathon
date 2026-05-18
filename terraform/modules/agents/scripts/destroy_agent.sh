#!/usr/bin/env bash
# Destroy a single AgentCore Runtime by name.
# Required env: RUNTIME_NAME, AWS_REGION
set -euo pipefail

# Find the runtime by name and delete it.
# We use the AWS CLI directly (not agentcore destroy, which is undocumented).

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found." >&2
  exit 1
fi

# List runtimes, find the one matching our name, extract ID
RUNTIME_ID=$(aws bedrock-agentcore-control list-agent-runtimes \
  --region "$AWS_REGION" \
  --query "agentRuntimes[?agentRuntimeName=='${RUNTIME_NAME}'].agentRuntimeId | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$RUNTIME_ID" = "None" ] || [ -z "$RUNTIME_ID" ]; then
  echo "Runtime ${RUNTIME_NAME} not found in ${AWS_REGION} — nothing to delete." >&2
  exit 0
fi

echo "==> Deleting AgentCore Runtime: ${RUNTIME_NAME} (id=${RUNTIME_ID})" >&2
aws bedrock-agentcore-control delete-agent-runtime \
  --region "$AWS_REGION" \
  --agent-runtime-id "$RUNTIME_ID" >&2 || true

echo "==> deleted" >&2
