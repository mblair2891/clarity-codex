'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchPlatformPricingCatalog,
  sessionCanManagePlatformBilling,
  updatePlatformFeature,
  type PlatformFeature,
  type PlatformPlan
} from '../lib/beta-auth';
import { PlatformWorkspaceShell, formatMoney, usePlatformWorkspace } from './platform-workspace';

type FeatureFormState = {
  name: string;
  description: string;
  longDescription: string;
  category: string;
  isActive: boolean;
  isAddOn: boolean;
  defaultMonthlyPriceCents: string;
  defaultAnnualPriceCents: string;
  badgeLabel: string;
  sortOrder: string;
};

function buildFeatureFormState(feature?: PlatformFeature | null): FeatureFormState {
  return {
    name: feature?.name ?? '',
    description: feature?.description ?? '',
    longDescription: feature?.longDescription ?? '',
    category: feature?.category ?? '',
    isActive: feature?.isActive ?? true,
    isAddOn: feature?.isAddOn ?? false,
    defaultMonthlyPriceCents: feature?.defaultMonthlyPriceCents === null || feature?.defaultMonthlyPriceCents === undefined ? '' : String(feature.defaultMonthlyPriceCents),
    defaultAnnualPriceCents: feature?.defaultAnnualPriceCents === null || feature?.defaultAnnualPriceCents === undefined ? '' : String(feature.defaultAnnualPriceCents),
    badgeLabel: feature?.badgeLabel ?? '',
    sortOrder: feature ? String(feature.sortOrder) : '0'
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

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
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('');
  const [featureForm, setFeatureForm] = useState<FeatureFormState>(buildFeatureFormState(null));
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canManageBilling = Boolean(me && sessionCanManagePlatformBilling(me));
  const selectedFeature = useMemo(
    () => features.find((feature) => feature.id === selectedFeatureId) ?? null,
    [features, selectedFeatureId]
  );

  async function loadCatalog(token: string) {
    if (!apiBaseUrl) {
      return;
    }

    const response = await fetchPlatformPricingCatalog(apiBaseUrl, token);
    setFeatures(response.features);
    setPlans(response.plans);
    const nextFeature = response.features.find((feature) => feature.id === selectedFeatureId) ?? response.features[0] ?? null;
    setSelectedFeatureId(nextFeature?.id ?? '');
    setFeatureForm(buildFeatureFormState(nextFeature));
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
        setError(handleApiError(loadError, 'Unable to load the feature catalog.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, canManageBilling]);

  function selectFeature(featureId: string) {
    setSelectedFeatureId(featureId);
    const feature = features.find((candidate) => candidate.id === featureId) ?? null;
    setFeatureForm(buildFeatureFormState(feature));
    setSuccess(null);
    setError(null);
  }

  async function handleSaveFeature() {
    if (!apiBaseUrl || !canManageBilling || !selectedFeature) {
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
      await updatePlatformFeature(apiBaseUrl, token, selectedFeature.id, {
        name: featureForm.name.trim(),
        description: featureForm.description.trim(),
        longDescription: featureForm.longDescription.trim(),
        category: featureForm.category.trim() || null,
        isActive: featureForm.isActive,
        isAddOn: featureForm.isAddOn,
        defaultMonthlyPriceCents: parseOptionalNumber(featureForm.defaultMonthlyPriceCents),
        defaultAnnualPriceCents: parseOptionalNumber(featureForm.defaultAnnualPriceCents),
        badgeLabel: featureForm.badgeLabel.trim() || null,
        sortOrder: Number(featureForm.sortOrder || '0')
      });
      await loadCatalog(token);
      setSuccess(`Saved feature settings for ${featureForm.name}.`);
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to save this feature.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PlatformWorkspaceShell title="Features" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Feature catalog</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>Module metadata and add-on defaults</h2>
            <p className="muted consumerLead">
              Control feature descriptions, activation state, add-on defaults, and how modules map into each plan.
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
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      {!canManageBilling ? (
        <section className="card">
          <p className="muted" style={{ marginBottom: 0 }}>
            Feature management is only available to a platform admin in platform mode.
          </p>
        </section>
      ) : (
        <section className="adminPanelGrid">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Features</h2>
                <p className="muted">Select a feature to edit its default catalog metadata and pricing.</p>
              </div>
            </div>
            <div className="timeline" style={{ marginTop: 16 }}>
              {features.length ? (
                features.map((feature) => (
                  <button
                    key={feature.id}
                    type="button"
                    className={`listItemCard adminQueueButton ${selectedFeatureId === feature.id ? 'adminSelectedCard' : ''}`}
                    onClick={() => selectFeature(feature.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <strong>{feature.name}</strong>
                    <span className="muted">{feature.key}</span>
                    <span className="muted">
                      {feature.isAddOn
                        ? `${formatMoney(feature.defaultMonthlyPriceCents ?? 0)} default monthly add-on`
                        : 'Core catalog feature'}
                    </span>
                    <span className={`statusPill ${feature.isActive ? 'success' : 'warning'}`}>
                      {feature.isActive ? 'active' : 'inactive'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="emptyState">
                  <strong>{isLoading ? 'Loading features...' : 'No features available yet'}</strong>
                  <span className="muted">Bootstrap the default catalog from the plans page if this tenant is empty.</span>
                </div>
              )}
            </div>
          </article>

          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">{selectedFeature ? `Edit ${selectedFeature.name}` : 'Feature details'}</h2>
                <p className="muted">Plan assignments update from the plans page, while base feature metadata lives here.</p>
              </div>
            </div>
            {selectedFeature ? (
              <div className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
                <div className="grid">
                  <label className="fieldLabel">
                    Name
                    <input className="inputField" value={featureForm.name} onChange={(event) => setFeatureForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label className="fieldLabel">
                    Category
                    <input className="inputField" value={featureForm.category} onChange={(event) => setFeatureForm((current) => ({ ...current, category: event.target.value }))} />
                  </label>
                  <label className="fieldLabel">
                    Badge
                    <input className="inputField" value={featureForm.badgeLabel} onChange={(event) => setFeatureForm((current) => ({ ...current, badgeLabel: event.target.value }))} />
                  </label>
                  <label className="fieldLabel">
                    Sort order
                    <input type="number" min="0" className="inputField" value={featureForm.sortOrder} onChange={(event) => setFeatureForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                  </label>
                </div>

                <label className="fieldLabel">
                  Description
                  <input className="inputField" value={featureForm.description} onChange={(event) => setFeatureForm((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <label className="fieldLabel">
                  Long description
                  <textarea className="inputField textareaField" value={featureForm.longDescription} onChange={(event) => setFeatureForm((current) => ({ ...current, longDescription: event.target.value }))} />
                </label>

                <div className="grid">
                  <label className="fieldLabel">
                    Default monthly add-on (cents)
                    <input type="number" min="0" className="inputField" value={featureForm.defaultMonthlyPriceCents} onChange={(event) => setFeatureForm((current) => ({ ...current, defaultMonthlyPriceCents: event.target.value }))} />
                  </label>
                  <label className="fieldLabel">
                    Default annual add-on (cents)
                    <input type="number" min="0" className="inputField" value={featureForm.defaultAnnualPriceCents} onChange={(event) => setFeatureForm((current) => ({ ...current, defaultAnnualPriceCents: event.target.value }))} />
                  </label>
                  <label className="fieldLabel">
                    <span className="muted">Feature active</span>
                    <input type="checkbox" checked={featureForm.isActive} onChange={(event) => setFeatureForm((current) => ({ ...current, isActive: event.target.checked }))} />
                  </label>
                  <label className="fieldLabel">
                    <span className="muted">Offered as add-on</span>
                    <input type="checkbox" checked={featureForm.isAddOn} onChange={(event) => setFeatureForm((current) => ({ ...current, isAddOn: event.target.checked }))} />
                  </label>
                </div>

                <article className="supportPanel">
                  <strong>Plan coverage</strong>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {plans
                      .filter((plan) => plan.featureMatrix.some((entry) => entry.feature.id === selectedFeature.id && entry.availability !== 'excluded'))
                      .map((plan) => plan.name)
                      .join(' • ') || 'No plan currently references this feature.'}
                  </p>
                </article>

                <div className="actionRow">
                  <button type="button" className="primaryButton" disabled={isSaving} onClick={handleSaveFeature}>
                    {isSaving ? 'Saving feature...' : 'Save feature'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 16 }}>Select a feature to edit its metadata.</p>
            )}
          </article>
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
