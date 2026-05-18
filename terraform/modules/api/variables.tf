variable "deployment_id" {
  description = "Unique deployment identifier; used for resource naming."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.deployment_id))
    error_message = "deployment_id must contain only lowercase letters and numbers."
  }
}

variable "stage_name" {
  description = "API Gateway stage name."
  type        = string
  default     = "prod"
}

variable "api_handler_lambda_arn" {
  description = "Lambda function ARN for the api_handler (CRUD routes)."
  type        = string
}

variable "api_handler_invoke_arn" {
  description = "Lambda invoke ARN for the api_handler (used in apigateway integration)."
  type        = string
}

variable "agent_invoker_lambda_arn" {
  description = "Lambda function ARN for the agent_invoker (Bedrock routes)."
  type        = string
}

variable "agent_invoker_invoke_arn" {
  description = "Lambda invoke ARN for the agent_invoker."
  type        = string
}

variable "authorizer_lambda_arn" {
  description = "Lambda function ARN for the request authorizer."
  type        = string
}

variable "authorizer_invoke_arn" {
  description = "Lambda invoke ARN for the authorizer."
  type        = string
}

variable "allowed_origins" {
  description = "CORS allow-list. Closes SEC-1 #1 by replacing wildcard origin with an explicit list."
  type        = list(string)
  default     = ["http://localhost:8000"]
}

variable "authorizer_result_ttl_seconds" {
  description = "Cache TTL for the request authorizer result. 300 closes PERF-2 #24 (was 0)."
  type        = number
  default     = 300
}

variable "agent_route_burst_limit" {
  description = "Per-route throttling burst limit on agent invoke endpoints (Bedrock cost protection)."
  type        = number
  default     = 20
}

variable "agent_route_rate_limit" {
  description = "Per-route throttling steady rate on agent invoke endpoints."
  type        = number
  default     = 10
}

variable "default_route_burst_limit" {
  description = "Per-route throttling burst limit on non-agent endpoints."
  type        = number
  default     = 100
}

variable "default_route_rate_limit" {
  description = "Per-route throttling steady rate on non-agent endpoints."
  type        = number
  default     = 50
}

variable "log_retention_days" {
  description = "Retention for the API Gateway access log group."
  type        = number
  default     = 7
}

variable "enable_waf" {
  description = "Attach AWS WAFv2 with Common + KnownBadInputs managed rule groups. Default false (opt-in per locked design decision)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags merged onto every resource."
  type        = map(string)
  default     = {}
}
