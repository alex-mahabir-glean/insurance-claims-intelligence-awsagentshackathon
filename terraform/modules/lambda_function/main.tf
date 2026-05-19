# ============================================================================
# Reusable Lambda function with sensible defaults:
# - CloudWatch log group with retention (closes COST-1)
# - SQS DLQ (closes part of REL-6)
# - X-Ray tracing
# - AWS-managed Powertools layer (provides Logger, Tracer, Metrics, Pydantic)
# - Optional alarms wired to a shared SNS topic (closes part of OPS-5)
# ============================================================================

# Package the handler source as a zip
data "archive_file" "this" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${path.module}/.build/${var.name}.zip"
  excludes = [
    "tests",
    "__pycache__",
    ".pytest_cache",
    "*.pyc",
  ]
}

# IAM role
resource "aws_iam_role" "this" {
  name = "${var.name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "scoped" {
  count = var.inline_policy_json == null ? 0 : 1

  name   = "${var.name}-scoped"
  role   = aws_iam_role.this.id
  policy = var.inline_policy_json
}

resource "aws_iam_role_policy" "dlq" {
  name = "${var.name}-dlq"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage"]
      Resource = aws_sqs_queue.dlq.arn
    }]
  })
}

# Log group (created explicitly so we control retention)
resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Dead-letter queue
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name}-dlq"
  message_retention_seconds = 1209600 # 14 days

  # Encryption at rest with the AWS-managed SQS key (free; no perms to manage).
  # Customer can swap to a CMK if compliance requires.
  kms_master_key_id = "alias/aws/sqs"

  tags = var.tags
}

# Lambda function
resource "aws_lambda_function" "this" {
  function_name = var.name
  role          = aws_iam_role.this.arn
  runtime       = var.runtime
  handler       = var.handler
  memory_size   = var.memory_size
  timeout       = var.timeout

  filename         = data.archive_file.this.output_path
  source_code_hash = data.archive_file.this.output_base64sha256

  layers = concat([var.powertools_layer_arn], var.extra_layers)

  environment {
    variables = var.environment
  }

  dead_letter_config {
    target_arn = aws_sqs_queue.dlq.arn
  }

  tracing_config {
    mode = var.tracing_mode
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.this,
    aws_iam_role_policy_attachment.basic_execution,
  ]
}

# Optional alarms (skipped when alert_topic_arn is null)
resource "aws_cloudwatch_metric_alarm" "errors" {
  count = var.alert_topic_arn == null ? 0 : 1

  alarm_name          = "${var.name}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.this.function_name
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "throttles" {
  count = var.alert_topic_arn == null ? 0 : 1

  alarm_name          = "${var.name}-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.this.function_name
  }

  alarm_actions = [var.alert_topic_arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "duration_p99" {
  count = var.alert_topic_arn == null ? 0 : 1

  alarm_name          = "${var.name}-duration-p99"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p99"
  threshold           = var.duration_p99_threshold_ms
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.this.function_name
  }

  alarm_actions = [var.alert_topic_arn]

  tags = var.tags
}
