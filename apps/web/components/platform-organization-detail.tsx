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
  annualBasePriceCents: string;
  setupFeeCents: string;
  activeClientPriceCents: string;
  clinicianPriceCents: string;
  includedActiveClients: string;
  includedClinicians: string;
  currency: string;
  billingInterval: string;
  startsAt: string;
  trialStartsAt: string;
  trialEndsAt: string;
  currentPeriodEnd: string;
  billingContactEmail: string;
  notes: string;
  customPricingEnabled: boolean;
  enterpriseManaged: boolean;
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

function stringifyOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function buildSubscriptionFormState(subscription: PlatformSubscriptionScaffold | null, plans: PlatformPlan[]) {
  const fallbackPlan = plans[0] ?? null;

  if (!subscription?.id) {
    return {
      planId: fallbackPlan?.id ?? '',
      status: 'draft',
      billingStatus: 'not_configured',
      basePriceCents: stringifyOptionalNumber(fallbackPlan?.pricing.basePriceCents ?? 0),
      annualBasePriceCents: stringifyOptionalNumber(fallbackPlan?.pricing.annualBasePriceCents),
      setupFeeCents: stringifyOptionalNumber(fallbackPlan?.pricing.setupFeeCents),
      activeClientPriceCents: stringifyOptionalNumber(fallbackPlan?.pricing.activeClientPriceCents ?? 0),
      clinicianPriceCents: stringifyOptionalNumber(fallbackPlan?.pricing.clinicianPriceCents ?? 0),
      includedActiveClients: stringifyOptionalNumber(fallbackPlan?.pricing.includedActiveClients),
      includedClinicians: stringifyOptionalNumber(fallbackPlan?.pricing.includedClinicians),
      currency: fallbackPlan?.pricing.currency ?? 'usd',
      billingInterval: fallbackPlan?.pricing.billingInterval ?? 'month',
      startsAt: '',
      trialStartsAt: '',
      trialEndsAt: '',
      currentPeriodEnd: '',
      billingContactEmail: '',
      notes: '',
      customPricingEnabled: false,
      enterpriseManaged: false
    };
  }

  return {
    planId: subscription.planId ?? '',
    status: subscription.subscriptionStatus,
    billingStatus: subscription.billingStatus,
    basePriceCents: stringifyOptionalNumber(subscription.basePriceCents),
    annualBasePriceCents: stringifyOptionalNumber(subscription.annualBasePriceCents),
    setupFeeCents: stringifyOptionalNumber(subscription.setupFeeCents),
    activeClientPriceCents: stringifyOptionalNumber(subscription.activeClientPriceCents),
    clinicianPriceCents: stringifyOptionalNumber(subscription.clinicianPriceCents),
    includedActiveClients: stringifyOptionalNumber(subscription.includedActiveClients),
    includedClinicians: stringifyOptionalNumber(subscription.includedClinicians),
    currency: subscription.currency,
    billingInterval: subscription.billingInterval,
    startsAt: toDateInputValue(subscription.startsAt),
    trialStartsAt: toDateInputValue(subscription.trialStartsAt),
    trialEndsAt: toDateInputValue(subscription.trialEndsAt),
    currentPeriodEnd: toDateInputValue(subscription.currentPeriodEnd),
    billingContactEmail: subscription.billingContactEmail ?? '',
    notes: subscription.notes ?? '',
    customPricingEnabled: subscription.customPricingEnabled,
    enterpriseManaged: subscription.enterpriseManaged
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

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
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

  async function loadManagedData(token: string) {
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
      loaders.push(loadManagedData(token));
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
        annualBasePriceCents: parseOptionalNumber(subscriptionForm.annualBasePriceCents),
        setupFeeCents: parseOptionalNumber(subscriptionForm.setupFeeCents),
        activeClientPriceCents: Number(subscriptionForm.activeClientPriceCents || '0'),
        clinicianPriceCents: Number(subscriptionForm.clinicianPriceCents || '0'),
        includedActiveClients: parseOptionalNumber(subscriptionForm.includedActiveClients),
        includedClinicians: parseOptionalNumber(subscriptionForm.includedClinicians),
        currency: subscriptionForm.currency.trim().toLowerCase() || 'usd',
        billingInterval: subscriptionForm.billingInterval.trim() || 'month',
        startsAt: subscriptionForm.startsAt ? new Date(`${subscriptionForm.startsAt}T00:00:00.000Z`).toISOString() : undefined,
        trialStartsAt: subscriptionForm.trialStartsAt ? new Date(`${subscriptionForm.trialStartsAt}T00:00:00.000Z`).toISOString() : null,
        trialEndsAt: subscriptionForm.trialEndsAt ? new Date(`${subscriptionForm.trialEndsAt}T00:00:00.000Z`).toISOString() : null,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd ? new Date(`${subscriptionForm.currentPeriodEnd}T00:00:00.000Z`).toISOString() : null,
        billingContactEmail: subscriptionForm.billingContactEmail.trim() || null,
        customPricingEnabled: subscriptionForm.customPricingEnabled,
        enterpriseManaged: subscriptionForm.enterpriseManaged,
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
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>{organization?.name ?? 'Loading organization'}</h2>
            <p className="muted consumerLead">
              Review identity, subscription pricing, billing settings, and effective feature entitlements from one platform record.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform" className="secondaryButton">
              Back to Platform Home
            </Link>
            <Link href="/platform/subscriptions" className="secondaryButton">
              Subscription Queue
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
                <p className="muted" style={{ marginBottom: 0 }}>{detail?.lifecycle.note}</p>
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
              <p className="muted">Real pricing and packaging now live on the organization subscription record.</p>
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
                  {' '}• Annual {activeSubscription.annualBasePriceCents === null ? 'N/A' : formatMoney(activeSubscription.annualBasePriceCents, activeSubscription.currency)}
                </span>
                <span className="muted">
                  Usage: {formatMoney(activeSubscription.activeClientPriceCents, activeSubscription.currency)} per active client
                  {' '}• {formatMoney(activeSubscription.clinicianPriceCents, activeSubscription.currency)} per clinician
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
                <p className="muted">Assign a plan, set org-specific price overrides, and manage billing/trial fields.</p>
              </div>
            </div>
            <form onSubmit={handleSaveSubscription} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
              <div className="grid">
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
                        basePriceCents: stringifyOptionalNumber(nextPlan?.pricing.basePriceCents ?? Number(current.basePriceCents || '0')),
                        annualBasePriceCents: stringifyOptionalNumber(nextPlan?.pricing.annualBasePriceCents),
                        setupFeeCents: stringifyOptionalNumber(nextPlan?.pricing.setupFeeCents),
                        activeClientPriceCents: stringifyOptionalNumber(nextPlan?.pricing.activeClientPriceCents ?? Number(current.activeClientPriceCents || '0')),
                        clinicianPriceCents: stringifyOptionalNumber(nextPlan?.pricing.clinicianPriceCents ?? Number(current.clinicianPriceCents || '0')),
                        includedActiveClients: stringifyOptionalNumber(nextPlan?.pricing.includedActiveClients),
                        includedClinicians: stringifyOptionalNumber(nextPlan?.pricing.includedClinicians),
                        currency: nextPlan?.pricing.currency ?? current.currency,
                        billingInterval: nextPlan?.pricing.billingInterval ?? current.billingInterval,
                        enterpriseManaged: nextPlan?.customPricingRequired ?? current.enterpriseManaged,
                        customPricingEnabled: nextPlan?.customPricingRequired ?? current.customPricingEnabled
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
                <label className="fieldLabel">
                  Subscription status
                  <select className="inputField" value={subscriptionForm.status} onChange={(event) => setSubscriptionForm((current) => ({ ...current, status: event.target.value }))}>
                    {['draft', 'trialing', 'active', 'past_due', 'suspended', 'canceled'].map((status) => (
                      <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
                    ))}
                  </select>
                </label>
                <label className="fieldLabel">
                  Billing status
                  <input className="inputField" value={subscriptionForm.billingStatus} onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingStatus: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Monthly base price (cents)
                  <input type="number" min="0" className="inputField" value={subscriptionForm.basePriceCents} onChange={(event) => setSubscriptionForm((current) => ({ ...current, basePriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Annual base price (cents)
                  <input type="number" min="0" className="inputField" value={subscriptionForm.annualBasePriceCents} onChange={(event) => setSubscriptionForm((current) => ({ ...current, annualBasePriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Setup fee (cents)
                  <input type="number" min="0" className="inputField" value={subscriptionForm.setupFeeCents} onChange={(event) => setSubscriptionForm((current) => ({ ...current, setupFeeCents: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Per active client (cents)
                  <input type="number" min="0" className="inputField" value={subscriptionForm.activeClientPriceCents} onChange={(event) => setSubscriptionForm((current) => ({ ...current, activeClientPriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Per clinician (cents)
                  <input type="number" min="0" className="inputField" value={subscriptionForm.clinicianPriceCents} onChange={(event) => setSubscriptionForm((current) => ({ ...current, clinicianPriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Included active clients
                  <input type="number" min="0" className="inputField" value={subscriptionForm.includedActiveClients} onChange={(event) => setSubscriptionForm((current) => ({ ...current, includedActiveClients: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Included clinicians
                  <input type="number" min="0" className="inputField" value={subscriptionForm.includedClinicians} onChange={(event) => setSubscriptionForm((current) => ({ ...current, includedClinicians: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Starts at
                  <input type="date" className="inputField" value={subscriptionForm.startsAt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, startsAt: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Trial start
                  <input type="date" className="inputField" value={subscriptionForm.trialStartsAt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, trialStartsAt: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Trial end
                  <input type="date" className="inputField" value={subscriptionForm.trialEndsAt} onChange={(event) => setSubscriptionForm((current) => ({ ...current, trialEndsAt: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Current period end
                  <input type="date" className="inputField" value={subscriptionForm.currentPeriodEnd} onChange={(event) => setSubscriptionForm((current) => ({ ...current, currentPeriodEnd: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Billing contact email
                  <input className="inputField" value={subscriptionForm.billingContactEmail} onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingContactEmail: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Currency
                  <input className="inputField" value={subscriptionForm.currency} onChange={(event) => setSubscriptionForm((current) => ({ ...current, currency: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Billing interval
                  <input className="inputField" value={subscriptionForm.billingInterval} onChange={(event) => setSubscriptionForm((current) => ({ ...current, billingInterval: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  <span className="muted">Custom pricing enabled</span>
                  <input type="checkbox" checked={subscriptionForm.customPricingEnabled} onChange={(event) => setSubscriptionForm((current) => ({ ...current, customPricingEnabled: event.target.checked }))} />
                </label>
                <label className="fieldLabel">
                  <span className="muted">Enterprise managed</span>
                  <input type="checkbox" checked={subscriptionForm.enterpriseManaged} onChange={(event) => setSubscriptionForm((current) => ({ ...current, enterpriseManaged: event.target.checked }))} />
                </label>
              </div>

              <label className="fieldLabel">
                Notes
                <textarea className="inputField textareaField" value={subscriptionForm.notes} onChange={(event) => setSubscriptionForm((current) => ({ ...current, notes: event.target.value }))} />
              </label>

              {selectedPlan ? (
                <article className="supportPanel">
                  <strong>{selectedPlan.name} plan profile</strong>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {selectedPlan.shortDescription}
                    {' '}• {selectedPlan.customPricingRequired ? 'Custom pricing plan' : 'Standard pricing plan'}
                  </p>
                </article>
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
                <p className="muted">Plan-included features can still be overridden per organization.</p>
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
                          <p className="muted" style={{ marginBottom: 0 }}>{feature.description ?? feature.key}</p>
                        </div>
                        <div className="pillRow">
                          <span className={`statusPill ${draft.enabled ? 'success' : 'warning'}`}>
                            {draft.enabled ? 'enabled' : 'disabled'}
                          </span>
                          <span className="statusPill neutral">{feature.planAvailability.replaceAll('_', ' ')}</span>
                        </div>
                      </div>
                      <span className="muted">
                        {feature.planAvailability === 'add_on'
                          ? `Plan add-on ${feature.planPricing?.monthlyPriceCents === null ? '' : formatMoney(feature.planPricing?.monthlyPriceCents ?? 0)}`
                          : feature.includedInPlan
                            ? 'Included by plan'
                            : 'Not included by plan'}
                      </span>
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
      ) : null}

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
                <select className="inputField" value={supportForm.locationId} onChange={(event) => setSupportForm((current) => ({ ...current, locationId: event.target.value }))} disabled={!locationOptions.length}>
                  <option value="">All organization locations</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </label>
              <label className="fieldLabel">
                Reason
                <textarea className="inputField textareaField" value={supportForm.reason} onChange={(event) => setSupportForm((current) => ({ ...current, reason: event.target.value }))} />
              </label>
              <label className="fieldLabel">
                Ticket or reference
                <input className="inputField" value={supportForm.ticketReference} onChange={(event) => setSupportForm((current) => ({ ...current, ticketReference: event.target.value }))} />
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
                  <span className={`statusPill ${admin.isActive ? 'success' : 'warning'}`}>{admin.isActive ? 'active' : 'inactive'}</span>
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
                  <span className={`statusPill ${location.isActive ? 'success' : 'warning'}`}>{location.isActive ? 'active' : 'inactive'}</span>
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
