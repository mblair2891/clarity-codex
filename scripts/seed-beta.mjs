import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'beta-demo';
const DEFAULT_TENANT_NAME = 'Clarity Beta';
const DEFAULT_PLATFORM_ADMIN_EMAIL = 'beta-admin@claritybridgehealth.com';
const DEFAULT_PLATFORM_ADMIN_NAME = 'Clarity Platform Admin';

const FEATURE_DEFINITIONS = [
  { key: 'clinical', name: 'Clinical', category: 'core', sortOrder: 10, description: 'Clinical workflows, charting, and care-team operations.' },
  { key: 'consumer_portal', name: 'Consumer Portal', category: 'core', sortOrder: 20, description: 'Consumer-facing recovery tools, check-ins, and journaling.' },
  { key: 'rcm', name: 'RCM', category: 'revenue_cycle', sortOrder: 30, description: 'Revenue cycle workspace and operational billing workflows.' },
  { key: 'claims_management', name: 'Claims Management', category: 'revenue_cycle', sortOrder: 40, description: 'Claims submission, tracking, and denial follow-up workflows.' },
  { key: 'remittance_tracking', name: 'Remittance Tracking', category: 'revenue_cycle', sortOrder: 50, description: 'ERA and remittance visibility for reimbursement tracking.' },
  { key: 'multi_location', name: 'Multi-location', category: 'operations', sortOrder: 60, description: 'Operate multiple clinic locations inside one organization.' },
  { key: 'advanced_reporting', name: 'Advanced Reporting', category: 'analytics', sortOrder: 70, description: 'Deeper reporting, trend analysis, and operational analytics.' },
  { key: 'advanced_admin_tools', name: 'Advanced Admin Tools', category: 'operations', sortOrder: 80, description: 'Expanded control-plane and tenant administration tools.' },
  { key: 'org_user_management', name: 'Org User Management', category: 'operations', sortOrder: 90, description: 'Organization staffing and access-management controls.' },
  { key: 'platform_support', name: 'Platform Support', category: 'support', sortOrder: 100, description: 'Scoped platform support and troubleshooting workflows.' },
  { key: 'api_access', name: 'API Access', category: 'integrations', sortOrder: 110, description: 'API and integration access for external systems.' },
  { key: 'sso', name: 'SSO', category: 'security', sortOrder: 120, description: 'Single sign-on and enterprise identity integration.' },
  { key: 'custom_branding', name: 'Custom Branding', category: 'experience', sortOrder: 130, description: 'Custom brand controls for portal and platform surfaces.' },
  { key: 'priority_support', name: 'Priority Support', category: 'support', sortOrder: 140, description: 'Higher-touch support response and escalation handling.' }
];

const PLAN_DEFINITIONS = [
  {
    key: 'starter',
    name: 'Starter',
    sortOrder: 10,
    description: 'Core clinical and consumer portal tooling for smaller teams getting started.',
    basePriceCents: 29900,
    activeClientPriceCents: 1500,
    clinicianPriceCents: 0,
    features: ['clinical', 'consumer_portal']
  },
  {
    key: 'growth',
    name: 'Growth',
    sortOrder: 20,
    description: 'Adds multi-location support for growing clinic operations.',
    basePriceCents: 79900,
    activeClientPriceCents: 1300,
    clinicianPriceCents: 4900,
    features: ['clinical', 'consumer_portal', 'multi_location']
  },
  {
    key: 'professional',
    name: 'Professional',
    sortOrder: 30,
    description: 'Adds reporting and core revenue-cycle workflows for scaling organizations.',
    basePriceCents: 149900,
    activeClientPriceCents: 1100,
    clinicianPriceCents: 6900,
    features: ['clinical', 'consumer_portal', 'multi_location', 'advanced_reporting', 'rcm']
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    sortOrder: 40,
    description: 'Full platform footprint with enterprise controls, integrations, and premium support.',
    basePriceCents: 249900,
    activeClientPriceCents: 900,
    clinicianPriceCents: 8900,
    features: FEATURE_DEFINITIONS.map((feature) => feature.key)
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
        category: feature.category,
        sortOrder: feature.sortOrder,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
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
        isActive: true,
        sortOrder: plan.sortOrder,
        basePriceCents: plan.basePriceCents,
        activeClientPriceCents: plan.activeClientPriceCents,
        clinicianPriceCents: plan.clinicianPriceCents,
        currency: 'usd',
        billingInterval: 'month'
      },
      create: {
        tenantId: tenant.id,
        key: plan.key,
        name: plan.name,
        description: plan.description,
        isActive: true,
        sortOrder: plan.sortOrder,
        basePriceCents: plan.basePriceCents,
        activeClientPriceCents: plan.activeClientPriceCents,
        clinicianPriceCents: plan.clinicianPriceCents,
        currency: 'usd',
        billingInterval: 'month'
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
      .map((featureKey) => {
        const featureId = featureIdByKey.get(featureKey);
        if (!featureId) {
          return null;
        }

        return {
          planId: planRecord.id,
          featureId,
          included: true
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
