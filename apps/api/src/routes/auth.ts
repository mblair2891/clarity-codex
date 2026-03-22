import type { Role, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';
import { getLandingPath } from '../lib/roles.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(1).default('beta-demo')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const betaLoginSchema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
  tenantSlug: z.string().min(1).default('beta-demo')
});

async function buildAuthPayload(app: FastifyInstance, user: User & {
  tenant: { id: string; slug: string; name: string };
  memberships: Array<{
    organization: {
      id: string;
      name: string;
      npi: string | null;
    };
  }>;
}) {
  const token = await app.jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role
    },
    {
      sub: user.id,
      aud: env.JWT_AUDIENCE
    }
  );

  return {
    token,
    landingPath: getLandingPath(user.role),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword
    },
    tenant: {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name
    },
    organization: user.memberships[0]?.organization
      ? {
          id: user.memberships[0].organization.id,
          name: user.memberships[0].organization.name,
          npi: user.memberships[0].organization.npi
        }
      : null
  };
}

async function loadUserForAuth(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' },
        take: 1
      }
    }
  });
}

async function loadUserByTenantAndEmail(tenantSlug: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      tenant: {
        slug: tenantSlug
      }
    },
    include: {
      tenant: true,
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' },
        take: 1
      }
    }
  });
}

function ensureSupportedEnvironment(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
  if (!['local', 'beta', 'staging'].includes(env.APP_ENV)) {
    return reply.code(404).send({ message: 'Beta login is not enabled in this environment.' });
  }

  return null;
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/v1/auth/login', async (request, reply) => {
    const environmentError = ensureSupportedEnvironment(reply);
    if (environmentError) {
      return environmentError;
    }

    const { email, password, tenantSlug } = loginSchema.parse(request.body);
    const user = await loadUserByTenantAndEmail(tenantSlug, email);

    if (!user || !user.passwordHash || !user.isActive) {
      return reply.code(401).send({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      return reply.code(401).send({ message: 'Invalid email or password.' });
    }

    return reply.send(await buildAuthPayload(app, user));
  });

  app.post('/v1/auth/beta-login', async (request, reply) => {
    const environmentError = ensureSupportedEnvironment(reply);
    if (environmentError) {
      return environmentError;
    }

    if (!env.BETA_LOGIN_CODE) {
      return reply.code(503).send({ message: 'Beta login is not configured on this API.' });
    }

    const { email, accessCode, tenantSlug } = betaLoginSchema.parse(request.body);
    if (accessCode !== env.BETA_LOGIN_CODE) {
      return reply.code(401).send({ message: 'Invalid beta login credentials.' });
    }

    const user = await loadUserByTenantAndEmail(tenantSlug, email);
    if (!user || !user.isActive || user.role !== 'platform_admin') {
      return reply.code(401).send({ message: 'Legacy beta access is limited to platform administrators.' });
    }

    return reply.send(await buildAuthPayload(app, user));
  });

  app.post('/v1/auth/change-password', async (request) => {
    await app.verifyTenantRole(request);

    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId }
    });

    if (!user || !user.passwordHash || !user.isActive) {
      const error = new Error('Authenticated user was not found.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const passwordMatches = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      const error = new Error('Current password is incorrect.') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false
      }
    });

    return { updated: true };
  });

  app.get('/v1/auth/me', async (request) => {
    await app.verifyTenantRole(request);

    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const user = await loadUserForAuth(auth.userId);

    if (!user || !user.isActive) {
      const error = new Error('Authenticated user was not found.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    return {
      landingPath: getLandingPath(user.role as Role),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name
      },
      organization: user.memberships[0]?.organization
        ? {
            id: user.memberships[0].organization.id,
            name: user.memberships[0].organization.name,
            npi: user.memberships[0].organization.npi
          }
        : null
    };
  });
}
