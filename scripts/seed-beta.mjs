import { PrismaClient } from '@prisma/client';
import { hashPassword } from './lib/password.mjs';

const prisma = new PrismaClient();

function requirePasswordEnv(name) {
  const value = process.env[name];

  if (!value || value.trim().length < 8) {
    throw new Error(`${name} is required for beta seeding and must be at least 8 characters.`);
  }

  return value;
}

function startOfUtcDay(offsetDays = 0) {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

function atUtcHour(baseDate, hour, minute = 0) {
  const value = new Date(baseDate);
  value.setUTCHours(hour, minute, 0, 0);
  return value;
}

const seedPasswords = {
  platformAdmin: requirePasswordEnv('BETA_PLATFORM_ADMIN_PASSWORD'),
  clinicalStaff: requirePasswordEnv('BETA_CLINICAL_PASSWORD'),
  billing: requirePasswordEnv('BETA_BILLING_PASSWORD'),
  consumer: requirePasswordEnv('BETA_CONSUMER_PASSWORD')
};

async function upsertConsumerCondition(consumerId, data) {
  const existing = await prisma.consumerCondition.findFirst({
    where: {
      consumerId,
      name: data.name
    }
  });

  if (existing) {
    return prisma.consumerCondition.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.consumerCondition.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertGoal(consumerId, data) {
  const existing = await prisma.goal.findFirst({
    where: {
      consumerId,
      title: data.title
    }
  });

  if (existing) {
    return prisma.goal.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.goal.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertRoutine(consumerId, data) {
  const existing = await prisma.routine.findFirst({
    where: {
      consumerId,
      title: data.title
    }
  });

  if (existing) {
    return prisma.routine.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.routine.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertMedication(consumerId, data) {
  const existing = await prisma.medicationRecord.findFirst({
    where: {
      consumerId,
      medicationName: data.medicationName
    }
  });

  if (existing) {
    return prisma.medicationRecord.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.medicationRecord.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertJournalEntry(consumerId, data) {
  const existing = await prisma.journalEntry.findFirst({
    where: {
      consumerId,
      title: data.title
    }
  });

  if (existing) {
    return prisma.journalEntry.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.journalEntry.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertAppointment(organizationId, consumerId, data) {
  const existing = await prisma.appointment.findFirst({
    where: {
      organizationId,
      consumerId,
      type: data.type,
      startsAt: data.startsAt
    }
  });

  if (existing) {
    return prisma.appointment.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.appointment.create({
    data: {
      organizationId,
      consumerId,
      ...data
    }
  });
}

async function upsertConsumerProfile(tenantId, organizationId, data) {
  const existing = await prisma.consumer.findFirst({
    where: {
      tenantId,
      firstName: data.firstName,
      lastName: data.lastName
    }
  });

  if (existing) {
    return prisma.consumer.update({
      where: { id: existing.id },
      data: {
        organizationId,
        ...data
      }
    });
  }

  return prisma.consumer.create({
    data: {
      tenantId,
      organizationId,
      ...data
    }
  });
}

async function upsertDailyCheckIn(consumerId, data) {
  return prisma.dailyCheckIn.upsert({
    where: {
      consumerId_checkInDate: {
        consumerId,
        checkInDate: data.checkInDate
      }
    },
    update: {
      mood: data.mood,
      cravings: data.cravings,
      stressLevel: data.stressLevel,
      sleepHours: data.sleepHours,
      sleepQuality: data.sleepQuality,
      motivationLevel: data.motivationLevel,
      treatmentAdherence: data.treatmentAdherence,
      difficultMoments: data.difficultMoments,
      copingToolsUsed: data.copingToolsUsed,
      wantsStaffFollowUp: data.wantsStaffFollowUp,
      notes: data.notes,
      gratitude: data.gratitude
    },
    create: {
      consumerId,
      ...data
    }
  });
}

async function upsertClinicalNote(tenantId, organizationId, consumerId, authorUserId, data) {
  const existing = await prisma.clinicalNote.findFirst({
    where: {
      consumerId,
      authorUserId,
      noteType: data.noteType,
      title: data.title ?? null
    }
  });

  if (existing) {
    return prisma.clinicalNote.update({
      where: { id: existing.id },
      data: {
        body: data.body,
        flaggedForFollowUp: data.flaggedForFollowUp ?? false
      }
    });
  }

  return prisma.clinicalNote.create({
    data: {
      tenantId,
      organizationId,
      consumerId,
      authorUserId,
      noteType: data.noteType,
      title: data.title ?? null,
      body: data.body,
      flaggedForFollowUp: data.flaggedForFollowUp ?? false
    }
  });
}

async function upsertCheckInReview(tenantId, organizationId, consumerId, reviewerUserId, checkInId, data) {
  return prisma.checkInReview.upsert({
    where: {
      checkInId
    },
    update: data,
    create: {
      tenantId,
      organizationId,
      consumerId,
      reviewerUserId,
      checkInId,
      ...data
    }
  });
}

async function upsertAuditLog(tenantId, userId, action, entityType, entityId, metadata, createdAt) {
  const existing = await prisma.auditLog.findFirst({
    where: {
      tenantId,
      userId,
      action,
      entityType,
      entityId: entityId ?? null
    }
  });

  if (existing) {
    return prisma.auditLog.update({
      where: { id: existing.id },
      data: {
        metadata,
        createdAt
      }
    });
  }

  return prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt
    }
  });
}

async function upsertPayer(tenantId, name) {
  const existing = await prisma.payer.findFirst({
    where: {
      tenantId,
      name
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.payer.create({
    data: {
      tenantId,
      name
    }
  });
}

async function upsertInsurancePlan(payerId, name) {
  const existing = await prisma.insurancePlan.findFirst({
    where: {
      payerId,
      name
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.insurancePlan.create({
    data: {
      payerId,
      name
    }
  });
}

async function upsertCoverage(consumerId, planId, data) {
  const existing = await prisma.coverage.findFirst({
    where: {
      consumerId,
      memberId: data.memberId
    }
  });

  if (existing) {
    return prisma.coverage.update({
      where: { id: existing.id },
      data: {
        planId,
        ...data
      }
    });
  }

  return prisma.coverage.create({
    data: {
      consumerId,
      planId,
      ...data
    }
  });
}

async function upsertAuthorization(coverageId, data) {
  const existing = await prisma.authorization.findFirst({
    where: {
      coverageId,
      serviceType: data.serviceType
    }
  });

  if (existing) {
    return prisma.authorization.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.authorization.create({
    data: {
      coverageId,
      ...data
    }
  });
}

async function upsertEncounter(organizationId, consumerId, data) {
  const existing = await prisma.encounter.findFirst({
    where: {
      organizationId,
      consumerId,
      serviceCode: data.serviceCode
    }
  });

  if (existing) {
    return prisma.encounter.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.encounter.create({
    data: {
      organizationId,
      consumerId,
      ...data
    }
  });
}

async function upsertCharge(encounterId, data) {
  const existing = await prisma.charge.findFirst({
    where: {
      encounterId,
      cptCode: data.cptCode
    }
  });

  if (existing) {
    return prisma.charge.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.charge.create({
    data: {
      encounterId,
      ...data
    }
  });
}

async function upsertClaim(encounterId, data) {
  const existing = await prisma.claim.findFirst({
    where: {
      encounterId
    }
  });

  if (existing) {
    return prisma.claim.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.claim.create({
    data: {
      encounterId,
      ...data
    }
  });
}

async function upsertDenial(claimId, data) {
  const existing = await prisma.denial.findFirst({
    where: {
      claimId,
      code: data.code
    }
  });

  if (existing) {
    return prisma.denial.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.denial.create({
    data: {
      claimId,
      ...data
    }
  });
}

async function upsertRemittance(claimId, data) {
  const existing = await prisma.remittance.findUnique({
    where: {
      claimId
    }
  });

  if (existing) {
    return prisma.remittance.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.remittance.create({
    data: {
      claimId,
      ...data
    }
  });
}

async function upsertInvoice(consumerId, data) {
  const existing = await prisma.invoice.findFirst({
    where: {
      consumerId,
      totalCents: data.totalCents
    }
  });

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.invoice.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertLedgerEntry(consumerId, data) {
  const existing = await prisma.patientLedgerEntry.findFirst({
    where: {
      consumerId,
      type: data.type,
      amountCents: data.amountCents
    }
  });

  if (existing) {
    return prisma.patientLedgerEntry.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.patientLedgerEntry.create({
    data: {
      consumerId,
      ...data
    }
  });
}

async function upsertBillingWorkItem(tenantId, organizationId, consumerId, createdByUserId, data) {
  const existing = await prisma.billingWorkItem.findFirst({
    where: {
      consumerId,
      title: data.title
    }
  });

  if (existing) {
    return prisma.billingWorkItem.update({
      where: { id: existing.id },
      data: {
        tenantId,
        organizationId,
        coverageId: data.coverageId ?? null,
        encounterId: data.encounterId ?? null,
        claimId: data.claimId ?? null,
        updatedByUserId: createdByUserId,
        status: data.status,
        priority: data.priority,
        payerName: data.payerName ?? null,
        issueSummary: data.issueSummary ?? null,
        nextAction: data.nextAction ?? null,
        amountCents: data.amountCents ?? null,
        serviceDate: data.serviceDate ?? null,
        submittedAt: data.submittedAt ?? null
      }
    });
  }

  return prisma.billingWorkItem.create({
    data: {
      tenantId,
      organizationId,
      consumerId,
      coverageId: data.coverageId ?? null,
      encounterId: data.encounterId ?? null,
      claimId: data.claimId ?? null,
      createdByUserId,
      updatedByUserId: createdByUserId,
      title: data.title,
      status: data.status,
      priority: data.priority,
      payerName: data.payerName ?? null,
      issueSummary: data.issueSummary ?? null,
      nextAction: data.nextAction ?? null,
      amountCents: data.amountCents ?? null,
      serviceDate: data.serviceDate ?? null,
      submittedAt: data.submittedAt ?? null
    }
  });
}

async function upsertBillingNote(tenantId, organizationId, consumerId, authorUserId, data) {
  const existing = await prisma.billingNote.findFirst({
    where: {
      consumerId,
      workItemId: data.workItemId ?? null,
      authorUserId,
      noteType: data.noteType
    }
  });

  if (existing) {
    return prisma.billingNote.update({
      where: { id: existing.id },
      data: {
        body: data.body
      }
    });
  }

  return prisma.billingNote.create({
    data: {
      tenantId,
      organizationId,
      consumerId,
      workItemId: data.workItemId ?? null,
      authorUserId,
      noteType: data.noteType,
      body: data.body
    }
  });
}

async function upsertBillingActivity(workItemId, actorUserId, data) {
  const existing = await prisma.billingWorkItemActivity.findFirst({
    where: {
      workItemId,
      action: data.action,
      detail: data.detail ?? null
    }
  });

  if (existing) {
    return prisma.billingWorkItemActivity.update({
      where: { id: existing.id },
      data: {
        actorUserId,
        fromStatus: data.fromStatus ?? null,
        toStatus: data.toStatus ?? null,
        createdAt: data.createdAt
      }
    });
  }

  return prisma.billingWorkItemActivity.create({
    data: {
      workItemId,
      actorUserId,
      action: data.action,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus ?? null,
      detail: data.detail ?? null,
      createdAt: data.createdAt
    }
  });
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'beta-demo' },
    update: { name: 'Clarity Beta Demo Tenant' },
    create: {
      slug: 'beta-demo',
      name: 'Clarity Beta Demo Tenant'
    }
  });

  let organization = await prisma.organization.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'Clarity Beta Clinic'
    }
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        name: 'Clarity Beta Clinic',
        npi: '1992999999'
      }
    });
  }

  let consumer = await prisma.consumer.findFirst({
    where: {
      tenantId: tenant.id,
      firstName: 'Ava',
      lastName: 'Martinez'
    }
  });

  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: {
        tenantId: tenant.id,
        organizationId: organization.id,
        firstName: 'Ava',
        lastName: 'Martinez',
        preferredName: 'Ava',
        recoveryFocus: 'Protect early recovery by keeping mornings structured and reaching out before cravings escalate.',
        checkInPreference: 'Morning check-in before 9 AM',
        traumaMode: true,
        cognitiveAssistMode: true
      }
    });
  } else {
    consumer = await prisma.consumer.update({
      where: { id: consumer.id },
      data: {
        organizationId: organization.id,
        preferredName: 'Ava',
        recoveryFocus: 'Protect early recovery by keeping mornings structured and reaching out before cravings escalate.',
        checkInPreference: 'Morning check-in before 9 AM',
        traumaMode: true,
        cognitiveAssistMode: true
      }
    });
  }

  const seededUsers = [
    {
      email: 'beta-admin@claritybridgehealth.com',
      fullName: 'Clarity Beta Admin',
      role: 'platform_admin',
      password: seedPasswords.platformAdmin,
      membershipRole: 'org_admin',
      consumerId: null,
      isActive: true,
      mustChangePassword: false
    },
    {
      email: 'beta-org-admin@claritybridgehealth.com',
      fullName: 'Morgan Org Admin',
      role: 'org_admin',
      password: seedPasswords.platformAdmin,
      membershipRole: 'org_admin',
      consumerId: null,
      isActive: true,
      mustChangePassword: true
    },
    {
      email: 'beta-clinical@claritybridgehealth.com',
      fullName: 'Taylor Clinical',
      role: 'clinical_staff',
      password: seedPasswords.clinicalStaff,
      membershipRole: 'clinical_staff',
      consumerId: null,
      isActive: true,
      mustChangePassword: false
    },
    {
      email: 'beta-care-coordinator@claritybridgehealth.com',
      fullName: 'Riley Care Coordinator',
      role: 'clinical_staff',
      password: seedPasswords.clinicalStaff,
      membershipRole: 'clinical_staff',
      consumerId: null,
      isActive: false,
      mustChangePassword: true
    },
    {
      email: 'beta-billing@claritybridgehealth.com',
      fullName: 'Bailey Billing',
      role: 'billing',
      password: seedPasswords.billing,
      membershipRole: 'billing',
      consumerId: null,
      isActive: true,
      mustChangePassword: false
    },
    {
      email: 'beta-consumer@claritybridgehealth.com',
      fullName: 'Ava Martinez',
      role: 'consumer',
      password: seedPasswords.consumer,
      membershipRole: 'consumer',
      consumerId: consumer.id,
      isActive: true,
      mustChangePassword: false
    }
  ];

  const upsertedUsers = [];

  for (const seededUser of seededUsers) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: seededUser.email
        }
      },
      update: {
        fullName: seededUser.fullName,
        role: seededUser.role,
        passwordHash: await hashPassword(seededUser.password),
        isActive: seededUser.isActive,
        mustChangePassword: seededUser.mustChangePassword,
        consumerId: seededUser.consumerId
      },
      create: {
        tenantId: tenant.id,
        email: seededUser.email,
        fullName: seededUser.fullName,
        role: seededUser.role,
        passwordHash: await hashPassword(seededUser.password),
        isActive: seededUser.isActive,
        mustChangePassword: seededUser.mustChangePassword,
        consumerId: seededUser.consumerId
      }
    });

    upsertedUsers.push(user);

    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId: organization.id
      }
    });

    if (!existingMembership) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: seededUser.membershipRole
        }
      });
    }
  }

  const clinicalUser = upsertedUsers.find((user) => user.role === 'clinical_staff');
  const billingUser = upsertedUsers.find((user) => user.role === 'billing');
  const platformAdminUser = upsertedUsers.find((user) => user.role === 'platform_admin');
  const orgAdminUser = upsertedUsers.find((user) => user.email === 'beta-org-admin@claritybridgehealth.com');

  if (!clinicalUser) {
    throw new Error('Expected seeded clinical_staff account to exist.');
  }

  if (!billingUser) {
    throw new Error('Expected seeded billing account to exist.');
  }

  if (!platformAdminUser || !orgAdminUser) {
    throw new Error('Expected seeded admin accounts to exist.');
  }

  const marcus = await upsertConsumerProfile(tenant.id, organization.id, {
    firstName: 'Marcus',
    lastName: 'Green',
    preferredName: 'Marcus',
    recoveryFocus: 'Stay engaged after work shifts and use outreach before cravings turn into a missed evening.',
    checkInPreference: 'Late afternoon check-in after work',
    traumaMode: false,
    cognitiveAssistMode: true
  });

  const naomi = await upsertConsumerProfile(tenant.id, organization.id, {
    firstName: 'Naomi',
    lastName: 'Carter',
    preferredName: 'Naomi',
    recoveryFocus: 'Stabilize sleep, reduce isolation, and rebuild confidence after missed appointments.',
    checkInPreference: 'Midday check-in with simple next steps',
    traumaMode: true,
    cognitiveAssistMode: false
  });

  await upsertConsumerCondition(consumer.id, {
    name: 'PTSD',
    status: 'active',
    symptomScore: 5,
    accommodation: 'Gentle prompts, grounding reminders, and clear next steps.'
  });

  await upsertConsumerCondition(consumer.id, {
    name: 'insomnia',
    status: 'active',
    symptomScore: 4,
    accommodation: 'Protect wind-down routine and reduce late-night stimulation.'
  });

  await upsertGoal(consumer.id, {
    title: 'Complete one recovery check-in every morning',
    description: 'Use the daily check-in before 9 AM to notice mood, cravings, and early warning signs.',
    category: 'daily structure',
    targetLabel: 'Daily for the next 14 days',
    status: 'in_progress',
    targetDate: startOfUtcDay(14)
  });

  await upsertGoal(consumer.id, {
    title: 'Attend two peer-support meetings this week',
    description: 'Use support meetings to stay connected before stress turns into isolation.',
    category: 'connection',
    targetLabel: '2 meetings this week',
    status: 'in_progress',
    targetDate: startOfUtcDay(6)
  });

  await upsertGoal(consumer.id, {
    title: 'Build a stable evening sleep routine',
    description: 'Start wind-down by 9:30 PM and keep the bedroom phone-free.',
    category: 'sleep',
    targetLabel: '5 nights this week',
    status: 'in_progress',
    targetDate: startOfUtcDay(7)
  });

  const morningRoutine = await upsertRoutine(consumer.id, {
    title: 'Morning recovery check-in',
    description: 'Pause, rate today’s mood and cravings, and choose one support step.',
    category: 'check-in',
    frequency: 'daily',
    targetPerWeek: 7,
    isActive: true
  });

  const groundingRoutine = await upsertRoutine(consumer.id, {
    title: 'Grounding practice',
    description: 'Use 5-4-3-2-1 grounding or breathing for at least 5 minutes.',
    category: 'coping skill',
    frequency: 'daily',
    targetPerWeek: 7,
    isActive: true
  });

  const supportRoutine = await upsertRoutine(consumer.id, {
    title: 'Reach out to support network',
    description: 'Text or call one support person, especially on higher-stress days.',
    category: 'connection',
    frequency: '3x weekly',
    targetPerWeek: 3,
    isActive: true
  });

  await prisma.recoveryPlan.upsert({
    where: {
      consumerId: consumer.id
    },
    update: {
      summary: 'Ava is in early recovery and does best with structure, quick coping tools, and early outreach when cravings or stress rise.',
      focusAreas: [
        {
          title: 'Protect mornings',
          detail: 'Start the day with a check-in, water, medication, and one grounding step.'
        },
        {
          title: 'Interrupt isolation quickly',
          detail: 'Reach out before missing support tasks two days in a row.'
        }
      ],
      copingStrategies: [
        {
          title: 'Urge surfing',
          detail: 'Notice the craving without acting on it and ride the wave for 90 seconds.'
        },
        {
          title: 'Walk and reset',
          detail: 'Step outside, breathe, drink water, and delay any risky decision by 15 minutes.'
        },
        {
          title: 'Grounding script',
          detail: 'Name what is happening, what you need, and one safe next step.'
        }
      ],
      reminders: [
        {
          title: 'Morning meds and check-in',
          schedule: 'Daily before 9 AM'
        },
        {
          title: 'Peer support meeting',
          schedule: 'Tuesday and Thursday evenings'
        },
        {
          title: 'Wind-down routine',
          schedule: 'Start by 9:30 PM'
        }
      ],
      supportContacts: [
        {
          name: 'Taylor Clinical',
          relationship: 'Care team',
          phone: '555-0108',
          availability: 'Weekdays 8 AM to 5 PM'
        },
        {
          name: 'Jordan P.',
          relationship: 'Peer mentor',
          phone: '555-0101',
          availability: 'Daily check-in buddy'
        },
        {
          name: 'Maya L.',
          relationship: 'Sibling',
          phone: '555-0110',
          availability: 'Evenings'
        }
      ],
      safetyPlan: [
        {
          title: 'If cravings reach 8/10',
          action: 'Leave the triggering space, call Jordan, and text the care team if the urge stays high for 20 minutes.'
        },
        {
          title: 'If sleep drops below 4 hours',
          action: 'Use the grounding routine after lunch, avoid caffeine after 2 PM, and mention it in the next check-in.'
        }
      ],
      milestones: [
        {
          title: 'Two weeks of morning check-ins',
          targetDate: startOfUtcDay(14).toISOString(),
          status: 'in_progress'
        },
        {
          title: 'First month of linked consumer beta use',
          targetDate: startOfUtcDay(30).toISOString(),
          status: 'planned'
        }
      ]
    },
    create: {
      consumerId: consumer.id,
      summary: 'Ava is in early recovery and does best with structure, quick coping tools, and early outreach when cravings or stress rise.',
      focusAreas: [
        {
          title: 'Protect mornings',
          detail: 'Start the day with a check-in, water, medication, and one grounding step.'
        },
        {
          title: 'Interrupt isolation quickly',
          detail: 'Reach out before missing support tasks two days in a row.'
        }
      ],
      copingStrategies: [
        {
          title: 'Urge surfing',
          detail: 'Notice the craving without acting on it and ride the wave for 90 seconds.'
        },
        {
          title: 'Walk and reset',
          detail: 'Step outside, breathe, drink water, and delay any risky decision by 15 minutes.'
        },
        {
          title: 'Grounding script',
          detail: 'Name what is happening, what you need, and one safe next step.'
        }
      ],
      reminders: [
        {
          title: 'Morning meds and check-in',
          schedule: 'Daily before 9 AM'
        },
        {
          title: 'Peer support meeting',
          schedule: 'Tuesday and Thursday evenings'
        },
        {
          title: 'Wind-down routine',
          schedule: 'Start by 9:30 PM'
        }
      ],
      supportContacts: [
        {
          name: 'Taylor Clinical',
          relationship: 'Care team',
          phone: '555-0108',
          availability: 'Weekdays 8 AM to 5 PM'
        },
        {
          name: 'Jordan P.',
          relationship: 'Peer mentor',
          phone: '555-0101',
          availability: 'Daily check-in buddy'
        },
        {
          name: 'Maya L.',
          relationship: 'Sibling',
          phone: '555-0110',
          availability: 'Evenings'
        }
      ],
      safetyPlan: [
        {
          title: 'If cravings reach 8/10',
          action: 'Leave the triggering space, call Jordan, and text the care team if the urge stays high for 20 minutes.'
        },
        {
          title: 'If sleep drops below 4 hours',
          action: 'Use the grounding routine after lunch, avoid caffeine after 2 PM, and mention it in the next check-in.'
        }
      ],
      milestones: [
        {
          title: 'Two weeks of morning check-ins',
          targetDate: startOfUtcDay(14).toISOString(),
          status: 'in_progress'
        },
        {
          title: 'First month of linked consumer beta use',
          targetDate: startOfUtcDay(30).toISOString(),
          status: 'planned'
        }
      ]
    }
  });

  const checkInSeeds = [
    {
      offsetDays: -3,
      mood: 6,
      cravings: 5,
      stressLevel: 6,
      sleepHours: 5.2,
      sleepQuality: 2,
      motivationLevel: 6,
      treatmentAdherence: true,
      difficultMoments: ['Passed an old neighborhood trigger'],
      copingToolsUsed: ['Urge surfing', 'Texted peer mentor'],
      wantsStaffFollowUp: false,
      notes: 'Felt activated in the afternoon but paused and called Jordan before things escalated.',
      gratitude: 'My sister checking in after dinner.'
    },
    {
      offsetDays: -2,
      mood: 7,
      cravings: 3,
      stressLevel: 4,
      sleepHours: 6.4,
      sleepQuality: 4,
      motivationLevel: 7,
      treatmentAdherence: true,
      difficultMoments: ['Low energy after group'],
      copingToolsUsed: ['Short walk', '5-4-3-2-1 grounding'],
      wantsStaffFollowUp: false,
      notes: 'Today felt steadier. Group notes helped me stay focused on the next right step.',
      gratitude: 'Finishing my support worksheet.'
    },
    {
      offsetDays: -1,
      mood: 6,
      cravings: 4,
      stressLevel: 5,
      sleepHours: 6.0,
      sleepQuality: 3,
      motivationLevel: 6,
      treatmentAdherence: true,
      difficultMoments: ['Unexpected conflict with family'],
      copingToolsUsed: ['Grounding script', 'Reset walk'],
      wantsStaffFollowUp: false,
      notes: 'Conflict spiked my stress, but I stayed sober and used the plan instead of isolating.',
      gratitude: 'Making it through a hard conversation without using.'
    },
    {
      offsetDays: 0,
      mood: 7,
      cravings: 2,
      stressLevel: 3,
      sleepHours: 7.1,
      sleepQuality: 4,
      motivationLevel: 8,
      treatmentAdherence: true,
      difficultMoments: ['Morning anxiety before appointment'],
      copingToolsUsed: ['Breathing practice', 'Texted care team'],
      wantsStaffFollowUp: false,
      notes: 'I felt nervous this morning but the structure helped. I want to keep the momentum going.',
      gratitude: 'Waking up clear-headed and on time.'
    }
  ];

  const avaCheckIns = [];

  for (const checkInSeed of checkInSeeds) {
    const checkInDate = startOfUtcDay(checkInSeed.offsetDays);

    avaCheckIns.push(await upsertDailyCheckIn(consumer.id, {
      checkInDate,
      mood: checkInSeed.mood,
      cravings: checkInSeed.cravings,
      stressLevel: checkInSeed.stressLevel,
      sleepHours: checkInSeed.sleepHours,
      sleepQuality: checkInSeed.sleepQuality,
      motivationLevel: checkInSeed.motivationLevel,
      treatmentAdherence: checkInSeed.treatmentAdherence,
      difficultMoments: checkInSeed.difficultMoments,
      copingToolsUsed: checkInSeed.copingToolsUsed,
      wantsStaffFollowUp: checkInSeed.wantsStaffFollowUp,
      notes: checkInSeed.notes,
      gratitude: checkInSeed.gratitude
    }));
  }

  const journalSeeds = [
    {
      title: 'Held the line after a trigger',
      content: 'I felt the urge to shut down after getting upset, but I slowed down, walked outside, and texted Jordan instead of disappearing.',
      moodScore: 6,
      theme: 'trigger response',
      sharedWithCareTeam: true
    },
    {
      title: 'What helps me feel safe in the morning',
      content: 'A calm start matters more than I admit. Water, meds, sunlight, and one simple check-in make the rest of the day feel possible.',
      moodScore: 7,
      theme: 'recovery routine',
      sharedWithCareTeam: false
    },
    {
      title: 'Small win after group',
      content: 'I stayed after group long enough to ask one honest question. That felt uncomfortable, but it was better than pretending I was fine.',
      moodScore: 7,
      theme: 'connection',
      sharedWithCareTeam: true
    }
  ];

  for (const journalSeed of journalSeeds) {
    await upsertJournalEntry(consumer.id, journalSeed);
  }

  await upsertMedication(consumer.id, {
    medicationName: 'Naltrexone',
    dosage: '50 mg',
    schedule: 'Each morning with breakfast'
  });

  await upsertMedication(consumer.id, {
    medicationName: 'Hydroxyzine',
    dosage: '25 mg',
    schedule: 'At night as prescribed for anxiety/sleep'
  });

  const intakeDay = startOfUtcDay(1);
  const followUpDay = startOfUtcDay(5);

  await upsertAppointment(organization.id, consumer.id, {
    type: 'Individual therapy',
    status: 'scheduled',
    startsAt: atUtcHour(intakeDay, 15, 0),
    endsAt: atUtcHour(intakeDay, 15, 45)
  });

  await upsertAppointment(organization.id, consumer.id, {
    type: 'Peer recovery coaching',
    status: 'scheduled',
    startsAt: atUtcHour(followUpDay, 17, 30),
    endsAt: atUtcHour(followUpDay, 18, 0)
  });

  const routineCompletionSeeds = [
    [morningRoutine.id, -3],
    [groundingRoutine.id, -3],
    [morningRoutine.id, -2],
    [supportRoutine.id, -2],
    [morningRoutine.id, -1],
    [groundingRoutine.id, -1],
    [morningRoutine.id, 0],
    [groundingRoutine.id, 0]
  ];

  for (const [routineId, offsetDays] of routineCompletionSeeds) {
    await prisma.routineCompletion.upsert({
      where: {
        routineId_completionDate: {
          routineId,
          completionDate: startOfUtcDay(offsetDays)
        }
      },
      update: {},
      create: {
        routineId,
        completionDate: startOfUtcDay(offsetDays)
      }
    });
  }

  const marcusMorningRoutine = await upsertRoutine(marcus.id, {
    title: 'After-work craving reset',
    description: 'Pause after shift change, drink water, and complete one grounding step before going home.',
    category: 'relapse prevention',
    frequency: 'daily',
    targetPerWeek: 7,
    isActive: true
  });

  const marcusSupportRoutine = await upsertRoutine(marcus.id, {
    title: 'Text sponsor before 7 PM',
    description: 'Reach out on work nights before cravings build after the commute home.',
    category: 'connection',
    frequency: '5x weekly',
    targetPerWeek: 5,
    isActive: true
  });

  const naomiSleepRoutine = await upsertRoutine(naomi.id, {
    title: 'Night wind-down plan',
    description: 'Dim lights, silence notifications, and start the sleep routine before 10 PM.',
    category: 'sleep',
    frequency: 'daily',
    targetPerWeek: 7,
    isActive: true
  });

  await upsertGoal(marcus.id, {
    title: 'Finish five sober evenings after work this week',
    description: 'Use the commute and first hour home as structured recovery time.',
    category: 'relapse prevention',
    targetLabel: '5 evenings this week',
    status: 'in_progress',
    targetDate: startOfUtcDay(7)
  });

  await upsertGoal(naomi.id, {
    title: 'Re-establish a stable sleep routine',
    description: 'Aim for five nights of intentional wind-down this week.',
    category: 'sleep',
    targetLabel: '5 nights this week',
    status: 'in_progress',
    targetDate: startOfUtcDay(7)
  });

  await upsertConsumerCondition(marcus.id, {
    name: 'anxiety',
    status: 'active',
    symptomScore: 6,
    accommodation: 'Offer brief step-by-step prompts when stress is elevated after work.'
  });

  await upsertConsumerCondition(naomi.id, {
    name: 'depression',
    status: 'active',
    symptomScore: 7,
    accommodation: 'Use clear, concrete next steps and reinforce small wins.'
  });

  await prisma.recoveryPlan.upsert({
    where: { consumerId: marcus.id },
    update: {
      summary: 'Marcus does best with structured post-shift support, fast outreach, and concrete coping steps before cravings spike.',
      focusAreas: [
        { title: 'Protect evenings', detail: 'Use the first 30 minutes after work to slow down, hydrate, and reset.' },
        { title: 'Interrupt isolation', detail: 'Text sponsor or care team before skipping dinner or support contact.' }
      ],
      copingStrategies: [
        { title: 'Car-to-home reset', detail: 'Sit in the car for two minutes, breathe, and name the next safe action.' },
        { title: 'Short walking route', detail: 'Walk one block before entering the apartment if the urge feels sharp.' }
      ],
      reminders: [
        { title: 'After-work check-in', schedule: 'Weekdays by 5:30 PM' }
      ],
      supportContacts: [
        { name: 'Taylor Clinical', relationship: 'Care team', phone: '555-0108', availability: 'Weekdays' },
        { name: 'Luis G.', relationship: 'Sponsor', phone: '555-0120', availability: 'Evenings' }
      ],
      safetyPlan: [
        { title: 'If cravings hit 8/10', action: 'Go to the community center, text sponsor, and avoid being alone for the first hour.' }
      ],
      milestones: [
        { title: 'One full week of evening check-ins', targetDate: startOfUtcDay(7).toISOString(), status: 'in_progress' }
      ]
    },
    create: {
      consumerId: marcus.id,
      summary: 'Marcus does best with structured post-shift support, fast outreach, and concrete coping steps before cravings spike.',
      focusAreas: [
        { title: 'Protect evenings', detail: 'Use the first 30 minutes after work to slow down, hydrate, and reset.' },
        { title: 'Interrupt isolation', detail: 'Text sponsor or care team before skipping dinner or support contact.' }
      ],
      copingStrategies: [
        { title: 'Car-to-home reset', detail: 'Sit in the car for two minutes, breathe, and name the next safe action.' },
        { title: 'Short walking route', detail: 'Walk one block before entering the apartment if the urge feels sharp.' }
      ],
      reminders: [
        { title: 'After-work check-in', schedule: 'Weekdays by 5:30 PM' }
      ],
      supportContacts: [
        { name: 'Taylor Clinical', relationship: 'Care team', phone: '555-0108', availability: 'Weekdays' },
        { name: 'Luis G.', relationship: 'Sponsor', phone: '555-0120', availability: 'Evenings' }
      ],
      safetyPlan: [
        { title: 'If cravings hit 8/10', action: 'Go to the community center, text sponsor, and avoid being alone for the first hour.' }
      ],
      milestones: [
        { title: 'One full week of evening check-ins', targetDate: startOfUtcDay(7).toISOString(), status: 'in_progress' }
      ]
    }
  });

  await prisma.recoveryPlan.upsert({
    where: { consumerId: naomi.id },
    update: {
      summary: 'Naomi benefits from gentle check-ins, clearer daily structure, and quick recovery from missed appointments.',
      focusAreas: [
        { title: 'Restore daytime rhythm', detail: 'Anchor the morning with water, medication, and one message back to the team.' },
        { title: 'Reduce missed care', detail: 'Prep transportation and reminders the night before appointments.' }
      ],
      copingStrategies: [
        { title: 'Tiny next step', detail: 'Pick one 5-minute task when everything feels heavy.' },
        { title: 'Grounding phrase', detail: 'Say out loud what is happening, what you need, and who can help.' }
      ],
      reminders: [
        { title: 'Midday mood check', schedule: 'Daily at noon' },
        { title: 'Appointment prep', schedule: 'Night before each visit' }
      ],
      supportContacts: [
        { name: 'Taylor Clinical', relationship: 'Care team', phone: '555-0108', availability: 'Weekdays' },
        { name: 'Kendra R.', relationship: 'Aunt', phone: '555-0133', availability: 'Afternoons' }
      ],
      safetyPlan: [
        { title: 'If overwhelm shuts things down', action: 'Reply with one-word check-in, then call aunt or care team for the next small step.' }
      ],
      milestones: [
        { title: 'Attend next two scheduled visits', targetDate: startOfUtcDay(10).toISOString(), status: 'planned' }
      ]
    },
    create: {
      consumerId: naomi.id,
      summary: 'Naomi benefits from gentle check-ins, clearer daily structure, and quick recovery from missed appointments.',
      focusAreas: [
        { title: 'Restore daytime rhythm', detail: 'Anchor the morning with water, medication, and one message back to the team.' },
        { title: 'Reduce missed care', detail: 'Prep transportation and reminders the night before appointments.' }
      ],
      copingStrategies: [
        { title: 'Tiny next step', detail: 'Pick one 5-minute task when everything feels heavy.' },
        { title: 'Grounding phrase', detail: 'Say out loud what is happening, what you need, and who can help.' }
      ],
      reminders: [
        { title: 'Midday mood check', schedule: 'Daily at noon' },
        { title: 'Appointment prep', schedule: 'Night before each visit' }
      ],
      supportContacts: [
        { name: 'Taylor Clinical', relationship: 'Care team', phone: '555-0108', availability: 'Weekdays' },
        { name: 'Kendra R.', relationship: 'Aunt', phone: '555-0133', availability: 'Afternoons' }
      ],
      safetyPlan: [
        { title: 'If overwhelm shuts things down', action: 'Reply with one-word check-in, then call aunt or care team for the next small step.' }
      ],
      milestones: [
        { title: 'Attend next two scheduled visits', targetDate: startOfUtcDay(10).toISOString(), status: 'planned' }
      ]
    }
  });

  const marcusCheckIns = await Promise.all([
    upsertDailyCheckIn(marcus.id, {
      checkInDate: startOfUtcDay(-2),
      mood: 5,
      cravings: 6,
      stressLevel: 7,
      sleepHours: 5.8,
      sleepQuality: 3,
      motivationLevel: 5,
      treatmentAdherence: true,
      difficultMoments: ['Long shift with conflict at work'],
      copingToolsUsed: ['Breathing practice'],
      wantsStaffFollowUp: false,
      notes: 'Barely made it home without stopping. Stress stayed high through the night.',
      gratitude: 'Still answered my sponsor text.'
    }),
    upsertDailyCheckIn(marcus.id, {
      checkInDate: startOfUtcDay(-1),
      mood: 4,
      cravings: 8,
      stressLevel: 8,
      sleepHours: 4.9,
      sleepQuality: 2,
      motivationLevel: 4,
      treatmentAdherence: true,
      difficultMoments: ['Passed the liquor store after work', 'Skipped dinner'],
      copingToolsUsed: ['Sat in the car and texted sponsor'],
      wantsStaffFollowUp: true,
      notes: 'Needed support yesterday evening. I stayed sober but it felt too close.',
      gratitude: 'My sponsor picked up the phone.'
    })
  ]);

  const naomiCheckIns = await Promise.all([
    upsertDailyCheckIn(naomi.id, {
      checkInDate: startOfUtcDay(-4),
      mood: 5,
      cravings: 2,
      stressLevel: 6,
      sleepHours: 5.1,
      sleepQuality: 2,
      motivationLevel: 4,
      treatmentAdherence: false,
      difficultMoments: ['Stayed in bed too long'],
      copingToolsUsed: ['Texted aunt'],
      wantsStaffFollowUp: false,
      notes: 'Energy was low most of the day and I missed my morning routine.',
      gratitude: 'My aunt reminding me to eat.'
    }),
    upsertDailyCheckIn(naomi.id, {
      checkInDate: startOfUtcDay(-1),
      mood: 3,
      cravings: 3,
      stressLevel: 7,
      sleepHours: 4.6,
      sleepQuality: 2,
      motivationLevel: 3,
      treatmentAdherence: false,
      difficultMoments: ['Missed callback from clinic', 'Stayed isolated all afternoon'],
      copingToolsUsed: ['Short grounding phrase'],
      wantsStaffFollowUp: true,
      notes: 'I am slipping into avoidance again and need help getting back on track.',
      gratitude: 'I still sent one honest text.'
    })
  ]);

  for (const [routineId, offsetDays] of [
    [marcusMorningRoutine.id, -2],
    [marcusSupportRoutine.id, -2],
    [naomiSleepRoutine.id, -4]
  ]) {
    await prisma.routineCompletion.upsert({
      where: {
        routineId_completionDate: {
          routineId,
          completionDate: startOfUtcDay(offsetDays)
        }
      },
      update: {},
      create: {
        routineId,
        completionDate: startOfUtcDay(offsetDays)
      }
    });
  }

  await upsertJournalEntry(marcus.id, {
    title: 'Almost isolated after work',
    content: 'I wanted to disappear after the shift, but I told the truth and reached out before it turned into a bad night.',
    moodScore: 4,
    theme: 'after work risk',
    sharedWithCareTeam: true
  });

  await upsertJournalEntry(naomi.id, {
    title: 'Hard to restart after missing a day',
    content: 'When I miss one thing it snowballs fast. I need smaller steps and fewer decisions on bad mornings.',
    moodScore: 3,
    theme: 'activation',
    sharedWithCareTeam: true
  });

  await upsertMedication(marcus.id, {
    medicationName: 'Gabapentin',
    dosage: '300 mg',
    schedule: 'Evening as prescribed'
  });

  await upsertMedication(naomi.id, {
    medicationName: 'Sertraline',
    dosage: '50 mg',
    schedule: 'Each morning'
  });

  await upsertAppointment(organization.id, marcus.id, {
    type: 'Case management follow-up',
    status: 'scheduled',
    startsAt: atUtcHour(startOfUtcDay(0), 16, 0),
    endsAt: atUtcHour(startOfUtcDay(0), 16, 30)
  });

  await upsertAppointment(organization.id, naomi.id, {
    type: 'Therapy re-engagement visit',
    status: 'scheduled',
    startsAt: atUtcHour(startOfUtcDay(1), 13, 0),
    endsAt: atUtcHour(startOfUtcDay(1), 13, 45)
  });

  await upsertClinicalNote(tenant.id, organization.id, consumer.id, clinicalUser.id, {
    noteType: 'progress',
    title: 'Morning structure is helping',
    body: 'Ava is using the morning check-in consistently and responds well to concrete recovery steps. Focus remains on maintaining routine during family stress.',
    flaggedForFollowUp: false
  });

  await upsertClinicalNote(tenant.id, organization.id, marcus.id, clinicalUser.id, {
    noteType: 'follow_up',
    title: 'High-risk evening follow-up',
    body: 'Marcus reported high cravings after work and asked for follow-up. Plan is same-day outreach plus sponsor coordination before the next shift ends.',
    flaggedForFollowUp: true
  });

  await upsertClinicalNote(tenant.id, organization.id, naomi.id, clinicalUser.id, {
    noteType: 'engagement',
    title: 'Re-engagement support plan',
    body: 'Naomi is showing avoidant patterns after missed calls and low energy days. Keep communication concrete, low-friction, and focused on the next appointment.',
    flaggedForFollowUp: true
  });

  const avaLatestCheckIn = avaCheckIns.find((item) => item.checkInDate.getTime() === startOfUtcDay(0).getTime());
  const marcusLatestCheckIn = marcusCheckIns.find((item) => item.checkInDate.getTime() === startOfUtcDay(-1).getTime());
  const naomiLatestCheckIn = naomiCheckIns.find((item) => item.checkInDate.getTime() === startOfUtcDay(-1).getTime());

  if (avaLatestCheckIn) {
    await upsertCheckInReview(tenant.id, organization.id, consumer.id, clinicalUser.id, avaLatestCheckIn.id, {
      status: 'reviewed',
      followUpStatus: 'not_needed',
      reviewNote: 'Consumer stabilized well after morning anxiety. No extra outreach needed today.',
      riskFlagged: false,
      reviewedAt: new Date(),
      outreachCompletedAt: null
    });
  }

  if (marcusLatestCheckIn) {
    await upsertCheckInReview(tenant.id, organization.id, marcus.id, clinicalUser.id, marcusLatestCheckIn.id, {
      status: 'needs_follow_up',
      followUpStatus: 'planned',
      reviewNote: 'Same-day follow-up scheduled before the evening commute. Monitor cravings after shift.',
      riskFlagged: true,
      reviewedAt: new Date(),
      outreachCompletedAt: null
    });
  }

  if (naomiLatestCheckIn) {
    await upsertCheckInReview(tenant.id, organization.id, naomi.id, clinicalUser.id, naomiLatestCheckIn.id, {
      status: 'pending',
      followUpStatus: 'needed',
      reviewNote: 'Needs call back and appointment reminder. Keep next step small and concrete.',
      riskFlagged: true,
      reviewedAt: null,
      outreachCompletedAt: null
    });
  }

  const blueHarborPayer = await upsertPayer(tenant.id, 'Blue Harbor Health');
  const blueHarborPlan = await upsertInsurancePlan(blueHarborPayer.id, 'Blue Harbor Recovery PPO');
  const communityWellPayer = await upsertPayer(tenant.id, 'CommunityWell Medicaid');
  const communityWellPlan = await upsertInsurancePlan(communityWellPayer.id, 'CommunityWell Behavioral Plus');
  const sunrisePayer = await upsertPayer(tenant.id, 'Sunrise Commercial');
  const sunrisePlan = await upsertInsurancePlan(sunrisePayer.id, 'Sunrise Essentials HMO');

  const avaCoverage = await upsertCoverage(consumer.id, blueHarborPlan.id, {
    memberId: 'BH-1002458',
    groupNumber: 'GRP-CLARITY-01',
    isActive: true
  });

  const marcusCoverage = await upsertCoverage(marcus.id, communityWellPlan.id, {
    memberId: 'CW-4008123',
    groupNumber: 'CW-RECOVERY-44',
    isActive: true
  });

  const naomiCoverage = await upsertCoverage(naomi.id, sunrisePlan.id, {
    memberId: 'SR-8834102',
    groupNumber: 'SUN-IOP-22',
    isActive: true
  });

  await upsertAuthorization(avaCoverage.id, {
    serviceType: 'Individual therapy',
    authorizedUnits: 12,
    startDate: startOfUtcDay(-20),
    endDate: startOfUtcDay(45)
  });

  await upsertAuthorization(marcusCoverage.id, {
    serviceType: 'Case management',
    authorizedUnits: 8,
    startDate: startOfUtcDay(-14),
    endDate: startOfUtcDay(21)
  });

  await upsertAuthorization(naomiCoverage.id, {
    serviceType: 'Therapy re-engagement',
    authorizedUnits: 6,
    startDate: startOfUtcDay(-7),
    endDate: startOfUtcDay(14)
  });

  const avaPaidEncounter = await upsertEncounter(organization.id, consumer.id, {
    serviceCode: 'THERAPY-0301',
    status: 'documentation_complete'
  });
  await upsertCharge(avaPaidEncounter.id, {
    cptCode: '90837',
    amountCents: 18500
  });
  const avaPaidClaim = await upsertClaim(avaPaidEncounter.id, {
    status: 'paid',
    billedCents: 18500,
    paidCents: 16500,
    denialReason: null
  });
  await upsertRemittance(avaPaidClaim.id, {
    amountCents: 16500,
    receivedAt: atUtcHour(startOfUtcDay(-6), 14, 0)
  });

  const avaReadyEncounter = await upsertEncounter(organization.id, consumer.id, {
    serviceCode: 'PEER-0308',
    status: 'documentation_complete'
  });
  await upsertCharge(avaReadyEncounter.id, {
    cptCode: 'H0038',
    amountCents: 9600
  });

  const marcusDeniedEncounter = await upsertEncounter(organization.id, marcus.id, {
    serviceCode: 'CASE-0312',
    status: 'documentation_signed'
  });
  await upsertCharge(marcusDeniedEncounter.id, {
    cptCode: 'T1016',
    amountCents: 14200
  });
  const marcusDeniedClaim = await upsertClaim(marcusDeniedEncounter.id, {
    status: 'denied',
    billedCents: 14200,
    paidCents: 0,
    denialReason: 'Missing modifier on case-management service.'
  });
  await upsertDenial(marcusDeniedClaim.id, {
    code: 'CO-16',
    reason: 'Missing claim information or modifier.',
    resolved: false
  });

  const naomiSubmittedEncounter = await upsertEncounter(organization.id, naomi.id, {
    serviceCode: 'THERAPY-0315',
    status: 'documentation_complete'
  });
  await upsertCharge(naomiSubmittedEncounter.id, {
    cptCode: '90834',
    amountCents: 15200
  });
  const naomiSubmittedClaim = await upsertClaim(naomiSubmittedEncounter.id, {
    status: 'submitted',
    billedCents: 15200,
    paidCents: null,
    denialReason: null
  });

  const naomiCorrectionEncounter = await upsertEncounter(organization.id, naomi.id, {
    serviceCode: 'IOP-0318',
    status: 'documentation_pending_signature'
  });
  await upsertCharge(naomiCorrectionEncounter.id, {
    cptCode: 'H0015',
    amountCents: 11800
  });

  await upsertInvoice(consumer.id, {
    status: 'open',
    totalCents: 2600,
    dueDate: startOfUtcDay(12)
  });
  await upsertInvoice(marcus.id, {
    status: 'open',
    totalCents: 4300,
    dueDate: startOfUtcDay(8)
  });
  await upsertInvoice(naomi.id, {
    status: 'open',
    totalCents: 3700,
    dueDate: startOfUtcDay(15)
  });

  await upsertLedgerEntry(consumer.id, {
    type: 'payment',
    amountCents: -2600,
    occurredAt: atUtcHour(startOfUtcDay(-3), 16, 20)
  });
  await upsertLedgerEntry(marcus.id, {
    type: 'balance_due',
    amountCents: 4300,
    occurredAt: atUtcHour(startOfUtcDay(-1), 10, 5)
  });
  await upsertLedgerEntry(naomi.id, {
    type: 'balance_due',
    amountCents: 3700,
    occurredAt: atUtcHour(startOfUtcDay(-1), 9, 45)
  });

  const avaReadyWorkItem = await upsertBillingWorkItem(tenant.id, organization.id, consumer.id, billingUser.id, {
    coverageId: avaCoverage.id,
    encounterId: avaReadyEncounter.id,
    claimId: null,
    title: 'Review peer coaching claim for submission',
    status: 'ready_for_review',
    priority: 'normal',
    payerName: blueHarborPayer.name,
    issueSummary: 'Documentation is complete and coding is ready for final billing review.',
    nextAction: 'Confirm payer rules for peer recovery coaching and submit the claim.',
    amountCents: 9600,
    serviceDate: startOfUtcDay(-2),
    submittedAt: null
  });

  const avaPaidWorkItem = await upsertBillingWorkItem(tenant.id, organization.id, consumer.id, billingUser.id, {
    coverageId: avaCoverage.id,
    encounterId: avaPaidEncounter.id,
    claimId: avaPaidClaim.id,
    title: 'Post payment reconciliation for therapy visit',
    status: 'paid',
    priority: 'low',
    payerName: blueHarborPayer.name,
    issueSummary: 'Remittance received and posted. Small consumer responsibility already settled.',
    nextAction: 'Archive after confirming the ledger remains balanced.',
    amountCents: 18500,
    serviceDate: startOfUtcDay(-7),
    submittedAt: atUtcHour(startOfUtcDay(-8), 13, 10)
  });

  const marcusDeniedWorkItem = await upsertBillingWorkItem(tenant.id, organization.id, marcus.id, billingUser.id, {
    coverageId: marcusCoverage.id,
    encounterId: marcusDeniedEncounter.id,
    claimId: marcusDeniedClaim.id,
    title: 'Correct denied case management claim',
    status: 'denied',
    priority: 'high',
    payerName: communityWellPayer.name,
    issueSummary: 'Payer denied the claim for a missing modifier and wants corrected resubmission.',
    nextAction: 'Update modifier, confirm notes support the service, and resubmit within 48 hours.',
    amountCents: 14200,
    serviceDate: startOfUtcDay(-1),
    submittedAt: atUtcHour(startOfUtcDay(-1), 12, 35)
  });

  const naomiFollowUpWorkItem = await upsertBillingWorkItem(tenant.id, organization.id, naomi.id, billingUser.id, {
    coverageId: naomiCoverage.id,
    encounterId: naomiSubmittedEncounter.id,
    claimId: naomiSubmittedClaim.id,
    title: 'Follow up on submitted therapy claim',
    status: 'follow_up_needed',
    priority: 'high',
    payerName: sunrisePayer.name,
    issueSummary: 'Claim is still pending after submission and needs payer follow-up before aging further.',
    nextAction: 'Call payer to confirm receipt and expected adjudication timeline.',
    amountCents: 15200,
    serviceDate: startOfUtcDay(-1),
    submittedAt: atUtcHour(startOfUtcDay(-1), 9, 5)
  });

  const naomiCorrectionWorkItem = await upsertBillingWorkItem(tenant.id, organization.id, naomi.id, billingUser.id, {
    coverageId: naomiCoverage.id,
    encounterId: naomiCorrectionEncounter.id,
    claimId: null,
    title: 'Resolve missing signature before billing',
    status: 'needs_correction',
    priority: 'normal',
    payerName: sunrisePayer.name,
    issueSummary: 'Encounter is missing final signature, so the charge is not ready to bill.',
    nextAction: 'Coordinate with clinical staff to complete the signature and move to ready for review.',
    amountCents: 11800,
    serviceDate: startOfUtcDay(0),
    submittedAt: null
  });

  await upsertBillingNote(tenant.id, organization.id, consumer.id, billingUser.id, {
    workItemId: null,
    noteType: 'account_summary',
    body: 'Ava has active commercial coverage and a small open balance, but overall billing readiness is strong.'
  });
  await upsertBillingNote(tenant.id, organization.id, consumer.id, billingUser.id, {
    workItemId: avaReadyWorkItem.id,
    noteType: 'submission_plan',
    body: 'Submit after confirming peer support coding guidance; no documentation gap remains.'
  });
  await upsertBillingNote(tenant.id, organization.id, consumer.id, billingUser.id, {
    workItemId: avaPaidWorkItem.id,
    noteType: 'payment_posting',
    body: 'Remittance posted and the small member balance was cleared through the portal.'
  });

  await upsertBillingNote(tenant.id, organization.id, marcus.id, billingUser.id, {
    workItemId: null,
    noteType: 'risk_note',
    body: 'Marcus is financially straightforward but needs fast denial turnaround to avoid payer filing delays.'
  });
  await upsertBillingNote(tenant.id, organization.id, marcus.id, billingUser.id, {
    workItemId: marcusDeniedWorkItem.id,
    noteType: 'denial_note',
    body: 'Modifier correction is likely sufficient. Keep payer reference number once the corrected claim is sent.'
  });

  await upsertBillingNote(tenant.id, organization.id, naomi.id, billingUser.id, {
    workItemId: null,
    noteType: 'coverage_watch',
    body: 'Sunrise plan is active, but the account needs tighter follow-up because documentation and claim timing have both slipped.'
  });
  await upsertBillingNote(tenant.id, organization.id, naomi.id, billingUser.id, {
    workItemId: naomiFollowUpWorkItem.id,
    noteType: 'payer_follow_up',
    body: 'If payer cannot confirm receipt, escalate to claim trace and verify clearinghouse acceptance.'
  });
  await upsertBillingNote(tenant.id, organization.id, naomi.id, billingUser.id, {
    workItemId: naomiCorrectionWorkItem.id,
    noteType: 'documentation_gap',
    body: 'Clinical signature still missing on the IOP note. Billing should recheck after the re-engagement visit.'
  });

  await upsertBillingActivity(avaReadyWorkItem.id, billingUser.id, {
    action: 'created',
    fromStatus: null,
    toStatus: 'ready_for_review',
    detail: 'Peer coaching work item opened for final review.',
    createdAt: atUtcHour(startOfUtcDay(-2), 15, 20)
  });
  await upsertBillingActivity(avaReadyWorkItem.id, billingUser.id, {
    action: 'review_ready',
    fromStatus: 'draft',
    toStatus: 'ready_for_review',
    detail: 'Documentation confirmed complete and ready for billing review.',
    createdAt: atUtcHour(startOfUtcDay(-1), 11, 5)
  });
  await upsertBillingActivity(avaPaidWorkItem.id, billingUser.id, {
    action: 'payment_posted',
    fromStatus: 'submitted',
    toStatus: 'paid',
    detail: 'Payment posted from Blue Harbor remittance.',
    createdAt: atUtcHour(startOfUtcDay(-6), 16, 0)
  });
  await upsertBillingActivity(marcusDeniedWorkItem.id, billingUser.id, {
    action: 'created',
    fromStatus: null,
    toStatus: 'denied',
    detail: 'Denied claim added to the billing work queue.',
    createdAt: atUtcHour(startOfUtcDay(-1), 12, 40)
  });
  await upsertBillingActivity(marcusDeniedWorkItem.id, billingUser.id, {
    action: 'status_changed',
    fromStatus: 'submitted',
    toStatus: 'denied',
    detail: 'CommunityWell denied the case-management claim for missing modifier information.',
    createdAt: atUtcHour(startOfUtcDay(-1), 13, 10)
  });
  await upsertBillingActivity(naomiFollowUpWorkItem.id, billingUser.id, {
    action: 'created',
    fromStatus: null,
    toStatus: 'follow_up_needed',
    detail: 'Submitted therapy claim is aging and now requires payer outreach.',
    createdAt: atUtcHour(startOfUtcDay(-1), 10, 15)
  });
  await upsertBillingActivity(naomiCorrectionWorkItem.id, billingUser.id, {
    action: 'status_changed',
    fromStatus: 'draft',
    toStatus: 'needs_correction',
    detail: 'Encounter cannot be billed until the clinical note is signed.',
    createdAt: atUtcHour(startOfUtcDay(0), 8, 45)
  });

  await upsertAuditLog(
    tenant.id,
    platformAdminUser.id,
    'admin.user.created',
    'user',
    orgAdminUser.id,
    {
      email: 'beta-org-admin@claritybridgehealth.com',
      role: 'org_admin',
      seeded: true
    },
    atUtcHour(startOfUtcDay(-2), 14, 15)
  );

  await upsertAuditLog(
    tenant.id,
    orgAdminUser.id,
    'admin.organization.updated',
    'organization',
    organization.id,
    {
      name: organization.name,
      seeded: true
    },
    atUtcHour(startOfUtcDay(-1), 11, 20)
  );

  await upsertAuditLog(
    tenant.id,
    platformAdminUser.id,
    'admin.user.temporary_password_set',
    'user',
    clinicalUser.id,
    {
      seeded: true,
      mustChangePassword: false
    },
    atUtcHour(startOfUtcDay(0), 8, 10)
  );

  console.log(JSON.stringify({
    seeded: true,
    tenantId: tenant.id,
    organizationId: organization.id,
    adminUserId: upsertedUsers[0]?.id ?? null,
    clinicalUserId: clinicalUser.id,
    consumerExperience: {
      consumerId: consumer.id,
      goalsSeeded: 3,
      routinesSeeded: 3,
      checkInsSeeded: checkInSeeds.length,
      journalEntriesSeeded: journalSeeds.length
    },
    clinicalExperience: {
      caseloadConsumers: 3,
      noteExamples: 3,
      reviewItemsSeeded: 3,
      followUpQueueConsumers: 2
    },
    adminExperience: {
      usersSeeded: seededUsers.length,
      orgAdminsSeeded: seededUsers.filter((user) => user.role === 'org_admin').length,
      inactiveUsersSeeded: seededUsers.filter((user) => !user.isActive).length,
      auditEventsSeeded: 3
    },
    billingExperience: {
      accountsSeeded: 3,
      workItemsSeeded: 5,
      deniedItemsSeeded: 1,
      followUpItemsSeeded: 1,
      needsCorrectionItemsSeeded: 1,
      notesSeeded: 8
    },
    sampleAccounts: seededUsers.map((user) => ({
      email: user.email,
      role: user.role
    }))
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
