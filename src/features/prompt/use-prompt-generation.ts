/**
 * 프롬프트 생성 React Hook
 * UserJourneyMap 12-14단계 UI 상태 관리
 */

import { useState, useCallback, useRef } from 'react';
import type {
  PromptEngineering,
  AIVideoModel,
  PromptOptimizationLevel,
} from '../../entities/prompt';
import type { TwelveShotCollection } from '../../entities/Shot';
import {
  promptGenerationEngine,
  type PromptGenerationOptions,
  type ValidationResult,
  type CostEstimation,
} from './prompt-generator';

export interface UsePromptGenerationState {
  // 상태
  isGenerating: boolean;
  isValidating: boolean;
  isEstimatingCost: boolean;

  // 데이터
  prompts: PromptEngineering[];
  validationResults: Record<string, ValidationResult>;
  costEstimation: CostEstimation | null;

  // 에러
  error: string | null;

  // 진행률
  progress: {
    current: number;
    total: number;
    percentage: number;
    currentShot?: string;
  };
}

export interface UsePromptGenerationActions {
  // 프롬프트 생성
  generateForSelectedShots: (
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[],
    targetModels: AIVideoModel[],
    options?: Partial<PromptGenerationOptions>
  ) => Promise<void>;

  generateBatchPrompts: (
    shotCollection: TwelveShotCollection,
    targetModels: AIVideoModel[],
    options?: Partial<PromptGenerationOptions>
  ) => Promise<void>;

  // 프롬프트 최적화
  optimizePrompt: (
    promptId: string,
    model: AIVideoModel,
    targetLevel: PromptOptimizationLevel
  ) => Promise<void>;

  // 프롬프트 커스터마이징
  customizePrompt: (
    promptId: string,
    model: AIVideoModel,
    field: string,
    newValue: string,
    reason?: string
  ) => Promise<void>;

  // 검증 및 비용 예측
  validatePrompts: (promptIds?: string[]) => Promise<void>;
  estimateCosts: (promptIds?: string[]) => Promise<void>;

  // 유틸리티
  clearError: () => void;
  reset: () => void;
  getPromptById: (promptId: string) => PromptEngineering | undefined;
}

export type UsePromptGenerationReturn = UsePromptGenerationState & UsePromptGenerationActions;

/**
 * 프롬프트 생성 Hook
 */
export function usePromptGeneration(): UsePromptGenerationReturn {
  const [state, setState] = useState<UsePromptGenerationState>({
    isGenerating: false,
    isValidating: false,
    isEstimatingCost: false,
    prompts: [],
    validationResults: {},
    costEstimation: null,
    error: null,
    progress: {
      current: 0,
      total: 0,
      percentage: 0,
    },
  });

  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 선택된 숏트들의 프롬프트 생성
   */
  const generateForSelectedShots = useCallback(async (
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[],
    targetModels: AIVideoModel[],
    options: Partial<PromptGenerationOptions> = {}
  ) => {
    // 이전 작업 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      progress: {
        current: 0,
        total: selectedShotIds.length,
        percentage: 0,
      },
    }));

    try {
      const defaultOptions: PromptGenerationOptions = {
        optimizationLevel: 'standard',
        enableAIEnhancement: true,
        prioritizeConsistency: true,
        maxCostPerPrompt: 1.0,
      };

      const finalOptions = { ...defaultOptions, ...options };

      // 진행률 업데이트를 위한 프록시 생성
      const prompts: PromptEngineering[] = [];

      for (let i = 0; i < selectedShotIds.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('작업이 취소되었습니다');
        }

        setState(prev => ({
          ...prev,
          progress: {
            current: i,
            total: selectedShotIds.length,
            percentage: Math.round((i / selectedShotIds.length) * 100),
            currentShot: `Shot ${i + 1}`,
          },
        }));

        // 개별 숏트 처리
        const shotId = selectedShotIds[i];
        const singleShotPrompts = await promptGenerationEngine.generateForSelectedShots(
          shotCollection,
          [shotId],
          targetModels,
          finalOptions
        );

        prompts.push(...singleShotPrompts);

        // 중간 결과 업데이트
        setState(prev => ({
          ...prev,
          prompts: [...prompts],
        }));
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        prompts,
        progress: {
          current: selectedShotIds.length,
          total: selectedShotIds.length,
          percentage: 100,
        },
      }));

      // 자동 검증 및 비용 예측
      await validatePrompts(prompts.map(p => p.id));
      await estimateCosts(prompts.map(p => p.id));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : '프롬프트 생성 중 오류가 발생했습니다',
      }));
    }
  }, []);

  /**
   * 전체 12숏트 배치 프롬프트 생성
   */
  const generateBatchPrompts = useCallback(async (
    shotCollection: TwelveShotCollection,
    targetModels: AIVideoModel[],
    options: Partial<PromptGenerationOptions> = {}
  ) => {
    const allShotIds = shotCollection.shots.map(shot => shot.id);
    await generateForSelectedShots(shotCollection, allShotIds, targetModels, options);
  }, [generateForSelectedShots]);

  /**
   * 프롬프트 최적화
   */
  const optimizePrompt = useCallback(async (
    promptId: string,
    model: AIVideoModel,
    targetLevel: PromptOptimizationLevel
  ) => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));

    try {
      const prompt = state.prompts.find(p => p.id === promptId);
      if (!prompt) {
        throw new Error('프롬프트를 찾을 수 없습니다');
      }

      const optimizedPrompt = await promptGenerationEngine.optimizePrompt(
        prompt,
        model,
        targetLevel
      );

      setState(prev => ({
        ...prev,
        isGenerating: false,
        prompts: prev.prompts.map(p =>
          p.id === promptId ? optimizedPrompt : p
        ),
      }));

      // 최적화된 프롬프트 검증
      await validatePrompts([promptId]);

    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : '프롬프트 최적화 중 오류가 발생했습니다',
      }));
    }
  }, [state.prompts]);

  /**
   * 프롬프트 커스터마이징
   */
  const customizePrompt = useCallback(async (
    promptId: string,
    model: AIVideoModel,
    field: string,
    newValue: string,
    reason: string = '사용자 편집'
  ) => {
    try {
      const prompt = state.prompts.find(p => p.id === promptId);
      if (!prompt) {
        throw new Error('프롬프트를 찾을 수 없습니다');
      }

      // 프롬프트 엔티티의 customizePrompt 함수 사용
      const { customizePrompt: customizePromptEntity } = await import('../../entities/prompt');
      const customizedPrompt = customizePromptEntity(prompt, model, field, newValue, reason);

      setState(prev => ({
        ...prev,
        prompts: prev.prompts.map(p =>
          p.id === promptId ? customizedPrompt : p
        ),
      }));

      // 커스터마이징된 프롬프트 검증
      await validatePrompts([promptId]);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '프롬프트 커스터마이징 중 오류가 발생했습니다',
      }));
    }
  }, [state.prompts]);

  /**
   * 프롬프트 검증
   */
  const validatePrompts = useCallback(async (promptIds?: string[]) => {
    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const targetPrompts = promptIds
        ? state.prompts.filter(p => promptIds.includes(p.id))
        : state.prompts;

      const validationResults: Record<string, ValidationResult> = {};

      for (const prompt of targetPrompts) {
        const result = await promptGenerationEngine.validateAndSuggest(prompt);
        validationResults[prompt.id] = result;
      }

      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResults: {
          ...prev.validationResults,
          ...validationResults,
        },
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : '프롬프트 검증 중 오류가 발생했습니다',
      }));
    }
  }, [state.prompts]);

  /**
   * 비용 예측
   */
  const estimateCosts = useCallback(async (promptIds?: string[]) => {
    setState(prev => ({ ...prev, isEstimatingCost: true, error: null }));

    try {
      const targetPrompts = promptIds
        ? state.prompts.filter(p => promptIds.includes(p.id))
        : state.prompts;

      const costEstimation = await promptGenerationEngine.estimateCosts(targetPrompts);

      setState(prev => ({
        ...prev,
        isEstimatingCost: false,
        costEstimation,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isEstimatingCost: false,
        error: error instanceof Error ? error.message : '비용 예측 중 오류가 발생했습니다',
      }));
    }
  }, [state.prompts]);

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      isGenerating: false,
      isValidating: false,
      isEstimatingCost: false,
      prompts: [],
      validationResults: {},
      costEstimation: null,
      error: null,
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
      },
    });
  }, []);

  /**
   * ID로 프롬프트 찾기
   */
  const getPromptById = useCallback((promptId: string) => {
    return state.prompts.find(p => p.id === promptId);
  }, [state.prompts]);

  return {
    ...state,
    generateForSelectedShots,
    generateBatchPrompts,
    optimizePrompt,
    customizePrompt,
    validatePrompts,
    estimateCosts,
    clearError,
    reset,
    getPromptById,
  };
}