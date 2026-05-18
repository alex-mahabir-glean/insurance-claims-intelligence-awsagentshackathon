locals {
  common_tags = {
    Project      = "insurance-claims-intelligence"
    Environment  = var.environment
    DeploymentId = var.deployment_id
    ManagedBy    = "terraform"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Modules are wired in subsequent tickets:
# - module "data"          (TF-2 #34): DynamoDB + KMS + Secrets
# - module "lambdas"       (TF-3 #35): api_handler + agent_invoker + authorizer
# - module "api"           (TF-4 #36): HTTP API v2 + authorizer + CORS
# - module "agents"        (TF-5 #37): AgentCore Runtime via null_resource
# - module "observability" (TF-6 #38): alarms + SNS + dashboard + budgets
