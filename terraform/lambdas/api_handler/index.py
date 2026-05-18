"""api_handler — single Lambda routing 6 CRUD endpoints via Powertools.

Routes:
  POST   /submit-claim
  GET    /claims
  GET    /claims/{claimId}
  POST   /approve-claim
  POST   /deny-claim
  POST   /reassign-claim

Validation: Pydantic models in models.py reject malformed payloads with 400
before any DynamoDB access (closes SEC-7 #7 + PERF-3 #25).
IAM scoping: this Lambda has DynamoDB access only — no Bedrock — to keep
the blast radius tight (supports SEC-4 #4 by construction).
"""
from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from aws_lambda_powertools import Logger, Metrics, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response, content_types
from aws_lambda_powertools.event_handler.exceptions import (
    BadRequestError,
    NotFoundError,
)
from aws_lambda_powertools.logging import correlation_paths
from pydantic import ValidationError

from models import (
    ApproveClaimRequest,
    DenyClaimRequest,
    ReassignClaimRequest,
    SubmitClaimRequest,
)
from services import audit, claims, reviewers

logger = Logger()
tracer = Tracer()
metrics = Metrics()
app = APIGatewayHttpResolver()


class _DecimalSafeEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, Decimal):
            return str(o)
        return super().default(o)


def _ok(body: dict[str, Any], status: int = 200) -> Response:
    return Response(
        status_code=status,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps({"success": True, **body}, cls=_DecimalSafeEncoder),
    )


def _bad_request(field_errors: list[dict[str, Any]]) -> Response:
    return Response(
        status_code=400,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps({"success": False, "error": "validation_failed", "details": field_errors}),
    )


@app.post("/submit-claim")
def post_submit_claim() -> Response:
    body = app.current_event.json_body or {}
    try:
        payload = SubmitClaimRequest(**body)
    except ValidationError as exc:
        logger.info("submit_claim validation failed", extra={"errors": exc.errors()})
        return _bad_request(exc.errors())

    result = claims.submit_claim(payload.model_dump())
    audit.record(
        claim_id=result["claimId"],
        action="claim_submitted",
        actor=payload.claimantEmail,
        actor_type="claimant",
        details={"claimType": payload.claimType, "claimValue": str(payload.claimValue)},
    )
    metrics.add_metric(name="ClaimSubmitted", unit="Count", value=1)
    logger.info("submitted claim", extra={"claim_id": result["claimId"]})
    return _ok({"claimId": result["claimId"], "status": result["status"]})


@app.get("/claims")
def get_list_claims() -> Response:
    qs = app.current_event.query_string_parameters or {}
    items = claims.list_claims(reviewer_id=qs.get("reviewerId"), status=qs.get("status"))

    # Decorate with display names (closes OPS-6 #22 by sourcing from DDB instead of hardcoded dict)
    for c in items:
        if c.get("assignedTo"):
            c["assignedToName"] = reviewers.get_display_name(c["assignedTo"])

    return _ok({"claims": items, "count": len(items)})


@app.get("/claims/<claim_id>")
def get_one_claim(claim_id: str) -> Response:
    item = claims.get_claim(claim_id)
    if item is None:
        raise NotFoundError("Claim not found")
    if item.get("assignedTo"):
        item["assignedToName"] = reviewers.get_display_name(item["assignedTo"])
    return _ok({"claim": item})


@app.post("/approve-claim")
def post_approve() -> Response:
    body = app.current_event.json_body or {}
    try:
        payload = ApproveClaimRequest(**body)
    except ValidationError as exc:
        return _bad_request(exc.errors())

    try:
        claims.approve_claim(payload.claimId, payload.notes or "")
    except KeyError as exc:
        raise NotFoundError(str(exc)) from exc

    audit.record(
        claim_id=payload.claimId,
        action="claim_approved",
        actor=payload.reviewerId,
        actor_type="reviewer",
        details={"notes": payload.notes or ""},
    )
    metrics.add_metric(name="ClaimApproved", unit="Count", value=1)
    return _ok({"claimId": payload.claimId, "status": "approved"})


@app.post("/deny-claim")
def post_deny() -> Response:
    body = app.current_event.json_body or {}
    try:
        payload = DenyClaimRequest(**body)
    except ValidationError as exc:
        return _bad_request(exc.errors())

    try:
        claims.deny_claim(payload.claimId, payload.reason)
    except KeyError as exc:
        raise NotFoundError(str(exc)) from exc

    audit.record(
        claim_id=payload.claimId,
        action="claim_denied",
        actor=payload.reviewerId,
        actor_type="reviewer",
        details={"reason": payload.reason},
    )
    metrics.add_metric(name="ClaimDenied", unit="Count", value=1)
    return _ok({"claimId": payload.claimId, "status": "denied"})


@app.post("/reassign-claim")
def post_reassign() -> Response:
    body = app.current_event.json_body or {}
    try:
        payload = ReassignClaimRequest(**body)
    except ValidationError as exc:
        return _bad_request(exc.errors())

    # Verify the reviewer exists (closes part of OPS-6 #22 by checking DDB, not a static dict)
    target = reviewers.get_reviewer(payload.toReviewerId)
    if target is None:
        raise BadRequestError(f"Reviewer {payload.toReviewerId} not found")

    try:
        prev_assignee = claims.reassign_claim(payload.claimId, payload.toReviewerId)
    except Exception as exc:
        if "ConditionalCheckFailedException" in str(exc):
            raise NotFoundError(f"Claim {payload.claimId} not found") from exc
        raise

    audit.record(
        claim_id=payload.claimId,
        action="claim_reassigned",
        actor=prev_assignee or "system",
        actor_type="reviewer",
        details={
            "fromReviewer": prev_assignee,
            "toReviewer": payload.toReviewerId,
            "reason": payload.reason or "Reassignment requested",
        },
    )
    metrics.add_metric(name="ClaimReassigned", unit="Count", value=1)
    return _ok(
        {
            "claimId": payload.claimId,
            "assignedTo": payload.toReviewerId,
            "assignedToName": target.get("displayName", payload.toReviewerId),
        }
    )


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
@metrics.log_metrics
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return app.resolve(event, context)
