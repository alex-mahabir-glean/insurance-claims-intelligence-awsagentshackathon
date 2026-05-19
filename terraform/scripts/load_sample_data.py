#!/usr/bin/env python3
"""Reseed sample claims + reviewers into the Terraform-deployed DynamoDB tables.

Usage:
    cd terraform/
    python3 scripts/load_sample_data.py [--profile <aws-profile>] [--region <region>]

Reads table names from `terraform output -json` so it works against any
deployment_id. Replaces the legacy backend/data/load_sample_data.py.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import boto3

SAMPLE_DIR = Path(__file__).parent / "sample-data"


def _terraform_outputs() -> dict:
    """Run `terraform output -json` and return the result."""
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=Path(__file__).parent.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    return {k: v["value"] for k, v in json.loads(result.stdout).items()}


def _ddb_value_to_python(value):
    """Convert DynamoDB JSON to native Python types."""
    if isinstance(value, dict):
        if "S" in value: return value["S"]
        if "N" in value: return Decimal(value["N"])
        if "BOOL" in value: return value["BOOL"]
        if "NULL" in value: return None
        if "M" in value: return {k: _ddb_value_to_python(v) for k, v in value["M"].items()}
        if "L" in value: return [_ddb_value_to_python(v) for v in value["L"]]
        return {k: _ddb_value_to_python(v) for k, v in value.items()}
    return value


def _load_items(table, file_path: Path) -> int:
    data = json.loads(file_path.read_text())
    count = 0
    for table_name, batch in data.items():  # nested under legacy table name keys
        for wrapper in batch:
            item = _ddb_value_to_python(wrapper["PutRequest"]["Item"])
            try:
                table.put_item(Item=item)
                count += 1
                key = item.get("claimId") or item.get("reviewerId") or "?"
                print(f"  + {key}")
            except Exception as exc:
                print(f"  ! {exc}", file=sys.stderr)
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", help="AWS profile name")
    parser.add_argument("--region", help="AWS region (overrides terraform output)")
    args = parser.parse_args()

    outputs = _terraform_outputs()
    claims_table_name = outputs["claims_table_name"]
    reviewers_table_name = outputs["reviewers_table_name"]
    region = args.region or outputs.get("aws_region") or "us-east-1"

    session_kwargs = {"region_name": region}
    if args.profile:
        session_kwargs["profile_name"] = args.profile
    session = boto3.Session(**session_kwargs)
    ddb = session.resource("dynamodb")

    print(f"Loading claims into {claims_table_name}…")
    n_claims = _load_items(ddb.Table(claims_table_name), SAMPLE_DIR / "sample-claims.json")
    print(f"Loading reviewers into {reviewers_table_name}…")
    n_reviewers = _load_items(ddb.Table(reviewers_table_name), SAMPLE_DIR / "sample-reviewers.json")

    print(f"\nLoaded {n_claims} claims + {n_reviewers} reviewers.")


if __name__ == "__main__":
    main()
