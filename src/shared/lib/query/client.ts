/**
 * React Query (TanStack Query) 클라이언트 설정
 * 서버 상태 관리를 위한 설정
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Query Client 기본 설정
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 기본 stale time: 5분
      staleTime: 5 * 60 * 1000,
      
      // 기본 cache time: 10분
      gcTime: 10 * 60 * 1000,
      
      // 재시도 설정
      retry: (failureCount, error: any) => {
        // 4xx 에러는 재시도 안함
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // 최대 3회 재시도
        return failureCount < 3;
      },
      
      // 재시도 지연 시간 (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // 포커스 시 refetch 비활성화 (필요시 개별 쿼리에서 활성화)
      refetchOnWindowFocus: false,
      
      // 재연결 시 refetch 활성화
      refetchOnReconnect: true,
    },
    mutations: {
      // mutation 재시도 설정
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query Key Factory
 * 일관된 쿼리 키 관리를 위한 팩토리
 */
export const queryKeys = {
  all: ['storyboard'] as const,
  
  projects: () => [...queryKeys.all, 'projects'] as const,
  project: (id: string) => [...queryKeys.projects(), id] as const,
  
  storyboards: () => [...queryKeys.all, 'storyboards'] as const,
  storyboard: (projectId: string) => [...queryKeys.storyboards(), projectId] as const,
  storyboardShot: (projectId: string, shotId: string) => 
    [...queryKeys.storyboard(projectId), 'shot', shotId] as const,
  
  generation: () => [...queryKeys.all, 'generation'] as const,
  generationStatus: (projectId: string) => 
    [...queryKeys.generation(), 'status', projectId] as const,
  generationHistory: (projectId: string) => 
    [...queryKeys.generation(), 'history', projectId] as const,
  
  cache: () => [...queryKeys.all, 'cache'] as const,
  cacheStats: () => [...queryKeys.cache(), 'stats'] as const,
};