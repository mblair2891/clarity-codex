resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}/web"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}/api"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}
