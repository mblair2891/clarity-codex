'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchPlatformSubscriptions, sessionCanManagePlatformBilling, type PlatformSubscriptionsResponse } from '../lib/beta-auth';
import { PlatformWorkspaceShell, formatDate, formatMoney, usePlatformWorkspace } from './platform-workspace';

export function PlatformSubscriptionsPage() {
  const {
    apiBaseUrl,
    me,
    error,
    setError,
    getTokenOrRedirect,
    handleLogout,
    handleEndSupport,
    handleApiError
  } = usePlatformWorkspace();
  const [subscriptions, setSubscriptions] = useState<PlatformSubscriptionsResponse['subscriptions']>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManageBilling = Boolean(me && sessionCanManagePlatformBilling(me));

  useEffect(() => {
    if (!apiBaseUrl || !me || !canManageBilling) {
      setIsLoading(false);
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsLoading(true);

    fetchPlatformSubscriptions(apiBaseUrl, token)
      .then((response) => {
        setSubscriptions(response.subscriptions);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load organization subscriptions.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, canManageBilling]);

  return (
    <PlatformWorkspaceShell title="Subscriptions" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Organization subscriptions</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>Hybrid pricing rollout across organizations</h2>
            <p className="muted consumerLead">
              Review which clinics have plans assigned, what pricing they carry, and which organizations still need a first subscription record.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform/plans" className="secondaryButton">
              View Plans
            </Link>
            <Link href="/platform/features" className="secondaryButton">
              View Features
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
      </section>

      {!canManageBilling ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 0 }}>
            Subscription management is only available to a platform admin in platform mode.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="resourceList" style={{ marginTop: 0 }}>
            {subscriptions.length ? (
              subscriptions.map((entry) => (
                <article key={entry.organization.id} className="resourceRow">
                  <div className="resourceRowPrimary">
                    <strong>{entry.organization.name}</strong>
                    <span className="muted">
                      {entry.organization.slug ? `/${entry.organization.slug}` : 'Slug pending backfill'} • Created {formatDate(entry.organization.createdAt)}
                    </span>
                    <span className="muted">
                      {entry.subscription.planName ?? 'No plan assigned'} • {entry.subscription.subscriptionStatus}
                    </span>
                    <span className="muted">
                      Base {formatMoney(entry.subscription.basePriceCents, entry.subscription.currency)}
                      {' '}• Active client {formatMoney(entry.subscription.activeClientPriceCents, entry.subscription.currency)}
                      {' '}• Clinician {formatMoney(entry.subscription.clinicianPriceCents, entry.subscription.currency)}
                    </span>
                  </div>
                  <div className="actionRow">
                    <span className={`statusPill ${entry.subscription.subscriptionStatus === 'active' ? 'success' : 'neutral'}`}>
                      {entry.subscription.subscriptionStatus}
                    </span>
                    <Link href={`/platform/organizations/${entry.organization.id}`} className="primaryButton">
                      Manage
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="emptyState">
                <strong>{isLoading ? 'Loading subscriptions...' : 'No organizations available'}</strong>
                <span className="muted">Once organizations exist, their subscription records will appear here.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
