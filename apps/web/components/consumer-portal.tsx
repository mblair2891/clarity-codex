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

type ConsumerDashboardResponse = {
  consumer: {
    id: string;
    firstName: string;
    lastName: string;
    traumaMode: boolean;
    cognitiveAssistMode: boolean;
    conditions: Array<{
      name: string;
      symptomScore: number;
      accommodation: string;
    }>;
    goals: Array<{
      title: string;
      status: string;
    }>;
    supportContacts: Array<{
      name: string;
      relationship: string;
      phone: string;
    }>;
  };
  risk: {
    score: number;
    tier: string;
    factors: string[];
  };
};

export function ConsumerPortal() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<ConsumerDashboardResponse | null>(null);
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
        if (session.landingPath !== '/consumer') {
          router.replace(session.landingPath);
          return null;
        }

        setMe(session);

        return apiFetch<ConsumerDashboardResponse>(apiBaseUrl, '/v1/consumer/dashboard', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      })
      .then((consumerDashboard) => {
        if (!consumerDashboard) {
          return;
        }

        setDashboard(consumerDashboard);
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
    <RoleShell role={getDisplayRoleForShell(me?.user.role ?? 'consumer')} title="Recovery Hub">
      <div className="banner">
        <strong>
          {dashboard?.consumer.traumaMode ? 'Trauma-informed' : 'Standard'} and {dashboard?.consumer.cognitiveAssistMode ? 'cognitive assist' : 'standard'} supports are active.
        </strong>
        <p className="muted">
          {me ? `Welcome ${me.user.fullName}. This is your beta consumer-facing portal.` : 'Validating your consumer session.'}
        </p>
      </div>

      <section className="grid">
        <article className="card">
          <span className="muted">Risk tier</span>
          <span className="metric">{dashboard?.risk.tier ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Risk score</span>
          <span className="metric">{dashboard?.risk.score ?? '...'}</span>
        </article>
        <article className="card">
          <span className="muted">Support contacts</span>
          <span className="metric">{dashboard?.consumer.supportContacts.length ?? '...'}</span>
        </article>
      </section>

      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Current goals</h2>
          {dashboard?.consumer.goals.length ? (
            <ul>
              {dashboard.consumer.goals.map((goal) => (
                <li key={goal.title}>
                  {goal.title} • {goal.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading your recovery goals from the beta API.</p>
          )}
        </article>
        <article className="card">
          <h2 className="sectionTitle">Condition-aware supports</h2>
          {dashboard?.consumer.conditions.length ? (
            <ul>
              {dashboard.consumer.conditions.map((condition) => (
                <li key={condition.name}>
                  {condition.name} • score {condition.symptomScore} • {condition.accommodation}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading support accommodations from the beta API.</p>
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
