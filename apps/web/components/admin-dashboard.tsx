'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import { resolveApiBaseUrl } from '../lib/api-base-url';

const tokenStorageKey = 'clarity.beta.token';

type AuthMeResponse = {
  user: {
    email: string;
    fullName: string;
    role: string;
  };
  tenant: {
    name: string;
    slug: string;
  };
  organization: {
    name: string;
    npi: string | null;
  } | null;
};

type AdminDashboardResponse = {
  tenant: {
    name: string;
    slug: string;
  };
  admin: {
    email: string;
    fullName: string;
    role: string;
  };
  primaryOrganization: {
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
    createdAt: string;
  }>;
  consumers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    createdAt: string;
  }>;
};

async function apiFetch<T>(apiBaseUrl: string, path: string, token: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${path}.`);
  }

  return response.json();
}

export function AdminDashboard() {
  const router = useRouter();
  const apiBaseUrl = resolveApiBaseUrl();
  const apiBaseUrlError = apiBaseUrl
    ? null
    : 'Beta dashboard is unavailable from this hostname. Open the beta app URL directly.';
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrlError);

  useEffect(() => {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = window.localStorage.getItem(tokenStorageKey);
    if (!token) {
      router.replace('/login');
      return;
    }

    Promise.all([
      apiFetch<AuthMeResponse>(apiBaseUrl, '/v1/auth/me', token),
      apiFetch<AdminDashboardResponse>(apiBaseUrl, '/v1/admin/dashboard', token)
    ])
      .then(([meResponse, dashboardResponse]) => {
        setMe(meResponse);
        setDashboard(dashboardResponse);
      })
      .catch(() => {
        window.localStorage.removeItem(tokenStorageKey);
        setError('Your beta session is missing or expired. Please sign in again.');
      });
  }, [apiBaseUrl, apiBaseUrlError, router]);

  function handleLogout() {
    window.localStorage.removeItem(tokenStorageKey);
    router.replace('/login');
  }

  return (
    <RoleShell role="org_admin" title="Tenant Administration">
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
          <p className="muted">{dashboard?.primaryOrganization?.npi ? `NPI ${dashboard.primaryOrganization.npi}` : 'Seeded beta organization'}</p>
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
          <h2 className="sectionTitle">Seeded beta organizations</h2>
          {dashboard?.organizations.length ? (
            <ul>
              {dashboard.organizations.map((organization) => (
                <li key={organization.id}>
                  {organization.name}
                  {organization.npi ? ` • NPI ${organization.npi}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading organization records from the beta database.</p>
          )}
        </article>
        <article className="card">
          <h2 className="sectionTitle">Seeded consumers</h2>
          {dashboard?.consumers.length ? (
            <ul>
              {dashboard.consumers.map((consumer) => (
                <li key={consumer.id}>
                  {consumer.firstName} {consumer.lastName}
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
          <h2 className="sectionTitle">Beta access status</h2>
          <p className="muted">
            This dashboard is loaded from the live beta API using your beta session and the seeded beta database.
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
    </RoleShell>
  );
}
