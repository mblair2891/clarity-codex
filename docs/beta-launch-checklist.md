# Beta Launch Checklist

## Before First Deploy

- Confirm AWS credentials target the intended beta account.
- Confirm the Route 53 hosted zone for `claritybridgehealth.com` exists in the same AWS account.
- Confirm GitHub Actions secret `AWS_BETA_DEPLOY_ROLE_ARN` is configured if deploys will run from GitHub.
- Install `terraform` locally if deploying from Codespaces with `scripts/deploy-beta.sh`.
- Review `infra/aws/beta.tfvars.example` and override any beta-specific values if needed.

## Infrastructure Bootstrap

- Run `chmod +x scripts/bootstrap-tf-backend.sh scripts/deploy-beta.sh`.
- Run `scripts/bootstrap-tf-backend.sh` to create:
  - Terraform state bucket
  - DynamoDB lock table
- Run `terraform -chdir=infra/aws init` with the generated backend settings.

## Image Build and Push

- Bootstrap ECR repositories first:
  - `terraform -chdir=infra/aws apply -auto-approve -target=aws_ecr_repository.web -target=aws_ecr_repository.api -target=aws_ecr_lifecycle_policy.web -target=aws_ecr_lifecycle_policy.api`
- Build and push:
  - web image from `apps/web/Dockerfile`
  - api image from `apps/api/Dockerfile`
- Tag images with the git SHA used for deployment.

## Terraform Apply

- Run full apply with the pushed image tag:
  - `terraform -chdir=infra/aws apply -auto-approve -var-file=beta.tfvars.example -var="image_tag=<git-sha>"`
- Confirm outputs:
  - `web_url`
  - `clinical_url`
  - `api_url`
  - `assets_bucket`

## Database Workflow

- Generate Prisma client:
  - `npm run prisma:generate`
- Apply schema:
  - `npm run db:migrate:deploy`
- Seed beta baseline data if desired:
  - `npm run db:seed`
- Bootstrap a named admin if desired:
  - `BOOTSTRAP_ADMIN_EMAIL=<email> BOOTSTRAP_ADMIN_NAME="<name>" npm run db:bootstrap-admin`

## Smoke Tests

- Web health:
  - `GET https://beta-app.claritybridgehealth.com/healthz`
- Clinical beta root redirect:
  - `GET https://beta-clinical.claritybridgehealth.com/`
  - Expect redirect to `/clinical`
- API health:
  - `GET https://beta-api.claritybridgehealth.com/health`
- API metadata:
  - `GET https://beta-api.claritybridgehealth.com/v1/meta`
- Load homepage and each role surface:
  - `/`
  - `/consumer`
  - `/clinical`
  - `/rcm`
  - `/admin`

## Observability Checks

- Confirm ECS services show healthy running tasks.
- Confirm ALB target groups report healthy targets.
- Confirm CloudWatch log groups receive logs for:
  - `/ecs/clarity-beta/web`
  - `/ecs/clarity-beta/api`
- Confirm RDS instance is `available`.
- Confirm CloudWatch alarms were created.

## Security Checks

- Confirm ECS tasks are in private subnets with no public IPs.
- Confirm RDS is not publicly accessible.
- Confirm only the ALB security group can reach ECS services.
- Confirm only ECS can reach PostgreSQL on port `5432`.
- Confirm S3 bucket public access is blocked.
- Confirm ACM certificate is issued and attached to the ALB HTTPS listener.

## Rollback

- Re-run Terraform with the previous known-good `image_tag`.
- If only application rollout is bad, push the prior image tag and apply:
  - `terraform -chdir=infra/aws apply -auto-approve -var-file=beta.tfvars.example -var="image_tag=<previous-git-sha>"`
- If a database migration caused issues, restore from the RDS automated backup or apply a corrective migration before reopening tester access.

## Beta Notes

- The repository currently has one Next.js frontend and one Fastify API.
- `beta-clinical.claritybridgehealth.com` intentionally shares the same frontend deployment as `beta-app.claritybridgehealth.com`.
- Redis is optional and disabled by default because current beta runtime code does not require it.
- Current API behavior remains demo-data driven even though RDS and Prisma workflows are now provisioned for forward-compatible persistence.
