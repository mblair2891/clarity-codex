import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerAuth } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { consumerRoutes } from './routes/consumer.js';
import { clinicalRoutes } from './routes/clinical.js';
import { rcmRoutes } from './routes/rcm.js';
import { aiRoutes } from './routes/ai.js';
import { AuditService } from './services/audit.service.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  const audit = new AuditService(app.log);

  app.register(cors, { origin: true });
  app.register(registerAuth);
  app.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/v1')) {
      audit.record({
        tenantId: request.auth?.tenantId ?? 'unknown',
        userId: request.auth?.userId,
        action: `${request.method} ${request.url}`,
        entityType: 'api_request',
        metadata: { statusCode: reply.statusCode }
      });
    }
  });

  app.register(healthRoutes);
  app.register(metaRoutes);
  app.register(consumerRoutes);
  app.register(clinicalRoutes);
  app.register(rcmRoutes);
  app.register(aiRoutes);

  app.get('/', async () => ({
    name: 'Clarity Bridge Health API',
    environment: env.APP_ENV,
    docs: '/v1/meta'
  }));

  return app;
}
