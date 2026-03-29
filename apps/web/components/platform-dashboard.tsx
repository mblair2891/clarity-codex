'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchPlatformDashboard,
  type PlatformDashboardResponse
} from '../lib/beta-auth';
import {
  PlatformWorkspaceShell,
  formatDate,
  formatDateTime,
  formatRoleLabel,
  toneForSupportStatus,
  usePlatformWorkspace
} from './platform-workspace';

export function PlatformDashboard() {
  const {
    apiBaseUrl,
    me,
    error,
    setError,
    isSessionLoading,
    getTokenOrRedirect,
    handleLogout,
    handleEndSupport,
    handleApiError
  } = usePlatformWorkspace();
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  useEffect(() => {
    if (!apiBaseUrl || !me) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsLoadingDashboard(true);

    fetchPlatformDashboard(apiBaseUrl, token)
      .then((response) => {
        setDashboard(response);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load the platform control plane.'));
      })
      .finally(() => {
        setIsLoadingDashboard(false);
      });
  }, [apiBaseUrl, me]);

  const canManageOrganizations = Boolean(me?.accessContext.platformRoles.includes('platform_admin'));

  return (
    <PlatformWorkspaceShell title="Platform Control" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">SaaS control plane</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              {me ? `Clarity platform control for ${me.user.fullName.split(' ')[0]}` : 'Loading platform control plane'}
            </h2>
            <p className="muted consumerLead">
              Manage organizations, review platform access, monitor support activity, and keep support mode available as a scoped tool instead of the entire platform surface.
            </p>
          </div>
          <div className="pillRow">
            <span className="statusPill success">{me?.accessContext.platformRoles.join(' + ') || 'Loading roles'}</span>
            <span className="statusPill neutral">{dashboard?.tenant.name ?? me?.tenant.name ?? 'Loading tenant'}</span>
            <span className={`statusPill ${me?.accessContext.supportMode ? 'warning' : 'focus'}`}>
              {me?.accessContext.supportMode ? 'Support mode active' : 'Platform mode active'}
            </span>
          </div>
        </div>
        <div className="actionRow">
          {canManageOrganizations ? (
            <Link href="/platform/organizations/new" className="primaryButton">
              Create Organization
            </Link>
          ) : null}
          {canManageOrganizations ? (
            <Link href="/platform/settings" className="secondaryButton">
              Platform Settings
            </Link>
          ) : null}
          <Link href="/platform/support" className="secondaryButton">
            Open Support Tools
          </Link>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
      </section>

      <section className="grid">
        <article className="card">
          <span className="muted">Organizations</span>
          <span className="metric">{dashboard?.summary.totalOrganizations ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Organizations currently managed by the Clarity platform team.</p>
        </article>
        <article className="card">
          <span className="muted">Platform users</span>
          <span className="metric">{dashboard?.summary.totalPlatformUsers ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Platform admins and support operators with control-plane access.</p>
        </article>
        <article className="card">
          <span className="muted">Org users</span>
          <span className="metric">{dashboard?.summary.totalOrgUsers ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Users attached to clinic organizations across the tenant.</p>
        </article>
        <article className="card">
          <span className="muted">Consumers</span>
          <span className="metric">{dashboard?.summary.totalConsumers ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Consumer records in the platform footprint.</p>
        </article>
        <article className="card">
          <span className="muted">Active support sessions</span>
          <span className="metric">{dashboard?.summary.activeSupportSessions ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Scoped org support sessions that are live right now.</p>
        </article>
        <article className="card">
          <span className="muted">Subscriptions</span>
          <span className="metric">{dashboard?.summary.subscriptionsByStatus[0]?.count ?? (isSessionLoading || isLoadingDashboard ? '...' : 0)}</span>
          <p className="muted">Billing is scaffolded for beta, so organizations currently sit in a not-configured status bucket.</p>
        </article>
      </section>

      {me?.accessContext.supportMode ? (
        <section className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Support session active</h2>
              <p className="muted">Your current login is attached to an organization support session. Jump into the org workspace or end the session from the banner above.</p>
            </div>
            <div className="actionRow">
              <Link href="/admin" className="primaryButton">
                Open Org Admin
              </Link>
              <Link href="/platform/support" className="secondaryButton">
                Support Tools
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Organization management</h2>
              <p className="muted">This is the control-plane list for creating organizations, opening detail pages, and launching support access without treating support mode as the entire platform.</p>
            </div>
            <span className="statusPill neutral">{dashboard?.organizations.length ?? 0} orgs</span>
          </div>
          <div className="resourceList" style={{ marginTop: 16 }}>
            {dashboard?.organizations.length ? (
              dashboard.organizations.map((organization) => (
                <article key={organization.id} className="resourceRow">
                  <div className="resourceRowPrimary">
                    <strong>{organization.name}</strong>
                    <span className="muted">
                      {organization.slug ? `/${organization.slug}` : 'Slug pending backfill'} • Created {formatDate(organization.createdAt)}
                    </span>
                    <span className="muted">
                      {organization.counts.users} users • {organization.counts.consumers} consumers • {organization.counts.locations} locations
                    </span>
                  </div>
                  <div className="actionRow">
                    <Link href={`/platform/organizations/${organization.id}`} className="secondaryButton">
                      View Detail
                    </Link>
                    <Link href={`/platform/support?organizationId=${organization.id}`} className="primaryButton">
                      Start Support
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="emptyState">
                <strong>No organizations yet</strong>
                <span className="muted">Create the first organization to start the beta platform flow.</span>
              </div>
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Billing and plan scaffolding</h2>
              <p className="muted">The control plane now carries explicit SaaS subscription placeholders, even before real billing automation is wired in.</p>
            </div>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {dashboard?.billing.plans.map((plan) => (
              <article key={plan.name} className="listItemCard">
                <strong>{plan.name}</strong>
                <span className="muted">{plan.organizationCount} organizations assigned to this scaffolded plan</span>
              </article>
            ))}
            {dashboard?.billing.subscriptionsByStatus.map((item) => (
              <article key={item.status} className="listItemCard">
                <strong>{formatRoleLabel(item.status)}</strong>
                <span className="muted">{item.count} subscriptions in this bucket</span>
              </article>
            ))}
            <article className="supportPanel">
              <strong>Beta billing note</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                {dashboard?.billing.note ?? 'Loading billing scaffolding...'}
              </p>
            </article>
          </div>
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Platform users</h2>
              <p className="muted">Control-plane identities stay separate from organization admins, even when they can launch support mode.</p>
            </div>
            <Link href="/platform/support" className="secondaryButton">
              Support Section
            </Link>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {dashboard?.platformUsers.length ? (
              dashboard.platformUsers.map((user) => (
                <article key={user.id} className="listItemCard">
                  <strong>{user.fullName}</strong>
                  <span className="muted">{user.email}</span>
                  <span className="muted">
                    {user.platformRoles.length ? user.platformRoles.map(formatRoleLabel).join(' • ') : formatRoleLabel(user.role)}
                  </span>
                  <span className={`statusPill ${user.isActive ? 'success' : 'warning'}`}>
                    {user.isActive ? 'active' : 'inactive'}
                  </span>
                </article>
              ))
            ) : (
              <p className="muted">No platform users are available yet.</p>
            )}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Support tools</h2>
              <p className="muted">Support is now a module inside platform admin. Recent sessions stay visible here, but the full launcher lives in its own section.</p>
            </div>
            <Link href="/platform/support" className="primaryButton">
              Open Support Tools
            </Link>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            {dashboard?.support.recent.length ? (
              dashboard.support.recent.map((session) => (
                <article key={session.id} className="listItemCard">
                  <strong>{session.supportUserName}</strong>
                  <span className="muted">
                    {session.organizationName ?? dashboard.organizations.find((organization) => organization.id === session.organizationId)?.name ?? 'Organization'}
                  </span>
                  <span className="muted">{session.reason ?? 'No support reason provided'}</span>
                  <div className="pillRow">
                    <span className={`statusPill ${toneForSupportStatus(session.status)}`}>{session.status}</span>
                    <span className="statusPill neutral">{formatDateTime(session.startedAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No support sessions have been recorded yet.</p>
            )}
          </div>
        </article>
      </section>

      {canManageOrganizations ? (
        <section className="adminPanelGrid">
          <article className="card dangerCard">
            <div className="sectionHeaderRow">
              <div>
                <p className="eyebrow">Danger zone</p>
                <h2 className="sectionTitle">System Reset</h2>
                <p className="muted">Platform Admin-only destructive controls now live in Platform Settings instead of the org-style admin workspace.</p>
              </div>
              <Link href="/platform/settings" className="dangerButton">
                Open Platform Settings
              </Link>
            </div>
          </article>
        </section>
      ) : null}
    </PlatformWorkspaceShell>
  );
}
