output "api_id" {
  description = "HTTP API id."
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "HTTP API endpoint (no trailing slash). The stage path is appended automatically when auto_deploy is on."
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "stage_invoke_url" {
  description = "Full invoke URL for the stage (e.g. https://<id>.execute-api.<region>.amazonaws.com/prod)."
  value       = aws_apigatewayv2_stage.this.invoke_url
}

output "execution_arn" {
  description = "API execution ARN (for use in resource policies)."
  value       = aws_apigatewayv2_api.this.execution_arn
}

output "authorizer_id" {
  description = "Request authorizer id (for downstream observability dashboards)."
  value       = aws_apigatewayv2_authorizer.request.id
}

output "stage_arn" {
  description = "API stage ARN (target for WAF + alarms)."
  value       = aws_apigatewayv2_stage.this.arn
}

output "access_log_group_name" {
  description = "CloudWatch log group name receiving stage access logs."
  value       = aws_cloudwatch_log_group.access_logs.name
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN, or null if WAF is disabled."
  value       = var.enable_waf ? aws_wafv2_web_acl.this[0].arn : null
}
