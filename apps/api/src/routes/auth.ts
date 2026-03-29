import type { OrganizationRole, PlatformRole, Role, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';
import { deriveLegacyPlatformRoles } from '../lib/access/types.js';
import { permissions, resolvePermissions } from '../lib/access/permissions.js';
import { requireRequestAccess, requireRoutePermission } from '../lib/access/route-permissions.js';
import { getLandingPathForAccess } from '../lib/roles.js';
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

const supportStartSchema = z.object({
  organizationId: z.string().min(1),
  locationId: z.string().min(1).optional(),
  reason: z.string().min(3).max(500),
  ticketReference: z.string().max(120).optional()
});

const sessionDurationMs = 8 * 60 * 60 * 1000;
const supportSessionDurationMs = 2 * 60 * 60 * 1000;

async function buildAuthPayload(app: FastifyInstance, user: User & {
  tenant: { id: string; slug: string; name: string };
  memberships: Array<{
    id: string;
    organizationRole: OrganizationRole | null;
    organization: {
      id: string;
      name: string;
      npi: string | null;
    };
  }>;
  platformRoles: Array<{
    role: PlatformRole;
  }>;
}) {
  const [singleMembership] = user.memberships;
  const activeMembership = user.memberships.length === 1 ? singleMembership ?? null : null;
  const platformRoles = user.platformRoles.length
    ? user.platformRoles.map((platformRole) => platformRole.role)
    : deriveLegacyPlatformRoles(user.role);
  const resolvedPermissions = resolvePermissions({
    platformRoles,
    organizationRole: activeMembership?.organizationRole ?? null,
    legacyRole: user.role
  });
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      activeOrganizationId: activeMembership?.organization.id ?? null,
      activeMembershipId: activeMembership?.id ?? null,
      supportMode: false,
      expiresAt: new Date(Date.now() + sessionDurationMs)
    }
  });
  const token = await signSessionToken(app, {
    user,
    session,
    platformRoles
  });

  return {
    token,
    landingPath: getLandingPathForAccess({
      role: user.role,
      platformRoles,
      activeOrganizationId: session.activeOrganizationId,
      supportMode: session.supportMode
    }),
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
    accessContext: {
      type: session.supportMode ? 'SUPPORT' : 'USER',
      platformRoles,
      activeOrganizationId: session.activeOrganizationId,
      activeMembershipId: session.activeMembershipId,
      activeLocationId: session.activeLocationId,
      supportMode: session.supportMode,
      permissions: resolvedPermissions
    },
    organization: activeMembership?.organization
      ? {
          id: activeMembership.organization.id,
          name: activeMembership.organization.name,
          npi: activeMembership.organization.npi
        }
      : null,
    location: null,
    supportSession: null
  };
}

async function signSessionToken(
  app: FastifyInstance,
  args: {
    user: Pick<User, 'id' | 'tenantId' | 'role'>;
    session: {
      id: string;
      activeOrganizationId: string | null;
      activeMembershipId: string | null;
      activeLocationId: string | null;
      supportMode: boolean;
      supportAccessSessionId: string | null;
    };
    platformRoles: PlatformRole[];
  }
) {
  const token = await app.jwt.sign(
    {
      type: args.session.supportMode ? 'SUPPORT' : 'USER',
      tenantId: args.user.tenantId,
      role: args.user.role,
      sid: args.session.id,
      platformRoles: args.platformRoles,
      activeOrganizationId: args.session.activeOrganizationId,
      activeMembershipId: args.session.activeMembershipId,
      activeLocationId: args.session.activeLocationId,
      supportMode: args.session.supportMode,
      supportAccessSessionId: args.session.supportAccessSessionId
    },
    {
      sub: args.user.id,
      aud: env.JWT_AUDIENCE
    }
  );

  return token;
}

async function loadUserForAuth(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      platformRoles: {
        select: {
          role: true
        }
      },
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' }
      }
    }
  });
}

async function loadUserByTenantAndEmail(tenantSlug: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return prisma.user.findFirst({
    where: {
      tenant: {
        slug: tenantSlug
      },
      OR: [
        {
          normalizedEmail
        },
        {
          email: normalizedEmail
        }
      ]
    },
    include: {
      tenant: true,
      platformRoles: {
        select: {
          role: true
        }
      },
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' }
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
    await app.authenticateRequest(request);
    const access = requireRequestAccess(request);

    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { id: access.userId }
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
    await app.authenticateRequest(request);
    const access = requireRequestAccess(request);

    const user = await loadUserForAuth(access.userId);

    if (!user || !user.isActive) {
      const error = new Error('Authenticated user was not found.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const [activeMembership, activeLocation, supportAccessSession] = await Promise.all([
      Promise.resolve(
      user.memberships.find((membership) => membership.id === access.activeMembershipId)
      ?? user.memberships.find((membership) => membership.organization.id === access.activeOrganizationId)
      ?? null
      ),
      access.activeLocationId
        ? prisma.location.findUnique({
            where: { id: access.activeLocationId }
          })
        : Promise.resolve(null),
      access.supportAccessSessionId
        ? prisma.supportAccessSession.findUnique({
            where: { id: access.supportAccessSessionId }
          })
        : Promise.resolve(null)
    ]);

    return {
      landingPath: getLandingPathForAccess({
        role: user.role as Role,
        platformRoles: access.platformRoles,
        activeOrganizationId: access.activeOrganizationId,
        supportMode: access.supportMode
      }),
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
      accessContext: {
        type: access.type,
        platformRoles: access.platformRoles,
        activeOrganizationId: access.activeOrganizationId,
        activeMembershipId: access.activeMembershipId,
        activeLocationId: access.activeLocationId,
        supportMode: access.supportMode,
        permissions: access.permissions
      },
      organization: activeMembership?.organization
        ? {
            id: activeMembership.organization.id,
            name: activeMembership.organization.name,
            npi: activeMembership.organization.npi
          }
        : null,
      location: activeLocation
        ? {
            id: activeLocation.id,
            name: activeLocation.name,
            timezone: activeLocation.timezone
          }
        : null,
      supportSession: supportAccessSession
        ? {
            id: supportAccessSession.id,
            reason: supportAccessSession.reason,
            ticketReference: supportAccessSession.ticketRef,
            startedAt: supportAccessSession.startedAt.toISOString(),
            expiresAt: supportAccessSession.expiresAt.toISOString()
          }
        : null
    };
  });

  app.post('/v1/platform/support/start', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformSupportAccess);
    if (!access.sessionId) {
      return reply.code(400).send({ message: 'A session-backed login is required to start support mode.' });
    }

    const payload = supportStartSchema.parse(request.body);
    const [user, userSession, organization, location] = await Promise.all([
      loadUserForAuth(access.userId),
      prisma.userSession.findUnique({
        where: { id: access.sessionId }
      }),
      prisma.organization.findUnique({
        where: { id: payload.organizationId }
      }),
      payload.locationId
        ? prisma.location.findUnique({
            where: { id: payload.locationId }
          })
        : Promise.resolve(null)
    ]);

    if (!user || !user.isActive) {
      return reply.code(401).send({ message: 'Authenticated user was not found.' });
    }

    if (!userSession || userSession.userId !== access.userId || userSession.revokedAt || userSession.expiresAt <= new Date()) {
      return reply.code(401).send({ message: 'Authenticated session is invalid or expired.' });
    }

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    if (organization.tenantId !== access.tenantId) {
      return reply.code(403).send({ message: 'Support access is limited to organizations in your tenant.' });
    }

    if (payload.locationId && (!location || location.organizationId !== organization.id)) {
      return reply.code(404).send({ message: 'Location was not found in the requested organization.' });
    }

    const platformRoles = user.platformRoles.length
      ? user.platformRoles.map((platformRole) => platformRole.role)
      : deriveLegacyPlatformRoles(user.role);

    const expiresAt = new Date(Math.min(userSession.expiresAt.getTime(), Date.now() + supportSessionDurationMs));
    const supportAccessSession = await prisma.$transaction(async (transaction) => {
      if (userSession.supportAccessSessionId) {
        await transaction.supportAccessSession.updateMany({
          where: {
            id: userSession.supportAccessSessionId,
            supportUserId: access.userId,
            endedAt: null
          },
          data: {
            endedAt: new Date()
          }
        });
      }

      const created = await transaction.supportAccessSession.create({
        data: {
          supportUserId: access.userId,
          organizationId: organization.id,
          locationId: location?.id ?? null,
          reason: payload.reason.trim(),
          ticketRef: payload.ticketReference?.trim() ?? null,
          expiresAt
        }
      });

      await transaction.userSession.update({
        where: { id: userSession.id },
        data: {
          supportMode: true,
          supportAccessSessionId: created.id,
          activeOrganizationId: organization.id,
          activeMembershipId: null,
          activeLocationId: location?.id ?? null
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: organization.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          sessionId: userSession.id,
          supportAccessSessionId: created.id,
          supportMode: true,
          action: 'platform.support.started',
          entityType: 'support_access_session',
          entityId: created.id,
          metadata: {
            locationId: location?.id ?? null,
            reason: payload.reason.trim(),
            ticketReference: payload.ticketReference?.trim() ?? null,
            expiresAt: created.expiresAt
          }
        }
      });

      return created;
    });

    const token = await signSessionToken(app, {
      user,
      session: {
        id: userSession.id,
        activeOrganizationId: organization.id,
        activeMembershipId: null,
        activeLocationId: location?.id ?? null,
        supportMode: true,
        supportAccessSessionId: supportAccessSession.id
      },
      platformRoles
    });

    return reply.send({
      token,
      supportSession: {
        id: supportAccessSession.id,
        organizationId: organization.id,
        locationId: location?.id ?? null,
        reason: supportAccessSession.reason,
        ticketReference: supportAccessSession.ticketRef,
        supportMode: true,
        expiresAt: supportAccessSession.expiresAt
      }
    });
  });

  app.post('/v1/platform/support/end', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformSupportAccess);
    if (!access.sessionId) {
      return reply.code(400).send({ message: 'A session-backed login is required to end support mode.' });
    }

    const [user, userSession] = await Promise.all([
      loadUserForAuth(access.userId),
      prisma.userSession.findUnique({
        where: { id: access.sessionId }
      })
    ]);

    if (!user || !user.isActive) {
      return reply.code(401).send({ message: 'Authenticated user was not found.' });
    }

    if (!userSession || userSession.userId !== access.userId || userSession.revokedAt || userSession.expiresAt <= new Date()) {
      return reply.code(401).send({ message: 'Authenticated session is invalid or expired.' });
    }

    if (!userSession.supportMode || !userSession.supportAccessSessionId) {
      return reply.code(400).send({ message: 'No active support session is attached to this login session.' });
    }

    const platformRoles = user.platformRoles.length
      ? user.platformRoles.map((platformRole) => platformRole.role)
      : deriveLegacyPlatformRoles(user.role);
    const previousSupportAccessSessionId = userSession.supportAccessSessionId;
    const previousOrganizationId = userSession.activeOrganizationId;

    await prisma.$transaction(async (transaction) => {
      await transaction.supportAccessSession.updateMany({
        where: {
          id: previousSupportAccessSessionId,
          supportUserId: access.userId,
          endedAt: null
        },
        data: {
          endedAt: new Date()
        }
      });

      await transaction.userSession.update({
        where: { id: userSession.id },
        data: {
          supportMode: false,
          supportAccessSessionId: null,
          activeOrganizationId: null,
          activeMembershipId: null,
          activeLocationId: null
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: previousOrganizationId,
          sessionId: userSession.id,
          supportAccessSessionId: previousSupportAccessSessionId,
          supportMode: false,
          action: 'platform.support.ended',
          entityType: 'support_access_session',
          entityId: previousSupportAccessSessionId,
          metadata: {
            previousOrganizationId
          }
        }
      });
    });

    const token = await signSessionToken(app, {
      user,
      session: {
        id: userSession.id,
        activeOrganizationId: null,
        activeMembershipId: null,
        activeLocationId: null,
        supportMode: false,
        supportAccessSessionId: null
      },
      platformRoles
    });

    return reply.send({
      token,
      supportSessionEnded: true
    });
  });
}
