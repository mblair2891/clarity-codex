import type { Prisma, PrismaClient } from '@prisma/client';

export const DEFAULT_PLATFORM_FEATURE_DEFINITIONS = [
  {
    key: 'clinical',
    name: 'Clinical',
    category: 'core',
    sortOrder: 10,
    description: 'Clinical workflows, charting, and care-team operations.',
    longDescription: 'Core clinical workflows for intakes, charting, appointments, and treatment operations.',
    isAddOn: false,
    defaultMonthlyPriceCents: null,
    defaultAnnualPriceCents: null,
    badgeLabel: 'Core'
  },
  {
    key: 'consumer_portal',
    name: 'Consumer Portal',
    category: 'core',
    sortOrder: 20,
    description: 'Consumer-facing recovery tools, check-ins, and journaling.',
    longDescription: 'Daily recovery engagement tools for consumers, including check-ins, goals, and journaling.',
    isAddOn: false,
    defaultMonthlyPriceCents: null,
    defaultAnnualPriceCents: null,
    badgeLabel: 'Core'
  },
  {
    key: 'rcm',
    name: 'RCM',
    category: 'revenue_cycle',
    sortOrder: 30,
    description: 'Revenue cycle workspace and operational billing workflows.',
    longDescription: 'A revenue cycle workbench for billing operations, follow-up, and collections workflows.',
    isAddOn: true,
    defaultMonthlyPriceCents: 39900,
    defaultAnnualPriceCents: 430900,
    badgeLabel: 'Add-on'
  },
  {
    key: 'claims_management',
    name: 'Claims Management',
    category: 'revenue_cycle',
    sortOrder: 40,
    description: 'Claims submission, tracking, and denial follow-up workflows.',
    longDescription: 'Claims lifecycle support from draft through submission, denial handling, and resolution.',
    isAddOn: true,
    defaultMonthlyPriceCents: 14900,
    defaultAnnualPriceCents: 160900,
    badgeLabel: 'Add-on'
  },
  {
    key: 'remittance_tracking',
    name: 'Remittance Tracking',
    category: 'revenue_cycle',
    sortOrder: 50,
    description: 'ERA and remittance visibility for reimbursement tracking.',
    longDescription: 'Visibility into remittances and reimbursement status for finance and operations teams.',
    isAddOn: true,
    defaultMonthlyPriceCents: 9900,
    defaultAnnualPriceCents: 106900,
    badgeLabel: 'Add-on'
  },
  {
    key: 'multi_location',
    name: 'Multi-location',
    category: 'operations',
    sortOrder: 60,
    description: 'Operate multiple clinic locations inside one organization.',
    longDescription: 'Supports organizations running multiple clinic locations with shared control-plane visibility.',
    isAddOn: true,
    defaultMonthlyPriceCents: 9900,
    defaultAnnualPriceCents: 106900,
    badgeLabel: 'Ops'
  },
  {
    key: 'advanced_reporting',
    name: 'Advanced Reporting',
    category: 'analytics',
    sortOrder: 70,
    description: 'Deeper reporting, trend analysis, and operational analytics.',
    longDescription: 'Expanded analytics and reporting for leadership, operations, and performance review.',
    isAddOn: true,
    defaultMonthlyPriceCents: 19900,
    defaultAnnualPriceCents: 214900,
    badgeLabel: 'Analytics'
  },
  {
    key: 'advanced_admin_tools',
    name: 'Advanced Admin Tools',
    category: 'operations',
    sortOrder: 80,
    description: 'Expanded control-plane and tenant administration tools.',
    longDescription: 'Advanced operational controls for larger org setups, governance, and platform operations.',
    isAddOn: true,
    defaultMonthlyPriceCents: 9900,
    defaultAnnualPriceCents: 106900,
    badgeLabel: 'Ops'
  },
  {
    key: 'org_user_management',
    name: 'Org User Management',
    category: 'operations',
    sortOrder: 90,
    description: 'Organization staffing and access-management controls.',
    longDescription: 'Staffing, access, and admin workflows for organization-level team management.',
    isAddOn: false,
    defaultMonthlyPriceCents: null,
    defaultAnnualPriceCents: null,
    badgeLabel: 'Core'
  },
  {
    key: 'platform_support',
    name: 'Platform Support',
    category: 'support',
    sortOrder: 100,
    description: 'Scoped platform support and troubleshooting workflows.',
    longDescription: 'Platform support coverage and troubleshooting workflows for onboarding and day-to-day operations.',
    isAddOn: false,
    defaultMonthlyPriceCents: null,
    defaultAnnualPriceCents: null,
    badgeLabel: 'Support'
  },
  {
    key: 'api_access',
    name: 'API Access',
    category: 'integrations',
    sortOrder: 110,
    description: 'API and integration access for external systems.',
    longDescription: 'External integration access for custom systems, reporting feeds, and partner workflows.',
    isAddOn: true,
    defaultMonthlyPriceCents: 14900,
    defaultAnnualPriceCents: 160900,
    badgeLabel: 'Enterprise'
  },
  {
    key: 'sso',
    name: 'SSO',
    category: 'security',
    sortOrder: 120,
    description: 'Single sign-on and enterprise identity integration.',
    longDescription: 'Enterprise identity integration via SSO and centralized authentication management.',
    isAddOn: true,
    defaultMonthlyPriceCents: 19900,
    defaultAnnualPriceCents: 214900,
    badgeLabel: 'Enterprise'
  },
  {
    key: 'custom_branding',
    name: 'Custom Branding',
    category: 'experience',
    sortOrder: 130,
    description: 'Custom brand controls for portal and platform surfaces.',
    longDescription: 'Branding controls for larger organizations that want a tailored client-facing experience.',
    isAddOn: true,
    defaultMonthlyPriceCents: 9900,
    defaultAnnualPriceCents: 106900,
    badgeLabel: 'Experience'
  },
  {
    key: 'priority_support',
    name: 'Priority Support',
    category: 'support',
    sortOrder: 140,
    description: 'Higher-touch support response and escalation handling.',
    longDescription: 'Priority response, faster escalation paths, and higher-touch support coverage.',
    isAddOn: true,
    defaultMonthlyPriceCents: 14900,
    defaultAnnualPriceCents: 160900,
    badgeLabel: 'Support'
  }
] as const;

export const DEFAULT_PLAN_DEFINITIONS = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Small organizations / pilot use.',
    shortDescription: 'Core recovery and clinical workflows for smaller teams and pilots.',
    longDescription: 'Starter is designed for small organizations and pilot deployments that need core clinical and consumer workflows without advanced billing, identity, or analytics modules.',
    sortOrder: 10,
    isActive: true,
    basePriceCents: 19900,
    annualBasePriceCents: 214900,
    setupFeeCents: 0,
    trialDays: 14,
    activeClientPriceCents: 1800,
    clinicianPriceCents: 5900,
    includedActiveClients: 25,
    includedClinicians: 5,
    targetCustomerProfile: 'Small clinics, early pilots, and lean teams proving out digital workflows.',
    customPricingRequired: false,
    salesContactRequired: false,
    badgeLabel: 'Entry',
    maxLocations: 1,
    maxOrgUsers: 10,
    maxClinicians: 5,
    maxActiveClients: 75,
    unlimitedLocations: false,
    unlimitedOrgUsers: false,
    unlimitedClinicians: false,
    unlimitedActiveClients: false,
    apiAccessIncluded: false,
    ssoIncluded: false,
    customBrandingIncluded: false,
    features: [
      { key: 'clinical', availability: 'included' },
      { key: 'consumer_portal', availability: 'included' },
      { key: 'org_user_management', availability: 'included' },
      { key: 'platform_support', availability: 'included' },
      { key: 'rcm', availability: 'excluded' },
      { key: 'advanced_reporting', availability: 'excluded' },
      { key: 'sso', availability: 'excluded' },
      { key: 'api_access', availability: 'excluded' }
    ]
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'Growing clinics with operational needs.',
    shortDescription: 'Adds multi-location operations and more room for expanding teams.',
    longDescription: 'Growth is meant for organizations expanding across locations and teams that want stronger operational packaging while keeping premium modules optional.',
    sortOrder: 20,
    isActive: true,
    basePriceCents: 59900,
    annualBasePriceCents: 646900,
    setupFeeCents: 9900,
    trialDays: 21,
    activeClientPriceCents: 1400,
    clinicianPriceCents: 4900,
    includedActiveClients: 75,
    includedClinicians: 15,
    targetCustomerProfile: 'Growing clinics adding staff, sites, and more structured operations.',
    customPricingRequired: false,
    salesContactRequired: false,
    badgeLabel: 'Popular',
    maxLocations: 5,
    maxOrgUsers: 40,
    maxClinicians: 20,
    maxActiveClients: 250,
    unlimitedLocations: false,
    unlimitedOrgUsers: false,
    unlimitedClinicians: false,
    unlimitedActiveClients: false,
    apiAccessIncluded: false,
    ssoIncluded: false,
    customBrandingIncluded: false,
    features: [
      { key: 'clinical', availability: 'included' },
      { key: 'consumer_portal', availability: 'included' },
      { key: 'multi_location', availability: 'included' },
      { key: 'org_user_management', availability: 'included' },
      { key: 'platform_support', availability: 'included' },
      { key: 'rcm', availability: 'add_on', monthlyPriceCents: 29900, annualPriceCents: 322900 },
      { key: 'advanced_reporting', availability: 'add_on', monthlyPriceCents: 14900, annualPriceCents: 160900 }
    ]
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'Established organizations needing full operations.',
    shortDescription: 'Full operations package with reporting and revenue-cycle capabilities.',
    longDescription: 'Professional is designed for established organizations that need multi-location operations, advanced reporting, and core revenue cycle workflows as part of the standard package.',
    sortOrder: 30,
    isActive: true,
    basePriceCents: 129900,
    annualBasePriceCents: 1402900,
    setupFeeCents: 19900,
    trialDays: 30,
    activeClientPriceCents: 1100,
    clinicianPriceCents: 3900,
    includedActiveClients: 200,
    includedClinicians: 40,
    targetCustomerProfile: 'Established organizations needing stronger admin, reporting, and reimbursement operations.',
    customPricingRequired: false,
    salesContactRequired: true,
    badgeLabel: 'Operations',
    maxLocations: 15,
    maxOrgUsers: 100,
    maxClinicians: 50,
    maxActiveClients: 600,
    unlimitedLocations: false,
    unlimitedOrgUsers: false,
    unlimitedClinicians: false,
    unlimitedActiveClients: false,
    apiAccessIncluded: false,
    ssoIncluded: false,
    customBrandingIncluded: false,
    features: [
      { key: 'clinical', availability: 'included' },
      { key: 'consumer_portal', availability: 'included' },
      { key: 'multi_location', availability: 'included' },
      { key: 'advanced_reporting', availability: 'included' },
      { key: 'rcm', availability: 'included' },
      { key: 'claims_management', availability: 'included' },
      { key: 'remittance_tracking', availability: 'included' },
      { key: 'org_user_management', availability: 'included' },
      { key: 'platform_support', availability: 'included' },
      { key: 'advanced_admin_tools', availability: 'add_on', monthlyPriceCents: 7900, annualPriceCents: 84900 },
      { key: 'priority_support', availability: 'add_on', monthlyPriceCents: 11900, annualPriceCents: 128900 }
    ]
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Large/custom organizations.',
    shortDescription: 'Custom package for larger organizations with identity, API, and branding needs.',
    longDescription: 'Enterprise is a sales-led plan for larger organizations that need broad feature access, identity and integration support, and tailored pricing or packaging.',
    sortOrder: 40,
    isActive: true,
    basePriceCents: 0,
    annualBasePriceCents: 0,
    setupFeeCents: null,
    trialDays: null,
    activeClientPriceCents: 0,
    clinicianPriceCents: 0,
    includedActiveClients: null,
    includedClinicians: null,
    targetCustomerProfile: 'Large organizations, multi-brand groups, and custom platform deployments.',
    customPricingRequired: true,
    salesContactRequired: true,
    badgeLabel: 'Custom',
    maxLocations: null,
    maxOrgUsers: null,
    maxClinicians: null,
    maxActiveClients: null,
    unlimitedLocations: true,
    unlimitedOrgUsers: true,
    unlimitedClinicians: true,
    unlimitedActiveClients: true,
    apiAccessIncluded: true,
    ssoIncluded: true,
    customBrandingIncluded: true,
    features: DEFAULT_PLATFORM_FEATURE_DEFINITIONS.map((feature) => ({
      key: feature.key,
      availability: 'included' as const
    }))
  }
] as const;

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
    billingContactEmail: null,
    customPricingEnabled: false,
    enterpriseManaged: false,
    basePriceCents: 0,
    annualBasePriceCents: null,
    setupFeeCents: null,
    activeClientPriceCents: 0,
    clinicianPriceCents: 0,
    includedActiveClients: null,
    includedClinicians: null,
    currency: 'usd',
    billingInterval: 'month',
    startsAt: null,
    trialStartsAt: null,
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
  billingContactEmail: string | null;
  customPricingEnabled: boolean;
  enterpriseManaged: boolean;
  basePriceCents: number;
  annualBasePriceCents: number | null;
  setupFeeCents: number | null;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  includedActiveClients: number | null;
  includedClinicians: number | null;
  currency: string;
  billingInterval: string;
  startsAt: Date;
  trialStartsAt: Date | null;
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
    billingContactEmail: subscription.billingContactEmail,
    customPricingEnabled: subscription.customPricingEnabled,
    enterpriseManaged: subscription.enterpriseManaged,
    basePriceCents: subscription.basePriceCents,
    annualBasePriceCents: subscription.annualBasePriceCents,
    setupFeeCents: subscription.setupFeeCents,
    activeClientPriceCents: subscription.activeClientPriceCents,
    clinicianPriceCents: subscription.clinicianPriceCents,
    includedActiveClients: subscription.includedActiveClients,
    includedClinicians: subscription.includedClinicians,
    currency: subscription.currency,
    billingInterval: subscription.billingInterval,
    startsAt: subscription.startsAt.toISOString(),
    trialStartsAt: subscription.trialStartsAt?.toISOString() ?? null,
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
  longDescription: string | null;
  category: string | null;
  isActive: boolean;
  isAddOn: boolean;
  defaultMonthlyPriceCents: number | null;
  defaultAnnualPriceCents: number | null;
  badgeLabel: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: feature.id,
    key: feature.key,
    name: feature.name,
    description: feature.description,
    longDescription: feature.longDescription,
    category: feature.category,
    isActive: feature.isActive,
    isAddOn: feature.isAddOn,
    defaultMonthlyPriceCents: feature.defaultMonthlyPriceCents,
    defaultAnnualPriceCents: feature.defaultAnnualPriceCents,
    badgeLabel: feature.badgeLabel,
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
  shortDescription: string | null;
  longDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  basePriceCents: number;
  annualBasePriceCents: number | null;
  setupFeeCents: number | null;
  trialDays: number | null;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  includedActiveClients: number | null;
  includedClinicians: number | null;
  currency: string;
  billingInterval: string;
  targetCustomerProfile: string | null;
  customPricingRequired: boolean;
  salesContactRequired: boolean;
  badgeLabel: string | null;
  maxLocations: number | null;
  maxOrgUsers: number | null;
  maxClinicians: number | null;
  maxActiveClients: number | null;
  unlimitedLocations: boolean;
  unlimitedOrgUsers: boolean;
  unlimitedClinicians: boolean;
  unlimitedActiveClients: boolean;
  apiAccessIncluded: boolean;
  ssoIncluded: boolean;
  customBrandingIncluded: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    organizationSubscriptions?: number;
  };
  planFeatures?: Array<{
    included: boolean;
    availability: string;
    monthlyPriceCents: number | null;
    annualPriceCents: number | null;
    notes: string | null;
    feature: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      longDescription: string | null;
      category: string | null;
      isActive: boolean;
      isAddOn: boolean;
      defaultMonthlyPriceCents: number | null;
      defaultAnnualPriceCents: number | null;
      badgeLabel: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
}) {
  const featureEntries = (plan.planFeatures ?? [])
    .sort((left, right) => left.feature.sortOrder - right.feature.sortOrder)
    .map((planFeature) => ({
      feature: serializeFeature(planFeature.feature),
      availability: planFeature.availability,
      included: planFeature.availability === 'included' || planFeature.included,
      monthlyPriceCents: planFeature.monthlyPriceCents,
      annualPriceCents: planFeature.annualPriceCents,
      notes: planFeature.notes
    }));

  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    shortDescription: plan.shortDescription ?? plan.description,
    longDescription: plan.longDescription,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    targetCustomerProfile: plan.targetCustomerProfile,
    customPricingRequired: plan.customPricingRequired,
    salesContactRequired: plan.salesContactRequired,
    badgeLabel: plan.badgeLabel,
    pricing: {
      basePriceCents: plan.basePriceCents,
      annualBasePriceCents: plan.annualBasePriceCents,
      setupFeeCents: plan.setupFeeCents,
      trialDays: plan.trialDays,
      activeClientPriceCents: plan.activeClientPriceCents,
      clinicianPriceCents: plan.clinicianPriceCents,
      includedActiveClients: plan.includedActiveClients,
      includedClinicians: plan.includedClinicians,
      currency: plan.currency,
      billingInterval: plan.billingInterval
    },
    limits: {
      maxLocations: plan.maxLocations,
      maxOrgUsers: plan.maxOrgUsers,
      maxClinicians: plan.maxClinicians,
      maxActiveClients: plan.maxActiveClients,
      unlimitedLocations: plan.unlimitedLocations,
      unlimitedOrgUsers: plan.unlimitedOrgUsers,
      unlimitedClinicians: plan.unlimitedClinicians,
      unlimitedActiveClients: plan.unlimitedActiveClients
    },
    packaging: {
      apiAccessIncluded: plan.apiAccessIncluded,
      ssoIncluded: plan.ssoIncluded,
      customBrandingIncluded: plan.customBrandingIncluded
    },
    includedFeatures: featureEntries.filter((entry) => entry.availability === 'included'),
    availableAddOns: featureEntries.filter((entry) => entry.availability === 'add_on'),
    featureMatrix: featureEntries,
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

  const planFeatureByFeatureId = new Map(
    (subscription?.plan?.planFeatures ?? []).map((planFeature) => [planFeature.featureId, planFeature])
  );
  const overrideByFeatureId = new Map(overrides.map((override) => [override.featureId, override]));

  return {
    subscription: subscription ? serializeSubscription(subscription) : buildSubscriptionScaffold(),
    features: features.map((feature) => {
      const planFeature = planFeatureByFeatureId.get(feature.id) ?? null;
      const override = overrideByFeatureId.get(feature.id) ?? null;
      const availability = planFeature?.availability ?? 'excluded';
      const includedInPlan = availability === 'included';
      const availableAsAddOn = availability === 'add_on';
      const enabled = override ? override.enabled : includedInPlan;

      return {
        ...serializeFeature(feature),
        enabled,
        includedInPlan,
        availableAsAddOn,
        source: override ? 'override' : includedInPlan ? 'plan' : 'none',
        planAvailability: availability,
        planPricing: planFeature
          ? {
              monthlyPriceCents: planFeature.monthlyPriceCents,
              annualPriceCents: planFeature.annualPriceCents,
              notes: planFeature.notes
            }
          : null,
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

export async function bootstrapDefaultPricingCatalog(
  db: PrismaClient | Prisma.TransactionClient,
  args: {
    tenantId: string;
  }
) {
  const featureRecords = [];

  for (const feature of DEFAULT_PLATFORM_FEATURE_DEFINITIONS) {
    const record = await db.platformFeature.upsert({
      where: {
        tenantId_key: {
          tenantId: args.tenantId,
          key: feature.key
        }
      },
      update: {
        name: feature.name,
        description: feature.description,
        longDescription: feature.longDescription,
        category: feature.category,
        isActive: true,
        isAddOn: feature.isAddOn,
        defaultMonthlyPriceCents: feature.defaultMonthlyPriceCents,
        defaultAnnualPriceCents: feature.defaultAnnualPriceCents,
        badgeLabel: feature.badgeLabel,
        sortOrder: feature.sortOrder
      },
      create: {
        tenantId: args.tenantId,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        longDescription: feature.longDescription,
        category: feature.category,
        isActive: true,
        isAddOn: feature.isAddOn,
        defaultMonthlyPriceCents: feature.defaultMonthlyPriceCents,
        defaultAnnualPriceCents: feature.defaultAnnualPriceCents,
        badgeLabel: feature.badgeLabel,
        sortOrder: feature.sortOrder
      }
    });

    featureRecords.push(record);
  }

  const featureIdByKey = new Map(featureRecords.map((feature) => [feature.key, feature.id]));
  const planRecords = [];

  for (const plan of DEFAULT_PLAN_DEFINITIONS) {
    const record = await db.subscriptionPlan.upsert({
      where: {
        tenantId_key: {
          tenantId: args.tenantId,
          key: plan.key
        }
      },
      update: {
        name: plan.name,
        description: plan.description,
        shortDescription: plan.shortDescription,
        longDescription: plan.longDescription,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        basePriceCents: plan.basePriceCents,
        annualBasePriceCents: plan.annualBasePriceCents,
        setupFeeCents: plan.setupFeeCents,
        trialDays: plan.trialDays,
        activeClientPriceCents: plan.activeClientPriceCents,
        clinicianPriceCents: plan.clinicianPriceCents,
        includedActiveClients: plan.includedActiveClients,
        includedClinicians: plan.includedClinicians,
        currency: 'usd',
        billingInterval: 'month',
        targetCustomerProfile: plan.targetCustomerProfile,
        customPricingRequired: plan.customPricingRequired,
        salesContactRequired: plan.salesContactRequired,
        badgeLabel: plan.badgeLabel,
        maxLocations: plan.maxLocations,
        maxOrgUsers: plan.maxOrgUsers,
        maxClinicians: plan.maxClinicians,
        maxActiveClients: plan.maxActiveClients,
        unlimitedLocations: plan.unlimitedLocations,
        unlimitedOrgUsers: plan.unlimitedOrgUsers,
        unlimitedClinicians: plan.unlimitedClinicians,
        unlimitedActiveClients: plan.unlimitedActiveClients,
        apiAccessIncluded: plan.apiAccessIncluded,
        ssoIncluded: plan.ssoIncluded,
        customBrandingIncluded: plan.customBrandingIncluded
      },
      create: {
        tenantId: args.tenantId,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        shortDescription: plan.shortDescription,
        longDescription: plan.longDescription,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        basePriceCents: plan.basePriceCents,
        annualBasePriceCents: plan.annualBasePriceCents,
        setupFeeCents: plan.setupFeeCents,
        trialDays: plan.trialDays,
        activeClientPriceCents: plan.activeClientPriceCents,
        clinicianPriceCents: plan.clinicianPriceCents,
        includedActiveClients: plan.includedActiveClients,
        includedClinicians: plan.includedClinicians,
        currency: 'usd',
        billingInterval: 'month',
        targetCustomerProfile: plan.targetCustomerProfile,
        customPricingRequired: plan.customPricingRequired,
        salesContactRequired: plan.salesContactRequired,
        badgeLabel: plan.badgeLabel,
        maxLocations: plan.maxLocations,
        maxOrgUsers: plan.maxOrgUsers,
        maxClinicians: plan.maxClinicians,
        maxActiveClients: plan.maxActiveClients,
        unlimitedLocations: plan.unlimitedLocations,
        unlimitedOrgUsers: plan.unlimitedOrgUsers,
        unlimitedClinicians: plan.unlimitedClinicians,
        unlimitedActiveClients: plan.unlimitedActiveClients,
        apiAccessIncluded: plan.apiAccessIncluded,
        ssoIncluded: plan.ssoIncluded,
        customBrandingIncluded: plan.customBrandingIncluded
      }
    });

    planRecords.push(record);
  }

  for (const plan of DEFAULT_PLAN_DEFINITIONS) {
    const planRecord = planRecords.find((candidate) => candidate.key === plan.key);
    if (!planRecord) {
      continue;
    }

    await db.planFeature.deleteMany({
      where: {
        planId: planRecord.id
      }
    });

    const rows = plan.features
      .map((feature) => {
        const featureId = featureIdByKey.get(feature.key);

        if (!featureId) {
          return null;
        }

        return {
          planId: planRecord.id,
          featureId,
          included: feature.availability === 'included',
          availability: feature.availability,
          monthlyPriceCents: 'monthlyPriceCents' in feature ? feature.monthlyPriceCents ?? null : null,
          annualPriceCents: 'annualPriceCents' in feature ? feature.annualPriceCents ?? null : null,
          notes: null
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length) {
      await db.planFeature.createMany({
        data: rows
      });
    }
  }

  return {
    features: featureRecords,
    plans: planRecords
  };
}
