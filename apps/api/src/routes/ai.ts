import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { permissions } from '../lib/access/permissions.js';
import { requireRoutePermission } from '../lib/access/route-permissions.js';
import { AiService } from '../services/ai.service.js';

const aiSchema = z.object({
  action: z.enum(['recovery_coach', 'journaling_assist', 'weekly_insight', 'clinical_summary', 'denial_analysis']),
  prompt: z.string().min(1).max(4000)
});

export async function aiRoutes(app: FastifyInstance) {
  const aiService = new AiService();

  app.post('/v1/ai/assist', async (request, reply) => {
    await app.authenticateRequest(request);
    requireRoutePermission(request, permissions.aiAssistUse);
    const access = request.access;
    const payload = aiSchema.parse(request.body);

    if (!access) {
      throw new Error('Authentication context was not established.');
    }

    return reply.send(
      aiService.generate({
        tenantId: access.tenantId,
        role: access.legacyRole,
        ...payload
      })
    );
  });
}
