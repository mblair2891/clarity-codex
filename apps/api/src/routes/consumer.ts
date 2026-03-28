import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { assertOrganizationAccess, getOrgWhere, requireActiveOrganization } from '../lib/access/org-scope.js';
import { permissions } from '../lib/access/permissions.js';
import { requireRequestAccess, requireSelfPermission } from '../lib/access/route-permissions.js';
import { prisma } from '../lib/db.js';
import { RiskService } from '../services/risk.service.js';

const checkInSchema = z.object({
  mood: z.number().int().min(1).max(10),
  cravings: z.number().int().min(0).max(10),
  stressLevel: z.number().int().min(0).max(10),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5),
  motivationLevel: z.number().int().min(1).max(10),
  treatmentAdherence: z.boolean().optional(),
  difficultMoments: z.array(z.string().min(1).max(80)).max(6).default([]),
  copingToolsUsed: z.array(z.string().min(1).max(80)).max(6).default([]),
  wantsStaffFollowUp: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  gratitude: z.string().max(280).optional()
});

const journalEntrySchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(10).max(5000),
  moodScore: z.number().int().min(1).max(10).optional(),
  theme: z.string().max(80).optional(),
  sharedWithCareTeam: z.boolean().default(false)
});

const profileUpdateSchema = z.object({
  preferredName: z.string().min(1).max(80).optional().nullable(),
  recoveryFocus: z.string().min(1).max(200).optional().nullable(),
  checkInPreference: z.string().min(1).max(120).optional().nullable()
});

const routineCompletionSchema = z.object({
  completed: z.boolean()
});

const routineParamsSchema = z.object({
  routineId: z.string().min(1)
});

const resourceLibrary = {
  copingStrategies: [
    {
      title: 'Urge surfing',
      description: 'Name the craving, breathe for 90 seconds, and let the intensity rise and fall without acting on it.',
      whenToUse: 'When a craving spikes quickly'
    },
    {
      title: '5-4-3-2-1 grounding',
      description: 'Notice five things you can see, four you can touch, three you can hear, two you can smell, and one you can taste.',
      whenToUse: 'When anxiety or dissociation shows up'
    },
    {
      title: 'Reset walk',
      description: 'Take a 10-minute walk, drink water, and text one supportive person before making any risky decision.',
      whenToUse: 'When you feel restless or cornered'
    }
  ],
  groundingTools: [
    'Box breathing for four cycles',
    'Cold water on hands or face',
    'Short body scan from shoulders to feet',
    'Write one sentence: what happened, what I need, what helps next'
  ],
  emergencySupport: {
    crisisLine: 'Call or text 988 any time for immediate crisis support.',
    emergency: 'If you are in immediate danger or may overdose, call 911 now.',
    overdose: 'If naloxone is available, use it and stay with the person until emergency help arrives.'
  },
  treatmentReminders: [
    'Take medication only as prescribed.',
    'Reach out before missing two recovery tasks in a row.',
    'Use the follow-up request in your daily check-in when support would help.'
  ]
};

function startOfUtcDay(date = new Date()) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function endOfUtcDay(date = new Date()) {
  const value = startOfUtcDay(date);
  value.setUTCDate(value.getUTCDate() + 1);
  return value;
}

function readJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buildRecoveryStatusLabel(score: number, completedToday: boolean, wantsStaffFollowUp: boolean) {
  if (wantsStaffFollowUp) {
    return 'Follow-up requested';
  }

  if (score >= 70) {
    return 'High-support day';
  }

  if (completedToday) {
    return 'On track today';
  }

  return 'Ready for next step';
}

async function requireConsumerContext(app: FastifyInstance, request: FastifyRequest) {
  await app.authenticateRequest(request);
  const access = requireRequestAccess(request);
  requireActiveOrganization(access, 'Select an active organization before using consumer tools.');

  if (!access.consumerId) {
    const error = new Error('Consumer account is not linked to a consumer record.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  const consumer = await prisma.consumer.findFirst({
    where: {
      id: access.consumerId,
      tenantId: access.tenantId,
      ...getOrgWhere(access)
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!consumer) {
    const error = new Error('Linked consumer record was not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  assertOrganizationAccess(access, consumer.organizationId, 'Consumer account is outside the active organization.');

  return {
    access,
    consumer
  };
}

export async function consumerRoutes(app: FastifyInstance) {
  const riskService = new RiskService();

  app.get('/v1/consumer/dashboard', async (request) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    const todayStart = startOfUtcDay();
    const tomorrowStart = endOfUtcDay();
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);

    const [currentUser, recoveryPlan, recentCheckIns, recentJournalEntries, goals, routines, appointments, medications, conditions] =
      await prisma.$transaction([
        prisma.user.findUnique({
          where: { id: access.userId },
          select: {
            fullName: true,
            email: true,
            mustChangePassword: true
          }
        }),
        prisma.recoveryPlan.findUnique({
          where: { consumerId: consumer.id }
        }),
        prisma.dailyCheckIn.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: { checkInDate: 'desc' },
          take: 14
        }),
        prisma.journalEntry.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: { createdAt: 'desc' },
          take: 6
        }),
        prisma.goal.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: [
            { targetDate: 'asc' },
            { id: 'asc' }
          ]
        }),
        prisma.routine.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: { id: 'asc' },
          include: {
            completions: {
              where: {
                completionDate: {
                  gte: weekStart,
                  lt: tomorrowStart
                }
              },
              orderBy: { completionDate: 'desc' }
            }
          }
        }),
        prisma.appointment.findMany({
          where: {
            consumerId: consumer.id,
            startsAt: {
              gte: todayStart
            }
          },
          orderBy: { startsAt: 'asc' },
          take: 3
        }),
        prisma.medicationRecord.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: { id: 'asc' },
          take: 4
        }),
        prisma.consumerCondition.findMany({
          where: {
            consumerId: consumer.id
          },
          orderBy: { symptomScore: 'desc' },
          take: 5
        })
      ]);

    const todayCheckIn = recentCheckIns.find((entry) => entry.checkInDate >= todayStart && entry.checkInDate < tomorrowStart) ?? null;
    const latestCheckIn = recentCheckIns[0] ?? null;
    const supportContacts = readJsonArray<{ name: string; relationship: string; phone: string; availability?: string }>(recoveryPlan?.supportContacts);
    const focusAreas = readJsonArray<{ title: string; detail: string }>(recoveryPlan?.focusAreas);
    const copingStrategies = readJsonArray<{ title: string; detail: string }>(recoveryPlan?.copingStrategies);
    const reminders = readJsonArray<{ title: string; schedule: string }>(recoveryPlan?.reminders);
    const milestones = readJsonArray<{ title: string; targetDate: string; status: string }>(recoveryPlan?.milestones);
    const safetyPlan = readJsonArray<{ title: string; action: string }>(recoveryPlan?.safetyPlan);

    const routinesWithStatus = routines.map((routine) => {
      const completedToday = routine.completions.some(
        (completion) => completion.completionDate >= todayStart && completion.completionDate < tomorrowStart
      );

      return {
        id: routine.id,
        title: routine.title,
        description: routine.description,
        category: routine.category,
        frequency: routine.frequency,
        targetPerWeek: routine.targetPerWeek,
        isActive: routine.isActive,
        completedToday,
        streakDays: routine.completions.length,
        completionCount7d: routine.completions.length
      };
    });

    const completedTodayCount = routinesWithStatus.filter((routine) => routine.completedToday).length;
    const activeGoals = goals.filter((goal) => goal.status !== 'completed');
    const averageMood = recentCheckIns.length
      ? Math.round(recentCheckIns.reduce((total, entry) => total + entry.mood, 0) / recentCheckIns.length)
      : null;
    const averageCravings = recentCheckIns.length
      ? Math.round(recentCheckIns.reduce((total, entry) => total + entry.cravings, 0) / recentCheckIns.length)
      : null;
    const risk = riskService.assess({
      cravingsLevel: latestCheckIn?.cravings ?? 3,
      relapseCount30d: 0,
      ptsdFlashbackIntensity: latestCheckIn?.stressLevel ?? conditions[0]?.symptomScore ?? 3,
      depressionSeverity: latestCheckIn ? Math.max(1, 10 - latestCheckIn.mood) : 4,
      engagementScore: Math.min(10, 4 + completedTodayCount + (todayCheckIn ? 2 : 0)),
      protectiveContacts: supportContacts.length
    });

    const recentActivity = [
      ...recentCheckIns.slice(0, 3).map((entry) => ({
        id: `checkin-${entry.id}`,
        type: 'check_in',
        title: `Daily check-in: mood ${entry.mood}/10`,
        detail: entry.wantsStaffFollowUp ? 'Requested staff follow-up.' : 'Saved to your recovery timeline.',
        at: entry.createdAt
      })),
      ...recentJournalEntries.slice(0, 3).map((entry) => ({
        id: `journal-${entry.id}`,
        type: 'journal',
        title: entry.title,
        detail: entry.theme ? `Theme: ${entry.theme}` : 'Reflection saved.',
        at: entry.createdAt
      })),
      ...routinesWithStatus
        .filter((routine) => routine.completedToday)
        .map((routine) => ({
          id: `routine-${routine.id}`,
          type: 'routine',
          title: `${routine.title} completed`,
          detail: `${routine.completionCount7d} completions in the last 7 days`,
          at: todayStart
        }))
    ]
      .sort((left, right) => right.at.getTime() - left.at.getTime())
      .slice(0, 6);

    return {
      consumer: {
        id: consumer.id,
        firstName: consumer.firstName,
        lastName: consumer.lastName,
        preferredName: consumer.preferredName,
        displayName: consumer.preferredName || consumer.firstName,
        fullName: currentUser?.fullName ?? `${consumer.firstName} ${consumer.lastName}`,
        email: currentUser?.email ?? null,
        organization: consumer.organization,
        traumaMode: consumer.traumaMode,
        cognitiveAssistMode: consumer.cognitiveAssistMode,
        recoveryFocus: consumer.recoveryFocus,
        checkInPreference: consumer.checkInPreference
      },
      summary: {
        recoveryStatus: buildRecoveryStatusLabel(risk.score, Boolean(todayCheckIn), Boolean(todayCheckIn?.wantsStaffFollowUp)),
        risk,
        todayCheckInCompleted: Boolean(todayCheckIn),
        averageMood,
        averageCravings,
        activeGoals: activeGoals.length,
        completedRoutinesToday: completedTodayCount,
        nextAppointment: appointments[0]
          ? {
              type: appointments[0].type,
              startsAt: appointments[0].startsAt,
              status: appointments[0].status
            }
          : null
      },
      quickActions: [
        { id: 'check-in', label: todayCheckIn ? 'Update today\'s check-in' : 'Complete today\'s check-in', section: 'checkin' },
        { id: 'journal', label: 'Write a reflection', section: 'journal' },
        { id: 'routine', label: 'Mark a recovery habit complete', section: 'routines' },
        { id: 'support', label: 'Open support tools', section: 'resources' }
      ],
      todayCheckIn: todayCheckIn
        ? {
            completed: true,
            submittedAt: todayCheckIn.createdAt,
            mood: todayCheckIn.mood,
            cravings: todayCheckIn.cravings,
            stressLevel: todayCheckIn.stressLevel,
            sleepHours: todayCheckIn.sleepHours,
            sleepQuality: todayCheckIn.sleepQuality,
            motivationLevel: todayCheckIn.motivationLevel,
            treatmentAdherence: todayCheckIn.treatmentAdherence,
            difficultMoments: todayCheckIn.difficultMoments,
            copingToolsUsed: todayCheckIn.copingToolsUsed,
            wantsStaffFollowUp: todayCheckIn.wantsStaffFollowUp,
            notes: todayCheckIn.notes,
            gratitude: todayCheckIn.gratitude
          }
        : {
            completed: false
          },
      currentPlan: {
        summary: recoveryPlan?.summary ?? 'Your recovery plan is ready. Keep showing up for your routines, ask for support early, and use coping tools before stress turns into urgency.',
        focusAreas,
        copingStrategies,
        reminders,
        supportContacts,
        safetyPlan,
        milestones
      },
      tasks: routinesWithStatus,
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        targetLabel: goal.targetLabel,
        targetDate: goal.targetDate,
        status: goal.status
      })),
      checkInHistoryPreview: recentCheckIns.slice(0, 7).map((entry) => ({
        id: entry.id,
        checkInDate: entry.checkInDate,
        mood: entry.mood,
        cravings: entry.cravings,
        stressLevel: entry.stressLevel,
        motivationLevel: entry.motivationLevel,
        wantsStaffFollowUp: entry.wantsStaffFollowUp,
        notes: entry.notes
      })),
      recentJournalEntries: recentJournalEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        moodScore: entry.moodScore,
        theme: entry.theme,
        sharedWithCareTeam: entry.sharedWithCareTeam,
        createdAt: entry.createdAt
      })),
      recentActivity,
      support: {
        supportContacts,
        resources: resourceLibrary
      },
      medications: medications.map((medication) => ({
        id: medication.id,
        medicationName: medication.medicationName,
        dosage: medication.dosage,
        schedule: medication.schedule
      })),
      conditions: conditions.map((condition) => ({
        id: condition.id,
        name: condition.name,
        status: condition.status,
        symptomScore: condition.symptomScore,
        accommodation: condition.accommodation
      })),
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        type: appointment.type,
        status: appointment.status,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt
      })),
      profile: {
        preferredName: consumer.preferredName,
        recoveryFocus: consumer.recoveryFocus,
        checkInPreference: consumer.checkInPreference,
        mustChangePassword: currentUser?.mustChangePassword ?? false
      }
    };
  });

  app.get('/v1/consumer/check-ins', async (request) => {
    const { consumer } = await requireConsumerContext(app, request);
    const todayStart = startOfUtcDay();
    const lookbackStart = new Date(todayStart);
    lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 20);

    const entries = await prisma.dailyCheckIn.findMany({
      where: {
        consumerId: consumer.id,
        checkInDate: {
          gte: lookbackStart
        }
      },
      orderBy: { checkInDate: 'desc' }
    });

    const last7 = entries.filter((entry) => entry.checkInDate >= new Date(todayStart.getTime() - (6 * 24 * 60 * 60 * 1000)));
    const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

    return {
      todayCompleted: entries.some((entry) => entry.checkInDate.getTime() === todayStart.getTime()),
      trends: {
        averageMood7d: average(last7.map((entry) => entry.mood)),
        averageCravings7d: average(last7.map((entry) => entry.cravings)),
        averageStress7d: average(last7.map((entry) => entry.stressLevel ?? 0)),
        followUpRequests7d: last7.filter((entry) => entry.wantsStaffFollowUp).length,
        completionCount7d: last7.length
      },
      items: entries.map((entry) => ({
        id: entry.id,
        checkInDate: entry.checkInDate,
        mood: entry.mood,
        cravings: entry.cravings,
        stressLevel: entry.stressLevel,
        sleepHours: entry.sleepHours,
        sleepQuality: entry.sleepQuality,
        motivationLevel: entry.motivationLevel,
        treatmentAdherence: entry.treatmentAdherence,
        difficultMoments: entry.difficultMoments,
        copingToolsUsed: entry.copingToolsUsed,
        wantsStaffFollowUp: entry.wantsStaffFollowUp,
        notes: entry.notes,
        gratitude: entry.gratitude,
        createdAt: entry.createdAt
      }))
    };
  });

  app.post('/v1/consumer/check-ins', async (request, reply) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    requireSelfPermission(request, permissions.consumerCheckInsWriteSelf);
    const payload = checkInSchema.parse(request.body);
    const checkInDate = startOfUtcDay();
    const organizationId = assertOrganizationAccess(access, consumer.organizationId, 'Your account is outside the active organization.');

    const existingEntry = await prisma.dailyCheckIn.findUnique({
      where: {
        consumerId_checkInDate: {
          consumerId: consumer.id,
          checkInDate
        }
      }
    });

    const saved = await prisma.dailyCheckIn.upsert({
      where: {
        consumerId_checkInDate: {
          consumerId: consumer.id,
          checkInDate
        }
      },
      update: {
        organizationId,
        mood: payload.mood,
        cravings: payload.cravings,
        stressLevel: payload.stressLevel,
        sleepHours: payload.sleepHours,
        sleepQuality: payload.sleepQuality,
        motivationLevel: payload.motivationLevel,
        treatmentAdherence: payload.treatmentAdherence,
        difficultMoments: payload.difficultMoments,
        copingToolsUsed: payload.copingToolsUsed,
        wantsStaffFollowUp: payload.wantsStaffFollowUp,
        notes: payload.notes,
        gratitude: payload.gratitude
      },
      create: {
        consumerId: consumer.id,
        organizationId,
        checkInDate,
        mood: payload.mood,
        cravings: payload.cravings,
        stressLevel: payload.stressLevel,
        sleepHours: payload.sleepHours,
        sleepQuality: payload.sleepQuality,
        motivationLevel: payload.motivationLevel,
        treatmentAdherence: payload.treatmentAdherence,
        difficultMoments: payload.difficultMoments,
        copingToolsUsed: payload.copingToolsUsed,
        wantsStaffFollowUp: payload.wantsStaffFollowUp,
        notes: payload.notes,
        gratitude: payload.gratitude
      }
    });

    return reply.code(existingEntry ? 200 : 201).send({
      saved: true,
      updated: Boolean(existingEntry),
      checkIn: saved
    });
  });

  app.get('/v1/consumer/journal', async (request) => {
    const { consumer } = await requireConsumerContext(app, request);

    const entries = await prisma.journalEntry.findMany({
      where: {
        consumerId: consumer.id
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        moodScore: entry.moodScore,
        theme: entry.theme,
        sharedWithCareTeam: entry.sharedWithCareTeam,
        createdAt: entry.createdAt
      }))
    };
  });

  app.post('/v1/consumer/journal', async (request, reply) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    requireSelfPermission(request, permissions.consumerJournalWriteSelf);
    const payload = journalEntrySchema.parse(request.body);
    const organizationId = assertOrganizationAccess(access, consumer.organizationId, 'Your account is outside the active organization.');

    const entry = await prisma.journalEntry.create({
      data: {
        consumerId: consumer.id,
        organizationId,
        title: payload.title,
        content: payload.content,
        moodScore: payload.moodScore,
        theme: payload.theme,
        sharedWithCareTeam: payload.sharedWithCareTeam
      }
    });

    return reply.code(201).send({
      created: true,
      entry
    });
  });

  app.post('/v1/consumer/routines/:routineId/completions', async (request) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    requireSelfPermission(request, permissions.consumerRoutinesWriteSelf);
    const { routineId } = routineParamsSchema.parse(request.params);
    const { completed } = routineCompletionSchema.parse(request.body);
    const completionDate = startOfUtcDay();
    const organizationId = assertOrganizationAccess(access, consumer.organizationId, 'Your account is outside the active organization.');

    const routine = await prisma.routine.findFirst({
      where: {
        id: routineId,
        consumerId: consumer.id,
        organizationId
      },
      include: {
        completions: {
          where: {
            completionDate: {
              gte: new Date(completionDate.getTime() - (6 * 24 * 60 * 60 * 1000)),
              lt: endOfUtcDay()
            }
          }
        }
      }
    });

    if (!routine) {
      const error = new Error('Routine was not found for this consumer.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    assertOrganizationAccess(access, routine.organizationId, 'Routine is outside the active organization.');

    if (completed) {
      await prisma.routineCompletion.upsert({
        where: {
          routineId_completionDate: {
            routineId: routine.id,
            completionDate
          }
        },
        update: {},
        create: {
          routineId: routine.id,
          organizationId,
          completionDate
        }
      });
    } else {
      await prisma.routineCompletion.deleteMany({
        where: {
          routineId: routine.id,
          completionDate
        }
      });
    }

    const refreshed = await prisma.routine.findUnique({
      where: {
        id: routine.id
      },
      include: {
        completions: {
          where: {
            completionDate: {
              gte: new Date(completionDate.getTime() - (6 * 24 * 60 * 60 * 1000)),
              lt: endOfUtcDay()
            }
          }
        }
      }
    });

    return {
      saved: true,
      routine: refreshed
        ? {
            id: refreshed.id,
            title: refreshed.title,
            description: refreshed.description,
            category: refreshed.category,
            frequency: refreshed.frequency,
            targetPerWeek: refreshed.targetPerWeek,
            isActive: refreshed.isActive,
            completedToday: refreshed.completions.some((entry) => entry.completionDate.getTime() === completionDate.getTime()),
            completionCount7d: refreshed.completions.length
          }
        : null
    };
  });

  app.get('/v1/consumer/profile', async (request) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    requireSelfPermission(request, permissions.consumerProfileReadSelf);

    const user = await prisma.user.findUnique({
      where: {
        id: access.userId
      },
      select: {
        email: true,
        fullName: true,
        mustChangePassword: true
      }
    });

    return {
      profile: {
        firstName: consumer.firstName,
        lastName: consumer.lastName,
        preferredName: consumer.preferredName,
        fullName: user?.fullName ?? `${consumer.firstName} ${consumer.lastName}`,
        email: user?.email ?? null,
        recoveryFocus: consumer.recoveryFocus,
        checkInPreference: consumer.checkInPreference,
        traumaMode: consumer.traumaMode,
        cognitiveAssistMode: consumer.cognitiveAssistMode,
        mustChangePassword: user?.mustChangePassword ?? false
      }
    };
  });

  app.patch('/v1/consumer/profile', async (request) => {
    const { access, consumer } = await requireConsumerContext(app, request);
    requireSelfPermission(request, permissions.consumerProfileWriteSelf);
    const payload = profileUpdateSchema.parse(request.body);
    assertOrganizationAccess(access, consumer.organizationId, 'Consumer profile is outside the active organization.');

    const updated = await prisma.consumer.update({
      where: {
        id: consumer.id
      },
      data: {
        preferredName: payload.preferredName ?? null,
        recoveryFocus: payload.recoveryFocus ?? null,
        checkInPreference: payload.checkInPreference ?? null
      }
    });

    return {
      updated: true,
      profile: {
        preferredName: updated.preferredName,
        recoveryFocus: updated.recoveryFocus,
        checkInPreference: updated.checkInPreference
      }
    };
  });

  app.get('/v1/consumer/resources', async (request) => {
    await requireConsumerContext(app, request);
    return resourceLibrary;
  });
}
