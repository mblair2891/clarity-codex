import type { FastifyInstance } from 'fastify';
import { conditionCatalog, navigation } from '@clarity/domain';

export async function metaRoutes(app: FastifyInstance) {
  app.get('/v1/meta', async () => ({
    product: 'Clarity Bridge Health',
    navigation,
    conditionCatalog
  }));
}
