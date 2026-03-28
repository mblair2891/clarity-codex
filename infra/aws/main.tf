terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  app_name = "clarity-bridge-health"
  tags = {
    Application = local.app_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "${local.app_name}-${var.environment}-assets"
  tags   = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.app_name}/api/${var.environment}"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.app_name}/web/${var.environment}"
  retention_in_days = 30
  tags              = local.tags
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.bucket
}
