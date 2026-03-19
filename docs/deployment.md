# Deployment Guide

## Target platform

Clarity Bridge Health is optimized for AWS using:

- **Amazon ECS Fargate** for API and web services.
- **Amazon RDS PostgreSQL** for transactional persistence.
- **Amazon ElastiCache (Redis)** for jobs and cache.
- **Amazon S3** for uploads and generated exports.
- **AWS Secrets Manager** for secret distribution.
- **CloudWatch + alarms** for observability.

## Build artifacts

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

## CI/CD flow

1. GitHub Actions installs dependencies.
2. Lint, test, and typecheck run.
3. Docker images build.
4. Images publish to Amazon ECR.
5. ECS task definitions update in staging, then production.

## Backups

- PostgreSQL automated daily snapshots with PITR enabled.
- S3 versioning for clinical documents and exports.
- Redis persistence optional for queue durability; source of truth remains PostgreSQL.
