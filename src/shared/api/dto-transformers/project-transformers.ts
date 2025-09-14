/**
 * 프로젝트 관련 DTO 변환 계층
 * API 응답 ↔ 도메인 모델 간 안전한 데이터 변환
 * FSD shared 레이어 - Anti-Corruption Layer 역할
 */

import { StoryInput, StoryStep, Shot, StoryboardShot } from '@/entities/scenario';
import { Project, ProjectMetadata } from '@/features/scenario/hooks/use-project-management';
import { z } from 'zod';

// API 요청/응답 타입 정의
export interface ApiProjectRequest {
  title: string;
  description?: string;
  storyInput: {
    title: string;
    oneLineStory: string;
    toneAndManner: string[];
    genre: string;
    target: string;
    duration: string;
    format: string;
    tempo: string;
    developmentMethod: string;
    developmentIntensity: string;
  };
  steps?: Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    goal: string;
    lengthHint: string;
  }>;
  shots?: Array<{
    id: string;
    stepId: string;
    title: string;
    description: string;
    shotType: string;
    camera: string;
    length: number;
    dialogue?: string;
  }>;
  storyboardShots?: Array<{
    id: string;
    title: string;
    imageUrl?: string;
    index: number;
  }>;
  status?: 'draft' | 'story_complete' | 'shots_complete' | 'storyboard_complete' | 'final';
  isPublic?: boolean;
  tags?: string[];
}

export interface ApiProjectResponse {
  id: string;
  title: string;
  description?: string;
  storyInput: {
    title: string;
    oneLineStory: string;
    toneAndManner: string[];
    genre: string;
    target: string;
    duration: string;
    format: string;
    tempo: string;
    developmentMethod: string;
    developmentIntensity: string;
  };
  steps: Array<{
    id: string;
    title: string;
    summary: string;
    content: string;
    goal: string;
    lengthHint: string;
    order?: number;
  }>;
  shots: Array<{
    id: string;
    stepId: string;
    title: string;
    description: string;
    shotType: string;
    camera: string;
    composition?: string;
    length: number;
    dialogue?: string;
    subtitle?: string;
    transition?: string;
    contiImage?: string;
    insertShots?: Array<{
      id: string;
      purpose: string;
      description: string;
      framing: string;
    }>;
  }>;
  storyboardShots: Array<{
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    prompt?: string;
    shotType?: string;
    camera?: string;
    duration?: number;
    index: number;
  }>;
  status: 'draft' | 'story_complete' | 'shots_complete' | 'storyboard_complete' | 'final';
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  isPublic: boolean;
  tags: string[];
  collaborators?: Array<{
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
    addedAt: string;
  }>;
  metadata?: {
    totalDuration?: number;
    shotCount?: number;
    storyboardCount?: number;
    version?: number;
  };
}

export interface ApiProjectListResponse {
  success: boolean;
  data: {
    projects: Array<{
      id: string;
      title: string;
      description?: string;
      status: ApiProjectResponse['status'];
      updatedAt: string;
      thumbnail?: string;
      tags: string[];
      metadata?: {
        shotCount?: number;
        storyboardCount?: number;
        totalDuration?: number;
      };
    }>;
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  };
  message: string;
}

// 런타임 검증 스키마
const ApiStoryInputSchema = z.object({
  title: z.string().min(1),
  oneLineStory: z.string().min(1),
  toneAndManner: z.array(z.string()),
  genre: z.string(),
  target: z.string(),
  duration: z.string(),
  format: z.string(),
  tempo: z.string(),
  developmentMethod: z.string(),
  developmentIntensity: z.string(),
});

const ApiProjectResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  storyInput: ApiStoryInputSchema,
  steps: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    summary: z.string(),
    content: z.string(),
    goal: z.string(),
    lengthHint: z.string(),
    order: z.number().optional(),
  })),
  shots: z.array(z.object({
    id: z.string().uuid(),
    stepId: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    shotType: z.string(),
    camera: z.string(),
    composition: z.string().optional(),
    length: z.number().positive(),
    dialogue: z.string().optional(),
    subtitle: z.string().optional(),
    transition: z.string().optional(),
    contiImage: z.string().optional(),
    insertShots: z.array(z.object({
      id: z.string().uuid(),
      purpose: z.string(),
      description: z.string(),
      framing: z.string(),
    })).optional(),
  })),
  storyboardShots: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    prompt: z.string().optional(),
    shotType: z.string().optional(),
    camera: z.string().optional(),
    duration: z.number().optional(),
    index: z.number().int().min(0),
  })),
  status: z.enum(['draft', 'story_complete', 'shots_complete', 'storyboard_complete', 'final']),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime().optional(),
  isPublic: z.boolean(),
  tags: z.array(z.string()),
  collaborators: z.array(z.object({
    userId: z.string().uuid(),
    role: z.enum(['viewer', 'editor', 'admin']),
    addedAt: z.string().datetime(),
  })).optional(),
  metadata: z.object({
    totalDuration: z.number().optional(),
    shotCount: z.number().optional(),
    storyboardCount: z.number().optional(),
    version: z.number().optional(),
  }).optional(),
});

/**
 * Project → API 생성 요청 변환
 */
export function transformProjectToApiRequest(project: {
  title: string;
  description?: string;
  storyInput: StoryInput;
  steps?: StoryStep[];
  shots?: Shot[];
  storyboardShots?: StoryboardShot[];
  status?: Project['status'];
  isPublic?: boolean;
  tags?: string[];
}): ApiProjectRequest {
  try {
    if (!project.title?.trim()) {
      throw new Error('프로젝트 제목은 필수입니다');
    }

    if (!project.storyInput) {
      throw new Error('스토리 입력 데이터가 필요합니다');
    }

    return {
      title: project.title.trim(),
      description: project.description?.trim() || undefined,
      storyInput: {
        title: project.storyInput.title,
        oneLineStory: project.storyInput.oneLineStory,
        toneAndManner: project.storyInput.toneAndManner,
        genre: project.storyInput.genre,
        target: project.storyInput.target,
        duration: project.storyInput.duration,
        format: project.storyInput.format,
        tempo: project.storyInput.tempo,
        developmentMethod: project.storyInput.developmentMethod,
        developmentIntensity: project.storyInput.developmentIntensity,
      },
      steps: project.steps?.map(step => ({
        id: step.id,
        title: step.title,
        summary: step.summary,
        content: step.content,
        goal: step.goal,
        lengthHint: step.lengthHint,
      })),
      shots: project.shots?.map(shot => ({
        id: shot.id,
        stepId: shot.stepId,
        title: shot.title,
        description: shot.description,
        shotType: shot.shotType,
        camera: shot.camera,
        length: shot.length,
        dialogue: shot.dialogue,
      })),
      storyboardShots: project.storyboardShots?.map(shot => ({
        id: shot.id,
        title: shot.title,
        imageUrl: shot.imageUrl,
        index: shot.index,
      })),
      status: project.status || 'draft',
      isPublic: project.isPublic || false,
      tags: project.tags || [],
    };
  } catch (error) {
    throw new Error(`프로젝트 요청 데이터 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 응답 → Project 변환
 */
export function transformApiResponseToProject(
  apiResponse: unknown,
  context: string = 'Project API Response'
): Project {
  try {
    const validatedProject = ApiProjectResponseSchema.parse(apiResponse);

    const project: Project = {
      id: validatedProject.id,
      title: validatedProject.title,
      description: validatedProject.description,
      storyInput: {
        title: validatedProject.storyInput.title,
        oneLineStory: validatedProject.storyInput.oneLineStory,
        toneAndManner: validatedProject.storyInput.toneAndManner,
        genre: validatedProject.storyInput.genre,
        target: validatedProject.storyInput.target,
        duration: validatedProject.storyInput.duration,
        format: validatedProject.storyInput.format,
        tempo: validatedProject.storyInput.tempo,
        developmentMethod: validatedProject.storyInput.developmentMethod,
        developmentIntensity: validatedProject.storyInput.developmentIntensity,
      },
      steps: validatedProject.steps.map(step => ({
        id: step.id,
        title: step.title,
        summary: step.summary,
        content: step.content,
        goal: step.goal,
        lengthHint: step.lengthHint,
        isEditing: false, // 클라이언트 상태
      })),
      shots: validatedProject.shots.map(shot => ({
        id: shot.id,
        stepId: shot.stepId,
        title: shot.title,
        description: shot.description,
        shotType: shot.shotType,
        camera: shot.camera,
        composition: shot.composition || '',
        length: shot.length,
        dialogue: shot.dialogue || '',
        subtitle: shot.subtitle || '',
        transition: shot.transition || 'Cut',
        contiImage: shot.contiImage,
        insertShots: shot.insertShots?.map(insertShot => ({
          id: insertShot.id,
          purpose: insertShot.purpose,
          description: insertShot.description,
          framing: insertShot.framing,
        })) || [],
      })),
      storyboardShots: validatedProject.storyboardShots.map(shot => ({
        id: shot.id,
        title: shot.title,
        description: shot.description,
        imageUrl: shot.imageUrl,
        prompt: shot.prompt,
        shotType: shot.shotType,
        camera: shot.camera,
        duration: shot.duration,
        index: shot.index,
      })),
      status: validatedProject.status,
      userId: validatedProject.userId,
      createdAt: validatedProject.createdAt,
      updatedAt: validatedProject.updatedAt,
      lastAccessedAt: validatedProject.lastAccessedAt,
      isPublic: validatedProject.isPublic,
      tags: validatedProject.tags,
      collaborators: validatedProject.collaborators?.map(collaborator => ({
        userId: collaborator.userId,
        role: collaborator.role,
      })),
    };

    return project;

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`${context} 데이터 검증 실패: ${errorDetails}`);
    }

    throw new Error(`${context} 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * API 응답 → ProjectMetadata[] 변환 (목록용)
 */
export function transformApiResponseToProjectMetadata(
  apiResponse: unknown,
  context: string = 'Project List API Response'
): { projects: ProjectMetadata[]; pagination: any } {
  try {
    if (!apiResponse || typeof apiResponse !== 'object') {
      throw new Error('유효하지 않은 API 응답입니다');
    }

    const response = apiResponse as any;

    if (!response.success || !response.data) {
      throw new Error(response.message || '프로젝트 목록을 불러오는데 실패했습니다');
    }

    const projects: ProjectMetadata[] = response.data.projects.map((project: any) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      updatedAt: project.updatedAt,
      thumbnail: project.thumbnail,
      tags: project.tags || [],
    }));

    return {
      projects,
      pagination: response.data.pagination,
    };

  } catch (error) {
    throw new Error(`${context} 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 프로젝트 업데이트 요청 변환
 */
export function transformProjectUpdateToApiRequest(
  updates: Partial<Project>
): Partial<ApiProjectRequest> {
  try {
    const apiUpdates: Partial<ApiProjectRequest> = {};

    if (updates.title !== undefined) {
      if (!updates.title.trim()) {
        throw new Error('프로젝트 제목은 비워둘 수 없습니다');
      }
      apiUpdates.title = updates.title.trim();
    }

    if (updates.description !== undefined) {
      apiUpdates.description = updates.description?.trim() || undefined;
    }

    if (updates.storyInput) {
      apiUpdates.storyInput = {
        title: updates.storyInput.title,
        oneLineStory: updates.storyInput.oneLineStory,
        toneAndManner: updates.storyInput.toneAndManner,
        genre: updates.storyInput.genre,
        target: updates.storyInput.target,
        duration: updates.storyInput.duration,
        format: updates.storyInput.format,
        tempo: updates.storyInput.tempo,
        developmentMethod: updates.storyInput.developmentMethod,
        developmentIntensity: updates.storyInput.developmentIntensity,
      };
    }

    if (updates.steps) {
      apiUpdates.steps = updates.steps.map(step => ({
        id: step.id,
        title: step.title,
        summary: step.summary,
        content: step.content,
        goal: step.goal,
        lengthHint: step.lengthHint,
      }));
    }

    if (updates.shots) {
      apiUpdates.shots = updates.shots.map(shot => ({
        id: shot.id,
        stepId: shot.stepId,
        title: shot.title,
        description: shot.description,
        shotType: shot.shotType,
        camera: shot.camera,
        length: shot.length,
        dialogue: shot.dialogue,
      }));
    }

    if (updates.storyboardShots) {
      apiUpdates.storyboardShots = updates.storyboardShots.map(shot => ({
        id: shot.id,
        title: shot.title,
        imageUrl: shot.imageUrl,
        index: shot.index,
      }));
    }

    if (updates.status !== undefined) {
      apiUpdates.status = updates.status;
    }

    if (updates.isPublic !== undefined) {
      apiUpdates.isPublic = updates.isPublic;
    }

    if (updates.tags !== undefined) {
      apiUpdates.tags = updates.tags;
    }

    return apiUpdates;

  } catch (error) {
    throw new Error(`프로젝트 업데이트 데이터 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 프로젝트 상태 진행률 계산
 */
export function calculateProjectProgress(project: Project): {
  progress: number;
  nextStep: string;
  isComplete: boolean;
} {
  let progress = 0;
  let nextStep = '';
  let isComplete = false;

  // 스토리 입력 완료 (25%)
  if (project.storyInput?.title && project.storyInput?.oneLineStory) {
    progress = 25;
    nextStep = '4단계 스토리 생성';
  }

  // 4단계 스토리 완료 (50%)
  if (project.steps && project.steps.length >= 4 && project.steps.every(step => step.content)) {
    progress = 50;
    nextStep = '12샷 분해';
  }

  // 12샷 분해 완료 (75%)
  if (project.shots && project.shots.length >= 12) {
    progress = 75;
    nextStep = '스토리보드 생성';
  }

  // 스토리보드 완료 (100%)
  if (project.storyboardShots && project.storyboardShots.length >= 12) {
    progress = 100;
    nextStep = '완료됨';
    isComplete = true;
  }

  return { progress, nextStep, isComplete };
}

/**
 * 프로젝트 통계 계산
 */
export function calculateProjectStats(project: Project): {
  totalDuration: number;
  shotCount: number;
  storyboardCount: number;
  completionRate: number;
} {
  const totalDuration = project.shots.reduce((sum, shot) => sum + shot.length, 0);
  const shotCount = project.shots.length;
  const storyboardCount = project.storyboardShots.length;
  const completionRate = calculateProjectProgress(project).progress;

  return {
    totalDuration,
    shotCount,
    storyboardCount,
    completionRate,
  };
}

/**
 * 프로젝트 검색 필터 적용
 */
export function filterProjects(
  projects: ProjectMetadata[],
  filters: {
    search?: string;
    status?: Project['status'];
    tags?: string[];
  }
): ProjectMetadata[] {
  return projects.filter(project => {
    // 검색어 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesTitle = project.title.toLowerCase().includes(searchLower);
      const matchesDescription = project.description?.toLowerCase().includes(searchLower);
      const matchesTags = project.tags.some(tag => tag.toLowerCase().includes(searchLower));

      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false;
      }
    }

    // 상태 필터
    if (filters.status && project.status !== filters.status) {
      return false;
    }

    // 태그 필터
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(filterTag =>
        project.tags.some(projectTag => projectTag.toLowerCase() === filterTag.toLowerCase())
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 프로젝트 정렬
 */
export function sortProjects(
  projects: ProjectMetadata[],
  sortBy: 'updatedAt' | 'createdAt' | 'title' = 'updatedAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): ProjectMetadata[] {
  return [...projects].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'title':
        compareValue = a.title.localeCompare(b.title);
        break;
      case 'createdAt':
      case 'updatedAt':
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        compareValue = dateA - dateB;
        break;
    }

    return sortOrder === 'desc' ? -compareValue : compareValue;
  });
}

/**
 * 프로젝트 에러 변환
 */
export function transformProjectApiError(error: unknown, context: string = 'Project API'): string {
  if (error instanceof Error) {
    if (error.message.includes('project_not_found')) {
      return `${context} - 프로젝트를 찾을 수 없습니다`;
    }

    if (error.message.includes('access_denied')) {
      return `${context} - 프로젝트에 접근할 권한이 없습니다`;
    }

    if (error.message.includes('storage_quota_exceeded')) {
      return `${context} - 저장 용량이 부족합니다. 일부 프로젝트를 삭제해주세요`;
    }

    if (error.message.includes('collaboration_limit_exceeded')) {
      return `${context} - 협업자 수 제한에 도달했습니다`;
    }

    return `${context} - ${error.message}`;
  }

  return `${context} - 알 수 없는 오류가 발생했습니다`;
}