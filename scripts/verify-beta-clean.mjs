import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'beta-demo';
const DEFAULT_PLATFORM_ADMIN_EMAIL = 'beta-admin@claritybridgehealth.com';

function readOptionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

async function main() {
  const tenantSlug = readOptionalEnv('PRESERVE_TENANT_SLUG', DEFAULT_TENANT_SLUG);
  const preserveAdminEmail = readOptionalEnv(
    'PRESERVE_PLATFORM_ADMIN_EMAIL',
    DEFAULT_PLATFORM_ADMIN_EMAIL
  ).toLowerCase();

  const preservedTenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug }
  });

  const preservedAdmin = preservedTenant
    ? await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: preservedTenant.id,
            email: preserveAdminEmail
          }
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          consumerId: true
        }
      })
    : null;

  const [
    tenants,
    users,
    memberships,
    organizations,
    consumers,
    dailyCheckIns,
    checkInReviews,
    clinicalNotes,
    journalEntries,
    goals,
    routines,
    routineCompletions,
    recoveryPlans,
    consumerConditions,
    medicationRecords,
    appointments,
    billingWorkItems,
    billingNotes,
    billingWorkItemActivities,
    invoices,
    ledgerEntries,
    promptRegistry,
    aiRuns,
    auditLogs
  ] = await prisma.$transaction([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.organization.count(),
    prisma.consumer.count(),
    prisma.dailyCheckIn.count(),
    prisma.checkInReview.count(),
    prisma.clinicalNote.count(),
    prisma.journalEntry.count(),
    prisma.goal.count(),
    prisma.routine.count(),
    prisma.routineCompletion.count(),
    prisma.recoveryPlan.count(),
    prisma.consumerCondition.count(),
    prisma.medicationRecord.count(),
    prisma.appointment.count(),
    prisma.billingWorkItem.count(),
    prisma.billingNote.count(),
    prisma.billingWorkItemActivity.count(),
    prisma.invoice.count(),
    prisma.patientLedgerEntry.count(),
    prisma.promptRegistry.count(),
    prisma.aiRun.count(),
    prisma.auditLog.count()
  ]);

  console.log(
    JSON.stringify(
      {
        preservedTenant: preservedTenant
          ? {
              id: preservedTenant.id,
              slug: preservedTenant.slug,
              name: preservedTenant.name
            }
          : null,
        preservedPlatformAdmin: preservedAdmin,
        counts: {
          tenants,
          users,
          memberships,
          organizations,
          consumers,
          dailyCheckIns,
          checkInReviews,
          clinicalNotes,
          journalEntries,
          goals,
          routines,
          routineCompletions,
          recoveryPlans,
          consumerConditions,
          medicationRecords,
          appointments,
          billingWorkItems,
          billingNotes,
          billingWorkItemActivities,
          invoices,
          ledgerEntries,
          promptRegistry,
          aiRuns,
          auditLogs
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
