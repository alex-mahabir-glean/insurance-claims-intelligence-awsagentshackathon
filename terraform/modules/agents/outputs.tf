output "agent_arns" {
  description = "Map of agent name -> Runtime ARN."
  value       = { for k, v in data.external.agent_arn : k => v.result.arn }
}

output "intake_agent_arn" {
  description = "Convenience accessor: ARN of the agent named 'intake'."
  value       = try(data.external.agent_arn["intake"].result.arn, null)
}

output "review_agent_arn" {
  description = "Convenience accessor: ARN of the agent named 'review'."
  value       = try(data.external.agent_arn["review"].result.arn, null)
}

output "agentcore_role_arn" {
  description = "AgentCore Runtime execution role ARN."
  value       = aws_iam_role.agentcore.arn
}

output "agentcore_role_name" {
  description = "AgentCore Runtime execution role name."
  value       = aws_iam_role.agentcore.name
}
