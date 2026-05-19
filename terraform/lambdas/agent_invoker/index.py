"""agent_invoker — single Lambda routing 2 agent-invocation endpoints.

Routes:
  POST /invoke-intake-agent   -> Intake agent ARN from env INTAKE_AGENT_ARN
  POST /invoke-review-agent   -> Review agent ARN from env REVIEW_AGENT_ARN

IAM scoping: this Lambda has bedrock-agentcore:InvokeAgentRuntime on the
two agent ARNs only — no DynamoDB, no other Bedrock — to keep the blast
radius tight (supports SEC-4 #4 by construction).
"""

from __future__ import annotations

import json
import os
from typing import Any

from aws_lambda_powertools import Logger, Metrics, Tracer
from aws_lambda_powertools.event_handler import (
    APIGatewayHttpResolver,
    Response,
    content_types,
)
from aws_lambda_powertools.event_handler.exceptions import ServiceError
from aws_lambda_powertools.logging import correlation_paths
from pydantic import BaseModel, Field, ValidationError

from clients import agentcore

logger = Logger()
tracer = Tracer()
metrics = Metrics()
app = APIGatewayHttpResolver()

INTAKE_AGENT_ARN = os.environ.get("INTAKE_AGENT_ARN", "")
REVIEW_AGENT_ARN = os.environ.get("REVIEW_AGENT_ARN", "")


class InvokeAgentRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10_000)
    sessionId: str | None = Field(default=None, max_length=200)


def _ok(body: dict[str, Any]) -> Response:
    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps({"success": True, **body}),
    )


def _bad_request(field_errors: list[dict[str, Any]]) -> Response:
    return Response(
        status_code=400,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"success": False, "error": "validation_failed", "details": field_errors}
        ),
    )


def _invoke(*, route: str, agent_arn: str) -> Response:
    if not agent_arn:
        logger.error("agent_arn env var not set", extra={"route": route})
        raise ServiceError(500, "Agent ARN not configured")

    body = app.current_event.json_body or {}
    try:
        payload = InvokeAgentRequest(**body)
    except ValidationError as exc:
        return _bad_request(exc.errors())

    try:
        result = agentcore.invoke(
            agent_arn=agent_arn,
            prompt=payload.prompt,
            session_id=payload.sessionId,
        )
    except Exception as exc:
        # Powertools surfaces the correlation id; full traceback goes to CloudWatch.
        logger.exception("agentcore invocation failed", extra={"route": route})
        raise ServiceError(502, "Failed to invoke agent") from exc

    metrics.add_metric(name=f"AgentInvoked.{route}", unit="Count", value=1)
    return _ok(result)


@app.post("/invoke-intake-agent")
def post_intake() -> Response:
    return _invoke(route="intake", agent_arn=INTAKE_AGENT_ARN)


@app.post("/invoke-review-agent")
def post_review() -> Response:
    return _invoke(route="review", agent_arn=REVIEW_AGENT_ARN)


@logger.inject_lambda_context(correlation_id_path=correlation_paths.API_GATEWAY_HTTP)
@tracer.capture_lambda_handler
@metrics.log_metrics
def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return app.resolve(event, context)
