import Fastify from 'fastify';
import cors from '@fastify/cors';
import { corsOrigins, env } from './config/env.js';
import { registerAuth } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { consumerRoutes } from './routes/consumer.js';
import { clinicalRoutes } from './routes/clinical.js';
import { rcmRoutes } from './routes/rcm.js';
import { aiRoutes } from './routes/ai.js';
import { AuditService } from './services/audit.service.js';

function isAllowedCorsOrigin(origin: string) {
  if (corsOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && /\.app\.github\.dev$/.test(url.hostname);
  } catch {
    return false;
  }
}

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });
  const audit = new AuditService(app.log);

  app.register(cors, {
    origin(origin, callback) {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    }
  });
  app.register(registerAuth);
  app.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/v1')) {
      audit.record({
        tenantId: request.access?.tenantId ?? 'unknown',
        userId: request.access?.userId,
        organizationId: request.access?.activeOrganizationId ?? null,
        sessionId: request.access?.sessionId ?? null,
        supportAccessSessionId: request.access?.supportAccessSessionId ?? null,
        supportMode: request.access?.supportMode ?? false,
        action: `${request.method} ${request.url}`,
        entityType: 'api_request',
        metadata: {
          statusCode: reply.statusCode,
          sessionId: request.access?.sessionId ?? null,
          supportAccessSessionId: request.access?.supportAccessSessionId ?? null,
          supportMode: request.access?.supportMode ?? false,
          organizationId: request.access?.activeOrganizationId ?? null
        }
      });
    }
  });

  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(metaRoutes);
  app.register(adminRoutes);
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
