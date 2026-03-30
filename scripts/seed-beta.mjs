import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'beta-demo';
const DEFAULT_TENANT_NAME = 'Clarity Beta';
const DEFAULT_PLATFORM_ADMIN_EMAIL = 'beta-admin@claritybridgehealth.com';
const DEFAULT_PLATFORM_ADMIN_NAME = 'Clarity Platform Admin';

const FEATURE_DEFINITIONS = [
  { key: 'clinical', name: 'Clinical', category: 'core', sortOrder: 10, description: 'Clinical workflows, charting, and care-team operations.', longDescription: 'Core clinical workflows for intakes, charting, appointments, and treatment operations.', isAddOn: false, defaultMonthlyPriceCents: null, defaultAnnualPriceCents: null, badgeLabel: 'Core' },
  { key: 'consumer_portal', name: 'Consumer Portal', category: 'core', sortOrder: 20, description: 'Consumer-facing recovery tools, check-ins, and journaling.', longDescription: 'Daily recovery engagement tools for consumers, including check-ins, goals, and journaling.', isAddOn: false, defaultMonthlyPriceCents: null, defaultAnnualPriceCents: null, badgeLabel: 'Core' },
  { key: 'rcm', name: 'RCM', category: 'revenue_cycle', sortOrder: 30, description: 'Revenue cycle workspace and operational billing workflows.', longDescription: 'A revenue cycle workbench for billing operations, follow-up, and collections workflows.', isAddOn: true, defaultMonthlyPriceCents: 39900, defaultAnnualPriceCents: 430900, badgeLabel: 'Add-on' },
  { key: 'claims_management', name: 'Claims Management', category: 'revenue_cycle', sortOrder: 40, description: 'Claims submission, tracking, and denial follow-up workflows.', longDescription: 'Claims lifecycle support from draft through submission, denial handling, and resolution.', isAddOn: true, defaultMonthlyPriceCents: 14900, defaultAnnualPriceCents: 160900, badgeLabel: 'Add-on' },
  { key: 'remittance_tracking', name: 'Remittance Tracking', category: 'revenue_cycle', sortOrder: 50, description: 'ERA and remittance visibility for reimbursement tracking.', longDescription: 'Visibility into remittances and reimbursement status for finance and operations teams.', isAddOn: true, defaultMonthlyPriceCents: 9900, defaultAnnualPriceCents: 106900, badgeLabel: 'Add-on' },
  { key: 'multi_location', name: 'Multi-location', category: 'operations', sortOrder: 60, description: 'Operate multiple clinic locations inside one organization.', longDescription: 'Supports organizations running multiple clinic locations with shared control-plane visibility.', isAddOn: true, defaultMonthlyPriceCents: 9900, defaultAnnualPriceCents: 106900, badgeLabel: 'Ops' },
  { key: 'advanced_reporting', name: 'Advanced Reporting', category: 'analytics', sortOrder: 70, description: 'Deeper reporting, trend analysis, and operational analytics.', longDescription: 'Expanded analytics and reporting for leadership, operations, and performance review.', isAddOn: true, defaultMonthlyPriceCents: 19900, defaultAnnualPriceCents: 214900, badgeLabel: 'Analytics' },
  { key: 'advanced_admin_tools', name: 'Advanced Admin Tools', category: 'operations', sortOrder: 80, description: 'Expanded control-plane and tenant administration tools.', longDescription: 'Advanced operational controls for larger org setups, governance, and platform operations.', isAddOn: true, defaultMonthlyPriceCents: 9900, defaultAnnualPriceCents: 106900, badgeLabel: 'Ops' },
  { key: 'org_user_management', name: 'Org User Management', category: 'operations', sortOrder: 90, description: 'Organization staffing and access-management controls.', longDescription: 'Staffing, access, and admin workflows for organization-level team management.', isAddOn: false, defaultMonthlyPriceCents: null, defaultAnnualPriceCents: null, badgeLabel: 'Core' },
  { key: 'platform_support', name: 'Platform Support', category: 'support', sortOrder: 100, description: 'Scoped platform support and troubleshooting workflows.', longDescription: 'Platform support coverage and troubleshooting workflows for onboarding and day-to-day operations.', isAddOn: false, defaultMonthlyPriceCents: null, defaultAnnualPriceCents: null, badgeLabel: 'Support' },
  { key: 'api_access', name: 'API Access', category: 'integrations', sortOrder: 110, description: 'API and integration access for external systems.', longDescription: 'External integration access for custom systems, reporting feeds, and partner workflows.', isAddOn: true, defaultMonthlyPriceCents: 14900, defaultAnnualPriceCents: 160900, badgeLabel: 'Enterprise' },
  { key: 'sso', name: 'SSO', category: 'security', sortOrder: 120, description: 'Single sign-on and enterprise identity integration.', longDescription: 'Enterprise identity integration via SSO and centralized authentication management.', isAddOn: true, defaultMonthlyPriceCents: 19900, defaultAnnualPriceCents: 214900, badgeLabel: 'Enterprise' },
  { key: 'custom_branding', name: 'Custom Branding', category: 'experience', sortOrder: 130, description: 'Custom brand controls for portal and platform surfaces.', longDescription: 'Branding controls for larger organizations that want a tailored client-facing experience.', isAddOn: true, defaultMonthlyPriceCents: 9900, defaultAnnualPriceCents: 106900, badgeLabel: 'Experience' },
  { key: 'priority_support', name: 'Priority Support', category: 'support', sortOrder: 140, description: 'Higher-touch support response and escalation handling.', longDescription: 'Priority response, faster escalation paths, and higher-touch support coverage.', isAddOn: true, defaultMonthlyPriceCents: 14900, defaultAnnualPriceCents: 160900, badgeLabel: 'Support' }
];

const PLAN_DEFINITIONS = [
  {
    key: 'starter',
    name: 'Starter',
    sortOrder: 10,
    description: 'Small organizations / pilot use.',
    shortDescription: 'Core recovery and clinical workflows for smaller teams and pilots.',
    longDescription: 'Starter is designed for small organizations and pilot deployments that need core clinical and consumer workflows without advanced billing, identity, or analytics modules.',
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
    sortOrder: 20,
    description: 'Growing clinics with operational needs.',
    shortDescription: 'Adds multi-location operations and more room for expanding teams.',
    longDescription: 'Growth is meant for organizations expanding across locations and teams that want stronger operational packaging while keeping premium modules optional.',
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
    sortOrder: 30,
    description: 'Established organizations needing full operations.',
    shortDescription: 'Full operations package with reporting and revenue-cycle capabilities.',
    longDescription: 'Professional is designed for established organizations that need multi-location operations, advanced reporting, and core revenue cycle workflows as part of the standard package.',
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
    sortOrder: 40,
    description: 'Large/custom organizations.',
    shortDescription: 'Custom package for larger organizations with identity, API, and branding needs.',
    longDescription: 'Enterprise is a sales-led plan for larger organizations that need broad feature access, identity and integration support, and tailored pricing or packaging.',
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
    features: FEATURE_DEFINITIONS.map((feature) => ({ key: feature.key, availability: 'included' }))
  }
];

function readOptionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readOptionalPassword(name) {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  if (value.trim().length < 8) {
    throw new Error(`${name} must be at least 8 characters when provided.`);
  }

  return value;
}

async function main() {
  const tenantSlug = readOptionalEnv('BETA_TENANT_SLUG', DEFAULT_TENANT_SLUG);
  const tenantName = readOptionalEnv('BETA_TENANT_NAME', DEFAULT_TENANT_NAME);
  const adminEmail = readOptionalEnv('BETA_PLATFORM_ADMIN_EMAIL', DEFAULT_PLATFORM_ADMIN_EMAIL).toLowerCase();
  const adminName = readOptionalEnv('BETA_PLATFORM_ADMIN_NAME', DEFAULT_PLATFORM_ADMIN_NAME);
  const adminPassword = readOptionalPassword('BETA_PLATFORM_ADMIN_PASSWORD');

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {
      name: tenantName
    },
    create: {
      slug: tenantSlug,
      name: tenantName
    }
  });

  const existingAdmin = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: adminEmail
      }
    }
  });

  if (!existingAdmin && !adminPassword) {
    throw new Error(
      'BETA_PLATFORM_ADMIN_PASSWORD is required to create the platform admin account when it does not already exist.'
    );
  }

  if (existingAdmin && !existingAdmin.passwordHash && !adminPassword) {
    throw new Error(
      'The existing platform admin account has no password hash. Set BETA_PLATFORM_ADMIN_PASSWORD to repair login access.'
    );
  }

  const passwordHash = adminPassword
    ? await hashPassword(adminPassword)
    : existingAdmin?.passwordHash;

  if (!passwordHash) {
    throw new Error('A platform admin password hash could not be determined.');
  }

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          fullName: adminName,
          role: 'platform_admin',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          consumerId: null
        }
      })
    : await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          fullName: adminName,
          role: 'platform_admin',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          consumerId: null
        }
      });

  const featureRecords = [];
  for (const feature of FEATURE_DEFINITIONS) {
    const record = await prisma.platformFeature.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: feature.key
        }
      },
      update: {
        name: feature.name,
        description: feature.description,
        longDescription: feature.longDescription,
        category: feature.category,
        isAddOn: feature.isAddOn,
        defaultMonthlyPriceCents: feature.defaultMonthlyPriceCents,
        defaultAnnualPriceCents: feature.defaultAnnualPriceCents,
        badgeLabel: feature.badgeLabel,
        sortOrder: feature.sortOrder,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        longDescription: feature.longDescription,
        category: feature.category,
        isAddOn: feature.isAddOn,
        defaultMonthlyPriceCents: feature.defaultMonthlyPriceCents,
        defaultAnnualPriceCents: feature.defaultAnnualPriceCents,
        badgeLabel: feature.badgeLabel,
        sortOrder: feature.sortOrder,
        isActive: true
      }
    });

    featureRecords.push(record);
  }

  const featureIdByKey = new Map(featureRecords.map((feature) => [feature.key, feature.id]));
  const planRecords = [];

  for (const plan of PLAN_DEFINITIONS) {
    const record = await prisma.subscriptionPlan.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: plan.key
        }
      },
      update: {
        name: plan.name,
        description: plan.description,
        shortDescription: plan.shortDescription,
        longDescription: plan.longDescription,
        isActive: true,
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
        tenantId: tenant.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        shortDescription: plan.shortDescription,
        longDescription: plan.longDescription,
        isActive: true,
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

  for (const plan of PLAN_DEFINITIONS) {
    const planRecord = planRecords.find((candidate) => candidate.key === plan.key);
    if (!planRecord) {
      continue;
    }

    await prisma.planFeature.deleteMany({
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
          monthlyPriceCents: feature.monthlyPriceCents ?? null,
          annualPriceCents: feature.annualPriceCents ?? null,
          notes: null
        };
      })
      .filter(Boolean);

    if (rows.length) {
      await prisma.planFeature.createMany({
        data: rows,
        skipDuplicates: true
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        seeded: true,
        seedMode: 'platform_admin_only',
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name
        },
        platformAdmin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          passwordUpdated: Boolean(adminPassword)
        },
        subscriptionCatalog: {
          plans: planRecords.map((plan) => plan.key),
          features: featureRecords.map((feature) => feature.key)
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
