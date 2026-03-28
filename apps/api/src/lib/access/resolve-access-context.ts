import { prisma } from '../db.js';
import { resolvePermissions } from './permissions.js';
import { deriveLegacyPlatformRoles, type AccessContext, type SessionJwtPayload } from './types.js';

function buildAccessContext(base: Omit<AccessContext, 'permissions'>): AccessContext {
  return {
    ...base,
    permissions: resolvePermissions(base)
  };
}

export function buildLocalAccessContext(): AccessContext {
  return buildAccessContext({
    type: 'USER',
    userId: 'demo_user',
    sessionId: null,
    tenantId: 'tenant_demo',
    legacyRole: 'platform_admin',
    platformRoles: ['platform_admin'],
    organizationRole: null,
    activeOrganizationId: null,
    activeMembershipId: null,
    activeLocationId: null,
    supportMode: false,
    supportAccessSessionId: null,
    consumerId: null
  });
}

export async function resolveAccessContext(decoded: SessionJwtPayload) {
  const session = decoded.sid
    ? await prisma.userSession.findUnique({
        where: { id: decoded.sid }
      })
    : null;

  if (decoded.sid) {
    if (!session || session.userId !== decoded.sub || session.revokedAt || session.expiresAt <= new Date()) {
      const error = new Error('Authenticated session is invalid or expired.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    include: {
      platformRoles: {
        select: {
          role: true
        }
      },
      memberships: {
        select: {
          id: true,
          organizationId: true,
          organizationRole: true
        },
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!user || !user.isActive) {
    const error = new Error('Authenticated user is inactive or missing.') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  const platformRoles = user.platformRoles.length
    ? user.platformRoles.map((platformRole) => platformRole.role)
    : decoded.platformRoles?.length
      ? decoded.platformRoles
      : deriveLegacyPlatformRoles(user.role);
  const sessionSupportMode = session?.supportMode ?? decoded.supportMode ?? false;
  const supportAccessSessionId = session?.supportAccessSessionId ?? decoded.supportAccessSessionId ?? null;
  const requestedMembershipId = session?.activeMembershipId ?? decoded.activeMembershipId ?? null;
  const requestedOrganizationId = session?.activeOrganizationId ?? decoded.activeOrganizationId ?? null;
  const explicitMembership =
    user.memberships.find((membership) => membership.id === requestedMembershipId)
    ?? user.memberships.find((membership) => membership.organizationId === requestedOrganizationId)
    ?? null;
  const activeMembership = explicitMembership;
  const activeOrganizationId =
    session?.activeOrganizationId
    ?? decoded.activeOrganizationId
    ?? activeMembership?.organizationId
    ?? null;
  const activeLocationId = session?.activeLocationId ?? decoded.activeLocationId ?? null;
  const supportAccessSession = supportAccessSessionId
    ? await prisma.supportAccessSession.findUnique({
        where: { id: supportAccessSessionId }
      })
    : null;

  if (sessionSupportMode) {
    if (!platformRoles.includes('platform_admin') && !platformRoles.includes('support')) {
      const error = new Error('Support mode is only available to platform support users.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    if (!supportAccessSession) {
      const error = new Error('Support access session is missing.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    if (
      supportAccessSession.supportUserId !== user.id
      || supportAccessSession.organizationId !== activeOrganizationId
      || supportAccessSession.endedAt
      || supportAccessSession.revokedAt
      || supportAccessSession.expiresAt <= new Date()
      || (supportAccessSession.locationId && supportAccessSession.locationId !== activeLocationId)
    ) {
      const error = new Error('Support access session is invalid or expired.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  }

  return buildAccessContext({
    type: sessionSupportMode ? 'SUPPORT' : 'USER',
    userId: user.id,
    sessionId: session?.id ?? decoded.sid ?? null,
    tenantId: user.tenantId,
    legacyRole: user.role,
    platformRoles,
    organizationRole: activeMembership?.organizationRole ?? null,
    activeOrganizationId,
    activeMembershipId: activeMembership?.id ?? null,
    activeLocationId,
    supportMode: sessionSupportMode,
    supportAccessSessionId,
    consumerId: user.consumerId ?? null
  });
}
