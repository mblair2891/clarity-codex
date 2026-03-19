import { aiBoundaries } from '@clarity/domain';

export interface AiRequest {
  tenantId: string;
  role: string;
  action: 'recovery_coach' | 'journaling_assist' | 'weekly_insight' | 'clinical_summary' | 'denial_analysis';
  prompt: string;
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
}
