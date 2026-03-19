import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiService } from '../services/ai.service.js';

const aiSchema = z.object({
  action: z.enum(['recovery_coach', 'journaling_assist', 'weekly_insight', 'clinical_summary', 'denial_analysis']),
  prompt: z.string().min(1).max(4000)
});

export async function aiRoutes(app: FastifyInstance) {
  const aiService = new AiService();

  app.post('/v1/ai/assist', async (request, reply) => {
    await app.verifyTenantRole(request, ['consumer', 'clinician', 'case_manager', 'billing', 'org_admin', 'platform_admin']);
    const payload = aiSchema.parse(request.body);

    return reply.send(
      aiService.generate({
        tenantId: request.auth.tenantId,
        role: request.auth.role,
        ...payload
      })
    );
  });
}
