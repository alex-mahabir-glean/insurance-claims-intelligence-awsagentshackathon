output "role_arn" {
  description = "OIDC role ARN. Add this to .github/workflows/*.yml as `role-to-assume`."
  value       = aws_iam_role.github_actions.arn
}

output "role_name" {
  description = "OIDC role name."
  value       = aws_iam_role.github_actions.name
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN. Reuse if creating additional roles."
  value       = aws_iam_openid_connect_provider.github.arn
}
