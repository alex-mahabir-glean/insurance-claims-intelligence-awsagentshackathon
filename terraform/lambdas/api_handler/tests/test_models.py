import pytest
from pydantic import ValidationError

from models import SubmitClaimRequest


def _valid() -> dict:
    return {
        "claimantName": "Alice Adams",
        "claimantEmail": "alice@example.com",
        "policyNumber": "POL-1",
        "claimType": "vehicle",
        "incidentDate": "2026-04-01",
        "incidentDescription": "Hit and run on the freeway, multiple witnesses present.",
        "claimValue": 1500.0,
    }


def test_valid_payload_parses() -> None:
    SubmitClaimRequest(**_valid())


def test_invalid_email_rejected() -> None:
    bad = _valid()
    bad["claimantEmail"] = "not-an-email"
    with pytest.raises(ValidationError):
        SubmitClaimRequest(**bad)


def test_invalid_claim_type_rejected() -> None:
    bad = _valid()
    bad["claimType"] = "weather"
    with pytest.raises(ValidationError):
        SubmitClaimRequest(**bad)


def test_invalid_iso_date_rejected() -> None:
    bad = _valid()
    bad["incidentDate"] = "04-01-2026"
    with pytest.raises(ValidationError):
        SubmitClaimRequest(**bad)


def test_negative_claim_value_rejected() -> None:
    bad = _valid()
    bad["claimValue"] = -1
    with pytest.raises(ValidationError):
        SubmitClaimRequest(**bad)


def test_short_description_rejected() -> None:
    bad = _valid()
    bad["incidentDescription"] = "tiny"
    with pytest.raises(ValidationError):
        SubmitClaimRequest(**bad)
