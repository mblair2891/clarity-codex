resource "aws_acm_certificate" "beta" {
  domain_name               = local.web_hostname
  subject_alternative_names = [local.api_hostname, local.clinical_hostname]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

resource "aws_route53_record" "certificate_validation" {
  for_each = var.create_dns_records ? {
    for dvo in aws_acm_certificate.beta.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = data.aws_route53_zone.primary[0].zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "beta" {
  certificate_arn         = aws_acm_certificate.beta.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_route53_record" "web" {
  count   = var.create_dns_records ? 1 : 0
  zone_id = data.aws_route53_zone.primary[0].zone_id
  name    = local.web_hostname
  type    = "A"

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "clinical" {
  count   = var.create_dns_records ? 1 : 0
  zone_id = data.aws_route53_zone.primary[0].zone_id
  name    = local.clinical_hostname
  type    = "A"

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  count   = var.create_dns_records ? 1 : 0
  zone_id = data.aws_route53_zone.primary[0].zone_id
  name    = local.api_hostname
  type    = "A"

  alias {
    name                   = aws_lb.public.dns_name
    zone_id                = aws_lb.public.zone_id
    evaluate_target_health = true
  }
}
