# Customer-managed KMS key shared by all 3 DynamoDB tables and 2 Secrets Manager secrets.
# One CMK per stack (locked decision: simpler than per-resource keys for this scale).
# Closes part of #5 (SEC-5).

resource "aws_kms_key" "this" {
  description             = "Encryption key for insurance-claims-intelligence (${var.deployment_id})"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Component = "data-encryption"
  })
}

resource "aws_kms_alias" "this" {
  name          = "${var.kms_alias_prefix}-${var.deployment_id}"
  target_key_id = aws_kms_key.this.key_id
}

# ============================================================================
# Claims table
# ============================================================================

resource "aws_dynamodb_table" "claims" {
  name         = "LegalService-Claims-${var.deployment_id}"
  billing_mode = var.billing_mode
  hash_key     = "claimId"

  attribute {
    name = "claimId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "assignedTo"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "AssignedToIndex"
    hash_key        = "assignedTo"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.this.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  deletion_protection_enabled = !var.allow_destroy

  tags = merge(var.tags, {
    Component          = "claims-table"
    DataClassification = "PII"
  })
}

# ============================================================================
# Reviewers table
# ============================================================================

resource "aws_dynamodb_table" "reviewers" {
  name         = "LegalService-Reviewers-${var.deployment_id}"
  billing_mode = var.billing_mode
  hash_key     = "reviewerId"

  attribute {
    name = "reviewerId"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.this.arn
  }

  tags = merge(var.tags, {
    Component = "reviewers-table"
  })
}

# ============================================================================
# AuditTrail table
# Composite key (claimId HASH, timestamp RANGE) matches existing schema.
# TTL exposed via var.audit_trail_retention_seconds; writer (Lambda in TF-3)
# sets expires_at only when a retention is configured.
# ============================================================================

resource "aws_dynamodb_table" "audit_trail" {
  name         = "LegalService-AuditTrail-${var.deployment_id}"
  billing_mode = var.billing_mode
  hash_key     = "claimId"
  range_key    = "timestamp"

  attribute {
    name = "claimId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = var.audit_trail_retention_seconds != null
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.this.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = !var.allow_destroy

  tags = merge(var.tags, {
    Component          = "audit-trail-table"
    DataClassification = "AuditLog"
  })
}

# ============================================================================
# Secrets Manager — API tokens
# Both secrets generate a 32-char value (matching the original CFN behavior).
# ============================================================================

resource "random_password" "api_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "api_token" {
  name        = "LegalService/ApiToken/${var.deployment_id}"
  description = "API token for Glean Actions authentication"
  kms_key_id  = aws_kms_key.this.arn

  tags = merge(var.tags, {
    Component = "api-token"
  })
}

resource "aws_secretsmanager_secret_version" "api_token" {
  secret_id     = aws_secretsmanager_secret.api_token.id
  secret_string = jsonencode({ token = random_password.api_token.result })
}

resource "random_password" "agentcore_api_token" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "agentcore_api_token" {
  name        = "LegalService/AgentCoreApiToken/${var.deployment_id}"
  description = "API token for AgentCore agent invocation endpoints"
  kms_key_id  = aws_kms_key.this.arn

  tags = merge(var.tags, {
    Component = "agentcore-api-token"
  })
}

resource "aws_secretsmanager_secret_version" "agentcore_api_token" {
  secret_id     = aws_secretsmanager_secret.agentcore_api_token.id
  secret_string = jsonencode({ token = random_password.agentcore_api_token.result })
}
