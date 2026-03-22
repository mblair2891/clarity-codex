data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_route53_zone" "primary" {
  count        = var.create_dns_records ? 1 : 0
  name         = var.route53_zone_name
  private_zone = false
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 2)

  common_tags = merge(
    {
      Application = "Clarity Bridge Health"
      Environment = var.environment
      ManagedBy   = "terraform"
      Project     = var.project_name
    },
    var.tags
  )

  web_hostname      = "${var.web_subdomain}.${var.domain_name}"
  clinical_hostname = "${var.clinical_subdomain}.${var.domain_name}"
  api_hostname      = "${var.api_subdomain}.${var.domain_name}"

  web_url      = "https://${local.web_hostname}"
  clinical_url = "https://${local.clinical_hostname}"
  api_url      = "https://${local.api_hostname}"

  public_subnet_cidrs  = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index)]
  private_subnet_cidrs = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index + 4)]

  api_secret_names = concat(
    [
      {
        name      = "JWT_SECRET"
        valueFrom = "${aws_secretsmanager_secret.api.arn}:JWT_SECRET::"
      },
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.database.arn}:DATABASE_URL::"
      }
    ],
    var.beta_login_code != null ? [
      {
        name      = "BETA_LOGIN_CODE"
        valueFrom = "${aws_secretsmanager_secret.api.arn}:BETA_LOGIN_CODE::"
      }
    ] : [],
    var.enable_redis ? [
      {
        name      = "REDIS_URL"
        valueFrom = "${aws_secretsmanager_secret.api.arn}:REDIS_URL::"
      }
    ] : [],
    var.openai_api_key_secret_arn != null ? [
      {
        name      = "OPENAI_API_KEY"
        valueFrom = var.openai_api_key_secret_arn
      }
    ] : []
  )
}
