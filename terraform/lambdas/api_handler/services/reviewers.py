"""DynamoDB operations for the Reviewers table.

Replaces the hardcoded REVIEWER_NAMES dict that was duplicated across 4 files
in the original code (closes OPS-6 #22). Display names now come from the
Reviewers table."""
from __future__ import annotations

import os
from typing import Any

import boto3

_dynamodb = boto3.resource("dynamodb")
_reviewers_table = _dynamodb.Table(os.environ["REVIEWERS_TABLE"])


def get_reviewer(reviewer_id: str) -> dict[str, Any] | None:
    resp = _reviewers_table.get_item(Key={"reviewerId": reviewer_id})
    return resp.get("Item")


def get_display_name(reviewer_id: str) -> str:
    """Look up the reviewer's display name. Falls back to the ID if not found."""
    rec = get_reviewer(reviewer_id)
    if rec and "displayName" in rec:
        return rec["displayName"]
    return reviewer_id
