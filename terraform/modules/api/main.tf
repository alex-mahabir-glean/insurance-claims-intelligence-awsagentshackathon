# ============================================================================
# HTTP API v2 — chosen over REST API per locked design decision:
# - ~70% cheaper per request
# - Native CORS at API level (single source of truth, closes SEC-1 #1)
# - Native JWT authorizer support for the future SEC-2 swap
# - No mock integrations needed (HTTP API CORS handles OPTIONS automatically)
#
# 2 Lambda integrations (api_handler + agent_invoker) + 1 authorizer
# (Option B Lambda topology from TF-3).
# ============================================================================

resource "aws_apigatewayv2_api" "this" {
  name          = "LegalServiceManagementAPI-${var.deployment_id}"
  protocol_type = "HTTP"
  description   = "Insurance Claims Intelligence — HTTP API v2 (TF-4)"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["Content-Type", "Authorization", "X-Api-Key", "X-Amz-Date", "X-Amz-Security-Token"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = var.allowed_origins
    expose_headers    = ["Content-Type"]
    max_age           = 600
  }

  tags = var.tags
}

# ============================================================================
# Authorizer (preserves shared-bearer auth — SEC-2 follow-up swaps to JWT)
# ============================================================================

resource "aws_apigatewayv2_authorizer" "request" {
  api_id                            = aws_apigatewayv2_api.this.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = var.authorizer_invoke_arn
  identity_sources                  = ["$request.header.Authorization"]
  name                              = "shared-bearer"
  authorizer_payload_format_version = "2.0"
  authorizer_result_ttl_in_seconds  = var.authorizer_result_ttl_seconds
  enable_simple_responses           = true
}

resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowExecutionFromAPIGatewayAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.authorizer_lambda_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.request.id}"
}

# ============================================================================
# Integrations (2 Lambdas)
# ============================================================================

resource "aws_apigatewayv2_integration" "api_handler" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.api_handler_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_integration" "agent_invoker" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.agent_invoker_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_lambda_permission" "api_handler" {
  statement_id  = "AllowExecutionFromAPIGatewayApiHandler"
  action        = "lambda:InvokeFunction"
  function_name = var.api_handler_lambda_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_lambda_permission" "agent_invoker" {
  statement_id  = "AllowExecutionFromAPIGatewayAgentInvoker"
  action        = "lambda:InvokeFunction"
  function_name = var.agent_invoker_lambda_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# ============================================================================
# Routes — every PII-bearing route requires the authorizer (closes SEC-3 #3).
# ============================================================================

locals {
  # Map route key -> integration. All routes use the request authorizer.
  api_handler_routes = {
    "POST /submit-claim"    = "api_handler"
    "GET /claims"           = "api_handler"
    "GET /claims/{claimId}" = "api_handler"
    "POST /approve-claim"   = "api_handler"
    "POST /deny-claim"      = "api_handler"
    "POST /reassign-claim"  = "api_handler"
  }

  agent_invoker_routes = {
    "POST /invoke-intake-agent" = "agent_invoker"
    "POST /invoke-review-agent" = "agent_invoker"
  }
}

resource "aws_apigatewayv2_route" "api_handler" {
  for_each = local.api_handler_routes

  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.api_handler.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.request.id
}

resource "aws_apigatewayv2_route" "agent_invoker" {
  for_each = local.agent_invoker_routes

  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.agent_invoker.id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.request.id
}

# ============================================================================
# Stage with access logging + per-route throttling
# ============================================================================

resource "aws_cloudwatch_log_group" "access_logs" {
  name              = "/aws/apigateway/LegalServiceManagementAPI-${var.deployment_id}/${var.stage_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.default_route_burst_limit
    throttling_rate_limit  = var.default_route_rate_limit
  }

  # Per-route throttling on agent invoke endpoints (cost protection)
  dynamic "route_settings" {
    for_each = local.agent_invoker_routes
    content {
      route_key              = route_settings.key
      throttling_burst_limit = var.agent_route_burst_limit
      throttling_rate_limit  = var.agent_route_rate_limit
    }
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access_logs.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      routeKey           = "$context.routeKey"
      status             = "$context.status"
      protocol           = "$context.protocol"
      responseLength     = "$context.responseLength"
      integrationLatency = "$context.integrationLatency"
      authorizer         = "$context.authorizer.principalId"
    })
  }

  tags = var.tags
}

# ============================================================================
# Optional WAF (opt-in per locked design decision)
# ============================================================================

resource "aws_wafv2_web_acl" "this" {
  count = var.enable_waf ? 1 : 0

  name        = "LegalServiceManagementAPI-${var.deployment_id}"
  description = "WAF for Insurance Claims Intelligence API"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ApiWAF-${var.deployment_id}"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_wafv2_web_acl_association" "this" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_apigatewayv2_stage.this.arn
  web_acl_arn  = aws_wafv2_web_acl.this[0].arn
}
