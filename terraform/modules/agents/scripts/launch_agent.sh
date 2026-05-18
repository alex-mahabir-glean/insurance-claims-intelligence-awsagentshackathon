#!/usr/bin/env bash
# Wrap `agentcore configure && agentcore launch` for a single agent.
# Required env: AGENT_NAME, SOURCE_DIR, BUILD_DIR, RUNTIME_NAME, AWS_REGION, EXECUTION_ROLE
set -euo pipefail

if ! command -v agentcore >/dev/null 2>&1; then
  echo "ERROR: agentcore CLI not found. Install bedrock-agentcore-starter-toolkit." >&2
  echo "  pip install bedrock-agentcore-starter-toolkit" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"

# Stage source into the build dir (idempotent — agentcore configure rewrites .bedrock_agentcore.yaml)
cp "$SOURCE_DIR/agent.py" "$BUILD_DIR/agent.py"
cp "$SOURCE_DIR/requirements.txt" "$BUILD_DIR/requirements.txt"

cd "$BUILD_DIR"

# Configure (idempotent — overwrites the local yaml)
echo "==> agentcore configure: $RUNTIME_NAME"
agentcore configure \
  -e agent.py \
  --disable-memory \
  --region "$AWS_REGION" \
  --non-interactive \
  --name "$RUNTIME_NAME" \
  --execution-role "$EXECUTION_ROLE" >&2

# Launch (builds image via CodeBuild, pushes to ECR, registers Runtime)
echo "==> agentcore launch: $RUNTIME_NAME"
agentcore launch >&2

echo "==> launched: $RUNTIME_NAME"
