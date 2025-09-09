/**
 * 스토리보드 생성 React Query Hooks
 * 서버 상태 관리 및 API 통합
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '../../store';
import {
  initializeGenerationState,
  updateGenerationState,
  updateShotState,
  addGeneratedResult,
  addBatchResults,
  addError,
  updateStatistics,
} from '../../store/slices/storyboard';
import {
  generateStoryboard,
  generateSingleShot,
  batchGenerateShots,
  saveStoryboard as saveStoryboardService,
  getGenerationState,
  getCacheStats,
} from '../../services/storyboard-generator';
import { queryKeys } from '../client';
import type {
  StoryboardGenerationOptions,
  SingleShotGenerationRequest,
  BatchGenerationRequest,
  StoryboardSaveRequest,
  StoryboardResult,
  ShotGenerationStatus,
} from '../../types/storyboard';

// =============================================================================
// 스토리보드 생성 Mutation
// =============================================================================

/**
 * 전체 스토리보드 생성 Hook
 */
export function useGenerateStoryboard() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      shots,
      options,
    }: {
      shots: SingleShotGenerationRequest[];
      options: StoryboardGenerationOptions;
    }) => {
      // Redux 상태 초기화
      const initialState = {
        projectId: options.projectId,
        overallProgress: 0,
        totalShots: shots.length,
        completedShots: 0,
        failedShots: 0,
        startedAt: new Date(),
        shotStates: new Map(
          shots.map(shot => [
            shot.shotId,
            {
              shotId: shot.shotId,
              status: 'pending' as ShotGenerationStatus,
              progress: 0,
              retryCount: 0,
            },
          ]),
        ),
        activeGenerations: [],
      };
      
      dispatch(initializeGenerationState({
        projectId: options.projectId,
        state: initialState,
      }));
      
      // 서비스 호출
      return generateStoryboard(shots, options);
    },
    
    onSuccess: (results, { options }) => {
      // 결과를 Redux에 저장
      dispatch(addBatchResults({
        projectId: options.projectId,
        results,
      }));
      
      // 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.storyboard(options.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.generationHistory(options.projectId),
      });
    },
    
    onError: (error: any, { options }) => {
      dispatch(addError({
        message: `스토리보드 생성 실패: ${error.message}`,
      }));
      
      dispatch(updateGenerationState({
        projectId: options.projectId,
        updates: {
          overallProgress: 0,
        },
      }));
    },
  });
}

/**
 * 단일 샷 생성 Hook
 */
export function useGenerateSingleShot() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: generateSingleShot,
    
    onMutate: async (request) => {
      // 낙관적 업데이트: 생성 중 상태로 변경
      const projectId = queryClient.getQueryData<string>(['activeProjectId']) || '';
      
      dispatch(updateShotState({
        projectId,
        shotId: request.shotId,
        updates: {
          status: 'generating' as ShotGenerationStatus,
          startedAt: new Date(),
        },
      }));
    },
    
    onSuccess: (result, request) => {
      const projectId = queryClient.getQueryData<string>(['activeProjectId']) || '';
      
      // 결과 저장
      dispatch(addGeneratedResult({
        projectId,
        result,
      }));
      
      // 샷 상태 업데이트
      dispatch(updateShotState({
        projectId,
        shotId: request.shotId,
        updates: {
          status: 'completed' as ShotGenerationStatus,
          completedAt: new Date(),
          result,
        },
      }));
      
      // 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.storyboardShot(projectId, request.shotId),
      });
    },
    
    onError: (error: any, request) => {
      const projectId = queryClient.getQueryData<string>(['activeProjectId']) || '';
      
      dispatch(updateShotState({
        projectId,
        shotId: request.shotId,
        updates: {
          status: 'failed' as ShotGenerationStatus,
          errorMessage: error.message,
        },
      }));
      
      dispatch(addError({
        message: `샷 생성 실패 (${request.shotId}): ${error.message}`,
        shotId: request.shotId,
      }));
    },
  });
}

/**
 * 배치 생성 Hook
 */
export function useBatchGenerateShots() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      request,
      options,
    }: {
      request: BatchGenerationRequest;
      options: StoryboardGenerationOptions;
    }) => {
      return batchGenerateShots(request, options);
    },
    
    onSuccess: (result, { options }) => {
      // 성공한 결과들 저장
      if (result.successful.length > 0) {
        dispatch(addBatchResults({
          projectId: options.projectId,
          results: result.successful,
        }));
      }
      
      // 실패한 샷들에 대한 에러 추가
      result.failed.forEach(failed => {
        dispatch(addError({
          message: failed.error,
          shotId: failed.shotId,
        }));
      });
      
      // 통계 업데이트
      dispatch(updateStatistics({
        totalGenerated: result.successful.length,
        totalFailed: result.failed.length,
      }));
      
      // 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.storyboard(options.projectId),
      });
    },
  });
}

// =============================================================================
// 스토리보드 저장 Mutation
// =============================================================================

/**
 * 스토리보드 저장 Hook
 */
export function useSaveStoryboard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: saveStoryboardService,
    
    onSuccess: (_, request) => {
      // 저장 후 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.storyboard(request.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.generationHistory(request.projectId),
      });
    },
    
    onError: (error: any) => {
      console.error('스토리보드 저장 실패:', error);
    },
  });
}

// =============================================================================
// 조회 Queries
// =============================================================================

/**
 * 생성 상태 조회 Hook
 */
export function useGenerationStatus(projectId: string) {
  return useQuery({
    queryKey: queryKeys.generationStatus(projectId),
    queryFn: () => getGenerationState(projectId),
    enabled: !!projectId,
    refetchInterval: (data: any) => {
      // 생성 중일 때만 1초마다 refetch
      if (data && data.overallProgress < 100) {
        return 1000;
      }
      return false;
    },
  });
}

/**
 * 캐시 통계 조회 Hook
 */
export function useCacheStats() {
  return useQuery({
    queryKey: queryKeys.cacheStats(),
    queryFn: getCacheStats,
    staleTime: 30000, // 30초
  });
}

/**
 * 스토리보드 조회 Hook
 */
export function useStoryboard(projectId: string) {
  return useQuery({
    queryKey: queryKeys.storyboard(projectId),
    queryFn: async () => {
      // API 호출 (실제 구현 필요)
      const response = await fetch(`/api/storyboards/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch storyboard');
      }
      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * 생성 히스토리 조회 Hook
 */
export function useGenerationHistory(projectId: string) {
  return useQuery({
    queryKey: queryKeys.generationHistory(projectId),
    queryFn: async () => {
      // API 호출 (실제 구현 필요)
      const response = await fetch(`/api/storyboards/${projectId}/history`);
      if (!response.ok) {
        throw new Error('Failed to fetch generation history');
      }
      return response.json();
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// Optimistic Updates & Rollback
// =============================================================================

/**
 * 낙관적 업데이트를 위한 유틸리티
 */
export function useOptimisticStoryboardUpdate() {
  const queryClient = useQueryClient();
  
  return {
    /**
     * 낙관적으로 샷 추가
     */
    optimisticallyAddShot: (projectId: string, shot: StoryboardResult) => {
      queryClient.setQueryData<StoryboardResult[]>(
        queryKeys.storyboard(projectId),
        (old = []) => [...old, shot],
      );
    },
    
    /**
     * 낙관적으로 샷 업데이트
     */
    optimisticallyUpdateShot: (
      projectId: string,
      shotId: string,
      updates: Partial<StoryboardResult>,
    ) => {
      queryClient.setQueryData<StoryboardResult[]>(
        queryKeys.storyboard(projectId),
        (old = []) =>
          old.map(shot =>
            shot.shotId === shotId ? { ...shot, ...updates } : shot,
          ),
      );
    },
    
    /**
     * 롤백
     */
    rollback: (projectId: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.storyboard(projectId),
      });
    },
  };
}