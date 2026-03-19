import { describe, expect, it } from 'vitest';
import { calculateRisk } from './index';

describe('calculateRisk', () => {
  it('returns high risk when risk factors are elevated', () => {
    const result = calculateRisk({
      cravingsLevel: 8,
      relapseCount30d: 2,
      ptsdFlashbackIntensity: 7,
      depressionSeverity: 8,
      engagementScore: 2,
      protectiveContacts: 0
    });

    expect(result.tier).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('returns low risk when engagement and support are strong', () => {
    const result = calculateRisk({
      cravingsLevel: 1,
      relapseCount30d: 0,
      ptsdFlashbackIntensity: 1,
      depressionSeverity: 2,
      engagementScore: 9,
      protectiveContacts: 4
    });

    expect(result.tier).toBe('low');
    expect(result.score).toBeLessThan(40);
  });
});
