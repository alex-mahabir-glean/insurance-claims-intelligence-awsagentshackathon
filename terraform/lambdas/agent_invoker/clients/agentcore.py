"""Bedrock AgentCore Runtime client wrapper."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import boto3
from botocore.config import Config

# Adaptive retry handles Bedrock 429s gracefully (closes part of REL-6 #16).
_client = boto3.client(
    "bedrock-agentcore",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    config=Config(
        connect_timeout=2,
        read_timeout=60,
        retries={"max_attempts": 5, "mode": "adaptive"},
    ),
)


def _normalize_session_id(session_id: str) -> str:
    """AgentCore Runtime requires a session_id of >= 33 chars."""
    if len(session_id) >= 33:
        return session_id
    return session_id + ("0" * (33 - len(session_id)))


def invoke(*, agent_arn: str, prompt: str, session_id: str | None = None) -> dict:
    if not session_id:
        session_id = (
            f"session-{int(datetime.now(timezone.utc).timestamp() * 1_000_000)}"
        )
    session_id = _normalize_session_id(session_id)

    payload = {"prompt": prompt}
    response = _client.invoke_agent_runtime(
        agentRuntimeArn=agent_arn,
        runtimeSessionId=session_id,
        contentType="application/json",
        accept="application/json",
        payload=str.encode(__import__("json").dumps(payload)),
    )

    body = response["response"].read().decode("utf-8")
    return {"sessionId": session_id, "response": body}
