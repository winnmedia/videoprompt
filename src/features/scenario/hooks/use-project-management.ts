/**
 * React Query 기반 프로젝트 관리 서버 상태 관리
 * FSD features 레이어 - 프로젝트 저장/불러오기/관리
 */

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { StoryInput, StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { apiClient } from '@/shared/lib/api-client';
import { addToast } from '@/shared/store/ui-slice';

// 프로젝트 타입 정의
export interface Project {
  id: string;
  title: string;
  description?: string;
  storyInput: StoryInput;
  steps: StoryStep[];
  shots: Shot[];
  storyboardShots: StoryboardShot[];
  status: 'draft' | 'story_complete' | 'shots_complete' | 'storyboard_complete' | 'final';
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  isPublic: boolean;
  tags: string[];
  collaborators?: Array<{ userId: string; role: 'viewer' | 'editor' | 'admin' }>;
}

export interface ProjectMetadata {
  id: string;
  title: string;
  description?: string;
  status: Project['status'];
  updatedAt: string;
  thumbnail?: string;
  tags: string[];
}

// Query Keys
export const projectQueryKeys = {
  all: ['projects'] as const,
  lists: () => [...projectQueryKeys.all, 'list'] as const,
  list: (filters: ProjectListFilters) => [...projectQueryKeys.lists(), filters] as const,
  details: () => [...projectQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectQueryKeys.details(), id] as const,
  recent: () => [...projectQueryKeys.all, 'recent'] as const,
  templates: () => [...projectQueryKeys.all, 'templates'] as const,
} as const;

// 필터 타입
export interface ProjectListFilters {
  status?: Project['status'];
  search?: string;
  tags?: string[];
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  isPublic?: boolean;
}

// API 함수들
async function createProject(data: {
  title: string;
  description?: string;
  storyInput: StoryInput;
}): Promise<Project> {
  const response = await apiClient.post<{
    success: boolean;
    data: Project;
    message: string;
  }>('/api/projects', data);

  if (!response.success || !response.data) {
    throw new Error(response.message || '프로젝트 생성에 실패했습니다');
  }

  return response.data;
}

async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>
): Promise<Project> {
  const response = await apiClient.put<{
    success: boolean;
    data: Project;
    message: string;
  }>(`/api/projects/${id}`, updates);

  if (!response.success || !response.data) {
    throw new Error(response.message || '프로젝트 업데이트에 실패했습니다');
  }

  return response.data;
}

async function deleteProject(id: string): Promise<void> {
  const response = await apiClient.delete<{
    success: boolean;
    message: string;
  }>(`/api/projects/${id}`);

  if (!response.success) {
    throw new Error(response.message || '프로젝트 삭제에 실패했습니다');
  }
}

async function getProject(id: string): Promise<Project> {
  const response = await apiClient.get<{
    success: boolean;
    data: Project;
    message: string;
  }>(`/api/projects/${id}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || '프로젝트를 불러오는데 실패했습니다');
  }

  return response.data;
}

async function getProjects(filters: ProjectListFilters & { page: number; limit: number }) {
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

  const response = await apiClient.get<{
    success: boolean;
    data: {
      projects: ProjectMetadata[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        hasNext: boolean;
        hasPrevious: boolean;
      };
    };
    message: string;
  }>(`/api/projects?${searchParams}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || '프로젝트 목록을 불러오는데 실패했습니다');
  }

  return response.data;
}

async function getRecentProjects(limit: number = 10): Promise<ProjectMetadata[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: { projects: ProjectMetadata[] };
    message: string;
  }>(`/api/projects/recent?limit=${limit}`);

  if (!response.success || !response.data) {
    throw new Error(response.message || '최근 프로젝트를 불러오는데 실패했습니다');
  }

  return response.data.projects;
}

/**
 * 프로젝트 생성 뮤테이션 훅
 */
export function useCreateProject() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,

    onSuccess: (project) => {
      // 프로젝트 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() });

      // 새 프로젝트 상세 캐시 설정
      queryClient.setQueryData(projectQueryKeys.detail(project.id), project);

      dispatch(addToast({
        type: 'success',
        title: '프로젝트 생성 완료',
        message: `"${project.title}" 프로젝트가 생성되었습니다`
      }));
    },

    onError: (error: Error) => {
      dispatch(addToast({
        type: 'error',
        title: '프로젝트 생성 실패',
        message: error.message || '프로젝트 생성에 실패했습니다'
      }));
    }
  });
}

/**
 * 프로젝트 업데이트 뮤테이션 훅
 */
export function useUpdateProject() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateProject>[1] }) =>
      updateProject(id, updates),

    onMutate: async ({ id, updates }) => {
      // 낙관적 업데이트
      await queryClient.cancelQueries({ queryKey: projectQueryKeys.detail(id) });

      const previousProject = queryClient.getQueryData<Project>(projectQueryKeys.detail(id));

      if (previousProject) {
        queryClient.setQueryData(projectQueryKeys.detail(id), {
          ...previousProject,
          ...updates,
          updatedAt: new Date().toISOString()
        });
      }

      return { previousProject, id };
    },

    onSuccess: (project, { id }) => {
      // 실제 데이터로 업데이트
      queryClient.setQueryData(projectQueryKeys.detail(id), project);

      // 관련 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() });

      dispatch(addToast({
        type: 'success',
        title: '프로젝트 저장 완료',
        message: '변경사항이 저장되었습니다'
      }));
    },

    onError: (error: Error, { id }, context) => {
      // 롤백
      if (context?.previousProject) {
        queryClient.setQueryData(projectQueryKeys.detail(id), context.previousProject);
      }

      dispatch(addToast({
        type: 'error',
        title: '저장 실패',
        message: error.message || '프로젝트 저장에 실패했습니다'
      }));
    }
  });
}

/**
 * 프로젝트 삭제 뮤테이션 훅
 */
export function useDeleteProject() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,

    onSuccess: (_, id) => {
      // 캐시에서 제거
      queryClient.removeQueries({ queryKey: projectQueryKeys.detail(id) });

      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() });

      dispatch(addToast({
        type: 'success',
        title: '프로젝트 삭제 완료',
        message: '프로젝트가 삭제되었습니다'
      }));
    },

    onError: (error: Error) => {
      dispatch(addToast({
        type: 'error',
        title: '삭제 실패',
        message: error.message || '프로젝트 삭제에 실패했습니다'
      }));
    }
  });
}

/**
 * 프로젝트 상세 쿼리 훅
 */
export function useProject(id?: string) {
  const dispatch = useDispatch();

  return useQuery({
    queryKey: projectQueryKeys.detail(id!),
    queryFn: () => getProject(id!),
    enabled: !!id,

    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 30 * 60 * 1000, // 30분


    // 백그라운드에서 리프레시 시 자동 토스트 비활성화
    refetchOnWindowFocus: false
  });
}

/**
 * 프로젝트 목록 무한 스크롤 쿼리 훅
 */
export function useProjects(filters: ProjectListFilters = {}) {
  return useInfiniteQuery({
    queryKey: projectQueryKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      getProjects({ ...filters, page: pageParam, limit: 20 }),

    initialPageParam: 1,
    getNextPageParam: (lastPage: any) =>
      lastPage?.pagination?.hasNext ? lastPage.pagination.currentPage + 1 : undefined,

    getPreviousPageParam: (firstPage: any) =>
      firstPage?.pagination?.hasPrevious ? firstPage.pagination.currentPage - 1 : undefined,

    staleTime: 60 * 1000, // 1분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

/**
 * 최근 프로젝트 쿼리 훅
 */
export function useRecentProjects(limit: number = 10) {
  return useQuery({
    queryKey: projectQueryKeys.recent(),
    queryFn: () => getRecentProjects(limit),

    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분 (React Query v5에서 cacheTime이 gcTime으로 변경됨)

    // 자주 갱신되는 데이터이므로 백그라운드 리프레시 활성화
    refetchOnWindowFocus: true,
    refetchInterval: 2 * 60 * 1000 // 2분마다 자동 리프레시
  });
}

/**
 * 프로젝트 자동 저장 훅
 */
export function useAutoSaveProject(
  projectId: string | null,
  projectData: Partial<Project>,
  isDirty: boolean,
  enabled: boolean = true
) {
  const updateMutation = useUpdateProject();

  const autoSaveQuery = useQuery({
    queryKey: ['autoSave', projectId, projectData, isDirty],
    queryFn: async () => {
      if (!projectId || !isDirty) {
        return null;
      }

      await updateMutation.mutateAsync({
        id: projectId,
        updates: {
          ...projectData,
          lastAccessedAt: new Date().toISOString()
        }
      });

      return 'saved';
    },
    enabled: enabled && isDirty && !!projectId,
    refetchInterval: 30 * 1000, // 30초마다 자동저장
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: Infinity
  });

  return {
    isAutoSaving: updateMutation.isPending,
    autoSaveError: updateMutation.error,
    lastAutoSave: autoSaveQuery.dataUpdatedAt
  };
}

/**
 * 프로젝트 복제 뮤테이션 훅
 */
export function useDuplicateProject() {
  const createMutation = useCreateProject();

  const duplicateProject = async (originalProject: Project, newTitle?: string) => {
    return createMutation.mutateAsync({
      title: newTitle || `${originalProject.title} (복사본)`,
      description: originalProject.description,
      storyInput: originalProject.storyInput
    });
  };

  return {
    duplicateProject,
    isPending: createMutation.isPending,
    error: createMutation.error
  };
}

/**
 * 프로젝트 캐시 관리 유틸리티
 */
export function useProjectCacheManager() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.lists() }),
    invalidateRecent: () => queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() }),
    invalidateProject: (id: string) =>
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(id) }),
    removeProject: (id: string) =>
      queryClient.removeQueries({ queryKey: projectQueryKeys.detail(id) }),
    prefetchProject: (id: string) =>
      queryClient.prefetchQuery({
        queryKey: projectQueryKeys.detail(id),
        queryFn: () => getProject(id),
        staleTime: 2 * 60 * 1000
      }),
    clearCache: () => queryClient.clear(),
  };
}

/**
 * 프로젝트 통계 쿼리 훅
 */
export function useProjectStats() {
  return useQuery({
    queryKey: [...projectQueryKeys.all, 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          totalProjects: number;
          completedProjects: number;
          recentActivity: number;
          storageUsed: number; // bytes
          collaborationCount: number;
        };
        message: string;
      }>('/api/projects/stats');

      if (!response.success || !response.data) {
        throw new Error('통계를 불러오는데 실패했습니다');
      }

      return response.data;
    },

    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000, // 30분
  });
}