import type { Role } from '@prisma/client';

export const supportedBetaRoles = [
  'platform_admin',
  'org_admin',
  'clinical_staff',
  'billing',
  'consumer'
] as const satisfies Role[];

export function isClinicalRole(role: Role) {
  return role === 'clinical_staff' || role === 'clinician' || role === 'case_manager';
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
