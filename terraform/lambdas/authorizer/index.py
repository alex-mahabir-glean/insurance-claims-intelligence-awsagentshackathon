"""HTTP API v2 REQUEST authorizer.

Validates a bearer token against the value in Secrets Manager (LegalService/AgentCoreApiToken/<deployment_id>).
Token is cached in module-global state for the warm container's lifetime.

Note: the token is rotatable but rotation requires a Lambda cold start to pick up.
SEC-2 (#2) replaces this with Cognito JWT in a follow-up.

HTTP API v2 simple authorizer response: {"isAuthorized": bool, "context": {...}}
"""

from __future__ import annotations

import json
import os
from typing import Any

import boto3
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging import correlation_paths

logger = Logger()

_secrets = boto3.client("secretsmanager")
_api_key_secret_arn = os.environ["API_KEY_SECRET_ARN"]
_cached_token: str | None = None


def _load_token() -> str:
    global _cached_token
    if _cached_token is None:
        resp = _secrets.get_secret_value(SecretId=_api_key_secret_arn)
        _cached_token = json.loads(resp["SecretString"])["token"]
        logger.info("loaded API token from Secrets Manager")
    return _cached_token


def _extract_token(event: dict[str, Any]) -> str | None:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}

    # Prefer x-api-key, fall back to Authorization: Bearer ...
    if "x-api-key" in headers:
        return headers["x-api-key"]

    auth = headers.get("authorization")
    if auth:
        parts = auth.split(" ", 1)
        return parts[1] if len(parts) == 2 else parts[0]

    return None


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    presented = _extract_token(event)
    if not presented:
        logger.info("no token presented")
        return {"isAuthorized": False, "context": {}}

    expected = _load_token()
    is_authorized = presented == expected

    if not is_authorized:
        logger.info("token mismatch")

    # principal_id is informative; HTTP API v2 doesn't enforce IAM via the authorizer
    return {
        "isAuthorized": is_authorized,
        "context": {
            "principalId": f"user-{presented[:8]}" if presented else "anon",
        },
    }
