'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  completePlatformOrganizationOnboarding,
  createPlatformOrganizationOnboarding,
  fetchPlatformOrganizationOnboarding,
  recommendPlatformOrganizationOnboarding,
  updatePlatformOrganizationOnboarding,
  type CompletePlatformOrganizationOnboardingResponse,
  type PlatformFeature,
  type PlatformOnboardingAnswers,
  type PlatformOrganizationOnboardingResponse,
  type PlatformPlan
} from '../lib/beta-auth';
import { PlatformWorkspaceShell, formatDateTime, formatMoney, usePlatformWorkspace } from './platform-workspace';

const importDataTypeOptions = [
  'clients',
  'users',
  'locations',
  'appointments',
  'clinical notes',
  'billing data',
  'claims',
  'remittances'
] as const;

const steps = [
  { id: 'organization_identity', label: 'Identity' },
  { id: 'primary_contacts', label: 'Contacts' },
  { id: 'operational_profile', label: 'Operations' },
  { id: 'import_migration', label: 'Import' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'review', label: 'Review' }
] as const;

function buildDefaultAnswers(): PlatformOnboardingAnswers {
  return {
    organizationIdentity: {
      organizationName: '',
      displayName: '',
      organizationType: '',
      numberOfLocations: 1,
      primaryLocationAddress: '',
      timezone: '',
      npi: '',
      taxId: '',
      website: '',
      primaryPhone: '',
      primaryEmail: ''
    },
    primaryContacts: {
      primaryAdminFullName: '',
      primaryAdminEmail: '',
      primaryAdminPhone: '',
      billingContactName: '',
      billingContactEmail: '',
      clinicalLeadName: '',
      clinicalLeadEmail: '',
      technicalContactName: '',
      technicalContactEmail: ''
    },
    operationalProfile: {
      numberOfClinicians: 0,
      numberOfOrgAdminUsers: 0,
      approximateActiveClientCount: 0,
      expectedGrowthNext12Months: 0,
      billsInsurance: false,
      billingModel: 'not_applicable',
      needsClaimsRemittanceWorkflows: false,
      needsConsumerPortal: true,
      needsAdvancedReporting: false,
      needsMultiLocationManagement: false,
      needsSso: false,
      needsApiAccess: false,
      needsCustomBranding: false,
      needsPrioritySupport: false,
      hasExistingDataToImport: false
    },
    importMigration: {
      needsDataImport: false,
      dataTypes: [],
      sourceSystem: '',
      sourceFormat: '',
      wantsPlatformAssistance: false
    }
  };
}

function toInputNumber(value: number) {
  return Number.isFinite(value) ? String(value) : '0';
}

function FeatureSelectionCard({
  feature,
  checked,
  availability,
  onToggle
}: {
  feature: PlatformFeature;
  checked: boolean;
  availability: 'included' | 'add_on' | 'excluded';
  onToggle: () => void;
}) {
  const pillTone = availability === 'included' ? 'success' : availability === 'add_on' ? 'warning' : 'neutral';

  return (
    <label className="listItemCard" style={{ cursor: 'pointer', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <strong>{feature.name}</strong>
          <div className="muted">{feature.description ?? feature.key}</div>
        </div>
        <span className={`statusPill ${pillTone}`}>{availability.replaceAll('_', ' ')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <span className="muted">
          {feature.defaultMonthlyPriceCents === null ? 'Included in pricing catalog' : `${formatMoney(feature.defaultMonthlyPriceCents)} default add-on`}
        </span>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </div>
    </label>
  );
}

function SectionBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <article className="card">
      <div className="sectionHeaderRow">
        <div>
          <h2 className="sectionTitle">{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
        {children}
      </div>
    </article>
  );
}

export function PlatformOrganizationOnboardingWizard({ organizationId }: { organizationId: string }) {
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
  const [response, setResponse] = useState<PlatformOrganizationOnboardingResponse | null>(null);
  const [answers, setAnswers] = useState<PlatformOnboardingAnswers>(buildDefaultAnswers());
  const [currentStep, setCurrentStep] = useState<(typeof steps)[number]['id']>('organization_identity');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<string[]>([]);
  const [adminReviewNotes, setAdminReviewNotes] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompletePlatformOrganizationOnboardingResponse | null>(null);

  const plans = response?.catalog.plans ?? [];
  const features = response?.catalog.features ?? [];
  const onboarding = response?.onboarding ?? null;
  const organization = response?.organization ?? null;
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );
  const selectedFeatureSet = useMemo(() => new Set(selectedFeatureKeys), [selectedFeatureKeys]);

  useEffect(() => {
    if (!apiBaseUrl || !me) {
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsLoading(true);

    fetchPlatformOrganizationOnboarding(apiBaseUrl, token, organizationId)
      .then((result) => {
        setResponse(result);
        setAnswers(result.onboarding.answers);
        setCurrentStep((result.onboarding.currentStep as (typeof steps)[number]['id'] | null) ?? 'organization_identity');
        setSelectedPlanId(result.onboarding.selectedPlanId ?? result.onboarding.recommendedPlanId ?? '');
        setSelectedFeatureKeys(result.onboarding.selectedFeatureKeys);
        setAdminReviewNotes(result.onboarding.adminReviewNotes ?? '');
        setLastSavedAt(result.onboarding.updatedAt);
        setError(null);
      })
      .catch((loadError) => {
        setError(handleApiError(loadError, 'Unable to load organization onboarding.'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [apiBaseUrl, me, organizationId]);

  function setOrganizationIdentity<Field extends keyof PlatformOnboardingAnswers['organizationIdentity']>(
    field: Field,
    value: PlatformOnboardingAnswers['organizationIdentity'][Field]
  ) {
    setAnswers((current) => ({
      ...current,
      organizationIdentity: {
        ...current.organizationIdentity,
        [field]: value
      }
    }));
  }

  function setPrimaryContacts<Field extends keyof PlatformOnboardingAnswers['primaryContacts']>(
    field: Field,
    value: PlatformOnboardingAnswers['primaryContacts'][Field]
  ) {
    setAnswers((current) => ({
      ...current,
      primaryContacts: {
        ...current.primaryContacts,
        [field]: value
      }
    }));
  }

  function setOperationalProfile<Field extends keyof PlatformOnboardingAnswers['operationalProfile']>(
    field: Field,
    value: PlatformOnboardingAnswers['operationalProfile'][Field]
  ) {
    setAnswers((current) => ({
      ...current,
      operationalProfile: {
        ...current.operationalProfile,
        [field]: value
      }
    }));
  }

  function setImportMigration<Field extends keyof PlatformOnboardingAnswers['importMigration']>(
    field: Field,
    value: PlatformOnboardingAnswers['importMigration'][Field]
  ) {
    setAnswers((current) => ({
      ...current,
      importMigration: {
        ...current.importMigration,
        [field]: value
      }
    }));
  }

  async function saveDraft(nextStep = currentStep) {
    if (!apiBaseUrl) {
      setError('Platform API is unavailable.');
      return null;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return null;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        status: onboarding?.status === 'active' ? 'active' : 'in_progress',
        currentStep: nextStep,
        answers,
        adminReviewNotes: adminReviewNotes.trim() || null,
        selectedPlanId: selectedPlanId || null,
        selectedFeatureKeys
      };
      const result = onboarding?.id
        ? await updatePlatformOrganizationOnboarding(apiBaseUrl, token, organizationId, payload)
        : await createPlatformOrganizationOnboarding(apiBaseUrl, token, organizationId, {
            status: payload.status,
            currentStep: payload.currentStep,
            answers,
            adminReviewNotes: payload.adminReviewNotes
          });

      if (response) {
        setResponse({
          ...response,
          onboarding: {
            ...response.onboarding,
            ...result.onboarding,
            answers,
            selectedPlanId: payload.selectedPlanId,
            selectedFeatureKeys
          }
        });
      }

      setCurrentStep(nextStep);
      setLastSavedAt(result.onboarding.updatedAt);
      setSuccess('Draft saved.');
      return result;
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to save onboarding draft.'));
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNextStep() {
    const index = steps.findIndex((step) => step.id === currentStep);
    const nextStep = steps[Math.min(index + 1, steps.length - 1)]?.id ?? currentStep;
    await saveDraft(nextStep);
  }

  async function handlePreviousStep() {
    const index = steps.findIndex((step) => step.id === currentStep);
    const previousStep = steps[Math.max(index - 1, 0)]?.id ?? currentStep;
    setCurrentStep(previousStep);
  }

  async function handleRecommend() {
    if (!apiBaseUrl) {
      setError('Platform API is unavailable.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsRecommending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await recommendPlatformOrganizationOnboarding(apiBaseUrl, token, organizationId, {
        answers,
        currentStep: 'recommendation'
      });

      if (response) {
        setResponse({
          ...response,
          onboarding: result.onboarding
        });
      }

      setSelectedPlanId(result.onboarding.selectedPlanId ?? result.onboarding.recommendedPlanId ?? '');
      setSelectedFeatureKeys(result.onboarding.selectedFeatureKeys);
      setCurrentStep('recommendation');
      setLastSavedAt(result.onboarding.updatedAt);
      setSuccess('Recommendation updated.');
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to generate an onboarding recommendation.'));
    } finally {
      setIsRecommending(false);
    }
  }

  async function handleComplete() {
    if (!apiBaseUrl) {
      setError('Platform API is unavailable.');
      return;
    }

    if (!selectedPlanId) {
      setError('Select a plan before finalizing onboarding.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsCompleting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await completePlatformOrganizationOnboarding(apiBaseUrl, token, organizationId, {
        answers,
        selectedPlanId,
        selectedFeatureKeys,
        adminReviewNotes: adminReviewNotes.trim() || null
      });

      setCompletionResult(result);
      if (response) {
        setResponse({
          ...response,
          onboarding: result.onboarding
        });
      }

      setLastSavedAt(result.onboarding.updatedAt);
      setSuccess('Organization onboarding completed and subscription draft updated.');
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to finalize organization onboarding.'));
    } finally {
      setIsCompleting(false);
    }
  }

  function toggleImportType(value: string) {
    setImportMigration(
      'dataTypes',
      answers.importMigration.dataTypes.includes(value)
        ? answers.importMigration.dataTypes.filter((item) => item !== value)
        : [...answers.importMigration.dataTypes, value]
    );
  }

  function toggleSelectedFeature(key: string) {
    setSelectedFeatureKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort()
    );
  }

  function planAvailabilityForFeature(plan: PlatformPlan | null, feature: PlatformFeature) {
    return plan?.featureMatrix.find((item) => item.feature.id === feature.id)?.availability ?? 'excluded';
  }

  return (
    <PlatformWorkspaceShell title="Organization Onboarding" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Onboarding wizard</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              {organization?.name ?? 'Loading organization'}
            </h2>
            <p className="muted consumerLead">
              Guide setup, generate plan and module recommendations, then confirm the org’s initial subscription and onboarding path.
            </p>
          </div>
          <div className="actionRow">
            <Link href={`/platform/organizations/${organizationId}`} className="secondaryButton">
              Back to Organization
            </Link>
            <Link href="/platform/subscriptions" className="secondaryButton">
              Subscription Queue
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      <section className="grid">
        <article className="card">
          <span className="muted">Onboarding status</span>
          <span className="metric" style={{ fontSize: 24 }}>{onboarding?.status ?? (isLoading ? '...' : 'draft')}</span>
          <p className="muted">Current lifecycle state for this organization’s onboarding record.</p>
        </article>
        <article className="card">
          <span className="muted">Recommended plan</span>
          <span className="metric" style={{ fontSize: 24 }}>{onboarding?.recommendation?.recommendedPlanName ?? 'Pending'}</span>
          <p className="muted">Generated from staffing, operations, billing, and migration inputs.</p>
        </article>
        <article className="card">
          <span className="muted">Selected plan</span>
          <span className="metric" style={{ fontSize: 24 }}>{selectedPlan?.name ?? 'None'}</span>
          <p className="muted">Platform admin can override before final confirmation.</p>
        </article>
        <article className="card">
          <span className="muted">Last saved</span>
          <span className="metric" style={{ fontSize: 24 }}>{lastSavedAt ? formatDateTime(lastSavedAt) : 'Not yet'}</span>
          <p className="muted">Draft saves preserve work between steps.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeaderRow">
          <div>
            <h2 className="sectionTitle">Wizard progress</h2>
            <p className="muted">Move step by step or jump back to adjust inputs before you finalize the setup.</p>
          </div>
        </div>
        <div className="timeline" style={{ marginTop: 16 }}>
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`listItemCard adminQueueButton ${currentStep === step.id ? 'adminSelectedCard' : ''}`}
              onClick={() => setCurrentStep(step.id)}
              style={{ textAlign: 'left' }}
            >
              <strong>{index + 1}. {step.label}</strong>
              <span className="muted">{step.id.replaceAll('_', ' ')}</span>
            </button>
          ))}
        </div>
      </section>

      {currentStep === 'organization_identity' ? (
        <SectionBlock title="Step 1. Organization identity" description="Capture the clinic’s base identity, location footprint, and core contact metadata.">
          <div className="grid">
            <label className="fieldLabel">
              Organization name
              <input className="inputField" value={answers.organizationIdentity.organizationName} onChange={(event) => setOrganizationIdentity('organizationName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Display name
              <input className="inputField" value={answers.organizationIdentity.displayName} onChange={(event) => setOrganizationIdentity('displayName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Organization type
              <input className="inputField" value={answers.organizationIdentity.organizationType} onChange={(event) => setOrganizationIdentity('organizationType', event.target.value)} placeholder="Outpatient, MAT clinic, residential, etc." />
            </label>
            <label className="fieldLabel">
              Number of locations
              <input type="number" min="1" className="inputField" value={toInputNumber(answers.organizationIdentity.numberOfLocations)} onChange={(event) => setOrganizationIdentity('numberOfLocations', Number(event.target.value || '1'))} />
            </label>
            <label className="fieldLabel">
              Timezone
              <input className="inputField" value={answers.organizationIdentity.timezone} onChange={(event) => setOrganizationIdentity('timezone', event.target.value)} placeholder="America/New_York" />
            </label>
            <label className="fieldLabel">
              Website
              <input className="inputField" value={answers.organizationIdentity.website} onChange={(event) => setOrganizationIdentity('website', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Primary phone
              <input className="inputField" value={answers.organizationIdentity.primaryPhone} onChange={(event) => setOrganizationIdentity('primaryPhone', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Primary email
              <input className="inputField" value={answers.organizationIdentity.primaryEmail} onChange={(event) => setOrganizationIdentity('primaryEmail', event.target.value)} />
            </label>
            <label className="fieldLabel">
              NPI
              <input className="inputField" value={answers.organizationIdentity.npi} onChange={(event) => setOrganizationIdentity('npi', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Tax ID
              <input className="inputField" value={answers.organizationIdentity.taxId} onChange={(event) => setOrganizationIdentity('taxId', event.target.value)} />
            </label>
          </div>
          <label className="fieldLabel">
            Primary location address
            <textarea className="inputField textareaField" value={answers.organizationIdentity.primaryLocationAddress} onChange={(event) => setOrganizationIdentity('primaryLocationAddress', event.target.value)} />
          </label>
        </SectionBlock>
      ) : null}

      {currentStep === 'primary_contacts' ? (
        <SectionBlock title="Step 2. Primary contacts" description="Collect the people who will own launch, billing, clinical rollout, and technical coordination.">
          <div className="grid">
            <label className="fieldLabel">
              Primary admin name
              <input className="inputField" value={answers.primaryContacts.primaryAdminFullName} onChange={(event) => setPrimaryContacts('primaryAdminFullName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Primary admin email
              <input className="inputField" value={answers.primaryContacts.primaryAdminEmail} onChange={(event) => setPrimaryContacts('primaryAdminEmail', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Primary admin phone
              <input className="inputField" value={answers.primaryContacts.primaryAdminPhone} onChange={(event) => setPrimaryContacts('primaryAdminPhone', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Billing contact name
              <input className="inputField" value={answers.primaryContacts.billingContactName} onChange={(event) => setPrimaryContacts('billingContactName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Billing contact email
              <input className="inputField" value={answers.primaryContacts.billingContactEmail} onChange={(event) => setPrimaryContacts('billingContactEmail', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Clinical lead name
              <input className="inputField" value={answers.primaryContacts.clinicalLeadName} onChange={(event) => setPrimaryContacts('clinicalLeadName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Clinical lead email
              <input className="inputField" value={answers.primaryContacts.clinicalLeadEmail} onChange={(event) => setPrimaryContacts('clinicalLeadEmail', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Technical contact name
              <input className="inputField" value={answers.primaryContacts.technicalContactName} onChange={(event) => setPrimaryContacts('technicalContactName', event.target.value)} />
            </label>
            <label className="fieldLabel">
              Technical contact email
              <input className="inputField" value={answers.primaryContacts.technicalContactEmail} onChange={(event) => setPrimaryContacts('technicalContactEmail', event.target.value)} />
            </label>
          </div>
        </SectionBlock>
      ) : null}

      {currentStep === 'operational_profile' ? (
        <SectionBlock title="Step 3. Operational profile" description="Understand size, billing complexity, growth expectations, and higher-tier platform needs.">
          <div className="grid">
            <label className="fieldLabel">
              Number of clinicians
              <input type="number" min="0" className="inputField" value={toInputNumber(answers.operationalProfile.numberOfClinicians)} onChange={(event) => setOperationalProfile('numberOfClinicians', Number(event.target.value || '0'))} />
            </label>
            <label className="fieldLabel">
              Number of org/admin users
              <input type="number" min="0" className="inputField" value={toInputNumber(answers.operationalProfile.numberOfOrgAdminUsers)} onChange={(event) => setOperationalProfile('numberOfOrgAdminUsers', Number(event.target.value || '0'))} />
            </label>
            <label className="fieldLabel">
              Approximate active client count
              <input type="number" min="0" className="inputField" value={toInputNumber(answers.operationalProfile.approximateActiveClientCount)} onChange={(event) => setOperationalProfile('approximateActiveClientCount', Number(event.target.value || '0'))} />
            </label>
            <label className="fieldLabel">
              Expected growth next 12 months (%)
              <input type="number" min="0" className="inputField" value={toInputNumber(answers.operationalProfile.expectedGrowthNext12Months)} onChange={(event) => setOperationalProfile('expectedGrowthNext12Months', Number(event.target.value || '0'))} />
            </label>
            <label className="fieldLabel">
              Billing model
              <select className="inputField" value={answers.operationalProfile.billingModel} onChange={(event) => setOperationalProfile('billingModel', event.target.value as PlatformOnboardingAnswers['operationalProfile']['billingModel'])}>
                <option value="not_applicable">Not applicable</option>
                <option value="in_house">In-house</option>
                <option value="outsourced">Outsourced</option>
              </select>
            </label>
          </div>
          <div className="timeline">
            {[
              ['billsInsurance', 'Bills insurance'],
              ['needsClaimsRemittanceWorkflows', 'Needs claims/remittance workflows'],
              ['needsConsumerPortal', 'Needs consumer portal'],
              ['needsAdvancedReporting', 'Needs advanced reporting'],
              ['needsMultiLocationManagement', 'Needs multi-location management'],
              ['needsSso', 'Needs SSO'],
              ['needsApiAccess', 'Needs API access'],
              ['needsCustomBranding', 'Needs custom branding'],
              ['needsPrioritySupport', 'Needs priority support'],
              ['hasExistingDataToImport', 'Already has data to import']
            ].map(([field, label]) => (
              <label key={field} className="listItemCard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(answers.operationalProfile[field as keyof PlatformOnboardingAnswers['operationalProfile']])}
                  onChange={(event) =>
                    setOperationalProfile(
                      field as keyof PlatformOnboardingAnswers['operationalProfile'],
                      event.target.checked as never
                    )
                  }
                />
              </label>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {currentStep === 'import_migration' ? (
        <SectionBlock title="Step 4. Import and migration" description="Capture whether the clinic needs historical data import and how much platform assistance is expected.">
          <div className="timeline">
            <label className="listItemCard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Needs data import</span>
              <input type="checkbox" checked={answers.importMigration.needsDataImport} onChange={(event) => setImportMigration('needsDataImport', event.target.checked)} />
            </label>
            <label className="listItemCard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Wants platform migration assistance</span>
              <input type="checkbox" checked={answers.importMigration.wantsPlatformAssistance} onChange={(event) => setImportMigration('wantsPlatformAssistance', event.target.checked)} />
            </label>
          </div>
          <div className="timeline">
            {importDataTypeOptions.map((option) => (
              <label key={option} className="listItemCard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{option}</span>
                <input type="checkbox" checked={answers.importMigration.dataTypes.includes(option)} onChange={() => toggleImportType(option)} />
              </label>
            ))}
          </div>
          <div className="grid">
            <label className="fieldLabel">
              Source system
              <input className="inputField" value={answers.importMigration.sourceSystem} onChange={(event) => setImportMigration('sourceSystem', event.target.value)} placeholder="Athena, spreadsheet, legacy EHR, etc." />
            </label>
            <label className="fieldLabel">
              Source format
              <input className="inputField" value={answers.importMigration.sourceFormat} onChange={(event) => setImportMigration('sourceFormat', event.target.value)} placeholder="CSV, XLSX, flat file, API export" />
            </label>
          </div>
        </SectionBlock>
      ) : null}

      {currentStep === 'recommendation' ? (
        <div className="adminPanelGrid">
          <SectionBlock title="Step 5. Recommendation engine" description="Generate the baseline plan and module recommendation, then adjust it before final confirmation.">
            <div className="actionRow">
              <button type="button" className="primaryButton" onClick={handleRecommend} disabled={isRecommending}>
                {isRecommending ? 'Generating recommendation...' : 'Generate recommendation'}
              </button>
            </div>
            {onboarding?.recommendation ? (
              <>
                <article className="supportPanel">
                  <strong>{onboarding.aiSummary ?? onboarding.recommendation.recommendedPlanName}</strong>
                  <p className="muted" style={{ marginBottom: 8 }}>{onboarding.aiExplanation ?? 'Recommendation explanation pending.'}</p>
                  <p className="muted" style={{ marginBottom: 0 }}>{onboarding.aiMigrationRiskSummary ?? onboarding.recommendation.importSummary}</p>
                </article>
                <div className="timeline">
                  {onboarding.recommendation.reasons.map((reason) => (
                    <article key={reason} className="listItemCard">
                      <strong>Why this fits</strong>
                      <span className="muted">{reason}</span>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">No recommendation yet. Save your answers and generate one from this step.</p>
            )}
            <label className="fieldLabel">
              Selected plan
              <select className="inputField" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                <option value="">Choose a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedPlan ? (
              <article className="listItemCard">
                <strong>{selectedPlan.name}</strong>
                <span className="muted">{selectedPlan.shortDescription ?? selectedPlan.description}</span>
                <span className="muted">
                  {selectedPlan.customPricingRequired ? 'Custom pricing / sales review' : `${formatMoney(selectedPlan.pricing.basePriceCents)} monthly base`}
                </span>
              </article>
            ) : null}
          </SectionBlock>

          <SectionBlock title="Modules and add-ons" description="Use the recommendation as a starting point, then confirm which features should be part of the draft setup.">
            <div className="timeline">
              {features.map((feature) => (
                <FeatureSelectionCard
                  key={feature.id}
                  feature={feature}
                  checked={selectedFeatureSet.has(feature.key)}
                  availability={planAvailabilityForFeature(selectedPlan, feature)}
                  onToggle={() => toggleSelectedFeature(feature.key)}
                />
              ))}
            </div>
          </SectionBlock>
        </div>
      ) : null}

      {currentStep === 'review' ? (
        <div className="adminPanelGrid">
          <SectionBlock title="Step 6. Review and confirmation" description="Confirm the collected information, final plan choice, and selected modules before the wizard writes into org onboarding and subscription setup.">
            <div className="timeline">
              <article className="listItemCard">
                <strong>Organization</strong>
                <span className="muted">{answers.organizationIdentity.organizationName}</span>
                <span className="muted">{answers.organizationIdentity.organizationType || 'Type not specified'}</span>
                <span className="muted">{answers.organizationIdentity.numberOfLocations} locations • {answers.organizationIdentity.timezone || 'Timezone pending'}</span>
              </article>
              <article className="listItemCard">
                <strong>Primary contacts</strong>
                <span className="muted">{answers.primaryContacts.primaryAdminFullName || 'Primary admin pending'} • {answers.primaryContacts.primaryAdminEmail || 'No email yet'}</span>
                <span className="muted">Billing: {answers.primaryContacts.billingContactEmail || 'Not provided'}</span>
                <span className="muted">Clinical: {answers.primaryContacts.clinicalLeadEmail || 'Not provided'}</span>
              </article>
              <article className="listItemCard">
                <strong>Operational profile</strong>
                <span className="muted">
                  {answers.operationalProfile.numberOfClinicians} clinicians • {answers.operationalProfile.numberOfOrgAdminUsers} admin users • {answers.operationalProfile.approximateActiveClientCount} active clients
                </span>
                <span className="muted">
                  Insurance: {answers.operationalProfile.billsInsurance ? 'Yes' : 'No'} • Billing model: {answers.operationalProfile.billingModel.replaceAll('_', ' ')}
                </span>
              </article>
              <article className="listItemCard">
                <strong>Plan and modules</strong>
                <span className="muted">{selectedPlan?.name ?? 'No selected plan yet'}</span>
                <span className="muted">{selectedFeatureKeys.length} selected modules/add-ons</span>
              </article>
            </div>
            <label className="fieldLabel">
              Platform admin review notes
              <textarea className="inputField textareaField" value={adminReviewNotes} onChange={(event) => setAdminReviewNotes(event.target.value)} placeholder="Override rationale, migration notes, or activation guidance." />
            </label>
            <div className="actionRow">
              <button type="button" className="primaryButton" onClick={handleComplete} disabled={isCompleting}>
                {isCompleting ? 'Finalizing onboarding...' : 'Finalize organization setup'}
              </button>
            </div>
            {completionResult ? (
              <article className="supportPanel">
                <strong>Finalized</strong>
                <p className="muted" style={{ marginBottom: 8 }}>{completionResult.ai.explanation}</p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Subscription draft now points to <strong>{completionResult.subscription.planName ?? 'the selected plan'}</strong>.
                </p>
              </article>
            ) : null}
          </SectionBlock>

          <SectionBlock title="Migration and AI notes" description="Keep the AI explanation as advisory context for the platform admin review.">
            <article className="listItemCard">
              <strong>{onboarding?.aiSummary ?? 'AI summary pending'}</strong>
              <span className="muted">{onboarding?.aiExplanation ?? 'Generate a recommendation to see the narrative explanation.'}</span>
              <span className="muted">{onboarding?.aiMigrationRiskSummary ?? 'Migration risk summary will appear here after recommendation.'}</span>
            </article>
            {(onboarding?.recommendation?.flags ?? []).map((flag) => (
              <article key={flag} className="listItemCard">
                <strong>Review flag</strong>
                <span className="muted">{flag}</span>
              </article>
            ))}
          </SectionBlock>
        </div>
      ) : null}

      <section className="card">
        <div className="actionRow" style={{ justifyContent: 'space-between' }}>
          <div className="actionRow">
            <button type="button" className="secondaryButton" onClick={handlePreviousStep} disabled={currentStep === 'organization_identity'}>
              Previous
            </button>
            <button type="button" className="secondaryButton" onClick={() => saveDraft()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save draft'}
            </button>
          </div>
          <div className="actionRow">
            <button type="button" className="primaryButton" onClick={handleNextStep} disabled={currentStep === 'review' || isSaving}>
              Next
            </button>
          </div>
        </div>
      </section>
    </PlatformWorkspaceShell>
  );
}
