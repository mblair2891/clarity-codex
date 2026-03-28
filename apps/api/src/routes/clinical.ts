import type { FastifyInstance } from 'fastify';
import { demoClinical } from '../lib/demo-data.js';

export async function clinicalRoutes(app: FastifyInstance) {
  app.get('/v1/clinical/dashboard', async (request) => {
    await app.verifyTenantRole(request, ['clinician', 'case_manager', 'org_admin', 'platform_admin']);
    return demoClinical;
  });
}
