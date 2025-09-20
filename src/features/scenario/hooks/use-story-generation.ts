/**
 * RTK Query 기반 스토리 생성 서버 상태 관리
 * FSD features 레이어 - 비즈니스 로직 및 서버 상태 관리
 *
 * v2.0 업데이트:
 * - 파이프라인 매니저 통합
 * - ProjectID 기반 상태 관리
 * - 자동 단계 진행
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { StoryInput, StoryStep, setStorySteps, setStoryError, setLoading } from '@/entities/scenario';
import { useGenerateStoryMutation, useSaveStoryMutation, useLoadStoryQuery, useGetSavedStoriesQuery, apiSlice } from '@/shared/api/api-slice';
import { useToast } from '@/shared/lib/hooks/useToast';
import { pipelineManager } from '@/shared/lib/pipeline-manager';
import { selectProjectId } from '@/entities/pipeline/store/pipeline-slice';
import type { RootState } from '@/shared/types/store';
import { logger } from '@/shared/lib/logger';


/**
 * RTK Query 기반 스토리 생성 Hook
 * React Query와 동일한 인터페이스 제공하되 RTK Query 사용
 */

/**
 * 스토리 생성 뮤테이션 훅
 * RTK Query + 파이프라인 매니저 통합
 */
export function useStoryGeneration() {
  const dispatch = useDispatch();
  const toast = useToast();
  const currentProjectId = useSelector((state: RootState) => selectProjectId(state));
  const [generateStory, { isLoading, error }] = useGenerateStoryMutation();

  // 파이프라인 매니저 초기화
  React.useEffect(() => {
    pipelineManager.setDispatch(dispatch);
  }, [dispatch]);

  const generateStoryWithPipeline = async (storyInput: StoryInput, projectId?: string) => {
    try {
      // ProjectID 확보 (기존 것이 있으면 사용, 없으면 새로 생성)
      const activeProjectId = projectId || currentProjectId || pipelineManager.startNewProject();

      logger.info('🚀 스토리 생성 시작:', {
        projectId: activeProjectId,
        title: storyInput.title
      });

      // 로딩 상태 설정
      dispatch(setLoading(true));
      toast.info('AI가 4단계 스토리를 생성하고 있습니다...', '스토리 생성 중', { duration: 0 });

      // ProjectID가 포함된 요청 데이터 생성
      const requestData = pipelineManager.injectProjectId(storyInput, activeProjectId);
      const result = await generateStory(requestData).unwrap();

      // Redux 상태 업데이트 (기존 로직 유지)
      dispatch(setStorySteps(result.steps));

      // 파이프라인 상태 업데이트
      const storyId = crypto.randomUUID();
      pipelineManager.completeStoryStep(activeProjectId, storyId, storyInput, result.steps);

      // 성공 토스트
      toast.success(`${result.steps.length}단계 스토리가 성공적으로 생성되었습니다!`, '스토리 생성 완료');

      return {
        ...result,
        projectId: activeProjectId,
        storyId
      };
    } catch (error: any) {
      // Redux 에러 상태 설정
      dispatch(setStoryError(error.message || '스토리 생성에 실패했습니다'));

      // 에러 토스트
      toast.error(error.message || '다시 시도해주세요', '스토리 생성 실패');

      throw error;
    } finally {
      // 로딩 상태 해제
      dispatch(setLoading(false));
    }
  };

  return {
    mutateAsync: generateStoryWithPipeline,
    mutate: generateStoryWithPipeline,
    isLoading,
    error,
    isPending: isLoading,
    currentProjectId
  };
}

/**
 * 스토리 저장 뮤테이션 훅
 * 파이프라인 통합 버전
 */
export function useStorySave() {
  const dispatch = useDispatch();
  const toast = useToast();
  const currentProjectId = useSelector((state: RootState) => selectProjectId(state));
  const [saveStory, { isLoading, error }] = useSaveStoryMutation();

  // 파이프라인 매니저 초기화
  React.useEffect(() => {
    pipelineManager.setDispatch(dispatch);
  }, [dispatch]);

  const saveStoryWithPipeline = async (data: {
    storyInput: StoryInput;
    steps: StoryStep[];
    projectId?: string;
  }) => {
    try {
      // ProjectID 확보
      const activeProjectId = data.projectId || currentProjectId;
      if (!activeProjectId) {
        throw new Error('ProjectID가 필요합니다. 먼저 스토리를 생성해주세요.');
      }

      logger.info('💾 스토리 저장 시작:', {
        projectId: activeProjectId,
        stepCount: data.steps.length
      });

      // ProjectID가 포함된 저장 데이터
      const saveData = {
        ...data,
        projectId: activeProjectId
      };

      const result = await saveStory(saveData).unwrap();

      toast.success('프로젝트가 성공적으로 저장되었습니다', '스토리 저장 완료');

      return {
        ...result,
        projectId: activeProjectId
      };
    } catch (error: any) {
      toast.error(error.message || '스토리 저장에 실패했습니다', '저장 실패');
      throw error;
    }
  };

  return {
    mutateAsync: saveStoryWithPipeline,
    mutate: saveStoryWithPipeline,
    isLoading,
    error,
    isPending: isLoading,
    currentProjectId
  };
}

/**
 * 스토리 불러오기 쿼리 훅
 */
export function useStoryLoad(projectId?: string) {
  return useLoadStoryQuery(projectId!, {
    skip: !projectId,
  });
}

/**
 * 저장된 스토리 목록 쿼리 훅
 */
export function useSavedStories() {
  return useGetSavedStoriesQuery();
}

/**
 * 스토리 자동 저장 훅
 * - RTK Query 기반으로 30초마다 자동 저장
 * - 변경 사항이 있을 때만 저장
 */
export function useAutoSaveStory(
  storyInput: StoryInput | null,
  steps: StoryStep[],
  isDirty: boolean,
  enabled: boolean = true
) {
  const saveMutation = useStorySave();

  // 30초마다 자동 저장 - useEffect 기반으로 구현
  React.useEffect(() => {
    if (!enabled || !isDirty || !storyInput || steps.length === 0) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await saveMutation.mutateAsync({
          storyInput,
          steps
        });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [enabled, isDirty, storyInput, steps, saveMutation]);

  return {
    isAutoSaving: saveMutation.isPending,
    autoSaveError: saveMutation.error,
  };
}

/**
 * RTK Query 캐시 무효화 유틸리티
 */
export function useInvalidateStoryCache() {
  const dispatch = useDispatch();

  return {
    invalidateAll: () => {
      dispatch(apiSlice.util.invalidateTags(['Story', 'SavedStories']));
    },
    invalidateGeneration: () => {
      dispatch(apiSlice.util.invalidateTags(['Story']));
    },
    invalidateSaved: () => {
      dispatch(apiSlice.util.invalidateTags(['SavedStories']));
    },
    resetCache: () => {
      dispatch(apiSlice.util.resetApiState());
    },
  };
}