import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'beta-demo';
const DEFAULT_TENANT_NAME = 'Clarity Beta';
const DEFAULT_PLATFORM_ADMIN_EMAIL = 'beta-admin@claritybridgehealth.com';
const DEFAULT_PLATFORM_ADMIN_NAME = 'Clarity Platform Admin';

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
