'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  bootstrapPlatformPricingCatalog,
  createPlatformPlan,
  fetchPlatformPricingCatalog,
  sessionCanManagePlatformBilling,
  updatePlatformPlan,
  type PlatformFeature,
  type PlatformPlan,
  type UpsertPlatformPlanInput
} from '../lib/beta-auth';
import { PlatformWorkspaceShell, formatMoney, usePlatformWorkspace } from './platform-workspace';

type FeatureMatrixDraft = {
  featureId: string;
  availability: 'included' | 'add_on' | 'excluded';
  monthlyPriceCents: string;
  annualPriceCents: string;
  notes: string;
};

type PlanFormState = {
  key: string;
  name: string;
  description: string;
  shortDescription: string;
  longDescription: string;
  isActive: boolean;
  sortOrder: string;
  basePriceCents: string;
  annualBasePriceCents: string;
  setupFeeCents: string;
  trialDays: string;
  activeClientPriceCents: string;
  clinicianPriceCents: string;
  includedActiveClients: string;
  includedClinicians: string;
  currency: string;
  billingInterval: string;
  targetCustomerProfile: string;
  customPricingRequired: boolean;
  salesContactRequired: boolean;
  badgeLabel: string;
  maxLocations: string;
  maxOrgUsers: string;
  maxClinicians: string;
  maxActiveClients: string;
  unlimitedLocations: boolean;
  unlimitedOrgUsers: boolean;
  unlimitedClinicians: boolean;
  unlimitedActiveClients: boolean;
  apiAccessIncluded: boolean;
  ssoIncluded: boolean;
  customBrandingIncluded: boolean;
  features: FeatureMatrixDraft[];
};

const booleanPlanFields: Array<{ key: keyof Pick<
  PlanFormState,
  | 'isActive'
  | 'customPricingRequired'
  | 'salesContactRequired'
  | 'unlimitedLocations'
  | 'unlimitedOrgUsers'
  | 'unlimitedClinicians'
  | 'unlimitedActiveClients'
  | 'apiAccessIncluded'
  | 'ssoIncluded'
  | 'customBrandingIncluded'
>; label: string }> = [
  { key: 'isActive', label: 'Plan active' },
  { key: 'customPricingRequired', label: 'Custom pricing required' },
  { key: 'salesContactRequired', label: 'Sales contact required' },
  { key: 'unlimitedLocations', label: 'Unlimited locations' },
  { key: 'unlimitedOrgUsers', label: 'Unlimited org users' },
  { key: 'unlimitedClinicians', label: 'Unlimited clinicians' },
  { key: 'unlimitedActiveClients', label: 'Unlimited active clients' },
  { key: 'apiAccessIncluded', label: 'API access included' },
  { key: 'ssoIncluded', label: 'SSO included' },
  { key: 'customBrandingIncluded', label: 'Custom branding included' }
];

function stringifyOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function buildFeatureDrafts(features: PlatformFeature[], plan?: PlatformPlan | null): FeatureMatrixDraft[] {
  return features.map((feature) => {
    const existing = plan?.featureMatrix.find((entry) => entry.feature.id === feature.id);
    return {
      featureId: feature.id,
      availability: existing?.availability ?? 'excluded',
      monthlyPriceCents: stringifyOptionalNumber(existing?.monthlyPriceCents ?? feature.defaultMonthlyPriceCents),
      annualPriceCents: stringifyOptionalNumber(existing?.annualPriceCents ?? feature.defaultAnnualPriceCents),
      notes: existing?.notes ?? ''
    };
  });
}

function buildPlanFormState(features: PlatformFeature[], plan?: PlatformPlan | null): PlanFormState {
  return {
    key: plan?.key ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    shortDescription: plan?.shortDescription ?? '',
    longDescription: plan?.longDescription ?? '',
    isActive: plan?.isActive ?? true,
    sortOrder: stringifyOptionalNumber(plan?.sortOrder ?? 0),
    basePriceCents: stringifyOptionalNumber(plan?.pricing.basePriceCents ?? 0),
    annualBasePriceCents: stringifyOptionalNumber(plan?.pricing.annualBasePriceCents),
    setupFeeCents: stringifyOptionalNumber(plan?.pricing.setupFeeCents),
    trialDays: stringifyOptionalNumber(plan?.pricing.trialDays),
    activeClientPriceCents: stringifyOptionalNumber(plan?.pricing.activeClientPriceCents ?? 0),
    clinicianPriceCents: stringifyOptionalNumber(plan?.pricing.clinicianPriceCents ?? 0),
    includedActiveClients: stringifyOptionalNumber(plan?.pricing.includedActiveClients),
    includedClinicians: stringifyOptionalNumber(plan?.pricing.includedClinicians),
    currency: plan?.pricing.currency ?? 'usd',
    billingInterval: plan?.pricing.billingInterval ?? 'month',
    targetCustomerProfile: plan?.targetCustomerProfile ?? '',
    customPricingRequired: plan?.customPricingRequired ?? false,
    salesContactRequired: plan?.salesContactRequired ?? false,
    badgeLabel: plan?.badgeLabel ?? '',
    maxLocations: stringifyOptionalNumber(plan?.limits.maxLocations),
    maxOrgUsers: stringifyOptionalNumber(plan?.limits.maxOrgUsers),
    maxClinicians: stringifyOptionalNumber(plan?.limits.maxClinicians),
    maxActiveClients: stringifyOptionalNumber(plan?.limits.maxActiveClients),
    unlimitedLocations: plan?.limits.unlimitedLocations ?? false,
    unlimitedOrgUsers: plan?.limits.unlimitedOrgUsers ?? false,
    unlimitedClinicians: plan?.limits.unlimitedClinicians ?? false,
    unlimitedActiveClients: plan?.limits.unlimitedActiveClients ?? false,
    apiAccessIncluded: plan?.packaging.apiAccessIncluded ?? false,
    ssoIncluded: plan?.packaging.ssoIncluded ?? false,
    customBrandingIncluded: plan?.packaging.customBrandingIncluded ?? false,
    features: buildFeatureDrafts(features, plan)
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function buildPlanPayload(form: PlanFormState): UpsertPlatformPlanInput {
  return {
    key: form.key.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    shortDescription: form.shortDescription.trim(),
    longDescription: form.longDescription.trim(),
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder || '0'),
    basePriceCents: Number(form.basePriceCents || '0'),
    annualBasePriceCents: parseOptionalNumber(form.annualBasePriceCents),
    setupFeeCents: parseOptionalNumber(form.setupFeeCents),
    trialDays: parseOptionalNumber(form.trialDays),
    activeClientPriceCents: Number(form.activeClientPriceCents || '0'),
    clinicianPriceCents: Number(form.clinicianPriceCents || '0'),
    includedActiveClients: parseOptionalNumber(form.includedActiveClients),
    includedClinicians: parseOptionalNumber(form.includedClinicians),
    currency: form.currency.trim().toLowerCase() || 'usd',
    billingInterval: form.billingInterval.trim() || 'month',
    targetCustomerProfile: form.targetCustomerProfile.trim(),
    customPricingRequired: form.customPricingRequired,
    salesContactRequired: form.salesContactRequired,
    badgeLabel: form.badgeLabel.trim() || null,
    maxLocations: parseOptionalNumber(form.maxLocations),
    maxOrgUsers: parseOptionalNumber(form.maxOrgUsers),
    maxClinicians: parseOptionalNumber(form.maxClinicians),
    maxActiveClients: parseOptionalNumber(form.maxActiveClients),
    unlimitedLocations: form.unlimitedLocations,
    unlimitedOrgUsers: form.unlimitedOrgUsers,
    unlimitedClinicians: form.unlimitedClinicians,
    unlimitedActiveClients: form.unlimitedActiveClients,
    apiAccessIncluded: form.apiAccessIncluded,
    ssoIncluded: form.ssoIncluded,
    customBrandingIncluded: form.customBrandingIncluded,
    features: form.features.map((feature) => ({
      featureId: feature.featureId,
      availability: feature.availability,
      monthlyPriceCents: parseOptionalNumber(feature.monthlyPriceCents),
      annualPriceCents: parseOptionalNumber(feature.annualPriceCents),
      notes: feature.notes.trim() || null
    }))
  };
}

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
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('new');
  const [planForm, setPlanForm] = useState<PlanFormState>(buildPlanFormState([]));
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const canManageBilling = Boolean(me && sessionCanManagePlatformBilling(me));
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  async function loadCatalog(token: string, allowBootstrap = true) {
    if (!apiBaseUrl) {
      return;
    }

    const response = await fetchPlatformPricingCatalog(apiBaseUrl, token);

    if (!response.plans.length && allowBootstrap) {
      await bootstrapPlatformPricingCatalog(apiBaseUrl, token);
      return loadCatalog(token, false);
    }

    setPlans(response.plans);
    setFeatures(response.features);
    const nextPlan = response.plans.find((plan) => plan.id === selectedPlanId) ?? response.plans[0] ?? null;
    setSelectedPlanId(nextPlan?.id ?? 'new');
    setPlanForm(buildPlanFormState(response.features, nextPlan));
  }

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

    loadCatalog(token)
      .then(() => {
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load platform plans.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, canManageBilling]);

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
    const plan = plans.find((candidate) => candidate.id === planId) ?? null;
    setPlanForm(buildPlanFormState(features, plan));
    setSuccess(null);
    setError(null);
  }

  async function handleBootstrap() {
    if (!apiBaseUrl || !canManageBilling) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsBootstrapping(true);
    setError(null);
    setSuccess(null);

    try {
      await bootstrapPlatformPricingCatalog(apiBaseUrl, token);
      await loadCatalog(token, false);
      setSuccess('Default pricing catalog initialized.');
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to initialize the default pricing catalog.'));
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function handleSavePlan() {
    if (!apiBaseUrl || !canManageBilling) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = buildPlanPayload(planForm);
      const response = selectedPlan
        ? await updatePlatformPlan(apiBaseUrl, token, selectedPlan.id, payload)
        : await createPlatformPlan(apiBaseUrl, token, payload);

      await loadCatalog(token, false);
      setSelectedPlanId(response.plan.id);
      setPlanForm(buildPlanFormState(features.length ? features : response.plan.featureMatrix.map((item) => item.feature), response.plan));
      setSuccess(`${response.plan.name} ${selectedPlan ? 'updated' : 'created'}.`);
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to save this plan.'));
    } finally {
      setIsSaving(false);
    }
  }

  const previewPricing = `${formatMoney(Number(planForm.basePriceCents || '0'), planForm.currency)} monthly`;

  return (
    <PlatformWorkspaceShell title="Plans" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Plan catalog</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>Pricing, packaging, and module management</h2>
            <p className="muted consumerLead">
              Manage the full Clarity plan catalog, including pricing, limits, feature entitlements, add-on pricing, and plan ordering.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform/subscriptions" className="secondaryButton">
              Organization Subscriptions
            </Link>
            <Link href="/platform/features" className="secondaryButton">
              Feature Catalog
            </Link>
            <button type="button" className="primaryButton" onClick={handleBootstrap} disabled={isBootstrapping || !canManageBilling}>
              {isBootstrapping ? 'Initializing catalog...' : 'Bootstrap Defaults'}
            </button>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      {!canManageBilling ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 0 }}>
            Plan management is only available to a platform admin in platform mode.
          </p>
        </section>
      ) : (
        <section className="adminPanelGrid">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Plans</h2>
                <p className="muted">Create, activate, reorder, and edit the base packaging for each plan.</p>
              </div>
              <button type="button" className="secondaryButton" onClick={() => selectPlan('new')}>
                New Plan
              </button>
            </div>
            <div className="timeline" style={{ marginTop: 16 }}>
              {plans.length ? (
                plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`listItemCard adminQueueButton ${selectedPlanId === plan.id ? 'adminSelectedCard' : ''}`}
                    onClick={() => selectPlan(plan.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <strong>{plan.name}</strong>
                    <span className="muted">{plan.badgeLabel ?? plan.key}</span>
                    <span className="muted">
                      {formatMoney(plan.pricing.basePriceCents, plan.pricing.currency)}
                      {' '}monthly • {plan.organizationCount} orgs
                    </span>
                    <span className={`statusPill ${plan.isActive ? 'success' : 'warning'}`}>
                      {plan.isActive ? 'active' : 'inactive'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="emptyState">
                  <strong>{isLoading ? 'Loading plans...' : 'No plans available yet'}</strong>
                  <span className="muted">Use Bootstrap Defaults to initialize the standard Clarity catalog.</span>
                </div>
              )}
            </div>
          </article>

          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">{selectedPlan ? `Edit ${selectedPlan.name}` : 'Create plan'}</h2>
                <p className="muted">{previewPricing} with editable usage, limit, and module pricing fields.</p>
              </div>
            </div>

            <div className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
              <div className="grid">
                <label className="fieldLabel">
                  Key
                  <input className="inputField" value={planForm.key} onChange={(event) => setPlanForm((current) => ({ ...current, key: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Name
                  <input className="inputField" value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Badge / label
                  <input className="inputField" value={planForm.badgeLabel} onChange={(event) => setPlanForm((current) => ({ ...current, badgeLabel: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Sort order
                  <input type="number" min="0" className="inputField" value={planForm.sortOrder} onChange={(event) => setPlanForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Currency
                  <input className="inputField" value={planForm.currency} onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Billing interval
                  <input className="inputField" value={planForm.billingInterval} onChange={(event) => setPlanForm((current) => ({ ...current, billingInterval: event.target.value }))} />
                </label>
              </div>

              <label className="fieldLabel">
                Short description
                <input className="inputField" value={planForm.shortDescription} onChange={(event) => setPlanForm((current) => ({ ...current, shortDescription: event.target.value }))} />
              </label>
              <label className="fieldLabel">
                Summary description
                <input className="inputField" value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="fieldLabel">
                Long description
                <textarea className="inputField textareaField" value={planForm.longDescription} onChange={(event) => setPlanForm((current) => ({ ...current, longDescription: event.target.value }))} />
              </label>
              <label className="fieldLabel">
                Target customer profile
                <textarea className="inputField textareaField" value={planForm.targetCustomerProfile} onChange={(event) => setPlanForm((current) => ({ ...current, targetCustomerProfile: event.target.value }))} />
              </label>

              <div className="grid">
                <label className="fieldLabel">
                  Monthly base price (cents)
                  <input type="number" min="0" className="inputField" value={planForm.basePriceCents} onChange={(event) => setPlanForm((current) => ({ ...current, basePriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Annual base price (cents)
                  <input type="number" min="0" className="inputField" value={planForm.annualBasePriceCents} onChange={(event) => setPlanForm((current) => ({ ...current, annualBasePriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Setup fee (cents)
                  <input type="number" min="0" className="inputField" value={planForm.setupFeeCents} onChange={(event) => setPlanForm((current) => ({ ...current, setupFeeCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Trial days
                  <input type="number" min="0" className="inputField" value={planForm.trialDays} onChange={(event) => setPlanForm((current) => ({ ...current, trialDays: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Per active client (cents)
                  <input type="number" min="0" className="inputField" value={planForm.activeClientPriceCents} onChange={(event) => setPlanForm((current) => ({ ...current, activeClientPriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Per clinician (cents)
                  <input type="number" min="0" className="inputField" value={planForm.clinicianPriceCents} onChange={(event) => setPlanForm((current) => ({ ...current, clinicianPriceCents: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Included active clients
                  <input type="number" min="0" className="inputField" value={planForm.includedActiveClients} onChange={(event) => setPlanForm((current) => ({ ...current, includedActiveClients: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Included clinicians
                  <input type="number" min="0" className="inputField" value={planForm.includedClinicians} onChange={(event) => setPlanForm((current) => ({ ...current, includedClinicians: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                <label className="fieldLabel">
                  Max locations
                  <input type="number" min="0" className="inputField" value={planForm.maxLocations} onChange={(event) => setPlanForm((current) => ({ ...current, maxLocations: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Max org users
                  <input type="number" min="0" className="inputField" value={planForm.maxOrgUsers} onChange={(event) => setPlanForm((current) => ({ ...current, maxOrgUsers: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Max clinicians
                  <input type="number" min="0" className="inputField" value={planForm.maxClinicians} onChange={(event) => setPlanForm((current) => ({ ...current, maxClinicians: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Max active clients
                  <input type="number" min="0" className="inputField" value={planForm.maxActiveClients} onChange={(event) => setPlanForm((current) => ({ ...current, maxActiveClients: event.target.value }))} />
                </label>
              </div>

              <div className="grid">
                {booleanPlanFields.map(({ key, label }) => (
                  <label key={key} className="fieldLabel">
                    <span className="muted">{label}</span>
                    <input
                      type="checkbox"
                      checked={planForm[key]}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          [key]: event.target.checked
                        }))}
                    />
                  </label>
                ))}
              </div>

              <div className="sectionHeaderRow">
                <div>
                  <h3 className="sectionTitle">Feature matrix</h3>
                  <p className="muted">Set whether each module is included, offered as an add-on, or excluded.</p>
                </div>
              </div>
              <div className="timeline">
                {features.map((feature, index) => {
                  const draft = planForm.features[index];
                  if (!draft) {
                    return null;
                  }

                  return (
                    <article key={feature.id} className="listItemCard">
                      <strong>{feature.name}</strong>
                      <span className="muted">{feature.description ?? feature.key}</span>
                      <div className="grid">
                        <label className="fieldLabel">
                          Availability
                          <select
                            className="inputField"
                            value={draft.availability}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                features: current.features.map((item) =>
                                  item.featureId === feature.id
                                    ? { ...item, availability: event.target.value as FeatureMatrixDraft['availability'] }
                                    : item
                                )
                              }))}
                          >
                            <option value="included">Included</option>
                            <option value="add_on">Add-on</option>
                            <option value="excluded">Excluded</option>
                          </select>
                        </label>
                        <label className="fieldLabel">
                          Add-on monthly price
                          <input
                            type="number"
                            min="0"
                            className="inputField"
                            value={draft.monthlyPriceCents}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                features: current.features.map((item) =>
                                  item.featureId === feature.id ? { ...item, monthlyPriceCents: event.target.value } : item
                                )
                              }))}
                          />
                        </label>
                        <label className="fieldLabel">
                          Add-on annual price
                          <input
                            type="number"
                            min="0"
                            className="inputField"
                            value={draft.annualPriceCents}
                            onChange={(event) =>
                              setPlanForm((current) => ({
                                ...current,
                                features: current.features.map((item) =>
                                  item.featureId === feature.id ? { ...item, annualPriceCents: event.target.value } : item
                                )
                              }))}
                          />
                        </label>
                      </div>
                      <label className="fieldLabel">
                        Plan-specific note
                        <input
                          className="inputField"
                          value={draft.notes}
                          onChange={(event) =>
                            setPlanForm((current) => ({
                              ...current,
                              features: current.features.map((item) =>
                                item.featureId === feature.id ? { ...item, notes: event.target.value } : item
                              )
                            }))}
                        />
                      </label>
                    </article>
                  );
                })}
              </div>

              <div className="actionRow">
                <button type="button" className="primaryButton" disabled={isSaving} onClick={handleSavePlan}>
                  {isSaving ? 'Saving plan...' : selectedPlan ? 'Save plan changes' : 'Create plan'}
                </button>
              </div>
            </div>
          </article>
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
