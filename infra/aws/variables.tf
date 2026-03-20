variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "beta"
}

variable "project_name" {
  type    = string
  default = "clarity"
}

variable "domain_name" {
  type    = string
  default = "claritybridgehealth.com"
}

variable "route53_zone_name" {
  type    = string
  default = "claritybridgehealth.com"
}

variable "web_subdomain" {
  type    = string
  default = "beta-app"
}

variable "clinical_subdomain" {
  type    = string
  default = "beta-clinical"
}

variable "api_subdomain" {
  type    = string
  default = "beta-api"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "allowed_ingress_cidrs" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "web_desired_count" {
  type    = number
  default = 1
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "web_min_capacity" {
  type    = number
  default = 1
}

variable "web_max_capacity" {
  type    = number
  default = 2
}

variable "api_min_capacity" {
  type    = number
  default = 1
}

variable "api_max_capacity" {
  type    = number
  default = 2
}

variable "db_name" {
  type    = string
  default = "clarity_beta"
}

variable "db_username" {
  type    = string
  default = "clarity_beta"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "enable_redis" {
  type    = bool
  default = false
}

variable "redis_url" {
  type    = string
  default = ""
}

variable "create_dns_records" {
  type    = bool
  default = true
}

variable "next_public_app_name" {
  type    = string
  default = "Clarity Bridge Health"
}

variable "jwt_issuer" {
  type    = string
  default = "clarity-bridge-health"
}

variable "jwt_audience" {
  type    = string
  default = "clarity-platform"
}

variable "ai_provider" {
  type    = string
  default = "demo"
}

variable "openai_api_key_secret_arn" {
  type     = string
  default  = null
  nullable = true
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
