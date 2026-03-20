import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'beta-admin@claritybridgehealth.com'
      }
    },
    update: {
      fullName: 'Clarity Beta Admin',
      role: 'platform_admin'
    },
    create: {
      tenantId: tenant.id,
      email: 'beta-admin@claritybridgehealth.com',
      fullName: 'Clarity Beta Admin',
      role: 'platform_admin'
    }
  });

  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: admin.id,
      organizationId: organization.id
    }
  });

  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId: admin.id,
        organizationId: organization.id,
        role: 'org_admin'
      }
    });
  }

  const existingConsumer = await prisma.consumer.findFirst({
    where: {
      tenantId: tenant.id,
      firstName: 'Ava',
      lastName: 'Martinez'
    }
  });

  if (!existingConsumer) {
    await prisma.consumer.create({
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

  console.log(JSON.stringify({
    seeded: true,
    tenantId: tenant.id,
    organizationId: organization.id,
    adminUserId: admin.id
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
