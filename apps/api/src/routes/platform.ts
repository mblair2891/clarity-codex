import type { FastifyInstance } from 'fastify';
import { permissions } from '../lib/access/permissions.js';
import { requireRequestAccess, requireRoutePermission } from '../lib/access/route-permissions.js';
import { prisma } from '../lib/db.js';

export async function platformRoutes(app: FastifyInstance) {
  app.get('/v1/platform/dashboard', async (request) => {
    await app.authenticateRequest(request);
    const access = requireRoutePermission(request, permissions.platformOrganizationsRead);
    const requestAccess = requireRequestAccess(request);

    const [tenant, organizations, usersCount, consumersCount, activeSupportSessions] = await prisma.$transaction([
      prisma.tenant.findUnique({
        where: { id: access.tenantId }
      }),
      prisma.organization.findMany({
        where: {
          tenantId: access.tenantId
        },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  role: true,
                  isActive: true
                }
              }
            }
          },
          consumers: {
            select: {
              id: true
            }
          },
          locations: {
            orderBy: {
              createdAt: 'asc'
            }
          },
          _count: {
            select: {
              locations: true
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          tenantId: access.tenantId
        }
      }),
      prisma.consumer.count({
        where: {
          tenantId: access.tenantId
        }
      }),
      prisma.supportAccessSession.findMany({
        where: {
          endedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: new Date()
          }
        },
        select: {
          id: true,
          organizationId: true,
          supportUserId: true
        }
      })
    ]);

    const activeSupportSessionsByOrganization = activeSupportSessions.reduce<Record<string, number>>((accumulator, session) => {
      accumulator[session.organizationId] = (accumulator[session.organizationId] ?? 0) + 1;
      return accumulator;
    }, {});
    const activeSupportSessionsCount = activeSupportSessions.filter((session) => session.supportUserId === requestAccess.userId).length;

    return {
      tenant: tenant
        ? {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name
          }
        : {
            id: access.tenantId,
            slug: 'unknown',
            name: 'Unknown tenant'
          },
      counts: {
        organizations: organizations.length,
        users: usersCount,
        consumers: consumersCount,
        activeSupportSessions: activeSupportSessionsCount
      },
      organizations: organizations.map((organization) => {
        const activeUsers = organization.memberships.filter((membership) => membership.user.isActive);
        const adminCount = activeUsers.filter((membership) => membership.user.role === 'org_admin').length;

        return {
          id: organization.id,
          name: organization.name,
          identifier: organization.id,
          npi: organization.npi,
          createdAt: organization.createdAt.toISOString(),
          counts: {
            users: activeUsers.length,
            consumers: organization.consumers.length,
            admins: adminCount,
            activeSupportSessions: activeSupportSessionsByOrganization[organization.id] ?? 0,
            locations: organization._count.locations
          },
          locations: organization.locations.map((location) => ({
            id: location.id,
            name: location.name,
            timezone: location.timezone,
            isActive: location.isActive
          }))
        };
      })
    };
  });
}
