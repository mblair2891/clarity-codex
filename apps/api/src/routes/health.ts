import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export async function healthRoutes(app: FastifyInstance) {
  const healthPayload = () => ({
    status: 'ok',
    service: 'clarity-api',
    environment: env.APP_ENV,
    dependencies: {
      database: env.DATABASE_URL ? 'configured' : 'not_configured',
      redis: env.REDIS_URL ? 'configured' : 'not_configured',
      s3: env.S3_BUCKET ? 'configured' : 'not_configured',
      ai: env.AI_PROVIDER
    }
  });

  app.get('/health', async () => healthPayload());
  app.get('/ready', async () => healthPayload());
}
