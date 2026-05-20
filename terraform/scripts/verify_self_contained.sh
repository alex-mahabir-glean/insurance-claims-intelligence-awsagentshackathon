#!/usr/bin/env bash
# Verify each module under modules/ passes `terraform validate` standalone,
# proving the modules have no cross-tree dependencies and can be lifted into
# a customer's repo as-is or referenced via git source.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

shopt -s nullglob
modules=("$ROOT_DIR"/modules/*/)

if [ "${#modules[@]}" -eq 0 ]; then
  echo "No modules under modules/ yet. (Land in TF-2..6.)"
  exit 0
fi

failed=0
for module_dir in "${modules[@]}"; do
  module_name=$(basename "$module_dir")
  echo "=== Validating module: $module_name ==="
  tmp_dir=$(mktemp -d)
  cp -R "$module_dir"/. "$tmp_dir/"
  if (cd "$tmp_dir" && terraform init -backend=false > /dev/null 2>&1 && terraform validate); then
    echo "    ok"
  else
    echo "    FAILED: $module_name"
    failed=$((failed+1))
  fi
  rm -rf "$tmp_dir"
done

if [ "$failed" -gt 0 ]; then
  echo ""
  echo "$failed module(s) failed standalone validation."
  exit 1
fi

echo ""
echo "All modules pass standalone validation."
