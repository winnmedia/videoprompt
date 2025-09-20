/**
 * 프로젝트 중심 데이터 저장소
 * Benjamin's Contract-First + Transactional Integrity Architecture
 *
 * 핵심 원칙:
 * 1. 프로젝트를 최상위 엔티티로 하는 워크스페이스 구조
 * 2. 트랜잭션 무결성 보장
 * 3. 협업 기능 내장
 * 4. 버전 관리 및 히스토리
 * 5. 성능 최적화된 캐싱
 */

import { v4 as uuidv4 } from 'uuid';
import { dualStorageService } from '@/shared/lib/planning-storage.service';
import {
  StoryData,
  ScenarioData,
  PromptData,
  VideoData
} from '@/shared/contracts/pipeline-integration.contract';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 프로젝트 메타데이터
 */
export interface ProjectMetadata {
  genre?: string;
  targetAudience?: string;
  estimatedDuration?: number;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
  tags?: string[];
  [key: string]: any;
}

/**
 * 프로젝트 데이터
 */
export interface ProjectData {
  name: string;
  description?: string;
  userId: string;
  metadata?: ProjectMetadata;
}

/**
 * 프로젝트 상태
 */
export interface ProjectState {
  id: string;
  name: string;
  description?: string;
  userId: string;
  metadata: ProjectMetadata;
  pipeline: {
    story: {
      id: string | null;
      content?: string;
      completed: boolean;
    };
    scenario: {
      id: string | null;
      content?: string;
      completed: boolean;
    };
    prompt: {
      id: string | null;
      content?: string;
      completed: boolean;
    };
    video: {
      id: string | null;
      jobId?: string;
      videoUrl?: string;
      completed: boolean;
    };
  };
  collaborators: ProjectCollaborator[];
  versions: ProjectVersion[];
  createdAt: string;
  updatedAt: string;
  lastAccessed: string;
}

/**
 * 프로젝트 협업자
 */
export interface ProjectCollaborator {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  permissions: string[];
  addedAt: string;
}

/**
 * 프로젝트 버전
 */
export interface ProjectVersion {
  id: string;
  version: string;
  description: string;
  changes: Record<string, any>;
  createdAt: string;
  createdBy: string;
}

/**
 * 공유 링크 설정
 */
export interface ShareLinkSettings {
  permissions: string[];
  expiresAt?: Date;
  password?: string;
  maxUses?: number;
}

/**
 * 서비스 응답 타입
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 데이터 일관성 체크 결과
 */
export interface DataInconsistency {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedData: Record<string, any>;
  suggestedFix?: string;
}

// ============================================================================
// 캐싱 시스템
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ProjectCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5분
  private readonly MAX_CACHE_SIZE = 100;

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 체크
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// 프로젝트 중심 저장소 클래스
// ============================================================================

export class ProjectCenteredStorage {
  private cache = new ProjectCache();
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000; // 1초

  // ============================================================================
  // 프로젝트 CRUD 연산
  // ============================================================================

  /**
   * 새 프로젝트 생성
   */
  async createProject(projectData: ProjectData): Promise<ServiceResponse<ProjectState>> {
    try {
      const projectId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullProjectData = {
        id: projectId,
        ...projectData,
        metadata: {
          status: 'draft' as const,
          ...projectData.metadata
        },
        pipeline: {
          story: { id: null, completed: false },
          scenario: { id: null, completed: false },
          prompt: { id: null, completed: false },
          video: { id: null, completed: false }
        },
        collaborators: [{
          userId: projectData.userId,
          role: 'owner' as const,
          permissions: ['read', 'write', 'admin'],
          addedAt: timestamp
        }],
        versions: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastAccessed: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.createProject(fullProjectData);
      });

      if (!result.success) {
        // 특정 에러 타입 처리
        if (result.error && String(result.error).includes('UNIQUE_CONSTRAINT')) {
          return {
            success: false,
            error: '이미 존재하는 프로젝트 이름입니다.'
          };
        }
        throw new Error(result.error || 'Unknown error');
      }

      // 캐시에 저장
      this.cache.set(`project:${projectId}`, result.data);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('프로젝트 생성 실패:', error);
      return {
        success: false,
        error: `프로젝트 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 프로젝트 워크스페이스 조회
   */
  async getProjectWorkspace(projectId: string): Promise<ServiceResponse<ProjectState>> {
    try {
      // 캐시 확인
      const cached = this.cache.get<ProjectState>(`project:${projectId}`);
      if (cached) {
        // 마지막 접근 시간 업데이트 (백그라운드)
        this.updateLastAccessed(projectId).catch(error => {
          console.warn('마지막 접근 시간 업데이트 실패:', error);
        });

        return {
          success: true,
          data: cached
        };
      }

      const result = await this.retryOperation(async () => {
        return await dualStorageService.getProjectWorkspace(projectId);
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error?.includes('not found') ?
            '프로젝트를 찾을 수 없습니다.' :
            `프로젝트 조회 실패: ${result.error}`
        };
      }

      // 캐시에 저장
      this.cache.set(`project:${projectId}`, result.data);

      // 마지막 접근 시간 업데이트
      await this.updateLastAccessed(projectId);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('프로젝트 워크스페이스 조회 실패:', error);
      return {
        success: false,
        error: `프로젝트 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 프로젝트 워크스페이스 업데이트
   */
  async updateProjectWorkspace(
    projectId: string,
    updates: Partial<ProjectData & { metadata: ProjectMetadata }>
  ): Promise<ServiceResponse<ProjectState>> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.updateProject(projectId, updateData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Update failed');
      }

      // 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('프로젝트 업데이트 실패:', error);
      return {
        success: false,
        error: `프로젝트 업데이트 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 사용자의 프로젝트 목록 조회
   */
  async getUserProjects(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessed';
      sortOrder?: 'asc' | 'desc';
      status?: string;
      search?: string;
    } = {}
  ): Promise<ServiceResponse<{
    projects: ProjectState[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'lastAccessed',
        sortOrder = 'desc',
        status,
        search
      } = options;

      const cacheKey = `user_projects:${userId}:${JSON.stringify(options)}`;
      const cached = this.cache.get<any>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const result = await this.retryOperation(async () => {
        return await dualStorageService.getUserProjects(userId, {
          page,
          limit,
          sortBy,
          sortOrder,
          ...(status && { status }),
          ...(search && { search })
        });
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      // 캐시에 저장 (짧은 TTL)
      this.cache.set(cacheKey, result.data, 60 * 1000); // 1분

      return {
        success: true,
        data: result.data
      };

    } catch (error) {
      console.error('사용자 프로젝트 목록 조회 실패:', error);
      return {
        success: false,
        error: `프로젝트 목록 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================================================
  // 파이프라인 데이터 저장
  // ============================================================================

  /**
   * 스토리를 프로젝트에 저장
   */
  async saveStoryToProject(
    projectId: string,
    storyData: StoryData
  ): Promise<ServiceResponse<{ storyId: string; projectId: string; saved: boolean }>> {
    try {
      const storyId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullStoryData = {
        id: storyId,
        projectId,
        ...storyData,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.saveStoryToProject(projectId, fullStoryData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Story save failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          storyId,
          projectId,
          saved: true
        }
      };

    } catch (error) {
      console.error('스토리 저장 실패:', error);
      return {
        success: false,
        error: `스토리 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 시나리오를 프로젝트에 저장
   */
  async saveScenarioToProject(
    projectId: string,
    scenarioData: ScenarioData,
    generatedScenario: string
  ): Promise<ServiceResponse<{ scenarioId: string; projectId: string; saved: boolean }>> {
    try {
      const scenarioId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullScenarioData = {
        id: scenarioId,
        projectId,
        ...scenarioData,
        generatedScenario,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.saveScenarioToProject(projectId, fullScenarioData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Scenario save failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          scenarioId,
          projectId,
          saved: true
        }
      };

    } catch (error) {
      console.error('시나리오 저장 실패:', error);
      return {
        success: false,
        error: `시나리오 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 프롬프트를 프로젝트에 저장
   */
  async savePromptToProject(
    projectId: string,
    promptData: PromptData,
    finalPrompt: string,
    enhancedKeywords: string[]
  ): Promise<ServiceResponse<{ promptId: string; projectId: string; saved: boolean }>> {
    try {
      const promptId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullPromptData = {
        id: promptId,
        projectId,
        ...promptData,
        finalPrompt,
        enhancedKeywords,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.savePromptToProject(projectId, fullPromptData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Prompt save failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          promptId,
          projectId,
          saved: true
        }
      };

    } catch (error) {
      console.error('프롬프트 저장 실패:', error);
      return {
        success: false,
        error: `프롬프트 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 영상을 프로젝트에 저장
   */
  async saveVideoToProject(
    projectId: string,
    videoData: VideoData,
    jobId: string,
    status: string
  ): Promise<ServiceResponse<{ videoId: string; projectId: string; jobId: string; saved: boolean }>> {
    try {
      const videoId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullVideoData = {
        id: videoId,
        projectId,
        ...videoData,
        jobId,
        status,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.saveVideoToProject(projectId, fullVideoData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Video save failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          videoId,
          projectId,
          jobId,
          saved: true
        }
      };

    } catch (error) {
      console.error('영상 저장 실패:', error);
      return {
        success: false,
        error: `영상 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================================================
  // 트랜잭션 무결성
  // ============================================================================

  /**
   * 파이프라인 전체 데이터를 원자적으로 저장
   */
  async savePipelineTransaction(
    projectId: string,
    pipelineData: {
      story?: StoryData;
      scenario?: ScenarioData & { generatedScenario?: string };
      prompt?: PromptData & { finalPrompt?: string; enhancedKeywords?: string[] };
      video?: VideoData & { jobId?: string; status?: string };
    }
  ): Promise<ServiceResponse<{
    projectId: string;
    storyId?: string;
    scenarioId?: string;
    promptId?: string;
    videoId?: string;
    transactionId: string;
  }>> {
    const transactionId = uuidv4();

    try {
      const result = await this.retryOperation(async () => {
        return await dualStorageService.savePipelineTransaction(projectId, {
          ...pipelineData,
          transactionId
        });
      });

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          ...result.data,
          projectId,
          transactionId
        }
      };

    } catch (error) {
      console.error('파이프라인 트랜잭션 실패:', error);

      // 부분 데이터 롤백 시도
      try {
        await this.rollbackPartialTransaction(transactionId);
      } catch (rollbackError) {
        console.error('롤백 실패:', rollbackError);
      }

      return {
        success: false,
        error: `트랜잭션 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 부분 저장된 트랜잭션 복구
   */
  async recoverPartialTransaction(transactionId: string): Promise<ServiceResponse<{
    recovered: boolean;
    partialData: Record<string, any>;
  }>> {
    try {
      const result = await this.retryOperation(async () => {
        return await dualStorageService.recoverPartialTransaction(transactionId);
      });

      return {
        success: true,
        data: result.data || { recovered: false, partialData: {} }
      };

    } catch (error) {
      console.error('트랜잭션 복구 실패:', error);
      return {
        success: false,
        error: `트랜잭션 복구 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================================================
  // 협업 기능
  // ============================================================================

  /**
   * 프로젝트에 협업자 추가
   */
  async addCollaborator(
    projectId: string,
    collaborator: Omit<ProjectCollaborator, 'addedAt'>
  ): Promise<ServiceResponse<ProjectCollaborator & { collaboratorId: string; projectId: string }>> {
    try {
      const collaboratorId = uuidv4();
      const timestamp = new Date().toISOString();

      const fullCollaboratorData = {
        id: collaboratorId,
        projectId,
        ...collaborator,
        addedAt: timestamp
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.addCollaborator(projectId, fullCollaboratorData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Add collaborator failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          collaboratorId,
          projectId,
          ...collaborator,
          addedAt: timestamp
        }
      };

    } catch (error) {
      console.error('협업자 추가 실패:', error);
      return {
        success: false,
        error: `협업자 추가 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 프로젝트 공유 링크 생성
   */
  async createShareLink(
    projectId: string,
    settings: ShareLinkSettings
  ): Promise<ServiceResponse<{
    shareToken: string;
    shareUrl: string;
    expiresAt?: string;
  }>> {
    try {
      const shareToken = uuidv4();
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://videoplanet.app'}/share/${shareToken}`;

      const shareLinkData = {
        shareToken,
        projectId,
        ...settings,
        expiresAt: settings.expiresAt?.toISOString(),
        createdAt: new Date().toISOString()
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.createShareLink(projectId, shareLinkData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Create share link failed');
      }

      return {
        success: true,
        data: {
          shareToken,
          shareUrl,
          expiresAt: settings.expiresAt?.toISOString()
        }
      };

    } catch (error) {
      console.error('공유 링크 생성 실패:', error);
      return {
        success: false,
        error: `공유 링크 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 프로젝트 버전 생성
   */
  async createVersion(
    projectId: string,
    versionData: {
      description: string;
      changes: Record<string, any>;
    }
  ): Promise<ServiceResponse<{
    versionId: string;
    projectId: string;
    version: string;
    createdAt: string;
  }>> {
    try {
      const versionId = uuidv4();
      const timestamp = new Date().toISOString();

      // 현재 버전 조회하여 다음 버전 번호 계산
      const currentProject = await this.getProjectWorkspace(projectId);
      let version = '1.0.0';

      if (currentProject.success && currentProject.data && currentProject.data.versions && currentProject.data.versions.length > 0) {
        const lastVersion = currentProject.data.versions[currentProject.data.versions.length - 1];
        const [major, minor, patch] = lastVersion.version.split('.').map(Number);
        version = `${major}.${minor}.${patch + 1}`;
      }

      const fullVersionData = {
        id: versionId,
        projectId,
        version,
        ...versionData,
        createdAt: timestamp,
        createdBy: 'current-user' // TODO: 실제 사용자 ID 사용
      };

      const result = await this.retryOperation(async () => {
        return await dualStorageService.createVersion(projectId, fullVersionData);
      });

      if (!result.success) {
        throw new Error(result.error || 'Create version failed');
      }

      // 프로젝트 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          versionId,
          projectId,
          version,
          createdAt: timestamp
        }
      };

    } catch (error) {
      console.error('버전 생성 실패:', error);
      return {
        success: false,
        error: `버전 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================================================
  // 데이터 일관성 및 복구
  // ============================================================================

  /**
   * 데이터 일관성 검사
   */
  async checkDataConsistency(projectId: string): Promise<ServiceResponse<{
    inconsistencies: DataInconsistency[];
  }>> {
    try {
      const result = await this.retryOperation(async () => {
        return await dualStorageService.checkDataConsistency(projectId);
      });

      return {
        success: result.success,
        data: {
          inconsistencies: result.inconsistencies || []
        }
      };

    } catch (error) {
      console.error('데이터 일관성 검사 실패:', error);
      return {
        success: false,
        error: `데이터 일관성 검사 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 데이터 불일치 수정
   */
  async repairDataInconsistency(projectId: string): Promise<ServiceResponse<{
    repaired: number;
  }>> {
    try {
      const result = await this.retryOperation(async () => {
        return await dualStorageService.repairDataInconsistency(projectId);
      });

      // 수정 후 캐시 무효화
      this.cache.invalidate(`project:${projectId}`);

      return {
        success: true,
        data: {
          repaired: result.repaired || 0
        }
      };

    } catch (error) {
      console.error('데이터 불일치 수정 실패:', error);
      return {
        success: false,
        error: `데이터 불일치 수정 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 재시도 메커니즘
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempts: number = this.RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 마지막 시도가 아니면 대기 후 재시도
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * 마지막 접근 시간 업데이트
   */
  private async updateLastAccessed(projectId: string): Promise<void> {
    try {
      await dualStorageService.updateProject(projectId, {
        lastAccessed: new Date().toISOString()
      });
    } catch (error) {
      // 마지막 접근 시간 업데이트 실패는 치명적이지 않음
      console.warn('마지막 접근 시간 업데이트 실패:', error);
    }
  }

  /**
   * 부분 트랜잭션 롤백
   */
  private async rollbackPartialTransaction(transactionId: string): Promise<void> {
    try {
      await dualStorageService.rollbackTransaction(transactionId);
    } catch (error) {
      console.error('트랜잭션 롤백 실패:', error);
      throw error;
    }
  }

  /**
   * 캐시 통계
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
  } {
    // 구현 필요: 캐시 히트율 계산
    return {
      size: this.cache['cache'].size,
      hitRate: 0 // TODO: 실제 히트율 계산
    };
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// 싱글톤 인스턴스
// ============================================================================

export const projectCenteredStorage = new ProjectCenteredStorage();