import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePlatformRole } from '../lib/access/org-scope.js';
import { permissions } from '../lib/access/permissions.js';
import {
  buildSubscriptionScaffold,
  resolveEffectiveFeatures,
  serializeFeature,
  serializePlan,
  serializeSubscription,
  serializeSubscriptionSummary
} from '../lib/platform-subscriptions.js';
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

const subscriptionStatusSchema = z.enum(['draft', 'trialing', 'active', 'past_due', 'suspended', 'canceled']);

const subscriptionMutationSchema = z.object({
  planId: z.string().min(1).nullable().optional(),
  status: subscriptionStatusSchema,
  billingStatus: z.string().trim().min(1).max(40),
  basePriceCents: z.number().int().min(0),
  activeClientPriceCents: z.number().int().min(0),
  clinicianPriceCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(8).default('usd'),
  billingInterval: z.string().trim().min(1).max(20).default('month'),
  startsAt: z.string().datetime().optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodStart: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  canceledAt: z.string().datetime().nullable().optional(),
  billingProvider: z.string().trim().max(40).nullable().optional(),
  billingCustomerId: z.string().trim().max(191).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional()
});

const subscriptionPatchSchema = subscriptionMutationSchema.partial();

const featureOverridesPatchSchema = z.object({
  overrides: z.array(
    z.object({
      featureId: z.string().min(1),
      enabled: z.boolean(),
      reason: z.string().trim().max(500).nullable().optional()
    })
  ).min(1)
});

type LoadedOrganization = Awaited<ReturnType<typeof loadOrganizations>>[number];

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

function requirePlatformControlPlaneAccess(access: ReturnType<typeof requireRoutePermission>) {
  requirePlatformRole(access, 'platform_admin');

  if (access.supportMode || access.activeOrganizationId) {
    const error = new Error(
      'This action is only available from the platform control plane, not support mode or organization-scoped access.'
    ) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return access;
}

function parseOptionalDate(value?: string | null) {
  return value ? new Date(value) : null;
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
      subscription: {
        include: {
          plan: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
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
    subscription: serializeSubscriptionSummary(organization.subscription),
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

    const [tenant, organizations, platformUsers, totalOrgUsers, totalConsumers, plans] = await Promise.all([
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
      }),
      prisma.subscriptionPlan.findMany({
        where: {
          tenantId: access.tenantId
        },
        include: {
          planFeatures: {
            where: {
              included: true
            },
            include: {
              feature: true
            }
          },
          _count: {
            select: {
              organizationSubscriptions: true
            }
          }
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
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
    const subscriptionsByStatus = organizationSummaries.reduce<Record<string, number>>((accumulator, organization) => {
      const status = organization.subscription.subscriptionStatus;
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    }, {});

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
        subscriptionsByStatus: Object.entries(subscriptionsByStatus).map(([status, count]) => ({
          status,
          count
        }))
      },
      billing: {
        isConfigured: organizationSummaries.some((organization) => organization.subscription.subscriptionStatus !== 'not_configured'),
        plans: plans.map((plan) => ({
          name: plan.name,
          organizationCount: plan._count.organizationSubscriptions
        })),
        subscriptionsByStatus: Object.entries(subscriptionsByStatus).map(([status, count]) => ({
          status,
          count
        })),
        note: 'Billing automation is still scaffolded, but plans, feature entitlements, and organization subscription records now live in the platform control plane.'
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
        subscription: {
          include: {
            plan: {
              select: {
                id: true,
                key: true,
                name: true
              }
            }
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
        subscription: serializeSubscriptionSummary(organization.subscription),
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

  app.get('/v1/platform/plans', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));

    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        tenantId: access.tenantId
      },
      include: {
        planFeatures: {
          where: {
            included: true
          },
          include: {
            feature: true
          }
        },
        _count: {
          select: {
            organizationSubscriptions: true
          }
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return {
      plans: plans.map(serializePlan)
    };
  });

  app.get('/v1/platform/features', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));

    const features = await prisma.platformFeature.findMany({
      where: {
        tenantId: access.tenantId
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    return {
      features: features.map(serializeFeature)
    };
  });

  app.get('/v1/platform/subscriptions', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));

    const organizations = await prisma.organization.findMany({
      where: {
        tenantId: access.tenantId
      },
      include: {
        subscription: {
          include: {
            plan: {
              select: {
                id: true,
                key: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            consumers: true,
            memberships: true,
            locations: true
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return {
      subscriptions: organizations.map((organization) => ({
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt.toISOString(),
          counts: {
            consumers: organization._count.consumers,
            memberships: organization._count.memberships,
            locations: organization._count.locations
          }
        },
        subscription: serializeSubscriptionSummary(organization.subscription)
      }))
    };
  });

  app.get('/v1/platform/organizations/:organizationId/subscription', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));
    const params = organizationParamsSchema.parse(request.params);

    const organization = await prisma.organization.findFirst({
      where: {
        id: params.organizationId,
        tenantId: access.tenantId
      },
      include: {
        subscription: {
          include: {
            plan: {
              select: {
                id: true,
                key: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      subscription: serializeSubscriptionSummary(organization.subscription)
    };
  });

  app.post('/v1/platform/organizations/:organizationId/subscription', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = subscriptionMutationSchema.parse(request.body);

    const [organization, existingSubscription, plan] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: params.organizationId,
          tenantId: access.tenantId
        }
      }),
      prisma.organizationSubscription.findFirst({
        where: {
          tenantId: access.tenantId,
          organizationId: params.organizationId
        }
      }),
      payload.planId
        ? prisma.subscriptionPlan.findFirst({
            where: {
              id: payload.planId,
              tenantId: access.tenantId
            }
          })
        : Promise.resolve(null)
    ]);

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    if (existingSubscription) {
      return reply.code(409).send({ message: 'A subscription already exists for this organization.' });
    }

    if (payload.planId && !plan) {
      return reply.code(404).send({ message: 'Subscription plan was not found.' });
    }

    const createdSubscription = await prisma.$transaction(async (transaction) => {
      const subscription = await transaction.organizationSubscription.create({
        data: {
          tenantId: access.tenantId,
          organizationId: organization.id,
          planId: plan?.id ?? null,
          status: payload.status,
          billingStatus: payload.billingStatus,
          basePriceCents: payload.basePriceCents,
          activeClientPriceCents: payload.activeClientPriceCents,
          clinicianPriceCents: payload.clinicianPriceCents,
          currency: payload.currency.toLowerCase(),
          billingInterval: payload.billingInterval,
          startsAt: parseOptionalDate(payload.startsAt) ?? new Date(),
          trialEndsAt: parseOptionalDate(payload.trialEndsAt),
          currentPeriodStart: parseOptionalDate(payload.currentPeriodStart),
          currentPeriodEnd: parseOptionalDate(payload.currentPeriodEnd),
          canceledAt: parseOptionalDate(payload.canceledAt),
          billingProvider: normalizeOptionalString(payload.billingProvider),
          billingCustomerId: normalizeOptionalString(payload.billingCustomerId),
          notes: normalizeOptionalString(payload.notes)
        },
        include: {
          plan: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.subscription.created',
          entityType: 'organization_subscription',
          entityId: subscription.id,
          metadata: {
            planId: subscription.planId,
            status: subscription.status,
            billingStatus: subscription.billingStatus
          }
        }
      });

      return subscription;
    });

    return reply.code(201).send({
      created: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      subscription: serializeSubscription(createdSubscription)
    });
  });

  app.patch('/v1/platform/organizations/:organizationId/subscription', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = subscriptionPatchSchema.parse(request.body);

    const [organization, currentSubscription] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: params.organizationId,
          tenantId: access.tenantId
        }
      }),
      prisma.organizationSubscription.findFirst({
        where: {
          tenantId: access.tenantId,
          organizationId: params.organizationId
        },
        include: {
          plan: true
        }
      })
    ]);

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    if (!currentSubscription) {
      return reply.code(404).send({ message: 'Organization subscription was not found.' });
    }

    const plan = payload.planId === undefined
      ? currentSubscription.plan
      : payload.planId
        ? await prisma.subscriptionPlan.findFirst({
            where: {
              id: payload.planId,
              tenantId: access.tenantId
            }
          })
        : null;

    if (payload.planId && !plan) {
      return reply.code(404).send({ message: 'Subscription plan was not found.' });
    }

    const updatedSubscription = await prisma.$transaction(async (transaction) => {
      const subscription = await transaction.organizationSubscription.update({
        where: {
          id: currentSubscription.id
        },
        data: {
          planId: payload.planId === undefined ? currentSubscription.planId : plan?.id ?? null,
          status: payload.status ?? currentSubscription.status,
          billingStatus: payload.billingStatus ?? currentSubscription.billingStatus,
          basePriceCents:
            payload.basePriceCents
            ?? (payload.planId !== undefined && plan ? plan.basePriceCents : currentSubscription.basePriceCents),
          activeClientPriceCents:
            payload.activeClientPriceCents
            ?? (payload.planId !== undefined && plan ? plan.activeClientPriceCents : currentSubscription.activeClientPriceCents),
          clinicianPriceCents:
            payload.clinicianPriceCents
            ?? (payload.planId !== undefined && plan ? plan.clinicianPriceCents : currentSubscription.clinicianPriceCents),
          currency: payload.currency?.toLowerCase() ?? currentSubscription.currency,
          billingInterval: payload.billingInterval ?? currentSubscription.billingInterval,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : currentSubscription.startsAt,
          trialEndsAt: payload.trialEndsAt === undefined ? currentSubscription.trialEndsAt : parseOptionalDate(payload.trialEndsAt),
          currentPeriodStart:
            payload.currentPeriodStart === undefined
              ? currentSubscription.currentPeriodStart
              : parseOptionalDate(payload.currentPeriodStart),
          currentPeriodEnd:
            payload.currentPeriodEnd === undefined
              ? currentSubscription.currentPeriodEnd
              : parseOptionalDate(payload.currentPeriodEnd),
          canceledAt: payload.canceledAt === undefined ? currentSubscription.canceledAt : parseOptionalDate(payload.canceledAt),
          billingProvider:
            payload.billingProvider === undefined
              ? currentSubscription.billingProvider
              : normalizeOptionalString(payload.billingProvider),
          billingCustomerId:
            payload.billingCustomerId === undefined
              ? currentSubscription.billingCustomerId
              : normalizeOptionalString(payload.billingCustomerId),
          notes: payload.notes === undefined ? currentSubscription.notes : normalizeOptionalString(payload.notes)
        },
        include: {
          plan: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.subscription.updated',
          entityType: 'organization_subscription',
          entityId: subscription.id,
          metadata: {
            planId: subscription.planId,
            status: subscription.status,
            billingStatus: subscription.billingStatus
          }
        }
      });

      return subscription;
    });

    return {
      updated: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      subscription: serializeSubscription(updatedSubscription)
    };
  });

  app.get('/v1/platform/organizations/:organizationId/features', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));
    const params = organizationParamsSchema.parse(request.params);

    const organization = await prisma.organization.findFirst({
      where: {
        id: params.organizationId,
        tenantId: access.tenantId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    const resolved = await resolveEffectiveFeatures(prisma, {
      tenantId: access.tenantId,
      organizationId: organization.id
    });

    return {
      organization,
      subscription: resolved.subscription,
      features: resolved.features
    };
  });

  app.patch('/v1/platform/organizations/:organizationId/features', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = featureOverridesPatchSchema.parse(request.body);

    const organization = await prisma.organization.findFirst({
      where: {
        id: params.organizationId,
        tenantId: access.tenantId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found.' });
    }

    const features = await prisma.platformFeature.findMany({
      where: {
        tenantId: access.tenantId,
        id: {
          in: payload.overrides.map((override) => override.featureId)
        }
      }
    });
    const featureIdSet = new Set(features.map((feature) => feature.id));

    if (payload.overrides.some((override) => !featureIdSet.has(override.featureId))) {
      return reply.code(404).send({ message: 'One or more features were not found.' });
    }

    const resolvedBeforeUpdate = await resolveEffectiveFeatures(prisma, {
      tenantId: access.tenantId,
      organizationId: organization.id
    });
    const featureStateById = new Map(resolvedBeforeUpdate.features.map((feature) => [feature.id, feature]));

    await prisma.$transaction(async (transaction) => {
      for (const override of payload.overrides) {
        const currentFeature = featureStateById.get(override.featureId);

        if (!currentFeature) {
          continue;
        }

        if (override.enabled === currentFeature.includedInPlan) {
          await transaction.organizationFeatureOverride.deleteMany({
            where: {
              organizationId: organization.id,
              featureId: override.featureId
            }
          });
          continue;
        }

        await transaction.organizationFeatureOverride.upsert({
          where: {
            organizationId_featureId: {
              organizationId: organization.id,
              featureId: override.featureId
            }
          },
          update: {
            enabled: override.enabled,
            reason: normalizeOptionalString(override.reason),
            updatedByUserId: access.userId
          },
          create: {
            tenantId: access.tenantId,
            organizationId: organization.id,
            featureId: override.featureId,
            enabled: override.enabled,
            reason: normalizeOptionalString(override.reason),
            createdByUserId: access.userId,
            updatedByUserId: access.userId
          }
        });
      }

      await transaction.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization_feature_override.updated',
          entityType: 'organization_feature_override',
          entityId: organization.id,
          metadata: {
            overrides: payload.overrides
          }
        }
      });
    });

    const resolved = await resolveEffectiveFeatures(prisma, {
      tenantId: access.tenantId,
      organizationId: organization.id
    });

    return {
      updated: true,
      organization,
      subscription: resolved.subscription,
      features: resolved.features
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
