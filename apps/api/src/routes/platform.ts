import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasPlatformRole, requirePlatformRole } from '../lib/access/org-scope.js';
import { permissions } from '../lib/access/permissions.js';
import { requireRoutePermission } from '../lib/access/route-permissions.js';
import { prisma } from '../lib/db.js';
import { ResetSystemService } from '../services/reset-system.service.js';

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and hyphens only.'),
  npi: z.string().trim().max(20).optional().or(z.literal('')),
  taxId: z.string().trim().max(20).optional().or(z.literal(''))
});

const resetSystemSchema = z.object({
  confirmationText: z.string().trim().min(1)
});

type LoadedOrganization = Awaited<ReturnType<typeof loadOrganizations>>[number];

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildSubscriptionScaffold() {
  return {
    planName: 'Beta',
    subscriptionStatus: 'not_configured',
    billingStatus: 'scaffolding',
    billingCustomerId: null,
    nextInvoiceDate: null
  };
}

function resolveSupportSessionStatus(session: {
  endedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}) {
  if (session.revokedAt) {
    return 'revoked';
  }

  if (session.endedAt) {
    return 'ended';
  }

  if (session.expiresAt <= new Date()) {
    return 'expired';
  }

  return 'active';
}

async function loadOrganizations(tenantId: string) {
  return prisma.organization.findMany({
    where: {
      tenantId
    },
    orderBy: {
      createdAt: 'asc'
    },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true
            }
          }
        }
      },
      locations: {
        orderBy: {
          createdAt: 'asc'
        }
      },
      _count: {
        select: {
          consumers: true,
          locations: true,
          memberships: true,
          clinicalNotes: true,
          checkInReviews: true
        }
      }
    }
  });
}

async function loadPlatformUsers(tenantId: string) {
  return prisma.user.findMany({
    where: {
      tenantId,
      OR: [
        {
          role: {
            in: ['platform_admin', 'support']
          }
        },
        {
          platformRoles: {
            some: {}
          }
        }
      ]
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    include: {
      platformRoles: {
        select: {
          role: true
        }
      }
    }
  });
}

async function loadSupportSessionSummaries(args: {
  organizationIds: string[];
  recentTake?: number;
}) {
  if (!args.organizationIds.length) {
    return {
      active: [],
      recent: []
    };
  }

  const [active, recent] = await prisma.$transaction([
    prisma.supportAccessSession.findMany({
      where: {
        organizationId: {
          in: args.organizationIds
        },
        endedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    }),
    prisma.supportAccessSession.findMany({
      where: {
        organizationId: {
          in: args.organizationIds
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: args.recentTake ?? 12
    })
  ]);

  const supportUserIds = [...new Set([...active, ...recent].map((session) => session.supportUserId))];
  const supportUsers = supportUserIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: supportUserIds
          }
        },
        select: {
          id: true,
          fullName: true,
          email: true
        }
      })
    : [];

  const supportUserMap = new Map(supportUsers.map((user) => [user.id, user]));

  const toSummary = (session: (typeof recent)[number]) => ({
    id: session.id,
    organizationId: session.organizationId,
    supportUserId: session.supportUserId,
    supportUserName: supportUserMap.get(session.supportUserId)?.fullName ?? 'Unknown support user',
    supportUserEmail: supportUserMap.get(session.supportUserId)?.email ?? null,
    locationId: session.locationId,
    reason: session.reason,
    ticketReference: session.ticketRef,
    startedAt: session.startedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    revokedAt: session.revokedAt?.toISOString() ?? null,
    status: resolveSupportSessionStatus(session)
  });

  return {
    active: active.map(toSummary),
    recent: recent.map(toSummary)
  };
}

function serializePlatformUser(user: Awaited<ReturnType<typeof loadPlatformUsers>>[number]) {
  const platformRoles = user.platformRoles.length
    ? user.platformRoles.map((platformRole) => platformRole.role)
    : user.role === 'platform_admin' || user.role === 'support'
      ? [user.role]
      : [];

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
    role: user.role,
    platformRoles,
    createdAt: user.createdAt.toISOString()
  };
}

function serializeOrganizationSummary(
  organization: LoadedOrganization,
  activeSupportSessionsByOrganization: Record<string, number>
) {
  const activeMembers = organization.memberships.filter((membership) => membership.user.isActive);
  const orgAdmins = activeMembers.filter((membership) => membership.user.role === 'org_admin');

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    npi: organization.npi,
    taxId: organization.taxId,
    createdAt: organization.createdAt.toISOString(),
    counts: {
      users: activeMembers.length,
      totalMemberships: organization._count.memberships,
      consumers: organization._count.consumers,
      orgAdmins: orgAdmins.length,
      locations: organization._count.locations,
      activeSupportSessions: activeSupportSessionsByOrganization[organization.id] ?? 0,
      clinicalNotes: organization._count.clinicalNotes,
      unresolvedReviews: organization._count.checkInReviews
    },
    subscription: buildSubscriptionScaffold(),
    locations: organization.locations.map((location) => ({
      id: location.id,
      name: location.name,
      timezone: location.timezone,
      isActive: location.isActive
    }))
  };
}

export async function platformRoutes(app: FastifyInstance) {
  const resetSystemService = new ResetSystemService(app.log);

  app.get('/v1/platform/dashboard', async (request) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);

    const [tenant, organizations, platformUsers, totalOrgUsers, totalConsumers] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: access.tenantId }
      }),
      loadOrganizations(access.tenantId),
      loadPlatformUsers(access.tenantId),
      prisma.user.count({
        where: {
          tenantId: access.tenantId,
          memberships: {
            some: {
              organization: {
                tenantId: access.tenantId
              }
            }
          }
        }
      }),
      prisma.consumer.count({
        where: {
          tenantId: access.tenantId
        }
      })
    ]);

    const organizationIds = organizations.map((organization) => organization.id);
    const supportSessions = await loadSupportSessionSummaries({
      organizationIds
    });
    const activeSupportSessionsByOrganization = supportSessions.active.reduce<Record<string, number>>((accumulator, session) => {
      accumulator[session.organizationId] = (accumulator[session.organizationId] ?? 0) + 1;
      return accumulator;
    }, {});
    const organizationSummaries = organizations.map((organization) =>
      serializeOrganizationSummary(organization, activeSupportSessionsByOrganization)
    );

    return {
      tenant: tenant
        ? {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name
          }
        : {
            id: access.tenantId,
            slug: 'unknown',
            name: 'Unknown tenant'
          },
      summary: {
        totalOrganizations: organizationSummaries.length,
        totalPlatformUsers: platformUsers.length,
        totalOrgUsers,
        totalConsumers,
        activeSupportSessions: supportSessions.active.length,
        recentSupportSessions: supportSessions.recent.length,
        subscriptionsByStatus: [
          {
            status: 'not_configured',
            count: organizationSummaries.length
          }
        ]
      },
      billing: {
        isConfigured: false,
        plans: [
          {
            name: 'Beta',
            organizationCount: organizationSummaries.length
          }
        ],
        subscriptionsByStatus: [
          {
            status: 'not_configured',
            count: organizationSummaries.length
          }
        ],
        note: 'Billing, plans, and subscription lifecycle controls are scaffolded for beta but not wired to a payment processor yet.'
      },
      organizations: organizationSummaries,
      platformUsers: platformUsers.map(serializePlatformUser).slice(0, 8),
      support: {
        active: supportSessions.active.slice(0, 6),
        recent: supportSessions.recent.slice(0, 8)
      }
    };
  });

  app.get('/v1/platform/organizations', async (request) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);

    const organizations = await loadOrganizations(access.tenantId);
    const supportSessions = await loadSupportSessionSummaries({
      organizationIds: organizations.map((organization) => organization.id),
      recentTake: 50
    });
    const activeSupportSessionsByOrganization = supportSessions.active.reduce<Record<string, number>>((accumulator, session) => {
      accumulator[session.organizationId] = (accumulator[session.organizationId] ?? 0) + 1;
      return accumulator;
    }, {});

    return {
      organizations: organizations.map((organization) => serializeOrganizationSummary(organization, activeSupportSessionsByOrganization))
    };
  });

  app.post('/v1/platform/organizations', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsManage);
    requirePlatformRole(access, 'platform_admin');

    const payload = createOrganizationSchema.parse(request.body);
    const normalizedSlug = payload.slug.trim().toLowerCase();

    const existingOrganization = await prisma.organization.findFirst({
      where: {
        tenantId: access.tenantId,
        slug: normalizedSlug
      }
    });

    if (existingOrganization) {
      return reply.code(409).send({
        message: 'An organization already exists with that slug.'
      });
    }

    const createdOrganization = await prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          tenantId: access.tenantId,
          name: payload.name.trim(),
          slug: normalizedSlug,
          npi: normalizeOptionalString(payload.npi),
          taxId: normalizeOptionalString(payload.taxId)
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization.created',
          entityType: 'organization',
          entityId: organization.id,
          metadata: {
            name: organization.name,
            slug: organization.slug,
            npi: organization.npi,
            taxId: organization.taxId
          }
        }
      });

      return organization;
    });

    return reply.code(201).send({
      created: true,
      organization: {
        id: createdOrganization.id,
        name: createdOrganization.name,
        slug: createdOrganization.slug,
        npi: createdOrganization.npi,
        taxId: createdOrganization.taxId,
        createdAt: createdOrganization.createdAt.toISOString(),
        subscription: buildSubscriptionScaffold()
      }
    });
  });

  app.get('/v1/platform/organizations/:organizationId', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);
    const params = organizationParamsSchema.parse(request.params);

    const organization = await prisma.organization.findFirst({
      where: {
        id: params.organizationId,
        tenantId: access.tenantId
      },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                isActive: true
              }
            }
          }
        },
        locations: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        _count: {
          select: {
            consumers: true,
            memberships: true,
            locations: true,
            clinicalNotes: true,
            checkInReviews: true,
            appointments: true,
            encounters: true
          }
        }
      }
    });

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    const supportSessions = await loadSupportSessionSummaries({
      organizationIds: [organization.id],
      recentTake: 12
    });
    const activeSupportSessionsByOrganization = supportSessions.active.reduce<Record<string, number>>((accumulator, session) => {
      accumulator[session.organizationId] = (accumulator[session.organizationId] ?? 0) + 1;
      return accumulator;
    }, {});
    const activeMembers = organization.memberships.filter((membership) => membership.user.isActive);
    const orgAdmins = activeMembers.filter((membership) => membership.user.role === 'org_admin');

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        npi: organization.npi,
        taxId: organization.taxId,
        createdAt: organization.createdAt.toISOString(),
        counts: {
          users: activeMembers.length,
          totalMemberships: organization._count.memberships,
          consumers: organization._count.consumers,
          orgAdmins: orgAdmins.length,
          locations: organization._count.locations,
          activeSupportSessions: activeSupportSessionsByOrganization[organization.id] ?? 0,
          clinicalNotes: organization._count.clinicalNotes,
          unresolvedReviews: organization._count.checkInReviews,
          appointments: organization._count.appointments,
          encounters: organization._count.encounters
        },
        subscription: buildSubscriptionScaffold(),
        locations: organization.locations.map((location) => ({
          id: location.id,
          name: location.name,
          timezone: location.timezone,
          isActive: location.isActive
        })),
        orgAdmins: orgAdmins.map((membership) => ({
          id: membership.user.id,
          fullName: membership.user.fullName,
          email: membership.user.email,
          isActive: membership.user.isActive,
          role: membership.user.role
        }))
      },
      support: {
        active: supportSessions.active,
        recent: supportSessions.recent
      },
      lifecycle: {
        status: 'active',
        note: 'Organization lifecycle controls are scaffolded for beta. Provisioning, suspension, and archival workflows can land here next.'
      }
    };
  });

  app.get('/v1/platform/support/sessions', async (request) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);

    const organizations = await prisma.organization.findMany({
      where: {
        tenantId: access.tenantId
      },
      select: {
        id: true,
        name: true
      }
    });
    const organizationNameMap = new Map(organizations.map((organization) => [organization.id, organization.name]));
    const supportSessions = await loadSupportSessionSummaries({
      organizationIds: organizations.map((organization) => organization.id),
      recentTake: 25
    });

    return {
      activeSessions: supportSessions.active.map((session) => ({
        ...session,
        organizationName: organizationNameMap.get(session.organizationId) ?? 'Unknown organization'
      })),
      recentSessions: supportSessions.recent.map((session) => ({
        ...session,
        organizationName: organizationNameMap.get(session.organizationId) ?? 'Unknown organization'
      }))
    };
  });

  app.get('/v1/platform/users', async (request) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);

    const platformUsers = await loadPlatformUsers(access.tenantId);
    const counts = platformUsers.reduce<Record<string, number>>((accumulator, user) => {
      const serialized = serializePlatformUser(user);

      for (const role of serialized.platformRoles) {
        accumulator[role] = (accumulator[role] ?? 0) + 1;
      }

      return accumulator;
    }, {});

    return {
      users: platformUsers.map(serializePlatformUser),
      counts: {
        total: platformUsers.length,
        active: platformUsers.filter((user) => user.isActive).length,
        platformAdmins: counts.platform_admin ?? 0,
        supportUsers: counts.support ?? 0
      },
      accessModel: {
        platformAdmin: 'Owns the SaaS control plane, organizations, plans, feature access, and audit posture.',
        platformSupport: 'Uses scoped support mode to enter an organization without becoming the platform control plane.'
      }
    };
  });

  app.post('/v1/platform/system/reset', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformSystemReset);
    requirePlatformRole(access, 'platform_admin');

    if (access.supportMode || access.activeOrganizationId) {
      return reply.code(403).send({
        message: 'System Reset is only available from the platform control plane, not support mode or organization-scoped access.'
      });
    }

    if (!ResetSystemService.isEnabled()) {
      return reply.code(403).send({ message: 'System reset is only enabled in the beta environment.' });
    }

    const payload = resetSystemSchema.parse(request.body);

    if (payload.confirmationText !== 'RESET SYSTEM') {
      return reply.code(400).send({ message: 'Type RESET SYSTEM exactly to confirm the platform reset.' });
    }

    const result = await resetSystemService.resetSystem(access);
    return reply.send(result);
  });
}
