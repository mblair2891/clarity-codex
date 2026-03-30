import type { PlanFeatureAvailability, Prisma } from '@prisma/client';

export interface OrganizationOnboardingAnswers {
  organizationIdentity: {
    organizationName: string;
    displayName: string;
    organizationType: string;
    numberOfLocations: number;
    primaryLocationAddress: string;
    timezone: string;
    npi: string;
    taxId: string;
    website: string;
    primaryPhone: string;
    primaryEmail: string;
  };
  primaryContacts: {
    primaryAdminFullName: string;
    primaryAdminEmail: string;
    primaryAdminPhone: string;
    billingContactName: string;
    billingContactEmail: string;
    clinicalLeadName: string;
    clinicalLeadEmail: string;
    technicalContactName: string;
    technicalContactEmail: string;
  };
  operationalProfile: {
    numberOfClinicians: number;
    numberOfOrgAdminUsers: number;
    approximateActiveClientCount: number;
    expectedGrowthNext12Months: number;
    billsInsurance: boolean;
    billingModel: 'in_house' | 'outsourced' | 'not_applicable';
    needsClaimsRemittanceWorkflows: boolean;
    needsConsumerPortal: boolean;
    needsAdvancedReporting: boolean;
    needsMultiLocationManagement: boolean;
    needsSso: boolean;
    needsApiAccess: boolean;
    needsCustomBranding: boolean;
    needsPrioritySupport: boolean;
    hasExistingDataToImport: boolean;
  };
  importMigration: {
    needsDataImport: boolean;
    dataTypes: string[];
    sourceSystem: string;
    sourceFormat: string;
    wantsPlatformAssistance: boolean;
  };
}

export interface OrganizationOnboardingRecommendation {
  recommendedPlanKey: string | null;
  recommendedPlanId: string | null;
  recommendedPlanName: string | null;
  recommendedFeatureKeys: string[];
  includedFeatureKeys: string[];
  addOnFeatureKeys: string[];
  reasons: string[];
  flags: string[];
  operationalHighlights: string[];
  importComplexity: 'low' | 'medium' | 'high';
  importSummary: string;
  adminNotes: string[];
}

type PlanRecord = {
  id: string;
  key: string;
  name: string;
  maxLocations: number | null;
  maxOrgUsers: number | null;
  maxClinicians: number | null;
  maxActiveClients: number | null;
  unlimitedLocations: boolean;
  unlimitedOrgUsers: boolean;
  unlimitedClinicians: boolean;
  unlimitedActiveClients: boolean;
  customPricingRequired: boolean;
  salesContactRequired: boolean;
  ssoIncluded: boolean;
  apiAccessIncluded: boolean;
  customBrandingIncluded: boolean;
  planFeatures: Array<{
    availability: PlanFeatureAvailability;
    feature: {
      key: string;
    };
  }>;
};

type FeatureRecord = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
};

export interface SerializedOrganizationOnboarding {
  id: string | null;
  status: string;
  currentStep: string | null;
  answers: OrganizationOnboardingAnswers;
  recommendation: OrganizationOnboardingRecommendation | null;
  recommendedPlanId: string | null;
  selectedPlanId: string | null;
  recommendedFeatureKeys: string[];
  selectedFeatureKeys: string[];
  requiresImport: boolean;
  importTypes: string[];
  sourceSystem: string | null;
  sourceFormat: string | null;
  migrationAssistRequested: boolean;
  aiSummary: string | null;
  aiExplanation: string | null;
  aiMigrationRiskSummary: string | null;
  adminReviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function normalizeNumber(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value ?? 0));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function buildDefaultOnboardingAnswers(): OrganizationOnboardingAnswers {
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

export function normalizeOnboardingAnswers(input: OrganizationOnboardingAnswers): OrganizationOnboardingAnswers {
  return {
    organizationIdentity: {
      organizationName: input.organizationIdentity.organizationName.trim(),
      displayName: input.organizationIdentity.displayName.trim(),
      organizationType: input.organizationIdentity.organizationType.trim(),
      numberOfLocations: Math.max(1, normalizeNumber(input.organizationIdentity.numberOfLocations)),
      primaryLocationAddress: input.organizationIdentity.primaryLocationAddress.trim(),
      timezone: input.organizationIdentity.timezone.trim(),
      npi: input.organizationIdentity.npi.trim(),
      taxId: input.organizationIdentity.taxId.trim(),
      website: input.organizationIdentity.website.trim(),
      primaryPhone: input.organizationIdentity.primaryPhone.trim(),
      primaryEmail: input.organizationIdentity.primaryEmail.trim()
    },
    primaryContacts: {
      primaryAdminFullName: input.primaryContacts.primaryAdminFullName.trim(),
      primaryAdminEmail: input.primaryContacts.primaryAdminEmail.trim(),
      primaryAdminPhone: input.primaryContacts.primaryAdminPhone.trim(),
      billingContactName: input.primaryContacts.billingContactName.trim(),
      billingContactEmail: input.primaryContacts.billingContactEmail.trim(),
      clinicalLeadName: input.primaryContacts.clinicalLeadName.trim(),
      clinicalLeadEmail: input.primaryContacts.clinicalLeadEmail.trim(),
      technicalContactName: input.primaryContacts.technicalContactName.trim(),
      technicalContactEmail: input.primaryContacts.technicalContactEmail.trim()
    },
    operationalProfile: {
      numberOfClinicians: normalizeNumber(input.operationalProfile.numberOfClinicians),
      numberOfOrgAdminUsers: normalizeNumber(input.operationalProfile.numberOfOrgAdminUsers),
      approximateActiveClientCount: normalizeNumber(input.operationalProfile.approximateActiveClientCount),
      expectedGrowthNext12Months: normalizeNumber(input.operationalProfile.expectedGrowthNext12Months),
      billsInsurance: Boolean(input.operationalProfile.billsInsurance),
      billingModel: input.operationalProfile.billingModel,
      needsClaimsRemittanceWorkflows: Boolean(input.operationalProfile.needsClaimsRemittanceWorkflows),
      needsConsumerPortal: Boolean(input.operationalProfile.needsConsumerPortal),
      needsAdvancedReporting: Boolean(input.operationalProfile.needsAdvancedReporting),
      needsMultiLocationManagement: Boolean(input.operationalProfile.needsMultiLocationManagement),
      needsSso: Boolean(input.operationalProfile.needsSso),
      needsApiAccess: Boolean(input.operationalProfile.needsApiAccess),
      needsCustomBranding: Boolean(input.operationalProfile.needsCustomBranding),
      needsPrioritySupport: Boolean(input.operationalProfile.needsPrioritySupport),
      hasExistingDataToImport: Boolean(input.operationalProfile.hasExistingDataToImport)
    },
    importMigration: {
      needsDataImport: Boolean(input.importMigration.needsDataImport),
      dataTypes: normalizeStringArray(input.importMigration.dataTypes),
      sourceSystem: input.importMigration.sourceSystem.trim(),
      sourceFormat: input.importMigration.sourceFormat.trim(),
      wantsPlatformAssistance: Boolean(input.importMigration.wantsPlatformAssistance)
    }
  };
}

export function parseOnboardingAnswers(value: Prisma.JsonValue | null | undefined): OrganizationOnboardingAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return buildDefaultOnboardingAnswers();
  }

  const candidate = value as Partial<OrganizationOnboardingAnswers>;
  const defaults = buildDefaultOnboardingAnswers();

  return normalizeOnboardingAnswers({
    organizationIdentity: {
      ...defaults.organizationIdentity,
      ...(candidate.organizationIdentity ?? {})
    },
    primaryContacts: {
      ...defaults.primaryContacts,
      ...(candidate.primaryContacts ?? {})
    },
    operationalProfile: {
      ...defaults.operationalProfile,
      ...(candidate.operationalProfile ?? {})
    },
    importMigration: {
      ...defaults.importMigration,
      ...(candidate.importMigration ?? {})
    }
  });
}

export function parseOnboardingRecommendation(
  value: Prisma.JsonValue | null | undefined
): OrganizationOnboardingRecommendation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<OrganizationOnboardingRecommendation>;

  return {
    recommendedPlanKey: typeof candidate.recommendedPlanKey === 'string' ? candidate.recommendedPlanKey : null,
    recommendedPlanId: typeof candidate.recommendedPlanId === 'string' ? candidate.recommendedPlanId : null,
    recommendedPlanName: typeof candidate.recommendedPlanName === 'string' ? candidate.recommendedPlanName : null,
    recommendedFeatureKeys: normalizeStringArray(candidate.recommendedFeatureKeys),
    includedFeatureKeys: normalizeStringArray(candidate.includedFeatureKeys),
    addOnFeatureKeys: normalizeStringArray(candidate.addOnFeatureKeys),
    reasons: normalizeStringArray(candidate.reasons),
    flags: normalizeStringArray(candidate.flags),
    operationalHighlights: normalizeStringArray(candidate.operationalHighlights),
    importComplexity:
      candidate.importComplexity === 'high' || candidate.importComplexity === 'medium' || candidate.importComplexity === 'low'
        ? candidate.importComplexity
        : 'low',
    importSummary: typeof candidate.importSummary === 'string' ? candidate.importSummary : 'No import review has been generated yet.',
    adminNotes: normalizeStringArray(candidate.adminNotes)
  };
}

function resolvePlanFeatureKeys(plan: PlanRecord | null, availability: PlanFeatureAvailability) {
  if (!plan) {
    return new Set<string>();
  }

  return new Set(
    plan.planFeatures
      .filter((feature) => feature.availability === availability)
      .map((feature) => feature.feature.key)
  );
}

function choosePlanKey(args: {
  locations: number;
  clinicians: number;
  orgUsers: number;
  activeClients: number;
  growthPct: number;
  insurance: boolean;
  needsClaims: boolean;
  advancedReporting: boolean;
  needsEnterpriseControls: boolean;
}) {
  if (
    args.needsEnterpriseControls
    || args.locations > 15
    || args.clinicians > 50
    || args.orgUsers > 100
    || args.activeClients > 600
  ) {
    return 'enterprise';
  }

  if (
    args.advancedReporting
    || args.needsClaims
    || (args.insurance && args.activeClients >= 75)
    || args.locations > 5
    || args.clinicians > 15
    || args.orgUsers > 25
    || args.activeClients > 150
  ) {
    return 'professional';
  }

  if (
    args.locations > 1
    || args.clinicians > 5
    || args.orgUsers > 10
    || args.activeClients > 40
    || args.growthPct >= 25
  ) {
    return 'growth';
  }

  return 'starter';
}

export function buildRecommendedFeatureKeys(args: {
  answers: OrganizationOnboardingAnswers;
  plan: PlanRecord | null;
  availableFeatures: FeatureRecord[];
}) {
  const keys = new Set<string>(['clinical', 'org_user_management', 'platform_support']);
  const featureKeys = new Set(args.availableFeatures.filter((feature) => feature.isActive).map((feature) => feature.key));
  const { organizationIdentity, operationalProfile, importMigration } = args.answers;
  const locations = Math.max(organizationIdentity.numberOfLocations, operationalProfile.needsMultiLocationManagement ? 2 : 1);

  if (operationalProfile.needsConsumerPortal) {
    keys.add('consumer_portal');
  }

  if (locations > 1 || operationalProfile.needsMultiLocationManagement) {
    keys.add('multi_location');
  }

  if (operationalProfile.billsInsurance || operationalProfile.billingModel !== 'not_applicable') {
    keys.add('rcm');
  }

  if (operationalProfile.needsClaimsRemittanceWorkflows) {
    keys.add('claims_management');
    keys.add('remittance_tracking');
  }

  if (operationalProfile.needsAdvancedReporting) {
    keys.add('advanced_reporting');
  }

  if (
    operationalProfile.numberOfClinicians >= 20
    || operationalProfile.numberOfOrgAdminUsers >= 10
    || locations >= 4
  ) {
    keys.add('advanced_admin_tools');
  }

  if (operationalProfile.needsApiAccess) {
    keys.add('api_access');
  }

  if (operationalProfile.needsSso) {
    keys.add('sso');
  }

  if (operationalProfile.needsCustomBranding) {
    keys.add('custom_branding');
  }

  if (operationalProfile.needsPrioritySupport || importMigration.wantsPlatformAssistance) {
    keys.add('priority_support');
  }

  const planIncludedKeys = resolvePlanFeatureKeys(args.plan, 'included');

  return [...keys].filter((key) => featureKeys.has(key) || planIncludedKeys.has(key)).sort();
}

export function buildDefaultSelectedFeatureKeys(args: {
  plan: PlanRecord | null;
  recommendedFeatureKeys: string[];
}) {
  const planIncludedKeys = resolvePlanFeatureKeys(args.plan, 'included');

  return [...new Set([...planIncludedKeys, ...args.recommendedFeatureKeys])].sort();
}

export function recommendOrganizationOnboarding(args: {
  plans: PlanRecord[];
  features: FeatureRecord[];
  answers: OrganizationOnboardingAnswers;
}): OrganizationOnboardingRecommendation {
  const { organizationIdentity, operationalProfile, importMigration } = args.answers;
  const locations = Math.max(organizationIdentity.numberOfLocations, operationalProfile.needsMultiLocationManagement ? 2 : 1);
  const clinicians = operationalProfile.numberOfClinicians;
  const orgUsers = operationalProfile.numberOfOrgAdminUsers;
  const activeClients = operationalProfile.approximateActiveClientCount;
  const growthPct = operationalProfile.expectedGrowthNext12Months;
  const needsEnterpriseControls = [
    operationalProfile.needsSso,
    operationalProfile.needsApiAccess,
    operationalProfile.needsCustomBranding,
    operationalProfile.needsPrioritySupport
  ].some(Boolean);
  const recommendedPlanKey = choosePlanKey({
    locations,
    clinicians,
    orgUsers,
    activeClients,
    growthPct,
    insurance: operationalProfile.billsInsurance,
    needsClaims: operationalProfile.needsClaimsRemittanceWorkflows,
    advancedReporting: operationalProfile.needsAdvancedReporting,
    needsEnterpriseControls
  });
  const plan = args.plans.find((entry) => entry.key === recommendedPlanKey) ?? args.plans[0] ?? null;
  const recommendedFeatureKeys = buildRecommendedFeatureKeys({
    answers: args.answers,
    plan,
    availableFeatures: args.features
  });
  const planIncludedKeys = resolvePlanFeatureKeys(plan, 'included');
  const includedFeatureKeys = recommendedFeatureKeys.filter((key) => planIncludedKeys.has(key));
  const addOnFeatureKeys = recommendedFeatureKeys.filter((key) => !planIncludedKeys.has(key));
  const reasons: string[] = [];
  const flags: string[] = [];
  const operationalHighlights: string[] = [];
  const adminNotes: string[] = [];

  if (locations > 1) {
    reasons.push(`${locations} locations require stronger operations and location-aware packaging.`);
    operationalHighlights.push(`Multi-site footprint: ${locations} locations planned.`);
  }

  if (clinicians > 0) {
    operationalHighlights.push(`${clinicians} clinicians expected at launch.`);
  }

  if (orgUsers > 0) {
    operationalHighlights.push(`${orgUsers} admin or operational users expected.`);
  }

  if (activeClients > 0) {
    operationalHighlights.push(`${activeClients} active clients expected.`);
  }

  if (growthPct >= 25) {
    reasons.push(`Projected growth of ${growthPct}% in the next 12 months points toward headroom over a starter package.`);
    flags.push('Growth projection suggests validating included-seat and active-client thresholds during contracting.');
  }

  if (operationalProfile.billsInsurance) {
    reasons.push('Insurance billing requires revenue-cycle workflows in the recommended package.');
  }

  if (operationalProfile.needsClaimsRemittanceWorkflows) {
    reasons.push('Claims and remittance workflows justify RCM, claims management, and remittance tracking.');
    flags.push('Claims implementation usually needs payer workflow validation before go-live.');
  }

  if (operationalProfile.needsAdvancedReporting) {
    reasons.push('Advanced reporting needs push the recommendation into a higher operational tier.');
  }

  if (needsEnterpriseControls) {
    reasons.push('SSO, API access, custom branding, or priority support point toward enterprise packaging and review.');
    flags.push('Enterprise-only requests should receive platform admin review before pricing is finalized.');
  }

  if (plan?.customPricingRequired) {
    adminNotes.push('Custom pricing or sales review is likely required for the recommended plan.');
  }

  if (plan?.salesContactRequired) {
    adminNotes.push('Coordinate with sales or platform leadership before activating the subscription.');
  }

  if (operationalProfile.billingModel === 'outsourced') {
    adminNotes.push('Confirm whether outsourced billing still needs direct claims visibility or only reporting access.');
  }

  const importScore =
    (importMigration.needsDataImport || operationalProfile.hasExistingDataToImport ? 1 : 0)
    + Math.min(importMigration.dataTypes.length, 3)
    + (importMigration.wantsPlatformAssistance ? 1 : 0)
    + (/billing/i.test(importMigration.dataTypes.join(' ')) ? 1 : 0)
    + (locations > 1 ? 1 : 0);
  const importComplexity = importScore >= 4 ? 'high' : importScore >= 2 ? 'medium' : 'low';
  const importSummary = !importMigration.needsDataImport && !operationalProfile.hasExistingDataToImport
    ? 'No data import was requested, so onboarding can follow a standard setup path.'
    : importComplexity === 'high'
      ? 'Import scope looks high-complexity because it spans multiple data domains or operational dependencies and should be reviewed before go-live.'
      : importComplexity === 'medium'
        ? 'Import scope looks manageable but should be validated with a sample extract and field map before onboarding starts.'
        : 'Import scope appears light and can likely follow a streamlined template-based onboarding path.';

  if (importComplexity !== 'low') {
    flags.push(importSummary);
  }

  if (!reasons.length && plan) {
    reasons.push(`${plan.name} matches the current scale and requested capabilities without unnecessary enterprise packaging.`);
  }

  return {
    recommendedPlanKey: plan?.key ?? null,
    recommendedPlanId: plan?.id ?? null,
    recommendedPlanName: plan?.name ?? null,
    recommendedFeatureKeys,
    includedFeatureKeys,
    addOnFeatureKeys,
    reasons,
    flags,
    operationalHighlights,
    importComplexity,
    importSummary,
    adminNotes
  };
}

export function serializeOrganizationOnboarding(
  record: ({
    id: string;
    status: string;
    currentStep: string | null;
    answers: Prisma.JsonValue | null;
    recommendation: Prisma.JsonValue | null;
    recommendedPlanId: string | null;
    selectedPlanId: string | null;
    recommendedFeatureKeys: Prisma.JsonValue | null;
    selectedFeatureKeys: Prisma.JsonValue | null;
    requiresImport: boolean;
    importTypes: Prisma.JsonValue | null;
    sourceSystem: string | null;
    sourceFormat: string | null;
    migrationAssistRequested: boolean;
    aiSummary: string | null;
    aiExplanation: string | null;
    aiMigrationRiskSummary: string | null;
    adminReviewNotes: string | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } & {
    recommendedPlan?: { id: string } | null;
    selectedPlan?: { id: string } | null;
  }) | null
): SerializedOrganizationOnboarding {
  const answers = parseOnboardingAnswers(record?.answers);
  const recommendation = parseOnboardingRecommendation(record?.recommendation);

  return {
    id: record?.id ?? null,
    status: record?.status ?? 'draft',
    currentStep: record?.currentStep ?? null,
    answers,
    recommendation,
    recommendedPlanId: record?.recommendedPlanId ?? recommendation?.recommendedPlanId ?? null,
    selectedPlanId: record?.selectedPlanId ?? null,
    recommendedFeatureKeys: normalizeStringArray(record?.recommendedFeatureKeys) || recommendation?.recommendedFeatureKeys || [],
    selectedFeatureKeys: normalizeStringArray(record?.selectedFeatureKeys),
    requiresImport:
      record?.requiresImport ?? (answers.importMigration.needsDataImport || answers.operationalProfile.hasExistingDataToImport),
    importTypes: normalizeStringArray(record?.importTypes) || answers.importMigration.dataTypes,
    sourceSystem: record?.sourceSystem ?? (answers.importMigration.sourceSystem || null),
    sourceFormat: record?.sourceFormat ?? (answers.importMigration.sourceFormat || null),
    migrationAssistRequested: record?.migrationAssistRequested ?? answers.importMigration.wantsPlatformAssistance,
    aiSummary: record?.aiSummary ?? null,
    aiExplanation: record?.aiExplanation ?? null,
    aiMigrationRiskSummary: record?.aiMigrationRiskSummary ?? null,
    adminReviewNotes: record?.adminReviewNotes ?? null,
    submittedAt: record?.submittedAt?.toISOString() ?? null,
    reviewedAt: record?.reviewedAt?.toISOString() ?? null,
    completedAt: record?.completedAt?.toISOString() ?? null,
    createdAt: record?.createdAt?.toISOString() ?? null,
    updatedAt: record?.updatedAt?.toISOString() ?? null
  };
}
