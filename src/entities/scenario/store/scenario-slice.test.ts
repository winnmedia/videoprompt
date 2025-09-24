/**
 * Scenario Slice Tests
 * TDD 원칙에 따른 시나리오 상태 관리 테스트
 */

import {
  scenarioSlice,
  ScenarioState,
  generateScenario,
  setCurrentScenario,
  clearCurrentScenario,
} from './scenario-slice';
import { Scenario } from '../model/Scenario';

describe('scenarioSlice', () => {
  const initialState: ScenarioState = {
    scenarios: [],
    currentScenario: null,
    isLoading: false,
    isGenerating: false,
    error: null,
  };

  const mockScenario: Scenario = {
    id: 'scenario-1',
    title: '제주도 여행 브이로그',
    description: 'AI가 생성한 제주도 여행 시나리오',
    scenes: [],
    totalDuration: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    status: 'draft',
    genre: '여행',
    targetAudience: '20-30대',
  };

  it('should return the initial state', () => {
    expect(scenarioSlice.reducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    );
  });

  it('should handle setCurrentScenario', () => {
    const actual = scenarioSlice.reducer(
      initialState,
      setCurrentScenario(mockScenario)
    );

    expect(actual.currentScenario).toEqual(mockScenario);
    expect(actual.error).toBe(null);
  });

  it('should handle clearCurrentScenario', () => {
    const stateWithScenario: ScenarioState = {
      ...initialState,
      currentScenario: mockScenario,
    };

    const actual = scenarioSlice.reducer(
      stateWithScenario,
      clearCurrentScenario()
    );

    expect(actual.currentScenario).toBe(null);
  });

  it('should handle generateScenario.pending', () => {
    const actual = scenarioSlice.reducer(
      initialState,
      generateScenario.pending('', {
        idea: '제주도 여행',
        genre: '여행',
        targetAudience: '20-30대',
        duration: 180,
      })
    );

    expect(actual.isGenerating).toBe(true);
    expect(actual.error).toBe(null);
  });

  it('should handle generateScenario.fulfilled', () => {
    const generatedResponse = {
      scenario: mockScenario,
    };

    const actual = scenarioSlice.reducer(
      { ...initialState, isGenerating: true },
      generateScenario.fulfilled(generatedResponse, '', {
        idea: '제주도 여행',
        genre: '여행',
        targetAudience: '20-30대',
        duration: 180,
      })
    );

    expect(actual.currentScenario).toEqual(mockScenario);
    expect(actual.scenarios).toContain(mockScenario);
    expect(actual.isGenerating).toBe(false);
    expect(actual.error).toBe(null);
  });

  it('should handle generateScenario.rejected', () => {
    const error = '시나리오 생성 실패';

    const actual = scenarioSlice.reducer(
      { ...initialState, isGenerating: true },
      generateScenario.rejected(new Error(error), '', {
        idea: '제주도 여행',
        genre: '여행',
        targetAudience: '20-30대',
        duration: 180,
      })
    );

    expect(actual.currentScenario).toBe(null);
    expect(actual.isGenerating).toBe(false);
    expect(actual.error).toBe(error);
  });
});
