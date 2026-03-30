import { aiBoundaries } from '@clarity/domain';

export interface AiRequest {
  tenantId: string;
  role: string;
  action: 'recovery_coach' | 'journaling_assist' | 'weekly_insight' | 'clinical_summary' | 'denial_analysis';
  prompt: string;
}

export interface OnboardingRecommendationNarrativeRequest {
  tenantId: string;
  organizationName: string;
  recommendedPlanName: string;
  recommendedFeatureNames: string[];
  reasons: string[];
  importSummary: string;
  importComplexity: 'low' | 'medium' | 'high';
  flags: string[];
  adminNotes: string[];
}

export class AiService {
  generate(request: AiRequest) {
    const blocked = /diagnos|how to use more|best way to get high|unsafe detox/i.test(request.prompt);

    if (blocked) {
      return {
        blocked: true,
        rationale: 'Prompt violated Clarity Bridge Health safety boundaries.',
        boundaries: aiBoundaries.prohibited
      };
    }

    return {
      blocked: false,
      summary: `Safe ${request.action} support prepared for ${request.role} in tenant ${request.tenantId}.`,
      guidance: [
        'Use supportive, non-diagnostic language.',
        'Encourage connection with care team or support contacts when risk rises.',
        'Document AI-assisted output for human review when used clinically or financially.'
      ],
      boundaries: aiBoundaries.required
    };
  }

  generateOnboardingRecommendationNarrative(request: OnboardingRecommendationNarrativeRequest) {
    const featureSummary = request.recommendedFeatureNames.length
      ? request.recommendedFeatureNames.join(', ')
      : 'the core Clarity modules';
    const reasons = request.reasons.length
      ? request.reasons.join(' ')
      : `${request.recommendedPlanName} best matches the current operating profile.`;
    const explanation =
      `${request.organizationName} is best aligned to ${request.recommendedPlanName} based on the submitted staffing, scale, and workflow requirements. `
      + `${reasons} Recommended modules and add-ons center on ${featureSummary}.`;
    const migrationRiskSummary =
      request.importComplexity === 'high'
        ? `Migration risk is elevated. ${request.importSummary}`
        : request.importComplexity === 'medium'
          ? `Migration risk is moderate. ${request.importSummary}`
          : `Migration risk is low. ${request.importSummary}`;
    const reviewNotes = [
      'AI guidance is advisory and should not finalize pricing without human review.',
      ...request.flags,
      ...request.adminNotes
    ];

    return {
      blocked: false,
      summary: `${request.recommendedPlanName} is the current best-fit package for ${request.organizationName}.`,
      explanation,
      migrationRiskSummary,
      reviewNotes,
      boundaries: aiBoundaries.required
    };
  }
}
