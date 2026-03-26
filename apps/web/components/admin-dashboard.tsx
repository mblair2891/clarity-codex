'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordUpdateCard } from './password-update-card';
import { RoleShell } from './role-shell';
import {
  ApiResponseError,
  apiFetch,
  clearStoredToken,
  fetchMe,
  getApiBaseUrlState,
  getDisplayRoleForShell,
  getStoredToken,
  type AuthMeResponse
} from '../lib/beta-auth';

type AdminDashboardResponse = {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  admin: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    mustChangePassword: boolean;
  };
  scopeModel: string;
  primaryOrganization: {
    id: string;
    name: string;
    npi: string | null;
  } | null;
  counts: {
    organizations: number;
    users: number;
    activeUsers: number;
    consumers: number;
    clinicians: number;
    orgAdmins: number;
    flaggedFollowUps: number;
    unresolvedReviews: number;
  };
  roleCounts: Record<string, number>;
  statusCounts: {
    active: number;
    inactive: number;
    mustChangePassword: number;
  };
  operationalOverview: {
    checkIns7d: number;
    followUpRequests7d: number;
    unresolvedReviews: number;
    riskFlaggedReviews: number;
    flaggedNotes: number;
    sharedJournals7d: number;
    appointmentsToday: number;
    routineCompletions7d: number;
  };
  quickActions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    npi: string | null;
    taxId: string | null;
    tenantId: string;
    tenantName: string;
    createdAt: string;
    userCount: number;
    activeUserCount: number;
    consumerCount: number;
    clinicianCount: number;
    adminCount: number;
    pendingReviewCount: number;
    followUpCount: number;
  }>;
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    createdAt: string;
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    organizations: Array<{
      id: string;
      name: string;
      role: string;
    }>;
    consumer: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }>;
  consumers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    createdAt: string;
    organization: {
      id: string;
      name: string;
    } | null;
  }>;
  flaggedItems: Array<{
    id: string;
    type: string;
    priority: string;
    title: string;
    detail: string;
    at: string;
    organizationId: string;
    organizationName: string;
    consumerId: string;
    consumerName: string;
    href: string;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    at: string;
    organizationName: string | null;
    userName: string | null;
    consumerName: string | null;
  }>;
  manageableTenants: Array<{
    id: string;
    slug: string;
    name: string;
    organizations: Array<{
      id: string;
      name: string;
    }>;
  }>;
  assignableRoles: string[];
};

type CreateUserResponse = {
  created: boolean;
  user: {
    id: string;
    email: string;
  };
};

type UpdateUserResponse = {
  updated: boolean;
  user: {
    id: string;
    email: string;
  };
};

type UpdateOrganizationResponse = {
  updated: boolean;
  organization: {
    id: string;
    name: string;
  };
};

type CreateFormState = {
  tenantSlug: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: string;
  password: string;
  mustChangePassword: boolean;
};

type EditFormState = {
  fullName: string;
  email: string;
  role: string;
  organizationId: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

type OrganizationFormState = {
  name: string;
  npi: string;
  taxId: string;
};

const defaultCreateFormState: CreateFormState = {
  tenantSlug: 'beta-demo',
  organizationId: '',
  fullName: '',
  email: '',
  role: 'clinical_staff',
  password: '',
  mustChangePassword: true
};

const defaultEditFormState: EditFormState = {
  fullName: '',
  email: '',
  role: 'clinical_staff',
  organizationId: '',
  isActive: true,
  mustChangePassword: false
};

const defaultOrganizationFormState: OrganizationFormState = {
  name: '',
  npi: '',
  taxId: ''
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function formatRoleLabel(role: string) {
  return role.replaceAll('_', ' ');
}

function toneForPriority(priority: string) {
  if (priority === 'high') {
    return 'warning';
  }

  if (priority === 'medium') {
    return 'focus';
  }

  return 'neutral';
}

function toneForUserStatus(user: { isActive: boolean; mustChangePassword: boolean }) {
  if (!user.isActive) {
    return 'warning';
  }

  if (user.mustChangePassword) {
    return 'focus';
  }

  return 'success';
}

function buildEditFormState(user: AdminDashboardResponse['users'][number]): EditFormState {
  return {
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    organizationId: user.organizations[0]?.id ?? '',
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword
  };
}

function buildOrganizationFormState(organization: AdminDashboardResponse['organizations'][number]): OrganizationFormState {
  return {
    name: organization.name,
    npi: organization.npi ?? '',
    taxId: organization.taxId ?? ''
  };
}

export function AdminDashboard() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [isLoading, setIsLoading] = useState(true);

  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateFormState);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditFormState);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userOrganizationFilter, setUserOrganizationFilter] = useState('all');
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingTemporaryPassword, setIsSavingTemporaryPassword] = useState(false);

  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');
  const [organizationForm, setOrganizationForm] = useState<OrganizationFormState>(defaultOrganizationFormState);
  const [organizationActionError, setOrganizationActionError] = useState<string | null>(null);
  const [organizationActionSuccess, setOrganizationActionSuccess] = useState<string | null>(null);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);

  async function loadDashboard(token: string, session?: AuthMeResponse) {
    if (!apiBaseUrl) {
      throw new Error(apiBaseUrlError ?? 'Beta admin API is unavailable.');
    }

    const currentSession = session ?? (await fetchMe(apiBaseUrl, token));
    if (currentSession.user.role !== 'platform_admin' && currentSession.user.role !== 'org_admin') {
      router.replace(currentSession.landingPath);
      return;
    }

    const adminDashboard = await apiFetch<AdminDashboardResponse>(apiBaseUrl, '/v1/admin/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    setMe(currentSession);
    setDashboard(adminDashboard);
    setError(null);
    setCreateForm((current) => ({
      ...current,
      tenantSlug: adminDashboard.tenant.slug,
      organizationId: current.organizationId || adminDashboard.primaryOrganization?.id || adminDashboard.organizations[0]?.id || ''
    }));
    setSelectedUserId((current) => {
      const nextId = adminDashboard.users.some((user) => user.id === current) ? current : adminDashboard.users[0]?.id ?? '';
      const selectedUser = adminDashboard.users.find((user) => user.id === nextId);
      setEditForm(selectedUser ? buildEditFormState(selectedUser) : defaultEditFormState);
      return nextId;
    });
    setSelectedOrganizationId((current) => {
      const nextId = adminDashboard.organizations.some((organization) => organization.id === current)
        ? current
        : adminDashboard.primaryOrganization?.id || adminDashboard.organizations[0]?.id || '';
      const selectedOrganization = adminDashboard.organizations.find((organization) => organization.id === nextId);
      setOrganizationForm(selectedOrganization ? buildOrganizationFormState(selectedOrganization) : defaultOrganizationFormState);
      return nextId;
    });
  }

  useEffect(() => {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      setIsLoading(false);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    loadDashboard(token)
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : 'Your beta session is missing or expired. Please sign in again.';

        if (loadError instanceof ApiResponseError && loadError.status === 401) {
          clearStoredToken();
          router.replace('/login');
          return;
        }

        setError(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, apiBaseUrlError, router]);

  const selectedTenant =
    dashboard?.manageableTenants.find((tenant) => tenant.slug === createForm.tenantSlug) ?? dashboard?.manageableTenants[0] ?? null;
  const organizationOptions =
    me?.user.role === 'platform_admin' ? selectedTenant?.organizations ?? [] : dashboard?.manageableTenants[0]?.organizations ?? [];
  const filteredUsers = dashboard?.users.filter((user) => {
    const matchesSearch =
      !userSearch ||
      user.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    const matchesStatus =
      userStatusFilter === 'all' ||
      (userStatusFilter === 'active' && user.isActive) ||
      (userStatusFilter === 'inactive' && !user.isActive) ||
      (userStatusFilter === 'must_change_password' && user.mustChangePassword);
    const matchesOrganization =
      userOrganizationFilter === 'all' || user.organizations.some((organization) => organization.id === userOrganizationFilter);

    return matchesSearch && matchesRole && matchesStatus && matchesOrganization;
  }) ?? [];
  const selectedUser = dashboard?.users.find((user) => user.id === selectedUserId) ?? null;
  const selectedUserTenant =
    dashboard?.manageableTenants.find((tenant) => tenant.id === selectedUser?.tenant.id || tenant.slug === selectedUser?.tenant.slug) ?? null;
  const editOrganizationOptions =
    me?.user.role === 'platform_admin' ? selectedUserTenant?.organizations ?? [] : dashboard?.manageableTenants[0]?.organizations ?? [];
  const selectedOrganization = dashboard?.organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const organizationUsers = dashboard?.users.filter((user) => user.organizations.some((organization) => organization.id === selectedOrganizationId)) ?? [];

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  function handleApiError(actionError: unknown, fallbackMessage: string) {
    if (actionError instanceof ApiResponseError && actionError.status === 401) {
      clearStoredToken();
      router.replace('/login');
      return 'Your beta session expired. Please sign in again.';
    }

    return actionError instanceof Error ? actionError.message : fallbackMessage;
  }

  async function refreshDashboard() {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    await loadDashboard(token, me ?? undefined);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !dashboard) {
      setCreateError(apiBaseUrlError ?? 'Beta admin API is unavailable.');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsCreatingUser(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const payload = {
        tenantSlug: me?.user.role === 'platform_admin' ? createForm.tenantSlug : undefined,
        organizationId: createForm.role === 'platform_admin' ? undefined : createForm.organizationId,
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
        password: createForm.password,
        mustChangePassword: createForm.mustChangePassword
      };

      const response = await apiFetch<CreateUserResponse>(apiBaseUrl, '/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setCreateSuccess(`Created beta account for ${response.user.email}.`);
      setCreateForm((current) => ({
        ...current,
        fullName: '',
        email: '',
        password: '',
        role: 'clinical_staff',
        mustChangePassword: true
      }));
      await refreshDashboard();
    } catch (submissionError) {
      setCreateError(handleApiError(submissionError, 'Unable to create beta account.'));
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedUser) {
      setUserActionError('Select a beta user before saving changes.');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingUser(true);
    setUserActionError(null);
    setUserActionSuccess(null);

    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        organizationId: editForm.role === 'platform_admin' ? null : editForm.organizationId,
        isActive: editForm.isActive,
        mustChangePassword: editForm.mustChangePassword
      };

      await apiFetch<UpdateUserResponse>(apiBaseUrl, `/v1/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      setUserActionSuccess(`Saved changes for ${selectedUser.email}.`);
      await refreshDashboard();
    } catch (actionError) {
      setUserActionError(handleApiError(actionError, 'Unable to save beta user changes.'));
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleSetTemporaryPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedUser) {
      setUserActionError('Select a beta user before setting a temporary password.');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingTemporaryPassword(true);
    setUserActionError(null);
    setUserActionSuccess(null);

    try {
      await apiFetch(apiBaseUrl, `/v1/admin/users/${selectedUser.id}/set-temporary-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          temporaryPassword,
          mustChangePassword: true
        })
      });

      setTemporaryPassword('');
      setUserActionSuccess(`Temporary password updated for ${selectedUser.email}.`);
      await refreshDashboard();
    } catch (actionError) {
      setUserActionError(handleApiError(actionError, 'Unable to set a temporary password.'));
    } finally {
      setIsSavingTemporaryPassword(false);
    }
  }

  async function handleSaveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !selectedOrganization) {
      setOrganizationActionError('Select an organization before saving changes.');
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsSavingOrganization(true);
    setOrganizationActionError(null);
    setOrganizationActionSuccess(null);

    try {
      const response = await apiFetch<UpdateOrganizationResponse>(apiBaseUrl, `/v1/admin/organizations/${selectedOrganization.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: organizationForm.name.trim(),
          npi: organizationForm.npi.trim() || null,
          taxId: organizationForm.taxId.trim() || null
        })
      });

      setOrganizationActionSuccess(`Saved organization settings for ${response.organization.name}.`);
      await refreshDashboard();
    } catch (actionError) {
      setOrganizationActionError(handleApiError(actionError, 'Unable to save organization changes.'));
    } finally {
      setIsSavingOrganization(false);
    }
  }

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'org_admin')} title="Administration">
      <div className="adminStack">
        <section className="card consumerHero adminHero">
          <div className="consumerHeroTop">
            <div>
              <p className="eyebrow">Beta admin workspace</p>
              <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
                {me ? `Welcome back, ${me.user.fullName.split(' ')[0]}` : 'Loading admin workspace'}
              </h2>
              <p className="muted consumerLead">
                Manage beta users, org access, and high-level operational health from the product UI instead of relying on scripts.
              </p>
              <div className="pillRow" style={{ marginTop: 16 }}>
                <span className="statusPill success">{formatRoleLabel(me?.user.role ?? 'org_admin')}</span>
                <span className="statusPill neutral">{dashboard?.scopeModel === 'platform_wide' ? 'Platform-wide admin scope' : 'Org-scoped admin access'}</span>
                <span className="statusPill focus">{dashboard?.tenant.name ?? 'Beta demo tenant'}</span>
              </div>
            </div>
            <div className="consumerActions">
              <button type="button" className="primaryButton" onClick={() => document.getElementById('users')?.scrollIntoView({ behavior: 'smooth' })}>
                Manage users
              </button>
              <button type="button" className="secondaryButton" onClick={() => document.getElementById('organizations')?.scrollIntoView({ behavior: 'smooth' })}>
                Manage organizations
              </button>
              <button type="button" className="secondaryButton" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
          <div className="consumerQuickActions">
            {dashboard?.quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="quickActionCard"
                onClick={() => {
                  if (action.id === 'create-user') {
                    document.getElementById('users')?.scrollIntoView({ behavior: 'smooth' });
                    return;
                  }

                  if (action.id === 'manage-orgs') {
                    document.getElementById('organizations')?.scrollIntoView({ behavior: 'smooth' });
                    return;
                  }

                  document.getElementById('operations')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <strong>{action.label}</strong>
                <span className="muted">{action.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid">
          <article className="card">
            <span className="muted">Users in scope</span>
            <span className="metric">{dashboard?.counts.users ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">{dashboard?.counts.activeUsers ?? 0} active beta accounts</p>
          </article>
          <article className="card">
            <span className="muted">Organizations</span>
            <span className="metric">{dashboard?.counts.organizations ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">{dashboard?.counts.orgAdmins ?? 0} admin operators in scope</p>
          </article>
          <article className="card">
            <span className="muted">Consumers</span>
            <span className="metric">{dashboard?.counts.consumers ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">{dashboard?.counts.clinicians ?? 0} clinical users supporting care</p>
          </article>
          <article className="card">
            <span className="muted">Follow-up load</span>
            <span className="metric">{dashboard?.counts.flaggedFollowUps ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">{dashboard?.counts.unresolvedReviews ?? 0} review items still open</p>
          </article>
        </section>

        <section className="adminPanelGrid" id="operations">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Operational overview</h2>
                <p className="muted">High-level signals to help admins spot whether the beta is healthy and who needs attention.</p>
              </div>
            </div>
            <div className="adminSectionGrid">
              <div className="listItemCard">
                <strong>Check-ins in the last 7 days</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.operationalOverview.checkIns7d ?? 0}</span>
                <span className="muted">{dashboard?.operationalOverview.followUpRequests7d ?? 0} requested follow-up</span>
              </div>
              <div className="listItemCard">
                <strong>Review queue</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.operationalOverview.unresolvedReviews ?? 0}</span>
                <span className="muted">{dashboard?.operationalOverview.riskFlaggedReviews ?? 0} risk-flagged reviews</span>
              </div>
              <div className="listItemCard">
                <strong>Shared engagement signals</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.operationalOverview.sharedJournals7d ?? 0}</span>
                <span className="muted">{dashboard?.operationalOverview.flaggedNotes ?? 0} flagged clinician notes</span>
              </div>
              <div className="listItemCard">
                <strong>Appointments and routines</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.operationalOverview.appointmentsToday ?? 0}</span>
                <span className="muted">{dashboard?.operationalOverview.routineCompletions7d ?? 0} routine completions in the last week</span>
              </div>
            </div>
            <div className="adminSectionGrid" style={{ marginTop: 16 }}>
              {Object.entries(dashboard?.roleCounts ?? {}).map(([role, count]) => (
                <div key={role} className="listItemCard">
                  <strong>{formatRoleLabel(role)}</strong>
                  <span className="metric" style={{ fontSize: 22 }}>{count}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <h2 className="sectionTitle">Flagged follow-up queue</h2>
            <p className="muted">Prioritized issues pulled from clinical reviews and follow-up notes.</p>
            <div className="timeline">
              {dashboard?.flaggedItems.length ? (
                dashboard.flaggedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="listItemCard adminQueueButton"
                    onClick={() => router.push(item.href)}
                  >
                    <div className="sectionHeaderRow">
                      <strong>{item.title}</strong>
                      <span className={`statusPill ${toneForPriority(item.priority)}`}>{item.priority} priority</span>
                    </div>
                    <span className="muted">{item.organizationName} • {formatDateTime(item.at)}</span>
                    <span>{item.detail}</span>
                    <span className="muted">{formatRoleLabel(item.status)}</span>
                  </button>
                ))
              ) : (
                <p className="muted">No flagged follow-up items are currently in scope.</p>
              )}
            </div>
          </article>
        </section>

        <section className="adminPanelGrid">
          <article className="card">
            <h2 className="sectionTitle">Recent activity</h2>
            <p className="muted">A practical activity feed derived from recent admin, clinical, and recovery events.</p>
            <div className="timeline">
              {dashboard?.recentActivity.length ? (
                dashboard.recentActivity.map((item) => (
                  <div key={item.id} className="listItemCard">
                    <div className="sectionHeaderRow">
                      <strong>{item.title}</strong>
                      <span className="muted">{formatDateTime(item.at)}</span>
                    </div>
                    <span>{item.detail}</span>
                    <span className="muted">
                      {[item.organizationName, item.userName, item.consumerName].filter(Boolean).join(' • ') || formatRoleLabel(item.type)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted">Recent beta activity will appear here once the workspace is in use.</p>
              )}
            </div>
          </article>

          <article className="card">
            <h2 className="sectionTitle">Platform summary</h2>
            <p className="muted">A quick read on account hygiene and organization readiness.</p>
            <div className="adminSectionGrid">
              <div className="listItemCard">
                <strong>Must change password</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.statusCounts.mustChangePassword ?? 0}</span>
                <span className="muted">Accounts awaiting first-time or rotated credentials</span>
              </div>
              <div className="listItemCard">
                <strong>Inactive accounts</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.statusCounts.inactive ?? 0}</span>
                <span className="muted">Deactivated beta access kept for reference</span>
              </div>
              <div className="listItemCard">
                <strong>Primary organization</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.primaryOrganization?.name ?? 'None'}</span>
                <span className="muted">{dashboard?.primaryOrganization?.npi ? `NPI ${dashboard.primaryOrganization.npi}` : 'Organization-scoped admin access'}</span>
              </div>
              <div className="listItemCard">
                <strong>Consumer profiles in scope</strong>
                <span className="metric" style={{ fontSize: 24 }}>{dashboard?.consumers.length ?? 0}</span>
                <span className="muted">Profiles currently present in the beta environment</span>
              </div>
            </div>
          </article>
        </section>

        <section className="adminPanelGrid" id="users">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">User management</h2>
                <p className="muted">Search, filter, activate/deactivate, change role/org, and set temporary passwords.</p>
              </div>
              <span className="statusPill neutral">{filteredUsers.length} shown</span>
            </div>
            <div className="adminFilters">
              <label className="fieldLabel">
                Search users
                <input className="inputField" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by name or email" />
              </label>
              <label className="fieldLabel">
                Role
                <select className="inputField" value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
                  <option value="all">All roles</option>
                  {Object.keys(dashboard?.roleCounts ?? {}).map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fieldLabel">
                Status
                <select className="inputField" value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="must_change_password">Must change password</option>
                </select>
              </label>
              <label className="fieldLabel">
                Organization
                <select className="inputField" value={userOrganizationFilter} onChange={(event) => setUserOrganizationFilter(event.target.value)}>
                  <option value="all">All organizations</option>
                  {dashboard?.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="timeline" style={{ marginTop: 16 }}>
              {filteredUsers.length ? (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`listItemCard adminQueueButton ${selectedUserId === user.id ? 'adminSelectedCard' : ''}`}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setEditForm(buildEditFormState(user));
                      setTemporaryPassword('');
                      setUserActionError(null);
                      setUserActionSuccess(null);
                    }}
                  >
                    <div className="sectionHeaderRow">
                      <strong>{user.fullName}</strong>
                      <span className={`statusPill ${toneForUserStatus(user)}`}>
                        {!user.isActive ? 'inactive' : user.mustChangePassword ? 'temp password' : 'active'}
                      </span>
                    </div>
                    <span>{user.email}</span>
                    <span className="muted">
                      {formatRoleLabel(user.role)}{user.organizations[0] ? ` • ${user.organizations[0].name}` : ''}{user.consumer ? ` • linked to ${user.consumer.firstName} ${user.consumer.lastName}` : ''}
                    </span>
                    <span className="muted">Created {formatDate(user.createdAt)}</span>
                  </button>
                ))
              ) : (
                <p className="muted">No users match the current filters.</p>
              )}
            </div>
          </article>

          <div className="consumerStack">
            <article className="card">
              <h2 className="sectionTitle">Create beta user</h2>
              <p className="muted">Provision a beta account directly from the product UI. Passwords are set server-side and never returned.</p>
              <form onSubmit={handleCreateUser} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
                {me?.user.role === 'platform_admin' ? (
                  <label className="fieldLabel">
                    Tenant
                    <select
                      className="inputField"
                      value={createForm.tenantSlug}
                      onChange={(event) => {
                        const nextTenantSlug = event.target.value;
                        const nextTenant = dashboard?.manageableTenants.find((tenant) => tenant.slug === nextTenantSlug);
                        setCreateForm((current) => ({
                          ...current,
                          tenantSlug: nextTenantSlug,
                          organizationId: nextTenant?.organizations[0]?.id ?? ''
                        }));
                      }}
                    >
                      {dashboard?.manageableTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.slug}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="consumerFormGrid">
                  <label className="fieldLabel">
                    Full name
                    <input className="inputField" value={createForm.fullName} onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Jordan Admin" />
                  </label>
                  <label className="fieldLabel">
                    Email
                    <input className="inputField" type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} placeholder="beta-user@claritybridgehealth.com" />
                  </label>
                  <label className="fieldLabel">
                    Role
                    <select className="inputField" value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value }))}>
                      {dashboard?.assignableRoles.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Temporary password
                    <input className="inputField" type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} placeholder="Create a beta-safe password" />
                  </label>
                  {createForm.role !== 'platform_admin' ? (
                    <label className="fieldLabel fieldSpan">
                      Organization
                      <select className="inputField" value={createForm.organizationId} onChange={(event) => setCreateForm((current) => ({ ...current, organizationId: event.target.value }))}>
                        {organizationOptions.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <label className="checkboxRow">
                  <input
                    type="checkbox"
                    checked={createForm.mustChangePassword}
                    onChange={(event) => setCreateForm((current) => ({ ...current, mustChangePassword: event.target.checked }))}
                  />
                  Require password change after first sign-in
                </label>
                <button type="submit" className="primaryButton" disabled={isCreatingUser}>
                  {isCreatingUser ? 'Creating beta user...' : 'Create beta user'}
                </button>
              </form>
              {createSuccess ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{createSuccess}</div> : null}
              {createError ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{createError}</div> : null}
            </article>

            <article className="card">
              <h2 className="sectionTitle">Edit selected user</h2>
              {selectedUser ? (
                <>
                  <p className="muted">Update scoped access, org placement, and beta account status for {selectedUser.email}.</p>
                  <form onSubmit={handleSaveUser} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
                    <div className="consumerFormGrid">
                      <label className="fieldLabel">
                        Full name
                        <input className="inputField" value={editForm.fullName} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} />
                      </label>
                      <label className="fieldLabel">
                        Email
                        <input className="inputField" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} />
                      </label>
                      <label className="fieldLabel">
                        Role
                        <select className="inputField" value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}>
                          {dashboard?.assignableRoles.map((role) => (
                            <option key={role} value={role}>
                              {formatRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {editForm.role !== 'platform_admin' ? (
                        <label className="fieldLabel">
                          Organization
                          <select className="inputField" value={editForm.organizationId} onChange={(event) => setEditForm((current) => ({ ...current, organizationId: event.target.value }))}>
                            {editOrganizationOptions.map((organization) => (
                              <option key={organization.id} value={organization.id}>
                                {organization.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div className="listItemCard">
                          <strong>Platform admin scope</strong>
                          <span className="muted">Platform admins are kept outside org-specific membership routing.</span>
                        </div>
                      )}
                    </div>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))} disabled={selectedUser.id === me?.user.id} />
                      Account is active
                    </label>
                    <label className="checkboxRow">
                      <input type="checkbox" checked={editForm.mustChangePassword} onChange={(event) => setEditForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} />
                      Require password change at next sign-in
                    </label>
                    <button type="submit" className="primaryButton" disabled={isSavingUser}>
                      {isSavingUser ? 'Saving user...' : 'Save user changes'}
                    </button>
                  </form>
                  <form onSubmit={handleSetTemporaryPassword} className="consumerStack" style={{ gap: 12, marginTop: 20 }}>
                    <label className="fieldLabel">
                      Set temporary password
                      <input className="inputField" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Enter a new temporary password" />
                    </label>
                    <button type="submit" className="secondaryButton" disabled={isSavingTemporaryPassword || temporaryPassword.length < 8}>
                      {isSavingTemporaryPassword ? 'Updating temporary password...' : 'Set temporary password'}
                    </button>
                  </form>
                </>
              ) : (
                <p className="muted">Select a user from the list to manage their account.</p>
              )}
              {userActionSuccess ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{userActionSuccess}</div> : null}
              {userActionError ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{userActionError}</div> : null}
            </article>
          </div>
        </section>

        <section className="adminPanelGrid" id="organizations">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Organization management</h2>
                <p className="muted">View org health, staff mix, and update baseline org details without leaving the product.</p>
              </div>
            </div>
            <div className="timeline">
              {dashboard?.organizations.length ? (
                dashboard.organizations.map((organization) => (
                  <button
                    key={organization.id}
                    type="button"
                    className={`listItemCard adminQueueButton ${selectedOrganizationId === organization.id ? 'adminSelectedCard' : ''}`}
                    onClick={() => {
                      setSelectedOrganizationId(organization.id);
                      setOrganizationForm(buildOrganizationFormState(organization));
                      setOrganizationActionError(null);
                      setOrganizationActionSuccess(null);
                    }}
                  >
                    <div className="sectionHeaderRow">
                      <strong>{organization.name}</strong>
                      <span className="statusPill neutral">{organization.userCount} users</span>
                    </div>
                    <span className="muted">
                      {organization.tenantName}
                      {organization.npi ? ` • NPI ${organization.npi}` : ''}
                      {organization.taxId ? ' • tax ID on file' : ''}
                    </span>
                    <div className="pillRow">
                      <span className="statusPill success">{organization.consumerCount} consumers</span>
                      <span className="statusPill focus">{organization.clinicianCount} clinicians</span>
                      <span className="statusPill warning">{organization.followUpCount} follow-up items</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="muted">No organizations are currently in your admin scope.</p>
              )}
            </div>
          </article>

          <div className="consumerStack">
            <article className="card">
              <h2 className="sectionTitle">Selected organization</h2>
              {selectedOrganization ? (
                <>
                  <div className="adminSectionGrid">
                    <div className="listItemCard">
                      <strong>{selectedOrganization.name}</strong>
                      <span className="muted">Created {formatDate(selectedOrganization.createdAt)}</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Users</strong>
                      <span className="metric" style={{ fontSize: 24 }}>{selectedOrganization.userCount}</span>
                      <span className="muted">{selectedOrganization.activeUserCount} active</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Consumers</strong>
                      <span className="metric" style={{ fontSize: 24 }}>{selectedOrganization.consumerCount}</span>
                      <span className="muted">{selectedOrganization.pendingReviewCount} pending reviews</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Admins</strong>
                      <span className="metric" style={{ fontSize: 24 }}>{selectedOrganization.adminCount}</span>
                      <span className="muted">{selectedOrganization.clinicianCount} clinical users</span>
                    </div>
                  </div>
                  <form onSubmit={handleSaveOrganization} className="consumerStack" style={{ gap: 16, marginTop: 20 }}>
                    <div className="consumerFormGrid">
                      <label className="fieldLabel">
                        Organization name
                        <input className="inputField" value={organizationForm.name} onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))} />
                      </label>
                      <label className="fieldLabel">
                        NPI
                        <input className="inputField" value={organizationForm.npi} onChange={(event) => setOrganizationForm((current) => ({ ...current, npi: event.target.value }))} placeholder="Optional" />
                      </label>
                      <label className="fieldLabel fieldSpan">
                        Tax ID
                        <input className="inputField" value={organizationForm.taxId} onChange={(event) => setOrganizationForm((current) => ({ ...current, taxId: event.target.value }))} placeholder="Optional" />
                      </label>
                    </div>
                    <button type="submit" className="primaryButton" disabled={isSavingOrganization}>
                      {isSavingOrganization ? 'Saving organization...' : 'Save organization details'}
                    </button>
                  </form>
                </>
              ) : (
                <p className="muted">Select an organization to view its admin summary and edit baseline details.</p>
              )}
              {organizationActionSuccess ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{organizationActionSuccess}</div> : null}
              {organizationActionError ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{organizationActionError}</div> : null}
            </article>

            <article className="card">
              <h2 className="sectionTitle">Users in selected organization</h2>
              {organizationUsers.length ? (
                <div className="timeline">
                  {organizationUsers.map((user) => (
                    <div key={user.id} className="listItemCard">
                      <div className="sectionHeaderRow">
                        <strong>{user.fullName}</strong>
                        <span className={`statusPill ${toneForUserStatus(user)}`}>{formatRoleLabel(user.role)}</span>
                      </div>
                      <span>{user.email}</span>
                      <span className="muted">{user.isActive ? 'Active' : 'Inactive'}{user.mustChangePassword ? ' • password reset pending' : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No users are currently assigned to the selected organization.</p>
              )}
            </article>
          </div>
        </section>

        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}

        <section>
          <PasswordUpdateCard mustChangePassword={me?.user.mustChangePassword} />
        </section>
      </div>
    </RoleShell>
  );
}
