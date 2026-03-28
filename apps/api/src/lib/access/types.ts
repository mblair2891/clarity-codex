import type { OrganizationRole, PlatformRole, Role } from '@prisma/client';

export interface SessionJwtPayload {
  sub: string;
  sid?: string;
  type?: 'USER' | 'SUPPORT';
  platformRoles?: PlatformRole[];
  activeOrganizationId?: string | null;
  activeMembershipId?: string | null;
  activeLocationId?: string | null;
  supportMode?: boolean;
  supportAccessSessionId?: string | null;
}

export interface AccessContext {
  type: 'USER' | 'SUPPORT';
  userId: string;
  sessionId: string | null;
  tenantId: string;
  legacyRole: string;
  platformRoles: PlatformRole[];
  organizationRole: OrganizationRole | null;
  activeOrganizationId: string | null;
  activeMembershipId: string | null;
  activeLocationId: string | null;
  supportMode: boolean;
  supportAccessSessionId: string | null;
  consumerId: string | null;
  permissions: string[];
}

export function deriveLegacyPlatformRoles(role: Role | string): PlatformRole[] {
  if (role === 'platform_admin') {
    return ['platform_admin'];
  }

  if (role === 'support') {
    return ['support'];
  }

  return [];
}
