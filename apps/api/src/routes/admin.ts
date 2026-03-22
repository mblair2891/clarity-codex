import type { Role } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { adminAccessRoles, canAssignRole, supportedBetaRoles } from '../lib/roles.js';
import { hashPassword } from '../lib/password.js';

const createUserSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(supportedBetaRoles),
  password: z.string().min(8),
  mustChangePassword: z.boolean().optional().default(false)
});

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const [firstName, ...lastNameParts] = normalized.split(' ');

  return {
    firstName: firstName || 'Beta',
    lastName: lastNameParts.join(' ') || 'User'
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/v1/admin/dashboard', async (request) => {
    await app.verifyTenantRole(request, adminAccessRoles);

    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const isPlatformAdmin = auth.role === 'platform_admin';
    const organizationScope = isPlatformAdmin ? undefined : auth.organizationIds;

    const [currentUser, tenant, organizations, consumers, users, tenants, staffCount, consumerCount] =
      await prisma.$transaction([
        prisma.user.findUnique({
          where: { id: auth.userId },
          include: {
            memberships: {
              include: {
                organization: true
              },
              orderBy: { id: 'asc' },
              take: 1
            }
          }
        }),
        prisma.tenant.findUnique({
          where: { id: auth.tenantId }
        }),
        prisma.organization.findMany({
          where: isPlatformAdmin ? {} : { id: { in: organizationScope } },
          orderBy: [
            { tenantId: 'asc' },
            { createdAt: 'asc' }
          ],
          include: {
            tenant: true
          }
        }),
        prisma.consumer.findMany({
          where: isPlatformAdmin
            ? {}
            : {
                tenantId: auth.tenantId,
                organizationId: {
                  in: organizationScope
                }
              },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            traumaMode: true,
            cognitiveAssistMode: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
        prisma.user.findMany({
          where: isPlatformAdmin
            ? {}
            : {
                tenantId: auth.tenantId,
                memberships: {
                  some: {
                    organizationId: {
                      in: organizationScope
                    }
                  }
                }
              },
          orderBy: [
            { tenantId: 'asc' },
            { createdAt: 'asc' }
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
        prisma.user.count({
          where: isPlatformAdmin ? {} : { tenantId: auth.tenantId }
        }),
        prisma.consumer.count({
          where: isPlatformAdmin ? {} : { tenantId: auth.tenantId }
        })
      ]);

    if (!tenant || !currentUser) {
      const error = new Error('Beta dashboard data is incomplete.') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

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
      primaryOrganization: currentUser.memberships[0]?.organization
        ? {
            id: currentUser.memberships[0].organization.id,
            name: currentUser.memberships[0].organization.name,
            npi: currentUser.memberships[0].organization.npi
          }
        : null,
      counts: {
        organizations: organizations.length,
        staff: staffCount,
        consumers: consumerCount
      },
      organizations: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        npi: organization.npi,
        tenantId: organization.tenantId,
        tenantName: organization.tenant.name,
        createdAt: organization.createdAt
      })),
      consumers,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
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
      manageableTenants: tenants.map((managedTenant) => ({
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

  app.post('/v1/admin/users', async (request, reply) => {
    await app.verifyTenantRole(request, adminAccessRoles);

    const auth = request.auth;
    if (!auth) {
      const error = new Error('Authentication required.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

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

    const organization = payload.organizationId
      ? await prisma.organization.findUnique({
          where: { id: payload.organizationId }
        })
      : null;

    if (payload.organizationId && (!organization || organization.tenantId !== tenant.id)) {
      return reply.code(404).send({ message: 'Organization was not found in the selected tenant.' });
    }

    if (actorRole !== 'platform_admin' && organization && !auth.organizationIds.includes(organization.id)) {
      return reply.code(403).send({ message: 'Org admins can only create users inside their assigned organization.' });
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

      return user;
    });

    return reply.code(201).send({
      created: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
        role: createdUser.role,
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
}
