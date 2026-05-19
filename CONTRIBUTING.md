# Contributing

## Branching

This project uses an epic-and-sub-PR pattern for the Terraform migration:

- Long-lived branch `epic/<topic>` (e.g. `epic/terraform-migration`)
- Each sub-ticket gets its own branch (e.g. `tf-3-lambdas`) PR'd into the epic
- One final PR merges the epic into `master`

For non-migration work, just branch directly from `master`:

- `git checkout -b your-name/short-description master`

## Commit messages

Conventional prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
No `Co-authored-by` footers.

Reference issues with `Closes #N` in the PR body (the auto-close fires when the PR merges to the default branch).

## Pre-commit

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files   # before opening a PR
```

The configured hooks:
- `terraform_fmt`, `terraform_validate`, `terraform_tflint`
- `trivy config` (HIGH/CRITICAL only)
- `ruff` + `ruff-format` for Lambda Python under `terraform/lambdas/`

## CI workflows

- `terraform-pr.yml` runs on every PR touching `terraform/`: fmt, validate,
  module self-containment check, tflint, trivy, plan-on-PR (if the
  AWS OIDC role variable is set in the repo).
- `terraform-apply-dev.yml` deploys to dev on push to `master` (excluding
  `module.agents`, which is laptop-only per locked design decision).
- `terraform-apply-prod.yml` is manual (`workflow_dispatch`) with a typed
  `confirm` input and a GitHub Environment with required reviewers.

## Setting up the OIDC role

CI uses GitHub Actions OIDC, not long-lived AWS keys. Bootstrap once per account:

```bash
cd terraform/bootstrap/github-oidc
terraform init
terraform apply -var="github_repo=$OWNER/$REPO"
```

Save the `role_arn` output to repo variables:
- `AWS_OIDC_ROLE_ARN` — for the dev workflows
- `AWS_OIDC_ROLE_ARN_PROD` — for the prod workflow (often a different, more-scoped role)

## Local development

See `terraform/README.md` for the bootstrap → init → apply flow.

For Lambda development:

```bash
cd terraform/lambdas/api_handler
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest tests/
```

## Out of scope (for now)

- The `module.agents` (`agentcore launch`) is run from a developer laptop,
  not from CI. CI workflows explicitly `-target=` everything else and
  exclude `module.agents`.
- Drift detection (`terraform plan` on a schedule). Will track separately
  if needed.
