import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { buildLocalAccessContext, resolveAccessContext } from '../lib/access/resolve-access-context.js';
import type { AccessContext, SessionJwtPayload } from '../lib/access/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    access?: AccessContext;
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

  app.decorateRequest('access', undefined);

  app.decorate(
    'authenticateRequest',
    async (request: FastifyRequest) => {
      if (request.access) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader) {
        if (env.APP_ENV === 'local') {
          request.access = buildLocalAccessContext();
          return;
        }

        const error = new Error('Authentication required.') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const decoded = await request.jwtVerify<SessionJwtPayload>();
      request.access = await resolveAccessContext(decoded);
    }
  );
}

export const registerAuth = fp(authPlugin, {
  name: 'register-auth'
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticateRequest: (request: FastifyRequest) => Promise<void>;
  }
}
