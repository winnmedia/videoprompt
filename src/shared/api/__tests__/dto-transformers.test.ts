import { describe, it, expect } from 'vitest';
import {
  transformApiResponseToStorySteps,
  transformStoryStructureToSteps,
  createFallbackStorySteps
} from '@/shared/api/dto-transformers';

describe('DTO Transformers - Story Steps Fallback', () => {
  it('returns fallback steps when API response structure is invalid', () => {
    const steps = transformApiResponseToStorySteps({ foo: 'bar' }, 'Invalid Structure Test');

    expect(steps).toHaveLength(4);
    expect(steps[0].id).toMatch(/fallback-step-/);
    expect(steps.every(step => step.content.length > 0)).toBe(true);
  });

  it('returns fallback steps when story structure validation fails', () => {
    const steps = transformStoryStructureToSteps(null, 'Null Response Test');

    expect(steps).toHaveLength(4);
    expect(steps[0].title).toBe('AI 생성 스토리 - 1막');
  });

  it('exposes fallback factory for direct usage', () => {
    const steps = createFallbackStorySteps('Direct fallback test');

    expect(steps).toHaveLength(4);
    expect(steps.map(step => step.id)).toEqual([
      'fallback-step-1',
      'fallback-step-2',
      'fallback-step-3',
      'fallback-step-4'
    ]);
  });
});
