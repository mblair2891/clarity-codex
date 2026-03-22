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

type ClinicalDashboardResponse = {
  appointmentsToday: number;
  pendingIntakes: number;
  riskAlerts: number;
  groupSessions: Array<{
    name: string;
    startsAt: string;
    facilitator: string;
  }>;
};

export function ClinicalDashboard() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<ClinicalDashboardResponse | null>(null);
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
        if (session.landingPath !== '/clinical') {
          router.replace(session.landingPath);
          return null;
        }

        setMe(session);

        return apiFetch<ClinicalDashboardResponse>(apiBaseUrl, '/v1/clinical/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      })
      .then((clinicalDashboard) => {
        if (!clinicalDashboard) {
          return;
        }

        setDashboard(clinicalDashboard);
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

  return (
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'clinical_staff')} title="Clinical Command Center">
      <section className="grid">
        <article className="card">
          <span className="muted">Appointments today</span>
          <span className="metric">{dashboard?.appointmentsToday ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Pending intakes</span>
          <span className="metric">{dashboard?.pendingIntakes ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Risk alerts</span>
          <span className="metric">{dashboard?.riskAlerts ?? '...'}</span>
        </article>
      </section>

      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Signed-in clinical account</h2>
          <p className="muted">
            {me ? `${me.user.fullName} (${me.user.email})` : 'Validating your beta clinical session.'}
          </p>
          <p className="muted">
            {me ? `Tenant: ${me.tenant.name}` : 'Loading tenant context.'}
          </p>
        </article>
        <article className="card">
          <h2 className="sectionTitle">Today&apos;s groups</h2>
          {dashboard?.groupSessions.length ? (
            <ul>
              {dashboard.groupSessions.map((session) => (
                <li key={`${session.name}-${session.startsAt}`}>
                  {session.startsAt} • {session.name} • {session.facilitator}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading clinical schedule placeholders from the beta API.</p>
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
