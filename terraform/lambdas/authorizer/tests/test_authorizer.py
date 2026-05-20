import json
import sys
import types
from unittest.mock import patch, MagicMock

import pytest


@pytest.fixture(autouse=True)
def env_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv(
        "API_KEY_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:1:secret:t"
    )
    monkeypatch.setenv("POWERTOOLS_SERVICE_NAME", "authorizer-test")
    monkeypatch.setenv("POWERTOOLS_TRACE_DISABLED", "true")
    monkeypatch.setenv("POWERTOOLS_METRICS_NAMESPACE", "InsuranceClaims/Test")


@pytest.fixture
def lambda_context() -> object:
    ctx = types.SimpleNamespace()
    ctx.function_name = "test-fn"
    ctx.memory_limit_in_mb = 128
    ctx.invoked_function_arn = "arn:aws:lambda:us-east-1:123:function:test-fn"
    ctx.aws_request_id = "00000000-0000-0000-0000-000000000000"
    return ctx


def _event(token: str | None) -> dict:
    headers: dict = {}
    if token is not None:
        headers["authorization"] = f"Bearer {token}"
    return {
        "headers": headers,
        "requestContext": {
            "http": {"method": "POST", "path": "/foo"},
            "requestId": "r",
        },
    }


def _fresh_index(secret_token: str) -> object:
    """Reload index.py with a mocked Secrets Manager client returning the given token."""
    if "index" in sys.modules:
        del sys.modules["index"]
    sec = MagicMock()
    sec.get_secret_value.return_value = {
        "SecretString": json.dumps({"token": secret_token})
    }
    with patch("boto3.client", return_value=sec):
        import index  # type: ignore

        # Force the cache to be populated under the patched client
        index._cached_token = None
    return index


def test_no_token_unauthorized(lambda_context: object) -> None:
    idx = _fresh_index("right")
    result = idx.lambda_handler(_event(None), lambda_context)
    assert result == {"isAuthorized": False, "context": {}}


def test_correct_token_authorized(lambda_context: object) -> None:
    idx = _fresh_index("right")
    # patch boto3.client one more time when _load_token actually fires
    with patch.object(idx, "_secrets") as sec:
        sec.get_secret_value.return_value = {
            "SecretString": json.dumps({"token": "right"})
        }
        result = idx.lambda_handler(_event("right"), lambda_context)
    assert result["isAuthorized"] is True
    assert "principalId" in result["context"]


def test_wrong_token_unauthorized(lambda_context: object) -> None:
    idx = _fresh_index("right")
    with patch.object(idx, "_secrets") as sec:
        sec.get_secret_value.return_value = {
            "SecretString": json.dumps({"token": "right"})
        }
        result = idx.lambda_handler(_event("wrong"), lambda_context)
    assert result["isAuthorized"] is False
