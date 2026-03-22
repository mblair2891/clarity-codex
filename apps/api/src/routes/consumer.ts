import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { demoConsumer } from '../lib/demo-data.js';
import { prisma } from '../lib/db.js';
import { RiskService } from '../services/risk.service.js';
import { consumerAccessRoles } from '../lib/roles.js';

const checkInSchema = z.object({
  mood: z.number().min(1).max(10),
  cravings: z.number().min(0).max(10),
  sleepHours: z.number().min(0).max(24).optional(),
  gratitude: z.string().max(280).optional()
});

export async function consumerRoutes(app: FastifyInstance) {
  const riskService = new RiskService();

  app.get('/v1/consumer/dashboard', async (request) => {
    await app.verifyTenantRole(request, consumerAccessRoles);

    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    if (auth.role === 'consumer' && !auth.consumerId) {
      const error = new Error('Consumer account is not linked to a consumer record.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    const consumerData = auth.consumerId
      ? await prisma.consumer.findUnique({
          where: { id: auth.consumerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            traumaMode: true,
            cognitiveAssistMode: true
          }
        })
      : null;

    if (auth.role === 'consumer' && !consumerData) {
      const error = new Error('Linked consumer record was not found.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const risk = riskService.assess({
      cravingsLevel: 4,
      relapseCount30d: 0,
      ptsdFlashbackIntensity: 6,
      depressionSeverity: 5,
      engagementScore: 7,
      protectiveContacts: demoConsumer.supportContacts.length
    });

    return {
      consumer: consumerData
        ? {
            ...demoConsumer,
            id: consumerData.id,
            firstName: consumerData.firstName,
            lastName: consumerData.lastName,
            traumaMode: consumerData.traumaMode,
            cognitiveAssistMode: consumerData.cognitiveAssistMode
          }
        : demoConsumer,
      risk
    };
  });

  app.post('/v1/consumer/check-ins', async (request, reply) => {
    await app.verifyTenantRole(request, consumerAccessRoles);
    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    if (auth.role === 'consumer' && !auth.consumerId) {
      const error = new Error('Consumer account is not linked to a consumer record.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    const payload = checkInSchema.parse(request.body);
    return reply.code(201).send({
      created: true,
      consumerId: auth.consumerId ?? null,
      payload
    });
  });
}
