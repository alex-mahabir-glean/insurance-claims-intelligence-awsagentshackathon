# ============================================================================
# AgentCore Runtime via null_resource + external data source.
#
# The agentcore CLI is pre-1.0; the Terraform provider for AgentCore Runtime
# is still maturing. Until the native resource lands, this module wraps the
# CLI and reads the resulting ARN from .bedrock_agentcore.yaml.
#
# Locked design decisions:
# - Laptop-only execution (TF-7 CI does NOT run agentcore launch)
# - Memory disabled (agentcore configure --disable-memory)
# - IAM scoped to specific Bedrock model ARNs (closes SEC-4 #4)
# - Re-launch trigger is filesha256(agent.py) + filesha256(requirements.txt)
# ============================================================================

data "aws_caller_identity" "current" {}

# Execution role for AgentCore Runtime — scoped to specific resources only.
resource "aws_iam_role" "agentcore" {
  name = "LegalService-AgentCoreRuntimeRole-${var.deployment_id}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock-agentcore.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "dynamodb" {
  name = "DynamoDBAccess"
  role = aws_iam_role.agentcore.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
      ]
      Resource = concat(
        [
          var.claims_table_arn,
          var.reviewers_table_arn,
          var.audit_trail_table_arn,
        ],
        var.claims_table_index_arns,
      )
    }]
  })
}

resource "aws_iam_role_policy" "bedrock" {
  name = "BedrockAccess"
  role = aws_iam_role.agentcore.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ]
      # Scoped to specific foundation model ARNs — closes SEC-4 #4 part 1.
      # Inference profile ARNs included to support cross-region inference if enabled.
      Resource = concat(
        [for m in var.bedrock_model_ids : "arn:aws:bedrock:${var.aws_region}::foundation-model/${m}"],
        ["arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:inference-profile/*"],
      )
    }]
  })
}

resource "aws_iam_role_policy" "kms" {
  name = "KMSAccess"
  role = aws_iam_role.agentcore.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
      Resource = var.kms_key_arn
    }]
  })
}

resource "aws_iam_role_policy" "logs" {
  name = "LogsAndTracing"
  role = aws_iam_role.agentcore.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/bedrock-agentcore/runtimes/*"
      },
      {
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets"]
        Resource = "*" # X-Ray actions cannot be scoped to specific resources
      },
      {
        Effect    = "Allow"
        Action    = ["cloudwatch:PutMetricData"]
        Resource  = "*"
        Condition = { StringEquals = { "cloudwatch:namespace" = "bedrock-agentcore" } }
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/bedrock-agentcore-*"
      },
    ]
  })
}

# ============================================================================
# Per-agent: launch via null_resource + read ARN via external data source
# ============================================================================

resource "null_resource" "agent" {
  for_each = var.agents

  triggers = {
    code_hash    = filesha256("${each.value.source_dir}/agent.py")
    reqs_hash    = filesha256("${each.value.source_dir}/requirements.txt")
    runtime_name = each.value.runtime_name
    region       = var.aws_region
  }

  provisioner "local-exec" {
    command = "${path.module}/scripts/launch_agent.sh"
    environment = {
      AGENT_NAME     = each.key
      SOURCE_DIR     = each.value.source_dir
      BUILD_DIR      = "${path.module}/.build/${each.key}"
      RUNTIME_NAME   = each.value.runtime_name
      AWS_REGION     = var.aws_region
      EXECUTION_ROLE = aws_iam_role.agentcore.arn
      DEPLOYMENT_ID  = var.deployment_id
    }
  }

  provisioner "local-exec" {
    when    = destroy
    command = "${path.module}/scripts/destroy_agent.sh"
    environment = {
      RUNTIME_NAME = self.triggers.runtime_name
      AWS_REGION   = self.triggers.region
    }
  }

  depends_on = [
    aws_iam_role_policy.dynamodb,
    aws_iam_role_policy.bedrock,
    aws_iam_role_policy.kms,
    aws_iam_role_policy.logs,
  ]
}

data "external" "agent_arn" {
  for_each = var.agents
  program  = ["bash", "${path.module}/scripts/read_agent_arn.sh"]

  query = {
    build_dir = "${path.module}/.build/${each.key}"
  }

  depends_on = [null_resource.agent]
}
