/**
 * RTK Query 기반 프로젝트 관리 서버 상태 관리
 * FSD features 레이어 - 프로젝트 저장/불러오기/관리
 *
 * v2.0 업데이트:
 * - 파이프라인 매니저 통합
 * - ProjectID 기반 상태 관리
 * - 자동 파이프라인 초기화
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { StoryInput, StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { logger } from '@/shared/lib/logger';
import {
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectQuery,
  useGetProjectsQuery,
  useGetRecentProjectsQuery,
  useGetProjectStatsQuery,
  Project,
  ProjectMetadata,
  ProjectListFilters,
  apiSlice
} from '@/shared/api/api-slice';
import { useToast } from '@/shared/lib/hooks/useToast';
import { pipelineManager } from '@/shared/lib/pipeline-manager';
import { selectProjectId } from '@/entities/pipeline/store/pipeline-slice';
import type { RootState } from '@/shared/types/store';

// RTK Query에서 타입을 import하므로 중복 제거
// 필요한 경우에만 re-export
export type { Project, ProjectMetadata, ProjectListFilters } from '@/shared/api/api-slice';

// RTK Query hooks를 사용하므로 API 함수들은 제거

/**
 * 프로젝트 생성 뮤테이션 훅
 * 파이프라인 매니저 통합 버전
 */
export function useCreateProject() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [createProject, { isLoading, error }] = useCreateProjectMutation();

  // 파이프라인 매니저 초기화
  React.useEffect(() => {
    pipelineManager.setDispatch(dispatch);
  }, [dispatch]);

  const createProjectWithPipeline = async (data: {
    title: string;
    description?: string;
    storyInput: StoryInput;
  }) => {
    try {
      logger.info('🎆 새 프로젝트 생성 시작:', {
        title: data.title,
        hasDescription: !!data.description
      });

      // 새 파이프라인 시작
      const newProjectId = pipelineManager.startNewProject();

      // ProjectID가 포함된 데이터로 프로젝트 생성
      const projectData = pipelineManager.injectProjectId(data, newProjectId);

      const project = await createProject(projectData).unwrap();

      toast.success(`"${project.title}" 프로젝트가 생성되었습니다`, '프로젝트 생성 완료');

      logger.info('✅ 프로젝트 생성 완료:', {
        projectId: newProjectId,
        resultId: project.id
      });

      return {
        ...project,
        projectId: newProjectId
      };
    } catch (error: any) {
      toast.error(error.message || '프로젝트 생성에 실패했습니다', '프로젝트 생성 실패');
      throw error;
    }
  };

  return {
    mutateAsync: createProjectWithPipeline,
    mutate: createProjectWithPipeline,
    isLoading,
    error,
    isPending: isLoading
  };
}

/**
 * 프로젝트 업데이트 뮤테이션 훅
 * 파이프라인 매니저 통합 버전
 */
export function useUpdateProject() {
  const toast = useToast();
  const currentProjectId = useSelector((state: RootState) => selectProjectId(state));
  const [updateProject, { isLoading, error }] = useUpdateProjectMutation();

  const updateProjectWithValidation = async (data: {
    id: string;
    updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>;
  }) => {
    try {
      // 현재 파이프라인 ProjectID와 일치하는지 확인
      if (currentProjectId && data.id !== currentProjectId) {
        console.warn('⚠️ ProjectID 불일치:', {
          requestId: data.id,
          currentId: currentProjectId
        });
      }

      logger.info('🔄 프로젝트 업데이트:', {
        projectId: data.id,
        updateKeys: Object.keys(data.updates)
      });

      const project = await updateProject(data).unwrap();

      toast.success('변경사항이 저장되었습니다', '프로젝트 저장 완료');

      return project;
    } catch (error: any) {
      toast.error(error.message || '프로젝트 저장에 실패했습니다', '저장 실패');
      throw error;
    }
  };

  return {
    mutateAsync: updateProjectWithValidation,
    mutate: updateProjectWithValidation,
    isLoading,
    error,
    isPending: isLoading,
    currentProjectId
  };
}

/**
 * 프로젝트 삭제 뮤테이션 훅
 */
export function useDeleteProject() {
  const toast = useToast();
  const [deleteProject, { isLoading, error }] = useDeleteProjectMutation();

  const deleteProjectWithToast = async (id: string) => {
    try {
      await deleteProject(id).unwrap();

      toast.success('프로젝트가 삭제되었습니다', '프로젝트 삭제 완료');
    } catch (error: any) {
      toast.error(error.message || '프로젝트 삭제에 실패했습니다', '삭제 실패');
      throw error;
    }
  };

  return {
    mutateAsync: deleteProjectWithToast,
    mutate: deleteProjectWithToast,
    isLoading,
    error,
    isPending: isLoading
  };
}

/**
 * 프로젝트 상세 쿼리 훅
 */
export function useProject(id?: string) {
  return useGetProjectQuery(id!, {
    skip: !id,
  });
}

/**
 * 프로젝트 목록 쿼리 훅
 * RTK Query는 무한 스크롤을 내장 지원하지 않으므로 페이지네이션 기반으로 대체
 */
export function useProjects(filters: ProjectListFilters & { page: number; limit: number }) {
  return useGetProjectsQuery(filters);
}

/**
 * 최근 프로젝트 쿼리 훅
 */
export function useRecentProjects(limit: number = 10) {
  return useGetRecentProjectsQuery(limit);
}

/**
 * 프로젝트 자동 저장 훅
 * RTK Query 기반으로 useEffect를 사용하여 자동 저장 구현
 */
export function useAutoSaveProject(
  projectId: string | null,
  projectData: Partial<Project>,
  isDirty: boolean,
  enabled: boolean = true
) {
  const updateMutation = useUpdateProject();

  React.useEffect(() => {
    if (!enabled || !isDirty || !projectId) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await updateMutation.mutateAsync({
          id: projectId,
          updates: {
            ...projectData,
            lastAccessedAt: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [enabled, isDirty, projectId, projectData, updateMutation]);

  return {
    isAutoSaving: updateMutation.isPending,
    autoSaveError: updateMutation.error,
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
 * RTK Query 캐시 관리 유틸리티
 */
export function useProjectCacheManager() {
  const dispatch = useDispatch();

  return {
    invalidateAll: () => {
      dispatch(apiSlice.util.invalidateTags(['Project']));
    },
    invalidateProject: (id: string) => {
      dispatch(apiSlice.util.invalidateTags([{ type: 'Project', id }]));
    },
    resetCache: () => {
      dispatch(apiSlice.util.resetApiState());
    },
    prefetchProject: (id: string) => {
      dispatch(apiSlice.util.prefetch('getProject', id));
    },
  };
}

/**
 * 프로젝트 통계 쿼리 훅
 */
export function useProjectStats() {
  return useGetProjectStatsQuery();
}