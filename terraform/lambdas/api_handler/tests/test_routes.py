"""Service-level tests against moto-backed DynamoDB.

We test services directly rather than going through the Powertools
APIGatewayHttpResolver because the resolver+pytest+moto combination is
notoriously fiddly. All actual business logic lives in services/, and the
route handlers are thin wrappers that:
  1. Validate via Pydantic (covered in test_models.py)
  2. Call the service
  3. Format the response
The route layer is exercised via integration tests during deploy verification.
"""
from __future__ import annotations

import pytest

from services import audit, claims, reviewers


@pytest.fixture
def sample_claim_payload() -> dict:
    return {
        "claimantName": "Alice Adams",
        "claimantEmail": "alice@example.com",
        "claimantPhone": "",
        "claimantAddress": "",
        "policyNumber": "POL-1",
        "claimType": "vehicle",
        "incidentDate": "2026-04-01",
        "incidentDescription": "Hit and run on the freeway, witnesses present.",
        "claimValue": 1500.0,
        "policeReport": None,
        "injuries": False,
        "injuryDescription": None,
    }


def test_generate_claim_id_is_unique() -> None:
    """REL-4 #14: sub-second collisions impossible due to UUID hex suffix."""
    ids = {claims.generate_claim_id() for _ in range(1000)}
    assert len(ids) == 1000, "claim IDs must be unique even at high volume"
    assert all(cid.startswith("CL-") for cid in ids)


def test_submit_claim_writes_record(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    result = claims.submit_claim(sample_claim_payload)
    assert result["claimId"].startswith("CL-")
    assert result["status"] == "submitted"

    stored = claims.get_claim(result["claimId"])
    assert stored is not None
    assert stored["claimantInfo"]["name"] == "Alice Adams"
    assert stored["claimantInfo"]["email"] == "alice@example.com"
    assert stored["status"] == "submitted"
    assert stored["claimType"] == "vehicle"


def test_submit_claim_rejects_overwrite(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    """ConditionExpression closes the put-item-overwrite hole flagged in REL-4."""
    from botocore.exceptions import ClientError

    result = claims.submit_claim(sample_claim_payload)
    # Generate the SAME ID and try to insert; should fail
    import services.claims as cm

    original = cm.generate_claim_id

    def _force_same_id() -> str:
        return result["claimId"]

    cm.generate_claim_id = _force_same_id  # type: ignore[assignment]
    try:
        with pytest.raises(ClientError) as exc:
            claims.submit_claim(sample_claim_payload)
        assert exc.value.response["Error"]["Code"] == "ConditionalCheckFailedException"
    finally:
        cm.generate_claim_id = original  # type: ignore[assignment]


def test_approve_unknown_claim_raises(dynamo_tables: object) -> None:  # noqa: ARG001
    with pytest.raises(KeyError):
        claims.approve_claim("CL-DOES-NOT-EXIST", "approved")


def test_approve_then_get_reflects_status(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    submitted = claims.submit_claim(sample_claim_payload)
    claims.approve_claim(submitted["claimId"], "Looks fine")

    stored = claims.get_claim(submitted["claimId"])
    assert stored is not None
    assert stored["status"] == "approved"
    assert stored["finalDecision"] == "approve"
    assert stored["decisionReason"] == "Looks fine"


def test_deny_then_get_reflects_status(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    submitted = claims.submit_claim(sample_claim_payload)
    claims.deny_claim(submitted["claimId"], "Insufficient documentation")

    stored = claims.get_claim(submitted["claimId"])
    assert stored is not None
    assert stored["status"] == "denied"
    assert stored["decisionReason"] == "Insufficient documentation"


def test_reassign_returns_previous_assignee(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    submitted = claims.submit_claim(sample_claim_payload)

    prev = claims.reassign_claim(submitted["claimId"], "sarah-chen")
    assert prev == ""  # No previous assignee

    prev2 = claims.reassign_claim(submitted["claimId"], "mike-torres")
    assert prev2 == "sarah-chen"


def test_list_claims_filters_by_status(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    """PERF-1 #23: list_claims uses Query on StatusIndex, not Scan."""
    s1 = claims.submit_claim(sample_claim_payload)
    s2 = claims.submit_claim(sample_claim_payload)
    claims.approve_claim(s1["claimId"], "approved")
    # s2 left as submitted

    submitted_only = claims.list_claims(status="submitted")
    submitted_ids = {c["claimId"] for c in submitted_only}
    assert s2["claimId"] in submitted_ids
    assert s1["claimId"] not in submitted_ids

    approved_only = claims.list_claims(status="approved")
    approved_ids = {c["claimId"] for c in approved_only}
    assert s1["claimId"] in approved_ids
    assert s2["claimId"] not in approved_ids


def test_list_claims_filters_by_reviewer(dynamo_tables: object, sample_claim_payload: dict) -> None:  # noqa: ARG001
    s = claims.submit_claim(sample_claim_payload)
    claims.reassign_claim(s["claimId"], "sarah-chen")

    sarahs = claims.list_claims(reviewer_id="sarah-chen")
    assert len(sarahs) == 1
    assert sarahs[0]["claimId"] == s["claimId"]


def test_audit_record_writes_with_no_ttl_by_default(dynamo_tables: object) -> None:
    audit.record(
        claim_id="CL-T",
        action="test_action",
        actor="test-actor",
        actor_type="reviewer",
        details={"key": "value"},
    )

    table = dynamo_tables.Table("TestAudit")
    items = table.scan()["Items"]
    assert len(items) == 1
    assert items[0]["claimId"] == "CL-T"
    assert items[0]["action"] == "test_action"
    assert "expires_at" not in items[0]  # TTL opt-in only


def test_reviewer_display_name_falls_back_to_id(dynamo_tables: object) -> None:  # noqa: ARG001
    """Closes OPS-6 #22: display names sourced from DDB, not hardcoded dict."""
    name = reviewers.get_display_name("sarah-chen")
    assert name == "Sarah Chen"

    fallback = reviewers.get_display_name("unknown-id")
    assert fallback == "unknown-id"
