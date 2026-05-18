"""Pydantic schemas for the api_handler routes.

These match the OpenAPI specs in glean/openapi-*.json. Validation happens
at request entry; malformed payloads return 400 before any DDB access
(closes SEC-7 #7 + PERF-3 #25 inside the Lambda since HTTP API v2 has
no built-in request validators).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

ClaimType = Literal["vehicle", "property", "liability", "health"]


class SubmitClaimRequest(BaseModel):
    claimantName: str = Field(min_length=1, max_length=200)
    claimantEmail: EmailStr
    claimantPhone: str | None = Field(default=None, max_length=50)
    claimantAddress: str | None = Field(default=None, max_length=500)
    policyNumber: str = Field(min_length=1, max_length=50)
    claimType: ClaimType
    incidentDate: str  # YYYY-MM-DD; validated below
    incidentDescription: str = Field(min_length=10, max_length=5000)
    claimValue: float = Field(gt=0, lt=10_000_000)
    policeReport: str | None = Field(default=None, max_length=200)
    injuries: bool = False
    injuryDescription: str | None = Field(default=None, max_length=5000)

    @field_validator("incidentDate")
    @classmethod
    def _validate_iso_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("incidentDate must be ISO date YYYY-MM-DD") from exc
        return v


class ApproveClaimRequest(BaseModel):
    claimId: str = Field(min_length=1, max_length=100)
    reviewerId: str = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)


class DenyClaimRequest(BaseModel):
    claimId: str = Field(min_length=1, max_length=100)
    reviewerId: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=2000)


class ReassignClaimRequest(BaseModel):
    claimId: str = Field(min_length=1, max_length=100)
    fromReviewerId: str | None = Field(default=None, max_length=100)
    toReviewerId: str = Field(min_length=1, max_length=100)
    reason: str | None = Field(default=None, max_length=2000)
