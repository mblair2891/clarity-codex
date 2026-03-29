'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import {
  ApiResponseError,
  clearStoredToken,
  endSupportSession,
  fetchMe,
  fetchPlatformDashboard,
  getApiBaseUrlState,
  getLandingPathForSession,
  getStoredToken,
  sessionHasPlatformAuthority,
  sessionIsPlatformMode,
  startSupportSession,
  storeToken,
  type AuthMeResponse,
  type PlatformDashboardResponse
} from '../lib/beta-auth';

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function PlatformDashboard() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [supportForm, setSupportForm] = useState<SupportFormState>(defaultSupportFormState);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingSupport, setIsStartingSupport] = useState(false);
  const [isEndingSupport, setIsEndingSupport] = useState(false);

  const selectedOrganization = useMemo(
    () => dashboard?.organizations.find((organization) => organization.id === supportForm.organizationId) ?? null,
    [dashboard, supportForm.organizationId]
  );
  const locationOptions = selectedOrganization?.locations.filter((location) => location.isActive) ?? [];
  const isPlatformMode = me ? sessionIsPlatformMode(me) : false;

  async function loadPlatformWorkspace(token: string, knownSession?: AuthMeResponse) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    setIsLoading(true);

    try {
      const session = knownSession ?? (await fetchMe(apiBaseUrl, token));
      if (!sessionHasPlatformAuthority(session)) {
        router.replace(getLandingPathForSession(session));
        return;
      }

      const nextDashboard = await fetchPlatformDashboard(apiBaseUrl, token);

      setMe(session);
      setDashboard(nextDashboard);
      setSupportForm((current) => {
        const nextOrganizationId = nextDashboard.organizations.some((organization) => organization.id === current.organizationId)
          ? current.organizationId
          : nextDashboard.organizations[0]?.id ?? '';
        const nextOrganization = nextDashboard.organizations.find((organization) => organization.id === nextOrganizationId);
        const nextLocationId =
          nextOrganization?.locations.some((location) => location.id === current.locationId && location.isActive)
            ? current.locationId
            : '';

        return {
          ...current,
          organizationId: nextOrganizationId,
          locationId: nextLocationId
        };
      });
      setError(null);
    } catch (loadError) {
      if (loadError instanceof ApiResponseError && loadError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(loadError instanceof Error ? loadError.message : 'Unable to load the platform workspace right now.');
    } finally {
      setIsLoading(false);
    }
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

    loadPlatformWorkspace(token).catch(() => {});
  }, [apiBaseUrl, apiBaseUrlError, router]);

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  async function handleEndSupport() {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setIsEndingSupport(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await endSupportSession(apiBaseUrl, token);
      storeToken(response.token);
      const session = await fetchMe(apiBaseUrl, response.token);

      setMe(session);
      setSuccess('Support session ended. You are back in platform mode.');
      await loadPlatformWorkspace(response.token, session);
      router.replace(getLandingPathForSession(session));
    } catch (actionError) {
      if (actionError instanceof ApiResponseError && actionError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(actionError instanceof Error ? actionError.message : 'Unable to end the active support session.');
    } finally {
      setIsEndingSupport(false);
    }
  }

  async function handleStartSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
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
      router.replace(getLandingPathForSession(session));
    } catch (actionError) {
      if (actionError instanceof ApiResponseError && actionError.status === 401) {
        clearStoredToken();
        router.replace('/login');
        return;
      }

      setError(actionError instanceof Error ? actionError.message : 'Unable to start a support session.');
    } finally {
      setIsStartingSupport(false);
    }
  }

  return (
    <RoleShell role="platform_admin" title="Platform Home" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <div className="adminStack">
        <section className="card consumerHero adminHero">
          <div className="consumerHeroTop">
            <div>
              <p className="eyebrow">Platform beta workspace</p>
              <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
                {me ? `Platform access for ${me.user.fullName.split(' ')[0]}` : 'Loading platform workspace'}
              </h2>
              <p className="muted consumerLead">
                See platform-wide beta counts, choose an organization, and enter support mode without dropping into a tenant-style dashboard first.
              </p>
            </div>
            <div className="pillRow">
              <span className={`statusPill ${isPlatformMode ? 'success' : 'warning'}`}>
                {me?.accessContext.supportMode ? 'Support mode active' : 'Platform mode active'}
              </span>
              <span className="statusPill neutral">{dashboard?.tenant.name ?? 'Loading tenant'}</span>
            </div>
          </div>
          {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
          {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
        </section>

        <section className="grid">
          <article className="card">
            <span className="muted">Organizations</span>
            <span className="metric">{dashboard?.counts.organizations ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">Active beta organizations in the current tenant.</p>
          </article>
          <article className="card">
            <span className="muted">Users</span>
            <span className="metric">{dashboard?.counts.users ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">Named platform and organization users in scope.</p>
          </article>
          <article className="card">
            <span className="muted">Consumers</span>
            <span className="metric">{dashboard?.counts.consumers ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">Consumer profiles available for beta testing.</p>
          </article>
          <article className="card">
            <span className="muted">My active support sessions</span>
            <span className="metric">{dashboard?.counts.activeSupportSessions ?? (isLoading ? '...' : 0)}</span>
            <p className="muted">Support access sessions currently attached to your account.</p>
          </article>
        </section>

        {me?.accessContext.supportMode ? (
          <section className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Support session active</h2>
                <p className="muted">You are currently attached to an organization support session. Return to the org workspace or end the session here.</p>
              </div>
              <div className="consumerActions">
                <button type="button" className="primaryButton" onClick={() => router.push('/admin')}>
                  Open Org Admin View
                </button>
                <button type="button" className="secondaryButton" onClick={handleEndSupport} disabled={isEndingSupport}>
                  {isEndingSupport ? 'Ending...' : 'End Support Session'}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="adminPanelGrid" id="start-support-form">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Start support session</h2>
                <p className="muted">Choose the organization context you want to enter, optionally narrow to a location, and capture why you are accessing the workspace.</p>
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
                  placeholder="Describe the beta testing issue, access need, or investigation."
                />
              </label>
              <label className="fieldLabel">
                Ticket or reference
                <input
                  className="inputField"
                  value={supportForm.ticketReference}
                  onChange={(event) => setSupportForm((current) => ({ ...current, ticketReference: event.target.value }))}
                  placeholder="Optional ticket, incident, or beta feedback reference"
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="primaryButton" disabled={isStartingSupport}>
                  {isStartingSupport ? 'Starting Support Session...' : 'Start Support Session'}
                </button>
              </div>
            </form>
          </article>

          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Current selection</h2>
                <p className="muted">A quick preview of the organization you are about to enter.</p>
              </div>
            </div>
            {selectedOrganization ? (
              <div className="listItemCard">
                <strong>{selectedOrganization.name}</strong>
                <span className="muted">ID: {selectedOrganization.identifier}</span>
                <span className="muted">
                  {selectedOrganization.counts.users} users • {selectedOrganization.counts.consumers} consumers • {selectedOrganization.counts.locations} locations
                </span>
                <span className="muted">Created {formatDate(selectedOrganization.createdAt)}</span>
              </div>
            ) : (
              <p className="muted">Choose an organization to preview the support context.</p>
            )}
          </article>
        </section>

        <section className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Organizations</h2>
              <p className="muted">Platform-level launcher for beta testing. Pick an organization to prefill the support session form.</p>
            </div>
            <span className="statusPill neutral">{dashboard?.organizations.length ?? 0} organizations</span>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {dashboard?.organizations.length ? (
              dashboard.organizations.map((organization) => (
                <article key={organization.id} className="listItemCard">
                  <div className="sectionHeaderRow">
                    <div>
                      <strong>{organization.name}</strong>
                      <div className="muted">ID: {organization.identifier}</div>
                    </div>
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => {
                        setSupportForm((current) => ({
                          ...current,
                          organizationId: organization.id,
                          locationId: ''
                        }));
                        document.getElementById('start-support-form')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Support This Org
                    </button>
                  </div>
                  <div className="adminSectionGrid" style={{ marginTop: 12 }}>
                    <div className="listItemCard">
                      <strong>Users</strong>
                      <span className="metric" style={{ fontSize: 22 }}>{organization.counts.users}</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Consumers</strong>
                      <span className="metric" style={{ fontSize: 22 }}>{organization.counts.consumers}</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Org admins</strong>
                      <span className="metric" style={{ fontSize: 22 }}>{organization.counts.admins}</span>
                    </div>
                    <div className="listItemCard">
                      <strong>Locations</strong>
                      <span className="metric" style={{ fontSize: 22 }}>{organization.counts.locations}</span>
                    </div>
                  </div>
                  {organization.locations.length ? (
                    <div className="modeRow" style={{ marginTop: 12 }}>
                      {organization.locations.map((location) => (
                        <span key={location.id} className={`badge ${location.isActive ? 'calm' : 'focus'}`}>
                          {location.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ marginBottom: 0 }}>No locations configured.</p>
                  )}
                </article>
              ))
            ) : (
              <p className="muted">No organizations are available yet for platform beta access.</p>
            )}
          </div>
        </section>
      </div>
    </RoleShell>
  );
}
