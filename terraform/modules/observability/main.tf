# ============================================================================
# Alert SNS topic + email subscription
# ============================================================================

resource "aws_sns_topic" "alerts" {
  name = "InsuranceClaims-Alerts-${var.deployment_id}"

  # Encryption at rest with the AWS-managed SNS key (free).
  # Customer can swap to a CMK if compliance requires.
  kms_master_key_id = "alias/aws/sns"

  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alert_email == null ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ============================================================================
# Per-Lambda alarms (errors, throttles, p99 duration)
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.lambdas

  alarm_name          = "${each.value}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = var.lambdas

  alarm_name          = "${each.value}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p99" {
  for_each = var.lambdas

  alarm_name          = "${each.value}-duration-p99"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p99"
  threshold           = var.duration_p99_threshold_ms
  treat_missing_data  = "notBreaching"

  dimensions = { FunctionName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ============================================================================
# API Gateway alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "InsuranceClaims-Api-5xx-${var.deployment_id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_4xx" {
  alarm_name          = "InsuranceClaims-Api-4xx-${var.deployment_id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_integration_latency_p99" {
  alarm_name          = "InsuranceClaims-Api-IntegrationLatency-p99-${var.deployment_id}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "IntegrationLatency"
  namespace           = "AWS/ApiGateway"
  period              = 300
  extended_statistic  = "p99"
  threshold           = 5000
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiId = var.api_id
    Stage = var.api_stage_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ============================================================================
# DynamoDB alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "ddb_user_errors" {
  for_each = var.table_names

  alarm_name          = "${each.value}-UserErrors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ddb_throttled" {
  for_each = var.table_names

  alarm_name          = "${each.value}-ThrottledRequests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = { TableName = each.value }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ============================================================================
# Bedrock spend budget (optional — set monthly_bedrock_budget_usd = 0 to skip)
# ============================================================================

resource "aws_budgets_budget" "bedrock" {
  count = var.monthly_bedrock_budget_usd > 0 ? 1 : 0

  name         = "InsuranceClaims-BedrockSpend-${var.deployment_id}"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_bedrock_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Bedrock"]
  }

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator       = "GREATER_THAN"
      threshold                 = notification.value
      threshold_type            = "PERCENTAGE"
      notification_type         = "ACTUAL"
      subscriber_sns_topic_arns = [aws_sns_topic.alerts.arn]
    }
  }
}

# ============================================================================
# Dashboard (single pane covering Lambda + API + DDB + AgentCore)
# ============================================================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "InsuranceClaims-${var.deployment_id}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda errors (5min sum, all functions)"
          region = data.aws_region.current.name
          metrics = [
            for fn_name in values(var.lambdas) :
            ["AWS/Lambda", "Errors", "FunctionName", fn_name, { stat = "Sum" }]
          ]
          view    = "timeSeries"
          stacked = false
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda duration p99 (5min)"
          region = data.aws_region.current.name
          metrics = [
            for fn_name in values(var.lambdas) :
            ["AWS/Lambda", "Duration", "FunctionName", fn_name, { stat = "p99" }]
          ]
          view   = "timeSeries"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "API Gateway 4xx / 5xx (5min sum)"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "4xx", "ApiId", var.api_id, "Stage", var.api_stage_name, { stat = "Sum" }],
            ["AWS/ApiGateway", "5xx", "ApiId", var.api_id, "Stage", var.api_stage_name, { stat = "Sum" }],
          ]
          view   = "timeSeries"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "DynamoDB throttling + errors (5min sum)"
          region = data.aws_region.current.name
          metrics = concat(
            [for table_name in values(var.table_names) :
              ["AWS/DynamoDB", "ThrottledRequests", "TableName", table_name, { stat = "Sum" }]
            ],
            [for table_name in values(var.table_names) :
              ["AWS/DynamoDB", "UserErrors", "TableName", table_name, { stat = "Sum" }]
            ],
          )
          view   = "timeSeries"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "Custom metrics — claim throughput (Powertools EMF)"
          region = data.aws_region.current.name
          metrics = [
            ["InsuranceClaims/ApiHandler", "ClaimSubmitted", { stat = "Sum" }],
            [".", "ClaimApproved", { stat = "Sum" }],
            [".", "ClaimDenied", { stat = "Sum" }],
            [".", "ClaimReassigned", { stat = "Sum" }],
          ]
          view   = "timeSeries"
          period = 300
        }
      },
    ]
  })
}

data "aws_region" "current" {}

# ============================================================================
# Saved Log Insights queries (handy starter set)
# ============================================================================

resource "aws_cloudwatch_query_definition" "errors_by_route" {
  name = "InsuranceClaims/${var.deployment_id}/errors-by-route"

  log_group_names = [
    "/aws/lambda/LegalService-ApiHandler-${var.deployment_id}",
    "/aws/lambda/LegalService-AgentInvoker-${var.deployment_id}",
  ]

  query_string = <<-Q
    fields @timestamp, level, message, route_key, correlation_id
    | filter level = "ERROR"
    | sort @timestamp desc
    | limit 100
  Q
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  name = "InsuranceClaims/${var.deployment_id}/slow-requests"

  log_group_names = [
    "/aws/lambda/LegalService-ApiHandler-${var.deployment_id}",
    "/aws/lambda/LegalService-AgentInvoker-${var.deployment_id}",
  ]

  query_string = <<-Q
    fields @timestamp, @duration, function_name, message, correlation_id
    | filter @type = "REPORT"
    | sort @duration desc
    | limit 50
  Q
}

resource "aws_cloudwatch_query_definition" "agent_invocations" {
  name = "InsuranceClaims/${var.deployment_id}/agent-invocations"

  log_group_names = [
    "/aws/lambda/LegalService-AgentInvoker-${var.deployment_id}",
  ]

  query_string = <<-Q
    fields @timestamp, level, message, route, correlation_id
    | filter message like /agentcore/
    | sort @timestamp desc
    | limit 100
  Q
}
