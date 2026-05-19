# GitHub Actions OIDC bootstrap

One-shot Terraform that creates an IAM role GitHub Actions can assume via
OIDC — no long-lived AWS access keys in GitHub Secrets.

## When to run

Once per AWS account, before enabling the CI workflows under
`.github/workflows/`. Local state.

## How to run

```bash
cd terraform/bootstrap/github-oidc
terraform init
terraform apply -var="github_repo=alex-mahabir-glean/insurance-claims-intelligence-awsagentshackathon"
```

Note the `role_arn` output and add it to `.github/workflows/*.yml`:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: <role_arn from terraform output>
    aws-region: us-east-1
```

## Permissions

The role is given `AdministratorAccess` for accelerator simplicity.
**Customers running this in their own account should tighten this** to the
specific permissions Terraform needs (the per-resource Statements granted
by the rest of the project's IAM policies, plus AWS-side state and lock
table writes).

## Trusted branches / events

Defaults: `master`, `main`, plus PR events. Override via `var.branches`
and `var.trust_pull_requests`.
