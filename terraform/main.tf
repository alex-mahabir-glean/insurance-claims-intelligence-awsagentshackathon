locals {
  common_tags = {
    Project      = "insurance-claims-intelligence"
    Environment  = var.environment
    DeploymentId = var.deployment_id
    ManagedBy    = "terraform"
  }

  # AWS-managed Powertools Lambda Layer (Python 3.12, x86_64).
  # Includes Pydantic v2 — saves us from packaging it in the deployment zip.
  # Account 017000801446 is AWS-published. Pin a version per region.
  # https://docs.powertools.aws.dev/lambda/python/latest/
  powertools_layer_arn = "arn:aws:lambda:${var.aws_region}:017000801446:layer:AWSLambdaPowertoolsPythonV3-python312-x86_64:8"
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# ============================================================================
# Data tier (TF-2 #34)
# ============================================================================
module "data" {
  source = "./modules/data"

  deployment_id                 = var.deployment_id
  billing_mode                  = var.billing_mode
  audit_trail_retention_seconds = var.audit_trail_retention_seconds
  allow_destroy                 = var.allow_destroy
}

# ============================================================================
# Lambdas (TF-3 #35) — Option B topology: 3 Lambdas total
# ============================================================================

# api_handler: 6 CRUD routes. IAM: DynamoDB only.
module "api_handler" {
  source = "./modules/lambda_function"

  name                 = "LegalService-ApiHandler-${var.deployment_id}"
  source_dir           = "${path.module}/lambdas/api_handler"
  powertools_layer_arn = local.powertools_layer_arn
  memory_size          = 256
  timeout              = 10
  log_retention_days   = var.log_retention_days

  environment = {
    CLAIMS_TABLE                  = module.data.claims_table_name
    REVIEWERS_TABLE               = module.data.reviewers_table_name
    AUDIT_TABLE                   = module.data.audit_trail_table_name
    AUDIT_TRAIL_RETENTION_SECONDS = var.audit_trail_retention_seconds == null ? "" : tostring(var.audit_trail_retention_seconds)
    POWERTOOLS_SERVICE_NAME       = "api_handler"
    POWERTOOLS_LOG_LEVEL          = "INFO"
    POWERTOOLS_METRICS_NAMESPACE  = "InsuranceClaims/ApiHandler"
  }

  inline_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBData"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = concat(
          module.data.all_table_arns,
          [for arn in values(module.data.claims_index_arns) : arn],
        )
      },
      {
        Sid      = "KMSDecrypt"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = module.data.kms_key_arn
      },
    ]
  })
}

# agent_invoker: 2 agent-invocation routes. IAM: bedrock-agentcore only.
# TF-5 #37 will replace Resource:"*" with specific agent ARNs (closes SEC-4 #4).
module "agent_invoker" {
  source = "./modules/lambda_function"

  name                 = "LegalService-AgentInvoker-${var.deployment_id}"
  source_dir           = "${path.module}/lambdas/agent_invoker"
  powertools_layer_arn = local.powertools_layer_arn
  memory_size          = 512
  timeout              = 30
  log_retention_days   = var.log_retention_days

  environment = {
    POWERTOOLS_SERVICE_NAME      = "agent_invoker"
    POWERTOOLS_LOG_LEVEL         = "INFO"
    POWERTOOLS_METRICS_NAMESPACE = "InsuranceClaims/AgentInvoker"
    INTAKE_AGENT_ARN             = "" # populated in TF-5 once agents are deployed
    REVIEW_AGENT_ARN             = "" # populated in TF-5 once agents are deployed
  }

  inline_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "InvokeAgentCore"
      Effect   = "Allow"
      Action   = ["bedrock-agentcore:InvokeAgentRuntime"]
      Resource = "*" # TF-5 will replace with specific agent ARNs
    }]
  })
}

# authorizer: HTTP API v2 simple authorizer. IAM: secret read only.
module "authorizer" {
  source = "./modules/lambda_function"

  name                 = "LegalService-AgentCoreAuthorizer-${var.deployment_id}"
  source_dir           = "${path.module}/lambdas/authorizer"
  powertools_layer_arn = local.powertools_layer_arn
  memory_size          = 128
  timeout              = 5
  log_retention_days   = var.log_retention_days

  environment = {
    POWERTOOLS_SERVICE_NAME = "authorizer"
    POWERTOOLS_LOG_LEVEL    = "INFO"
    API_KEY_SECRET_ARN      = module.data.agentcore_api_token_secret_arn
  }

  inline_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "SecretsRead"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = module.data.agentcore_api_token_secret_arn
      },
      {
        Sid      = "KMSDecrypt"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = module.data.kms_key_arn
      },
    ]
  })
}

# ============================================================================
# API tier (TF-4 #36) — HTTP API v2 + authorizer + CORS + WAF toggle
# ============================================================================
module "api" {
  source = "./modules/api"

  deployment_id            = var.deployment_id
  api_handler_lambda_arn   = module.api_handler.function_arn
  api_handler_invoke_arn   = module.api_handler.invoke_arn
  agent_invoker_lambda_arn = module.agent_invoker.function_arn
  agent_invoker_invoke_arn = module.agent_invoker.invoke_arn
  authorizer_lambda_arn    = module.authorizer.function_arn
  authorizer_invoke_arn    = module.authorizer.invoke_arn

  allowed_origins    = var.allowed_origins
  enable_waf         = var.enable_waf
  log_retention_days = var.log_retention_days
}

# Modules wired in subsequent tickets:
# - module "agents"        (TF-5 #37): AgentCore Runtime via null_resource
# - module "observability" (TF-6 #38): alarms + SNS + dashboard + budgets
