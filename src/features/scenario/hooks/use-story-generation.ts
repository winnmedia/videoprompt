/**
 * React Query 기반 스토리 생성 서버 상태 관리
 * FSD features 레이어 - 비즈니스 로직 및 서버 상태 관리
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { StoryInput, StoryStep, setStorySteps, setStoryError, setLoading } from '@/entities/scenario';
import { apiClient } from '@/shared/lib/api-client';
import { addToast } from '@/shared';
import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';

// Query Keys (캐시 무효화 및 관리용)
export const storyQueryKeys = {
  all: ['story'] as const,
  generation: () => [...storyQueryKeys.all, 'generation'] as const,
  generationById: (input: StoryInput) => [...storyQueryKeys.generation(), input] as const,
  savedStories: () => [...storyQueryKeys.all, 'saved'] as const,
  savedStoryById: (id: string) => [...storyQueryKeys.savedStories(), id] as const,
};

// 스토리 생성 API 호출
async function generateStory(storyInput: StoryInput): Promise<StoryStep[]> {
  const response = await apiClient.post<{
    success: boolean;
    data: { steps: StoryStep[] };
    message: string;
  }>('/api/ai/generate-story', transformStoryInputToApiRequest(storyInput));

  if (!response.success || !response.data?.steps) {
    throw new Error(response.message || '스토리 생성에 실패했습니다');
  }

  return response.data.steps;
}

// 스토리 저장 API 호출
async function saveStory(data: {
  storyInput: StoryInput;
  steps: StoryStep[];
  projectId?: string
}): Promise<{ projectId: string; savedAt: string }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { projectId: string; savedAt: string };
    message: string;
  }>('/api/planning/stories', {
    ...data.storyInput,
    steps: data.steps,
    projectId: data.projectId
  });

  if (!response.success || !response.data) {
    throw new Error(response.message || '스토리 저장에 실패했습니다');
  }

  return response.data;
}

// 저장된 스토리 불러오기 API 호출
async function loadStory(projectId: string): Promise<{
  storyInput: StoryInput;
  steps: StoryStep[];
  savedAt: string;
}> {
  const response = await apiClient.get<{
    success: boolean;
    data: { storyInput: StoryInput; steps: StoryStep[]; savedAt: string };
    message: string;
  }>(`/api/planning/stories/${projectId}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || '스토리를 불러오는데 실패했습니다');
  }

  return response.data;
}

/**
 * 스토리 생성 뮤테이션 훅
 * - 낙관적 업데이트 지원
 * - 자동 에러 처리
 * - Redux 상태 동기화
 */
export function useStoryGeneration() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateStory,

    onMutate: async (storyInput: StoryInput) => {
      // 낙관적 업데이트를 위한 이전 데이터 백업
      await queryClient.cancelQueries({
        queryKey: storyQueryKeys.generationById(storyInput)
      });

      const previousSteps = queryClient.getQueryData(
        storyQueryKeys.generationById(storyInput)
      );

      // 로딩 상태 설정
      dispatch(setLoading(true));
      dispatch(addToast({
        type: 'info',
        title: '스토리 생성 중',
        message: 'AI가 4단계 스토리를 생성하고 있습니다...',
        duration: 0 // 수동 제거
      }));

      return { previousSteps, storyInput };
    },

    onSuccess: (steps: StoryStep[], storyInput: StoryInput) => {
      // Redux 상태 업데이트
      dispatch(setStorySteps(steps));

      // React Query 캐시 업데이트
      queryClient.setQueryData(storyQueryKeys.generationById(storyInput), steps);

      // 성공 토스트
      dispatch(addToast({
        type: 'success',
        title: '스토리 생성 완료',
        message: `${steps.length}단계 스토리가 성공적으로 생성되었습니다!`
      }));
    },

    onError: (error: Error, storyInput: StoryInput, context) => {
      // 이전 상태로 복원
      if (context?.previousSteps) {
        queryClient.setQueryData(
          storyQueryKeys.generationById(storyInput),
          context.previousSteps
        );
      }

      // Redux 에러 상태 설정
      dispatch(setStoryError(error.message));

      // 에러 토스트
      dispatch(addToast({
        type: 'error',
        title: '스토리 생성 실패',
        message: error.message || '다시 시도해주세요',
        action: {
          label: '다시 시도',
          onClick: () => {
            // 재시도 로직은 컴포넌트에서 처리
          }
        }
      }));
    },

    onSettled: () => {
      // 로딩 상태 해제
      dispatch(setLoading(false));
    },

    // 재시도 설정
    retry: (failureCount, error) => {
      // 네트워크 오류의 경우 최대 2회 재시도
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return failureCount < 2;
      }
      // 서버 에러의 경우 재시도 안함
      return false;
    },

    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 지수 백오프
  });
}

/**
 * 스토리 저장 뮤테이션 훅
 */
export function useStorySave() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveStory,

    onSuccess: (result, variables) => {
      // 저장된 스토리 캐시 업데이트
      queryClient.setQueryData(
        storyQueryKeys.savedStoryById(result.projectId),
        {
          storyInput: variables.storyInput,
          steps: variables.steps,
          savedAt: result.savedAt
        }
      );

      // 저장된 스토리 목록 무효화 (새로고침)
      queryClient.invalidateQueries({
        queryKey: storyQueryKeys.savedStories()
      });

      dispatch(addToast({
        type: 'success',
        title: '스토리 저장 완료',
        message: '프로젝트가 성공적으로 저장되었습니다'
      }));
    },

    onError: (error: Error) => {
      dispatch(addToast({
        type: 'error',
        title: '저장 실패',
        message: error.message || '스토리 저장에 실패했습니다'
      }));
    }
  });
}

/**
 * 스토리 불러오기 쿼리 훅
 */
export function useStoryLoad(projectId?: string) {
  const dispatch = useDispatch();

  return useQuery({
    queryKey: storyQueryKeys.savedStoryById(projectId!),
    queryFn: () => loadStory(projectId!),
    enabled: !!projectId,

    staleTime: 5 * 60 * 1000, // 5분간 신선
    gcTime: 30 * 60 * 1000, // 30분간 캐시

  });
}

/**
 * 저장된 스토리 목록 쿼리 훅
 */
export function useSavedStories() {
  return useQuery({
    queryKey: storyQueryKeys.savedStories(),
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: { stories: Array<{ id: string; title: string; updatedAt: string }> };
      }>('/api/planning/stories');

      if (!response.success) {
        throw new Error('저장된 스토리를 불러오는데 실패했습니다');
      }

      return response.data.stories;
    },

    staleTime: 2 * 60 * 1000, // 2분간 신선
    gcTime: 10 * 60 * 1000, // 10분간 캐시
  });
}

/**
 * 스토리 자동 저장 훅
 * - 일정 간격으로 자동 저장
 * - 변경 사항이 있을 때만 저장
 */
export function useAutoSaveStory(
  storyInput: StoryInput | null,
  steps: StoryStep[],
  isDirty: boolean,
  enabled: boolean = true
) {
  const saveMutation = useStorySave();

  // 30초마다 자동 저장 시도
  useQuery({
    queryKey: ['autoSave', storyInput, steps, isDirty],
    queryFn: async () => {
      if (!storyInput || !isDirty || steps.length === 0) {
        return null;
      }

      await saveMutation.mutateAsync({
        storyInput,
        steps
      });

      return 'saved';
    },
    enabled: enabled && isDirty && !!storyInput,
    refetchInterval: 30 * 1000, // 30초
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: Infinity // 자동저장은 캐시하지 않음
  });

  return {
    isAutoSaving: saveMutation.isPending,
    autoSaveError: saveMutation.error,
  };
}

/**
 * 스토리 생성 캐시 무효화 유틸리티
 */
export function useInvalidateStoryCache() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: storyQueryKeys.all }),
    invalidateGeneration: () => queryClient.invalidateQueries({ queryKey: storyQueryKeys.generation() }),
    invalidateSaved: () => queryClient.invalidateQueries({ queryKey: storyQueryKeys.savedStories() }),
    clearCache: () => queryClient.clear(),
  };
}