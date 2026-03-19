import type { FastifyInstance } from 'fastify';
import { demoRcm } from '../lib/demo-data.js';

export async function rcmRoutes(app: FastifyInstance) {
  app.get('/v1/rcm/dashboard', async (request) => {
    await app.verifyTenantRole(request, ['billing', 'org_admin', 'platform_admin']);
    return demoRcm;
  });
}
