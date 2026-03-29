'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPlatformOrganizationSubscription,
  fetchMe,
  fetchPlatformOrganizationDetail,
  fetchPlatformOrganizationFeatures,
  fetchPlatformOrganizationSubscription,
  fetchPlatformPlans,
  getLandingPathForSession,
  sessionCanManagePlatformBilling,
  startSupportSession,
  storeToken,
  updatePlatformOrganizationFeatures,
  updatePlatformOrganizationSubscription,
  type PatchPlatformOrganizationFeaturesInput,
  type PlatformOrganizationDetailResponse,
  type PlatformOrganizationFeature,
  type PlatformPlan,
  type PlatformSubscriptionScaffold
} from '../lib/beta-auth';
import {
  PlatformWorkspaceShell,
  formatDate,
  formatDateTime,
  formatMoney,
  toneForSupportStatus,
  usePlatformWorkspace
} from './platform-workspace';

type SupportFormState = {
  locationId: string;
  reason: string;
  ticketReference: string;
};

type SubscriptionFormState = {
  planId: string;
  status: string;
  billingStatus: string;
  basePriceCents: string;
  activeClientPriceCents: string;
  clinicianPriceCents: string;
  currency: string;
  billingInterval: string;
  startsAt: string;
  currentPeriodEnd: string;
  notes: string;
};

type FeatureDraftState = Record<string, { enabled: boolean; reason: string }>;

const defaultSupportFormState: SupportFormState = {
  locationId: '',
  reason: '',
  ticketReference: ''
};

function toDateInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 10);
}

function buildSubscriptionFormState(subscription: PlatformSubscriptionScaffold | null, plans: PlatformPlan[]) {
  const fallbackPlan = plans[0] ?? null;

  if (!subscription?.id) {
    return {
      planId: fallbackPlan?.id ?? '',
      status: 'draft',
      billingStatus: 'not_configured',
      basePriceCents: String(fallbackPlan?.pricing.basePriceCents ?? 0),
      activeClientPriceCents: String(fallbackPlan?.pricing.activeClientPriceCents ?? 0),
      clinicianPriceCents: String(fallbackPlan?.pricing.clinicianPriceCents ?? 0),
      currency: fallbackPlan?.pricing.currency ?? 'usd',
      billingInterval: fallbackPlan?.pricing.billingInterval ?? 'month',
      startsAt: '',
      currentPeriodEnd: '',
      notes: ''
    };
  }

  return {
    planId: subscription.planId ?? '',
    status: subscription.subscriptionStatus,
    billingStatus: subscription.billingStatus,
    basePriceCents: String(subscription.basePriceCents),
    activeClientPriceCents: String(subscription.activeClientPriceCents),
    clinicianPriceCents: String(subscription.clinicianPriceCents),
    currency: subscription.currency,
    billingInterval: subscription.billingInterval,
    startsAt: toDateInputValue(subscription.startsAt),
    currentPeriodEnd: toDateInputValue(subscription.currentPeriodEnd),
    notes: subscription.notes ?? ''
  };
}

function buildFeatureDrafts(features: PlatformOrganizationFeature[]): FeatureDraftState {
  return Object.fromEntries(
    features.map((feature) => [
      feature.id,
      {
        enabled: feature.enabled,
        reason: feature.override?.reason ?? ''
      }
    ])
  );
}

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
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [managedSubscription, setManagedSubscription] = useState<PlatformSubscriptionScaffold | null>(null);
  const [organizationFeatures, setOrganizationFeatures] = useState<PlatformOrganizationFeature[]>([]);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>(buildSubscriptionFormState(null, []));
  const [featureDrafts, setFeatureDrafts] = useState<FeatureDraftState>({});
  const [supportForm, setSupportForm] = useState<SupportFormState>(defaultSupportFormState);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingSupport, setIsStartingSupport] = useState(false);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [isSavingFeatures, setIsSavingFeatures] = useState(false);

  const canManageBilling = Boolean(me && sessionCanManagePlatformBilling(me));
  const organization = detail?.organization ?? null;
  const locationOptions = organization?.locations.filter((location) => location.isActive) ?? [];

  async function loadPlatformAdminData(token: string) {
    if (!apiBaseUrl || !canManageBilling) {
      return;
    }

    const [plansResponse, subscriptionResponse, featuresResponse] = await Promise.all([
      fetchPlatformPlans(apiBaseUrl, token),
      fetchPlatformOrganizationSubscription(apiBaseUrl, token, organizationId),
      fetchPlatformOrganizationFeatures(apiBaseUrl, token, organizationId)
    ]);

    setPlans(plansResponse.plans);
    setManagedSubscription(subscriptionResponse.subscription);
    setOrganizationFeatures(featuresResponse.features);
    setSubscriptionForm(buildSubscriptionFormState(subscriptionResponse.subscription, plansResponse.plans));
    setFeatureDrafts(buildFeatureDrafts(featuresResponse.features));
  }

  useEffect(() => {
    if (!apiBaseUrl || !me) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsLoading(true);

    const loaders = [
      fetchPlatformOrganizationDetail(apiBaseUrl, token, organizationId).then((response) => {
        setDetail(response);
      })
    ];

    if (canManageBilling) {
      loaders.push(loadPlatformAdminData(token));
    } else {
      setPlans([]);
      setManagedSubscription(null);
      setOrganizationFeatures([]);
      setFeatureDrafts({});
    }

    Promise.all(loaders)
      .then(() => {
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load this organization detail.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, organizationId, canManageBilling]);

  const activeSubscription = managedSubscription ?? organization?.subscription ?? null;
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === subscriptionForm.planId) ?? null,
    [plans, subscriptionForm.planId]
  );

  async function refreshManagedData(token: string) {
    if (!apiBaseUrl || !canManageBilling) {
      return;
    }

    const [subscriptionResponse, featuresResponse] = await Promise.all([
      fetchPlatformOrganizationSubscription(apiBaseUrl, token, organizationId),
      fetchPlatformOrganizationFeatures(apiBaseUrl, token, organizationId)
    ]);

    setManagedSubscription(subscriptionResponse.subscription);
    setOrganizationFeatures(featuresResponse.features);
    setFeatureDrafts(buildFeatureDrafts(featuresResponse.features));
    setSubscriptionForm(buildSubscriptionFormState(subscriptionResponse.subscription, plans));
  }

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

  async function handleSaveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl || !organization || !canManageBilling) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsSavingSubscription(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        planId: subscriptionForm.planId || null,
        status: subscriptionForm.status,
        billingStatus: subscriptionForm.billingStatus.trim(),
        basePriceCents: Number(subscriptionForm.basePriceCents || '0'),
        activeClientPriceCents: Number(subscriptionForm.activeClientPriceCents || '0'),
        clinicianPriceCents: Number(subscriptionForm.clinicianPriceCents || '0'),
        currency: subscriptionForm.currency.trim().toLowerCase() || 'usd',
        billingInterval: subscriptionForm.billingInterval.trim() || 'month',
        startsAt: subscriptionForm.startsAt ? new Date(`${subscriptionForm.startsAt}T00:00:00.000Z`).toISOString() : undefined,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd
          ? new Date(`${subscriptionForm.currentPeriodEnd}T00:00:00.000Z`).toISOString()
          : null,
        notes: subscriptionForm.notes.trim() || null
      };

      if (managedSubscription?.id) {
        await updatePlatformOrganizationSubscription(apiBaseUrl, token, organization.id, payload);
      } else {
        await createPlatformOrganizationSubscription(apiBaseUrl, token, organization.id, {
          ...payload,
          startsAt: payload.startsAt ?? new Date().toISOString()
        });
      }

      await refreshManagedData(token);
      setSuccess(`Saved subscription settings for ${organization.name}.`);
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to save this subscription.'));
    } finally {
      setIsSavingSubscription(false);
    }
  }

  async function handleSaveFeatureOverrides() {
    if (!apiBaseUrl || !organization || !canManageBilling) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    const overrides = organizationFeatures.reduce<PatchPlatformOrganizationFeaturesInput['overrides']>((items, feature) => {
      const draft = featureDrafts[feature.id];
      if (!draft) {
        return items;
      }

      const originalReason = feature.override?.reason ?? '';
      if (draft.enabled !== feature.enabled || draft.reason !== originalReason) {
        items.push({
          featureId: feature.id,
          enabled: draft.enabled,
          reason: draft.reason.trim() || null
        });
      }

      return items;
    }, []);

    if (!overrides.length) {
      setSuccess('No feature override changes to save.');
      return;
    }

    setIsSavingFeatures(true);
    setError(null);
    setSuccess(null);

    try {
      await updatePlatformOrganizationFeatures(apiBaseUrl, token, organization.id, {
        overrides
      });
      await refreshManagedData(token);
      setSuccess(`Saved feature overrides for ${organization.name}.`);
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to save feature overrides.'));
    } finally {
      setIsSavingFeatures(false);
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
              Review identity, subscription configuration, effective feature entitlements, and support access from one control-plane record.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform" className="secondaryButton">
              Back to Platform Home
            </Link>
            {canManageBilling ? (
              <Link href="/platform/subscriptions" className="secondaryButton">
                Subscription Queue
              </Link>
            ) : null}
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
          <span className="muted">Plan</span>
          <span className="metric" style={{ fontSize: 24 }}>{activeSubscription?.planName ?? 'Unassigned'}</span>
          <p className="muted">
            {activeSubscription?.subscriptionStatus === 'not_configured'
              ? 'No organization subscription has been configured yet.'
              : `${activeSubscription?.subscriptionStatus ?? 'draft'} subscription`}
          </p>
        </article>
      </section>

      <section className="adminPanelGrid">
        <article className="card">
          <div className="sectionHeaderRow">
            <div>
              <h2 className="sectionTitle">Organization identity</h2>
              <p className="muted">Core identity and tenant metadata for this organization.</p>
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
              <h2 className="sectionTitle">Subscription summary</h2>
              <p className="muted">Base plan and hybrid pricing fields live here even before payment processor automation.</p>
            </div>
          </div>
          {activeSubscription ? (
            <div className="timeline" style={{ marginTop: 16 }}>
              <article className="listItemCard">
                <strong>{activeSubscription.planName ?? 'Unassigned plan'}</strong>
                <span className="muted">Status: {activeSubscription.subscriptionStatus}</span>
                <span className="muted">Billing: {activeSubscription.billingStatus}</span>
                <span className="muted">
                  Base {formatMoney(activeSubscription.basePriceCents, activeSubscription.currency)}
                  {' '}+ Active client {formatMoney(activeSubscription.activeClientPriceCents, activeSubscription.currency)}
                  {' '}+ Clinician {formatMoney(activeSubscription.clinicianPriceCents, activeSubscription.currency)}
                </span>
              </article>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 16 }}>Loading subscription summary...</p>
          )}
        </article>
      </section>

      {canManageBilling ? (
        <section className="adminPanelGrid">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Manage subscription</h2>
                <p className="muted">Assign a plan, set pricing fields, and control the organization subscription status.</p>
              </div>
            </div>
            <form onSubmit={handleSaveSubscription} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
              <label className="fieldLabel">
                Plan
                <select
                  className="inputField"
                  value={subscriptionForm.planId}
                  onChange={(event) => {
                    const nextPlan = plans.find((plan) => plan.id === event.target.value) ?? null;
                    setSubscriptionForm((current) => ({
                      ...current,
                      planId: event.target.value,
                      basePriceCents: String(nextPlan?.pricing.basePriceCents ?? current.basePriceCents),
                      activeClientPriceCents: String(nextPlan?.pricing.activeClientPriceCents ?? current.activeClientPriceCents),
                      clinicianPriceCents: String(nextPlan?.pricing.clinicianPriceCents ?? current.clinicianPriceCents),
                      currency: nextPlan?.pricing.currency ?? current.currency,
                      billingInterval: nextPlan?.pricing.billingInterval ?? current.billingInterval
                    }));
                  }}
                >
                  <option value="">No assigned plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid">
                <label className="fieldLabel">
                  Subscription status
                  <select
                    className="inputField"
                    value={subscriptionForm.status}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    {['draft', 'trialing', 'active', 'past_due', 'suspended', 'canceled'].map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fieldLabel">
                  Billing status
                  <input
                    className="inputField"
                    value={subscriptionForm.billingStatus}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingStatus: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Base price (cents)
                  <input
                    type="number"
                    min="0"
                    className="inputField"
                    value={subscriptionForm.basePriceCents}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, basePriceCents: event.target.value }))}
                  />
                </label>
                <label className="fieldLabel">
                  Active client price (cents)
                  <input
                    type="number"
                    min="0"
                    className="inputField"
                    value={subscriptionForm.activeClientPriceCents}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, activeClientPriceCents: event.target.value }))}
                  />
                </label>
                <label className="fieldLabel">
                  Clinician price (cents)
                  <input
                    type="number"
                    min="0"
                    className="inputField"
                    value={subscriptionForm.clinicianPriceCents}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, clinicianPriceCents: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Currency
                  <input
                    className="inputField"
                    value={subscriptionForm.currency}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, currency: event.target.value }))}
                  />
                </label>
                <label className="fieldLabel">
                  Billing interval
                  <input
                    className="inputField"
                    value={subscriptionForm.billingInterval}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingInterval: event.target.value }))}
                  />
                </label>
                <label className="fieldLabel">
                  Starts at
                  <input
                    type="date"
                    className="inputField"
                    value={subscriptionForm.startsAt}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, startsAt: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Current period end
                  <input
                    type="date"
                    className="inputField"
                    value={subscriptionForm.currentPeriodEnd}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, currentPeriodEnd: event.target.value }))}
                  />
                </label>
                <label className="fieldLabel">
                  Notes
                  <textarea
                    className="inputField textareaField"
                    value={subscriptionForm.notes}
                    onChange={(event) => setSubscriptionForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional billing or contract notes"
                  />
                </label>
              </div>

              {selectedPlan ? (
                <div className="supportPanel">
                  <strong>{selectedPlan.name} defaults</strong>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Base {formatMoney(selectedPlan.pricing.basePriceCents, selectedPlan.pricing.currency)}
                    {' '}• Active client {formatMoney(selectedPlan.pricing.activeClientPriceCents, selectedPlan.pricing.currency)}
                    {' '}• Clinician {formatMoney(selectedPlan.pricing.clinicianPriceCents, selectedPlan.pricing.currency)}
                  </p>
                </div>
              ) : null}

              <div className="actionRow">
                <button type="submit" className="primaryButton" disabled={isSavingSubscription}>
                  {isSavingSubscription ? 'Saving subscription...' : managedSubscription?.id ? 'Save subscription' : 'Create subscription'}
                </button>
              </div>
            </form>
          </article>

          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Effective feature access</h2>
                <p className="muted">Plan-included modules can be overridden per organization without changing the shared plan catalog.</p>
              </div>
            </div>
            <div className="timeline" style={{ marginTop: 16 }}>
              {organizationFeatures.length ? (
                organizationFeatures.map((feature) => {
                  const draft = featureDrafts[feature.id] ?? {
                    enabled: feature.enabled,
                    reason: feature.override?.reason ?? ''
                  };

                  return (
                    <article key={feature.id} className="listItemCard">
                      <div className="sectionHeaderRow">
                        <div>
                          <strong>{feature.name}</strong>
                          <p className="muted" style={{ marginBottom: 0 }}>
                            {feature.description ?? 'No feature description is available yet.'}
                          </p>
                        </div>
                        <div className="pillRow">
                          <span className={`statusPill ${draft.enabled ? 'success' : 'warning'}`}>
                            {draft.enabled ? 'enabled' : 'disabled'}
                          </span>
                          <span className="statusPill neutral">
                            {feature.includedInPlan ? 'included in plan' : 'not in plan'}
                          </span>
                        </div>
                      </div>
                      <label className="fieldLabel" style={{ marginTop: 12 }}>
                        <span className="muted">Enable for this organization</span>
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) =>
                            setFeatureDrafts((current) => ({
                              ...current,
                              [feature.id]: {
                                ...current[feature.id],
                                enabled: event.target.checked
                              }
                            }))}
                        />
                      </label>
                      <label className="fieldLabel">
                        Override reason
                        <input
                          className="inputField"
                          value={draft.reason}
                          onChange={(event) =>
                            setFeatureDrafts((current) => ({
                              ...current,
                              [feature.id]: {
                                enabled: current[feature.id]?.enabled ?? feature.enabled,
                                reason: event.target.value
                              }
                            }))}
                          placeholder="Optional reason for enable/disable override"
                        />
                      </label>
                    </article>
                  );
                })
              ) : (
                <p className="muted">Loading feature entitlements...</p>
              )}
            </div>
            <div className="actionRow" style={{ marginTop: 16 }}>
              <button type="button" className="primaryButton" disabled={isSavingFeatures} onClick={handleSaveFeatureOverrides}>
                {isSavingFeatures ? 'Saving features...' : 'Save feature overrides'}
              </button>
            </div>
          </article>
        </section>
      ) : (
        <section className="card">
          <h2 className="sectionTitle">Subscription management</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Subscription plans, pricing fields, and organization-level feature overrides are reserved for platform admins in the platform control plane.
          </p>
        </section>
      )}

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
