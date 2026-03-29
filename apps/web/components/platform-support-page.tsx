'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchMe,
  fetchPlatformDashboard,
  fetchPlatformSupportSessions,
  getLandingPathForSession,
  startSupportSession,
  storeToken,
  type PlatformDashboardResponse,
  type PlatformSupportSessionsResponse
} from '../lib/beta-auth';
import {
  PlatformWorkspaceShell,
  formatDateTime,
  toneForSupportStatus,
  usePlatformWorkspace
} from './platform-workspace';

type SupportFormState = {
  organizationId: string;
  locationId: string;
  reason: string;
  ticketReference: string;
};

const defaultSupportFormState: SupportFormState = {
  organizationId: '',
  locationId: '',
  reason: '',
  ticketReference: ''
};

export function PlatformSupportPage() {
  const searchParams = useSearchParams();
  const {
    apiBaseUrl,
    router,
    me,
    setMe,
    error,
    setError,
    isSessionLoading,
    getTokenOrRedirect,
    handleLogout,
    handleEndSupport,
    handleApiError
  } = usePlatformWorkspace();
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [supportSessions, setSupportSessions] = useState<PlatformSupportSessionsResponse | null>(null);
  const [supportForm, setSupportForm] = useState<SupportFormState>(defaultSupportFormState);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingSupport, setIsStartingSupport] = useState(false);

  useEffect(() => {
    if (!apiBaseUrl || !me) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsLoading(true);

    Promise.all([fetchPlatformDashboard(apiBaseUrl, token), fetchPlatformSupportSessions(apiBaseUrl, token)])
      .then(([dashboardResponse, supportSessionsResponse]) => {
        setDashboard(dashboardResponse);
        setSupportSessions(supportSessionsResponse);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load support tools right now.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    const requestedOrganizationId = searchParams.get('organizationId');
    const resolvedOrganizationId =
      requestedOrganizationId && dashboard.organizations.some((organization) => organization.id === requestedOrganizationId)
        ? requestedOrganizationId
        : supportForm.organizationId && dashboard.organizations.some((organization) => organization.id === supportForm.organizationId)
          ? supportForm.organizationId
          : dashboard.organizations[0]?.id ?? '';

    setSupportForm((current) => ({
      ...current,
      organizationId: resolvedOrganizationId
    }));
  }, [dashboard, searchParams]);

  const selectedOrganization = useMemo(
    () => dashboard?.organizations.find((organization) => organization.id === supportForm.organizationId) ?? null,
    [dashboard, supportForm.organizationId]
  );
  const locationOptions = selectedOrganization?.locations.filter((location) => location.isActive) ?? [];

  async function handleStartSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError('Platform API is unavailable.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    if (!supportForm.organizationId || supportForm.reason.trim().length < 3) {
      setError('Choose an organization and enter a short support reason before starting a session.');
      return;
    }

    setIsStartingSupport(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await startSupportSession(apiBaseUrl, token, {
        organizationId: supportForm.organizationId,
        locationId: supportForm.locationId || undefined,
        reason: supportForm.reason.trim(),
        ticketReference: supportForm.ticketReference.trim() || undefined
      });

      storeToken(response.token);
      const session = await fetchMe(apiBaseUrl, response.token);

      setMe(session);
      setSuccess('Support session started. Redirecting into the organization workspace.');
      router.replace(getLandingPathForSession(session));
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to start a support session.'));
    } finally {
      setIsStartingSupport(false);
    }
  }

  return (
    <PlatformWorkspaceShell title="Support Tools" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Platform support section</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              Scoped support access
            </h2>
            <p className="muted consumerLead">
              Launch temporary org-scoped support sessions from inside the platform control plane, review session history, and keep the admin home focused on SaaS operations.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform" className="secondaryButton">
              Back to Platform Home
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      {me?.accessContext.supportMode ? (
        <section className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Support session active</h2>
              <p className="muted">Your login is currently attached to {me.organization?.name ?? 'an organization'}.</p>
            </div>
            <div className="actionRow">
              <Link href="/admin" className="primaryButton">
                Open Org Admin
              </Link>
              <Link href="/clinical" className="secondaryButton">
                Open Clinical
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Start support session</h2>
              <p className="muted">Choose the organization context, optionally narrow to a location, and record why support access is being opened.</p>
            </div>
          </div>
          <form onSubmit={handleStartSupport} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
            <label className="fieldLabel">
              Organization
              <select
                className="inputField"
                value={supportForm.organizationId}
                onChange={(event) => setSupportForm((current) => ({ ...current, organizationId: event.target.value, locationId: '' }))}
              >
                <option value="">Select an organization</option>
                {dashboard?.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Location
              <select
                className="inputField"
                value={supportForm.locationId}
                onChange={(event) => setSupportForm((current) => ({ ...current, locationId: event.target.value }))}
                disabled={!locationOptions.length}
              >
                <option value="">All organization locations</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fieldLabel">
              Reason
              <textarea
                className="inputField textareaField"
                value={supportForm.reason}
                onChange={(event) => setSupportForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Describe the support issue, investigation, or access need."
              />
            </label>
            <label className="fieldLabel">
              Ticket or reference
              <input
                className="inputField"
                value={supportForm.ticketReference}
                onChange={(event) => setSupportForm((current) => ({ ...current, ticketReference: event.target.value }))}
                placeholder="Optional incident, ticket, or escalation reference"
              />
            </label>
            <div className="actionRow">
              <button type="submit" className="primaryButton" disabled={isStartingSupport}>
                {isStartingSupport ? 'Starting Support Session...' : 'Start Support Session'}
              </button>
            </div>
          </form>
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Current organization selection</h2>
              <p className="muted">Preview the organization before entering support mode.</p>
            </div>
          </div>
          {selectedOrganization ? (
            <div className="timeline" style={{ marginTop: 16 }}>
              <article className="listItemCard">
                <strong>{selectedOrganization.name}</strong>
                <span className="muted">{selectedOrganization.slug ? `/${selectedOrganization.slug}` : 'Slug pending backfill'}</span>
                <span className="muted">
                  {selectedOrganization.counts.users} users • {selectedOrganization.counts.consumers} consumers • {selectedOrganization.counts.locations} locations
                </span>
                <span className="muted">{selectedOrganization.subscription.planName ?? 'Beta'} plan scaffold</span>
              </article>
              <Link href={`/platform/organizations/${selectedOrganization.id}`} className="secondaryButton">
                Open Organization Detail
              </Link>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Choose an organization to preview the support context.</p>
          )}
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Active support sessions</h2>
              <p className="muted">Current org support sessions across the platform tenant.</p>
            </div>
            <span className="statusPill neutral">{supportSessions?.activeSessions.length ?? (isSessionLoading || isLoading ? '...' : 0)} active</span>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {supportSessions?.activeSessions.length ? (
              supportSessions.activeSessions.map((session) => (
                <article key={session.id} className="listItemCard">
                  <strong>{session.organizationName ?? 'Organization'}</strong>
                  <span className="muted">{session.supportUserName}</span>
                  <span className="muted">{session.reason ?? 'No reason recorded'}</span>
                  <div className="pillRow">
                    <span className={`statusPill ${toneForSupportStatus(session.status)}`}>{session.status}</span>
                    <span className="statusPill neutral">{formatDateTime(session.startedAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No active support sessions right now.</p>
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Recent session history</h2>
              <p className="muted">Recent support access sessions stay visible here for audit and operator awareness.</p>
            </div>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {supportSessions?.recentSessions.length ? (
              supportSessions.recentSessions.map((session) => (
                <article key={session.id} className="listItemCard">
                  <strong>{session.organizationName ?? 'Organization'}</strong>
                  <span className="muted">{session.supportUserName}</span>
                  <span className="muted">{session.reason ?? 'No reason recorded'}</span>
                  <div className="pillRow">
                    <span className={`statusPill ${toneForSupportStatus(session.status)}`}>{session.status}</span>
                    <span className="statusPill neutral">{formatDateTime(session.startedAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No support session history is available yet.</p>
            )}
          </div>
        </article>
      </section>
    </PlatformWorkspaceShell>
  );
}
