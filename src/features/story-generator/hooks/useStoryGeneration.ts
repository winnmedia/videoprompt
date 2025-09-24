/**
 * Story Generation Hook
 * CLAUDE.md React Hook 패턴 준수
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../../../app/store';
import {
  generateStory,
  regenerateAct,
  storyGeneratorActions,
  selectCurrentStory,
  selectIsGenerating,
  selectGenerationProgress,
  selectGenerationError,
  selectGenerationHistory,
  selectStoryCompletionPercentage
} from '../store/storyGeneratorSlice';
import type {
  StoryGenerationRequest,
  StoryGenerationState
} from '../types';
import type { FourActStory, StoryGenerationParams } from '../../../entities/story';

export interface UseStoryGenerationReturn {
  // 상태
  currentStory: FourActStory | null;
  isGenerating: boolean;
  progress: StoryGenerationState['progress'];
  error: StoryGenerationState['error'];
  generationHistory: FourActStory[];
  completionPercentage: number;

  // 액션
  generateNewStory: (params: StoryGenerationParams, userId: string) => Promise<void>;
  regenerateStoryAct: (
    actType: keyof FourActStory['acts'],
    params: StoryGenerationParams,
    userId: string
  ) => Promise<void>;
  updateStoryAct: (
    actType: keyof FourActStory['acts'],
    updates: Partial<FourActStory['acts'][keyof FourActStory['acts']]>
  ) => void;
  updateActThumbnail: (
    actType: keyof FourActStory['acts'],
    thumbnailUrl: string
  ) => void;
  setCurrentStory: (story: FourActStory) => void;
  clearError: () => void;
  resetGeneration: () => void;

  // 유틸리티
  canGenerate: boolean;
  estimatedCost: number;
  isStoryComplete: boolean;
}

export function useStoryGeneration(): UseStoryGenerationReturn {
  const dispatch = useDispatch<AppDispatch>();

  // 상태 선택
  const currentStory = useSelector(selectCurrentStory);
  const isGenerating = useSelector(selectIsGenerating);
  const progress = useSelector(selectGenerationProgress);
  const error = useSelector(selectGenerationError);
  const generationHistory = useSelector(selectGenerationHistory);
  const completionPercentage = useSelector(selectStoryCompletionPercentage);

  // 새 스토리 생성
  const generateNewStory = useCallback(
    async (params: StoryGenerationParams, userId: string) => {
      try {
        const request: StoryGenerationRequest = {
          params,
          userId
        };

        await dispatch(generateStory(request)).unwrap();
      } catch (error) {
        console.error('스토리 생성 실패:', error);
        throw error;
      }
    },
    [dispatch]
  );

  // 특정 Act 재생성
  const regenerateStoryAct = useCallback(
    async (
      actType: keyof FourActStory['acts'],
      params: StoryGenerationParams,
      userId: string
    ) => {
      try {
        await dispatch(regenerateAct({ actType, params, userId })).unwrap();
      } catch (error) {
        console.error('Act 재생성 실패:', error);
        throw error;
      }
    },
    [dispatch]
  );

  // Act 업데이트
  const updateStoryAct = useCallback(
    (
      actType: keyof FourActStory['acts'],
      updates: Partial<FourActStory['acts'][keyof FourActStory['acts']]>
    ) => {
      dispatch(storyGeneratorActions.updateStoryAct({ actType, updates }));
    },
    [dispatch]
  );

  // 썸네일 업데이트
  const updateActThumbnail = useCallback(
    (actType: keyof FourActStory['acts'], thumbnailUrl: string) => {
      dispatch(storyGeneratorActions.updateActThumbnail({ actType, thumbnailUrl }));
    },
    [dispatch]
  );

  // 현재 스토리 설정
  const setCurrentStory = useCallback(
    (story: FourActStory) => {
      dispatch(storyGeneratorActions.setCurrentStory(story));
    },
    [dispatch]
  );

  // 에러 초기화
  const clearError = useCallback(() => {
    dispatch(storyGeneratorActions.clearError());
  }, [dispatch]);

  // 생성 상태 초기화
  const resetGeneration = useCallback(() => {
    dispatch(storyGeneratorActions.resetState());
  }, [dispatch]);

  // 생성 가능 여부 계산
  const canGenerate = !isGenerating && !error;

  // 예상 비용 계산 (토큰 기반)
  const estimatedCost = 0.002; // USD, 기본 추정값

  // 스토리 완성 여부
  const isStoryComplete = currentStory?.status === 'completed' && completionPercentage >= 90;

  // 자동 저장 (편집 시)
  useEffect(() => {
    if (currentStory && currentStory.status !== 'draft') {
      // TODO: 자동 저장 로직 (API 호출)
      console.log('자동 저장:', currentStory.id);
    }
  }, [currentStory]);

  // 에러 자동 복구 (재시도 가능한 경우)
  useEffect(() => {
    if (error?.retryable && !isGenerating) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000); // 5초 후 에러 자동 클리어

      return () => clearTimeout(timer);
    }
  }, [error, isGenerating, clearError]);

  return {
    // 상태
    currentStory,
    isGenerating,
    progress,
    error,
    generationHistory,
    completionPercentage,

    // 액션
    generateNewStory,
    regenerateStoryAct,
    updateStoryAct,
    updateActThumbnail,
    setCurrentStory,
    clearError,
    resetGeneration,

    // 유틸리티
    canGenerate,
    estimatedCost,
    isStoryComplete
  };
}