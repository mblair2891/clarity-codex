'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchPlatformPlans, sessionCanManagePlatformBilling, type PlatformPlan } from '../lib/beta-auth';
import { PlatformWorkspaceShell, formatMoney, usePlatformWorkspace } from './platform-workspace';

export function PlatformPlansPage() {
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

    fetchPlatformPlans(apiBaseUrl, token)
      .then((response) => {
        setPlans(response.plans);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load platform plans.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, canManageBilling]);

  return (
    <PlatformWorkspaceShell title="Plans" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Subscription plans</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>Base plans and included feature bundles</h2>
            <p className="muted consumerLead">
              These are the plan defaults the platform team can assign to organizations before billing automation is introduced.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform/subscriptions" className="primaryButton">
              Organization Subscriptions
            </Link>
            <Link href="/platform/features" className="secondaryButton">
              Feature Catalog
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
      </section>

      {!canManageBilling ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 0 }}>
            Plan management is only available to a platform admin in platform mode.
          </p>
        </section>
      ) : (
        <section className="adminPanelGrid">
          {plans.length ? (
            plans.map((plan) => (
              <article key={plan.id} className="card">
                <div className="sectionHeaderRow">
                  <div>
                    <h2 className="sectionTitle">{plan.name}</h2>
                    <p className="muted">{plan.description ?? 'No plan description is available yet.'}</p>
                  </div>
                  <span className={`statusPill ${plan.isActive ? 'success' : 'warning'}`}>
                    {plan.isActive ? 'active' : 'inactive'}
                  </span>
                </div>
                <div className="timeline" style={{ marginTop: 16 }}>
                  <article className="listItemCard">
                    <strong>{formatMoney(plan.pricing.basePriceCents, plan.pricing.currency)} base</strong>
                    <span className="muted">
                      + {formatMoney(plan.pricing.activeClientPriceCents, plan.pricing.currency)} per active client
                    </span>
                    <span className="muted">
                      + {formatMoney(plan.pricing.clinicianPriceCents, plan.pricing.currency)} per clinician
                    </span>
                    <span className="muted">{plan.organizationCount} organizations currently assigned</span>
                  </article>
                  <article className="supportPanel">
                    <strong>Included features</strong>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {plan.includedFeatures.length
                        ? plan.includedFeatures.map((feature) => feature.name).join(' • ')
                        : 'No default features are assigned yet.'}
                    </p>
                  </article>
                </div>
              </article>
            ))
          ) : (
            <article className="card">
              <p className="muted" style={{ marginBottom: 0 }}>
                {isLoading ? 'Loading plans...' : 'No plans are available yet.'}
              </p>
            </article>
          )}
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
