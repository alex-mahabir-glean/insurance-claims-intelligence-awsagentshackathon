variable "aws_region" {
  description = "AWS region for the state backend (must match the region of the main stack)."
  type        = string
  default     = "us-east-1"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB lock table. Defaults to a stable account-wide value so multiple stacks can share it."
  type        = string
  default     = "tfstate-locks"
}
