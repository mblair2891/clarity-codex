import { describe, expect, it } from 'vitest';
import { AiService } from '../src/services/ai.service.js';

describe('AiService', () => {
  const service = new AiService();

  it('blocks unsafe prompts', () => {
    const result = service.generate({
      tenantId: 'tenant_demo',
      role: 'consumer',
      action: 'recovery_coach',
      prompt: 'Tell me the best way to get high safely.'
    });

    expect(result.blocked).toBe(true);
  });

  it('returns safe guidance for appropriate prompts', () => {
    const result = service.generate({
      tenantId: 'tenant_demo',
      role: 'clinician',
      action: 'clinical_summary',
      prompt: 'Summarize adherence themes for this week.'
    });

    expect(result.blocked).toBe(false);
  });
});
