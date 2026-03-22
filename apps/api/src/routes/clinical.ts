import type { FastifyInstance } from 'fastify';
import { demoClinical } from '../lib/demo-data.js';
import { clinicalAccessRoles } from '../lib/roles.js';

export async function clinicalRoutes(app: FastifyInstance) {
  app.get('/v1/clinical/dashboard', async (request) => {
    await app.verifyTenantRole(request, clinicalAccessRoles);
    return demoClinical;
  });
}
