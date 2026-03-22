import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      tenantId: string;
      role: string;
      userId: string;
      organizationIds: string[];
      consumerId: string | null;
    };
  }
}

async function authPlugin(app: FastifyInstance) {
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
        if (env.APP_ENV === 'local') {
          request.auth = {
            tenantId: 'tenant_demo',
            role: 'platform_admin',
            userId: 'demo_user',
            organizationIds: [],
            consumerId: null
          };
          return;
        }

        const error = new Error('Authentication required.') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const decoded = await request.jwtVerify<{ sub: string }>();
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          memberships: {
            select: {
              organizationId: true
            }
          }
        }
      });

      if (!user || !user.isActive) {
        const error = new Error('Authenticated user is inactive or missing.') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      request.auth = {
        tenantId: user.tenantId,
        role: user.role,
        userId: user.id,
        organizationIds: user.memberships.map((membership) => membership.organizationId),
        consumerId: user.consumerId ?? null
      };

      if (requiredRoles && !requiredRoles.includes(request.auth.role)) {
        const error = new Error('Role does not have access to this resource.') as Error & { statusCode?: number };
        error.statusCode = 403;
        throw error;
      }
    }
  );
}

export const registerAuth = fp(authPlugin, {
  name: 'register-auth'
});

declare module 'fastify' {
  interface FastifyInstance {
    verifyTenantRole: (request: FastifyRequest, requiredRoles?: string[]) => Promise<void>;
  }
}
