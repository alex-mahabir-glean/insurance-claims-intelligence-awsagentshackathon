# ============================================================================
# Data tier (TF-2)
# ============================================================================

output "claims_table_name" {
  description = "Name of the Claims DynamoDB table."
  value       = module.data.claims_table_name
}

output "reviewers_table_name" {
  description = "Name of the Reviewers DynamoDB table."
  value       = module.data.reviewers_table_name
}

output "audit_trail_table_name" {
  description = "Name of the AuditTrail DynamoDB table."
  value       = module.data.audit_trail_table_name
}

output "kms_key_arn" {
  description = "Customer-managed KMS key encrypting all data resources."
  value       = module.data.kms_key_arn
}

output "api_token_secret_name" {
  description = "Secrets Manager secret name holding the Glean Actions API token."
  value       = module.data.api_token_secret_name
}

output "agentcore_api_token_secret_name" {
  description = "Secrets Manager secret name holding the AgentCore API token."
  value       = module.data.agentcore_api_token_secret_name
}

# Outputs added in subsequent tickets:
# - api_url           (from module.api,  TF-4)
# - intake_agent_arn  (from module.agents, TF-5)
# - review_agent_arn  (from module.agents, TF-5)

# ============================================================================
# Lambdas (TF-3)
# ============================================================================

output "api_handler_function_name" {
  description = "api_handler Lambda function name."
  value       = module.api_handler.function_name
}

output "api_handler_invoke_arn" {
  description = "api_handler Lambda invoke ARN. Used by module.api in TF-4."
  value       = module.api_handler.invoke_arn
}

output "agent_invoker_function_name" {
  description = "agent_invoker Lambda function name."
  value       = module.agent_invoker.function_name
}

output "agent_invoker_invoke_arn" {
  description = "agent_invoker Lambda invoke ARN. Used by module.api in TF-4."
  value       = module.agent_invoker.invoke_arn
}

output "agent_invoker_role_name" {
  description = "agent_invoker IAM role name. TF-5 will update its scoped policy with specific agent ARNs."
  value       = module.agent_invoker.role_name
}

output "authorizer_function_name" {
  description = "authorizer Lambda function name."
  value       = module.authorizer.function_name
}

output "authorizer_invoke_arn" {
  description = "authorizer Lambda invoke ARN. Used by module.api in TF-4."
  value       = module.authorizer.invoke_arn
}

# ============================================================================
# API tier (TF-4)
# ============================================================================

output "api_endpoint" {
  description = "HTTP API endpoint base URL."
  value       = module.api.api_endpoint
}

output "api_invoke_url" {
  description = "Full invoke URL for the stage. Use this in the frontend config.js."
  value       = module.api.stage_invoke_url
}

output "api_id" {
  description = "HTTP API id."
  value       = module.api.api_id
}

output "api_access_log_group_name" {
  description = "CloudWatch log group name receiving stage access logs."
  value       = module.api.access_log_group_name
}

# ============================================================================
# Agents (TF-5)
# ============================================================================

output "intake_agent_arn" {
  description = "Bedrock AgentCore Runtime ARN of the intake agent."
  value       = module.agents.intake_agent_arn
}

output "review_agent_arn" {
  description = "Bedrock AgentCore Runtime ARN of the review agent."
  value       = module.agents.review_agent_arn
}

output "agentcore_role_arn" {
  description = "AgentCore Runtime execution role ARN."
  value       = module.agents.agentcore_role_arn
}

# ============================================================================
# Observability (TF-6)
# ============================================================================

output "alert_topic_arn" {
  description = "SNS topic ARN for alarms."
  value       = module.observability.alert_topic_arn
}

output "dashboard_url" {
  description = "Direct link to the CloudWatch dashboard."
  value       = module.observability.dashboard_url
}
