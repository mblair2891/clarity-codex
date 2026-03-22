import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

function requirePasswordEnv(name) {
  const value = process.env[name];

  if (!value || value.trim().length < 8) {
    throw new Error(`${name} is required for beta seeding and must be at least 8 characters.`);
  }

  return value;
}

const seedPasswords = {
  platformAdmin: requirePasswordEnv('BETA_PLATFORM_ADMIN_PASSWORD'),
  clinicalStaff: requirePasswordEnv('BETA_CLINICAL_PASSWORD'),
  billing: requirePasswordEnv('BETA_BILLING_PASSWORD'),
  consumer: requirePasswordEnv('BETA_CONSUMER_PASSWORD')
};

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'beta-demo' },
    update: { name: 'Clarity Beta Demo Tenant' },
    create: {
      slug: 'beta-demo',
      name: 'Clarity Beta Demo Tenant'
    }
  });

  let organization = await prisma.organization.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Clarity Beta Clinic'
    }
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        name: 'Clarity Beta Clinic',
        npi: '1992999999'
      }
    });
  }

  let consumer = await prisma.consumer.findFirst({
    where: {
      tenantId: tenant.id,
      firstName: 'Ava',
      lastName: 'Martinez'
    }
  });

  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        firstName: 'Ava',
        lastName: 'Martinez',
        traumaMode: true,
        cognitiveAssistMode: true
      }
    });
  }

  const seededUsers = [
    {
      email: 'beta-admin@claritybridgehealth.com',
      fullName: 'Clarity Beta Admin',
      role: 'platform_admin',
      password: seedPasswords.platformAdmin,
      membershipRole: 'org_admin',
      consumerId: null
    },
    {
      email: 'beta-clinical@claritybridgehealth.com',
      fullName: 'Taylor Clinical',
      role: 'clinical_staff',
      password: seedPasswords.clinicalStaff,
      membershipRole: 'clinical_staff',
      consumerId: null
    },
    {
      email: 'beta-billing@claritybridgehealth.com',
      fullName: 'Bailey Billing',
      role: 'billing',
      password: seedPasswords.billing,
      membershipRole: 'billing',
      consumerId: null
    },
    {
      email: 'beta-consumer@claritybridgehealth.com',
      fullName: 'Ava Martinez',
      role: 'consumer',
      password: seedPasswords.consumer,
      membershipRole: 'consumer',
      consumerId: consumer?.id ?? null
    }
  ];

  const upsertedUsers = [];

  for (const seededUser of seededUsers) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: seededUser.email
        }
      },
      update: {
        fullName: seededUser.fullName,
        role: seededUser.role,
        passwordHash: await hashPassword(seededUser.password),
        isActive: true,
        mustChangePassword: false,
        consumerId: seededUser.consumerId
      },
      create: {
        tenantId: tenant.id,
        email: seededUser.email,
        fullName: seededUser.fullName,
        role: seededUser.role,
        passwordHash: await hashPassword(seededUser.password),
        isActive: true,
        mustChangePassword: false,
        consumerId: seededUser.consumerId
      }
    });

    upsertedUsers.push(user);

    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId: organization.id
      }
    });

    if (!existingMembership) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: seededUser.membershipRole
        }
      });
    }
  }

  console.log(JSON.stringify({
    seeded: true,
    tenantId: tenant.id,
    organizationId: organization.id,
    adminUserId: upsertedUsers[0]?.id ?? null,
    sampleAccounts: seededUsers.map((user) => ({
      email: user.email,
      role: user.role
    }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
