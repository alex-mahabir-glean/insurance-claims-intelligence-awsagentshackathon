variable "deployment_id" {
  description = "Deployment identifier; suffixed onto SNS topic + dashboard names."
  type        = string
}

variable "alert_email" {
  description = "Email subscribed to the SNS alert topic. Set to null to skip subscription (subscribe manually later)."
  type        = string
  default     = null
}

variable "lambdas" {
  description = "Map of logical name -> Lambda function name for which to create Errors/Throttles/Duration alarms."
  type        = map(string)
}

variable "api_id" {
  description = "HTTP API id for stage-level alarms."
  type        = string
}

variable "api_stage_name" {
  description = "API Gateway stage name (e.g. prod)."
  type        = string
  default     = "prod"
}

variable "table_names" {
  description = "Map of logical name -> DynamoDB table name for which to create User/SystemErrors + Throttle alarms."
  type        = map(string)
}

variable "duration_p99_threshold_ms" {
  description = "Default Lambda p99 duration alarm threshold (ms)."
  type        = number
  default     = 8000
}

variable "monthly_bedrock_budget_usd" {
  description = "Monthly AWS Budget for Bedrock spend in USD. Set to 0 to skip the budget."
  type        = number
  default     = 50
}

variable "tags" {
  description = "Additional tags merged onto every resource."
  type        = map(string)
  default     = {}
}
