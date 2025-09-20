/**
 * Redux Toolkit Query API Slice v2.0
 * React Query를 RTK Query로 대체하는 중앙 집중식 API 관리
 * FSD shared 레이어 - API 통신 인터페이스
 *
 * v2.0 업데이트:
 * - Zod 스키마 검증 통합
 * - 타입 안전한 에러 처리
 * - 성능 최적화된 캐싱
 * - 실시간 데이터 품질 모니터링
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { apiClient } from '@/shared/lib/api-client';
import { logger } from '@/shared/lib/logger';


// 새로운 타입 시스템 임포트 (Zod 기반)
import {
  type StoryInput,
  type StoryStep,
  type ScenarioData,
  type PromptData,
  type VideoData,
  type Project,
  type ProjectMetadata,
  type ProjectListFilters,
  type Shot,
  type StoryboardShot,
  type StoryGenerationResponse,
  type StorySaveResponse,
  type StoryLoadResponse,
  type SavedStoriesResponse,
  type ScenarioSaveResponse,
  type PromptSaveResponse,
  type PromptsGetResponse,
  type VideoSaveResponse,
  type VideosGetResponse,
  type PipelineStatusResponse,
  type CreateProjectResponse,
  type UpdateProjectResponse,
  type GetProjectResponse,
  type GetProjectsResponse,
  type GetRecentProjectsResponse,
  type GetProjectStatsResponse,
  type GenerateShotsResponse,
  type GenerateStoryboardResponse,
  type SaveStoryboardResponse,
  type LoadStoryboardResponse,
  type GetSavedStoryboardsResponse,
} from '@/shared/schemas/api-schemas';

// 스키마 검증 및 에러 처리 시스템
import {
  createResponseTransformer,
  transformRTKQueryError,
  validateEndpointResponseStrict,
} from '@/shared/api/schema-validation';
import {
  transformRTKQueryError as handleError,
  updateErrorMetrics,
  logError,
  type AppError,
} from '@/shared/api/error-handling';

// ============================================================================
// 레거시 타입 호환성 (기존 코드베이스와의 호환성 보장)
// 새로운 Zod 기반 타입들이 /shared/schemas/api-schemas.ts에 정의됨
// ============================================================================

// 기존 인터페이스들을 export하여 호환성 유지
export type {
  StoryInput,
  StoryStep,
  ScenarioData,
  PromptData,
  VideoData,
  Project,
  ProjectMetadata,
  ProjectListFilters,
  Shot,
  StoryboardShot,
} from '@/shared/schemas/api-schemas';

/**
 * API Response 타입들
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface StoryGenerationResponse {
  steps: StoryStep[];
}

interface StorySaveResponse {
  projectId: string;
  savedAt: string;
}

interface StoryLoadResponse {
  storyInput: StoryInput;
  steps: StoryStep[];
  savedAt: string;
}

interface SavedStoriesResponse {
  stories: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
}

/**
 * ApiClient 기반 Custom Base Query
 * 기존 인증 및 에러 처리 로직 재사용
 */
const apiClientBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  try {
    const url = typeof args === 'string' ? args : args.url;
    const method = typeof args === 'string' ? 'GET' : (args.method || 'GET');
    const body = typeof args === 'string' ? undefined : args.body;

    let result;

    switch (method.toUpperCase()) {
      case 'GET':
        result = await apiClient.get(url);
        break;
      case 'POST':
        result = await apiClient.post(url, body);
        break;
      case 'PUT':
        result = await apiClient.put(url, body);
        break;
      case 'DELETE':
        result = await apiClient.delete(url);
        break;
      default:
        result = await apiClient.get(url);
    }

    return { data: result };
  } catch (error: any) {
    return {
      error: {
        status: error.status || 500,
        data: error.message || 'Unknown error occurred',
      } as FetchBaseQueryError,
    };
  }
};

/**
 * RTK Query API Slice
 *
 * 캐시 설정:
 * - 기본 keepUnusedDataFor: 10분 (600초)
 * - refetchOnMountOrArgChange: 5분 (300초)
 * - 자동 re-fetching 설정
 * - Tag-based invalidation 시스템
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: apiClientBaseQuery,
  keepUnusedDataFor: 600, // 10분 캐시 유지
  refetchOnMountOrArgChange: 300, // 5분 후 자동 refetch
  refetchOnFocus: false, // 포커스시 자동 refetch 비활성화
  refetchOnReconnect: true, // 재연결시 자동 refetch 활성화
  tagTypes: [
    'Story',
    'Scenario',
    'Prompt',
    'Video',
    'Project',
    'SavedStories',
    'Storyboard',
    'Pipeline'
  ],
  endpoints: (builder) => ({
    // 스토리 생성
    generateStory: builder.mutation<StoryGenerationResponse, StoryInput>({
      query: (storyInput) => ({
        url: '/api/ai/generate-story',
        method: 'POST',
        body: storyInput,
      }),
      invalidatesTags: ['Story', 'SavedStories'],
      // AI 생성은 시간이 오래 걸릴 수 있으므로 재시도 비활성화
      extraOptions: {
        maxRetries: 0,
      },
    }),

    // 스토리 저장
    saveStory: builder.mutation<StorySaveResponse, {
      storyInput: StoryInput;
      steps: StoryStep[];
      projectId?: string;
    }>({
      query: (data) => ({
        url: '/api/planning/stories',
        method: 'POST',
        body: {
          ...data.storyInput,
          steps: data.steps,
          projectId: data.projectId,
        },
      }),
      invalidatesTags: ['SavedStories', 'Project'],
    }),

    // 스토리 불러오기
    loadStory: builder.query<StoryLoadResponse, string>({
      query: (projectId) => `/api/planning/stories/${projectId}`,
      providesTags: (result, error, projectId) => [
        { type: 'Story', id: projectId },
        { type: 'Project', id: projectId }
      ],
      // 스토리 데이터는 자주 변경되지 않으므로 긴 캐시 유지
      keepUnusedDataFor: 900, // 15분
    }),

    // 저장된 스토리 목록
    getSavedStories: builder.query<SavedStoriesResponse, void>({
      query: () => '/api/planning/stories',
      providesTags: ['SavedStories'],
      // 목록 데이터는 자주 업데이트되므로 짧은 캐시
      keepUnusedDataFor: 300, // 5분
    }),

    // 시나리오 생성 (파이프라인 2단계)
    generateScenario: builder.mutation<{ id: string; savedAt: string }, ScenarioData>({
      query: (scenarioData) => ({
        url: '/api/pipeline/scenario',
        method: 'POST',
        body: scenarioData,
      }),
      invalidatesTags: ['Scenario', 'Project', 'Pipeline'],
      extraOptions: {
        maxRetries: 0, // AI 생성은 재시도하지 않음
      },
    }),

    // 프롬프트 생성 (파이프라인 3단계)
    generatePrompt: builder.mutation<{ promptId: string; savedAt: string }, PromptData>({
      query: (promptData) => ({
        url: '/api/pipeline/prompt',
        method: 'POST',
        body: promptData,
      }),
      invalidatesTags: ['Prompt', 'Project', 'Pipeline'],
      extraOptions: {
        maxRetries: 0, // AI 생성은 재시도하지 않음
      },
    }),

    // 프롬프트 목록 조회
    getPrompts: builder.query<{
      prompts: Array<{
        id: string;
        scenarioTitle: string;
        version: string;
        keywordCount: number;
        quality: string;
        createdAt: string;
        finalPrompt: string;
        keywords: string[];
      }>;
      total: number;
      timestamp: string;
    }, void>({
      query: () => '/api/planning/prompt',
      providesTags: ['Prompt'],
    }),

    // 비디오 생성 (파이프라인 4단계)
    generateVideo: builder.mutation<{ videoId: string; savedAt: string }, VideoData>({
      query: (videoData) => ({
        url: '/api/pipeline/video',
        method: 'POST',
        body: videoData,
      }),
      invalidatesTags: ['Video', 'Project', 'Pipeline'],
      extraOptions: {
        maxRetries: 0, // AI 생성은 재시도하지 않음
      },
    }),

    // 비디오 목록 조회
    getVideos: builder.query<{
      videos: Array<{
        id: string;
        title: string;
        url: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
    }, void>({
      query: () => '/api/videos/list',
      providesTags: ['Video'],
    }),

    // ============================================================================
    // 파이프라인 API 엔드포인트 (새로운 통합 시스템)
    // ============================================================================

    // 파이프라인 1단계: 스토리 제출
    submitStory: builder.mutation<{ projectId: string; storyId: string }, StoryInput>({
      query: (storyInput) => ({
        url: '/api/pipeline/story',
        method: 'POST',
        body: storyInput,
      }),
      invalidatesTags: ['Story', 'Project', 'Pipeline'],
      extraOptions: {
        maxRetries: 0,
      },
    }),

    // 파이프라인 스토리 업데이트
    updateStory: builder.mutation<{ success: boolean }, {
      projectId: string;
      storyInput: StoryInput;
      steps: StoryStep[];
    }>({
      query: (data) => ({
        url: '/api/pipeline/story',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Story', 'Project', 'Pipeline'],
    }),

    // 파이프라인 상태 조회
    getPipelineStatus: builder.query<{
      projectId: string;
      story: { completed: boolean; data?: any };
      scenario: { completed: boolean; data?: any };
      prompt: { completed: boolean; data?: any };
      video: { completed: boolean; data?: any };
      overall: { progress: number; status: string };
    }, string>({
      query: (projectId) => `/api/pipeline/status/${projectId}`,
      providesTags: (result, error, projectId) => [
        { type: 'Project', id: projectId }
      ],
    }),

    // 프로젝트 관리 endpoints
    createProject: builder.mutation<Project, {
      title: string;
      description?: string;
      storyInput: StoryInput;
    }>({
      query: (data) => ({
        url: '/api/projects',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Project', 'SavedStories'],
    }),

    updateProject: builder.mutation<Project, {
      id: string;
      updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>;
    }>({
      query: ({ id, updates }) => ({
        url: `/api/projects/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Project', id },
        'SavedStories',
      ],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/projects/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Project', 'SavedStories'],
    }),

    getProject: builder.query<Project, string>({
      query: (id) => `/api/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Project', id }],
    }),

    getProjects: builder.query<{
      projects: ProjectMetadata[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrevious: boolean;
      };
    }, ProjectListFilters & { page: number; limit: number }>({
      query: (filters) => {
        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            if (Array.isArray(value)) {
              searchParams.append(key, value.join(','));
            } else {
              searchParams.append(key, value.toString());
            }
          }
        });
        return `/api/projects?${searchParams}`;
      },
      providesTags: ['Project'],
    }),

    getRecentProjects: builder.query<{ projects: ProjectMetadata[] }, number | void>({
      query: (limit = 10) => `/api/projects/recent?limit=${limit}`,
      providesTags: ['Project'],
    }),

    getProjectStats: builder.query<{
      totalProjects: number;
      completedProjects: number;
      recentActivity: number;
      storageUsed: number;
      collaborationCount: number;
    }, void>({
      query: () => '/api/projects/stats',
      providesTags: ['Project'],
    }),

    // 스토리보드 관련 endpoints
    generateShots: builder.mutation<{ shots: Shot[] }, {
      structure4: Array<{ title: string; summary: string }>;
      genre: string;
      tone: string;
    }>({
      query: (data) => ({
        url: '/api/ai/generate-shots',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Story'],
    }),

    generateStoryboard: builder.mutation<{ storyboardShots: StoryboardShot[] }, {
      shots: Array<{
        id: string;
        title: string;
        description: string;
        shotType: string;
        camera: string;
      }>;
    }>({
      query: (data) => ({
        url: '/api/ai/generate-storyboard',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Story'],
    }),

    saveStoryboard: builder.mutation<{ projectId: string; savedAt: string }, {
      shots: Shot[];
      storyboardShots: StoryboardShot[];
      projectId?: string;
    }>({
      query: (data) => ({
        url: '/api/planning/storyboards',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Story', 'Project'],
    }),

    loadStoryboard: builder.query<{
      shots: Shot[];
      storyboardShots: StoryboardShot[];
      savedAt: string;
    }, string>({
      query: (projectId) => `/api/planning/storyboards/${projectId}`,
      providesTags: (result, error, projectId) => [
        { type: 'Story', id: projectId }
      ],
    }),

    getSavedStoryboards: builder.query<{
      storyboards: Array<{
        id: string;
        title: string;
        shotCount: number;
        updatedAt: string;
      }>;
    }, void>({
      query: () => '/api/planning/storyboards',
      providesTags: ['Story'],
    }),

    // ============================================================================
    // Planning Dashboard API Endpoints (Redux Integration)
    // ============================================================================

    // Planning Dashboard 통합 조회
    getPlanningDashboard: builder.query<{
      scenarios: Array<{
        id: string;
        title: string;
        version?: string;
        author?: string;
        updatedAt: string;
        metadata?: {
          version?: string;
          author?: string;
          hasFourStep?: boolean;
          hasTwelveShot?: boolean;
          pdfUrl?: string;
        };
      }>;
      prompts: Array<{
        id: string;
        scenarioTitle: string;
        version: string;
        keywordCount: number;
        shotCount: number;
        quality: string;
        createdAt: string;
        jsonUrl?: string;
      }>;
      videos: Array<{
        id: string;
        title: string;
        prompt?: string;
        provider?: string;
        duration?: number;
        aspectRatio?: string;
        status: string;
        videoUrl?: string;
        thumbnailUrl?: string;
        createdAt: string;
        completedAt?: string;
        jobId?: string;
      }>;
      images: Array<{
        id: string;
        title: string;
        url?: string;
        dimensions?: string;
        format?: string;
        fileSize?: number;
        tags?: string[];
        createdAt?: string;
      }>;
      summary: {
        totalScenarios: number;
        totalPrompts: number;
        totalVideos: number;
        totalImages: number;
      };
    }, void>({
      query: () => '/api/planning/dashboard',
      providesTags: ['Scenario', 'Prompt', 'Video', 'Pipeline'],
      // Dashboard 데이터는 자주 변경되므로 짧은 캐시
      keepUnusedDataFor: 300, // 5분
    }),

    // Planning 개별 아이템 업데이트
    updateScenario: builder.mutation<{ success: boolean }, {
      id: string;
      updates: Partial<{
        title: string;
        version: string;
        author: string;
        metadata: Record<string, any>;
      }>;
    }>({
      query: ({ id, updates }) => ({
        url: `/api/planning/scenarios/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: ['Scenario', 'Pipeline'],
    }),

    updatePrompt: builder.mutation<{ success: boolean }, {
      id: string;
      updates: Partial<{
        scenarioTitle: string;
        version: string;
        quality: string;
        keywords: string[];
      }>;
    }>({
      query: ({ id, updates }) => ({
        url: `/api/planning/prompts/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: ['Prompt', 'Pipeline'],
    }),

    updateVideo: builder.mutation<{ success: boolean }, {
      id: string;
      updates: Partial<{
        title: string;
        status: string;
        videoUrl: string;
        thumbnailUrl: string;
      }>;
    }>({
      query: ({ id, updates }) => ({
        url: `/api/planning/videos/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: ['Video', 'Pipeline'],
    }),

    // Planning 아이템 삭제
    deleteScenario: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/api/planning/scenarios/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Scenario', 'Pipeline'],
    }),

    deletePrompt: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/api/planning/prompts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Prompt', 'Pipeline'],
    }),

    deleteVideo: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/api/planning/videos/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Video', 'Pipeline'],
    }),

    // 배치 작업 endpoints
    batchDeletePlanningItems: builder.mutation<{ success: boolean; deletedCount: number }, {
      itemIds: string[];
      itemType: 'scenario' | 'prompt' | 'video' | 'image';
    }>({
      query: ({ itemIds, itemType }) => ({
        url: `/api/planning/batch/delete`,
        method: 'POST',
        body: { itemIds, itemType },
      }),
      invalidatesTags: ['Scenario', 'Prompt', 'Video', 'Pipeline'],
    }),

    batchUpdatePlanningItems: builder.mutation<{ success: boolean; updatedCount: number }, {
      itemIds: string[];
      itemType: 'scenario' | 'prompt' | 'video' | 'image';
      updates: Record<string, any>;
    }>({
      query: ({ itemIds, itemType, updates }) => ({
        url: `/api/planning/batch/update`,
        method: 'POST',
        body: { itemIds, itemType, updates },
      }),
      invalidatesTags: ['Scenario', 'Prompt', 'Video', 'Pipeline'],
    }),
  }),
});

/**
 * Generated hooks export
 */
export const {
  // 스토리 관련
  useGenerateStoryMutation,
  useSaveStoryMutation,
  useLoadStoryQuery,
  useGetSavedStoriesQuery,

  // 시나리오 관련 (레거시)
  useGetPromptsQuery,

  // 비디오 관련 (레거시)
  useGetVideosQuery,

  // 파이프라인 관련 (새로운 통합 시스템)
  useSubmitStoryMutation,
  useUpdateStoryMutation,
  useGenerateScenarioMutation,
  useGeneratePromptMutation,
  useGenerateVideoMutation,
  useGetPipelineStatusQuery,

  // 프로젝트 관련
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectQuery,
  useGetProjectsQuery,
  useGetRecentProjectsQuery,
  useGetProjectStatsQuery,

  // 스토리보드 관련
  useGenerateShotsMutation,
  useGenerateStoryboardMutation,
  useSaveStoryboardMutation,
  useLoadStoryboardQuery,
  useGetSavedStoryboardsQuery,

  // Planning Dashboard 관련 (Redux Integration)
  useGetPlanningDashboardQuery,
  useUpdateScenarioMutation,
  useUpdatePromptMutation,
  useUpdateVideoMutation,
  useDeleteScenarioMutation,
  useDeletePromptMutation,
  useDeleteVideoMutation,
  useBatchDeletePlanningItemsMutation,
  useBatchUpdatePlanningItemsMutation,
} = apiSlice;

/**
 * RTK Query 캐시 유틸리티
 */
export class RTKQueryUtils {
  /**
   * 특정 태그의 캐시 무효화
   */
  static invalidateTag(dispatch: any, tag: string) {
    dispatch(apiSlice.util.invalidateTags([tag]));
  }

  /**
   * 특정 태그들의 캐시 무효화 (배치)
   */
  static invalidateTags(dispatch: any, tags: string[]) {
    dispatch(apiSlice.util.invalidateTags(tags));
  }

  /**
   * 전체 캐시 리셋
   */
  static resetApiState(dispatch: any) {
    dispatch(apiSlice.util.resetApiState());
  }

  /**
   * 특정 쿼리 캐시 프리페치
   */
  static prefetchQuery(dispatch: any, endpoint: string, args?: any) {
    dispatch(apiSlice.util.prefetch(endpoint, args));
  }

  /**
   * 프로젝트 관련 모든 캐시 무효화
   */
  static invalidateProjectData(dispatch: any, projectId: string) {
    dispatch(apiSlice.util.invalidateTags([
      { type: 'Project', id: projectId },
      { type: 'Story', id: projectId },
      { type: 'Storyboard', id: projectId },
      { type: 'Pipeline', id: projectId },
      'SavedStories'
    ]));
  }

  /**
   * 사용자 데이터 캐시 무효화 (로그아웃 시 사용)
   */
  static invalidateUserData(dispatch: any) {
    dispatch(apiSlice.util.invalidateTags([
      'Project',
      'Story',
      'SavedStories',
      'Prompt',
      'Video',
      'Storyboard'
    ]));
  }

  /**
   * 캐시 상태 조회
   */
  static getCacheState(getState: any) {
    return getState().api;
  }

  /**
   * 특정 엔드포인트의 캐시 데이터 조회
   */
  static getCachedData(getState: any, endpoint: string, args?: any) {
    return apiSlice.endpoints[endpoint].select(args)(getState());
  }

  /**
   * 캐시 크기 및 통계 정보
   */
  static getCacheStats(getState: any) {
    const apiState = getState().api;
    const queries = apiState.queries;
    const mutations = apiState.mutations;

    const stats = {
      totalQueries: Object.keys(queries).length,
      totalMutations: Object.keys(mutations).length,
      cachedDataSize: JSON.stringify(queries).length,
      invalidatedQueries: Object.values(queries).filter((q: any) => q.status === 'uninitialized').length,
      fulfilledQueries: Object.values(queries).filter((q: any) => q.status === 'fulfilled').length,
      pendingQueries: Object.values(queries).filter((q: any) => q.status === 'pending').length,
      rejectedQueries: Object.values(queries).filter((q: any) => q.status === 'rejected').length,
    };

    return stats;
  }

  /**
   * 개발 환경에서 캐시 상태 디버깅
   */
  static debugCache(getState: any) {
    if (process.env.NODE_ENV === 'development') {
      const stats = this.getCacheStats(getState);
      console.group('🔄 RTK Query Cache Debug');
      logger.info('Cache Stats:', stats);
      logger.info('Full Cache State:', this.getCacheState(getState));
      console.groupEnd();
    }
  }
}

/**
 * RTK Query 에러 타입 가드
 */
export function isRTKQueryError(error: any): error is FetchBaseQueryError {
  return error && typeof error === 'object' && 'status' in error;
}

/**
 * RTK Query 에러 메시지 추출
 */
export function getErrorMessage(error: any): string {
  if (isRTKQueryError(error)) {
    if (typeof error.data === 'string') {
      return error.data;
    }
    if (typeof error.data === 'object' && error.data && 'message' in error.data) {
      return (error.data as any).message;
    }
    return `Error ${error.status}`;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return error.message;
  }

  return 'Unknown error occurred';
}