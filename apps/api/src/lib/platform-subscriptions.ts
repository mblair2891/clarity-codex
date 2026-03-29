import type { PrismaClient } from '@prisma/client';

export function buildSubscriptionScaffold() {
  return {
    id: null,
    planId: null,
    planKey: null,
    planName: null,
    subscriptionStatus: 'not_configured',
    billingStatus: 'not_configured',
    billingCustomerId: null,
    billingProvider: null,
    basePriceCents: 0,
    activeClientPriceCents: 0,
    clinicianPriceCents: 0,
    currency: 'usd',
    billingInterval: 'month',
    startsAt: null,
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    nextInvoiceDate: null,
    notes: null,
    createdAt: null,
    updatedAt: null
  };
}

export function serializeSubscription(subscription: {
  id: string;
  status: string;
  billingStatus: string;
  billingCustomerId: string | null;
  billingProvider: string | null;
  basePriceCents: number;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  currency: string;
  billingInterval: string;
  startsAt: Date;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    id: string;
    key: string;
    name: string;
  } | null;
}) {
  return {
    id: subscription.id,
    planId: subscription.plan?.id ?? null,
    planKey: subscription.plan?.key ?? null,
    planName: subscription.plan?.name ?? null,
    subscriptionStatus: subscription.status,
    billingStatus: subscription.billingStatus,
    billingCustomerId: subscription.billingCustomerId,
    billingProvider: subscription.billingProvider,
    basePriceCents: subscription.basePriceCents,
    activeClientPriceCents: subscription.activeClientPriceCents,
    clinicianPriceCents: subscription.clinicianPriceCents,
    currency: subscription.currency,
    billingInterval: subscription.billingInterval,
    startsAt: subscription.startsAt.toISOString(),
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: subscription.canceledAt?.toISOString() ?? null,
    nextInvoiceDate: subscription.currentPeriodEnd?.toISOString() ?? null,
    notes: subscription.notes,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString()
  };
}

export function serializeSubscriptionSummary(subscription: Parameters<typeof serializeSubscription>[0] | null) {
  if (!subscription) {
    return buildSubscriptionScaffold();
  }

  return serializeSubscription(subscription);
}

export function serializeFeature(feature: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: feature.id,
    key: feature.key,
    name: feature.name,
    description: feature.description,
    category: feature.category,
    isActive: feature.isActive,
    sortOrder: feature.sortOrder,
    createdAt: feature.createdAt.toISOString(),
    updatedAt: feature.updatedAt.toISOString()
  };
}

export function serializePlan(plan: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  basePriceCents: number;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  currency: string;
  billingInterval: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    organizationSubscriptions?: number;
  };
  planFeatures?: Array<{
    included: boolean;
    feature: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      category: string | null;
      isActive: boolean;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
}) {
  const includedFeatures = (plan.planFeatures ?? [])
    .filter((feature) => feature.included)
    .map((feature) => serializeFeature(feature.feature));

  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    pricing: {
      basePriceCents: plan.basePriceCents,
      activeClientPriceCents: plan.activeClientPriceCents,
      clinicianPriceCents: plan.clinicianPriceCents,
      currency: plan.currency,
      billingInterval: plan.billingInterval
    },
    includedFeatures,
    organizationCount: plan._count?.organizationSubscriptions ?? 0,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString()
  };
}

export async function resolveEffectiveFeatures(
  db: PrismaClient,
  args: {
    tenantId: string;
    organizationId: string;
  }
) {
  const [features, subscription, overrides] = await Promise.all([
    db.platformFeature.findMany({
      where: {
        tenantId: args.tenantId
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    }),
    db.organizationSubscription.findFirst({
      where: {
        tenantId: args.tenantId,
        organizationId: args.organizationId
      },
      include: {
        plan: {
          include: {
            planFeatures: {
              where: {
                included: true
              },
              include: {
                feature: true
              }
            }
          }
        }
      }
    }),
    db.organizationFeatureOverride.findMany({
      where: {
        tenantId: args.tenantId,
        organizationId: args.organizationId
      }
    })
  ]);

  const includedFeatureIds = new Set(
    (subscription?.plan?.planFeatures ?? []).map((planFeature) => planFeature.featureId)
  );
  const overrideByFeatureId = new Map(overrides.map((override) => [override.featureId, override]));

  return {
    subscription: subscription ? serializeSubscription(subscription) : buildSubscriptionScaffold(),
    features: features.map((feature) => {
      const override = overrideByFeatureId.get(feature.id) ?? null;
      const includedInPlan = includedFeatureIds.has(feature.id);
      const enabled = override ? override.enabled : includedInPlan;

      return {
        ...serializeFeature(feature),
        enabled,
        includedInPlan,
        source: override ? 'override' : includedInPlan ? 'plan' : 'none',
        override: override
          ? {
              id: override.id,
              enabled: override.enabled,
              reason: override.reason,
              createdByUserId: override.createdByUserId,
              updatedByUserId: override.updatedByUserId,
              createdAt: override.createdAt.toISOString(),
              updatedAt: override.updatedAt.toISOString()
            }
          : null
      };
    })
  };
}
