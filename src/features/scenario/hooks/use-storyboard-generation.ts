/**
 * React Query 기반 스토리보드 생성 서버 상태 관리
 * FSD features 레이어 - 12샷 분해 및 스토리보드 생성 관리
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { apiClient } from '@/shared/lib/api-client';
import {
  setShots,
  setStoryboardShots,
  setError as setStoryboardError,
  setLoading,
  startGeneration,
  updateGenerationProgress,
  completeGeneration
} from '@/entities/scenario';
import { addToast } from '@/shared/store/ui-slice';

// Query Keys
export const storyboardQueryKeys = {
  all: ['storyboard'] as const,
  shots: () => [...storyboardQueryKeys.all, 'shots'] as const,
  shotsBySteps: (steps: StoryStep[]) => [...storyboardQueryKeys.shots(), steps] as const,
  storyboardImages: () => [...storyboardQueryKeys.all, 'images'] as const,
  storyboardByShots: (shots: Shot[]) => [...storyboardQueryKeys.storyboardImages(), shots] as const,
  savedStoryboards: () => [...storyboardQueryKeys.all, 'saved'] as const,
  savedStoryboardById: (id: string) => [...storyboardQueryKeys.savedStoryboards(), id] as const,
};

// 입력값 해시 생성 (중복 생성 방지)
function generateInputHash(steps: StoryStep[]): string {
  const input = steps.map(step => `${step.title}:${step.summary}`).join('|');
  return btoa(input).slice(0, 16); // Base64 인코딩 후 16자리로 단축
}

// 12샷 분해 API 호출
async function generateShots(steps: StoryStep[]): Promise<Shot[]> {
  const response = await apiClient.post<{
    success: boolean;
    data: { shots: Shot[] };
    message: string;
  }>('/api/ai/generate-shots', {
    structure4: steps.map(step => ({
      title: step.title,
      summary: step.summary
    })),
    genre: 'Drama', // TODO: 실제 장르 전달
    tone: 'Neutral' // TODO: 실제 톤 전달
  });

  if (!response.success || !response.data?.shots) {
    throw new Error(response.message || '샷 생성에 실패했습니다');
  }

  return response.data.shots;
}

// 스토리보드 이미지 생성 API 호출
async function generateStoryboard(
  shots: Shot[],
  onProgress?: (progress: number, currentShotIndex: number) => void
): Promise<StoryboardShot[]> {
  const response = await apiClient.post<{
    success: boolean;
    data: { storyboardShots: StoryboardShot[] };
    message: string;
  }>('/api/ai/generate-storyboard', {
    shots: shots.map(shot => ({
      id: shot.id,
      title: shot.title,
      description: shot.description,
      shotType: shot.shotType,
      camera: shot.camera
    }))
  });

  // 진행률 시뮬레이션 (실제 구현에서는 WebSocket 또는 Server-Sent Events 사용)
  if (onProgress) {
    const totalShots = shots.length;
    for (let i = 0; i <= totalShots; i++) {
      setTimeout(() => {
        const progress = (i / totalShots) * 100;
        onProgress(progress, i);
      }, i * 2000); // 2초마다 진행률 업데이트
    }
  }

  if (!response.success || !response.data?.storyboardShots) {
    throw new Error(response.message || '스토리보드 생성에 실패했습니다');
  }

  return response.data.storyboardShots;
}

// 스토리보드 저장 API 호출
async function saveStoryboard(data: {
  shots: Shot[];
  storyboardShots: StoryboardShot[];
  projectId?: string;
}): Promise<{ projectId: string; savedAt: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { projectId: string; savedAt: string };
    message: string;
  }>('/api/planning/storyboards', {
    shots: data.shots,
    storyboardShots: data.storyboardShots,
    projectId: data.projectId
  });

  if (!response.success || !response.data) {
    throw new Error(response.message || '스토리보드 저장에 실패했습니다');
  }

  return response.data;
}

/**
 * 12샷 분해 뮤테이션 훅
 */
export function useShotGeneration() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateShots,

    onMutate: async (steps: StoryStep[]) => {
      await queryClient.cancelQueries({
        queryKey: storyboardQueryKeys.shotsBySteps(steps)
      });

      const previousShots = queryClient.getQueryData(
        storyboardQueryKeys.shotsBySteps(steps)
      );

      dispatch(setLoading(true));
      dispatch(addToast({
        type: 'info',
        title: '샷 분해 중',
        message: '4단계 스토리를 12개 샷으로 분해하고 있습니다...',
        duration: 0
      }));

      return { previousShots, steps };
    },

    onSuccess: (shots: Shot[], steps: StoryStep[]) => {
      dispatch(setShots(shots));
      queryClient.setQueryData(storyboardQueryKeys.shotsBySteps(steps), shots);

      dispatch(addToast({
        type: 'success',
        title: '샷 분해 완료',
        message: `${shots.length}개의 샷으로 분해되었습니다!`
      }));
    },

    onError: (error: Error, steps: StoryStep[], context) => {
      if (context?.previousShots) {
        queryClient.setQueryData(
          storyboardQueryKeys.shotsBySteps(steps),
          context.previousShots
        );
      }

      dispatch(setStoryboardError(error.message));
      dispatch(addToast({
        type: 'error',
        title: '샷 분해 실패',
        message: error.message || '다시 시도해주세요'
      }));
    },

    onSettled: () => {
      dispatch(setLoading(false));
    },

    retry: 1,
    retryDelay: 3000
  });
}

/**
 * 스토리보드 이미지 생성 뮤테이션 훅
 */
export function useStoryboardGeneration() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shots: Shot[]) => {
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

      return generateStoryboard(shots, (progress, currentShotIndex) => {
        dispatch(updateGenerationProgress({ progress, currentShotIndex }));
      });
    },

    onMutate: async (shots: Shot[]) => {
      await queryClient.cancelQueries({
        queryKey: storyboardQueryKeys.storyboardByShots(shots)
      });

      const previousStoryboard = queryClient.getQueryData(
        storyboardQueryKeys.storyboardByShots(shots)
      );

      dispatch(addToast({
        type: 'info',
        title: '스토리보드 생성 중',
        message: `${shots.length}개 샷의 이미지를 생성하고 있습니다...`,
        duration: 0
      }));

      return { previousStoryboard, shots };
    },

    onSuccess: (storyboardShots: StoryboardShot[], shots: Shot[]) => {
      dispatch(setStoryboardShots(storyboardShots));
      dispatch(completeGeneration());

      queryClient.setQueryData(
        storyboardQueryKeys.storyboardByShots(shots),
        storyboardShots
      );

      dispatch(addToast({
        type: 'success',
        title: '스토리보드 생성 완료',
        message: `${storyboardShots.length}개의 스토리보드가 생성되었습니다!`
      }));
    },

    onError: (error: Error, shots: Shot[], context) => {
      if (context?.previousStoryboard) {
        queryClient.setQueryData(
          storyboardQueryKeys.storyboardByShots(shots),
          context.previousStoryboard
        );
      }

      dispatch(setStoryboardError(error.message));
      dispatch(addToast({
        type: 'error',
        title: '스토리보드 생성 실패',
        message: error.message || '일부 이미지 생성에 실패했을 수 있습니다'
      }));
    },

    retry: (failureCount, error) => {
      // 네트워크 오류의 경우만 1회 재시도
      if (error.message.includes('network')) {
        return failureCount < 1;
      }
      return false;
    }
  });
}

/**
 * 스토리보드 저장 뮤테이션 훅
 */
export function useStoryboardSave() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveStoryboard,

    onSuccess: (result, variables) => {
      queryClient.setQueryData(
        storyboardQueryKeys.savedStoryboardById(result.projectId),
        {
          shots: variables.shots,
          storyboardShots: variables.storyboardShots,
          savedAt: result.savedAt
        }
      );

      queryClient.invalidateQueries({
        queryKey: storyboardQueryKeys.savedStoryboards()
      });

      dispatch(addToast({
        type: 'success',
        title: '스토리보드 저장 완료',
        message: '프로젝트가 성공적으로 저장되었습니다'
      }));
    },

    onError: (error: Error) => {
      dispatch(addToast({
        type: 'error',
        title: '저장 실패',
        message: error.message || '스토리보드 저장에 실패했습니다'
      }));
    }
  });
}

/**
 * 저장된 스토리보드 불러오기 쿼리 훅
 */
export function useStoryboardLoad(projectId?: string) {
  const dispatch = useDispatch();

  return useQuery({
    queryKey: storyboardQueryKeys.savedStoryboardById(projectId!),
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: { shots: Shot[]; storyboardShots: StoryboardShot[]; savedAt: string };
      }>(`/api/planning/storyboards/${projectId}`);

      if (!response.success || !response.data) {
        throw new Error('스토리보드를 불러오는데 실패했습니다');
      }

      return response.data;
    },
    enabled: !!projectId,

    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,

  });
}

/**
 * 저장된 스토리보드 목록 쿼리 훅
 */
export function useSavedStoryboards() {
  return useQuery({
    queryKey: storyboardQueryKeys.savedStoryboards(),
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: { storyboards: Array<{ id: string; title: string; shotCount: number; updatedAt: string }> };
      }>('/api/planning/storyboards');

      if (!response.success) {
        throw new Error('저장된 스토리보드를 불러오는데 실패했습니다');
      }

      return response.data.storyboards;
    },

    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });
}

/**
 * 통합 스토리보드 생성 워크플로우 훅
 * - 4단계 스토리 → 12샷 분해 → 스토리보드 이미지 생성을 순차 실행
 */
export function useFullStoryboardWorkflow() {
  const shotGeneration = useShotGeneration();
  const storyboardGeneration = useStoryboardGeneration();
  const dispatch = useDispatch();

  const executeWorkflow = async (steps: StoryStep[]) => {
    try {
      // 1단계: 12샷 분해
      dispatch(addToast({
        type: 'info',
        title: '워크플로우 시작',
        message: '1/2 단계: 스토리를 샷으로 분해하는 중...',
        duration: 0
      }));

      const shots = await shotGeneration.mutateAsync(steps);

      // 2단계: 스토리보드 이미지 생성
      dispatch(addToast({
        type: 'info',
        title: '워크플로우 진행',
        message: '2/2 단계: 스토리보드 이미지 생성 중...',
        duration: 0
      }));

      const storyboardShots = await storyboardGeneration.mutateAsync(shots);

      // 완료
      dispatch(addToast({
        type: 'success',
        title: '워크플로우 완료',
        message: '스토리보드가 성공적으로 생성되었습니다!',
        duration: 8000
      }));

      return { shots, storyboardShots };

    } catch (error) {
      dispatch(addToast({
        type: 'error',
        title: '워크플로우 실패',
        message: error instanceof Error ? error.message : '워크플로우 실행에 실패했습니다'
      }));
      throw error;
    }
  };

  return {
    executeWorkflow,
    isLoading: shotGeneration.isPending || storyboardGeneration.isPending,
    error: shotGeneration.error || storyboardGeneration.error,
    currentStep: shotGeneration.isPending ? 1 : storyboardGeneration.isPending ? 2 : 0
  };
}

/**
 * 스토리보드 캐시 무효화 유틸리티
 */
export function useInvalidateStoryboardCache() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: storyboardQueryKeys.all }),
    invalidateShots: () => queryClient.invalidateQueries({ queryKey: storyboardQueryKeys.shots() }),
    invalidateStoryboard: () => queryClient.invalidateQueries({ queryKey: storyboardQueryKeys.storyboardImages() }),
    invalidateSaved: () => queryClient.invalidateQueries({ queryKey: storyboardQueryKeys.savedStoryboards() }),
    clearCache: () => queryClient.clear(),
  };
}