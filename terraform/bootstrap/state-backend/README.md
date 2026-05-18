# State backend bootstrap

One-shot Terraform that creates the S3 bucket and DynamoDB lock table used by
the main stack's `backend "s3"` block.

## When to run

Once per AWS account + region pair, before the first `terraform init` of the
main stack. The S3 bucket is named `tfstate-${ACCOUNT_ID}-${REGION}` so it does
not clash across accounts.

## How to run

```bash
cd terraform/bootstrap/state-backend
terraform init
terraform apply -var="aws_region=us-east-1"
```

The local `terraform.tfstate` file produced here lives in this directory. Keep
it somewhere safe; it is small and changes rarely.

## Outputs

- `bucket_name` — paste into `terraform/env/<env>.tfbackend`'s `bucket = ...` line.
- `lock_table_name` — paste into `terraform/env/<env>.tfbackend`'s `dynamodb_table = ...` line.
- `region` — paste into `terraform/env/<env>.tfbackend`'s `region = ...` line.

## Why this exists

The main stack's S3 backend cannot create the bucket it stores state in (chicken
and egg). This bootstrap module breaks the cycle. Customers run it once and
then never touch it again.
