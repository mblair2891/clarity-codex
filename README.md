# Clarity Bridge Health

Clarity Bridge Health is a production-oriented behavioral health SaaS monorepo for recovery tracking, clinical workflows, revenue cycle management, and guarded AI-assisted operations.

## Stack

- **Frontend:** Next.js App Router, TypeScript, accessible trauma-informed design system primitives.
- **Backend:** Fastify, Zod, JWT-based RBAC, modular service layer, audit-first request handling.
- **Data:** PostgreSQL + Prisma multi-tenant schema, Redis for queue/cache, S3-compatible object storage.
- **Infrastructure:** Dockerized local stack, AWS reference deployment (ECS Fargate, RDS, ElastiCache, S3, CloudFront, GitHub Actions).
- **AI Safety:** Prompt registry, auditable AI actions, role-aware safety boundaries, diagnosis avoidance.

## Monorepo layout

- `apps/web` – consumer, clinician, and admin web experience.
- `apps/api` – multi-tenant API and orchestration services.
- `packages/domain` – shared domain types, navigation, risk helpers, and product constants.
- `prisma` – relational schema for SaaS, clinical, RCM, and AI governance domains.
- `docs` – architecture, environments, deployment, and operations runbooks.
- `infra` – local Docker stack and AWS deployment reference.

## Quick start

1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`.
3. Format Prisma schema: `npm run prisma:format`.
4. Start local services: `docker compose up -d` from `infra/local` once created in your environment or provision equivalents.
5. Run the API: `npm run dev:api`.
6. Run the web app: `npm run dev:web`.

## Quality gates

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

## Documentation

- [Architecture](docs/architecture.md)
- [Environment strategy](docs/environment.md)
- [Deployment guide](docs/deployment.md)
- [Operations guide](docs/operations.md)
