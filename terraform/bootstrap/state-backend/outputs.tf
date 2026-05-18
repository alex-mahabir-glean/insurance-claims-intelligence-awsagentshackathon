output "bucket_name" {
  description = "S3 bucket name holding Terraform state files. Use this in env/<env>.tfbackend."
  value       = aws_s3_bucket.tfstate.id
}

output "lock_table_name" {
  description = "DynamoDB lock table name. Use this in env/<env>.tfbackend."
  value       = aws_dynamodb_table.tfstate_locks.name
}

output "region" {
  description = "AWS region the backend was created in."
  value       = var.aws_region
}
