# Beta Deployment Plan

## Repository Inspection

### Current application topology

- **Web app entrypoint:** `apps/web/app/page.tsx`
- **Clinical app entrypoint:** no standalone `apps/clinical` app exists. Clinical beta traffic is currently served by the main Next.js app at `apps/web/app/clinical/page.tsx`.
- **Backend/API entrypoint:** `apps/api/src/index.ts`
- **Worker/background entrypoint:** no worker service exists in the repository today.
- **ORM/database config:** Prisma schema is defined in `prisma/schema.prisma`, but the running API does not currently instantiate Prisma or persist to PostgreSQL.
- **Environment variable validation:** API runtime env validation lives in `apps/api/src/config/env.ts`. The root `.env.example` is incomplete for AWS beta deployment.
- **Existing Docker assets:** `apps/web/Dockerfile` and `apps/api/Dockerfile`
- **Existing infrastructure assets:** `infra/aws/main.tf` and `infra/aws/variables.tf` exist but currently provision only an S3 bucket and two CloudWatch log groups.
- **Existing CI/CD:** `.github/workflows/ci.yml` validates only `main` and does not build/push images or deploy to AWS.

### Runtime behavior findings

- The **web app** is a Next.js 15 standalone build with route segments for:
  - `/consumer`
  - `/clinical`
  - `/rcm`
  - `/admin`
- The **API** is a Fastify service exposing:
  - `/health`
  - `/v1/meta`
  - `/v1/consumer/dashboard`
  - `/v1/consumer/check-ins`
  - `/v1/clinical/dashboard`
  - `/v1/rcm/dashboard`
  - `/v1/ai/assist`
- The API is currently **demo-data driven** via `apps/api/src/lib/demo-data.ts`.
- Auth is JWT-capable, but in the absence of an `Authorization` header the API falls back to a demo platform admin context.
- Prisma is present for future persistence, but **no migration files or seed scripts** exist yet.
- Redis and S3 variables exist in `.env.example`, but the current application code does not consume them at runtime.

## Beta Architecture Decisions

### Chosen deployment model

Use **Terraform** to provision an isolated AWS beta environment in the existing account with:

- **Amazon ECR** for container registry
- **Amazon ECS Fargate** for:
  - `clarity-beta-web`
  - `clarity-beta-api`
- **Amazon RDS PostgreSQL** for forward-compatible beta persistence
- **Amazon S3** for beta asset storage
- **Application Load Balancer** for public HTTPS ingress
- **AWS Certificate Manager** for TLS
- **Route 53** DNS records in `claritybridgehealth.com`
- **AWS Secrets Manager** for runtime secrets and database credentials
- **CloudWatch Logs** for application logging
- **GitHub Actions** for CI/CD

### Why this is the best beta fit

- **Speed to beta:** two services on one ALB is the fastest path because the repo currently contains only one frontend and one API.
- **Production compatibility:** ECS Fargate + ECR + RDS + ALB maps cleanly to a future production environment.
- **Reasonable cost:** small Fargate tasks, a single ALB, one small RDS instance, and beta-only resources.
- **Security:** HTTPS termination at ALB, private ECS tasks, private RDS, secrets in Secrets Manager, least-privilege IAM.
- **Operational simplicity:** Terraform-managed infrastructure, predictable ECS rollouts, CloudWatch logging, GitHub Actions deployment flow.

## Service Layout

- `beta-app.claritybridgehealth.com` -> ALB -> ECS service `web`
- `beta-api.claritybridgehealth.com` -> ALB -> ECS service `api`
- `beta-clinical.claritybridgehealth.com` -> ALB -> ECS service `web`
  - This hostname will initially point to the same Next.js app because no separate clinical app exists in-repo.

## Containerization Strategy

- Keep one Docker image per runtime service:
  - `apps/web` -> Next.js standalone runtime image
  - `apps/api` -> Node runtime image with compiled TypeScript output
- Use **multi-stage Docker builds**
- Use **npm ci** with the repo lockfile for reproducible installs
- Add root `.dockerignore`
- Support container health checks through app endpoints and ALB target group checks

## Networking

- Reuse or create a dedicated **beta VPC**
- Public subnets for the ALB
- Private subnets for ECS tasks and RDS
- NAT gateway for outbound package/API access from private workloads if needed
- Security groups:
  - ALB: inbound `80/443` from internet
  - ECS services: inbound only from ALB
  - RDS: inbound only from ECS services

## DNS and TLS

- Request ACM certificate in the AWS region used by the ALB
- Validate certificate through Route 53
- Create Route 53 alias records for:
  - `beta-app.claritybridgehealth.com`
  - `beta-api.claritybridgehealth.com`
  - `beta-clinical.claritybridgehealth.com`

## Secrets Strategy

- Store application secrets in **AWS Secrets Manager**
- Use separate beta namespace, for example:
  - `clarity/beta/app`
  - `clarity/beta/api`
  - `clarity/beta/database`
- Runtime secrets will include:
  - `JWT_SECRET`
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `DATABASE_URL`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_APP_BASE_URL`
  - `CORS_ORIGINS`
  - optional `REDIS_URL`
  - optional `OPENAI_API_KEY` or other AI provider keys if the runtime starts using them

## Database and Migration Strategy

- Provision **RDS PostgreSQL** now for production alignment even though the current API is demo-data based.
- Add a safe beta workflow for:
  - Prisma client generation
  - schema migration deployment
  - optional seed/bootstrap commands
- Because no Prisma migrations currently exist, initial beta deployment will require:
  - generating the first migration from `prisma/schema.prisma`
  - running it as a controlled deployment step before enabling persistence-backed features

## Logging and Monitoring

- CloudWatch log group per ECS service
- ALB target group health checks
- ECS deployment circuit breaker enabled
- Basic CloudWatch alarms for:
  - unhealthy targets
  - ECS CPU/memory pressure
  - RDS CPU/storage
- Add a smoke-test checklist and rollback notes in launch docs

## CI/CD Decisions

- Keep validation on every PR/push
- Add beta deployment workflow triggered by:
  - push to `beta-deploy`
  - manual dispatch
- Deployment workflow responsibilities:
  - run validation
  - build web and api images
  - push to ECR
  - run Terraform plan/apply for beta
  - update ECS services with new image tags
  - wait for service stability

## Execution Assumptions

- Beta environment name will be **`beta`**
- AWS region default will be **`us-east-1`**
- Domain zone is **`claritybridgehealth.com`**
- Redis will be made **optional** at the infrastructure level because current runtime code does not require it yet
- `beta-clinical` will be served by the same Next.js deployment unless a separate clinical app is later introduced
