import type { FastifyRequest } from 'fastify';
import { hasPermission, type Permission } from './permissions.js';
import type { AccessContext } from './types.js';

interface RoutePermissionOptions {
  message?: string;
}

export function requireRequestAccess(request: FastifyRequest): AccessContext {
  const access = request.access;

  if (!access) {
    const error = new Error('Authentication context was not established.') as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  return access;
}
export function requireRoutePermission(
  request: FastifyRequest,
  permission: Permission,
  options: RoutePermissionOptions = {}
) {
  const access = requireRequestAccess(request);

  if (hasPermission(access, permission)) {
    return access;
  }

  const error = new Error(options.message ?? `Missing required permission: ${permission}.`) as Error & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}

export function requireAnyRoutePermission(
  request: FastifyRequest,
  requiredPermissions: readonly Permission[],
  options: RoutePermissionOptions = {}
) {
  const access = requireRequestAccess(request);

  if (requiredPermissions.some((permission) => hasPermission(access, permission))) {
    return access;
  }

  const error = new Error(
    options.message ?? `Missing one of the required permissions: ${requiredPermissions.join(', ')}.`
  ) as Error & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}

export function requireSelfPermission(
  request: FastifyRequest,
  permission: Permission,
  options: RoutePermissionOptions = {}
) {
  return requireRoutePermission(request, permission, options);
}
