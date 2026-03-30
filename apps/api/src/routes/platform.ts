import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePlatformRole } from '../lib/access/org-scope.js';
import { permissions } from '../lib/access/permissions.js';
import {
  buildDefaultOnboardingAnswers,
  buildDefaultSelectedFeatureKeys,
  normalizeOnboardingAnswers,
  recommendOrganizationOnboarding,
  serializeOrganizationOnboarding,
  type OrganizationOnboardingAnswers
} from '../lib/platform-onboarding.js';
import {
  bootstrapDefaultPricingCatalog,
  buildSubscriptionScaffold,
  DEFAULT_PLAN_DEFINITIONS,
  resolveEffectiveFeatures,
  serializeFeature,
  serializePlan,
  serializeSubscription,
  serializeSubscriptionSummary
} from '../lib/platform-subscriptions.js';
import { requireRoutePermission } from '../lib/access/route-permissions.js';
import { prisma } from '../lib/db.js';
import { AiService } from '../services/ai.service.js';
import { ResetSystemService } from '../services/reset-system.service.js';

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1)
});

const planParamsSchema = z.object({
  planId: z.string().min(1)
});

const featureParamsSchema = z.object({
  featureId: z.string().min(1)
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
const planFeatureAvailabilitySchema = z.enum(['included', 'add_on', 'excluded']);

const planFeatureSchema = z.object({
  featureId: z.string().min(1),
  availability: planFeatureAvailabilitySchema,
  monthlyPriceCents: z.number().int().min(0).nullable().optional(),
  annualPriceCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

const planCreateSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(240),
  shortDescription: z.string().trim().min(2).max(240),
  longDescription: z.string().trim().min(2).max(4_000),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  basePriceCents: z.number().int().min(0),
  annualBasePriceCents: z.number().int().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).nullable().optional(),
  trialDays: z.number().int().min(0).nullable().optional(),
  activeClientPriceCents: z.number().int().min(0),
  clinicianPriceCents: z.number().int().min(0),
  includedActiveClients: z.number().int().min(0).nullable().optional(),
  includedClinicians: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(8).default('usd'),
  billingInterval: z.string().trim().min(1).max(20).default('month'),
  targetCustomerProfile: z.string().trim().min(2).max(1_000),
  customPricingRequired: z.boolean(),
  salesContactRequired: z.boolean(),
  badgeLabel: z.string().trim().max(40).nullable().optional(),
  maxLocations: z.number().int().min(0).nullable().optional(),
  maxOrgUsers: z.number().int().min(0).nullable().optional(),
  maxClinicians: z.number().int().min(0).nullable().optional(),
  maxActiveClients: z.number().int().min(0).nullable().optional(),
  unlimitedLocations: z.boolean(),
  unlimitedOrgUsers: z.boolean(),
  unlimitedClinicians: z.boolean(),
  unlimitedActiveClients: z.boolean(),
  apiAccessIncluded: z.boolean(),
  ssoIncluded: z.boolean(),
  customBrandingIncluded: z.boolean(),
  features: z.array(planFeatureSchema)
});

const planPatchSchema = planCreateSchema.partial().extend({
  features: z.array(planFeatureSchema).optional()
});

const featurePatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(2).max(240).optional(),
  longDescription: z.string().trim().min(2).max(4_000).optional(),
  category: z.string().trim().min(2).max(60).nullable().optional(),
  isActive: z.boolean().optional(),
  isAddOn: z.boolean().optional(),
  defaultMonthlyPriceCents: z.number().int().min(0).nullable().optional(),
  defaultAnnualPriceCents: z.number().int().min(0).nullable().optional(),
  badgeLabel: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const subscriptionMutationSchema = z.object({
  planId: z.string().min(1).nullable().optional(),
  status: subscriptionStatusSchema,
  billingStatus: z.string().trim().min(1).max(40),
  basePriceCents: z.number().int().min(0),
  annualBasePriceCents: z.number().int().min(0).nullable().optional(),
  setupFeeCents: z.number().int().min(0).nullable().optional(),
  activeClientPriceCents: z.number().int().min(0),
  clinicianPriceCents: z.number().int().min(0),
  includedActiveClients: z.number().int().min(0).nullable().optional(),
  includedClinicians: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(8).default('usd'),
  billingInterval: z.string().trim().min(1).max(20).default('month'),
  startsAt: z.string().datetime().optional(),
  trialStartsAt: z.string().datetime().nullable().optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodStart: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  canceledAt: z.string().datetime().nullable().optional(),
  billingProvider: z.string().trim().max(40).nullable().optional(),
  billingCustomerId: z.string().trim().max(191).nullable().optional(),
  billingContactEmail: z.string().trim().email().max(191).nullable().optional(),
  customPricingEnabled: z.boolean().optional(),
  enterpriseManaged: z.boolean().optional(),
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

const onboardingStatusSchema = z.enum(['draft', 'in_progress', 'submitted', 'reviewed', 'active']);
const onboardingImportDataTypeSchema = z.string().trim().min(1).max(80);
const onboardingAnswersSchema = z.object({
  organizationIdentity: z.object({
    organizationName: z.string().trim().min(2).max(120),
    displayName: z.string().trim().max(120),
    organizationType: z.string().trim().max(80),
    numberOfLocations: z.number().int().min(1).max(999),
    primaryLocationAddress: z.string().trim().max(500),
    timezone: z.string().trim().max(80),
    npi: z.string().trim().max(20),
    taxId: z.string().trim().max(20),
    website: z.string().trim().max(240),
    primaryPhone: z.string().trim().max(40),
    primaryEmail: z.string().trim().email().max(191).or(z.literal(''))
  }),
  primaryContacts: z.object({
    primaryAdminFullName: z.string().trim().max(120),
    primaryAdminEmail: z.string().trim().email().max(191).or(z.literal('')),
    primaryAdminPhone: z.string().trim().max(40),
    billingContactName: z.string().trim().max(120),
    billingContactEmail: z.string().trim().email().max(191).or(z.literal('')),
    clinicalLeadName: z.string().trim().max(120),
    clinicalLeadEmail: z.string().trim().email().max(191).or(z.literal('')),
    technicalContactName: z.string().trim().max(120),
    technicalContactEmail: z.string().trim().email().max(191).or(z.literal(''))
  }),
  operationalProfile: z.object({
    numberOfClinicians: z.number().int().min(0).max(10_000),
    numberOfOrgAdminUsers: z.number().int().min(0).max(10_000),
    approximateActiveClientCount: z.number().int().min(0).max(1_000_000),
    expectedGrowthNext12Months: z.number().int().min(0).max(1_000),
    billsInsurance: z.boolean(),
    billingModel: z.enum(['in_house', 'outsourced', 'not_applicable']),
    needsClaimsRemittanceWorkflows: z.boolean(),
    needsConsumerPortal: z.boolean(),
    needsAdvancedReporting: z.boolean(),
    needsMultiLocationManagement: z.boolean(),
    needsSso: z.boolean(),
    needsApiAccess: z.boolean(),
    needsCustomBranding: z.boolean(),
    needsPrioritySupport: z.boolean(),
    hasExistingDataToImport: z.boolean()
  }),
  importMigration: z.object({
    needsDataImport: z.boolean(),
    dataTypes: z.array(onboardingImportDataTypeSchema).max(20),
    sourceSystem: z.string().trim().max(120),
    sourceFormat: z.string().trim().max(120),
    wantsPlatformAssistance: z.boolean()
  })
});

const onboardingCreateSchema = z.object({
  status: onboardingStatusSchema.optional(),
  currentStep: z.string().trim().min(1).max(40).nullable().optional(),
  answers: onboardingAnswersSchema,
  adminReviewNotes: z.string().trim().max(2_000).nullable().optional()
});

const onboardingPatchSchema = z.object({
  status: onboardingStatusSchema.optional(),
  currentStep: z.string().trim().min(1).max(40).nullable().optional(),
  answers: onboardingAnswersSchema.optional(),
  selectedPlanId: z.string().min(1).nullable().optional(),
  selectedFeatureKeys: z.array(z.string().trim().min(1).max(80)).optional(),
  adminReviewNotes: z.string().trim().max(2_000).nullable().optional()
});

const onboardingRecommendSchema = z.object({
  answers: onboardingAnswersSchema,
  currentStep: z.string().trim().min(1).max(40).nullable().optional()
});

const onboardingCompleteSchema = z.object({
  answers: onboardingAnswersSchema,
  selectedPlanId: z.string().min(1),
  selectedFeatureKeys: z.array(z.string().trim().min(1).max(80)).max(100),
  adminReviewNotes: z.string().trim().max(2_000).nullable().optional()
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

function normalizePlanKey(value: string) {
  return value.trim().toLowerCase();
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function serializePricingBootstrapResult(result: Awaited<ReturnType<typeof bootstrapDefaultPricingCatalog>>) {
  return {
    seededPlans: result.plans.map((plan) => plan.key),
    seededFeatures: result.features.map((feature) => feature.key)
  };
}

async function loadPlanCatalog(tenantId: string) {
  return prisma.subscriptionPlan.findMany({
    where: {
      tenantId
    },
    include: {
      planFeatures: {
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
}

async function loadPlatformFeaturesCatalog(tenantId: string) {
  return prisma.platformFeature.findMany({
    where: {
      tenantId
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  });
}

async function loadOrganizationForOnboarding(tenantId: string, organizationId: string) {
  return prisma.organization.findFirst({
    where: {
      tenantId,
      id: organizationId
    },
    include: {
      locations: {
        orderBy: {
          createdAt: 'asc'
        }
      },
      onboarding: {
        include: {
          recommendedPlan: {
            select: {
              id: true
            }
          },
          selectedPlan: {
            select: {
              id: true
            }
          }
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
      }
    }
  });
}

function buildSubscriptionDataFromPlan(plan: Awaited<ReturnType<typeof loadPlanCatalog>>[number]) {
  return {
    planId: plan.id,
    status: 'draft' as const,
    billingStatus: 'not_configured',
    basePriceCents: plan.basePriceCents,
    annualBasePriceCents: plan.annualBasePriceCents,
    setupFeeCents: plan.setupFeeCents,
    activeClientPriceCents: plan.activeClientPriceCents,
    clinicianPriceCents: plan.clinicianPriceCents,
    includedActiveClients: plan.includedActiveClients,
    includedClinicians: plan.includedClinicians,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    customPricingEnabled: plan.customPricingRequired,
    enterpriseManaged: plan.customPricingRequired,
    startsAt: new Date()
  };
}

function sanitizeFeatureKeySelection(keys: string[]) {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))].sort();
}

async function syncOnboardingFeatureSelection(args: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  organizationId: string;
  userId: string;
  plan: Awaited<ReturnType<typeof loadPlanCatalog>>[number];
  features: Awaited<ReturnType<typeof loadPlatformFeaturesCatalog>>;
  selectedFeatureKeys: string[];
}) {
  const selectedKeys = new Set(args.selectedFeatureKeys);
  const planAvailabilityByFeatureId = new Map(
    args.plan.planFeatures.map((planFeature) => [planFeature.featureId, planFeature.availability])
  );
  const existingOverrides = await args.tx.organizationFeatureOverride.findMany({
    where: {
      tenantId: args.tenantId,
      organizationId: args.organizationId
    }
  });
  const existingOverrideByFeatureId = new Map(existingOverrides.map((override) => [override.featureId, override]));

  for (const feature of args.features) {
    const availability = planAvailabilityByFeatureId.get(feature.id) ?? 'excluded';
    const defaultEnabled = availability === 'included';
    const selected = selectedKeys.has(feature.key);
    const existingOverride = existingOverrideByFeatureId.get(feature.id) ?? null;

    if (selected === defaultEnabled) {
      if (existingOverride) {
        await args.tx.organizationFeatureOverride.delete({
          where: {
            id: existingOverride.id
          }
        });
      }

      continue;
    }

    const reason = selected
      ? 'Enabled from onboarding wizard recommendation or platform admin confirmation.'
      : 'Disabled during onboarding wizard review.';

    if (existingOverride) {
      await args.tx.organizationFeatureOverride.update({
        where: {
          id: existingOverride.id
        },
        data: {
          enabled: selected,
          reason,
          updatedByUserId: args.userId
        }
      });
      continue;
    }

    await args.tx.organizationFeatureOverride.create({
      data: {
        tenantId: args.tenantId,
        organizationId: args.organizationId,
        featureId: feature.id,
        enabled: selected,
        reason,
        createdByUserId: args.userId,
        updatedByUserId: args.userId
      }
    });
  }
}

async function syncPlanFeatureRows(args: {
  tx: Prisma.TransactionClient;
  planId: string;
  tenantId: string;
  features: Array<z.infer<typeof planFeatureSchema>>;
}) {
  const featureRecords = args.features.length
    ? await args.tx.platformFeature.findMany({
        where: {
          tenantId: args.tenantId,
          id: {
            in: args.features.map((feature) => feature.featureId)
          }
        }
      })
    : [];

  if (featureRecords.length !== args.features.length) {
    const error = new Error('One or more plan features were not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  await args.tx.planFeature.deleteMany({
    where: {
      planId: args.planId
    }
  });

  if (!args.features.length) {
    return;
  }

  await args.tx.planFeature.createMany({
    data: args.features.map((feature) => ({
      planId: args.planId,
      featureId: feature.featureId,
      included: feature.availability === 'included',
      availability: feature.availability,
      monthlyPriceCents: feature.monthlyPriceCents ?? null,
      annualPriceCents: feature.annualPriceCents ?? null,
      notes: normalizeOptionalString(feature.notes)
    }))
  });
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
  const aiService = new AiService();

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

  app.get('/v1/platform/organizations/:organizationId/onboarding', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);

    const [organization, plans, features] = await Promise.all([
      loadOrganizationForOnboarding(access.tenantId, params.organizationId),
      loadPlanCatalog(access.tenantId),
      loadPlatformFeaturesCatalog(access.tenantId)
    ]);

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    const onboarding = serializeOrganizationOnboarding(organization.onboarding);
    const hydratedAnswers = normalizeOnboardingAnswers({
      ...onboarding.answers,
      organizationIdentity: {
        ...onboarding.answers.organizationIdentity,
        organizationName: onboarding.answers.organizationIdentity.organizationName || organization.name,
        displayName: onboarding.answers.organizationIdentity.displayName || organization.name,
        numberOfLocations:
          onboarding.answers.organizationIdentity.numberOfLocations || Math.max(organization.locations.length, 1),
        timezone: onboarding.answers.organizationIdentity.timezone || organization.locations[0]?.timezone || '',
        npi: onboarding.answers.organizationIdentity.npi || organization.npi || '',
        taxId: onboarding.answers.organizationIdentity.taxId || organization.taxId || ''
      }
    });
    const selectedPlanId = onboarding.selectedPlanId ?? onboarding.recommendedPlanId ?? organization.subscription?.planId ?? null;
    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
    const selectedFeatureKeys = onboarding.selectedFeatureKeys.length
      ? onboarding.selectedFeatureKeys
      : buildDefaultSelectedFeatureKeys({
          plan: selectedPlan,
          recommendedFeatureKeys: onboarding.recommendedFeatureKeys
        });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        npi: organization.npi,
        taxId: organization.taxId,
        createdAt: organization.createdAt.toISOString(),
        subscription: serializeSubscriptionSummary(organization.subscription),
        locations: organization.locations.map((location) => ({
          id: location.id,
          name: location.name,
          timezone: location.timezone,
          isActive: location.isActive
        }))
      },
      onboarding: {
        ...onboarding,
        answers: hydratedAnswers,
        selectedPlanId,
        selectedFeatureKeys
      },
      catalog: {
        plans: plans.map(serializePlan),
        features: features.map(serializeFeature)
      }
    };
  });

  app.post('/v1/platform/organizations/:organizationId/onboarding', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = onboardingCreateSchema.parse(request.body);

    const organization = await loadOrganizationForOnboarding(access.tenantId, params.organizationId);

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    const answers = normalizeOnboardingAnswers(payload.answers as OrganizationOnboardingAnswers);
    const existing = organization.onboarding;
    const saved = await prisma.$transaction(async (tx) => {
      const onboardingRecord = await tx.organizationOnboarding.upsert({
        where: {
          organizationId: organization.id
        },
        update: {
          status: payload.status ?? existing?.status ?? 'in_progress',
          currentStep: payload.currentStep ?? existing?.currentStep ?? 'organization_identity',
          answers: asJson(answers),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          adminReviewNotes:
            payload.adminReviewNotes === undefined ? existing?.adminReviewNotes ?? null : normalizeOptionalString(payload.adminReviewNotes)
        },
        create: {
          tenantId: access.tenantId,
          organizationId: organization.id,
          status: payload.status ?? 'in_progress',
          currentStep: payload.currentStep ?? 'organization_identity',
          answers: asJson(answers),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          adminReviewNotes: normalizeOptionalString(payload.adminReviewNotes)
        },
        include: {
          recommendedPlan: {
            select: {
              id: true
            }
          },
          selectedPlan: {
            select: {
              id: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization_onboarding.saved',
          entityType: 'organization_onboarding',
          entityId: onboardingRecord.id,
          metadata: {
            status: onboardingRecord.status,
            currentStep: onboardingRecord.currentStep
          }
        }
      });

      return onboardingRecord;
    });

    return reply.code(existing ? 200 : 201).send({
      created: !existing,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      onboarding: serializeOrganizationOnboarding(saved)
    });
  });

  app.patch('/v1/platform/organizations/:organizationId/onboarding', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = onboardingPatchSchema.parse(request.body);

    const organization = await loadOrganizationForOnboarding(access.tenantId, params.organizationId);

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    const existingAnswers = serializeOrganizationOnboarding(organization.onboarding).answers;
    const answers = payload.answers
      ? normalizeOnboardingAnswers(payload.answers as OrganizationOnboardingAnswers)
      : existingAnswers;
    const saved = await prisma.$transaction(async (tx) => {
      const onboardingRecord = await tx.organizationOnboarding.upsert({
        where: {
          organizationId: organization.id
        },
        update: {
          status: payload.status ?? organization.onboarding?.status ?? 'in_progress',
          currentStep:
            payload.currentStep === undefined
              ? organization.onboarding?.currentStep ?? null
              : normalizeOptionalString(payload.currentStep),
          answers: asJson(answers),
          selectedPlanId: payload.selectedPlanId === undefined ? organization.onboarding?.selectedPlanId ?? null : payload.selectedPlanId,
          selectedFeatureKeys:
            payload.selectedFeatureKeys === undefined
              ? organization.onboarding?.selectedFeatureKeys ?? undefined
              : asJson(sanitizeFeatureKeySelection(payload.selectedFeatureKeys)),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          adminReviewNotes:
            payload.adminReviewNotes === undefined
              ? organization.onboarding?.adminReviewNotes ?? null
              : normalizeOptionalString(payload.adminReviewNotes)
        },
        create: {
          tenantId: access.tenantId,
          organizationId: organization.id,
          status: payload.status ?? 'in_progress',
          currentStep: normalizeOptionalString(payload.currentStep) ?? 'organization_identity',
          answers: asJson(answers),
          selectedPlanId: payload.selectedPlanId ?? null,
          selectedFeatureKeys: asJson(sanitizeFeatureKeySelection(payload.selectedFeatureKeys ?? [])),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          adminReviewNotes: normalizeOptionalString(payload.adminReviewNotes)
        },
        include: {
          recommendedPlan: {
            select: {
              id: true
            }
          },
          selectedPlan: {
            select: {
              id: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization_onboarding.updated',
          entityType: 'organization_onboarding',
          entityId: onboardingRecord.id,
          metadata: {
            status: onboardingRecord.status,
            currentStep: onboardingRecord.currentStep
          }
        }
      });

      return onboardingRecord;
    });

    return {
      updated: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      onboarding: serializeOrganizationOnboarding(saved)
    };
  });

  app.post('/v1/platform/organizations/:organizationId/onboarding/recommend', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = onboardingRecommendSchema.parse(request.body);

    const [organization, plans, features] = await Promise.all([
      loadOrganizationForOnboarding(access.tenantId, params.organizationId),
      loadPlanCatalog(access.tenantId),
      loadPlatformFeaturesCatalog(access.tenantId)
    ]);

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    if (!plans.length) {
      return reply.code(409).send({
        message: 'No subscription plans are configured for this tenant yet.'
      });
    }

    const answers = normalizeOnboardingAnswers(payload.answers as OrganizationOnboardingAnswers);
    const recommendation = recommendOrganizationOnboarding({
      plans,
      features,
      answers
    });
    const recommendedPlan = plans.find((plan) => plan.id === recommendation.recommendedPlanId) ?? null;
    const recommendedFeatureNames = features
      .filter((feature) => recommendation.recommendedFeatureKeys.includes(feature.key))
      .map((feature) => feature.name);
    const aiNarrative = aiService.generateOnboardingRecommendationNarrative({
      tenantId: access.tenantId,
      organizationName: answers.organizationIdentity.displayName || answers.organizationIdentity.organizationName || organization.name,
      recommendedPlanName: recommendation.recommendedPlanName ?? recommendedPlan?.name ?? 'Clarity',
      recommendedFeatureNames,
      reasons: recommendation.reasons,
      importSummary: recommendation.importSummary,
      importComplexity: recommendation.importComplexity,
      flags: recommendation.flags,
      adminNotes: recommendation.adminNotes
    });
    const defaultSelectedFeatureKeys = buildDefaultSelectedFeatureKeys({
      plan: recommendedPlan,
      recommendedFeatureKeys: recommendation.recommendedFeatureKeys
    });
    const saved = await prisma.$transaction(async (tx) => {
      const onboardingRecord = await tx.organizationOnboarding.upsert({
        where: {
          organizationId: organization.id
        },
        update: {
          status: 'submitted',
          currentStep: payload.currentStep ?? 'recommendation',
          answers: asJson(answers),
          recommendation: asJson(recommendation),
          recommendedPlanId: recommendation.recommendedPlanId,
          selectedPlanId: organization.onboarding?.selectedPlanId ?? recommendation.recommendedPlanId,
          recommendedFeatureKeys: asJson(recommendation.recommendedFeatureKeys),
          selectedFeatureKeys:
            organization.onboarding?.selectedFeatureKeys && Array.isArray(organization.onboarding.selectedFeatureKeys)
              ? organization.onboarding.selectedFeatureKeys
              : asJson(defaultSelectedFeatureKeys),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          aiSummary: aiNarrative.summary,
          aiExplanation: aiNarrative.explanation,
          aiMigrationRiskSummary: aiNarrative.migrationRiskSummary,
          submittedAt: new Date()
        },
        create: {
          tenantId: access.tenantId,
          organizationId: organization.id,
          status: 'submitted',
          currentStep: payload.currentStep ?? 'recommendation',
          answers: asJson(answers),
          recommendation: asJson(recommendation),
          recommendedPlanId: recommendation.recommendedPlanId,
          selectedPlanId: recommendation.recommendedPlanId,
          recommendedFeatureKeys: asJson(recommendation.recommendedFeatureKeys),
          selectedFeatureKeys: asJson(defaultSelectedFeatureKeys),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          aiSummary: aiNarrative.summary,
          aiExplanation: aiNarrative.explanation,
          aiMigrationRiskSummary: aiNarrative.migrationRiskSummary,
          submittedAt: new Date()
        },
        include: {
          recommendedPlan: {
            select: {
              id: true
            }
          },
          selectedPlan: {
            select: {
              id: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization_onboarding.recommended',
          entityType: 'organization_onboarding',
          entityId: onboardingRecord.id,
          metadata: {
            recommendedPlanId: recommendation.recommendedPlanId,
            recommendedFeatureKeys: recommendation.recommendedFeatureKeys
          }
        }
      });

      return onboardingRecord;
    });

    return {
      recommended: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      },
      onboarding: serializeOrganizationOnboarding(saved),
      recommendedPlan: recommendedPlan ? serializePlan(recommendedPlan) : null,
      recommendedFeatures: features
        .filter((feature) => recommendation.recommendedFeatureKeys.includes(feature.key))
        .map(serializeFeature),
      ai: {
        summary: aiNarrative.summary,
        explanation: aiNarrative.explanation,
        migrationRiskSummary: aiNarrative.migrationRiskSummary,
        reviewNotes: aiNarrative.reviewNotes
      }
    };
  });

  app.post('/v1/platform/organizations/:organizationId/onboarding/complete', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = organizationParamsSchema.parse(request.params);
    const payload = onboardingCompleteSchema.parse(request.body);

    const [organization, plans, features] = await Promise.all([
      loadOrganizationForOnboarding(access.tenantId, params.organizationId),
      loadPlanCatalog(access.tenantId),
      loadPlatformFeaturesCatalog(access.tenantId)
    ]);

    if (!organization) {
      return reply.code(404).send({
        message: 'Organization was not found.'
      });
    }

    const selectedPlan = plans.find((plan) => plan.id === payload.selectedPlanId) ?? null;

    if (!selectedPlan) {
      return reply.code(404).send({
        message: 'Selected plan was not found.'
      });
    }

    const answers = normalizeOnboardingAnswers(payload.answers as OrganizationOnboardingAnswers);
    const recommendation = recommendOrganizationOnboarding({
      plans,
      features,
      answers
    });
    const selectedFeatureKeys = sanitizeFeatureKeySelection(
      payload.selectedFeatureKeys.filter((key) => features.some((feature) => feature.key === key))
    );
    const aiNarrative = aiService.generateOnboardingRecommendationNarrative({
      tenantId: access.tenantId,
      organizationName: answers.organizationIdentity.displayName || answers.organizationIdentity.organizationName || organization.name,
      recommendedPlanName: selectedPlan.name,
      recommendedFeatureNames: features
        .filter((feature) => selectedFeatureKeys.includes(feature.key))
        .map((feature) => feature.name),
      reasons: recommendation.reasons,
      importSummary: recommendation.importSummary,
      importComplexity: recommendation.importComplexity,
      flags: recommendation.flags,
      adminNotes: recommendation.adminNotes
    });

    const completed = await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: {
          id: organization.id
        },
        data: {
          name: answers.organizationIdentity.organizationName,
          npi: normalizeOptionalString(answers.organizationIdentity.npi),
          taxId: normalizeOptionalString(answers.organizationIdentity.taxId)
        }
      });

      if (!organization.locations.length && answers.organizationIdentity.timezone) {
        await tx.location.create({
          data: {
            organizationId: organization.id,
            name: 'Primary location',
            timezone: answers.organizationIdentity.timezone,
            isActive: true
          }
        });
      } else if (organization.locations[0] && !organization.locations[0].timezone && answers.organizationIdentity.timezone) {
        await tx.location.update({
          where: {
            id: organization.locations[0].id
          },
          data: {
            timezone: answers.organizationIdentity.timezone
          }
        });
      }

      if (organization.subscription) {
        await tx.organizationSubscription.update({
          where: {
            organizationId: organization.id
          },
          data: {
            planId: selectedPlan.id,
            basePriceCents: selectedPlan.basePriceCents,
            annualBasePriceCents: selectedPlan.annualBasePriceCents,
            setupFeeCents: selectedPlan.setupFeeCents,
            activeClientPriceCents: selectedPlan.activeClientPriceCents,
            clinicianPriceCents: selectedPlan.clinicianPriceCents,
            includedActiveClients: selectedPlan.includedActiveClients,
            includedClinicians: selectedPlan.includedClinicians,
            currency: selectedPlan.currency,
            billingInterval: selectedPlan.billingInterval,
            customPricingEnabled: selectedPlan.customPricingRequired,
            enterpriseManaged: selectedPlan.customPricingRequired
          }
        });
      } else {
        await tx.organizationSubscription.create({
          data: {
            tenantId: access.tenantId,
            organizationId: organization.id,
            ...buildSubscriptionDataFromPlan(selectedPlan)
          }
        });
      }

      await syncOnboardingFeatureSelection({
        tx,
        tenantId: access.tenantId,
        organizationId: organization.id,
        userId: access.userId,
        plan: selectedPlan,
        features,
        selectedFeatureKeys
      });

      const onboardingRecord = await tx.organizationOnboarding.upsert({
        where: {
          organizationId: organization.id
        },
        update: {
          status: 'active',
          currentStep: 'complete',
          answers: asJson(answers),
          recommendation: asJson(recommendation),
          recommendedPlanId: recommendation.recommendedPlanId,
          selectedPlanId: selectedPlan.id,
          recommendedFeatureKeys: asJson(recommendation.recommendedFeatureKeys),
          selectedFeatureKeys: asJson(selectedFeatureKeys),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          aiSummary: aiNarrative.summary,
          aiExplanation: aiNarrative.explanation,
          aiMigrationRiskSummary: aiNarrative.migrationRiskSummary,
          adminReviewNotes:
            payload.adminReviewNotes === undefined
              ? organization.onboarding?.adminReviewNotes ?? null
              : normalizeOptionalString(payload.adminReviewNotes),
          submittedAt: organization.onboarding?.submittedAt ?? new Date(),
          reviewedAt: new Date(),
          completedAt: new Date()
        },
        create: {
          tenantId: access.tenantId,
          organizationId: organization.id,
          status: 'active',
          currentStep: 'complete',
          answers: asJson(answers),
          recommendation: asJson(recommendation),
          recommendedPlanId: recommendation.recommendedPlanId,
          selectedPlanId: selectedPlan.id,
          recommendedFeatureKeys: asJson(recommendation.recommendedFeatureKeys),
          selectedFeatureKeys: asJson(selectedFeatureKeys),
          requiresImport: answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport,
          importTypes: asJson(answers.importMigration.dataTypes),
          sourceSystem: normalizeOptionalString(answers.importMigration.sourceSystem),
          sourceFormat: normalizeOptionalString(answers.importMigration.sourceFormat),
          migrationAssistRequested: answers.importMigration.wantsPlatformAssistance,
          aiSummary: aiNarrative.summary,
          aiExplanation: aiNarrative.explanation,
          aiMigrationRiskSummary: aiNarrative.migrationRiskSummary,
          adminReviewNotes: normalizeOptionalString(payload.adminReviewNotes),
          submittedAt: new Date(),
          reviewedAt: new Date(),
          completedAt: new Date()
        },
        include: {
          recommendedPlan: {
            select: {
              id: true
            }
          },
          selectedPlan: {
            select: {
              id: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          organizationId: organization.id,
          action: 'platform.organization_onboarding.completed',
          entityType: 'organization_onboarding',
          entityId: onboardingRecord.id,
          metadata: {
            selectedPlanId: selectedPlan.id,
            selectedFeatureKeys
          }
        }
      });

      return onboardingRecord;
    });

    const effectiveFeatures = await resolveEffectiveFeatures(prisma, {
      tenantId: access.tenantId,
      organizationId: organization.id
    });

    return {
      completed: true,
      organization: {
        id: organization.id,
        name: answers.organizationIdentity.organizationName,
        slug: organization.slug
      },
      onboarding: serializeOrganizationOnboarding(completed),
      subscription: effectiveFeatures.subscription,
      features: effectiveFeatures.features,
      ai: {
        summary: aiNarrative.summary,
        explanation: aiNarrative.explanation,
        migrationRiskSummary: aiNarrative.migrationRiskSummary,
        reviewNotes: aiNarrative.reviewNotes
      }
    };
  });

  app.get('/v1/platform/plans', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));

    const plans = await loadPlanCatalog(access.tenantId);

    return {
      plans: plans.map(serializePlan)
    };
  });

  app.post('/v1/platform/plans', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const payload = planCreateSchema.parse(request.body);
    const normalizedKey = normalizePlanKey(payload.key);

    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: {
        tenantId: access.tenantId,
        key: normalizedKey
      }
    });

    if (existingPlan) {
      return reply.code(409).send({ message: 'A plan already exists with that key.' });
    }

    const createdPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          tenantId: access.tenantId,
          key: normalizedKey,
          name: payload.name.trim(),
          description: payload.description.trim(),
          shortDescription: payload.shortDescription.trim(),
          longDescription: payload.longDescription.trim(),
          isActive: payload.isActive,
          sortOrder: payload.sortOrder,
          basePriceCents: payload.basePriceCents,
          annualBasePriceCents: payload.annualBasePriceCents ?? null,
          setupFeeCents: payload.setupFeeCents ?? null,
          trialDays: payload.trialDays ?? null,
          activeClientPriceCents: payload.activeClientPriceCents,
          clinicianPriceCents: payload.clinicianPriceCents,
          includedActiveClients: payload.includedActiveClients ?? null,
          includedClinicians: payload.includedClinicians ?? null,
          currency: payload.currency.toLowerCase(),
          billingInterval: payload.billingInterval,
          targetCustomerProfile: payload.targetCustomerProfile.trim(),
          customPricingRequired: payload.customPricingRequired,
          salesContactRequired: payload.salesContactRequired,
          badgeLabel: normalizeOptionalString(payload.badgeLabel),
          maxLocations: payload.maxLocations ?? null,
          maxOrgUsers: payload.maxOrgUsers ?? null,
          maxClinicians: payload.maxClinicians ?? null,
          maxActiveClients: payload.maxActiveClients ?? null,
          unlimitedLocations: payload.unlimitedLocations,
          unlimitedOrgUsers: payload.unlimitedOrgUsers,
          unlimitedClinicians: payload.unlimitedClinicians,
          unlimitedActiveClients: payload.unlimitedActiveClients,
          apiAccessIncluded: payload.apiAccessIncluded,
          ssoIncluded: payload.ssoIncluded,
          customBrandingIncluded: payload.customBrandingIncluded
        }
      });

      await syncPlanFeatureRows({
        tx,
        planId: plan.id,
        tenantId: access.tenantId,
        features: payload.features
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          action: 'platform.plan.created',
          entityType: 'subscription_plan',
          entityId: plan.id,
          metadata: {
            key: plan.key,
            name: plan.name
          }
        }
      });

      return tx.subscriptionPlan.findUniqueOrThrow({
        where: {
          id: plan.id
        },
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          },
          _count: {
            select: {
              organizationSubscriptions: true
            }
          }
        }
      });
    });

    return reply.code(201).send({
      created: true,
      plan: serializePlan(createdPlan)
    });
  });

  app.patch('/v1/platform/plans/:planId', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = planParamsSchema.parse(request.params);
    const payload = planPatchSchema.parse(request.body);

    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: params.planId,
        tenantId: access.tenantId
      }
    });

    if (!existingPlan) {
      return reply.code(404).send({ message: 'Plan was not found.' });
    }

    if (payload.key) {
      const conflictingPlan = await prisma.subscriptionPlan.findFirst({
        where: {
          tenantId: access.tenantId,
          key: normalizePlanKey(payload.key),
          NOT: {
            id: existingPlan.id
          }
        }
      });

      if (conflictingPlan) {
        return reply.code(409).send({ message: 'Another plan already uses that key.' });
      }
    }

    const updatedPlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.update({
        where: {
          id: existingPlan.id
        },
        data: {
          key: payload.key ? normalizePlanKey(payload.key) : existingPlan.key,
          name: payload.name?.trim() ?? existingPlan.name,
          description: payload.description?.trim() ?? existingPlan.description,
          shortDescription: payload.shortDescription?.trim() ?? existingPlan.shortDescription,
          longDescription: payload.longDescription?.trim() ?? existingPlan.longDescription,
          isActive: payload.isActive ?? existingPlan.isActive,
          sortOrder: payload.sortOrder ?? existingPlan.sortOrder,
          basePriceCents: payload.basePriceCents ?? existingPlan.basePriceCents,
          annualBasePriceCents:
            payload.annualBasePriceCents === undefined ? existingPlan.annualBasePriceCents : payload.annualBasePriceCents,
          setupFeeCents: payload.setupFeeCents === undefined ? existingPlan.setupFeeCents : payload.setupFeeCents,
          trialDays: payload.trialDays === undefined ? existingPlan.trialDays : payload.trialDays,
          activeClientPriceCents: payload.activeClientPriceCents ?? existingPlan.activeClientPriceCents,
          clinicianPriceCents: payload.clinicianPriceCents ?? existingPlan.clinicianPriceCents,
          includedActiveClients:
            payload.includedActiveClients === undefined ? existingPlan.includedActiveClients : payload.includedActiveClients,
          includedClinicians:
            payload.includedClinicians === undefined ? existingPlan.includedClinicians : payload.includedClinicians,
          currency: payload.currency?.toLowerCase() ?? existingPlan.currency,
          billingInterval: payload.billingInterval ?? existingPlan.billingInterval,
          targetCustomerProfile: payload.targetCustomerProfile?.trim() ?? existingPlan.targetCustomerProfile,
          customPricingRequired: payload.customPricingRequired ?? existingPlan.customPricingRequired,
          salesContactRequired: payload.salesContactRequired ?? existingPlan.salesContactRequired,
          badgeLabel: payload.badgeLabel === undefined ? existingPlan.badgeLabel : normalizeOptionalString(payload.badgeLabel),
          maxLocations: payload.maxLocations === undefined ? existingPlan.maxLocations : payload.maxLocations,
          maxOrgUsers: payload.maxOrgUsers === undefined ? existingPlan.maxOrgUsers : payload.maxOrgUsers,
          maxClinicians: payload.maxClinicians === undefined ? existingPlan.maxClinicians : payload.maxClinicians,
          maxActiveClients: payload.maxActiveClients === undefined ? existingPlan.maxActiveClients : payload.maxActiveClients,
          unlimitedLocations: payload.unlimitedLocations ?? existingPlan.unlimitedLocations,
          unlimitedOrgUsers: payload.unlimitedOrgUsers ?? existingPlan.unlimitedOrgUsers,
          unlimitedClinicians: payload.unlimitedClinicians ?? existingPlan.unlimitedClinicians,
          unlimitedActiveClients: payload.unlimitedActiveClients ?? existingPlan.unlimitedActiveClients,
          apiAccessIncluded: payload.apiAccessIncluded ?? existingPlan.apiAccessIncluded,
          ssoIncluded: payload.ssoIncluded ?? existingPlan.ssoIncluded,
          customBrandingIncluded: payload.customBrandingIncluded ?? existingPlan.customBrandingIncluded
        }
      });

      if (payload.features) {
        await syncPlanFeatureRows({
          tx,
          planId: existingPlan.id,
          tenantId: access.tenantId,
          features: payload.features
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          action: 'platform.plan.updated',
          entityType: 'subscription_plan',
          entityId: plan.id,
          metadata: {
            key: plan.key,
            name: plan.name
          }
        }
      });

      return tx.subscriptionPlan.findUniqueOrThrow({
        where: {
          id: plan.id
        },
        include: {
          planFeatures: {
            include: {
              feature: true
            }
          },
          _count: {
            select: {
              organizationSubscriptions: true
            }
          }
        }
      });
    });

    return {
      updated: true,
      plan: serializePlan(updatedPlan)
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

  app.patch('/v1/platform/features/:featureId', async (request, reply) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));
    const params = featureParamsSchema.parse(request.params);
    const payload = featurePatchSchema.parse(request.body);

    const existingFeature = await prisma.platformFeature.findFirst({
      where: {
        id: params.featureId,
        tenantId: access.tenantId
      }
    });

    if (!existingFeature) {
      return reply.code(404).send({ message: 'Feature was not found.' });
    }

    const updatedFeature = await prisma.$transaction(async (tx) => {
      const feature = await tx.platformFeature.update({
        where: {
          id: existingFeature.id
        },
        data: {
          name: payload.name?.trim() ?? existingFeature.name,
          description: payload.description?.trim() ?? existingFeature.description,
          longDescription: payload.longDescription?.trim() ?? existingFeature.longDescription,
          category: payload.category === undefined ? existingFeature.category : normalizeOptionalString(payload.category),
          isActive: payload.isActive ?? existingFeature.isActive,
          isAddOn: payload.isAddOn ?? existingFeature.isAddOn,
          defaultMonthlyPriceCents:
            payload.defaultMonthlyPriceCents === undefined
              ? existingFeature.defaultMonthlyPriceCents
              : payload.defaultMonthlyPriceCents,
          defaultAnnualPriceCents:
            payload.defaultAnnualPriceCents === undefined
              ? existingFeature.defaultAnnualPriceCents
              : payload.defaultAnnualPriceCents,
          badgeLabel: payload.badgeLabel === undefined ? existingFeature.badgeLabel : normalizeOptionalString(payload.badgeLabel),
          sortOrder: payload.sortOrder ?? existingFeature.sortOrder
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: access.tenantId,
          userId: access.userId,
          action: 'platform.feature.updated',
          entityType: 'platform_feature',
          entityId: feature.id,
          metadata: {
            key: feature.key,
            name: feature.name
          }
        }
      });

      return feature;
    });

    return {
      updated: true,
      feature: serializeFeature(updatedFeature)
    };
  });

  app.get('/v1/platform/pricing/catalog', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsRead));

    const [plans, features] = await Promise.all([
      loadPlanCatalog(access.tenantId),
      prisma.platformFeature.findMany({
        where: {
          tenantId: access.tenantId
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
      })
    ]);

    return {
      plans: plans.map(serializePlan),
      features: features.map(serializeFeature),
      defaults: {
        planKeys: DEFAULT_PLAN_DEFINITIONS.map((plan) => plan.key)
      }
    };
  });

  app.post('/v1/platform/pricing/bootstrap', async (request) => {
    await app.authenticateRequest(request);
    const access = requirePlatformControlPlaneAccess(requireRoutePermission(request, permissions.platformOrganizationsManage));

    const result = await prisma.$transaction(async (tx) => bootstrapDefaultPricingCatalog(tx, {
      tenantId: access.tenantId
    }));

    await prisma.auditLog.create({
      data: {
        tenantId: access.tenantId,
        userId: access.userId,
        action: 'platform.pricing_catalog.bootstrapped',
        entityType: 'pricing_catalog',
        entityId: access.tenantId,
        metadata: serializePricingBootstrapResult(result)
      }
    });

    const plans = await loadPlanCatalog(access.tenantId);

    return {
      bootstrapped: true,
      ...serializePricingBootstrapResult(result),
      plans: plans.map(serializePlan)
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
          annualBasePriceCents: payload.annualBasePriceCents ?? null,
          setupFeeCents: payload.setupFeeCents ?? null,
          activeClientPriceCents: payload.activeClientPriceCents,
          clinicianPriceCents: payload.clinicianPriceCents,
          includedActiveClients: payload.includedActiveClients ?? null,
          includedClinicians: payload.includedClinicians ?? null,
          currency: payload.currency.toLowerCase(),
          billingInterval: payload.billingInterval,
          startsAt: parseOptionalDate(payload.startsAt) ?? new Date(),
          trialStartsAt: parseOptionalDate(payload.trialStartsAt),
          trialEndsAt: parseOptionalDate(payload.trialEndsAt),
          currentPeriodStart: parseOptionalDate(payload.currentPeriodStart),
          currentPeriodEnd: parseOptionalDate(payload.currentPeriodEnd),
          canceledAt: parseOptionalDate(payload.canceledAt),
          billingProvider: normalizeOptionalString(payload.billingProvider),
          billingCustomerId: normalizeOptionalString(payload.billingCustomerId),
          billingContactEmail: normalizeOptionalString(payload.billingContactEmail),
          customPricingEnabled: payload.customPricingEnabled ?? false,
          enterpriseManaged: payload.enterpriseManaged ?? false,
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
            billingStatus: subscription.billingStatus,
            customPricingEnabled: subscription.customPricingEnabled,
            enterpriseManaged: subscription.enterpriseManaged
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
          annualBasePriceCents:
            payload.annualBasePriceCents !== undefined
              ? payload.annualBasePriceCents
              : payload.planId !== undefined && plan
                ? plan.annualBasePriceCents
                : currentSubscription.annualBasePriceCents,
          setupFeeCents:
            payload.setupFeeCents !== undefined
              ? payload.setupFeeCents
              : payload.planId !== undefined && plan
                ? plan.setupFeeCents
                : currentSubscription.setupFeeCents,
          activeClientPriceCents:
            payload.activeClientPriceCents
            ?? (payload.planId !== undefined && plan ? plan.activeClientPriceCents : currentSubscription.activeClientPriceCents),
          clinicianPriceCents:
            payload.clinicianPriceCents
            ?? (payload.planId !== undefined && plan ? plan.clinicianPriceCents : currentSubscription.clinicianPriceCents),
          includedActiveClients:
            payload.includedActiveClients !== undefined
              ? payload.includedActiveClients
              : payload.planId !== undefined && plan
                ? plan.includedActiveClients
                : currentSubscription.includedActiveClients,
          includedClinicians:
            payload.includedClinicians !== undefined
              ? payload.includedClinicians
              : payload.planId !== undefined && plan
                ? plan.includedClinicians
                : currentSubscription.includedClinicians,
          currency: payload.currency?.toLowerCase() ?? currentSubscription.currency,
          billingInterval: payload.billingInterval ?? currentSubscription.billingInterval,
          startsAt: payload.startsAt ? new Date(payload.startsAt) : currentSubscription.startsAt,
          trialStartsAt:
            payload.trialStartsAt === undefined ? currentSubscription.trialStartsAt : parseOptionalDate(payload.trialStartsAt),
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
          billingContactEmail:
            payload.billingContactEmail === undefined
              ? currentSubscription.billingContactEmail
              : normalizeOptionalString(payload.billingContactEmail),
          customPricingEnabled: payload.customPricingEnabled ?? currentSubscription.customPricingEnabled,
          enterpriseManaged: payload.enterpriseManaged ?? currentSubscription.enterpriseManaged,
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
            billingStatus: subscription.billingStatus,
            customPricingEnabled: subscription.customPricingEnabled,
            enterpriseManaged: subscription.enterpriseManaged
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
