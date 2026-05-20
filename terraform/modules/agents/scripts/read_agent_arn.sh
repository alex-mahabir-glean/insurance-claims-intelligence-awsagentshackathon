#!/usr/bin/env bash
# Read the agent_arn from .bedrock_agentcore.yaml in a build dir.
# Output JSON for the Terraform `external` data source.
set -euo pipefail

# Read the JSON query from stdin
QUERY=$(cat)
BUILD_DIR=$(echo "$QUERY" | python3 -c "import sys, json; print(json.load(sys.stdin)['build_dir'])")

YAML="$BUILD_DIR/.bedrock_agentcore.yaml"

if [ ! -f "$YAML" ]; then
  echo "ERROR: $YAML not found. Did agentcore launch run?" >&2
  exit 1
fi

# Parse YAML for agent_arn (without requiring PyYAML)
ARN=$(grep "^agent_arn:" "$YAML" | head -1 | awk '{print $2}' | tr -d '"')

if [ -z "$ARN" ]; then
  echo "ERROR: agent_arn not found in $YAML" >&2
  exit 1
fi

# external data source expects {"key": "value"} JSON
printf '{"arn":"%s"}\n' "$ARN"
