'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import { PasswordUpdateCard } from './password-update-card';
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

type RcmDashboardResponse = {
  openClaims: number;
  deniedClaims: number;
  arOver90DaysCents: number;
  topDenials: Array<{
    code: string;
    reason: string;
    count: number;
  }>;
};

function formatDollars(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

export function RcmDashboard() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<RcmDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrlError);

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
        if (session.landingPath !== '/rcm') {
          router.replace(session.landingPath);
          return null;
        }

        setMe(session);

        return apiFetch<RcmDashboardResponse>(apiBaseUrl, '/v1/rcm/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      })
      .then((rcmDashboard) => {
        if (!rcmDashboard) {
          return;
        }

        setDashboard(rcmDashboard);
        setError(null);
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : 'Your beta session is missing or expired. Please sign in again.';

        if (loadError instanceof ApiResponseError && loadError.status === 401) {
          clearStoredToken();
          router.replace('/login');
          return;
        }

        setError(message);
      });
  }, [apiBaseUrl, apiBaseUrlError, router]);

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'billing')} title="RCM Workbench">
      <section className="grid">
        <article className="card">
          <span className="muted">Open claims</span>
          <span className="metric">{dashboard?.openClaims ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Denied claims</span>
          <span className="metric">{dashboard?.deniedClaims ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">AR over 90 days</span>
          <span className="metric">{dashboard ? formatDollars(dashboard.arOver90DaysCents) : '...'}</span>
        </article>
      </section>

      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Signed-in billing account</h2>
          <p className="muted">
            {me ? `${me.user.fullName} (${me.user.email})` : 'Validating your billing session.'}
          </p>
          <p className="muted">
            {me ? `Tenant: ${me.tenant.name}` : 'Loading tenant context.'}
          </p>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </article>
        <article className="card">
          <h2 className="sectionTitle">Top denial patterns</h2>
          {dashboard?.topDenials.length ? (
            <ul>
              {dashboard.topDenials.map((denial) => (
                <li key={denial.code}>
                  {denial.code} • {denial.reason} • {denial.count} claims
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading denial placeholders from the beta API.</p>
          )}
        </article>
      </section>

      {error ? <p style={{ color: '#b42318', marginTop: 24 }}>{error}</p> : null}
      <section style={{ marginTop: 24 }}>
        <PasswordUpdateCard mustChangePassword={me?.user.mustChangePassword} />
      </section>
    </RoleShell>
  );
}
