# Environment Strategy

## Environments

- **Local:** Docker-backed PostgreSQL, Redis, and S3-compatible storage for developer workflows.
- **Staging:** Isolated AWS account or isolated workload/environment namespace with scrubbed synthetic data only.
- **Production:** Dedicated AWS production environment with restricted IAM, production secrets, backups, and monitoring.

## Configuration model

Store runtime configuration in environment variables validated at startup.

### Shared variables

- `APP_ENV` – `local`, `staging`, or `production`
- `NODE_ENV` – framework runtime mode
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_*`

### Secret management

- **Production:** AWS Secrets Manager for application secrets and database credentials.
- **Staging:** AWS Secrets Manager with separate secret namespace.
- **Local:** `.env` file excluded from git.

## Promotion workflow

1. Merge to `main` triggers CI.
2. CI builds, tests, and produces signed container images.
3. Deployment workflow applies infrastructure and rolls ECS services in staging.
4. Production is promoted from the same image digest after approval.
