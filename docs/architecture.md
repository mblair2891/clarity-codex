# Architecture Decision Summary

## Product posture

Clarity Bridge Health is designed as a **multi-tenant behavioral health SaaS platform** spanning three experience layers:

1. **Consumer recovery operations** – check-ins, journaling, coping plans, condition-aware recovery tracking.
2. **Clinical operations** – intakes, treatment plans, group programming, notes, medications, and alerts.
3. **Revenue cycle management** – eligibility, coverage, encounters, charges, claims, remittances, denials, and aging.

## Chosen architecture

### Runtime

- **Web:** Next.js App Router deployed to AWS ECS behind an Application Load Balancer for operational consistency with the API.
- **API:** Fastify + TypeScript service deployed on AWS ECS Fargate.
- **Worker pattern:** Redis-backed asynchronous processing for reminders, claim follow-up, AI summarization, and alert fan-out.

### Data platform

- **Primary database:** PostgreSQL 16 on Amazon RDS.
- **ORM / schema:** Prisma for relational modeling and migration discipline.
- **Cache / queue:** Redis (Amazon ElastiCache / Valkey-compatible).
- **Object storage:** Amazon S3 for document uploads, exports, and AI-safe artifacts.

### Security and privacy

- Multi-tenant partitioning enforced by `tenantId` on domain tables.
- RBAC roles for platform, organization, clinic, finance, and consumer personas.
- JWT auth with explicit tenant and role claims.
- Audit logging for user and AI actions.
- AI guardrails prohibit diagnosis, substance optimization guidance, and unsafe recovery recommendations.

### Deployability

- Containerized services with separate API and web Dockerfiles.
- GitHub Actions for CI and staged promotion.
- Terraform-ready AWS deployment reference in `infra/aws`.

## Domain boundaries

- **Identity & access** – users, memberships, sessions, tenant context, consent.
- **Consumer recovery** – check-ins, cravings, triggers, relapses, goals, routines, support network.
- **Co-occurring conditions** – profiles, symptom logs, trigger accommodations, cognitive assist preferences.
- **Clinical care** – appointments, notes, groups, treatment plans, medications, chart summaries.
- **RCM** – payers, plans, coverage, authorizations, encounters, claims, remittances, denials, ledger.
- **AI governance** – prompt registry, runs, usage metrics, risk scores, guardrail events.

## Frontend experience model

The initial web implementation uses a single Next.js shell with role-aware navigation for:

- **Consumer Hub**
- **Clinical Command Center**
- **RCM Workbench**
- **Tenant Administration**

Two product-wide accessibility modes are first-class:

- **Trauma-informed mode** – softer surfaces, reduced urgency cues, calmer content framing.
- **Cognitive assist mode** – simplified hierarchy, chunked actions, prominent task guidance.

## Launch strategy

The codebase is scaffolded for immediate founder-stage operation with:

- a single monorepo,
- shared TypeScript domain package,
- database-ready schema,
- production-friendly service boundaries,
- and documentation sufficient to stand up staging and production environments.
