import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_SLUG = 'beta-demo';
const DEFAULT_PLATFORM_ADMIN_EMAIL = 'beta-admin@claritybridgehealth.com';

function readOptionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

async function deleteManyIfIds(ids, deleter) {
  if (ids.length === 0) {
    return 0;
  }

  const result = await deleter(ids);
  return result.count;
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

  if (!preservedTenant) {
    console.log(
      JSON.stringify(
        {
          cleaned: false,
          preserveTenantSlug: tenantSlug,
          reason: 'preserve_tenant_not_found'
        },
        null,
        2
      )
    );
    return;
  }

  const preservedAdmin = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: preservedTenant.id,
        email: preserveAdminEmail
      }
    }
  });

  if (!preservedAdmin) {
    throw new Error(
      `Platform admin ${preserveAdminEmail} was not found in tenant ${tenantSlug}. Seed or bootstrap that account before cleanup.`
    );
  }

  if (preservedAdmin.role !== 'platform_admin') {
    throw new Error(`${preserveAdminEmail} exists, but it is not a platform_admin account.`);
  }

  const tenantRows = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true }
  });

  const tenantIds = tenantRows.map((row) => row.id);
  const tenantIdsToDelete = tenantRows.filter((row) => row.id !== preservedTenant.id).map((row) => row.id);

  const [
    organizationRows,
    consumerRows,
    tenantUserRows,
    routineRows,
    appointmentRows,
    encounterRows,
    claimRows,
    workItemRows,
    payerRows,
    planRows,
    coverageRows
  ] = await prisma.$transaction([
    prisma.organization.findMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      },
      select: { id: true }
    }),
    prisma.consumer.findMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      },
      select: { id: true }
    }),
    prisma.user.findMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      },
      select: { id: true, email: true }
    }),
    prisma.routine.findMany({
      where: {
        consumer: {
          tenantId: {
            in: tenantIds
          }
        }
      },
      select: { id: true }
    }),
    prisma.appointment.findMany({
      where: {
        organization: {
          tenantId: {
            in: tenantIds
          }
        }
      },
      select: { id: true }
    }),
    prisma.encounter.findMany({
      where: {
        organization: {
          tenantId: {
            in: tenantIds
          }
        }
      },
      select: { id: true }
    }),
    prisma.claim.findMany({
      where: {
        encounter: {
          organization: {
            tenantId: {
              in: tenantIds
            }
          }
        }
      },
      select: { id: true }
    }),
    prisma.billingWorkItem.findMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      },
      select: { id: true }
    }),
    prisma.payer.findMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      },
      select: { id: true }
    }),
    prisma.insurancePlan.findMany({
      where: {
        payer: {
          tenantId: {
            in: tenantIds
          }
        }
      },
      select: { id: true }
    }),
    prisma.coverage.findMany({
      where: {
        consumer: {
          tenantId: {
            in: tenantIds
          }
        }
      },
      select: { id: true }
    })
  ]);

  const organizationIds = organizationRows.map((row) => row.id);
  const consumerIds = consumerRows.map((row) => row.id);
  const tenantUserIds = tenantUserRows.map((row) => row.id);
  const routineIds = routineRows.map((row) => row.id);
  const appointmentIds = appointmentRows.map((row) => row.id);
  const encounterIds = encounterRows.map((row) => row.id);
  const claimIds = claimRows.map((row) => row.id);
  const workItemIds = workItemRows.map((row) => row.id);
  const payerIds = payerRows.map((row) => row.id);
  const planIds = planRows.map((row) => row.id);
  const coverageIds = coverageRows.map((row) => row.id);

  const deleted = await prisma.$transaction(async (transaction) => {
    const summary = {};

    summary.billingWorkItemActivities = await deleteManyIfIds(workItemIds, (ids) =>
      transaction.billingWorkItemActivity.deleteMany({
        where: {
          workItemId: {
            in: ids
          }
        }
      })
    );

    summary.billingNotes = await transaction.billingNote.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.billingWorkItems = await transaction.billingWorkItem.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.sessionNotes = await deleteManyIfIds(appointmentIds, (ids) =>
      transaction.sessionNote.deleteMany({
        where: {
          appointmentId: {
            in: ids
          }
        }
      })
    );

    summary.checkInReviews = await transaction.checkInReview.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.clinicalNotes = await transaction.clinicalNote.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.auditLogs = await transaction.auditLog.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.aiRuns = await transaction.aiRun.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.promptRegistry = await transaction.promptRegistry.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.remittances = await deleteManyIfIds(claimIds, (ids) =>
      transaction.remittance.deleteMany({
        where: {
          claimId: {
            in: ids
          }
        }
      })
    );

    summary.denials = await deleteManyIfIds(claimIds, (ids) =>
      transaction.denial.deleteMany({
        where: {
          claimId: {
            in: ids
          }
        }
      })
    );

    summary.claims = await deleteManyIfIds(encounterIds, (ids) =>
      transaction.claim.deleteMany({
        where: {
          encounterId: {
            in: ids
          }
        }
      })
    );

    summary.charges = await deleteManyIfIds(encounterIds, (ids) =>
      transaction.charge.deleteMany({
        where: {
          encounterId: {
            in: ids
          }
        }
      })
    );

    summary.encounters = await deleteManyIfIds(encounterIds, (ids) =>
      transaction.encounter.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      })
    );

    summary.authorizations = await deleteManyIfIds(coverageIds, (ids) =>
      transaction.authorization.deleteMany({
        where: {
          coverageId: {
            in: ids
          }
        }
      })
    );

    summary.coverages = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.coverage.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.feeSchedules = await deleteManyIfIds(planIds, (ids) =>
      transaction.feeSchedule.deleteMany({
        where: {
          planId: {
            in: ids
          }
        }
      })
    );

    summary.insurancePlans = await deleteManyIfIds(payerIds, (ids) =>
      transaction.insurancePlan.deleteMany({
        where: {
          payerId: {
            in: ids
          }
        }
      })
    );

    summary.payers = await transaction.payer.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.invoices = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.invoice.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.ledgerEntries = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.patientLedgerEntry.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.groupSessions = await deleteManyIfIds(organizationIds, (ids) =>
      transaction.groupSession.deleteMany({
        where: {
          organizationId: {
            in: ids
          }
        }
      })
    );

    summary.appointments = await deleteManyIfIds(appointmentIds, (ids) =>
      transaction.appointment.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      })
    );

    summary.treatmentPlans = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.treatmentPlan.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.recoveryPlans = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.recoveryPlan.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.consumerConditions = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.consumerCondition.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.medicationRecords = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.medicationRecord.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.journalEntries = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.journalEntry.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.goals = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.goal.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.routineCompletions = await deleteManyIfIds(routineIds, (ids) =>
      transaction.routineCompletion.deleteMany({
        where: {
          routineId: {
            in: ids
          }
        }
      })
    );

    summary.routines = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.routine.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.dailyCheckIns = await deleteManyIfIds(consumerIds, (ids) =>
      transaction.dailyCheckIn.deleteMany({
        where: {
          consumerId: {
            in: ids
          }
        }
      })
    );

    summary.memberships = await transaction.membership.deleteMany({
      where: {
        OR: [
          {
            organizationId: {
              in: organizationIds
            }
          },
          {
            userId: {
              in: tenantUserIds
            }
          }
        ]
      }
    }).then((result) => result.count);

    summary.nonAdminUsers = await transaction.user.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        },
        id: {
          not: preservedAdmin.id
        }
      }
    }).then((result) => result.count);

    summary.consumers = await transaction.consumer.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.organizations = await transaction.organization.deleteMany({
      where: {
        tenantId: {
          in: tenantIds
        }
      }
    }).then((result) => result.count);

    summary.deletedTenants = await deleteManyIfIds(tenantIdsToDelete, (ids) =>
      transaction.tenant.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      })
    );

    await transaction.user.update({
      where: { id: preservedAdmin.id },
      data: {
        consumerId: null,
        role: 'platform_admin',
        isActive: true,
        mustChangePassword: false
      }
    });

    return summary;
  });

  const [
    remainingTenants,
    remainingUsers,
    remainingMemberships,
    remainingOrganizations,
    remainingConsumers,
    remainingDailyCheckIns,
    remainingCheckInReviews,
    remainingAuditLogs,
    remainingClinicalNotes,
    remainingJournalEntries,
    remainingGoals,
    remainingRoutines,
    remainingRoutineCompletions,
    remainingRecoveryPlans,
    remainingConsumerConditions,
    remainingMedicationRecords,
    remainingAppointments,
    remainingBillingWorkItems,
    remainingBillingNotes,
    remainingBillingActivities,
    remainingInvoices,
    remainingLedgerEntries,
    remainingPromptRegistry,
    remainingAiRuns
  ] = await prisma.$transaction([
    prisma.tenant.count(),
    prisma.user.count({
      where: {}
    }),
    prisma.membership.count({
      where: {}
    }),
    prisma.organization.count({
      where: {}
    }),
    prisma.consumer.count({
      where: {}
    }),
    prisma.dailyCheckIn.count(),
    prisma.checkInReview.count(),
    prisma.auditLog.count(),
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
    prisma.aiRun.count()
  ]);

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        preservedTenant: {
          id: preservedTenant.id,
          slug: preservedTenant.slug,
          name: preservedTenant.name
        },
        preservedPlatformAdmin: {
          id: preservedAdmin.id,
          email: preservedAdmin.email
        },
        deleted,
        remaining: {
          tenants: remainingTenants,
          users: remainingUsers,
          memberships: remainingMemberships,
          organizations: remainingOrganizations,
          consumers: remainingConsumers,
          dailyCheckIns: remainingDailyCheckIns,
          checkInReviews: remainingCheckInReviews,
          auditLogs: remainingAuditLogs,
          clinicalNotes: remainingClinicalNotes,
          journalEntries: remainingJournalEntries,
          goals: remainingGoals,
          routines: remainingRoutines,
          routineCompletions: remainingRoutineCompletions,
          recoveryPlans: remainingRecoveryPlans,
          consumerConditions: remainingConsumerConditions,
          medicationRecords: remainingMedicationRecords,
          appointments: remainingAppointments,
          billingWorkItems: remainingBillingWorkItems,
          billingNotes: remainingBillingNotes,
          billingWorkItemActivities: remainingBillingActivities,
          invoices: remainingInvoices,
          ledgerEntries: remainingLedgerEntries,
          promptRegistry: remainingPromptRegistry,
          aiRuns: remainingAiRuns
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
