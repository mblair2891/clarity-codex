import type { ConditionStatus, Prisma, Role } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { clinicalAccessRoles } from '../lib/roles.js';
import { RiskService } from '../services/risk.service.js';

const rosterQuerySchema = z.object({
  q: z.string().optional(),
  filter: z.enum(['all', 'attention', 'follow_up', 'high_risk', 'recent']).optional().default('all')
});

const checkInQuerySchema = z.object({
  filter: z.enum(['recent', 'needs_follow_up', 'high_craving', 'low_mood', 'unreviewed']).optional().default('recent')
});

const noteSchema = z.object({
  title: z.string().max(120).optional(),
  body: z.string().min(5).max(5000),
  noteType: z.string().min(2).max(40).optional().default('progress'),
  flaggedForFollowUp: z.boolean().optional().default(false)
});

const reviewSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'needs_follow_up']).optional(),
  followUpStatus: z.enum(['not_needed', 'needed', 'planned', 'completed']).optional(),
  reviewNote: z.string().max(2000).nullable().optional(),
  riskFlagged: z.boolean().optional(),
  outreachCompleted: z.boolean().optional()
});

const planUpdateSchema = z.object({
  preferredName: z.string().max(80).nullable().optional(),
  recoveryFocus: z.string().max(200).nullable().optional(),
  checkInPreference: z.string().max(120).nullable().optional(),
  recoveryPlanSummary: z.string().max(3000).nullable().optional()
});

type ClinicalAuth = NonNullable<FastifyRequest['auth']>;

function readJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseSearch(value?: string) {
  return value?.trim().toLowerCase() ?? '';
}

function getConsumerScope(auth: ClinicalAuth): Prisma.ConsumerWhereInput {
  if (auth.role === 'platform_admin' && auth.organizationIds.length === 0) {
    return {
      tenantId: auth.tenantId
    };
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: auth.organizationIds
    }
  };
}

function getCheckInScope(auth: ClinicalAuth): Prisma.DailyCheckInWhereInput {
  const consumerScope = getConsumerScope(auth);

  return {
    consumer: consumerScope
  };
}

async function requireClinicalContext(app: FastifyInstance, request: FastifyRequest) {
  await app.verifyTenantRole(request, clinicalAccessRoles);

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
    const error = new Error('Clinical user was not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    auth,
    user
  };
}

async function loadAuthorizedConsumer(auth: ClinicalAuth, consumerId: string) {
  return prisma.consumer.findFirst({
    where: {
      id: consumerId,
      ...getConsumerScope(auth)
    },
    include: {
      organization: true
    }
  });
}

function summarizeConditionBurden(conditions: Array<{ status: ConditionStatus; symptomScore: number | null; name: string }>) {
  return conditions
    .filter((condition) => condition.status === 'active' && (condition.symptomScore ?? 0) >= 5)
    .map((condition) => `${condition.name} symptoms elevated`);
}

function calculateConsumerRisk(args: {
  latestCheckIn: {
    cravings: number;
    mood: number;
    stressLevel: number | null;
  } | null;
  checkInCount7d: number;
  routineCompletionCount7d: number;
  supportContacts: number;
  conditionFlags: number;
}) {
  const riskService = new RiskService();

  const score = riskService.assess({
    cravingsLevel: args.latestCheckIn?.cravings ?? 0,
    relapseCount30d: 0,
    ptsdFlashbackIntensity: Math.min(10, args.conditionFlags * 2),
    depressionSeverity: args.latestCheckIn ? Math.max(0, 10 - args.latestCheckIn.mood) : 4,
    engagementScore: Math.min(10, args.checkInCount7d * 2 + args.routineCompletionCount7d),
    protectiveContacts: args.supportContacts
  });

  return score;
}

function buildAttentionReason(args: {
  wantsStaffFollowUp: boolean;
  cravings: number;
  mood: number;
  status: string;
  followUpStatus: string;
}) {
  if (args.wantsStaffFollowUp) {
    return 'Requested staff follow-up';
  }

  if (args.followUpStatus === 'needed' || args.followUpStatus === 'planned') {
    return 'Follow-up workflow still open';
  }

  if (args.status === 'pending') {
    return 'Recent check-in still needs review';
  }

  if (args.cravings >= 7) {
    return 'High cravings reported';
  }

  if (args.mood <= 4) {
    return 'Low mood trend needs review';
  }

  return 'Care-team review recommended';
}

function buildTaskLabel(appointment: { type: string; startsAt: Date }) {
  return `${appointment.type} at ${appointment.startsAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}

export async function clinicalRoutes(app: FastifyInstance) {
  app.get('/v1/clinical/dashboard', async (request) => {
    const { auth, user } = await requireClinicalContext(app, request);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const consumers = await prisma.consumer.findMany({
      where: getConsumerScope(auth),
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ],
      include: {
        organization: true,
        recoveryPlan: true,
        goals: {
          orderBy: [
            { targetDate: 'asc' },
            { id: 'asc' }
          ]
        },
        routines: {
          include: {
            completions: {
              where: {
                completionDate: {
                  gte: sevenDaysAgo
                }
              }
            }
          }
        },
        appointments: {
          where: {
            startsAt: {
              gte: todayStart
            }
          },
          orderBy: { startsAt: 'asc' },
          take: 3
        },
        conditions: true,
        medications: {
          take: 3,
          orderBy: { id: 'asc' }
        },
        checkIns: {
          where: {
            checkInDate: {
              gte: sevenDaysAgo
            }
          },
          orderBy: { checkInDate: 'desc' },
          include: {
            review: true
          },
          take: 7
        },
        journals: {
          where: {
            sharedWithCareTeam: true
          },
          orderBy: { createdAt: 'desc' },
          take: 2
        },
        clinicalNotes: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          include: {
            author: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      }
    });

    const consumerSummaries = consumers.map((consumer) => {
      const latestCheckIn = consumer.checkIns[0] ?? null;
      const review = latestCheckIn?.review ?? null;
      const supportContacts = readJsonArray<{ name: string }>(consumer.recoveryPlan?.supportContacts).length;
      const routineCompletionCount7d = consumer.routines.reduce(
        (total, routine) => total + routine.completions.length,
        0
      );
      const risk = calculateConsumerRisk({
        latestCheckIn: latestCheckIn
          ? {
              cravings: latestCheckIn.cravings,
              mood: latestCheckIn.mood,
              stressLevel: latestCheckIn.stressLevel
            }
          : null,
        checkInCount7d: consumer.checkIns.length,
        routineCompletionCount7d,
        supportContacts,
        conditionFlags: consumer.conditions.filter((condition) => (condition.symptomScore ?? 0) >= 5).length
      });
      const needsAttention = Boolean(
        latestCheckIn
        && (
          latestCheckIn.wantsStaffFollowUp
          || latestCheckIn.cravings >= 7
          || latestCheckIn.mood <= 4
          || !review
          || review.status === 'pending'
          || review.followUpStatus === 'needed'
          || review.followUpStatus === 'planned'
        )
      );

      return {
        id: consumer.id,
        name: `${consumer.firstName} ${consumer.lastName}`,
        displayName: consumer.preferredName ?? consumer.firstName,
        organization: consumer.organization
          ? {
              id: consumer.organization.id,
              name: consumer.organization.name
            }
          : null,
        latestCheckIn: latestCheckIn
          ? {
              id: latestCheckIn.id,
              checkInDate: latestCheckIn.checkInDate,
              mood: latestCheckIn.mood,
              cravings: latestCheckIn.cravings,
              wantsStaffFollowUp: latestCheckIn.wantsStaffFollowUp,
              reviewStatus: review?.status ?? 'pending',
              followUpStatus: review?.followUpStatus ?? (latestCheckIn.wantsStaffFollowUp ? 'needed' : 'not_needed')
            }
          : null,
        nextAppointment: consumer.appointments[0]
          ? {
              id: consumer.appointments[0].id,
              type: consumer.appointments[0].type,
              startsAt: consumer.appointments[0].startsAt,
              status: consumer.appointments[0].status
            }
          : null,
        openGoals: consumer.goals.filter((goal) => goal.status !== 'completed').length,
        sharedJournalCount: consumer.journals.length,
        noteCount: consumer.clinicalNotes.length,
        activeConditionFlags: summarizeConditionBurden(consumer.conditions),
        risk,
        needsAttention
      };
    });

    const consumersNeedingAttention = consumerSummaries
      .filter((consumer) => consumer.needsAttention)
      .sort((left, right) => right.risk.score - left.risk.score)
      .slice(0, 5);

    const followUpRequests = consumerSummaries
      .filter((consumer) => consumer.latestCheckIn?.wantsStaffFollowUp)
      .slice(0, 5);

    const recentCheckInsNeedingReview = consumerSummaries
      .filter((consumer) => consumer.latestCheckIn && consumer.latestCheckIn.reviewStatus !== 'reviewed')
      .slice(0, 6);

    const todaysAppointments = consumers.flatMap((consumer) =>
      consumer.appointments
        .filter((appointment) => appointment.startsAt >= todayStart && appointment.startsAt < tomorrowStart)
        .map((appointment) => ({
          id: appointment.id,
          consumerId: consumer.id,
          consumerName: `${consumer.firstName} ${consumer.lastName}`,
          type: appointment.type,
          startsAt: appointment.startsAt,
          status: appointment.status
        }))
    );

    const queue = consumerSummaries
      .filter((consumer) => consumer.latestCheckIn)
      .map((consumer) => ({
        consumerId: consumer.id,
        consumerName: consumer.name,
        displayName: consumer.displayName,
        riskTier: consumer.risk.tier,
        riskScore: consumer.risk.score,
        reason: buildAttentionReason({
          wantsStaffFollowUp: Boolean(consumer.latestCheckIn?.wantsStaffFollowUp),
          cravings: consumer.latestCheckIn?.cravings ?? 0,
          mood: consumer.latestCheckIn?.mood ?? 10,
          status: consumer.latestCheckIn?.reviewStatus ?? 'pending',
          followUpStatus: consumer.latestCheckIn?.followUpStatus ?? 'not_needed'
        }),
        checkInId: consumer.latestCheckIn?.id ?? null,
        checkInDate: consumer.latestCheckIn?.checkInDate ?? null,
        nextAppointment: consumer.nextAppointment?.startsAt ?? null
      }))
      .sort((left, right) => right.riskScore - left.riskScore)
      .slice(0, 8);

    return {
      clinician: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      },
      scopeModel: 'organization_membership',
      organizations: user.memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role
      })),
      metrics: {
        assignedConsumers: consumerSummaries.length,
        consumersNeedingAttention: consumersNeedingAttention.length,
        followUpRequests: followUpRequests.length,
        checkInsToReview: recentCheckInsNeedingReview.length,
        todaysAppointments: todaysAppointments.length,
        highRiskConsumers: consumerSummaries.filter((consumer) => consumer.risk.tier === 'high').length
      },
      quickActions: [
        { id: 'queue', label: 'Work attention queue', href: '/clinical' },
        { id: 'roster', label: 'Open caseload roster', href: '/clinical' },
        { id: 'latest-checkin', label: 'Review latest check-ins', href: '/clinical/check-ins' },
        {
          id: 'top-consumer',
          label: consumersNeedingAttention[0] ? `Open ${consumersNeedingAttention[0].displayName}` : 'Open a consumer chart',
          href: consumersNeedingAttention[0] ? `/clinical/consumers/${consumersNeedingAttention[0].id}` : '/clinical'
        }
      ],
      consumersNeedingAttention,
      followUpRequests,
      recentCheckInsNeedingReview,
      todaysAppointments,
      todaysTasks: todaysAppointments.map((appointment) => ({
        id: appointment.id,
        label: buildTaskLabel(appointment),
        consumerName: appointment.consumerName
      })),
      alerts: queue
        .filter((item) => item.riskTier === 'high' || item.reason.includes('follow-up'))
        .slice(0, 5),
      queue
    };
  });

  app.get('/v1/clinical/roster', async (request) => {
    const { auth } = await requireClinicalContext(app, request);
    const { q, filter } = rosterQuerySchema.parse(request.query);
    const search = parseSearch(q);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const consumers = await prisma.consumer.findMany({
      where: getConsumerScope(auth),
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ],
      include: {
        organization: true,
        appointments: {
          where: {
            startsAt: {
              gte: new Date()
            }
          },
          orderBy: { startsAt: 'asc' },
          take: 1
        },
        checkIns: {
          where: {
            checkInDate: {
              gte: sevenDaysAgo
            }
          },
          orderBy: { checkInDate: 'desc' },
          include: {
            review: true
          },
          take: 7
        },
        routines: {
          include: {
            completions: {
              where: {
                completionDate: {
                  gte: sevenDaysAgo
                }
              }
            }
          }
        },
        recoveryPlan: true
      }
    });

    const items = consumers
      .map((consumer) => {
        const latestCheckIn = consumer.checkIns[0] ?? null;
        const review = latestCheckIn?.review ?? null;
        const risk = calculateConsumerRisk({
          latestCheckIn: latestCheckIn
            ? {
                cravings: latestCheckIn.cravings,
                mood: latestCheckIn.mood,
                stressLevel: latestCheckIn.stressLevel
              }
            : null,
          checkInCount7d: consumer.checkIns.length,
          routineCompletionCount7d: consumer.routines.reduce((total, routine) => total + routine.completions.length, 0),
          supportContacts: readJsonArray<{ name: string }>(consumer.recoveryPlan?.supportContacts).length,
          conditionFlags: 0
        });
        const record = {
          id: consumer.id,
          name: `${consumer.firstName} ${consumer.lastName}`,
          displayName: consumer.preferredName ?? consumer.firstName,
          organizationName: consumer.organization?.name ?? 'Unassigned organization',
          lastCheckIn: latestCheckIn
            ? {
                id: latestCheckIn.id,
                checkInDate: latestCheckIn.checkInDate,
                mood: latestCheckIn.mood,
                cravings: latestCheckIn.cravings
              }
            : null,
          followUpRequested: latestCheckIn?.wantsStaffFollowUp ?? false,
          reviewStatus: review?.status ?? (latestCheckIn ? 'pending' : 'no_recent_check_in'),
          nextAppointment: consumer.appointments[0]
            ? {
                id: consumer.appointments[0].id,
                type: consumer.appointments[0].type,
                startsAt: consumer.appointments[0].startsAt,
                status: consumer.appointments[0].status
              }
            : null,
          risk,
          routineCompletionCount7d: consumer.routines.reduce((total, routine) => total + routine.completions.length, 0)
        };

        return record;
      })
      .filter((consumer) => {
        if (!search) {
          return true;
        }

        return [
          consumer.name,
          consumer.displayName,
          consumer.organizationName
        ].some((value) => value.toLowerCase().includes(search));
      })
      .filter((consumer) => {
        if (filter === 'all') {
          return true;
        }

        if (filter === 'attention') {
          return consumer.followUpRequested || consumer.risk.tier !== 'low' || consumer.reviewStatus === 'pending';
        }

        if (filter === 'follow_up') {
          return consumer.followUpRequested;
        }

        if (filter === 'high_risk') {
          return consumer.risk.tier === 'high';
        }

        return consumer.lastCheckIn !== null;
      });

    return {
      filter,
      query: q ?? '',
      items
    };
  });

  app.get('/v1/clinical/consumers/:consumerId', async (request, reply) => {
    const { auth } = await requireClinicalContext(app, request);
    const params = z.object({ consumerId: z.string().min(1) }).parse(request.params);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const consumer = await prisma.consumer.findFirst({
      where: {
        id: params.consumerId,
        ...getConsumerScope(auth)
      },
      include: {
        organization: true,
        userAccount: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true
          }
        },
        recoveryPlan: true,
        goals: {
          orderBy: [
            { targetDate: 'asc' },
            { id: 'asc' }
          ]
        },
        routines: {
          orderBy: { id: 'asc' },
          include: {
            completions: {
              where: {
                completionDate: {
                  gte: sevenDaysAgo
                }
              },
              orderBy: { completionDate: 'desc' }
            }
          }
        },
        conditions: {
          orderBy: { symptomScore: 'desc' }
        },
        medications: {
          orderBy: { id: 'asc' }
        },
        appointments: {
          orderBy: { startsAt: 'asc' },
          take: 6
        },
        checkIns: {
          orderBy: { checkInDate: 'desc' },
          take: 10,
          include: {
            review: {
              include: {
                reviewer: {
                  select: {
                    id: true,
                    fullName: true
                  }
                }
              }
            }
          }
        },
        journals: {
          where: {
            sharedWithCareTeam: true
          },
          orderBy: { createdAt: 'desc' },
          take: 8
        },
        clinicalNotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!consumer) {
      return reply.code(404).send({ message: 'Consumer was not found in your clinical scope.' });
    }

    const latestCheckIn = consumer.checkIns[0] ?? null;
    const risk = calculateConsumerRisk({
      latestCheckIn: latestCheckIn
        ? {
            cravings: latestCheckIn.cravings,
            mood: latestCheckIn.mood,
            stressLevel: latestCheckIn.stressLevel
          }
        : null,
      checkInCount7d: consumer.checkIns.filter((checkIn) => checkIn.checkInDate >= sevenDaysAgo).length,
      routineCompletionCount7d: consumer.routines.reduce((total, routine) => total + routine.completions.length, 0),
      supportContacts: readJsonArray<{ name: string }>(consumer.recoveryPlan?.supportContacts).length,
      conditionFlags: consumer.conditions.filter((condition) => (condition.symptomScore ?? 0) >= 5).length
    });

    return {
      consumer: {
        id: consumer.id,
        firstName: consumer.firstName,
        lastName: consumer.lastName,
        preferredName: consumer.preferredName,
        displayName: consumer.preferredName ?? consumer.firstName,
        fullName: `${consumer.firstName} ${consumer.lastName}`,
        organization: consumer.organization
          ? {
              id: consumer.organization.id,
              name: consumer.organization.name
            }
          : null,
        linkedAccount: consumer.userAccount,
        traumaMode: consumer.traumaMode,
        cognitiveAssistMode: consumer.cognitiveAssistMode,
        recoveryFocus: consumer.recoveryFocus,
        checkInPreference: consumer.checkInPreference
      },
      risk,
      currentPlan: {
        summary: consumer.recoveryPlan?.summary ?? '',
        focusAreas: readJsonArray<{ title: string; detail: string }>(consumer.recoveryPlan?.focusAreas),
        copingStrategies: readJsonArray<{ title: string; detail: string }>(consumer.recoveryPlan?.copingStrategies),
        reminders: readJsonArray<{ title: string; schedule: string }>(consumer.recoveryPlan?.reminders),
        supportContacts: readJsonArray<{ name: string; relationship: string; phone: string; availability?: string }>(consumer.recoveryPlan?.supportContacts),
        safetyPlan: readJsonArray<{ title: string; action: string }>(consumer.recoveryPlan?.safetyPlan),
        milestones: readJsonArray<{ title: string; targetDate: string; status: string }>(consumer.recoveryPlan?.milestones)
      },
      goals: consumer.goals,
      routines: consumer.routines.map((routine) => ({
        id: routine.id,
        title: routine.title,
        description: routine.description,
        category: routine.category,
        frequency: routine.frequency,
        targetPerWeek: routine.targetPerWeek,
        isActive: routine.isActive,
        completionCount7d: routine.completions.length,
        completedToday: routine.completions.some((completion) => completion.completionDate >= new Date(new Date().setUTCHours(0, 0, 0, 0)))
      })),
      checkIns: consumer.checkIns.map((checkIn) => ({
        id: checkIn.id,
        checkInDate: checkIn.checkInDate,
        mood: checkIn.mood,
        cravings: checkIn.cravings,
        stressLevel: checkIn.stressLevel,
        sleepHours: checkIn.sleepHours,
        sleepQuality: checkIn.sleepQuality,
        motivationLevel: checkIn.motivationLevel,
        treatmentAdherence: checkIn.treatmentAdherence,
        wantsStaffFollowUp: checkIn.wantsStaffFollowUp,
        difficultMoments: checkIn.difficultMoments,
        copingToolsUsed: checkIn.copingToolsUsed,
        notes: checkIn.notes,
        gratitude: checkIn.gratitude,
        createdAt: checkIn.createdAt,
        review: checkIn.review
          ? {
              id: checkIn.review.id,
              status: checkIn.review.status,
              followUpStatus: checkIn.review.followUpStatus,
              reviewNote: checkIn.review.reviewNote,
              riskFlagged: checkIn.review.riskFlagged,
              reviewedAt: checkIn.review.reviewedAt,
              outreachCompletedAt: checkIn.review.outreachCompletedAt,
              reviewer: checkIn.review.reviewer
            }
          : null
      })),
      sharedJournalEntries: consumer.journals.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        moodScore: entry.moodScore,
        theme: entry.theme,
        createdAt: entry.createdAt
      })),
      medications: consumer.medications,
      appointments: consumer.appointments,
      conditions: consumer.conditions,
      notes: consumer.clinicalNotes.map((note) => ({
        id: note.id,
        title: note.title,
        body: note.body,
        noteType: note.noteType,
        flaggedForFollowUp: note.flaggedForFollowUp,
        createdAt: note.createdAt,
        author: note.author
      }))
    };
  });

  app.post('/v1/clinical/consumers/:consumerId/notes', async (request, reply) => {
    const { auth } = await requireClinicalContext(app, request);
    const params = z.object({ consumerId: z.string().min(1) }).parse(request.params);
    const payload = noteSchema.parse(request.body);
    const consumer = await loadAuthorizedConsumer(auth, params.consumerId);

    if (!consumer) {
      return reply.code(404).send({ message: 'Consumer was not found in your clinical scope.' });
    }

    const note = await prisma.clinicalNote.create({
      data: {
        tenantId: auth.tenantId,
        organizationId: consumer.organizationId ?? auth.organizationIds[0] ?? consumer.organization?.id ?? '',
        consumerId: consumer.id,
        authorUserId: auth.userId,
        noteType: payload.noteType,
        title: payload.title?.trim() || null,
        body: payload.body.trim(),
        flaggedForFollowUp: payload.flaggedForFollowUp
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    return {
      created: true,
      note: {
        id: note.id,
        title: note.title,
        body: note.body,
        noteType: note.noteType,
        flaggedForFollowUp: note.flaggedForFollowUp,
        createdAt: note.createdAt,
        author: note.author
      }
    };
  });

  app.patch('/v1/clinical/consumers/:consumerId/plan', async (request, reply) => {
    const { auth } = await requireClinicalContext(app, request);
    const params = z.object({ consumerId: z.string().min(1) }).parse(request.params);
    const payload = planUpdateSchema.parse(request.body);
    const consumer = await loadAuthorizedConsumer(auth, params.consumerId);

    if (!consumer) {
      return reply.code(404).send({ message: 'Consumer was not found in your clinical scope.' });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.consumer.update({
        where: { id: consumer.id },
        data: {
          preferredName: payload.preferredName,
          recoveryFocus: payload.recoveryFocus,
          checkInPreference: payload.checkInPreference
        }
      });

      if (payload.recoveryPlanSummary !== undefined) {
        const existingPlan = await transaction.recoveryPlan.findUnique({
          where: {
            consumerId: consumer.id
          }
        });

        if (existingPlan) {
          await transaction.recoveryPlan.update({
            where: { consumerId: consumer.id },
            data: {
              summary: payload.recoveryPlanSummary ?? existingPlan.summary
            }
          });
        }
      }
    });

    return { updated: true };
  });

  app.get('/v1/clinical/check-ins', async (request) => {
    const { auth } = await requireClinicalContext(app, request);
    const { filter } = checkInQuerySchema.parse(request.query);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setUTCHours(0, 0, 0, 0);
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);

    const items = await prisma.dailyCheckIn.findMany({
      where: {
        ...getCheckInScope(auth),
        checkInDate: {
          gte: fourteenDaysAgo
        }
      },
      orderBy: { checkInDate: 'desc' },
      include: {
        consumer: {
          include: {
            organization: true
          }
        },
        review: {
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      },
      take: 30
    });

    return {
      filter,
      items: items
        .filter((item) => {
          if (filter === 'recent') {
            return true;
          }

          if (filter === 'needs_follow_up') {
            return item.wantsStaffFollowUp || item.review?.followUpStatus === 'needed' || item.review?.followUpStatus === 'planned';
          }

          if (filter === 'high_craving') {
            return item.cravings >= 7;
          }

          if (filter === 'low_mood') {
            return item.mood <= 4;
          }

          return !item.review || item.review.status === 'pending';
        })
        .map((item) => ({
          id: item.id,
          checkInDate: item.checkInDate,
          mood: item.mood,
          cravings: item.cravings,
          stressLevel: item.stressLevel,
          motivationLevel: item.motivationLevel,
          wantsStaffFollowUp: item.wantsStaffFollowUp,
          consumer: {
            id: item.consumer.id,
            name: `${item.consumer.firstName} ${item.consumer.lastName}`,
            displayName: item.consumer.preferredName ?? item.consumer.firstName,
            organizationName: item.consumer.organization?.name ?? 'Unassigned organization'
          },
          review: item.review
            ? {
                id: item.review.id,
                status: item.review.status,
                followUpStatus: item.review.followUpStatus,
                reviewNote: item.review.reviewNote,
                reviewedAt: item.review.reviewedAt,
                outreachCompletedAt: item.review.outreachCompletedAt,
                reviewer: item.review.reviewer
              }
            : null
        }))
    };
  });

  app.get('/v1/clinical/check-ins/:checkInId', async (request, reply) => {
    const { auth } = await requireClinicalContext(app, request);
    const params = z.object({ checkInId: z.string().min(1) }).parse(request.params);

    const checkIn = await prisma.dailyCheckIn.findFirst({
      where: {
        id: params.checkInId,
        ...getCheckInScope(auth)
      },
      include: {
        consumer: {
          include: {
            organization: true
          }
        },
        review: {
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      }
    });

    if (!checkIn) {
      return reply.code(404).send({ message: 'Check-in was not found in your clinical scope.' });
    }

    return {
      checkIn: {
        id: checkIn.id,
        checkInDate: checkIn.checkInDate,
        mood: checkIn.mood,
        cravings: checkIn.cravings,
        stressLevel: checkIn.stressLevel,
        sleepHours: checkIn.sleepHours,
        sleepQuality: checkIn.sleepQuality,
        motivationLevel: checkIn.motivationLevel,
        treatmentAdherence: checkIn.treatmentAdherence,
        wantsStaffFollowUp: checkIn.wantsStaffFollowUp,
        difficultMoments: checkIn.difficultMoments,
        copingToolsUsed: checkIn.copingToolsUsed,
        notes: checkIn.notes,
        gratitude: checkIn.gratitude,
        createdAt: checkIn.createdAt
      },
      consumer: {
        id: checkIn.consumer.id,
        name: `${checkIn.consumer.firstName} ${checkIn.consumer.lastName}`,
        displayName: checkIn.consumer.preferredName ?? checkIn.consumer.firstName,
        organization: checkIn.consumer.organization
          ? {
              id: checkIn.consumer.organization.id,
              name: checkIn.consumer.organization.name
            }
          : null
      },
      review: checkIn.review
        ? {
            id: checkIn.review.id,
            status: checkIn.review.status,
            followUpStatus: checkIn.review.followUpStatus,
            reviewNote: checkIn.review.reviewNote,
            riskFlagged: checkIn.review.riskFlagged,
            reviewedAt: checkIn.review.reviewedAt,
            outreachCompletedAt: checkIn.review.outreachCompletedAt,
            reviewer: checkIn.review.reviewer
          }
        : null
    };
  });

  app.patch('/v1/clinical/check-ins/:checkInId/review', async (request, reply) => {
    const { auth } = await requireClinicalContext(app, request);
    const params = z.object({ checkInId: z.string().min(1) }).parse(request.params);
    const payload = reviewSchema.parse(request.body);

    const checkIn = await prisma.dailyCheckIn.findFirst({
      where: {
        id: params.checkInId,
        ...getCheckInScope(auth)
      },
      include: {
        consumer: true
      }
    });

    if (!checkIn) {
      return reply.code(404).send({ message: 'Check-in was not found in your clinical scope.' });
    }

    const organizationId = checkIn.consumer.organizationId ?? auth.organizationIds[0];

    if (!organizationId) {
      return reply.code(400).send({ message: 'This consumer is not assigned to an organization.' });
    }

    const nextStatus = payload.status
      ?? (
        payload.followUpStatus === 'needed' || payload.followUpStatus === 'planned'
          ? 'needs_follow_up'
          : 'reviewed'
      );

    const review = await prisma.checkInReview.upsert({
      where: {
        checkInId: checkIn.id
      },
      create: {
        checkInId: checkIn.id,
        tenantId: auth.tenantId,
        organizationId,
        consumerId: checkIn.consumerId,
        reviewerUserId: auth.userId,
        status: nextStatus,
        followUpStatus: payload.followUpStatus ?? (checkIn.wantsStaffFollowUp ? 'needed' : 'not_needed'),
        reviewNote: payload.reviewNote ?? null,
        riskFlagged: payload.riskFlagged ?? (checkIn.cravings >= 7 || checkIn.mood <= 4),
        reviewedAt: nextStatus === 'pending' ? null : new Date(),
        outreachCompletedAt: payload.outreachCompleted ? new Date() : null
      },
      update: {
        reviewerUserId: auth.userId,
        status: nextStatus,
        followUpStatus: payload.followUpStatus
          ?? undefined,
        reviewNote: payload.reviewNote === undefined ? undefined : payload.reviewNote,
        riskFlagged: payload.riskFlagged ?? undefined,
        reviewedAt: nextStatus === 'pending' ? null : new Date(),
        outreachCompletedAt: payload.outreachCompleted === undefined
          ? undefined
          : payload.outreachCompleted
            ? new Date()
            : null
      }
    });

    return {
      updated: true,
      review: {
        id: review.id,
        status: review.status,
        followUpStatus: review.followUpStatus,
        reviewNote: review.reviewNote,
        riskFlagged: review.riskFlagged,
        reviewedAt: review.reviewedAt,
        outreachCompletedAt: review.outreachCompletedAt
      }
    };
  });
}
