output "web_url" {
  value = local.web_url
}

output "clinical_url" {
  value = local.clinical_url
}

output "api_url" {
  value = local.api_url
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.bucket
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "web_service_name" {
  value = aws_ecs_service.web.name
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "db_secret_arn" {
  value     = aws_secretsmanager_secret.database.arn
  sensitive = true
}

output "api_secret_arn" {
  value     = aws_secretsmanager_secret.api.arn
  sensitive = true
}

output "alb_dns_name" {
  value = aws_lb.public.dns_name
}
