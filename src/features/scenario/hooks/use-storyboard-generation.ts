/**
 * RTK Query 기반 스토리보드 생성 서버 상태 관리
 * FSD features 레이어 - 12샷 분해 및 스토리보드 생성 관리
 */

import React from 'react';
import { logger } from '@/shared/lib/logger';
import { useDispatch } from 'react-redux';
import { StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import {
  useGenerateShotsMutation,
  useGenerateStoryboardMutation,
  useSaveStoryboardMutation,
  useLoadStoryboardQuery,
  useGetSavedStoryboardsQuery,
  apiSlice
} from '@/shared/api/api-slice';
import {
  setShots,
  setStoryboardShots,
  setError as setStoryboardError,
  setLoading,
  startGeneration,
  updateGenerationProgress,
  completeGeneration
} from '@/entities/scenario';
import { useToast } from '@/shared/lib/hooks/useToast';

// 입력값 해시 생성 (중복 생성 방지)
function generateInputHash(steps: StoryStep[]): string {
  const input = steps.map(step => `${step.title}:${step.summary}`).join('|');
  return btoa(input).slice(0, 16); // Base64 인코딩 후 16자리로 단축
}

// 진행률 시뮬레이션 유틸리티
function simulateProgress(
  onProgress: (progress: number, currentShotIndex: number) => void,
  totalShots: number
) {
  for (let i = 0; i <= totalShots; i++) {
    setTimeout(() => {
      const progress = (i / totalShots) * 100;
      onProgress(progress, i);
    }, i * 2000); // 2초마다 진행률 업데이트
  }
}

/**
 * 12샷 분해 뮤테이션 훅
 */
export function useShotGeneration() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [generateShots, { isLoading, error }] = useGenerateShotsMutation();

  const generateShotsWithRedux = async (steps: StoryStep[]) => {
    try {
      dispatch(setLoading(true));
      toast.info('4단계 스토리를 12개 샷으로 분해하고 있습니다...', '샷 분해 중', { duration: 0 });

      const result = await generateShots({
        structure4: steps.map(step => ({
          title: step.title,
          summary: step.summary
        })),
        genre: 'Drama', // TODO: 실제 장르 전달
        tone: 'Neutral' // TODO: 실제 톤 전달
      }).unwrap();

      dispatch(setShots(result.shots));
      toast.success(`${result.shots.length}개의 샷으로 분해되었습니다!`, '샷 분해 완료');

      return result;
    } catch (error: any) {
      dispatch(setStoryboardError(error.message));
      toast.error(error.message || '다시 시도해주세요', '샷 분해 실패');
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

  return {
    mutateAsync: generateShotsWithRedux,
    mutate: generateShotsWithRedux,
    isLoading,
    error,
    isPending: isLoading
  };
}

/**
 * 스토리보드 이미지 생성 뮤테이션 훅
 */
export function useStoryboardGeneration() {
  const dispatch = useDispatch();
  const [generateStoryboard, { isLoading, error }] = useGenerateStoryboardMutation();

  const generateStoryboardWithProgress = async (shots: Shot[]) => {
    try {
      const inputHash = generateInputHash(shots.map(shot => ({
        id: shot.id,
        title: shot.title,
        summary: shot.description,
        content: shot.description,
        goal: '',
        lengthHint: '',
        isEditing: false
      })));

      dispatch(startGeneration({ hash: inputHash, estimatedTime: shots.length * 15 })); // 샷당 15초 추정

      dispatch(addToast({
        type: 'info',
        title: '스토리보드 생성 중',
        message: `${shots.length}개 샷의 이미지를 생성하고 있습니다...`,
        duration: 0
      }));

      // 진행률 시뮬레이션 시작
      simulateProgress((progress, currentShotIndex) => {
        dispatch(updateGenerationProgress({ progress, currentShotIndex }));
      }, shots.length);

      const result = await generateStoryboard({
        shots: shots.map(shot => ({
          id: shot.id,
          title: shot.title,
          description: shot.description,
          shotType: shot.shotType,
          camera: shot.camera
        }))
      }).unwrap();

      dispatch(setStoryboardShots(result.storyboardShots));
      dispatch(completeGeneration());

      dispatch(addToast({
        type: 'success',
        title: '스토리보드 생성 완료',
        message: `${result.storyboardShots.length}개의 스토리보드가 생성되었습니다!`
      }));

      return result;
    } catch (error: any) {
      dispatch(setStoryboardError(error.message));
      dispatch(addToast({
        type: 'error',
        title: '스토리보드 생성 실패',
        message: error.message || '일부 이미지 생성에 실패했을 수 있습니다'
      }));
      throw error;
    }
  };

  return {
    mutateAsync: generateStoryboardWithProgress,
    mutate: generateStoryboardWithProgress,
    isLoading,
    error,
    isPending: isLoading
  };
}

/**
 * 스토리보드 저장 뮤테이션 훅
 */
export function useStoryboardSave() {
  const dispatch = useDispatch();
  const [saveStoryboard, { isLoading, error }] = useSaveStoryboardMutation();

  const saveStoryboardWithToast = async (data: {
    shots: Shot[];
    storyboardShots: StoryboardShot[];
    projectId?: string;
  }) => {
    try {
      const result = await saveStoryboard(data).unwrap();

      dispatch(addToast({
        type: 'success',
        title: '스토리보드 저장 완료',
        message: '스토리보드가 성공적으로 저장되었습니다'
      }));

      return result;
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: '저장 실패',
        message: error.message || '스토리보드 저장에 실패했습니다'
      }));
      throw error;
    }
  };

  return {
    mutateAsync: saveStoryboardWithToast,
    mutate: saveStoryboardWithToast,
    isLoading,
    error,
    isPending: isLoading
  };
}

/**
 * 스토리보드 불러오기 쿼리 훅
 */
export function useStoryboardLoad(projectId?: string) {
  return useLoadStoryboardQuery(projectId!, {
    skip: !projectId,
  });
}

/**
 * 저장된 스토리보드 목록 쿼리 훅
 */
export function useSavedStoryboards() {
  return useGetSavedStoryboardsQuery();
}

/**
 * 스토리보드 자동 저장 훅
 */
export function useAutoSaveStoryboard(
  shots: Shot[],
  storyboardShots: StoryboardShot[],
  projectId: string | null,
  isDirty: boolean,
  enabled: boolean = true
) {
  const saveMutation = useStoryboardSave();

  React.useEffect(() => {
    if (!enabled || !isDirty || !projectId || shots.length === 0) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await saveMutation.mutateAsync({
          shots,
          storyboardShots,
          projectId
        });
      } catch (error) {
        logger.error('Auto-save failed:', error instanceof Error ? error : new Error(String(error)));
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [enabled, isDirty, projectId, shots, storyboardShots, saveMutation]);

  return {
    isAutoSaving: saveMutation.isPending,
    autoSaveError: saveMutation.error,
  };
}

/**
 * RTK Query 캐시 무효화 유틸리티
 */
export function useInvalidateStoryboardCache() {
  const dispatch = useDispatch();

  return {
    invalidateAll: () => {
      dispatch(apiSlice.util.invalidateTags(['Storyboard']));
    },
    invalidateProject: (projectId: string) => {
      dispatch(apiSlice.util.invalidateTags([{ type: 'Storyboard', id: projectId }]));
    },
    resetCache: () => {
      dispatch(apiSlice.util.resetApiState());
    },
  };
}

/**
 * 통합 스토리보드 워크플로우 훅
 * 4단계 스토리 → 12샷 분해 → 스토리보드 생성 → 저장의 전체 워크플로우 관리
 */
export function useStoryboardWorkflow() {
  const shotGeneration = useShotGeneration();
  const storyboardGeneration = useStoryboardGeneration();
  const storyboardSave = useStoryboardSave();

  const executeFullWorkflow = async (
    steps: StoryStep[],
    projectId?: string
  ) => {
    try {
      // 1. 12샷 분해
      const shotsResult = await shotGeneration.mutateAsync(steps);

      // 2. 스토리보드 생성
      const storyboardResult = await storyboardGeneration.mutateAsync(shotsResult.shots);

      // 3. 자동 저장 (프로젝트 ID가 있는 경우)
      if (projectId) {
        await storyboardSave.mutateAsync({
          shots: shotsResult.shots,
          storyboardShots: storyboardResult.storyboardShots,
          projectId
        });
      }

      return {
        shots: shotsResult.shots,
        storyboardShots: storyboardResult.storyboardShots
      };
    } catch (error) {
      throw error;
    }
  };

  return {
    executeFullWorkflow,
    isLoading: shotGeneration.isLoading || storyboardGeneration.isLoading || storyboardSave.isLoading,
    error: shotGeneration.error || storyboardGeneration.error || storyboardSave.error
  };
}