variable "name" {
  description = "Lambda function name. Will also be used as the prefix for log groups, DLQ, IAM role, and alarms."
  type        = string
}

variable "source_dir" {
  description = "Directory containing index.py and any handler-side dependencies. Packaged via archive_file at apply time."
  type        = string
}

variable "handler" {
  description = "Lambda handler entrypoint."
  type        = string
  default     = "index.lambda_handler"
}

variable "runtime" {
  description = "Lambda runtime. Pinned to Python 3.12 per project locked decision."
  type        = string
  default     = "python3.12"
}

variable "memory_size" {
  description = "Lambda memory in MB."
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Lambda timeout in seconds."
  type        = number
  default     = 10
}

variable "environment" {
  description = "Map of environment variables passed to the Lambda."
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log group retention. Default 7 days per locked decision (closes COST-1)."
  type        = number
  default     = 7
}

variable "powertools_layer_arn" {
  description = "AWS-managed Powertools layer ARN. Includes Pydantic v2 — saves us from packaging it. Pin a version per region."
  type        = string
}

variable "extra_layers" {
  description = "Additional Lambda Layer ARNs to attach beyond the Powertools layer."
  type        = list(string)
  default     = []
}

variable "inline_policy_json" {
  description = "Inline IAM policy JSON granting this Lambda its scoped permissions. Pass null to omit (Lambda only gets AWSLambdaBasicExecutionRole + DLQ permissions)."
  type        = string
  default     = null
}

variable "alert_topic_arn" {
  description = "SNS topic ARN for alarms. Set to null to skip alarm creation."
  type        = string
  default     = null
}

variable "duration_p99_threshold_ms" {
  description = "Alarm threshold for p99 duration. Skipped when alert_topic_arn is null."
  type        = number
  default     = 8000
}

variable "tracing_mode" {
  description = "X-Ray tracing mode. Active or PassThrough."
  type        = string
  default     = "Active"
}

variable "tags" {
  description = "Additional tags merged onto every resource."
  type        = map(string)
  default     = {}
}
