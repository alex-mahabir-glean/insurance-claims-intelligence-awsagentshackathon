"""Tests for agent_invoker validation and the agentcore client wrapper."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

# These tests focus on the agentcore client wrapper, not the full Powertools
# event resolver (which is fiddly under pytest+moto). The route handlers in
# index.py are thin wrappers around clients.agentcore.invoke().


@pytest.fixture(autouse=True)
def env_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("INTAKE_AGENT_ARN", "")
    monkeypatch.setenv("REVIEW_AGENT_ARN", "")
    monkeypatch.setenv("POWERTOOLS_SERVICE_NAME", "agent_invoker-test")
    monkeypatch.setenv("POWERTOOLS_TRACE_DISABLED", "true")
    monkeypatch.setenv("POWERTOOLS_METRICS_NAMESPACE", "InsuranceClaims/Test")


def test_session_id_is_padded_to_min_length() -> None:
    """AgentCore Runtime requires runtimeSessionId >= 33 chars."""
    from clients.agentcore import _normalize_session_id  # type: ignore

    assert len(_normalize_session_id("short")) == 33
    assert _normalize_session_id("short").startswith("short")
    assert len(_normalize_session_id("a" * 50)) == 50  # already long enough


def test_invoke_calls_bedrock_with_expected_args() -> None:
    """The agentcore wrapper assembles the right invoke_agent_runtime call."""
    from clients import agentcore

    fake_response = {"response": MagicMock()}
    fake_response["response"].read.return_value = b'{"hello":"world"}'

    with patch.object(agentcore._client, "invoke_agent_runtime", return_value=fake_response) as mock:
        result = agentcore.invoke(
            agent_arn="arn:aws:bedrock-agentcore:us-east-1:1:runtime/x",
            prompt="hello",
            session_id="my-session",
        )
        mock.assert_called_once()
        kwargs = mock.call_args.kwargs
        assert kwargs["agentRuntimeArn"] == "arn:aws:bedrock-agentcore:us-east-1:1:runtime/x"
        assert kwargs["contentType"] == "application/json"
        assert kwargs["accept"] == "application/json"
        # session id is padded
        assert len(kwargs["runtimeSessionId"]) == 33
        # payload is JSON with our prompt
        import json as _json
        sent = _json.loads(kwargs["payload"].decode())
        assert sent == {"prompt": "hello"}

    assert result["response"] == '{"hello":"world"}'


def test_invoke_generates_session_id_when_missing() -> None:
    """If no session_id is given, a generated one is returned in the response."""
    from clients import agentcore

    fake_response = {"response": MagicMock()}
    fake_response["response"].read.return_value = b"{}"

    with patch.object(agentcore._client, "invoke_agent_runtime", return_value=fake_response):
        result = agentcore.invoke(
            agent_arn="arn:aws:bedrock-agentcore:us-east-1:1:runtime/x",
            prompt="hi",
        )

    assert result["sessionId"].startswith("session-")
    assert len(result["sessionId"]) >= 33
