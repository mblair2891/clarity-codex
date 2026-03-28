import type { OrganizationRole, PlatformRole, Role } from '@prisma/client';
import type { AccessContext } from './types.js';

export const permissions = {
  platformOrganizationsRead: 'platform.organizations.read',
  platformOrganizationsManage: 'platform.organizations.manage',
  platformAuditRead: 'platform.audit.read',
  platformSupportAccess: 'platform.support.access',
  aiAssistUse: 'ai.assist.use',
  orgUsersRead: 'org.users.read',
  orgUsersManage: 'org.users.manage',
  orgSettingsManage: 'org.settings.manage',
  clinicalConsumersRead: 'clinical.consumers.read',
  clinicalNotesRead: 'clinical.notes.read',
  clinicalNotesWrite: 'clinical.notes.write',
  clinicalPlansWrite: 'clinical.plans.write',
  clinicalCheckInsRead: 'clinical.check_ins.read',
  clinicalCheckInsReview: 'clinical.check_ins.review',
  billingClaimsRead: 'billing.claims.read',
  billingClaimsSubmit: 'billing.claims.submit',
  billingWorkItemsRead: 'billing.work_items.read',
  billingWorkItemsWrite: 'billing.work_items.write',
  consumerProfileReadSelf: 'consumer.profile.read.self',
  consumerProfileWriteSelf: 'consumer.profile.write.self',
  consumerCheckInsWriteSelf: 'consumer.check_ins.write.self',
  consumerJournalWriteSelf: 'consumer.journal.write.self',
  consumerRoutinesWriteSelf: 'consumer.routines.write.self'
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  platform_admin: [
    permissions.platformOrganizationsRead,
    permissions.platformOrganizationsManage,
    permissions.platformAuditRead,
    permissions.platformSupportAccess,
    permissions.aiAssistUse,
    permissions.orgUsersRead,
    permissions.orgUsersManage,
    permissions.orgSettingsManage,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalNotesWrite,
    permissions.clinicalPlansWrite,
    permissions.clinicalCheckInsRead,
    permissions.clinicalCheckInsReview,
    permissions.billingClaimsRead,
    permissions.billingClaimsSubmit,
    permissions.billingWorkItemsRead,
    permissions.billingWorkItemsWrite
  ],
  support: [
    permissions.platformOrganizationsRead,
    permissions.platformSupportAccess,
    permissions.aiAssistUse,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalCheckInsRead,
    permissions.billingClaimsRead,
    permissions.billingWorkItemsRead
  ]
};

export const ORG_ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  org_admin: [
    permissions.orgUsersRead,
    permissions.orgUsersManage,
    permissions.orgSettingsManage,
    permissions.aiAssistUse,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalNotesWrite,
    permissions.clinicalPlansWrite,
    permissions.clinicalCheckInsRead,
    permissions.clinicalCheckInsReview,
    permissions.billingClaimsRead,
    permissions.billingClaimsSubmit,
    permissions.billingWorkItemsRead,
    permissions.billingWorkItemsWrite
  ],
  clinical_staff: [
    permissions.aiAssistUse,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalNotesWrite,
    permissions.clinicalPlansWrite,
    permissions.clinicalCheckInsRead,
    permissions.clinicalCheckInsReview
  ],
  clinician: [
    permissions.aiAssistUse,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalNotesWrite,
    permissions.clinicalPlansWrite,
    permissions.clinicalCheckInsRead,
    permissions.clinicalCheckInsReview
  ],
  case_manager: [
    permissions.aiAssistUse,
    permissions.clinicalConsumersRead,
    permissions.clinicalNotesRead,
    permissions.clinicalNotesWrite,
    permissions.clinicalPlansWrite,
    permissions.clinicalCheckInsRead,
    permissions.clinicalCheckInsReview
  ],
  billing: [
    permissions.aiAssistUse,
    permissions.billingClaimsRead,
    permissions.billingClaimsSubmit,
    permissions.billingWorkItemsRead,
    permissions.billingWorkItemsWrite
  ],
  consumer: [
    permissions.aiAssistUse,
    permissions.consumerProfileReadSelf,
    permissions.consumerProfileWriteSelf,
    permissions.consumerCheckInsWriteSelf,
    permissions.consumerJournalWriteSelf,
    permissions.consumerRoutinesWriteSelf
  ]
};

function deriveLegacyOrganizationRole(role: Role | string): OrganizationRole | null {
  if (
    role === 'org_admin'
    || role === 'clinical_staff'
    || role === 'clinician'
    || role === 'case_manager'
    || role === 'billing'
    || role === 'consumer'
  ) {
    return role;
  }

  return null;
}

export function resolvePermissions(access: Pick<AccessContext, 'platformRoles' | 'organizationRole' | 'legacyRole'>): Permission[] {
  const resolved = new Set<Permission>();
  const organizationRole = access.organizationRole ?? deriveLegacyOrganizationRole(access.legacyRole);

  for (const role of access.platformRoles) {
    for (const permission of PLATFORM_ROLE_PERMISSIONS[role] ?? []) {
      resolved.add(permission);
    }
  }

  if (organizationRole) {
    for (const permission of ORG_ROLE_PERMISSIONS[organizationRole] ?? []) {
      resolved.add(permission);
    }
  }

  return [...resolved].sort();
}

export function hasPermission(access: Pick<AccessContext, 'permissions'>, permission: Permission) {
  return access.permissions.includes(permission);
}

export function requirePermission(access: Pick<AccessContext, 'permissions'>, permission: Permission) {
  if (!hasPermission(access, permission)) {
    const error = new Error(`Missing required permission: ${permission}.`) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}
