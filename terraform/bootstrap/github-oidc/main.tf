# ============================================================================
# GitHub Actions OIDC role bootstrap.
# Run once per AWS account before turning on the CI workflows in TF-7.
# Local state — like the state-backend bootstrap, this module breaks the
# chicken-and-egg of CI being able to deploy infrastructure.
# ============================================================================

terraform {
  # Local state intentional — this module bootstraps the role that lets
  # the main stack be deployed via remote state.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "insurance-claims-intelligence"
      Component = "github-oidc"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# OIDC provider — one per account. If you already have one, skip this resource
# and reference its ARN in the role's assume_role_policy.
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"] # github actions root CA
}

locals {
  # Build a list of "sub" patterns that the role trusts.
  branch_subs  = [for b in var.branches : "repo:${var.github_repo}:ref:refs/heads/${b}"]
  pr_subs      = var.trust_pull_requests ? ["repo:${var.github_repo}:pull_request"] : []
  trusted_subs = concat(local.branch_subs, local.pr_subs)
}

resource "aws_iam_role" "github_actions" {
  name = var.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = local.trusted_subs
        }
      }
    }]
  })
}

# Convenience: attach AdministratorAccess for the accelerator (customers
# should tighten this for their actual production deploys).
# Customers fork-and-customize this — we document the right thing to do.
resource "aws_iam_role_policy_attachment" "admin" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
