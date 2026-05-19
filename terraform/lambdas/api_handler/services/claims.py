"""DynamoDB operations for the Claims table."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

_dynamodb = boto3.resource("dynamodb")
_claims_table = _dynamodb.Table(os.environ["CLAIMS_TABLE"])


def generate_claim_id() -> str:
    """CL-<YYYYMMDDHHMMSS>-<8 hex>. The 8-hex suffix prevents sub-second collisions
    that the original CFN had (closes part of REL-4 #14)."""
    now = datetime.now(timezone.utc)
    return f"CL-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def submit_claim(payload: dict[str, Any]) -> dict[str, Any]:
    claim_id = generate_claim_id()
    timestamp = utcnow_iso()

    record = {
        "claimId": claim_id,
        "version": "v1",
        "claimantInfo": {
            "name": payload["claimantName"],
            "email": payload["claimantEmail"],
            "phone": payload.get("claimantPhone") or "",
            "address": payload.get("claimantAddress") or "",
        },
        "policyNumber": payload["policyNumber"],
        "claimType": payload["claimType"],
        "incidentDate": payload["incidentDate"],
        "incidentDescription": payload["incidentDescription"],
        "claimValue": Decimal(str(payload["claimValue"])),
        "policeReport": payload.get("policeReport"),
        "injuries": bool(payload.get("injuries", False)),
        "injuryDescription": payload.get("injuryDescription"),
        "status": "submitted",
        "submittedDate": timestamp,
        "lastUpdated": timestamp,
    }

    # ConditionExpression closes the put-item-overwrite hole flagged in REL-4 #14.
    _claims_table.put_item(
        Item=record,
        ConditionExpression="attribute_not_exists(claimId)",
    )
    return {"claimId": claim_id, "status": "submitted"}


def get_claim(claim_id: str) -> dict[str, Any] | None:
    resp = _claims_table.get_item(Key={"claimId": claim_id})
    return resp.get("Item")


def list_claims(
    reviewer_id: str | None = None, status: str | None = None
) -> list[dict[str, Any]]:
    """List claims with optional filtering. Uses Query on GSI when possible
    (closes part of PERF-1 #23) and falls back to Scan only when no filter is
    given."""
    if reviewer_id:
        resp = _claims_table.query(
            IndexName="AssignedToIndex",
            KeyConditionExpression="assignedTo = :rev",
            ExpressionAttributeValues={":rev": reviewer_id},
        )
        items = resp.get("Items", [])
    elif status:
        resp = _claims_table.query(
            IndexName="StatusIndex",
            KeyConditionExpression="#s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status},
        )
        items = resp.get("Items", [])
    else:
        resp = _claims_table.scan()
        items = resp.get("Items", [])

    items.sort(key=lambda x: x.get("submittedDate", ""), reverse=True)
    return items


def approve_claim(claim_id: str, notes: str) -> None:
    timestamp = utcnow_iso()
    try:
        _claims_table.update_item(
            Key={"claimId": claim_id},
            UpdateExpression="SET #s = :status, finalDecision = :d, decisionReason = :r, "
            "reviewedDate = :rev, lastUpdated = :upd",
            ConditionExpression="attribute_exists(claimId)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": "approved",
                ":d": "approve",
                ":r": notes or "Claim approved by reviewer",
                ":rev": timestamp,
                ":upd": timestamp,
            },
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise KeyError(f"Claim {claim_id} not found") from exc
        raise


def deny_claim(claim_id: str, reason: str) -> None:
    timestamp = utcnow_iso()
    try:
        _claims_table.update_item(
            Key={"claimId": claim_id},
            UpdateExpression="SET #s = :status, finalDecision = :d, decisionReason = :r, "
            "reviewedDate = :rev, lastUpdated = :upd",
            ConditionExpression="attribute_exists(claimId)",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":status": "denied",
                ":d": "deny",
                ":r": reason,
                ":rev": timestamp,
                ":upd": timestamp,
            },
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise KeyError(f"Claim {claim_id} not found") from exc
        raise


def reassign_claim(claim_id: str, to_reviewer_id: str) -> str:
    """Returns the previous assignee (or '' if unassigned)."""
    timestamp = utcnow_iso()
    resp = _claims_table.update_item(
        Key={"claimId": claim_id},
        UpdateExpression="SET assignedTo = :new, assignedDate = :d, lastUpdated = :u",
        ConditionExpression="attribute_exists(claimId)",
        ExpressionAttributeValues={
            ":new": to_reviewer_id,
            ":d": timestamp,
            ":u": timestamp,
        },
        ReturnValues="UPDATED_OLD",
    )
    return resp.get("Attributes", {}).get("assignedTo", "")
