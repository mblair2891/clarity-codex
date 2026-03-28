import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { demoConsumer } from '../lib/demo-data.js';
import { RiskService } from '../services/risk.service.js';

const checkInSchema = z.object({
  mood: z.number().min(1).max(10),
  cravings: z.number().min(0).max(10),
  sleepHours: z.number().min(0).max(24).optional(),
  gratitude: z.string().max(280).optional()
});

export async function consumerRoutes(app: FastifyInstance) {
  const riskService = new RiskService();

  app.get('/v1/consumer/dashboard', async (request) => {
    await app.verifyTenantRole(request, ['consumer', 'clinician', 'case_manager', 'platform_admin']);

    const risk = riskService.assess({
      cravingsLevel: 4,
      relapseCount30d: 0,
      ptsdFlashbackIntensity: 6,
      depressionSeverity: 5,
      engagementScore: 7,
      protectiveContacts: demoConsumer.supportContacts.length
    });

    return { consumer: demoConsumer, risk };
  });

  app.post('/v1/consumer/check-ins', async (request, reply) => {
    await app.verifyTenantRole(request, ['consumer', 'clinician', 'case_manager', 'platform_admin']);
    const payload = checkInSchema.parse(request.body);
    return reply.code(201).send({ created: true, payload });
  });
}
