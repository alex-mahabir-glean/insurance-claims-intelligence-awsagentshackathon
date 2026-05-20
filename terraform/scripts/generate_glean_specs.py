#!/usr/bin/env python3
"""Generate Glean-ready OpenAPI specs by injecting the deployed API URL.

Reads the API URL from `terraform output -json` and writes the populated
specs to glean/generated/. Replaces the legacy generate-glean-specs.sh.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
GLEAN_DIR = REPO_ROOT / "glean"
OUT_DIR = GLEAN_DIR / "generated"
PLACEHOLDER = "https://YOUR_API_GATEWAY_URL"


def _terraform_outputs() -> dict:
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=REPO_ROOT / "terraform",
        capture_output=True,
        text=True,
        check=True,
    )
    return {k: v["value"] for k, v in json.loads(result.stdout).items()}


def main() -> None:
    outputs = _terraform_outputs()
    api_url = outputs.get("api_invoke_url") or outputs.get("api_endpoint")
    if not api_url:
        print("ERROR: api_invoke_url not in terraform output", file=sys.stderr)
        sys.exit(1)

    api_url = api_url.rstrip("/")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    written = 0
    for src in GLEAN_DIR.glob("openapi-*.json"):
        text = src.read_text().replace(PLACEHOLDER, api_url)
        dst = OUT_DIR / src.name
        dst.write_text(text)
        print(f"  + {dst.relative_to(REPO_ROOT)}")
        written += 1

    print(f"\nGenerated {written} Glean-ready OpenAPI specs in {OUT_DIR.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
