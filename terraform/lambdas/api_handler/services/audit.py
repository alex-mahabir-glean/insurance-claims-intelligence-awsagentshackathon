"""DynamoDB operations for the AuditTrail table.

Schema: HASH claimId, RANGE timestamp. Optional TTL on `expires_at`
(only set when AUDIT_TRAIL_RETENTION_SECONDS env var is configured).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import boto3

_dynamodb = boto3.resource("dynamodb")
_audit_table = _dynamodb.Table(os.environ["AUDIT_TABLE"])

_RETENTION_SECONDS = (
    int(os.environ["AUDIT_TRAIL_RETENTION_SECONDS"])
    if os.environ.get("AUDIT_TRAIL_RETENTION_SECONDS")
    else None
)


def record(
    *, claim_id: str, action: str, actor: str, actor_type: str, details: dict[str, Any]
) -> None:
    now = datetime.now(timezone.utc)
    item: dict[str, Any] = {
        "claimId": claim_id,
        "timestamp": now.isoformat(),
        "action": action,
        "actor": actor,
        "actorType": actor_type,
        "details": details,
    }
    if _RETENTION_SECONDS is not None:
        item["expires_at"] = int(now.timestamp()) + _RETENTION_SECONDS

    _audit_table.put_item(Item=item)
