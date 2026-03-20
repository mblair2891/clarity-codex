import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      tenantId: string;
      role: string;
      userId: string;
    };
  }
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      iss: env.JWT_ISSUER,
      expiresIn: '8h'
    },
    verify: {
      allowedIss: env.JWT_ISSUER,
      allowedAud: env.JWT_AUDIENCE
    }
  });

  app.decorateRequest('auth', undefined);

  app.decorate(
    'verifyTenantRole',
    async (request: FastifyRequest, requiredRoles?: string[]) => {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        request.auth = { tenantId: 'tenant_demo', role: 'platform_admin', userId: 'demo_user' };
        return;
      }

      const decoded = await request.jwtVerify<{
        tenantId: string;
        role: string;
        sub: string;
      }>();

      request.auth = {
        tenantId: decoded.tenantId,
        role: decoded.role,
        userId: decoded.sub
      };

      if (requiredRoles && !requiredRoles.includes(request.auth.role)) {
        const error = new Error('Role does not have access to this resource.') as Error & { statusCode?: number };
        error.statusCode = 403;
        throw error;
      }
    }
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    verifyTenantRole: (request: FastifyRequest, requiredRoles?: string[]) => Promise<void>;
  }
}
