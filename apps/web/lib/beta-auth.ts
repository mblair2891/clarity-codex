'use client';

import type { AppRole } from '@clarity/domain';
import { resolveApiBaseUrl } from './api-base-url';

export const tokenStorageKey = 'clarity.beta.token';

export class ApiResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type AuthMeResponse = {
  landingPath: string;
  user: SessionUser;
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    npi: string | null;
  } | null;
};

export type LoginResponse = AuthMeResponse & {
  token: string;
};

export type ResetSystemResponse = {
  reset: true;
  environment: string;
  preserved: {
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
    records: {
      tenants: number;
      users: number;
    };
  };
  deleted: Record<string, number>;
  remaining: Record<string, number>;
};

export function getApiBaseUrlState() {
  const apiBaseUrl = resolveApiBaseUrl();

  return {
    apiBaseUrl,
    error: apiBaseUrl
      ? null
      : 'Beta access is unavailable from this hostname. Open the beta app URL directly.'
  };
}

export function storeToken(token: string) {
  window.localStorage.setItem(tokenStorageKey, token);
}

export function getStoredToken() {
  return window.localStorage.getItem(tokenStorageKey);
}

export function clearStoredToken() {
  window.localStorage.removeItem(tokenStorageKey);
}

export async function apiFetch<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiResponseError(payload?.message ?? `Request failed for ${path}.`, response.status);
  }

  return response.json();
}

export async function fetchMe(apiBaseUrl: string, token: string) {
  return apiFetch<AuthMeResponse>(apiBaseUrl, '/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function loginWithPassword(apiBaseUrl: string, email: string, password: string, tenantSlug = 'beta-demo') {
  return apiFetch<LoginResponse>(apiBaseUrl, '/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      tenantSlug
    })
  });
}

export async function loginWithBetaAccessCode(apiBaseUrl: string, email: string, accessCode: string, tenantSlug = 'beta-demo') {
  return apiFetch<LoginResponse>(apiBaseUrl, '/v1/auth/beta-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      accessCode,
      tenantSlug
    })
  });
}

export async function resetSystemData(apiBaseUrl: string, token: string, confirmationText: string) {
  return apiFetch<ResetSystemResponse>(apiBaseUrl, '/v1/admin/reset-system', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      confirmationText
    })
  });
}

export function getLandingPathForRole(role: AppRole) {
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

export function getDisplayRoleForShell(role: AppRole): AppRole {
  if (role === 'clinician' || role === 'case_manager') {
    return 'clinical_staff';
  }

  return role;
}
