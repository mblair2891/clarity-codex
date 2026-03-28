import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const platformRoleMap = {
  platform_admin: 'platform_admin',
  support: 'support'
};

const organizationRoleMap = {
  org_admin: 'org_admin',
  clinical_staff: 'clinical_staff',
  clinician: 'clinician',
  case_manager: 'case_manager',
  billing: 'billing',
  consumer: 'consumer'
};

const organizationBackfillStatements = [
  `UPDATE "DailyCheckIn" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "JournalEntry" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Goal" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Routine" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "RoutineCompletion" AS record
   SET "organizationId" = routine."organizationId"
   FROM "Routine" AS routine
   WHERE record."routineId" = routine."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "RecoveryPlan" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "ConsumerCondition" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "TreatmentPlan" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "MedicationRecord" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Coverage" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Authorization" AS record
   SET "organizationId" = coverage."organizationId"
   FROM "Coverage" AS coverage
   WHERE record."coverageId" = coverage."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "SessionNote" AS record
   SET "organizationId" = appointment."organizationId"
   FROM "Appointment" AS appointment
   WHERE record."appointmentId" = appointment."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Charge" AS record
   SET "organizationId" = encounter."organizationId"
   FROM "Encounter" AS encounter
   WHERE record."encounterId" = encounter."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Claim" AS record
   SET "organizationId" = encounter."organizationId"
   FROM "Encounter" AS encounter
   WHERE record."encounterId" = encounter."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "BillingWorkItemActivity" AS record
   SET "organizationId" = work_item."organizationId"
   FROM "BillingWorkItem" AS work_item
   WHERE record."workItemId" = work_item."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Remittance" AS record
   SET "organizationId" = claim."organizationId"
   FROM "Claim" AS claim
   WHERE record."claimId" = claim."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Denial" AS record
   SET "organizationId" = claim."organizationId"
   FROM "Claim" AS claim
   WHERE record."claimId" = claim."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "PatientLedgerEntry" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`,
  `UPDATE "Invoice" AS record
   SET "organizationId" = consumer."organizationId"
   FROM "Consumer" AS consumer
   WHERE record."consumerId" = consumer."id"
     AND record."organizationId" IS NULL`
];

async function backfillUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      role: true
    }
  });

  for (const user of users) {
    const normalizedEmail = user.email.trim().toLowerCase();
    const platformRole = platformRoleMap[user.role];

    await prisma.$transaction(async (transaction) => {
      if (user.normalizedEmail !== normalizedEmail) {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            normalizedEmail
          }
        });
      }

      if (platformRole) {
        await transaction.userPlatformRole.upsert({
          where: {
            userId_role: {
              userId: user.id,
              role: platformRole
            }
          },
          update: {},
          create: {
            userId: user.id,
            role: platformRole
          }
        });
      }
    });
  }
}

async function backfillMemberships() {
  const memberships = await prisma.membership.findMany({
    select: {
      id: true,
      role: true,
      organizationRole: true
    }
  });

  for (const membership of memberships) {
    const organizationRole = organizationRoleMap[membership.role];
    if (!organizationRole || membership.organizationRole === organizationRole) {
      continue;
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        organizationRole
      }
    });
  }
}

async function backfillOrganizationIds() {
  for (const statement of organizationBackfillStatements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function main() {
  console.log('Starting Phase 1 access backfill.');

  await backfillUsers();
  console.log('Backfilled normalizedEmail and platform roles.');

  await backfillMemberships();
  console.log('Backfilled membership organization roles.');

  await backfillOrganizationIds();
  console.log('Backfilled organizationId on child tables.');

  console.log('Phase 1 access backfill complete.');
}

main()
  .catch((error) => {
    console.error('Phase 1 access backfill failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
