resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts_web" {
  alarm_name          = "${local.name_prefix}-web-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Web target group has unhealthy tasks."

  dimensions = {
    LoadBalancer = aws_lb.public.arn_suffix
    TargetGroup  = aws_lb_target_group.web.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts_api" {
  alarm_name          = "${local.name_prefix}-api-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "API target group has unhealthy tasks."

  dimensions = {
    LoadBalancer = aws_lb.public.arn_suffix
    TargetGroup  = aws_lb_target_group.api.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_api_cpu_high" {
  alarm_name          = "${local.name_prefix}-api-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "API service sustained high CPU."

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_web_cpu_high" {
  alarm_name          = "${local.name_prefix}-web-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Web service sustained high CPU."

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.web.name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Beta database sustained high CPU."

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = local.common_tags
}
