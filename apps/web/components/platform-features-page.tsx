'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchPlatformFeatures, fetchPlatformPlans, sessionCanManagePlatformBilling, type PlatformFeature, type PlatformPlan } from '../lib/beta-auth';
import { PlatformWorkspaceShell, usePlatformWorkspace } from './platform-workspace';

export function PlatformFeaturesPage() {
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
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
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

    Promise.all([
      fetchPlatformFeatures(apiBaseUrl, token),
      fetchPlatformPlans(apiBaseUrl, token)
    ])
      .then(([featuresResponse, plansResponse]) => {
        setFeatures(featuresResponse.features);
        setPlans(plansResponse.plans);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load the feature catalog.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, canManageBilling]);

  return (
    <PlatformWorkspaceShell title="Features" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Feature catalog</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>Platform-managed modules and entitlements</h2>
            <p className="muted consumerLead">
              This is the catalog used for plan bundles and organization-level overrides.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform/plans" className="secondaryButton">
              Plans
            </Link>
            <Link href="/platform/subscriptions" className="primaryButton">
              Subscriptions
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
      </section>

      {!canManageBilling ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 0 }}>
            Feature management is only available to a platform admin in platform mode.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="timeline" style={{ marginTop: 0 }}>
            {features.length ? (
              features.map((feature) => {
                const includedInPlans = plans
                  .filter((plan) => plan.includedFeatures.some((planFeature) => planFeature.id === feature.id))
                  .map((plan) => plan.name);

                return (
                  <article key={feature.id} className="listItemCard">
                    <strong>{feature.name}</strong>
                    <span className="muted">{feature.key}</span>
                    <span className="muted">{feature.description ?? 'No feature description is available yet.'}</span>
                    <span className="muted">
                      Included in: {includedInPlans.length ? includedInPlans.join(' • ') : 'No default plan assignments'}
                    </span>
                    <span className={`statusPill ${feature.isActive ? 'success' : 'warning'}`}>
                      {feature.isActive ? 'active' : 'inactive'}
                    </span>
                  </article>
                );
              })
            ) : (
              <p className="muted">{isLoading ? 'Loading feature catalog...' : 'No features are available yet.'}</p>
            )}
          </div>
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
