variable "aws_region" {
  description = "AWS region for the IAM role."
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repo in the form owner/repo."
  type        = string
}

variable "branches" {
  description = "Git branches the OIDC role will trust for assume-role. Default trusts master + tag-push only."
  type        = list(string)
  default     = ["master", "main"]
}

variable "trust_pull_requests" {
  description = "Also allow workflows triggered by PRs (sub starts with `pull_request:` rather than a branch ref). Required for plan-on-PR workflows that need AWS credentials."
  type        = bool
  default     = true
}

variable "role_name" {
  description = "IAM role name."
  type        = string
  default     = "GitHubActions-InsuranceClaims"
}
