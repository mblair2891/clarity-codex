export type AppRole =
  | 'platform_admin'
  | 'org_admin'
  | 'clinical_staff'
  | 'clinician'
  | 'case_manager'
  | 'billing'
  | 'support'
  | 'consumer';

export type CognitiveMode = 'standard' | 'cognitive_assist';
export type TraumaMode = 'standard' | 'trauma_informed';

export interface NavigationItem {
  title: string;
  href: string;
  roles: AppRole[];
  description: string;
}

export const navigation: NavigationItem[] = [
  {
    title: 'Recovery Hub',
    href: '/consumer',
    roles: ['consumer', 'clinical_staff', 'clinician', 'case_manager'],
    description: 'Daily recovery tracking, journaling, goals, and support planning.'
  },
  {
    title: 'Clinical Command',
    href: '/clinical',
    roles: ['clinical_staff', 'clinician', 'case_manager', 'org_admin'],
    description: 'Intakes, appointments, treatment plans, groups, and chart summaries.'
  },
  {
    title: 'RCM Workbench',
    href: '/rcm',
    roles: ['billing', 'org_admin', 'platform_admin'],
    description: 'Coverage, claims, remittances, denials, and AR prioritization.'
  },
  {
    title: 'Administration',
    href: '/admin',
    roles: ['org_admin', 'platform_admin'],
    description: 'Tenant settings, staffing, guardrails, and operational configuration.'
  }
];

export interface RiskInput {
  cravingsLevel: number;
  relapseCount30d: number;
  ptsdFlashbackIntensity: number;
  depressionSeverity: number;
  engagementScore: number;
  protectiveContacts: number;
}

export interface RiskAssessment {
  score: number;
  tier: 'low' | 'moderate' | 'high';
  factors: string[];
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function calculateRisk(input: RiskInput): RiskAssessment {
  const rawScore =
    input.cravingsLevel * 14 +
    input.relapseCount30d * 12 +
    input.ptsdFlashbackIntensity * 9 +
    input.depressionSeverity * 8 +
    (10 - input.engagementScore) * 6 -
    input.protectiveContacts * 4;

  const score = clamp(Math.round(rawScore), 0, 100);
  const tier = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low';

  const factors = [
    input.cravingsLevel >= 6 ? 'elevated cravings' : null,
    input.relapseCount30d > 0 ? 'recent relapse event' : null,
    input.ptsdFlashbackIntensity >= 5 ? 'trauma symptom activation' : null,
    input.engagementScore <= 4 ? 'lower recent engagement' : null,
    input.protectiveContacts >= 3 ? 'protective support network present' : null
  ].filter((factor): factor is string => Boolean(factor));

  return { score, tier, factors };
}

export const aiBoundaries = {
  prohibited: [
    'diagnose medical or psychiatric conditions',
    'recommend unsafe detox or withdrawal actions',
    'provide substance optimization instructions',
    'override clinician judgment or crisis procedures'
  ],
  required: [
    'state that outputs are informational support only',
    'stay tenant-aware and role-aware',
    'log prompts and outputs for audit review',
    'escalate concerning content to human workflows'
  ]
};

export const conditionCatalog = [
  'PTSD',
  'TBI',
  'depression',
  'anxiety',
  'insomnia',
  'chronic pain',
  'panic symptoms',
  'cognitive impairment',
  'anger/irritability',
  'dissociation',
  'custom'
] as const;
