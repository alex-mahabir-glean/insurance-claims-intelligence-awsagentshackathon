# ============================================================================
# DynamoDB
# ============================================================================

output "claims_table_name" {
  description = "Name of the Claims DynamoDB table."
  value       = aws_dynamodb_table.claims.name
}

output "claims_table_arn" {
  description = "ARN of the Claims table. Use in scoped IAM policies."
  value       = aws_dynamodb_table.claims.arn
}

output "claims_table_stream_arn" {
  description = "ARN of the Claims table's DynamoDB Stream (NEW_AND_OLD_IMAGES)."
  value       = aws_dynamodb_table.claims.stream_arn
}

output "claims_index_arns" {
  description = "Map of GSI name to ARN for the Claims table."
  value = {
    StatusIndex     = "${aws_dynamodb_table.claims.arn}/index/StatusIndex"
    AssignedToIndex = "${aws_dynamodb_table.claims.arn}/index/AssignedToIndex"
  }
}

output "reviewers_table_name" {
  description = "Name of the Reviewers DynamoDB table."
  value       = aws_dynamodb_table.reviewers.name
}

output "reviewers_table_arn" {
  description = "ARN of the Reviewers table."
  value       = aws_dynamodb_table.reviewers.arn
}

output "audit_trail_table_name" {
  description = "Name of the AuditTrail DynamoDB table."
  value       = aws_dynamodb_table.audit_trail.name
}

output "audit_trail_table_arn" {
  description = "ARN of the AuditTrail table."
  value       = aws_dynamodb_table.audit_trail.arn
}

output "all_table_arns" {
  description = "Convenience: list of all table ARNs (for IAM Resource: scoped policies)."
  value = [
    aws_dynamodb_table.claims.arn,
    aws_dynamodb_table.reviewers.arn,
    aws_dynamodb_table.audit_trail.arn,
  ]
}

# ============================================================================
# KMS
# ============================================================================

output "kms_key_id" {
  description = "KMS key ID for the customer-managed key encrypting all data resources."
  value       = aws_kms_key.this.key_id
}

output "kms_key_arn" {
  description = "KMS key ARN. Use in policies that need to grant Decrypt/GenerateDataKey on this key."
  value       = aws_kms_key.this.arn
}

output "kms_alias_name" {
  description = "KMS alias name (alias/...)"
  value       = aws_kms_alias.this.name
}

# ============================================================================
# Secrets
# ============================================================================

output "api_token_secret_arn" {
  description = "ARN of the API token secret (Glean Actions auth)."
  value       = aws_secretsmanager_secret.api_token.arn
}

output "api_token_secret_name" {
  description = "Name of the API token secret."
  value       = aws_secretsmanager_secret.api_token.name
}

output "agentcore_api_token_secret_arn" {
  description = "ARN of the AgentCore API token secret (used by the API Gateway authorizer Lambda)."
  value       = aws_secretsmanager_secret.agentcore_api_token.arn
}

output "agentcore_api_token_secret_name" {
  description = "Name of the AgentCore API token secret."
  value       = aws_secretsmanager_secret.agentcore_api_token.name
}
