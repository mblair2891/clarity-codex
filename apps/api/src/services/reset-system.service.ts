import type { FastifyBaseLogger } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';

type RecordCountSummary = Record<string, number>;

type ResetSystemCounts = {
  tenants: number;
  users: number;
  memberships: number;
  organizations: number;
  consumers: number;
  dailyCheckIns: number;
  checkInReviews: number;
  clinicalNotes: number;
  journalEntries: number;
  goals: number;
  routines: number;
  routineCompletions: number;
  recoveryPlans: number;
  consumerConditions: number;
  treatmentPlans: number;
  medicationRecords: number;
  appointments: number;
  sessionNotes: number;
  groupSessions: number;
  coverages: number;
  authorizations: number;
  payers: number;
  insurancePlans: number;
  feeSchedules: number;
  encounters: number;
  charges: number;
  claims: number;
  remittances: number;
  denials: number;
  billingWorkItems: number;
  billingNotes: number;
  billingWorkItemActivities: number;
  invoices: number;
  ledgerEntries: number;
  promptRegistry: number;
  aiRuns: number;
  auditLogs: number;
};

export interface ResetSystemResult {
  reset: true;
  environment: string;
  preserved: {
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
    records: {
      tenants: number;
      users: number;
    };
  };
  deleted: RecordCountSummary;
  remaining: ResetSystemCounts;
}

function isResetSystemEnvironmentEnabled() {
  return env.APP_ENV === 'beta' || env.APP_ENV === 'local';
}

async function countRemainingRecords(): Promise<ResetSystemCounts> {
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
    treatmentPlans,
    medicationRecords,
    appointments,
    sessionNotes,
    groupSessions,
    coverages,
    authorizations,
    payers,
    insurancePlans,
    feeSchedules,
    encounters,
    charges,
    claims,
    remittances,
    denials,
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
    prisma.treatmentPlan.count(),
    prisma.medicationRecord.count(),
    prisma.appointment.count(),
    prisma.sessionNote.count(),
    prisma.groupSession.count(),
    prisma.coverage.count(),
    prisma.authorization.count(),
    prisma.payer.count(),
    prisma.insurancePlan.count(),
    prisma.feeSchedule.count(),
    prisma.encounter.count(),
    prisma.charge.count(),
    prisma.claim.count(),
    prisma.remittance.count(),
    prisma.denial.count(),
    prisma.billingWorkItem.count(),
    prisma.billingNote.count(),
    prisma.billingWorkItemActivity.count(),
    prisma.invoice.count(),
    prisma.patientLedgerEntry.count(),
    prisma.promptRegistry.count(),
    prisma.aiRun.count(),
    prisma.auditLog.count()
  ]);

  return {
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
    treatmentPlans,
    medicationRecords,
    appointments,
    sessionNotes,
    groupSessions,
    coverages,
    authorizations,
    payers,
    insurancePlans,
    feeSchedules,
    encounters,
    charges,
    claims,
    remittances,
    denials,
    billingWorkItems,
    billingNotes,
    billingWorkItemActivities,
    invoices,
    ledgerEntries,
    promptRegistry,
    aiRuns,
    auditLogs
  };
}

export class ResetSystemService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  static isEnabled() {
    return isResetSystemEnvironmentEnabled();
  }

  async resetSystem(actorUserId: string): Promise<ResetSystemResult> {
    if (!isResetSystemEnvironmentEnabled()) {
      const error = new Error('System reset is only enabled in the beta environment.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    const preservedUser = await prisma.user.findUnique({
      where: { id: actorUserId },
      include: {
        tenant: true
      }
    });

    if (!preservedUser || preservedUser.role !== 'platform_admin') {
      const error = new Error('Only an active platform admin can reset the beta system.') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true
      }
    });

    const tenantIds = allTenants.map((tenant) => tenant.id);
    const tenantIdsToDelete = tenantIds.filter((tenantId) => tenantId !== preservedUser.tenantId);

    this.logger.warn(
      {
        actorUserId: preservedUser.id,
        actorEmail: preservedUser.email,
        preservedTenantId: preservedUser.tenantId,
        deletedTenantCount: tenantIdsToDelete.length
      },
      'Starting beta reset-system operation.'
    );

    const deleted = await prisma.$transaction(async (transaction) => {
      const summary: RecordCountSummary = {};

      await transaction.user.update({
        where: { id: preservedUser.id },
        data: {
          consumerId: null,
          role: 'platform_admin',
          isActive: true,
          mustChangePassword: false
        }
      });

      summary.billingWorkItemActivities = (
        await transaction.billingWorkItemActivity.deleteMany({
          where: {
            workItem: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.billingNotes = (
        await transaction.billingNote.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.billingWorkItems = (
        await transaction.billingWorkItem.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.sessionNotes = (
        await transaction.sessionNote.deleteMany({
          where: {
            appointment: {
              organization: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.checkInReviews = (
        await transaction.checkInReview.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.clinicalNotes = (
        await transaction.clinicalNote.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.auditLogs = (
        await transaction.auditLog.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.aiRuns = (
        await transaction.aiRun.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.promptRegistry = (
        await transaction.promptRegistry.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.remittances = (
        await transaction.remittance.deleteMany({
          where: {
            claim: {
              encounter: {
                organization: {
                  tenantId: {
                    in: tenantIds
                  }
                }
              }
            }
          }
        })
      ).count;

      summary.denials = (
        await transaction.denial.deleteMany({
          where: {
            claim: {
              encounter: {
                organization: {
                  tenantId: {
                    in: tenantIds
                  }
                }
              }
            }
          }
        })
      ).count;

      summary.claims = (
        await transaction.claim.deleteMany({
          where: {
            encounter: {
              organization: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.charges = (
        await transaction.charge.deleteMany({
          where: {
            encounter: {
              organization: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.encounters = (
        await transaction.encounter.deleteMany({
          where: {
            organization: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.authorizations = (
        await transaction.authorization.deleteMany({
          where: {
            coverage: {
              consumer: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.coverages = (
        await transaction.coverage.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.feeSchedules = (
        await transaction.feeSchedule.deleteMany({
          where: {
            plan: {
              payer: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.insurancePlans = (
        await transaction.insurancePlan.deleteMany({
          where: {
            payer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.payers = (
        await transaction.payer.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.invoices = (
        await transaction.invoice.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.ledgerEntries = (
        await transaction.patientLedgerEntry.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.groupSessions = (
        await transaction.groupSession.deleteMany({
          where: {
            organization: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.appointments = (
        await transaction.appointment.deleteMany({
          where: {
            organization: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.treatmentPlans = (
        await transaction.treatmentPlan.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.recoveryPlans = (
        await transaction.recoveryPlan.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.consumerConditions = (
        await transaction.consumerCondition.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.medicationRecords = (
        await transaction.medicationRecord.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.journalEntries = (
        await transaction.journalEntry.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.goals = (
        await transaction.goal.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.routineCompletions = (
        await transaction.routineCompletion.deleteMany({
          where: {
            routine: {
              consumer: {
                tenantId: {
                  in: tenantIds
                }
              }
            }
          }
        })
      ).count;

      summary.routines = (
        await transaction.routine.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.dailyCheckIns = (
        await transaction.dailyCheckIn.deleteMany({
          where: {
            consumer: {
              tenantId: {
                in: tenantIds
              }
            }
          }
        })
      ).count;

      summary.memberships = (
        await transaction.membership.deleteMany({
          where: {
            OR: [
              {
                organization: {
                  tenantId: {
                    in: tenantIds
                  }
                }
              },
              {
                user: {
                  tenantId: {
                    in: tenantIds
                  }
                }
              }
            ]
          }
        })
      ).count;

      summary.users = (
        await transaction.user.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            },
            id: {
              not: preservedUser.id
            }
          }
        })
      ).count;

      summary.consumers = (
        await transaction.consumer.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.organizations = (
        await transaction.organization.deleteMany({
          where: {
            tenantId: {
              in: tenantIds
            }
          }
        })
      ).count;

      summary.deletedTenants = (
        await transaction.tenant.deleteMany({
          where: {
            id: {
              in: tenantIdsToDelete
            }
          }
        })
      ).count;

      await transaction.user.update({
        where: { id: preservedUser.id },
        data: {
          consumerId: null,
          role: 'platform_admin',
          isActive: true,
          mustChangePassword: false
        }
      });

      return summary;
    });

    await prisma.auditLog.create({
      data: {
        tenantId: preservedUser.tenantId,
        userId: preservedUser.id,
        action: 'admin.system.reset',
        entityType: 'system',
        entityId: preservedUser.tenantId,
        metadata: {
          preservedUserId: preservedUser.id,
          deleted
        }
      }
    });

    const remaining = await countRemainingRecords();

    this.logger.info(
      {
        actorUserId: preservedUser.id,
        preservedTenantId: preservedUser.tenantId,
        deleted,
        remaining
      },
      'Completed beta reset-system operation.'
    );

    return {
      reset: true,
      environment: env.APP_ENV,
      preserved: {
        tenant: {
          id: preservedUser.tenant.id,
          slug: preservedUser.tenant.slug,
          name: preservedUser.tenant.name
        },
        user: {
          id: preservedUser.id,
          email: preservedUser.email,
          fullName: preservedUser.fullName,
          role: 'platform_admin'
        },
        records: {
          tenants: 1,
          users: 1
        }
      },
      deleted,
      remaining
    };
  }
}
