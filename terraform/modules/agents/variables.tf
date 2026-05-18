variable "deployment_id" {
  description = "Deployment id, suffixed onto agent runtime names."
  type        = string
}

variable "aws_region" {
  description = "AWS region. Passed through to the agentcore CLI."
  type        = string
}

variable "agents" {
  description = "Map of agent name -> { source_dir, runtime_name }. source_dir must contain agent.py + requirements.txt."
  type = map(object({
    source_dir   = string
    runtime_name = string
  }))
}

variable "claims_table_arn" {
  description = "ARN of the Claims table; used to scope DynamoDB IAM."
  type        = string
}

variable "claims_table_index_arns" {
  description = "ARNs of the Claims table GSIs."
  type        = list(string)
}

variable "reviewers_table_arn" {
  description = "ARN of the Reviewers table."
  type        = string
}

variable "audit_trail_table_arn" {
  description = "ARN of the AuditTrail table."
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for the data tables."
  type        = string
}

variable "bedrock_model_ids" {
  description = "List of Bedrock foundation model IDs the agents may invoke. Closes SEC-4 #4 by pinning the IAM scope."
  type        = list(string)
  default     = ["amazon.nova-pro-v1:0"]
}

variable "tags" {
  description = "Additional tags merged onto every resource."
  type        = map(string)
  default     = {}
}
