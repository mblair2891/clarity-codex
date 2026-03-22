'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import { PasswordUpdateCard } from './password-update-card';
import {
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
  primaryOrganization: {
    id: string;
    name: string;
    npi: string | null;
  } | null;
  counts: {
    organizations: number;
    staff: number;
    consumers: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    npi: string | null;
    tenantId: string;
    tenantName: string;
    createdAt: string;
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
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
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

type CreateFormState = {
  tenantSlug: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: string;
  password: string;
  mustChangePassword: boolean;
};

const defaultFormState: CreateFormState = {
  tenantSlug: 'beta-demo',
  organizationId: '',
  fullName: '',
  email: '',
  role: 'clinical_staff',
  password: '',
  mustChangePassword: false
};

export function AdminDashboard() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>(defaultFormState);

  useEffect(() => {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    fetchMe(apiBaseUrl, token)
      .then((session) => {
        if (session.user.role !== 'platform_admin' && session.user.role !== 'org_admin') {
          router.replace(session.landingPath);
          return null;
        }

        setMe(session);
        return apiFetch<AdminDashboardResponse>(apiBaseUrl, '/v1/admin/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      })
      .then((adminDashboard) => {
        if (!adminDashboard) {
          return;
        }

        setDashboard(adminDashboard);
        setError(null);
        setFormState((current) => ({
          ...current,
          tenantSlug: adminDashboard.tenant.slug,
          organizationId: adminDashboard.primaryOrganization?.id ?? adminDashboard.organizations[0]?.id ?? ''
        }));
      })
      .catch((loadError) => {
        clearStoredToken();
        setError(loadError instanceof Error ? loadError.message : 'Your beta session is missing or expired. Please sign in again.');
      });
  }, [apiBaseUrl, apiBaseUrlError, router]);

  const selectedTenant = dashboard?.manageableTenants.find((tenant) => tenant.slug === formState.tenantSlug) ?? dashboard?.manageableTenants[0] ?? null;
  const organizationOptions = me?.user.role === 'platform_admin'
    ? selectedTenant?.organizations ?? []
    : dashboard?.manageableTenants[0]?.organizations ?? [];

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
        tenantSlug: me?.user.role === 'platform_admin' ? formState.tenantSlug : undefined,
        organizationId: formState.role === 'platform_admin' ? undefined : formState.organizationId,
        fullName: formState.fullName.trim(),
        email: formState.email.trim().toLowerCase(),
        role: formState.role,
        password: formState.password,
        mustChangePassword: formState.mustChangePassword
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
      setFormState((current) => ({
        ...current,
        fullName: '',
        email: '',
        password: '',
        role: 'clinical_staff',
        mustChangePassword: false
      }));

      const refreshedDashboard = await apiFetch<AdminDashboardResponse>(apiBaseUrl, '/v1/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setDashboard(refreshedDashboard);
    } catch (submissionError) {
      setCreateError(submissionError instanceof Error ? submissionError.message : 'Unable to create beta account.');
    } finally {
      setIsCreatingUser(false);
    }
  }

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'org_admin')} title="Tenant Administration">
      <section className="grid">
        <article className="card">
          <span className="muted">Tenant</span>
          <span className="metric">{dashboard?.tenant.name ?? 'Loading...'}</span>
          <p className="muted">{dashboard?.tenant.slug ?? 'Preparing beta workspace.'}</p>
        </article>
        <article className="card">
          <span className="muted">Signed in as</span>
          <span className="metric">{me?.user.fullName ?? 'Validating access...'}</span>
          <p className="muted">{me?.user.email ?? 'Checking beta session.'}</p>
        </article>
        <article className="card">
          <span className="muted">Primary organization</span>
          <span className="metric">{dashboard?.primaryOrganization?.name ?? 'Loading...'}</span>
          <p className="muted">{dashboard?.primaryOrganization?.npi ? `NPI ${dashboard.primaryOrganization.npi}` : 'Organization-scoped beta access'}</p>
        </article>
      </section>

      <section className="grid" style={{ marginTop: 24 }}>
        <article className="card">
          <span className="muted">Organizations</span>
          <span className="metric">{dashboard?.counts.organizations ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Staff users</span>
          <span className="metric">{dashboard?.counts.staff ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Consumers</span>
          <span className="metric">{dashboard?.counts.consumers ?? '...'}</span>
        </article>
      </section>

      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Create beta user</h2>
          <p className="muted">
            Use this beta-only admin workflow to create named accounts with temporary or fixed passwords.
          </p>
          <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {me?.user.role === 'platform_admin' ? (
              <>
                <label className="muted" htmlFor="tenant-slug">Tenant</label>
                <select
                  id="tenant-slug"
                  className="card"
                  value={formState.tenantSlug}
                  onChange={(event) => {
                    const nextTenantSlug = event.target.value;
                    const nextTenant = dashboard?.manageableTenants.find((tenant) => tenant.slug === nextTenantSlug);
                    setFormState((current) => ({
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
              </>
            ) : null}

            <label className="muted" htmlFor="create-full-name">Full name</label>
            <input
              id="create-full-name"
              className="card"
              value={formState.fullName}
              onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Taylor Clinical"
            />

            <label className="muted" htmlFor="create-email">Email</label>
            <input
              id="create-email"
              type="email"
              className="card"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              placeholder="beta-user@claritybridgehealth.com"
            />

            <label className="muted" htmlFor="create-role">Role</label>
            <select
              id="create-role"
              className="card"
              value={formState.role}
              onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))}
            >
              {dashboard?.assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            {formState.role !== 'platform_admin' ? (
              <>
                <label className="muted" htmlFor="create-organization">Organization</label>
                <select
                  id="create-organization"
                  className="card"
                  value={formState.organizationId}
                  onChange={(event) => setFormState((current) => ({ ...current, organizationId: event.target.value }))}
                >
                  {organizationOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <label className="muted" htmlFor="create-password">Temporary password</label>
            <input
              id="create-password"
              type="password"
              className="card"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              placeholder="Choose a beta-safe password"
            />

            <label className="muted" htmlFor="must-change-password">
              <input
                id="must-change-password"
                type="checkbox"
                checked={formState.mustChangePassword}
                onChange={(event) => setFormState((current) => ({ ...current, mustChangePassword: event.target.checked }))}
                style={{ marginRight: 8 }}
              />
              Require password change after first sign-in
            </label>

            <button
              type="submit"
              className="card"
              style={{ cursor: 'pointer', fontWeight: 700 }}
              disabled={isCreatingUser}
            >
              {isCreatingUser ? 'Creating beta user...' : 'Create beta user'}
            </button>
          </form>
          {createSuccess ? <p style={{ color: '#067647', marginTop: 12 }}>{createSuccess}</p> : null}
          {createError ? <p style={{ color: '#b42318', marginTop: 12 }}>{createError}</p> : null}
        </article>

        <article className="card">
          <h2 className="sectionTitle">Beta user accounts</h2>
          {dashboard?.users.length ? (
            <ul>
              {dashboard.users.map((user) => (
                <li key={user.id}>
                  {user.fullName} • {user.role} • {user.email}
                  {user.organizations[0] ? ` • ${user.organizations[0].name}` : ''}
                  {user.mustChangePassword ? ' • password reset required' : ''}
                  {!user.isActive ? ' • inactive' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading beta account roster from the API.</p>
          )}
        </article>
      </section>

      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Managed organizations</h2>
          {dashboard?.organizations.length ? (
            <ul>
              {dashboard.organizations.map((organization) => (
                <li key={organization.id}>
                  {organization.name}
                  {organization.npi ? ` • NPI ${organization.npi}` : ''}
                  {me?.user.role === 'platform_admin' ? ` • ${organization.tenantName}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading organization records from the beta database.</p>
          )}
        </article>
        <article className="card">
          <h2 className="sectionTitle">Linked consumer profiles</h2>
          {dashboard?.consumers.length ? (
            <ul>
              {dashboard.consumers.map((consumer) => (
                <li key={consumer.id}>
                  {consumer.firstName} {consumer.lastName}
                  {consumer.organization ? ` • ${consumer.organization.name}` : ''}
                  {consumer.traumaMode ? ' • trauma-aware' : ''}
                  {consumer.cognitiveAssistMode ? ' • cognitive assist' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading consumer records from the beta database.</p>
          )}
        </article>
      </section>

      <section className="card" style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        <div>
          <h2 className="sectionTitle">Beta account status</h2>
          <p className="muted">
            This admin view is connected to the live beta API and currently acts as the placeholder beta user-management console.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="card"
          style={{ cursor: 'pointer', fontWeight: 700 }}
        >
          Sign out
        </button>
        {error ? <p style={{ color: '#b42318', margin: 0 }}>{error}</p> : null}
      </section>

      <section style={{ marginTop: 24 }}>
        <PasswordUpdateCard mustChangePassword={me?.user.mustChangePassword} />
      </section>
    </RoleShell>
  );
}
