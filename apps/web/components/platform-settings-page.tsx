'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiResponseError,
  clearStoredToken,
  fetchPlatformDashboard,
  resetSystemData,
  type PlatformDashboardResponse,
  type ResetSystemResponse
} from '../lib/beta-auth';
import { PlatformWorkspaceShell, usePlatformWorkspace } from './platform-workspace';

const requiredConfirmationText = 'RESET SYSTEM';

function buildResetSuccessMessage(result: ResetSystemResponse) {
  const deletedRecords = Object.values(result.deleted).reduce((total, value) => total + value, 0);
  return `System reset complete. Preserved ${result.preserved.user.email} and removed ${deletedRecords} records.`;
}

export function PlatformSettingsPage() {
  const {
    apiBaseUrl,
    router,
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
  const [confirmationText, setConfirmationText] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetSystemResponse | null>(null);

  const canResetSystem = Boolean(
    me?.accessContext.platformRoles.includes('platform_admin') && !me.accessContext.supportMode && !me.accessContext.activeOrganizationId
  );

  useEffect(() => {
    if (!isSessionLoading && me && !canResetSystem) {
      router.replace('/platform');
    }
  }, [canResetSystem, isSessionLoading, me, router]);

  useEffect(() => {
    if (!apiBaseUrl || !me || !canResetSystem) {
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
        setError(handleApiError(loadError, 'Unable to load platform settings right now.'));
      })
      .finally(() => {
        setIsLoadingDashboard(false);
      });
  }, [apiBaseUrl, canResetSystem, me, setError]);

  const impactSummary = useMemo(
    () => [
      `${dashboard?.summary.totalOrganizations ?? 0} organizations`,
      `${dashboard?.summary.totalOrgUsers ?? 0} org-scoped users`,
      `${dashboard?.summary.totalConsumers ?? 0} consumers`,
      `${dashboard?.summary.activeSupportSessions ?? 0} active support sessions`
    ],
    [dashboard]
  );

  async function handleResetSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !canResetSystem) {
      setError('System Reset is only available to Platform Admin from the platform control plane.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsResetting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await resetSystemData(apiBaseUrl, token, confirmationText);
      setResetResult(result);
      setSuccess(buildResetSuccessMessage(result));
      setConfirmationText('');
      setIsConfirmModalOpen(false);

      try {
        const refreshedDashboard = await fetchPlatformDashboard(apiBaseUrl, token);
        setDashboard(refreshedDashboard);
      } catch (refreshError) {
        if (refreshError instanceof ApiResponseError && refreshError.status === 401) {
          clearStoredToken();
          setSuccess('System reset complete. Your platform session was cleared by the reset. Redirecting to sign in.');
          window.setTimeout(() => {
            router.replace('/login');
          }, 1200);
          return;
        }

        throw refreshError;
      }
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to reset the platform test data.'));
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <PlatformWorkspaceShell title="Platform Settings" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Platform control plane</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              Platform settings and destructive controls
            </h2>
            <p className="muted consumerLead">
              This area is reserved for Platform Admin controls that act on the whole platform footprint without entering support mode or org-scoped admin.
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

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Access boundary</h2>
              <p className="muted">System Reset belongs to Platform Admin only and runs from platform mode.</p>
            </div>
            <span className="statusPill warning">Danger zone</span>
          </div>
          <div className="timeline" style={{ marginTop: 16 }}>
            <article className="listItemCard">
              <strong>Allowed</strong>
              <span className="muted">Platform Admin in the platform control plane.</span>
            </article>
            <article className="listItemCard">
              <strong>Blocked</strong>
              <span className="muted">Platform Support, Organization Admin, and any support-mode session.</span>
            </article>
            <article className="listItemCard">
              <strong>Impact snapshot</strong>
              <span className="muted">{isLoadingDashboard ? 'Loading current platform state...' : impactSummary.join(' • ')}</span>
            </article>
          </div>
        </article>

        <article className="card dangerCard">
          <div className="sectionHeaderRow">
            <div>
              <p className="eyebrow">System Reset</p>
              <h2 className="sectionTitle">Clear non-essential platform and org test data</h2>
              <p className="muted">
                This clears non-essential platform and organization test data, including support sessions, org-scoped users, consumers,
                clinical activity, billing artifacts, prompts, and AI run history while preserving Platform Admin access.
              </p>
            </div>
            <span className="statusPill warning">Platform Admin only</span>
          </div>

          <div className="timeline" style={{ marginTop: 16 }}>
            <article className="listItemCard">
              <strong>Typed confirmation required</strong>
              <span className="muted">Type <strong>{requiredConfirmationText}</strong> exactly before the final confirmation step unlocks.</span>
            </article>
            <article className="listItemCard">
              <strong>Session behavior</strong>
              <span className="muted">If the backend clears the current session during reset, this page will redirect cleanly to sign-in after reporting success.</span>
            </article>
            <article className="listItemCard">
              <strong>Audit trail</strong>
              <span className="muted">A platform-scoped audit event is recorded for the reset action with actor and timing metadata.</span>
            </article>
          </div>

          <form onSubmit={(event) => event.preventDefault()} className="consumerStack" style={{ gap: 16, marginTop: 20 }}>
            <label className="fieldLabel">
              Type {requiredConfirmationText}
              <input
                className="inputField"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={requiredConfirmationText}
                autoComplete="off"
              />
            </label>
            <div className="actionRow">
              <button
                type="button"
                className="dangerButton"
                disabled={confirmationText !== requiredConfirmationText || isResetting}
                onClick={() => setIsConfirmModalOpen(true)}
              >
                Open Final Confirmation
              </button>
              <span className="muted">The action stays disabled until the confirmation text matches exactly.</span>
            </div>
          </form>

          {resetResult ? (
            <div className="adminSectionGrid" style={{ marginTop: 20 }}>
              <article className="listItemCard">
                <strong>Remaining organizations</strong>
                <span className="metric" style={{ fontSize: 24 }}>{resetResult.remaining.organizations}</span>
                <span className="muted">{resetResult.remaining.users} users remain</span>
              </article>
              <article className="listItemCard">
                <strong>Remaining consumers</strong>
                <span className="metric" style={{ fontSize: 24 }}>{resetResult.remaining.consumers}</span>
                <span className="muted">{resetResult.remaining.appointments} appointments remain</span>
              </article>
              <article className="listItemCard">
                <strong>Remaining billing items</strong>
                <span className="metric" style={{ fontSize: 24 }}>{resetResult.remaining.billingWorkItems}</span>
                <span className="muted">{resetResult.remaining.claims} claims remain</span>
              </article>
              <article className="listItemCard">
                <strong>Preserved Platform Admin</strong>
                <span className="metric" style={{ fontSize: 24 }}>{resetResult.preserved.tenant.slug}</span>
                <span className="muted">{resetResult.preserved.user.email}</span>
              </article>
            </div>
          ) : null}
        </article>
      </section>

      {isConfirmModalOpen ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="card modalCard">
            <div>
              <p className="eyebrow">Final confirmation</p>
              <h2 className="sectionTitle">Run System Reset</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                This action cannot be undone. Confirm that you want to clear non-essential test data across the platform while preserving
                Platform Admin access.
              </p>
            </div>
            <form onSubmit={handleResetSystem} className="consumerStack" style={{ gap: 16 }}>
              <div className="listItemCard">
                <strong>Confirmation text</strong>
                <span className="muted">{confirmationText || 'No confirmation text entered.'}</span>
              </div>
              <div className="actionRow" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={isResetting}
                  onClick={() => setIsConfirmModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="dangerButton" disabled={isResetting || confirmationText !== requiredConfirmationText}>
                  {isResetting ? 'Resetting system...' : 'Confirm System Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PlatformWorkspaceShell>
  );
}
