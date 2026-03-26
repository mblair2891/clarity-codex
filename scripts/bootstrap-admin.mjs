import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

async function main() {
  const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG ?? 'beta-demo';
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME ?? 'Clarity Beta';
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Beta Admin';
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!adminEmail) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is required.');
  }

  if (!adminPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD is required.');
  }

  const normalizedAdminEmail = adminEmail.trim().toLowerCase();
  const trimmedAdminName = adminName.trim();

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

  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: normalizedAdminEmail
      }
    },
    update: {
      fullName: trimmedAdminName,
      role: 'platform_admin',
      passwordHash: await hashPassword(adminPassword),
      isActive: true,
      mustChangePassword: false,
      consumerId: null
    },
    create: {
      tenantId: tenant.id,
      email: normalizedAdminEmail,
      fullName: trimmedAdminName,
      role: 'platform_admin',
      passwordHash: await hashPassword(adminPassword),
      isActive: true,
      mustChangePassword: false,
      consumerId: null
    }
  });

  console.log(JSON.stringify({
    bootstrapped: true,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    adminUserId: admin.id,
    adminEmail: admin.email,
    organizationId: null
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
