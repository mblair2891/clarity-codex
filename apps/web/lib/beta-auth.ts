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

export type SessionAccessContext = {
  type: 'USER' | 'SUPPORT';
  platformRoles: string[];
  activeOrganizationId: string | null;
  activeMembershipId: string | null;
  activeLocationId: string | null;
  supportMode: boolean;
  permissions: string[];
};

export type SessionOrganization = {
  id: string;
  name: string;
  npi: string | null;
};

export type SessionLocation = {
  id: string;
  name: string;
  timezone: string | null;
};

export type SessionSupportDetails = {
  id: string;
  reason: string | null;
  ticketReference: string | null;
  startedAt: string;
  expiresAt: string;
};

export type AuthMeResponse = {
  landingPath: string;
  user: SessionUser;
  tenant: {
    id: string;
      slug: string;
      name: string;
    };
  accessContext: SessionAccessContext;
  organization: SessionOrganization | null;
  location: SessionLocation | null;
  supportSession: SessionSupportDetails | null;
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

export type PlatformSubscriptionScaffold = {
  planName: string | null;
  subscriptionStatus: string;
  billingStatus: string;
  billingCustomerId: string | null;
  nextInvoiceDate: string | null;
};

export type PlatformOrganizationSummary = {
  id: string;
  name: string;
  slug: string | null;
  npi: string | null;
  taxId: string | null;
  createdAt: string;
  counts: {
    users: number;
    totalMemberships: number;
    consumers: number;
    orgAdmins: number;
    locations: number;
    activeSupportSessions: number;
    clinicalNotes: number;
    unresolvedReviews: number;
  };
  subscription: PlatformSubscriptionScaffold;
  locations: Array<{
    id: string;
    name: string;
    timezone: string | null;
    isActive: boolean;
  }>;
};

export type PlatformSupportSessionSummary = {
  id: string;
  organizationId: string;
  organizationName?: string;
  supportUserId: string;
  supportUserName: string;
  supportUserEmail: string | null;
  locationId: string | null;
  reason: string | null;
  ticketReference: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  revokedAt: string | null;
  status: string;
};

export type PlatformUserSummary = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: string;
  platformRoles: string[];
  createdAt: string;
};

export type PlatformDashboardResponse = {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  summary: {
    totalOrganizations: number;
    totalPlatformUsers: number;
    totalOrgUsers: number;
    totalConsumers: number;
    activeSupportSessions: number;
    recentSupportSessions: number;
    subscriptionsByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  billing: {
    isConfigured: boolean;
    plans: Array<{
      name: string;
      organizationCount: number;
    }>;
    subscriptionsByStatus: Array<{
      status: string;
      count: number;
    }>;
    note: string;
  };
  organizations: PlatformOrganizationSummary[];
  platformUsers: PlatformUserSummary[];
  support: {
    active: PlatformSupportSessionSummary[];
    recent: PlatformSupportSessionSummary[];
  };
};

export type PlatformOrganizationsResponse = {
  organizations: PlatformOrganizationSummary[];
};

export type PlatformOrganizationDetailResponse = {
  organization: PlatformOrganizationSummary & {
    orgAdmins: Array<{
      id: string;
      fullName: string;
      email: string;
      isActive: boolean;
      role: string;
    }>;
    counts: PlatformOrganizationSummary['counts'] & {
      appointments: number;
      encounters: number;
    };
  };
  support: {
    active: PlatformSupportSessionSummary[];
    recent: PlatformSupportSessionSummary[];
  };
  lifecycle: {
    status: string;
    note: string;
  };
};

export type PlatformSupportSessionsResponse = {
  activeSessions: PlatformSupportSessionSummary[];
  recentSessions: PlatformSupportSessionSummary[];
};

export type PlatformUsersResponse = {
  users: PlatformUserSummary[];
  counts: {
    total: number;
    active: number;
    platformAdmins: number;
    supportUsers: number;
  };
  accessModel: {
    platformAdmin: string;
    platformSupport: string;
  };
};

export type CreatePlatformOrganizationInput = {
  name: string;
  slug: string;
  npi?: string;
  taxId?: string;
};

export type CreatePlatformOrganizationResponse = {
  created: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    npi: string | null;
    taxId: string | null;
    createdAt: string;
    subscription: PlatformSubscriptionScaffold;
  };
};

export type StartSupportSessionInput = {
  organizationId: string;
  locationId?: string;
  reason: string;
  ticketReference?: string;
};

export type StartSupportSessionResponse = {
  token: string;
  supportSession: {
    id: string;
    organizationId: string;
    locationId: string | null;
    reason: string | null;
    ticketReference: string | null;
    supportMode: true;
    expiresAt: string;
  };
};

export type EndSupportSessionResponse = {
  token: string;
  supportSessionEnded: true;
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
  return apiFetch<ResetSystemResponse>(apiBaseUrl, '/v1/platform/system/reset', {
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

export async function fetchPlatformDashboard(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformDashboardResponse>(apiBaseUrl, '/v1/platform/dashboard', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformOrganizations(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformOrganizationsResponse>(apiBaseUrl, '/v1/platform/organizations', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformOrganizationDetail(apiBaseUrl: string, token: string, organizationId: string) {
  return apiFetch<PlatformOrganizationDetailResponse>(apiBaseUrl, `/v1/platform/organizations/${organizationId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function createPlatformOrganization(apiBaseUrl: string, token: string, payload: CreatePlatformOrganizationInput) {
  return apiFetch<CreatePlatformOrganizationResponse>(apiBaseUrl, '/v1/platform/organizations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function fetchPlatformSupportSessions(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformSupportSessionsResponse>(apiBaseUrl, '/v1/platform/support/sessions', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformUsers(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformUsersResponse>(apiBaseUrl, '/v1/platform/users', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function startSupportSession(apiBaseUrl: string, token: string, payload: StartSupportSessionInput) {
  return apiFetch<StartSupportSessionResponse>(apiBaseUrl, '/v1/platform/support/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function endSupportSession(apiBaseUrl: string, token: string) {
  return apiFetch<EndSupportSessionResponse>(apiBaseUrl, '/v1/platform/support/end', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
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

export function sessionHasPlatformAuthority(session: Pick<AuthMeResponse, 'accessContext'>) {
  return session.accessContext.platformRoles.length > 0;
}

export function sessionIsPlatformMode(session: AuthMeResponse) {
  return sessionHasPlatformAuthority(session) && !session.accessContext.supportMode && !session.accessContext.activeOrganizationId;
}

export function sessionIsSupportMode(session: Pick<AuthMeResponse, 'accessContext'>) {
  return session.accessContext.supportMode && Boolean(session.accessContext.activeOrganizationId);
}

export function sessionHasOrgContext(session: Pick<AuthMeResponse, 'accessContext'>) {
  return Boolean(session.accessContext.activeOrganizationId);
}

export function getLandingPathForSession(session: AuthMeResponse) {
  if (sessionIsPlatformMode(session)) {
    return '/platform';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('org.users.read')) {
    return '/admin';
  }

  if (session.user.role === 'billing') {
    return '/rcm';
  }

  if (session.user.role === 'consumer') {
    return '/consumer';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('clinical.consumers.read')) {
    return '/clinical';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('billing.work_items.read')) {
    return '/rcm';
  }

  if (session.user.role === 'platform_admin' || session.user.role === 'support') {
    return '/platform';
  }

  return '/clinical';
}

export function getShellRoleForSession(session: AuthMeResponse | null): AppRole {
  if (!session) {
    return 'org_admin';
  }

  if (sessionIsSupportMode(session)) {
    return 'org_admin';
  }

  return getDisplayRoleForShell(session.user.role);
}
