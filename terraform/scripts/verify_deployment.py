#!/usr/bin/env python3
"""Smoke-test a Terraform-deployed insurance-claims stack.

Reads the API URL + table names from `terraform output -json` and:
  1. Hits GET /claims (expects 401 without auth — verifies SEC-3 fix)
  2. Hits GET /claims with the bearer token from Secrets Manager (expects 200)
  3. Lists DynamoDB tables and confirms they exist
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import boto3
import urllib.request


def _terraform_outputs() -> dict:
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=Path(__file__).parent.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    return {k: v["value"] for k, v in json.loads(result.stdout).items()}


def _http_get(url: str, headers: dict | None = None) -> tuple[int, str]:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", help="AWS profile")
    args = parser.parse_args()

    outputs = _terraform_outputs()
    api_url = outputs["api_invoke_url"].rstrip("/")
    token_secret = outputs["agentcore_api_token_secret_name"]

    session_kwargs = {}
    if args.profile:
        session_kwargs["profile_name"] = args.profile
    session = boto3.Session(**session_kwargs)

    print(f"API: {api_url}")
    print()

    # 1. unauth → expect 401/403 (closes SEC-3)
    status, _ = _http_get(f"{api_url}/claims")
    if status in (401, 403):
        print(f"  ok  GET /claims (no auth) → {status}  (SEC-3 enforced)")
    else:
        print(f"  ERR GET /claims (no auth) → {status}  (expected 401/403)")
        sys.exit(1)

    # 2. authed → expect 200
    secret_value = session.client("secretsmanager").get_secret_value(SecretId=token_secret)
    token = json.loads(secret_value["SecretString"])["token"]
    status, body = _http_get(f"{api_url}/claims", {"Authorization": f"Bearer {token}"})
    if status == 200:
        n = len(json.loads(body).get("claims", []))
        print(f"  ok  GET /claims (authed)  → 200  ({n} claims returned)")
    else:
        print(f"  ERR GET /claims (authed)  → {status}  body={body[:200]}")
        sys.exit(1)

    # 3. tables exist
    ddb = session.client("dynamodb")
    for tname_var in ["claims_table_name", "reviewers_table_name", "audit_trail_table_name"]:
        name = outputs[tname_var]
        try:
            ddb.describe_table(TableName=name)
            print(f"  ok  DynamoDB {name}")
        except Exception as exc:
            print(f"  ERR DynamoDB {name}: {exc}")
            sys.exit(1)

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
