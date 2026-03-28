import type { PlatformRole } from '@prisma/client';
import type { AccessContext } from './types.js';

export interface OrgScopeOptions {
  organizationField?: string;
  locationField?: string;
}

export function hasPlatformRole(access: Pick<AccessContext, 'platformRoles'>, role: PlatformRole) {
  return access.platformRoles.includes(role);
}

export function isPlatformOperator(access: Pick<AccessContext, 'platformRoles'>) {
  return hasPlatformRole(access, 'platform_admin') || hasPlatformRole(access, 'support');
}

export function requireSupportSession(
  access: Pick<AccessContext, 'platformRoles' | 'activeOrganizationId' | 'supportMode' | 'supportAccessSessionId'>,
  message = 'Platform access to organization data requires an active support session.'
) {
  if (!isPlatformOperator(access)) {
    return;
  }

  if (access.activeOrganizationId && access.supportMode && access.supportAccessSessionId) {
    return;
  }

  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}

export function requirePlatformRole(access: Pick<AccessContext, 'platformRoles'>, role: PlatformRole) {
  if (!hasPlatformRole(access, role)) {
    const error = new Error(`Platform role ${role} is required for this action.`) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }
}

export function getAccessibleOrganizationIds(
  access: Pick<AccessContext, 'activeOrganizationId' | 'platformRoles' | 'supportMode' | 'supportAccessSessionId'>
) {
  if (access.activeOrganizationId) {
    requireSupportSession(access);
    return [access.activeOrganizationId];
  }

  if (isPlatformOperator(access)) {
    const error = new Error('Platform access to organization data requires an active support session and organization context.') as Error & {
      statusCode?: number;
    };
    error.statusCode = 403;
    throw error;
  }

  const error = new Error('An active organization is required for organization-scoped access.') as Error & {
    statusCode?: number;
  };
  error.statusCode = 400;
  throw error;
}

export function requireActiveOrganization(
  access: Pick<AccessContext, 'activeOrganizationId' | 'platformRoles' | 'supportMode' | 'supportAccessSessionId'>,
  message = 'Select an active organization before continuing.'
) {
  if (access.activeOrganizationId) {
    requireSupportSession(access);
    return access.activeOrganizationId;
  }

  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  throw error;
}

export function requireActiveMembership(
  access: Pick<AccessContext, 'activeMembershipId'>,
  message = 'Select an active organization membership before continuing.'
) {
  if (access.activeMembershipId) {
    return access.activeMembershipId;
  }

  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 400;
  throw error;
}

export function resolveOrganizationIdForWrite(
  access: Pick<AccessContext, 'activeOrganizationId' | 'platformRoles' | 'supportMode' | 'supportAccessSessionId'>,
  recordOrganizationId?: string | null,
  message = 'An active organization is required for this write.'
) {
  return recordOrganizationId ?? requireActiveOrganization(access, message);
}

export function getOrgWhere(
  access: Pick<AccessContext, 'activeOrganizationId' | 'platformRoles' | 'supportMode' | 'supportAccessSessionId'>,
  options: OrgScopeOptions = {}
) {
  const fieldName = options.organizationField ?? 'organizationId';
  const organizationId = requireActiveOrganization(access);

  return {
    [fieldName]: organizationId
  };
}

export function getOrgAndLocationWhere(
  access: Pick<
    AccessContext,
    'activeOrganizationId' | 'platformRoles' | 'activeLocationId' | 'supportMode' | 'supportAccessSessionId'
  >,
  options: OrgScopeOptions = {}
) {
  const organizationWhere = getOrgWhere(access, options);
  const locationField = options.locationField ?? 'locationId';

  if (!access.activeLocationId) {
    return organizationWhere;
  }

  return {
    ...organizationWhere,
    [locationField]: access.activeLocationId
  };
}

export function assertOrganizationAccess(
  access: Pick<AccessContext, 'activeOrganizationId' | 'platformRoles' | 'supportMode' | 'supportAccessSessionId'>,
  organizationId: string | null | undefined,
  message = 'Record does not belong to the active organization.'
) {
  const activeOrganizationId = requireActiveOrganization(access);

  if (!organizationId || organizationId !== activeOrganizationId) {
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = 403;
    throw error;
  }

  return activeOrganizationId;
}
