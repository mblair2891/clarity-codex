import type { PlatformRole, Role } from '@prisma/client';

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

export function getLandingPathForAccess(args: {
  role: Role;
  platformRoles?: PlatformRole[];
  activeOrganizationId?: string | null;
  supportMode?: boolean;
}) {
  const hasPlatformAuthority = (args.platformRoles?.length ?? 0) > 0;

  if (hasPlatformAuthority && !args.supportMode && !args.activeOrganizationId) {
    return '/platform';
  }

  if (args.role === 'org_admin' || (args.role === 'platform_admin' && args.activeOrganizationId)) {
    return '/admin';
  }

  if (args.role === 'support' && args.activeOrganizationId) {
    return '/clinical';
  }

  return getLandingPath(args.role);
}
