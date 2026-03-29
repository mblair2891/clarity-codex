'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  fetchMe,
  fetchPlatformOrganizationDetail,
  getLandingPathForSession,
  startSupportSession,
  storeToken,
  type PlatformOrganizationDetailResponse
} from '../lib/beta-auth';
import {
  PlatformWorkspaceShell,
  formatDate,
  formatDateTime,
  toneForSupportStatus,
  usePlatformWorkspace
} from './platform-workspace';

type SupportFormState = {
  locationId: string;
  reason: string;
  ticketReference: string;
};

const defaultSupportFormState: SupportFormState = {
  locationId: '',
  reason: '',
  ticketReference: ''
};

export function PlatformOrganizationDetail({ organizationId }: { organizationId: string }) {
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
  const [detail, setDetail] = useState<PlatformOrganizationDetailResponse | null>(null);
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

    fetchPlatformOrganizationDetail(apiBaseUrl, token, organizationId)
      .then((response) => {
        setDetail(response);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load this organization detail.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, organizationId]);

  const organization = detail?.organization ?? null;
  const locationOptions = organization?.locations.filter((location) => location.isActive) ?? [];

  async function handleStartSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !organization) {
      setError('Organization detail is unavailable.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    if (supportForm.reason.trim().length < 3) {
      setError('Enter a short support reason before starting a session.');
      return;
    }

    setIsStartingSupport(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await startSupportSession(apiBaseUrl, token, {
        organizationId: organization.id,
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
      setError(handleApiError(actionError, 'Unable to start a support session for this organization.'));
    } finally {
      setIsStartingSupport(false);
    }
  }

  return (
    <PlatformWorkspaceShell title="Organization Detail" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Organization detail</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              {organization?.name ?? 'Loading organization'}
            </h2>
            <p className="muted consumerLead">
              Review identity, beta subscription scaffolding, organization counts, and support access from one control-plane record.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform" className="secondaryButton">
              Back to Platform Home
            </Link>
            <Link href="/platform/support" className="secondaryButton">
              Support Tools
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      <section className="grid">
        <article className="card">
          <span className="muted">Users</span>
          <span className="metric">{organization?.counts.users ?? (isSessionLoading || isLoading ? '...' : 0)}</span>
          <p className="muted">Active organization users currently attached to this clinic.</p>
        </article>
        <article className="card">
          <span className="muted">Consumers</span>
          <span className="metric">{organization?.counts.consumers ?? (isSessionLoading || isLoading ? '...' : 0)}</span>
          <p className="muted">Consumer records under this organization.</p>
        </article>
        <article className="card">
          <span className="muted">Locations</span>
          <span className="metric">{organization?.counts.locations ?? (isSessionLoading || isLoading ? '...' : 0)}</span>
          <p className="muted">Configured locations that support team members can scope into.</p>
        </article>
        <article className="card">
          <span className="muted">Active support sessions</span>
          <span className="metric">{organization?.counts.activeSupportSessions ?? (isSessionLoading || isLoading ? '...' : 0)}</span>
          <p className="muted">Live support sessions attached to this organization.</p>
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Organization identity</h2>
              <p className="muted">Core identity and beta business metadata for this organization.</p>
            </div>
          </div>
          {organization ? (
            <div className="timeline" style={{ marginTop: 16 }}>
              <article className="listItemCard">
                <strong>{organization.name}</strong>
                <span className="muted">{organization.slug ? `/${organization.slug}` : 'Slug pending backfill'}</span>
                <span className="muted">Created {formatDate(organization.createdAt)}</span>
                <span className="muted">NPI: {organization.npi ?? 'Not set'}</span>
                <span className="muted">Tax ID: {organization.taxId ?? 'Not set'}</span>
              </article>
              <article className="supportPanel">
                <strong>Lifecycle placeholder</strong>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {detail?.lifecycle.note}
                </p>
              </article>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Loading organization identity...</p>
          )}
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Subscription scaffold</h2>
              <p className="muted">Billing and plan data is explicit here even while processor integration remains a future step.</p>
            </div>
          </div>
          {organization ? (
            <div className="timeline" style={{ marginTop: 16 }}>
              <article className="listItemCard">
                <strong>{organization.subscription.planName ?? 'Beta'}</strong>
                <span className="muted">Subscription status: {organization.subscription.subscriptionStatus}</span>
                <span className="muted">Billing status: {organization.subscription.billingStatus}</span>
              </article>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Loading subscription scaffold...</p>
          )}
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Support launcher</h2>
              <p className="muted">Start scoped support mode directly from this organization record.</p>
            </div>
          </div>
          {organization ? (
            <form onSubmit={handleStartSupport} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
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
                  placeholder="Describe the support issue, org request, or investigation."
                />
              </label>
              <label className="fieldLabel">
                Ticket or reference
                <input
                  className="inputField"
                  value={supportForm.ticketReference}
                  onChange={(event) => setSupportForm((current) => ({ ...current, ticketReference: event.target.value }))}
                  placeholder="Optional incident, ticket, or CRM reference"
                />
              </label>
              <div className="actionRow">
                <button type="submit" className="primaryButton" disabled={isStartingSupport}>
                  {isStartingSupport ? 'Starting Support Session...' : 'Start Support Session'}
                </button>
              </div>
            </form>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Loading support launcher...</p>
          )}
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Org admins</h2>
              <p className="muted">Current org-scoped administrators remain separate from platform admins and support operators.</p>
            </div>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {organization?.orgAdmins.length ? (
              organization.orgAdmins.map((admin) => (
                <article key={admin.id} className="listItemCard">
                  <strong>{admin.fullName}</strong>
                  <span className="muted">{admin.email}</span>
                  <span className={`statusPill ${admin.isActive ? 'success' : 'warning'}`}>
                    {admin.isActive ? 'active' : 'inactive'}
                  </span>
                </article>
              ))
            ) : (
              <p className="muted">No org admins are assigned yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Locations</h2>
              <p className="muted">Location scope stays available for future support restrictions and operational controls.</p>
            </div>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {organization?.locations.length ? (
              organization.locations.map((location) => (
                <article key={location.id} className="listItemCard">
                  <strong>{location.name}</strong>
                  <span className="muted">{location.timezone ?? 'Timezone not set'}</span>
                  <span className={`statusPill ${location.isActive ? 'success' : 'warning'}`}>
                    {location.isActive ? 'active' : 'inactive'}
                  </span>
                </article>
              ))
            ) : (
              <p className="muted">No locations are configured yet.</p>
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Support session history</h2>
              <p className="muted">Recent support access for this organization stays attached to the org record.</p>
            </div>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {detail?.support.recent.length ? (
              detail.support.recent.map((session) => (
                <article key={session.id} className="listItemCard">
                  <strong>{session.supportUserName}</strong>
                  <span className="muted">{session.reason ?? 'No reason recorded'}</span>
                  <div className="pillRow">
                    <span className={`statusPill ${toneForSupportStatus(session.status)}`}>{session.status}</span>
                    <span className="statusPill neutral">{formatDateTime(session.startedAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No support session history is available for this organization yet.</p>
            )}
          </div>
        </article>
      </section>
    </PlatformWorkspaceShell>
  );
}
