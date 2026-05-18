variable "aws_region" {
  description = "AWS region for all resources. Closes SUS-2 (#31) by parameterizing what was hardcoded to us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod). Used in the default_tags block."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "deployment_id" {
  description = "Unique deployment identifier; used for resource naming. Lowercase letters and numbers only."
  type        = string
  default     = "legal"

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.deployment_id))
    error_message = "deployment_id must contain only lowercase letters and numbers (no hyphens or special characters)."
  }
}

# ============================================================================
# Data module (TF-2 #34) — passthrough variables
# ============================================================================

variable "billing_mode" {
  description = "DynamoDB billing mode for all tables. PAY_PER_REQUEST or PROVISIONED."
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "audit_trail_retention_seconds" {
  description = "Optional TTL on AuditTrail items. null disables TTL. No default per locked design decision (audit data persists until customer opts in)."
  type        = number
  default     = null
}

variable "allow_destroy" {
  description = "When false (default), Claims and AuditTrail tables have deletion protection. Set true for dev/test workspaces."
  type        = bool
  default     = false
}

# ============================================================================
# Lambda module (TF-3 #35) — passthrough variables
# ============================================================================

variable "log_retention_days" {
  description = "CloudWatch log retention for all Lambda log groups. Closes COST-1."
  type        = number
  default     = 7
}
