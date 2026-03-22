import type { Role } from '@prisma/client';

export const supportedBetaRoles = [
  'platform_admin',
  'org_admin',
  'clinical_staff',
  'billing',
  'consumer'
] as const satisfies Role[];

export const clinicalAccessRoles: Role[] = ['clinical_staff', 'clinician', 'case_manager', 'org_admin', 'platform_admin'];
export const consumerAccessRoles: Role[] = ['consumer', 'clinical_staff', 'clinician', 'case_manager', 'platform_admin'];
export const adminAccessRoles: Role[] = ['org_admin', 'platform_admin'];

export function isClinicalRole(role: Role) {
  return role === 'clinical_staff' || role === 'clinician' || role === 'case_manager';
}

export function canAssignRole(actorRole: Role, targetRole: Role) {
  if (actorRole === 'platform_admin') {
    return supportedBetaRoles.includes(targetRole as (typeof supportedBetaRoles)[number]);
  }

  if (actorRole === 'org_admin') {
    return ['org_admin', 'clinical_staff', 'billing', 'consumer'].includes(targetRole);
  }

  return false;
}

export function getLandingPath(role: Role) {
  if (role === 'platform_admin' || role === 'org_admin') {
    return '/admin';
  }

  if (role === 'billing') {
    return '/rcm';
  }

  if (role === 'consumer') {
    return '/consumer';
  }

  return '/clinical';
}
