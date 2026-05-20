variable "deployment_id" {
  description = "Unique deployment identifier; suffix on all table and secret names. Lowercase letters and numbers only."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.deployment_id))
    error_message = "deployment_id must contain only lowercase letters and numbers."
  }
}

variable "billing_mode" {
  description = "DynamoDB billing mode for all tables in this module."
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.billing_mode)
    error_message = "billing_mode must be PAY_PER_REQUEST or PROVISIONED."
  }
}

variable "audit_trail_retention_seconds" {
  description = "Optional TTL on AuditTrail items. null disables TTL (current behavior; audit data persists indefinitely). Set to e.g. 220752000 (7 years) if compliance requires."
  type        = number
  default     = null
}

variable "allow_destroy" {
  description = "When false (default), Claims and AuditTrail have deletion_protection_enabled = true. Set true for dev/test workspaces where terraform destroy must succeed."
  type        = bool
  default     = false
}

variable "kms_alias_prefix" {
  description = "Prefix for the KMS key alias. Final alias is '<prefix>-<deployment_id>'."
  type        = string
  default     = "alias/insurance-claims-intelligence"
}

variable "tags" {
  description = "Additional tags merged onto every resource (in addition to provider default_tags)."
  type        = map(string)
  default     = {}
}
