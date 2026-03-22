import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

async function main() {
  const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG ?? 'beta-demo';
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Beta Admin';
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is required.');
  }

  if (!adminPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD is required.');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      organizations: {
        take: 1,
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!tenant) {
    throw new Error(`Tenant with slug "${tenantSlug}" was not found.`);
  }

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: adminEmail
      }
    },
    update: {
      fullName: adminName,
      role: 'platform_admin',
      passwordHash: await hashPassword(adminPassword),
      isActive: true,
      mustChangePassword: false
    },
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      fullName: adminName,
      role: 'platform_admin',
      passwordHash: await hashPassword(adminPassword),
      isActive: true,
      mustChangePassword: false
    }
  });

  const primaryOrganization = tenant.organizations[0];

  if (primaryOrganization) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: admin.id,
        organizationId: primaryOrganization.id
      }
    });

    if (!membership) {
      await prisma.membership.create({
        data: {
          userId: admin.id,
          organizationId: primaryOrganization.id,
          role: 'org_admin'
        }
      });
    }
  }

  console.log(JSON.stringify({
    bootstrapped: true,
    tenantId: tenant.id,
    adminUserId: admin.id,
    organizationId: primaryOrganization?.id ?? null
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
