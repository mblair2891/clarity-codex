import type { Prisma, Role } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/db.js';
import { hashPassword } from '../lib/password.js';
import { adminAccessRoles, canAssignRole, isClinicalRole, supportedBetaRoles } from '../lib/roles.js';
import { ResetSystemService } from '../services/reset-system.service.js';

const createUserSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(supportedBetaRoles),
  password: z.string().min(8),
  mustChangePassword: z.boolean().optional().default(false)
});

const updateUserSchema = z.object({
  organizationId: z.string().min(1).nullable().optional(),
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  role: z.enum(supportedBetaRoles).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional()
});

const temporaryPasswordSchema = z.object({
  temporaryPassword: z.string().min(8),
  mustChangePassword: z.boolean().optional().default(true)
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  npi: z.string().max(20).nullable().optional(),
  taxId: z.string().max(20).nullable().optional()
});

const resetSystemSchema = z.object({
  confirmationText: z.string().trim().min(1)
});

type AdminAuth = NonNullable<FastifyRequest['auth']>;

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const [firstName, ...lastNameParts] = normalized.split(' ');

  return {
    firstName: firstName || 'Beta',
    lastName: lastNameParts.join(' ') || 'User'
  };
}

function getAdminOrganizationScope(auth: AdminAuth) {
  if (auth.role === 'platform_admin') {
    return undefined;
  }

  return auth.organizationIds;
}

function getUserScopeWhere(auth: AdminAuth): Prisma.UserWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    tenantId: auth.tenantId,
    role: {
      not: 'platform_admin'
    },
    memberships: {
      some: {
        organizationId: {
          in: auth.organizationIds
        }
      }
    }
  };
}

function getOrganizationScopeWhere(auth: AdminAuth): Prisma.OrganizationWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    tenantId: auth.tenantId,
    id: {
      in: auth.organizationIds
    }
  };
}

function getConsumerScopeWhere(auth: AdminAuth): Prisma.ConsumerWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: auth.organizationIds
    }
  };
}

function getReviewScopeWhere(auth: AdminAuth): Prisma.CheckInReviewWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: auth.organizationIds
    }
  };
}

function getClinicalNoteScopeWhere(auth: AdminAuth): Prisma.ClinicalNoteWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    tenantId: auth.tenantId,
    organizationId: {
      in: auth.organizationIds
    }
  };
}

function getDailyCheckInScopeWhere(auth: AdminAuth): Prisma.DailyCheckInWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    consumer: {
      tenantId: auth.tenantId,
      organizationId: {
        in: auth.organizationIds
      }
    }
  };
}

function getJournalScopeWhere(auth: AdminAuth): Prisma.JournalEntryWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    consumer: {
      tenantId: auth.tenantId,
      organizationId: {
        in: auth.organizationIds
      }
    }
  };
}

function getAppointmentScopeWhere(auth: AdminAuth): Prisma.AppointmentWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    organizationId: {
      in: auth.organizationIds
    }
  };
}

function getRoutineCompletionScopeWhere(auth: AdminAuth): Prisma.RoutineCompletionWhereInput {
  if (auth.role === 'platform_admin') {
    return {};
  }

  return {
    routine: {
      consumer: {
        tenantId: auth.tenantId,
        organizationId: {
          in: auth.organizationIds
        }
      }
    }
  };
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function requireAdminContext(app: FastifyInstance, request: FastifyRequest) {
  await app.verifyTenantRole(request, adminAccessRoles);

  const auth = request.auth;
  if (!auth) {
    const error = new Error('Authentication required.') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  const currentUser = await prisma.user.findUnique({
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

  if (!currentUser) {
    const error = new Error('Admin user was not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    auth,
    currentUser,
    isPlatformAdmin: auth.role === 'platform_admin',
    organizationScope: getAdminOrganizationScope(auth)
  };
}

async function loadScopedUserForManagement(auth: AdminAuth, userId: string) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      ...getUserScopeWhere(auth)
    },
    include: {
      tenant: true,
      consumer: true,
      memberships: {
        include: {
          organization: true
        },
        orderBy: { id: 'asc' }
      }
    }
  });
}

function ensureRoleManagementAllowed(actorRole: Role, currentRole: Role, nextRole: Role) {
  if (!canAssignRole(actorRole, currentRole) || !canAssignRole(actorRole, nextRole)) {
    const error = new Error('Your role cannot manage that account type.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  if ((currentRole === 'consumer') !== (nextRole === 'consumer')) {
    const error = new Error('Changing between consumer and staff/admin roles is not supported in beta. Create a new account instead.') as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }
}

async function resolveTargetOrganization(args: {
  auth: AdminAuth;
  actorRole: Role;
  requestedOrganizationId?: string | null;
  tenantId: string;
}) {
  if (!args.requestedOrganizationId) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id: args.requestedOrganizationId }
  });

  if (!organization) {
    const error = new Error('Organization was not found.') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (args.actorRole !== 'platform_admin' && !args.auth.organizationIds.includes(organization.id)) {
    const error = new Error('Org admins can only manage users inside their assigned organization.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  if (args.actorRole !== 'platform_admin' && organization.tenantId !== args.tenantId) {
    const error = new Error('Org admins can only manage users in their own tenant.') as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return organization;
}

function buildRoleCounts(users: Array<{ role: Role }>) {
  const counts = supportedBetaRoles.reduce<Record<string, number>>((accumulator, role) => {
    accumulator[role] = 0;
    return accumulator;
  }, {});

  for (const user of users) {
    counts[user.role] = (counts[user.role] ?? 0) + 1;
  }

  return counts;
}

function buildStatusCounts(users: Array<{ isActive: boolean; mustChangePassword: boolean }>) {
  return users.reduce(
    (accumulator, user) => {
      if (user.isActive) {
        accumulator.active += 1;
      } else {
        accumulator.inactive += 1;
      }

      if (user.mustChangePassword) {
        accumulator.mustChangePassword += 1;
      }

      return accumulator;
    },
    { active: 0, inactive: 0, mustChangePassword: 0 }
  );
}

export async function adminRoutes(app: FastifyInstance) {
  const resetSystemService = new ResetSystemService(app.log);

  app.get('/v1/admin/dashboard', async (request) => {
    const { auth, currentUser, isPlatformAdmin, organizationScope } = await requireAdminContext(app, request);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

    const [
      tenant,
      organizations,
      users,
      manageableTenants,
      consumers,
      checkInReviews,
      flaggedNotes,
      recentCheckIns,
      recentNotes,
      recentAuditLogs,
      checkIns7dCount,
      followUpRequests7dCount,
      todayAppointmentsCount,
      sharedJournals7d,
      routineCompletions7d
    ] = await prisma.$transaction([
      prisma.tenant.findUnique({
        where: { id: auth.tenantId }
      }),
      prisma.organization.findMany({
        where: getOrganizationScopeWhere(auth),
        orderBy: [
          { tenantId: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          tenant: true,
          consumers: {
            select: {
              id: true
            }
          },
          memberships: {
            include: {
              user: true
            }
          },
          checkInReviews: {
            where: {
              OR: [
                { status: { in: ['pending', 'needs_follow_up'] } },
                { followUpStatus: { in: ['needed', 'planned'] } }
              ]
            },
            select: {
              id: true
            }
          }
        }
      }),
      prisma.user.findMany({
        where: getUserScopeWhere(auth),
        orderBy: [
          { tenantId: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          tenant: true,
          consumer: true,
          memberships: {
            include: {
              organization: true
            },
            orderBy: { id: 'asc' }
          }
        }
      }),
      isPlatformAdmin
        ? prisma.tenant.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
              organizations: {
                orderBy: { createdAt: 'asc' }
              }
            }
          })
        : prisma.tenant.findMany({
            where: { id: auth.tenantId },
            orderBy: { createdAt: 'asc' },
            include: {
              organizations: {
                where: {
                  id: {
                    in: organizationScope
                  }
                },
                orderBy: { createdAt: 'asc' }
              }
            }
          }),
      prisma.consumer.findMany({
        where: getConsumerScopeWhere(auth),
        include: {
          organization: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.checkInReview.findMany({
        where: getReviewScopeWhere(auth),
        orderBy: { updatedAt: 'desc' },
        take: 30,
        include: {
          consumer: true,
          organization: true,
          reviewer: true,
          checkIn: true
        }
      }),
      prisma.clinicalNote.findMany({
        where: {
          ...getClinicalNoteScopeWhere(auth),
          flaggedForFollowUp: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          consumer: true,
          organization: true,
          author: true
        }
      }),
      prisma.dailyCheckIn.findMany({
        where: {
          ...getDailyCheckInScopeWhere(auth),
          createdAt: {
            gte: sevenDaysAgo
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          consumer: {
            include: {
              organization: true
            }
          },
          review: {
            include: {
              reviewer: true
            }
          }
        }
      }),
      prisma.clinicalNote.findMany({
        where: {
          ...getClinicalNoteScopeWhere(auth),
          createdAt: {
            gte: sevenDaysAgo
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          consumer: true,
          organization: true,
          author: true
        }
      }),
      prisma.auditLog.findMany({
        where: isPlatformAdmin
          ? {}
          : {
              tenantId: auth.tenantId
            },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: true
        }
      }),
      prisma.dailyCheckIn.count({
        where: {
          ...getDailyCheckInScopeWhere(auth),
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      }),
      prisma.dailyCheckIn.count({
        where: {
          ...getDailyCheckInScopeWhere(auth),
          createdAt: {
            gte: sevenDaysAgo
          },
          wantsStaffFollowUp: true
        }
      }),
      prisma.appointment.count({
        where: {
          ...getAppointmentScopeWhere(auth),
          startsAt: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      prisma.journalEntry.count({
        where: {
          ...getJournalScopeWhere(auth),
          sharedWithCareTeam: true,
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      }),
      prisma.routineCompletion.count({
        where: {
          ...getRoutineCompletionScopeWhere(auth),
          completionDate: {
            gte: sevenDaysAgo
          }
        }
      })
    ]);

    if (!tenant) {
      const error = new Error('Beta dashboard data is incomplete.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const roleCounts = buildRoleCounts(users);
    const statusCounts = buildStatusCounts(users);
    const clinicianCount = users.filter((user) => isClinicalRole(user.role)).length;
    const flaggedReviewItems = checkInReviews.filter(
      (review) =>
        review.status === 'pending' ||
        review.status === 'needs_follow_up' ||
        review.followUpStatus === 'needed' ||
        review.followUpStatus === 'planned'
    );

    const flaggedItems = [
      ...flaggedReviewItems.map((review) => ({
        id: review.id,
        type: 'check_in_review',
        priority: review.riskFlagged ? 'high' : review.status === 'needs_follow_up' ? 'medium' : 'normal',
        title: `${review.consumer.firstName} ${review.consumer.lastName} needs follow-up`,
        detail: review.reviewNote ?? (review.checkIn.wantsStaffFollowUp ? 'Consumer requested staff follow-up.' : 'Check-in review remains unresolved.'),
        at: review.updatedAt,
        organizationId: review.organization.id,
        organizationName: review.organization.name,
        consumerId: review.consumer.id,
        consumerName: `${review.consumer.firstName} ${review.consumer.lastName}`,
        href: review.checkInId ? `/clinical/check-ins/${review.checkInId}` : '/clinical',
        status: review.followUpStatus
      })),
      ...flaggedNotes.map((note) => ({
        id: note.id,
        type: 'clinical_note',
        priority: 'medium',
        title: `${note.consumer.firstName} ${note.consumer.lastName} flagged by care team`,
        detail: note.title ?? note.body.slice(0, 140),
        at: note.updatedAt,
        organizationId: note.organization.id,
        organizationName: note.organization.name,
        consumerId: note.consumer.id,
        consumerName: `${note.consumer.firstName} ${note.consumer.lastName}`,
        href: `/clinical/consumers/${note.consumer.id}`,
        status: note.noteType
      }))
    ]
      .sort((left, right) => right.at.getTime() - left.at.getTime())
      .slice(0, 12);

    const recentActivity = [
      ...recentAuditLogs.map((item) => ({
        id: `audit-${item.id}`,
        type: 'admin_action',
        title: item.action,
        detail: item.user ? `Recorded by ${item.user.fullName}.` : 'Operational admin event recorded in beta.',
        at: item.createdAt,
        organizationName: null,
        userName: item.user?.fullName ?? null,
        consumerName: null
      })),
      ...recentCheckIns.map((item) => ({
        id: `checkin-${item.id}`,
        type: 'check_in',
        title: `${item.consumer.firstName} ${item.consumer.lastName} submitted a check-in`,
        detail: `Mood ${item.mood}/10, cravings ${item.cravings}/10${item.wantsStaffFollowUp ? ', follow-up requested' : ''}.`,
        at: item.createdAt,
        organizationName: item.consumer.organization?.name ?? null,
        userName: null,
        consumerName: `${item.consumer.firstName} ${item.consumer.lastName}`
      })),
      ...recentNotes.map((item) => ({
        id: `note-${item.id}`,
        type: 'clinical_note',
        title: `${item.author.fullName} added a clinician note`,
        detail: `${item.consumer.firstName} ${item.consumer.lastName}${item.title ? ` • ${item.title}` : ''}`,
        at: item.createdAt,
        organizationName: item.organization.name,
        userName: item.author.fullName,
        consumerName: `${item.consumer.firstName} ${item.consumer.lastName}`
      }))
    ]
      .sort((left, right) => right.at.getTime() - left.at.getTime())
      .slice(0, 16);

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      admin: {
        id: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.fullName,
        role: currentUser.role,
        mustChangePassword: currentUser.mustChangePassword
      },
      scopeModel: isPlatformAdmin ? 'platform_wide' : 'organization_membership',
      primaryOrganization: currentUser.memberships[0]?.organization
        ? {
            id: currentUser.memberships[0].organization.id,
            name: currentUser.memberships[0].organization.name,
            npi: currentUser.memberships[0].organization.npi
          }
        : null,
      counts: {
        organizations: organizations.length,
        users: users.length,
        activeUsers: statusCounts.active,
        consumers: consumers.length,
        clinicians: clinicianCount,
        orgAdmins: roleCounts.org_admin ?? 0,
        flaggedFollowUps: flaggedItems.length,
        unresolvedReviews: flaggedReviewItems.length
      },
      roleCounts,
      statusCounts,
      operationalOverview: {
        checkIns7d: checkIns7dCount,
        followUpRequests7d: followUpRequests7dCount,
        unresolvedReviews: flaggedReviewItems.length,
        riskFlaggedReviews: checkInReviews.filter((review) => review.riskFlagged).length,
        flaggedNotes: flaggedNotes.length,
        sharedJournals7d,
        appointmentsToday: todayAppointmentsCount,
        routineCompletions7d
      },
      quickActions: [
        { id: 'create-user', label: 'Create beta account', description: 'Provision a staff, admin, or consumer login.' },
        { id: 'review-follow-ups', label: 'Review flagged follow-ups', description: 'Jump into the current attention queue.' },
        { id: 'manage-orgs', label: 'Update organization details', description: 'Keep org names and identifiers current.' },
        ...(isPlatformAdmin && ResetSystemService.isEnabled()
          ? [
              {
                id: 'reset-system',
                label: 'Reset beta data',
                description: 'Wipe seeded and business data while preserving your platform admin access.'
              }
            ]
          : [])
      ],
      resetSystemEnabled: isPlatformAdmin && ResetSystemService.isEnabled(),
      resetSystemEnvironment: env.APP_ENV,
      organizations: organizations.map((organization) => {
        const scopedUsers = users.filter((user) => user.memberships.some((membership) => membership.organizationId === organization.id));

        return {
          id: organization.id,
          name: organization.name,
          npi: organization.npi,
          taxId: organization.taxId,
          tenantId: organization.tenantId,
          tenantName: organization.tenant.name,
          createdAt: organization.createdAt,
          userCount: scopedUsers.length,
          activeUserCount: scopedUsers.filter((user) => user.isActive).length,
          consumerCount: organization.consumers.length,
          clinicianCount: scopedUsers.filter((user) => isClinicalRole(user.role)).length,
          adminCount: scopedUsers.filter((user) => user.role === 'org_admin' || user.role === 'platform_admin').length,
          pendingReviewCount: organization.checkInReviews.length,
          followUpCount: flaggedItems.filter((item) => item.organizationId === organization.id).length
        };
      }),
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
        tenant: {
          id: user.tenant.id,
          slug: user.tenant.slug,
          name: user.tenant.name
        },
        organizations: user.memberships.map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          role: membership.role
        })),
        consumer: user.consumer
          ? {
              id: user.consumer.id,
              firstName: user.consumer.firstName,
              lastName: user.consumer.lastName
            }
          : null
      })),
      consumers: consumers.map((consumer) => ({
        id: consumer.id,
        firstName: consumer.firstName,
        lastName: consumer.lastName,
        traumaMode: consumer.traumaMode,
        cognitiveAssistMode: consumer.cognitiveAssistMode,
        createdAt: consumer.createdAt,
        organization: consumer.organization
          ? {
              id: consumer.organization.id,
              name: consumer.organization.name
            }
          : null
      })),
      flaggedItems,
      recentActivity,
      manageableTenants: manageableTenants.map((managedTenant) => ({
        id: managedTenant.id,
        slug: managedTenant.slug,
        name: managedTenant.name,
        organizations: managedTenant.organizations.map((organization) => ({
          id: organization.id,
          name: organization.name
        }))
      })),
      assignableRoles: supportedBetaRoles.filter((role) => canAssignRole(currentUser.role, role))
    };
  });

  app.post('/v1/admin/reset-system', async (request, reply) => {
    const { currentUser, isPlatformAdmin } = await requireAdminContext(app, request);
    const payload = resetSystemSchema.parse(request.body);

    if (!isPlatformAdmin) {
      return reply.code(403).send({ message: 'Only a platform admin can reset the beta system.' });
    }

    if (!ResetSystemService.isEnabled()) {
      return reply.code(403).send({ message: 'System reset is only enabled in the beta environment.' });
    }

    if (payload.confirmationText !== 'RESET') {
      return reply.code(400).send({ message: 'Type RESET exactly to confirm the beta reset.' });
    }

    const result = await resetSystemService.resetSystem(currentUser.id);
    return reply.send(result);
  });

  app.post('/v1/admin/users', async (request, reply) => {
    const { auth, currentUser } = await requireAdminContext(app, request);
    const payload = createUserSchema.parse(request.body);
    const actorRole = auth.role as Role;

    if (!canAssignRole(actorRole, payload.role)) {
      return reply.code(403).send({ message: 'Your role cannot assign that account type.' });
    }

    const tenant = payload.tenantSlug
      ? await prisma.tenant.findUnique({
          where: { slug: payload.tenantSlug }
        })
      : await prisma.tenant.findUnique({
          where: { id: auth.tenantId }
        });

    if (!tenant) {
      return reply.code(404).send({ message: 'Tenant was not found.' });
    }

    if (actorRole !== 'platform_admin' && tenant.id !== auth.tenantId) {
      return reply.code(403).send({ message: 'Org admins can only create users in their own tenant.' });
    }

    const requiresOrganization = payload.role !== 'platform_admin';
    if (requiresOrganization && !payload.organizationId) {
      return reply.code(400).send({ message: 'An organization is required for this role.' });
    }

    const organization = await resolveTargetOrganization({
      auth,
      actorRole,
      requestedOrganizationId: payload.organizationId ?? null,
      tenantId: tenant.id
    });

    if (payload.organizationId && organization?.tenantId !== tenant.id) {
      return reply.code(404).send({ message: 'Organization was not found in the selected tenant.' });
    }

    const email = payload.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email
        }
      }
    });

    if (existingUser) {
      return reply.code(409).send({ message: 'A beta account already exists for that email in this tenant.' });
    }

    const createdUser = await prisma.$transaction(async (transaction) => {
      let consumerId: string | undefined;

      if (payload.role === 'consumer') {
        if (!organization) {
          throw new Error('A consumer account requires an organization.');
        }

        const { firstName, lastName } = splitFullName(payload.fullName);
        const consumer = await transaction.consumer.create({
          data: {
            tenantId: tenant.id,
            organizationId: organization.id,
            firstName,
            lastName
          }
        });

        consumerId = consumer.id;
      }

      const user = await transaction.user.create({
        data: {
          tenantId: tenant.id,
          consumerId,
          email,
          fullName: payload.fullName.trim(),
          role: payload.role,
          passwordHash: await hashPassword(payload.password),
          mustChangePassword: payload.mustChangePassword,
          memberships: organization
            ? {
                create: {
                  organizationId: organization.id,
                  role: payload.role
                }
              }
            : undefined
        },
        include: {
          tenant: true,
          consumer: true,
          memberships: {
            include: {
              organization: true
            }
          }
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: currentUser.id,
          action: 'admin.user.created',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            email: user.email,
            role: user.role,
            organizationId: organization?.id ?? null
          }
        }
      });

      return user;
    });

    return reply.code(201).send({
      created: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
        role: createdUser.role,
        isActive: createdUser.isActive,
        mustChangePassword: createdUser.mustChangePassword,
        tenant: {
          id: createdUser.tenant.id,
          slug: createdUser.tenant.slug,
          name: createdUser.tenant.name
        },
        organizations: createdUser.memberships.map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          role: membership.role
        })),
        consumer: createdUser.consumer
          ? {
              id: createdUser.consumer.id,
              firstName: createdUser.consumer.firstName,
              lastName: createdUser.consumer.lastName
            }
          : null
      }
    });
  });

  app.patch('/v1/admin/users/:userId', async (request, reply) => {
    const { auth, currentUser } = await requireAdminContext(app, request);
    const params = z.object({ userId: z.string().min(1) }).parse(request.params);
    const payload = updateUserSchema.parse(request.body);
    const targetUser = await loadScopedUserForManagement(auth, params.userId);

    if (!targetUser) {
      return reply.code(404).send({ message: 'User was not found in your admin scope.' });
    }

    if (targetUser.id === currentUser.id && (payload.role || payload.isActive === false)) {
      return reply.code(400).send({ message: 'Use another admin account to change your own role or deactivate your own access.' });
    }

    const nextRole = payload.role ?? targetUser.role;
    ensureRoleManagementAllowed(auth.role as Role, targetUser.role, nextRole);

    const tenantId = targetUser.tenantId;
    const requestedOrganizationId =
      payload.organizationId === undefined ? targetUser.memberships[0]?.organizationId ?? null : payload.organizationId;

    const requiresOrganization = nextRole !== 'platform_admin';
    if (requiresOrganization && !requestedOrganizationId) {
      return reply.code(400).send({ message: 'An organization is required for this role.' });
    }

    const organization = await resolveTargetOrganization({
      auth,
      actorRole: auth.role as Role,
      requestedOrganizationId,
      tenantId
    });

    if (organization && organization.tenantId !== targetUser.tenantId) {
      return reply.code(400).send({ message: 'Moving a beta account across tenants is not supported from this admin flow.' });
    }

    const nextEmail = payload.email ? payload.email.trim().toLowerCase() : targetUser.email;
    if (nextEmail !== targetUser.email) {
      const conflictingUser = await prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: targetUser.tenantId,
            email: nextEmail
          }
        }
      });

      if (conflictingUser && conflictingUser.id !== targetUser.id) {
        return reply.code(409).send({ message: 'A beta account already exists for that email in this tenant.' });
      }
    }

    const fullName = payload.fullName?.trim() ?? targetUser.fullName;

    const updatedUser = await prisma.$transaction(async (transaction) => {
      if (targetUser.consumerId && organization) {
        const { firstName, lastName } = splitFullName(fullName);
        await transaction.consumer.update({
          where: { id: targetUser.consumerId },
          data: {
            tenantId: targetUser.tenantId,
            organizationId: organization.id,
            firstName,
            lastName
          }
        });
      }

      await transaction.membership.deleteMany({
        where: {
          userId: targetUser.id
        }
      });

      const user = await transaction.user.update({
        where: { id: targetUser.id },
        data: {
          email: nextEmail,
          fullName,
          role: nextRole,
          isActive: payload.isActive ?? targetUser.isActive,
          mustChangePassword: payload.mustChangePassword ?? targetUser.mustChangePassword,
          memberships: organization
            ? {
                create: {
                  organizationId: organization.id,
                  role: nextRole
                }
              }
            : undefined
        },
        include: {
          tenant: true,
          consumer: true,
          memberships: {
            include: {
              organization: true
            }
          }
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: currentUser.id,
          action: 'admin.user.updated',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            previousRole: targetUser.role,
            nextRole,
            organizationId: organization?.id ?? null,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword
          }
        }
      });

      return user;
    });

    return reply.send({
      updated: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        mustChangePassword: updatedUser.mustChangePassword,
        tenant: {
          id: updatedUser.tenant.id,
          slug: updatedUser.tenant.slug,
          name: updatedUser.tenant.name
        },
        organizations: updatedUser.memberships.map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          role: membership.role
        })),
        consumer: updatedUser.consumer
          ? {
              id: updatedUser.consumer.id,
              firstName: updatedUser.consumer.firstName,
              lastName: updatedUser.consumer.lastName
            }
          : null
      }
    });
  });

  app.post('/v1/admin/users/:userId/set-temporary-password', async (request, reply) => {
    const { auth, currentUser } = await requireAdminContext(app, request);
    const params = z.object({ userId: z.string().min(1) }).parse(request.params);
    const payload = temporaryPasswordSchema.parse(request.body);
    const targetUser = await loadScopedUserForManagement(auth, params.userId);

    if (!targetUser) {
      return reply.code(404).send({ message: 'User was not found in your admin scope.' });
    }

    ensureRoleManagementAllowed(auth.role as Role, targetUser.role, targetUser.role);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: {
          passwordHash: await hashPassword(payload.temporaryPassword),
          mustChangePassword: payload.mustChangePassword
        }
      }),
      prisma.auditLog.create({
        data: {
          tenantId: targetUser.tenantId,
          userId: currentUser.id,
          action: 'admin.user.temporary_password_set',
          entityType: 'user',
          entityId: targetUser.id,
          metadata: {
            mustChangePassword: payload.mustChangePassword
          }
        }
      })
    ]);

    return reply.send({
      updated: true,
      userId: targetUser.id,
      mustChangePassword: payload.mustChangePassword
    });
  });

  app.patch('/v1/admin/organizations/:organizationId', async (request, reply) => {
    const { auth, currentUser } = await requireAdminContext(app, request);
    const params = z.object({ organizationId: z.string().min(1) }).parse(request.params);
    const payload = updateOrganizationSchema.parse(request.body);

    const organization = await prisma.organization.findFirst({
      where: {
        id: params.organizationId,
        ...getOrganizationScopeWhere(auth)
      }
    });

    if (!organization) {
      return reply.code(404).send({ message: 'Organization was not found in your admin scope.' });
    }

    const updatedOrganization = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.organization.update({
        where: { id: organization.id },
        data: {
          name: payload.name?.trim() ?? organization.name,
          npi: payload.npi === undefined ? organization.npi : normalizeOptionalString(payload.npi),
          taxId: payload.taxId === undefined ? organization.taxId : normalizeOptionalString(payload.taxId)
        }
      });

      await transaction.auditLog.create({
        data: {
          tenantId: updated.tenantId,
          userId: currentUser.id,
          action: 'admin.organization.updated',
          entityType: 'organization',
          entityId: updated.id,
          metadata: {
            name: updated.name,
            npi: updated.npi,
            taxId: updated.taxId
          }
        }
      });

      return updated;
    });

    return reply.send({
      updated: true,
      organization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        npi: updatedOrganization.npi,
        taxId: updatedOrganization.taxId,
        tenantId: updatedOrganization.tenantId
      }
    });
  });
}
