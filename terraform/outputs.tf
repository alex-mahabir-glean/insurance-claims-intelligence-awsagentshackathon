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
