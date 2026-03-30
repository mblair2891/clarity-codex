'use client';

import type { AppRole } from '@clarity/domain';
import { resolveApiBaseUrl } from './api-base-url';

export const tokenStorageKey = 'clarity.beta.token';

export class ApiResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

export type SessionAccessContext = {
  type: 'USER' | 'SUPPORT';
  platformRoles: string[];
  activeOrganizationId: string | null;
  activeMembershipId: string | null;
  activeLocationId: string | null;
  supportMode: boolean;
  permissions: string[];
};

export type SessionOrganization = {
  id: string;
  name: string;
  npi: string | null;
};

export type SessionLocation = {
  id: string;
  name: string;
  timezone: string | null;
};

export type SessionSupportDetails = {
  id: string;
  reason: string | null;
  ticketReference: string | null;
  startedAt: string;
  expiresAt: string;
};

export type AuthMeResponse = {
  landingPath: string;
  user: SessionUser;
  tenant: {
    id: string;
      slug: string;
      name: string;
    };
  accessContext: SessionAccessContext;
  organization: SessionOrganization | null;
  location: SessionLocation | null;
  supportSession: SessionSupportDetails | null;
};

export type LoginResponse = AuthMeResponse & {
  token: string;
};

export type ResetSystemResponse = {
  reset: true;
  environment: string;
  preserved: {
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
    };
    records: {
      tenants: number;
      users: number;
    };
  };
  deleted: Record<string, number>;
  remaining: Record<string, number>;
};

export type PlatformSubscriptionScaffold = {
  id: string | null;
  planId: string | null;
  planKey: string | null;
  planName: string | null;
  subscriptionStatus: string;
  billingStatus: string;
  billingCustomerId: string | null;
  billingProvider: string | null;
  billingContactEmail: string | null;
  customPricingEnabled: boolean;
  enterpriseManaged: boolean;
  basePriceCents: number;
  annualBasePriceCents: number | null;
  setupFeeCents: number | null;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  includedActiveClients: number | null;
  includedClinicians: number | null;
  currency: string;
  billingInterval: string;
  startsAt: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  nextInvoiceDate: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PlatformPlan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  targetCustomerProfile: string | null;
  customPricingRequired: boolean;
  salesContactRequired: boolean;
  badgeLabel: string | null;
  pricing: {
    basePriceCents: number;
    annualBasePriceCents: number | null;
    setupFeeCents: number | null;
    trialDays: number | null;
    activeClientPriceCents: number;
    clinicianPriceCents: number;
    includedActiveClients: number | null;
    includedClinicians: number | null;
    currency: string;
    billingInterval: string;
  };
  limits: {
    maxLocations: number | null;
    maxOrgUsers: number | null;
    maxClinicians: number | null;
    maxActiveClients: number | null;
    unlimitedLocations: boolean;
    unlimitedOrgUsers: boolean;
    unlimitedClinicians: boolean;
    unlimitedActiveClients: boolean;
  };
  packaging: {
    apiAccessIncluded: boolean;
    ssoIncluded: boolean;
    customBrandingIncluded: boolean;
  };
  includedFeatures: PlatformPlanFeature[];
  availableAddOns: PlatformPlanFeature[];
  featureMatrix: PlatformPlanFeature[];
  organizationCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformFeature = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  category: string | null;
  isActive: boolean;
  isAddOn: boolean;
  defaultMonthlyPriceCents: number | null;
  defaultAnnualPriceCents: number | null;
  badgeLabel: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformPlanFeature = {
  feature: PlatformFeature;
  availability: 'included' | 'add_on' | 'excluded';
  included: boolean;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  notes: string | null;
};

export type PlatformOrganizationFeature = PlatformFeature & {
  enabled: boolean;
  includedInPlan: boolean;
  availableAsAddOn: boolean;
  source: 'plan' | 'override' | 'none';
  planAvailability: 'included' | 'add_on' | 'excluded';
  planPricing: {
    monthlyPriceCents: number | null;
    annualPriceCents: number | null;
    notes: string | null;
  } | null;
  override: {
    id: string;
    enabled: boolean;
    reason: string | null;
    createdByUserId: string | null;
    updatedByUserId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type PlatformOrganizationSummary = {
  id: string;
  name: string;
  slug: string | null;
  npi: string | null;
  taxId: string | null;
  createdAt: string;
  counts: {
    users: number;
    totalMemberships: number;
    consumers: number;
    orgAdmins: number;
    locations: number;
    activeSupportSessions: number;
    clinicalNotes: number;
    unresolvedReviews: number;
  };
  subscription: PlatformSubscriptionScaffold;
  locations: Array<{
    id: string;
    name: string;
    timezone: string | null;
    isActive: boolean;
  }>;
};

export type PlatformSupportSessionSummary = {
  id: string;
  organizationId: string;
  organizationName?: string;
  supportUserId: string;
  supportUserName: string;
  supportUserEmail: string | null;
  locationId: string | null;
  reason: string | null;
  ticketReference: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  revokedAt: string | null;
  status: string;
};

export type PlatformUserSummary = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: string;
  platformRoles: string[];
  createdAt: string;
};

export type PlatformDashboardResponse = {
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  summary: {
    totalOrganizations: number;
    totalPlatformUsers: number;
    totalOrgUsers: number;
    totalConsumers: number;
    activeSupportSessions: number;
    recentSupportSessions: number;
    subscriptionsByStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  billing: {
    isConfigured: boolean;
    plans: Array<{
      name: string;
      organizationCount: number;
    }>;
    subscriptionsByStatus: Array<{
      status: string;
      count: number;
    }>;
    note: string;
  };
  organizations: PlatformOrganizationSummary[];
  platformUsers: PlatformUserSummary[];
  support: {
    active: PlatformSupportSessionSummary[];
    recent: PlatformSupportSessionSummary[];
  };
};

export type PlatformOrganizationsResponse = {
  organizations: PlatformOrganizationSummary[];
};

export type PlatformPlansResponse = {
  plans: PlatformPlan[];
};

export type PlatformFeaturesResponse = {
  features: PlatformFeature[];
};

export type PlatformPricingCatalogResponse = {
  plans: PlatformPlan[];
  features: PlatformFeature[];
  defaults: {
    planKeys: string[];
  };
};

export type PlatformSubscriptionsResponse = {
  subscriptions: Array<{
    organization: {
      id: string;
      name: string;
      slug: string | null;
      createdAt: string;
      counts: {
        consumers: number;
        memberships: number;
        locations: number;
      };
    };
    subscription: PlatformSubscriptionScaffold;
  }>;
};

export type PlatformOrganizationDetailResponse = {
  organization: PlatformOrganizationSummary & {
    orgAdmins: Array<{
      id: string;
      fullName: string;
      email: string;
      isActive: boolean;
      role: string;
    }>;
    counts: PlatformOrganizationSummary['counts'] & {
      appointments: number;
      encounters: number;
    };
  };
  support: {
    active: PlatformSupportSessionSummary[];
    recent: PlatformSupportSessionSummary[];
  };
  lifecycle: {
    status: string;
    note: string;
  };
};

export type PlatformOnboardingAnswers = {
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
};

export type PlatformOnboardingRecommendation = {
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
};

export type PlatformOrganizationOnboarding = {
  id: string | null;
  status: string;
  currentStep: string | null;
  answers: PlatformOnboardingAnswers;
  recommendation: PlatformOnboardingRecommendation | null;
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
};

export type PlatformOrganizationOnboardingResponse = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    npi: string | null;
    taxId: string | null;
    createdAt: string;
    subscription: PlatformSubscriptionScaffold;
    locations: Array<{
      id: string;
      name: string;
      timezone: string | null;
      isActive: boolean;
    }>;
  };
  onboarding: PlatformOrganizationOnboarding;
  catalog: {
    plans: PlatformPlan[];
    features: PlatformFeature[];
  };
};

export type UpsertPlatformOrganizationOnboardingInput = {
  status?: string;
  currentStep?: string | null;
  answers: PlatformOnboardingAnswers;
  adminReviewNotes?: string | null;
};

export type PatchPlatformOrganizationOnboardingInput = {
  status?: string;
  currentStep?: string | null;
  answers?: PlatformOnboardingAnswers;
  selectedPlanId?: string | null;
  selectedFeatureKeys?: string[];
  adminReviewNotes?: string | null;
};

export type RecommendPlatformOrganizationOnboardingInput = {
  answers: PlatformOnboardingAnswers;
  currentStep?: string | null;
};

export type CompletePlatformOrganizationOnboardingInput = {
  answers: PlatformOnboardingAnswers;
  selectedPlanId: string;
  selectedFeatureKeys: string[];
  adminReviewNotes?: string | null;
};

export type UpsertPlatformOrganizationOnboardingResponse = {
  created?: boolean;
  updated?: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  onboarding: PlatformOrganizationOnboarding;
};

export type RecommendPlatformOrganizationOnboardingResponse = {
  recommended: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  onboarding: PlatformOrganizationOnboarding;
  recommendedPlan: PlatformPlan | null;
  recommendedFeatures: PlatformFeature[];
  ai: {
    summary: string;
    explanation: string;
    migrationRiskSummary: string;
    reviewNotes: string[];
  };
};

export type CompletePlatformOrganizationOnboardingResponse = {
  completed: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  onboarding: PlatformOrganizationOnboarding;
  subscription: PlatformSubscriptionScaffold;
  features: PlatformOrganizationFeature[];
  ai: {
    summary: string;
    explanation: string;
    migrationRiskSummary: string;
    reviewNotes: string[];
  };
};

export type PlatformOrganizationSubscriptionResponse = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  subscription: PlatformSubscriptionScaffold;
};

export type UpsertPlatformOrganizationSubscriptionInput = {
  planId?: string | null;
  status: string;
  billingStatus: string;
  basePriceCents: number;
  annualBasePriceCents?: number | null;
  setupFeeCents?: number | null;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  includedActiveClients?: number | null;
  includedClinicians?: number | null;
  currency: string;
  billingInterval: string;
  startsAt?: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  billingProvider?: string | null;
  billingCustomerId?: string | null;
  billingContactEmail?: string | null;
  customPricingEnabled?: boolean;
  enterpriseManaged?: boolean;
  notes?: string | null;
};

export type PatchPlatformOrganizationSubscriptionInput = Partial<UpsertPlatformOrganizationSubscriptionInput>;

export type UpsertPlatformOrganizationSubscriptionResponse = {
  created?: true;
  updated?: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  subscription: PlatformSubscriptionScaffold;
};

export type PlatformOrganizationFeaturesResponse = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
  };
  subscription: PlatformSubscriptionScaffold;
  features: PlatformOrganizationFeature[];
};

export type PatchPlatformOrganizationFeaturesInput = {
  overrides: Array<{
    featureId: string;
    enabled: boolean;
    reason?: string | null;
  }>;
};

export type UpsertPlatformPlanInput = {
  key: string;
  name: string;
  description: string;
  shortDescription: string;
  longDescription: string;
  isActive: boolean;
  sortOrder: number;
  basePriceCents: number;
  annualBasePriceCents?: number | null;
  setupFeeCents?: number | null;
  trialDays?: number | null;
  activeClientPriceCents: number;
  clinicianPriceCents: number;
  includedActiveClients?: number | null;
  includedClinicians?: number | null;
  currency: string;
  billingInterval: string;
  targetCustomerProfile: string;
  customPricingRequired: boolean;
  salesContactRequired: boolean;
  badgeLabel?: string | null;
  maxLocations?: number | null;
  maxOrgUsers?: number | null;
  maxClinicians?: number | null;
  maxActiveClients?: number | null;
  unlimitedLocations: boolean;
  unlimitedOrgUsers: boolean;
  unlimitedClinicians: boolean;
  unlimitedActiveClients: boolean;
  apiAccessIncluded: boolean;
  ssoIncluded: boolean;
  customBrandingIncluded: boolean;
  features: Array<{
    featureId: string;
    availability: 'included' | 'add_on' | 'excluded';
    monthlyPriceCents?: number | null;
    annualPriceCents?: number | null;
    notes?: string | null;
  }>;
};

export type PatchPlatformPlanInput = Partial<UpsertPlatformPlanInput>;

export type UpsertPlatformPlanResponse = {
  created?: true;
  updated?: true;
  plan: PlatformPlan;
};

export type PatchPlatformFeatureInput = {
  name?: string;
  description?: string;
  longDescription?: string;
  category?: string | null;
  isActive?: boolean;
  isAddOn?: boolean;
  defaultMonthlyPriceCents?: number | null;
  defaultAnnualPriceCents?: number | null;
  badgeLabel?: string | null;
  sortOrder?: number;
};

export type PatchPlatformFeatureResponse = {
  updated: true;
  feature: PlatformFeature;
};

export type BootstrapPlatformPricingResponse = {
  bootstrapped: true;
  seededPlans: string[];
  seededFeatures: string[];
  plans: PlatformPlan[];
};

export type PlatformSupportSessionsResponse = {
  activeSessions: PlatformSupportSessionSummary[];
  recentSessions: PlatformSupportSessionSummary[];
};

export type PlatformUsersResponse = {
  users: PlatformUserSummary[];
  counts: {
    total: number;
    active: number;
    platformAdmins: number;
    supportUsers: number;
  };
  accessModel: {
    platformAdmin: string;
    platformSupport: string;
  };
};

export type CreatePlatformOrganizationInput = {
  name: string;
  slug: string;
  npi?: string;
  taxId?: string;
};

export type CreatePlatformOrganizationResponse = {
  created: true;
  organization: {
    id: string;
    name: string;
    slug: string | null;
    npi: string | null;
    taxId: string | null;
    createdAt: string;
    subscription: PlatformSubscriptionScaffold;
  };
};

export type StartSupportSessionInput = {
  organizationId: string;
  locationId?: string;
  reason: string;
  ticketReference?: string;
};

export type StartSupportSessionResponse = {
  token: string;
  supportSession: {
    id: string;
    organizationId: string;
    locationId: string | null;
    reason: string | null;
    ticketReference: string | null;
    supportMode: true;
    expiresAt: string;
  };
};

export type EndSupportSessionResponse = {
  token: string;
  supportSessionEnded: true;
};

export function getApiBaseUrlState() {
  const apiBaseUrl = resolveApiBaseUrl();

  return {
    apiBaseUrl,
    error: apiBaseUrl
      ? null
      : 'Beta access is unavailable from this hostname. Open the beta app URL directly.'
  };
}

export function storeToken(token: string) {
  window.localStorage.setItem(tokenStorageKey, token);
}

export function getStoredToken() {
  return window.localStorage.getItem(tokenStorageKey);
}

export function clearStoredToken() {
  window.localStorage.removeItem(tokenStorageKey);
}

export async function apiFetch<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiResponseError(payload?.message ?? `Request failed for ${path}.`, response.status);
  }

  return response.json();
}

export async function fetchMe(apiBaseUrl: string, token: string) {
  return apiFetch<AuthMeResponse>(apiBaseUrl, '/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function loginWithPassword(apiBaseUrl: string, email: string, password: string, tenantSlug = 'beta-demo') {
  return apiFetch<LoginResponse>(apiBaseUrl, '/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      tenantSlug
    })
  });
}

export async function loginWithBetaAccessCode(apiBaseUrl: string, email: string, accessCode: string, tenantSlug = 'beta-demo') {
  return apiFetch<LoginResponse>(apiBaseUrl, '/v1/auth/beta-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      accessCode,
      tenantSlug
    })
  });
}

export async function resetSystemData(apiBaseUrl: string, token: string, confirmationText: string) {
  return apiFetch<ResetSystemResponse>(apiBaseUrl, '/v1/platform/system/reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      confirmationText
    })
  });
}

export async function fetchPlatformDashboard(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformDashboardResponse>(apiBaseUrl, '/v1/platform/dashboard', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformOrganizations(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformOrganizationsResponse>(apiBaseUrl, '/v1/platform/organizations', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformPlans(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformPlansResponse>(apiBaseUrl, '/v1/platform/plans', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformFeatures(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformFeaturesResponse>(apiBaseUrl, '/v1/platform/features', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformPricingCatalog(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformPricingCatalogResponse>(apiBaseUrl, '/v1/platform/pricing/catalog', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformSubscriptions(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformSubscriptionsResponse>(apiBaseUrl, '/v1/platform/subscriptions', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformOrganizationDetail(apiBaseUrl: string, token: string, organizationId: string) {
  return apiFetch<PlatformOrganizationDetailResponse>(apiBaseUrl, `/v1/platform/organizations/${organizationId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformOrganizationOnboarding(apiBaseUrl: string, token: string, organizationId: string) {
  return apiFetch<PlatformOrganizationOnboardingResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/onboarding`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

export async function createPlatformOrganizationOnboarding(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: UpsertPlatformOrganizationOnboardingInput
) {
  return apiFetch<UpsertPlatformOrganizationOnboardingResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/onboarding`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function updatePlatformOrganizationOnboarding(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: PatchPlatformOrganizationOnboardingInput
) {
  return apiFetch<UpsertPlatformOrganizationOnboardingResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/onboarding`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function recommendPlatformOrganizationOnboarding(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: RecommendPlatformOrganizationOnboardingInput
) {
  return apiFetch<RecommendPlatformOrganizationOnboardingResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/onboarding/recommend`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function completePlatformOrganizationOnboarding(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: CompletePlatformOrganizationOnboardingInput
) {
  return apiFetch<CompletePlatformOrganizationOnboardingResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/onboarding/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchPlatformOrganizationSubscription(apiBaseUrl: string, token: string, organizationId: string) {
  return apiFetch<PlatformOrganizationSubscriptionResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/subscription`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

export async function createPlatformOrganizationSubscription(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: UpsertPlatformOrganizationSubscriptionInput
) {
  return apiFetch<UpsertPlatformOrganizationSubscriptionResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/subscription`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function updatePlatformOrganizationSubscription(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: PatchPlatformOrganizationSubscriptionInput
) {
  return apiFetch<UpsertPlatformOrganizationSubscriptionResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/subscription`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchPlatformOrganizationFeatures(apiBaseUrl: string, token: string, organizationId: string) {
  return apiFetch<PlatformOrganizationFeaturesResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/features`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

export async function updatePlatformOrganizationFeatures(
  apiBaseUrl: string,
  token: string,
  organizationId: string,
  payload: PatchPlatformOrganizationFeaturesInput
) {
  return apiFetch<PlatformOrganizationFeaturesResponse>(
    apiBaseUrl,
    `/v1/platform/organizations/${organizationId}/features`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }
  );
}

export async function createPlatformOrganization(apiBaseUrl: string, token: string, payload: CreatePlatformOrganizationInput) {
  return apiFetch<CreatePlatformOrganizationResponse>(apiBaseUrl, '/v1/platform/organizations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function createPlatformPlan(apiBaseUrl: string, token: string, payload: UpsertPlatformPlanInput) {
  return apiFetch<UpsertPlatformPlanResponse>(apiBaseUrl, '/v1/platform/plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function updatePlatformPlan(apiBaseUrl: string, token: string, planId: string, payload: PatchPlatformPlanInput) {
  return apiFetch<UpsertPlatformPlanResponse>(apiBaseUrl, `/v1/platform/plans/${planId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function updatePlatformFeature(apiBaseUrl: string, token: string, featureId: string, payload: PatchPlatformFeatureInput) {
  return apiFetch<PatchPlatformFeatureResponse>(apiBaseUrl, `/v1/platform/features/${featureId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function bootstrapPlatformPricingCatalog(apiBaseUrl: string, token: string) {
  return apiFetch<BootstrapPlatformPricingResponse>(apiBaseUrl, '/v1/platform/pricing/bootstrap', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformSupportSessions(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformSupportSessionsResponse>(apiBaseUrl, '/v1/platform/support/sessions', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function fetchPlatformUsers(apiBaseUrl: string, token: string) {
  return apiFetch<PlatformUsersResponse>(apiBaseUrl, '/v1/platform/users', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function startSupportSession(apiBaseUrl: string, token: string, payload: StartSupportSessionInput) {
  return apiFetch<StartSupportSessionResponse>(apiBaseUrl, '/v1/platform/support/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}

export async function endSupportSession(apiBaseUrl: string, token: string) {
  return apiFetch<EndSupportSessionResponse>(apiBaseUrl, '/v1/platform/support/end', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function getLandingPathForRole(role: AppRole) {
  if (role === 'platform_admin' || role === 'org_admin') {
    return '/admin';
  }

  if (role === 'billing') {
    return '/rcm';
  }

  if (role === 'consumer') {
    return '/consumer';
  }

  return '/clinical';
}

export function getDisplayRoleForShell(role: AppRole): AppRole {
  if (role === 'clinician' || role === 'case_manager') {
    return 'clinical_staff';
  }

  return role;
}

export function sessionHasPlatformAuthority(session: Pick<AuthMeResponse, 'accessContext'>) {
  return session.accessContext.platformRoles.length > 0;
}

export function sessionIsPlatformMode(session: AuthMeResponse) {
  return sessionHasPlatformAuthority(session) && !session.accessContext.supportMode && !session.accessContext.activeOrganizationId;
}

export function sessionIsSupportMode(session: Pick<AuthMeResponse, 'accessContext'>) {
  return session.accessContext.supportMode && Boolean(session.accessContext.activeOrganizationId);
}

export function sessionHasOrgContext(session: Pick<AuthMeResponse, 'accessContext'>) {
  return Boolean(session.accessContext.activeOrganizationId);
}

export function sessionCanManagePlatformBilling(session: Pick<AuthMeResponse, 'accessContext'>) {
  return session.accessContext.platformRoles.includes('platform_admin')
    && !session.accessContext.supportMode
    && !session.accessContext.activeOrganizationId;
}

export function getLandingPathForSession(session: AuthMeResponse) {
  if (sessionIsPlatformMode(session)) {
    return '/platform';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('org.users.read')) {
    return '/admin';
  }

  if (session.user.role === 'billing') {
    return '/rcm';
  }

  if (session.user.role === 'consumer') {
    return '/consumer';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('clinical.consumers.read')) {
    return '/clinical';
  }

  if (sessionHasOrgContext(session) && session.accessContext.permissions.includes('billing.work_items.read')) {
    return '/rcm';
  }

  if (session.user.role === 'platform_admin' || session.user.role === 'support') {
    return '/platform';
  }

  return '/clinical';
}

export function getShellRoleForSession(session: AuthMeResponse | null): AppRole {
  if (!session) {
    return 'org_admin';
  }

  if (sessionIsSupportMode(session)) {
    return 'org_admin';
  }

  return getDisplayRoleForShell(session.user.role);
}
