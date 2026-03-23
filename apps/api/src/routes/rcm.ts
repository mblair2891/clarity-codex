import type { BillingWorkItemStatus, Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { rcmAccessRoles } from '../lib/roles.js';

const queueFilterValues = [
  'all',
  'attention',
  'recent',
  'draft',
  'ready_for_review',
  'submitted',
  'needs_correction',
  'paid',
  'denied',
  'follow_up_needed'
] as const;

const queueQuerySchema = z.object({
  q: z.string().optional(),
  filter: z.enum(queueFilterValues).optional().default('all')
});

const consumerParamsSchema = z.object({
  consumerId: z.string().min(1)
});

const workItemParamsSchema = z.object({
  workItemId: z.string().min(1)
});

const workItemSchema = z.object({
  consumerId: z.string().min(1),
  title: z.string().min(3).max(140),
  status: z.enum([
    'draft',
    'ready_for_review',
    'submitted',
    'needs_correction',
    'paid',
    'denied',
    'follow_up_needed'
  ]).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  issueSummary: z.string().max(2000).optional().nullable(),
  nextAction: z.string().max(500).optional().nullable(),
  amountCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
  payerName: z.string().max(160).optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  encounterId: z.string().optional().nullable(),
  claimId: z.string().optional().nullable(),
  coverageId: z.string().optional().nullable()
});

const workItemUpdateSchema = workItemSchema.omit({ consumerId: true, title: true }).extend({
  title: z.string().min(3).max(140).optional()
});

const noteSchema = z.object({
  body: z.string().min(5).max(4000),
  noteType: z.string().min(2).max(40).optional().default('billing_note')
});

type RcmAuth = NonNullable<FastifyRequest['auth']>;

type BillingConsumerRecord = Prisma.ConsumerGetPayload<{
  include: {
    organization: true;
    userAccount: true;
    appointments: true;
    checkIns: {
      include: {
        review: true;
      };
    };
    coverages: {
      include: {
        plan: {
          include: {
            payer: true;
          };
        };
        authorizations: true;
      };
    };
    encounters: {
      include: {
        charges: true;
        claims: {
          include: {
            denials: true;
            remittance: true;
          };
        };
      };
    };
    invoices: true;
    ledgerEntries: true;
    billingWorkItems: {
      include: {
        claim: {
          include: {
            denials: true;
            remittance: true;
          };
        };
        coverage: {
          include: {
            plan: {
              include: {
                payer: true;
              };
            };
          };
        };
        notes: {
          include: {
            author: true;
          };
        };
        activities: {
          include: {
            actor: true;
          };
        };
        createdBy: true;
        updatedBy: true;
      };
    };
    billingNotes: {
      include: {
        author: true;
        workItem: true;
      };
    };
  };
}>;

function startOfUtcDay(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function parseOptionalDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date value.');
  }

  return parsed;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getScopedOrganizationIds(auth: RcmAuth) {
  if (auth.role === 'platform_admin') {
    return undefined;
  }

  return auth.organizationIds;
}

function getScopedConsumerWhere(auth: RcmAuth): Prisma.ConsumerWhereInput {
  const organizationIds = getScopedOrganizationIds(auth);

  if (!organizationIds || organizationIds.length === 0) {
    return {
      tenantId: auth.tenantId
    };
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: organizationIds
    }
  };
}

function getScopedOrganizationWhere(auth: RcmAuth): Prisma.OrganizationWhereInput {
  const organizationIds = getScopedOrganizationIds(auth);

  if (!organizationIds || organizationIds.length === 0) {
    return {
      tenantId: auth.tenantId
    };
  }

  return {
    tenantId: auth.tenantId,
    id: {
      in: organizationIds
    }
  };
}

function getScopedWorkItemWhere(auth: RcmAuth): Prisma.BillingWorkItemWhereInput {
  const organizationIds = getScopedOrganizationIds(auth);

  if (!organizationIds || organizationIds.length === 0) {
    return {
      tenantId: auth.tenantId
    };
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: organizationIds
    }
  };
}

async function requireRcmContext(app: FastifyInstance, request: FastifyRequest) {
  await app.verifyTenantRole(request, rcmAccessRoles);

  const auth = request.auth;
  if (!auth) {
    const error = new Error('Authentication required.') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!user) {
    const error = new Error('Billing user was not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    auth,
    user
  };
}

async function loadScopedConsumer(auth: RcmAuth, consumerId: string) {
  return prisma.consumer.findFirst({
    where: {
      id: consumerId,
      ...getScopedConsumerWhere(auth)
    },
    include: {
      organization: true,
      userAccount: true,
      appointments: {
        orderBy: { startsAt: 'desc' },
        take: 6
      },
      checkIns: {
        orderBy: { checkInDate: 'desc' },
        take: 6,
        include: {
          review: true
        }
      },
      coverages: {
        include: {
          plan: {
            include: {
              payer: true
            }
          },
          authorizations: {
            orderBy: { endDate: 'desc' }
          }
        },
        orderBy: { id: 'asc' }
      },
      encounters: {
        include: {
          charges: true,
          claims: {
            include: {
              denials: true,
              remittance: true
            }
          }
        },
        orderBy: { id: 'desc' }
      },
      invoices: {
        orderBy: { dueDate: 'asc' }
      },
      ledgerEntries: {
        orderBy: { occurredAt: 'desc' },
        take: 12
      },
      billingWorkItems: {
        include: {
          claim: {
            include: {
              denials: true,
              remittance: true
            }
          },
          coverage: {
            include: {
              plan: {
                include: {
                  payer: true
                }
              }
            }
          },
          notes: {
            include: {
              author: true
            },
            orderBy: { createdAt: 'desc' }
          },
          activities: {
            include: {
              actor: true
            },
            orderBy: { createdAt: 'desc' }
          },
          createdBy: true,
          updatedBy: true
        },
        orderBy: { updatedAt: 'desc' }
      },
      billingNotes: {
        include: {
          author: true,
          workItem: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

function computeOutstandingBalance(consumer: BillingConsumerRecord) {
  const invoiceBalance = consumer.invoices.reduce((sum, invoice) => {
    if (invoice.status === 'paid') {
      return sum;
    }

    return sum + invoice.totalCents;
  }, 0);

  const ledgerBalance = consumer.ledgerEntries.reduce((sum, entry) => sum + entry.amountCents, 0);

  return Math.max(invoiceBalance, ledgerBalance);
}

function workItemNeedsAttention(status: BillingWorkItemStatus) {
  return status === 'denied' || status === 'follow_up_needed' || status === 'needs_correction';
}

function sortWorkItems(workItems: BillingConsumerRecord['billingWorkItems']) {
  return [...workItems].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

function buildAccountSummary(consumer: BillingConsumerRecord) {
  const workItems = sortWorkItems(consumer.billingWorkItems);
  const primaryWorkItem = workItems[0] ?? null;
  const activeCoverage = consumer.coverages.find((coverage) => coverage.isActive) ?? consumer.coverages[0] ?? null;
  const payerSummary = activeCoverage
    ? `${activeCoverage.plan.payer.name} • ${activeCoverage.plan.name}`
    : 'No active coverage on file';
  const latestAppointment = [...consumer.appointments].sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime())[0] ?? null;
  const latestCheckIn = consumer.checkIns[0] ?? null;
  const claimCounts = consumer.encounters.flatMap((encounter) => encounter.claims).reduce<Record<string, number>>((counts, claim) => {
    counts[claim.status] = (counts[claim.status] ?? 0) + 1;
    return counts;
  }, {});
  const openAuthorizations = consumer.coverages.flatMap((coverage) =>
    coverage.authorizations.filter((authorization) => authorization.endDate >= startOfUtcDay())
  );
  const documentationReady =
    consumer.encounters.some((encounter) => encounter.status.toLowerCase().includes('complete')) ||
    consumer.appointments.some((appointment) => appointment.status === 'completed');
  const claimReadiness =
    primaryWorkItem?.status === 'ready_for_review'
      ? 'ready_for_review'
      : documentationReady && activeCoverage
        ? 'ready_to_bill'
        : activeCoverage
          ? 'awaiting_documentation'
          : 'coverage_gap';

  return {
    consumerId: consumer.id,
    consumerName: `${consumer.firstName} ${consumer.lastName}`,
    displayName: consumer.preferredName || consumer.firstName,
    organizationName: consumer.organization?.name ?? 'Unassigned organization',
    linkedAccountEmail: consumer.userAccount?.email ?? null,
    payerSummary,
    activeCoverage: activeCoverage
      ? {
          id: activeCoverage.id,
          payerName: activeCoverage.plan.payer.name,
          planName: activeCoverage.plan.name,
          memberId: activeCoverage.memberId,
          groupNumber: activeCoverage.groupNumber,
          authorizationCount: openAuthorizations.length
        }
      : null,
    lastAppointment: latestAppointment
      ? {
          id: latestAppointment.id,
          type: latestAppointment.type,
          status: latestAppointment.status,
          startsAt: latestAppointment.startsAt
        }
      : null,
    lastCheckIn: latestCheckIn
      ? {
          id: latestCheckIn.id,
          checkInDate: latestCheckIn.checkInDate,
          mood: latestCheckIn.mood,
          cravings: latestCheckIn.cravings,
          wantsStaffFollowUp: latestCheckIn.wantsStaffFollowUp
        }
      : null,
    outstandingBalanceCents: computeOutstandingBalance(consumer),
    documentationReady,
    claimReadiness,
    claimCounts,
    workItemCounts: workItems.reduce<Record<string, number>>((counts, workItem) => {
      counts[workItem.status] = (counts[workItem.status] ?? 0) + 1;
      return counts;
    }, {}),
    primaryWorkItem: primaryWorkItem
      ? {
          id: primaryWorkItem.id,
          title: primaryWorkItem.title,
          status: primaryWorkItem.status,
          priority: primaryWorkItem.priority,
          nextAction: primaryWorkItem.nextAction,
          issueSummary: primaryWorkItem.issueSummary,
          updatedAt: primaryWorkItem.updatedAt
        }
      : null,
    nextBillingAction:
      primaryWorkItem?.nextAction ??
      (claimReadiness === 'ready_to_bill'
        ? 'Review the most recent completed visit and prepare the next claim.'
        : claimReadiness === 'coverage_gap'
          ? 'Resolve missing or inactive coverage before submission.'
          : 'Complete documentation and confirm coding before billing review.')
  };
}

function buildRecentActivityItem(activity: {
  id: string;
  action: string;
  detail: string | null;
  createdAt: Date;
  actorName: string | null;
  consumerName: string;
  workItemTitle: string;
}) {
  return {
    id: activity.id,
    type: 'work_item_activity',
    title: activity.action,
    detail: activity.detail ?? `${activity.workItemTitle} updated for ${activity.consumerName}.`,
    at: activity.createdAt,
    actorName: activity.actorName,
    consumerName: activity.consumerName
  };
}

function buildDashboardPayload(args: {
  user: Awaited<ReturnType<typeof requireRcmContext>>['user'];
  consumers: BillingConsumerRecord[];
  workItems: Prisma.BillingWorkItemGetPayload<{
    include: {
      consumer: true;
      organization: true;
      notes: {
        include: {
          author: true;
        };
      };
      activities: {
        include: {
          actor: true;
        };
      };
      coverage: {
        include: {
          plan: {
            include: {
              payer: true;
            };
          };
        };
      };
      claim: {
        include: {
          denials: true;
          remittance: true;
        };
      };
    };
  }>[];
}) {
  const accountSummaries = args.consumers.map(buildAccountSummary);
  const statusCounts = args.workItems.reduce<Record<string, number>>((counts, workItem) => {
    counts[workItem.status] = (counts[workItem.status] ?? 0) + 1;
    return counts;
  }, {});
  const openItems = args.workItems.filter((item) => item.status !== 'paid').length;
  const deniedItems = args.workItems.filter((item) => item.status === 'denied').length;
  const followUpItems = args.workItems.filter((item) => item.status === 'follow_up_needed').length;
  const unresolvedItems = args.workItems.filter((item) => workItemNeedsAttention(item.status)).length;
  const payerDistribution = args.workItems.reduce<Record<string, number>>((counts, workItem) => {
    const payerName = workItem.payerName || workItem.coverage?.plan.payer.name || 'Unassigned payer';
    counts[payerName] = (counts[payerName] ?? 0) + 1;
    return counts;
  }, {});

  const recentActivity = [
    ...args.workItems.flatMap((workItem) =>
      workItem.activities.slice(0, 2).map((activity) =>
        buildRecentActivityItem({
          id: activity.id,
          action: activity.action,
          detail: activity.detail,
          createdAt: activity.createdAt,
          actorName: activity.actor?.fullName ?? null,
          consumerName: `${workItem.consumer.firstName} ${workItem.consumer.lastName}`,
          workItemTitle: workItem.title
        })
      )
    ),
    ...args.workItems.flatMap((workItem) =>
      workItem.notes.slice(0, 1).map((note) => ({
        id: note.id,
        type: 'billing_note',
        title: `${note.author.fullName} added a billing note`,
        detail: `${workItem.title} • ${note.body.slice(0, 160)}`,
        at: note.createdAt,
        actorName: note.author.fullName,
        consumerName: `${workItem.consumer.firstName} ${workItem.consumer.lastName}`
      }))
    )
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, 12);

  return {
    billingUser: {
      id: args.user.id,
      fullName: args.user.fullName,
      email: args.user.email,
      role: args.user.role,
      mustChangePassword: args.user.mustChangePassword
    },
    scopeModel: args.user.role === 'platform_admin' ? 'platform_wide' : 'organization_membership',
    organizations: args.user.memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role
    })),
    metrics: {
      accountsInScope: accountSummaries.length,
      openWorkItems: openItems,
      deniedWorkItems: deniedItems,
      followUpWorkItems: followUpItems,
      unresolvedItems,
      outstandingBalanceCents: accountSummaries.reduce((sum, account) => sum + account.outstandingBalanceCents, 0)
    },
    statusCounts,
    payerDistribution: Object.entries(payerDistribution)
      .map(([payerName, count]) => ({ payerName, count }))
      .sort((left, right) => right.count - left.count),
    quickActions: [
      { id: 'review-denials', label: 'Review denials', description: 'Jump into denied or follow-up-needed work items.' },
      { id: 'review-ready', label: 'Review ready items', description: 'Find items that are ready for billing review.' },
      { id: 'open-queue', label: 'Open work queue', description: 'Browse the full consumer financial roster.' }
    ],
    queuePreview: accountSummaries
      .filter((account) => account.primaryWorkItem || account.claimReadiness !== 'coverage_gap')
      .sort((left, right) => {
        const leftAttention = left.primaryWorkItem && workItemNeedsAttention(left.primaryWorkItem.status) ? 1 : 0;
        const rightAttention = right.primaryWorkItem && workItemNeedsAttention(right.primaryWorkItem.status) ? 1 : 0;
        if (leftAttention !== rightAttention) {
          return rightAttention - leftAttention;
        }

        return (right.primaryWorkItem?.updatedAt?.getTime() ?? 0) - (left.primaryWorkItem?.updatedAt?.getTime() ?? 0);
      })
      .slice(0, 8),
    itemsNeedingAttention: accountSummaries.filter(
      (account) => account.primaryWorkItem && workItemNeedsAttention(account.primaryWorkItem.status)
    ),
    recentActivity
  };
}

function filterAccountSummaries(args: {
  items: ReturnType<typeof buildAccountSummary>[];
  query: string;
  filter: (typeof queueFilterValues)[number];
}) {
  const normalizedQuery = args.query.trim().toLowerCase();

  return args.items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.consumerName.toLowerCase().includes(normalizedQuery) ||
      item.displayName.toLowerCase().includes(normalizedQuery) ||
      item.payerSummary.toLowerCase().includes(normalizedQuery) ||
      (item.activeCoverage?.memberId ?? '').toLowerCase().includes(normalizedQuery) ||
      (item.primaryWorkItem?.title ?? '').toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    if (args.filter === 'all') {
      return true;
    }

    if (args.filter === 'attention') {
      return item.primaryWorkItem ? workItemNeedsAttention(item.primaryWorkItem.status) : false;
    }

    if (args.filter === 'recent') {
      return item.primaryWorkItem !== null;
    }

    return item.primaryWorkItem?.status === args.filter;
  });
}

function serializeWorkItem(workItem: BillingConsumerRecord['billingWorkItems'][number]) {
  return {
    id: workItem.id,
    title: workItem.title,
    status: workItem.status,
    priority: workItem.priority,
    encounterId: workItem.encounterId,
    payerName: workItem.payerName || workItem.coverage?.plan.payer.name || null,
    issueSummary: workItem.issueSummary,
    nextAction: workItem.nextAction,
    amountCents: workItem.amountCents,
    serviceDate: workItem.serviceDate?.toISOString() ?? null,
    submittedAt: workItem.submittedAt?.toISOString() ?? null,
    createdAt: workItem.createdAt.toISOString(),
    updatedAt: workItem.updatedAt.toISOString(),
    coverage: workItem.coverage
      ? {
          id: workItem.coverage.id,
          payerName: workItem.coverage.plan.payer.name,
          planName: workItem.coverage.plan.name,
          memberId: workItem.coverage.memberId
        }
      : null,
    claim: workItem.claim
      ? {
          id: workItem.claim.id,
          status: workItem.claim.status,
          billedCents: workItem.claim.billedCents,
          paidCents: workItem.claim.paidCents,
          denialReason: workItem.claim.denialReason,
          denialCount: workItem.claim.denials.length,
          remittanceAmountCents: workItem.claim.remittance?.amountCents ?? null
        }
      : null,
    createdBy: {
      id: workItem.createdBy.id,
      fullName: workItem.createdBy.fullName
    },
    updatedBy: workItem.updatedBy
      ? {
          id: workItem.updatedBy.id,
          fullName: workItem.updatedBy.fullName
        }
      : null,
    notes: workItem.notes.map((note) => ({
      id: note.id,
      body: note.body,
      noteType: note.noteType,
      createdAt: note.createdAt.toISOString(),
      author: {
        id: note.author.id,
        fullName: note.author.fullName
      }
    })),
    activity: workItem.activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      fromStatus: activity.fromStatus,
      toStatus: activity.toStatus,
      detail: activity.detail,
      createdAt: activity.createdAt.toISOString(),
      actor: activity.actor
        ? {
            id: activity.actor.id,
            fullName: activity.actor.fullName
          }
        : null
    }))
  };
}

export async function rcmRoutes(app: FastifyInstance) {
  app.get('/v1/rcm/dashboard', async (request) => {
    const { auth, user } = await requireRcmContext(app, request);

    const [consumers, workItems] = await prisma.$transaction([
      prisma.consumer.findMany({
        where: getScopedConsumerWhere(auth),
        include: {
          organization: true,
          userAccount: true,
          appointments: true,
          checkIns: {
            include: {
              review: true
            },
            orderBy: { checkInDate: 'desc' },
            take: 4
          },
          coverages: {
            include: {
              plan: {
                include: {
                  payer: true
                }
              },
              authorizations: true
            }
          },
          encounters: {
            include: {
              charges: true,
              claims: {
                include: {
                  denials: true,
                  remittance: true
                }
              }
            }
          },
          invoices: true,
          ledgerEntries: true,
          billingWorkItems: {
            include: {
              claim: {
                include: {
                  denials: true,
                  remittance: true
                }
              },
              coverage: {
                include: {
                  plan: {
                    include: {
                      payer: true
                    }
                  }
                }
              },
              notes: {
                include: {
                  author: true
                },
                orderBy: { createdAt: 'desc' }
              },
              activities: {
                include: {
                  actor: true
                },
                orderBy: { createdAt: 'desc' }
              },
              createdBy: true,
              updatedBy: true
            }
          },
          billingNotes: {
            include: {
              author: true,
              workItem: true
            }
          }
        }
      }),
      prisma.billingWorkItem.findMany({
        where: getScopedWorkItemWhere(auth),
        include: {
          consumer: true,
          organization: true,
          notes: {
            include: {
              author: true
            },
            orderBy: { createdAt: 'desc' }
          },
          activities: {
            include: {
              actor: true
            },
            orderBy: { createdAt: 'desc' }
          },
          coverage: {
            include: {
              plan: {
                include: {
                  payer: true
                }
              }
            }
          },
          claim: {
            include: {
              denials: true,
              remittance: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
    ]);

    return buildDashboardPayload({
      user,
      consumers,
      workItems
    });
  });

  app.get('/v1/rcm/queue', async (request) => {
    const { auth } = await requireRcmContext(app, request);
    const query = queueQuerySchema.parse(request.query);

    const consumers = await prisma.consumer.findMany({
      where: getScopedConsumerWhere(auth),
      include: {
        organization: true,
        userAccount: true,
        appointments: true,
        checkIns: {
          include: {
            review: true
          },
          orderBy: { checkInDate: 'desc' },
          take: 4
        },
        coverages: {
          include: {
            plan: {
              include: {
                payer: true
              }
            },
            authorizations: true
          }
        },
        encounters: {
          include: {
            charges: true,
            claims: {
              include: {
                denials: true,
                remittance: true
              }
            }
          }
        },
        invoices: true,
        ledgerEntries: true,
        billingWorkItems: {
          include: {
            claim: {
              include: {
                denials: true,
                remittance: true
              }
            },
            coverage: {
              include: {
                plan: {
                  include: {
                    payer: true
                  }
                }
              }
            },
            notes: {
              include: {
                author: true
              },
              orderBy: { createdAt: 'desc' }
            },
            activities: {
              include: {
                actor: true
              },
              orderBy: { createdAt: 'desc' }
            },
            createdBy: true,
            updatedBy: true
          }
        },
        billingNotes: {
          include: {
            author: true,
            workItem: true
          }
        }
      }
    });

    const items = filterAccountSummaries({
      items: consumers.map(buildAccountSummary),
      query: query.q ?? '',
      filter: query.filter
    });

    return {
      filter: query.filter,
      query: query.q ?? '',
      items
    };
  });

  app.get('/v1/rcm/accounts/:consumerId', async (request, reply) => {
    const { auth } = await requireRcmContext(app, request);
    const params = consumerParamsSchema.parse(request.params);
    const consumer = await loadScopedConsumer(auth, params.consumerId);

    if (!consumer) {
      return reply.code(404).send({ message: 'Billing account was not found in your scope.' });
    }

    return {
      consumer: {
        id: consumer.id,
        firstName: consumer.firstName,
        lastName: consumer.lastName,
        preferredName: consumer.preferredName,
        fullName: `${consumer.firstName} ${consumer.lastName}`,
        organization: consumer.organization
          ? {
              id: consumer.organization.id,
              name: consumer.organization.name,
              npi: consumer.organization.npi,
              taxId: consumer.organization.taxId
            }
          : null,
        linkedAccount: consumer.userAccount
          ? {
              id: consumer.userAccount.id,
              email: consumer.userAccount.email,
              fullName: consumer.userAccount.fullName,
              isActive: consumer.userAccount.isActive
            }
          : null,
        recoveryFocus: consumer.recoveryFocus,
        checkInPreference: consumer.checkInPreference
      },
      summary: buildAccountSummary(consumer),
      coverage: consumer.coverages.map((coverage) => ({
        id: coverage.id,
        isActive: coverage.isActive,
        payerName: coverage.plan.payer.name,
        planName: coverage.plan.name,
        memberId: coverage.memberId,
        groupNumber: coverage.groupNumber,
        authorizations: coverage.authorizations.map((authorization) => ({
          id: authorization.id,
          serviceType: authorization.serviceType,
          authorizedUnits: authorization.authorizedUnits,
          startDate: authorization.startDate.toISOString(),
          endDate: authorization.endDate.toISOString()
        }))
      })),
      recentAppointments: consumer.appointments.map((appointment) => ({
        id: appointment.id,
        type: appointment.type,
        status: appointment.status,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString()
      })),
      recentCheckIns: consumer.checkIns.map((checkIn) => ({
        id: checkIn.id,
        checkInDate: checkIn.checkInDate.toISOString(),
        mood: checkIn.mood,
        cravings: checkIn.cravings,
        wantsStaffFollowUp: checkIn.wantsStaffFollowUp,
        reviewStatus: checkIn.review?.status ?? null
      })),
      encounters: consumer.encounters.map((encounter) => ({
        id: encounter.id,
        serviceCode: encounter.serviceCode,
        status: encounter.status,
        charges: encounter.charges.map((charge) => ({
          id: charge.id,
          cptCode: charge.cptCode,
          amountCents: charge.amountCents
        })),
        claims: encounter.claims.map((claim) => ({
          id: claim.id,
          status: claim.status,
          billedCents: claim.billedCents,
          paidCents: claim.paidCents,
          denialReason: claim.denialReason,
          denials: claim.denials.map((denial) => ({
            id: denial.id,
            code: denial.code,
            reason: denial.reason,
            resolved: denial.resolved
          })),
          remittance: claim.remittance
            ? {
                id: claim.remittance.id,
                amountCents: claim.remittance.amountCents,
                receivedAt: claim.remittance.receivedAt.toISOString()
              }
            : null
        }))
      })),
      invoices: consumer.invoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        totalCents: invoice.totalCents,
        dueDate: invoice.dueDate?.toISOString() ?? null
      })),
      ledgerEntries: consumer.ledgerEntries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amountCents: entry.amountCents,
        occurredAt: entry.occurredAt.toISOString()
      })),
      workItems: consumer.billingWorkItems.map(serializeWorkItem),
      billingNotes: consumer.billingNotes.map((note) => ({
        id: note.id,
        body: note.body,
        noteType: note.noteType,
        createdAt: note.createdAt.toISOString(),
        author: {
          id: note.author.id,
          fullName: note.author.fullName
        },
        workItem: note.workItem
          ? {
              id: note.workItem.id,
              title: note.workItem.title,
              status: note.workItem.status
            }
          : null
      })),
      createOptions: {
        coverage: consumer.coverages.map((coverage) => ({
          id: coverage.id,
          label: `${coverage.plan.payer.name} • ${coverage.plan.name} • ${coverage.memberId}`
        })),
        encounters: consumer.encounters.map((encounter) => ({
          id: encounter.id,
          label: `${encounter.serviceCode} • ${encounter.status}`
        })),
        claims: consumer.encounters.flatMap((encounter) =>
          encounter.claims.map((claim) => ({
            id: claim.id,
            label: `${claim.status} • ${claim.billedCents} cents`
          }))
        )
      }
    };
  });

  app.post('/v1/rcm/work-items', async (request, reply) => {
    const { auth, user } = await requireRcmContext(app, request);
    const payload = workItemSchema.parse(request.body);
    const consumer = await loadScopedConsumer(auth, payload.consumerId);

    if (!consumer || !consumer.organizationId) {
      return reply.code(404).send({ message: 'Consumer billing account was not found in your scope.' });
    }

    const coverage = payload.coverageId
      ? consumer.coverages.find((item) => item.id === payload.coverageId) ?? null
      : null;
    const encounter = payload.encounterId
      ? consumer.encounters.find((item) => item.id === payload.encounterId) ?? null
      : null;
    const claim = payload.claimId
      ? consumer.encounters.flatMap((item) => item.claims).find((item) => item.id === payload.claimId) ?? null
      : null;

    if (payload.coverageId && !coverage) {
      return reply.code(400).send({ message: 'Selected coverage is not linked to this consumer.' });
    }

    if (payload.encounterId && !encounter) {
      return reply.code(400).send({ message: 'Selected encounter is not linked to this consumer.' });
    }

    if (payload.claimId && !claim) {
      return reply.code(400).send({ message: 'Selected claim is not linked to this consumer.' });
    }

    const serviceDate = parseOptionalDate(payload.serviceDate);
    const created = await prisma.$transaction(async (transaction) => {
      const workItem = await transaction.billingWorkItem.create({
        data: {
          tenantId: auth.tenantId,
          organizationId: consumer.organizationId!,
          consumerId: consumer.id,
          coverageId: coverage?.id,
          encounterId: encounter?.id,
          claimId: claim?.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          title: payload.title.trim(),
          status: payload.status ?? 'draft',
          priority: payload.priority,
          payerName: normalizeOptionalString(payload.payerName) ?? coverage?.plan.payer.name ?? null,
          issueSummary: normalizeOptionalString(payload.issueSummary),
          nextAction: normalizeOptionalString(payload.nextAction),
          amountCents: payload.amountCents ?? claim?.billedCents ?? null,
          serviceDate,
          submittedAt: payload.status === 'submitted' ? new Date() : null
        }
      });

      await transaction.billingWorkItemActivity.create({
        data: {
          workItemId: workItem.id,
          actorUserId: user.id,
          action: 'created',
          toStatus: workItem.status,
          detail: `Work item created for ${consumer.firstName} ${consumer.lastName}.`
        }
      });

      return workItem.id;
    });

    return reply.code(201).send({
      created: true,
      workItemId: created
    });
  });

  app.patch('/v1/rcm/work-items/:workItemId', async (request, reply) => {
    const { auth, user } = await requireRcmContext(app, request);
    const params = workItemParamsSchema.parse(request.params);
    const payload = workItemUpdateSchema.parse(request.body);
    const existing = await prisma.billingWorkItem.findFirst({
      where: {
        id: params.workItemId,
        ...getScopedWorkItemWhere(auth)
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: 'Billing work item was not found in your scope.' });
    }

    const consumer = await loadScopedConsumer(auth, existing.consumerId);
    if (!consumer) {
      return reply.code(404).send({ message: 'Linked consumer account was not found.' });
    }

    const coverageId = payload.coverageId === undefined ? existing.coverageId : payload.coverageId;
    const encounterId = payload.encounterId === undefined ? existing.encounterId : payload.encounterId;
    const claimId = payload.claimId === undefined ? existing.claimId : payload.claimId;

    const coverage = coverageId ? consumer.coverages.find((item) => item.id === coverageId) ?? null : null;
    const encounter = encounterId ? consumer.encounters.find((item) => item.id === encounterId) ?? null : null;
    const claim = claimId ? consumer.encounters.flatMap((item) => item.claims).find((item) => item.id === claimId) ?? null : null;

    if (coverageId && !coverage) {
      return reply.code(400).send({ message: 'Selected coverage is not linked to this consumer.' });
    }

    if (encounterId && !encounter) {
      return reply.code(400).send({ message: 'Selected encounter is not linked to this consumer.' });
    }

    if (claimId && !claim) {
      return reply.code(400).send({ message: 'Selected claim is not linked to this consumer.' });
    }

    const status = payload.status ?? existing.status;
    const serviceDate = payload.serviceDate === undefined ? existing.serviceDate : parseOptionalDate(payload.serviceDate);

    await prisma.$transaction(async (transaction) => {
      await transaction.billingWorkItem.update({
        where: { id: existing.id },
        data: {
          title: payload.title?.trim() ?? existing.title,
          status,
          priority: payload.priority ?? existing.priority,
          payerName: payload.payerName === undefined ? existing.payerName : normalizeOptionalString(payload.payerName),
          issueSummary: payload.issueSummary === undefined ? existing.issueSummary : normalizeOptionalString(payload.issueSummary),
          nextAction: payload.nextAction === undefined ? existing.nextAction : normalizeOptionalString(payload.nextAction),
          amountCents: payload.amountCents === undefined ? existing.amountCents : payload.amountCents,
          serviceDate,
          submittedAt:
            status === 'submitted'
              ? existing.submittedAt ?? new Date()
              : status === existing.status
                ? existing.submittedAt
                : existing.submittedAt,
          coverageId,
          encounterId,
          claimId,
          updatedByUserId: user.id
        }
      });

      await transaction.billingWorkItemActivity.create({
        data: {
          workItemId: existing.id,
          actorUserId: user.id,
          action: status !== existing.status ? 'status_changed' : 'updated',
          fromStatus: existing.status,
          toStatus: status,
          detail:
            status !== existing.status
              ? `Status changed from ${existing.status} to ${status}.`
              : 'Billing work item details updated.'
        }
      });
    });

    return reply.send({ updated: true, workItemId: existing.id });
  });

  app.post('/v1/rcm/work-items/:workItemId/notes', async (request, reply) => {
    const { auth, user } = await requireRcmContext(app, request);
    const params = workItemParamsSchema.parse(request.params);
    const payload = noteSchema.parse(request.body);
    const workItem = await prisma.billingWorkItem.findFirst({
      where: {
        id: params.workItemId,
        ...getScopedWorkItemWhere(auth)
      }
    });

    if (!workItem) {
      return reply.code(404).send({ message: 'Billing work item was not found in your scope.' });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.billingNote.create({
        data: {
          tenantId: workItem.tenantId,
          organizationId: workItem.organizationId,
          consumerId: workItem.consumerId,
          workItemId: workItem.id,
          authorUserId: user.id,
          noteType: payload.noteType,
          body: payload.body.trim()
        }
      });

      await transaction.billingWorkItemActivity.create({
        data: {
          workItemId: workItem.id,
          actorUserId: user.id,
          action: 'note_added',
          toStatus: workItem.status,
          detail: `Billing note added to ${workItem.title}.`
        }
      });
    });

    return reply.code(201).send({ created: true });
  });

  app.post('/v1/rcm/accounts/:consumerId/notes', async (request, reply) => {
    const { auth, user } = await requireRcmContext(app, request);
    const params = consumerParamsSchema.parse(request.params);
    const payload = noteSchema.parse(request.body);
    const consumer = await loadScopedConsumer(auth, params.consumerId);

    if (!consumer || !consumer.organizationId) {
      return reply.code(404).send({ message: 'Billing account was not found in your scope.' });
    }

    await prisma.billingNote.create({
      data: {
        tenantId: auth.tenantId,
        organizationId: consumer.organizationId,
        consumerId: consumer.id,
        authorUserId: user.id,
        noteType: payload.noteType,
        body: payload.body.trim()
      }
    });

    return reply.code(201).send({ created: true });
  });
}
