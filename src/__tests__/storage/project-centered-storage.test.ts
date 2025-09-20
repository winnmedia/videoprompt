/**
 * 프로젝트 중심 데이터 저장 테스트 (TDD)
 * Benjamin's Contract-First + Transactional Integrity 원칙
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ProjectCenteredStorage,
  ProjectData,
  ProjectState,
  ProjectMetadata
} from '@/shared/services/project-centered-storage';
import {
  PipelineTestDataFactory
} from '@/shared/contracts/pipeline-integration.contract';

// Mock 의존성들
jest.mock('@/shared/lib/dual-storage-service');
jest.mock('@prisma/client');

// ============================================================================
// 테스트 설정
// ============================================================================

describe('프로젝트 중심 데이터 저장 테스트', () => {
  let storage: ProjectCenteredStorage;
  let mockDualStorage: any;

  beforeEach(() => {
    // Mock 초기화
    mockDualStorage = require('@/shared/lib/dual-storage-service');
    storage = new ProjectCenteredStorage();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // 프로젝트 생성 테스트
  // ============================================================================

  describe('프로젝트 생성', () => {
    it('새로운 프로젝트를 생성할 수 있어야 한다', async () => {
      const projectData: ProjectData = {
        name: '마법 세계 영상 프로젝트',
        description: '판타지 모험 이야기를 담은 영상',
        userId: 'user-123',
        metadata: {
          genre: 'Fantasy',
          targetAudience: 'Young Adults',
          estimatedDuration: 120
        }
      };

      mockDualStorage.createProject.mockResolvedValue({
        success: true,
        data: {
          id: 'project-456',
          ...projectData,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z'
        }
      });

      const result = await storage.createProject(projectData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('project-456');
      expect(result.data?.name).toBe(projectData.name);
      expect(mockDualStorage.createProject).toHaveBeenCalledWith(
        expect.objectContaining(projectData)
      );
    });

    it('프로젝트 생성 실패 시 올바른 에러를 반환해야 한다', async () => {
      const projectData: ProjectData = {
        name: '테스트 프로젝트',
        userId: 'user-123'
      };

      mockDualStorage.createProject.mockRejectedValue(new Error('Database error'));

      const result = await storage.createProject(projectData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('프로젝트 생성 실패');
    });

    it('프로젝트 이름이 중복될 경우 에러를 반환해야 한다', async () => {
      const projectData: ProjectData = {
        name: '중복 프로젝트',
        userId: 'user-123'
      };

      mockDualStorage.createProject.mockRejectedValue(new Error('UNIQUE_CONSTRAINT_VIOLATION'));

      const result = await storage.createProject(projectData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 존재하는 프로젝트 이름');
    });
  });

  // ============================================================================
  // 프로젝트 워크스페이스 테스트
  // ============================================================================

  describe('프로젝트 워크스페이스', () => {
    const projectId = 'project-123';

    it('프로젝트의 모든 데이터를 조회할 수 있어야 한다', async () => {
      const mockProjectData = {
        id: projectId,
        name: '테스트 프로젝트',
        pipeline: {
          story: { id: 'story-1', content: '스토리 내용', completed: true },
          scenario: { id: 'scenario-1', content: '시나리오 내용', completed: true },
          prompt: { id: 'prompt-1', content: '프롬프트 내용', completed: false },
          video: { id: null, completed: false }
        }
      };

      mockDualStorage.getProjectWorkspace.mockResolvedValue({
        success: true,
        data: mockProjectData
      });

      const result = await storage.getProjectWorkspace(projectId);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(projectId);
      expect(result.data?.pipeline.story.completed).toBe(true);
      expect(result.data?.pipeline.prompt.completed).toBe(false);
    });

    it('존재하지 않는 프로젝트 조회 시 404를 반환해야 한다', async () => {
      mockDualStorage.getProjectWorkspace.mockResolvedValue({
        success: false,
        error: 'Project not found'
      });

      const result = await storage.getProjectWorkspace('nonexistent-project');

      expect(result.success).toBe(false);
      expect(result.error).toContain('프로젝트를 찾을 수 없습니다');
    });

    it('프로젝트 워크스페이스를 업데이트할 수 있어야 한다', async () => {
      const updates = {
        name: '업데이트된 프로젝트 이름',
        description: '새로운 설명',
        metadata: {
          genre: 'Drama',
          status: 'in_progress'
        }
      };

      mockDualStorage.updateProject.mockResolvedValue({
        success: true,
        data: {
          id: projectId,
          ...updates,
          updatedAt: '2024-01-15T11:00:00Z'
        }
      });

      const result = await storage.updateProjectWorkspace(projectId, updates);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(updates.name);
      expect(mockDualStorage.updateProject).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining(updates)
      );
    });
  });

  // ============================================================================
  // 파이프라인 데이터 통합 저장 테스트
  // ============================================================================

  describe('파이프라인 데이터 통합 저장', () => {
    const projectId = 'project-123';

    it('스토리 데이터를 프로젝트에 저장할 수 있어야 한다', async () => {
      const storyRequest = PipelineTestDataFactory.createStoryRequest({
        projectId
      });

      mockDualStorage.saveStoryToProject.mockResolvedValue({
        success: true,
        data: {
          storyId: 'story-456',
          projectId,
          saved: true
        }
      });

      const result = await storage.saveStoryToProject(projectId, storyRequest.story);

      expect(result.success).toBe(true);
      expect(result.data?.storyId).toBeTruthy();
      expect(mockDualStorage.saveStoryToProject).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining(storyRequest.story)
      );
    });

    it('시나리오 데이터를 프로젝트에 저장할 수 있어야 한다', async () => {
      const scenarioRequest = PipelineTestDataFactory.createScenarioRequest({
        projectId
      });

      mockDualStorage.saveScenarioToProject.mockResolvedValue({
        success: true,
        data: {
          scenarioId: 'scenario-789',
          projectId,
          saved: true
        }
      });

      const result = await storage.saveScenarioToProject(
        projectId,
        scenarioRequest.scenario,
        '생성된 시나리오 내용'
      );

      expect(result.success).toBe(true);
      expect(result.data?.scenarioId).toBeTruthy();
    });

    it('프롬프트 데이터를 프로젝트에 저장할 수 있어야 한다', async () => {
      const promptRequest = PipelineTestDataFactory.createPromptRequest({
        projectId
      });

      mockDualStorage.savePromptToProject.mockResolvedValue({
        success: true,
        data: {
          promptId: 'prompt-101',
          projectId,
          saved: true
        }
      });

      const result = await storage.savePromptToProject(
        projectId,
        promptRequest.prompt,
        '생성된 최종 프롬프트',
        ['enhanced', 'keywords']
      );

      expect(result.success).toBe(true);
      expect(result.data?.promptId).toBeTruthy();
    });

    it('영상 데이터를 프로젝트에 저장할 수 있어야 한다', async () => {
      const videoRequest = PipelineTestDataFactory.createVideoRequest({
        projectId
      });

      mockDualStorage.saveVideoToProject.mockResolvedValue({
        success: true,
        data: {
          videoId: 'video-202',
          projectId,
          jobId: 'job-12345',
          saved: true
        }
      });

      const result = await storage.saveVideoToProject(
        projectId,
        videoRequest.video,
        'job-12345',
        'queued'
      );

      expect(result.success).toBe(true);
      expect(result.data?.videoId).toBeTruthy();
      expect(result.data?.jobId).toBe('job-12345');
    });
  });

  // ============================================================================
  // 트랜잭션 무결성 테스트
  // ============================================================================

  describe('트랜잭션 무결성', () => {
    const projectId = 'project-123';

    it('파이프라인 전체 데이터를 원자적으로 저장해야 한다', async () => {
      const pipelineData = {
        story: { content: '스토리', title: '제목' },
        scenario: { genre: 'Fantasy', tone: 'Adventure', structure: ['1', '2'], target: 'All' },
        prompt: { visualStyle: 'cinematic', mood: 'epic', quality: 'premium' as const },
        video: { duration: 30, aspectRatio: '16:9' as const, provider: 'seedance' as const }
      };

      mockDualStorage.savePipelineTransaction.mockResolvedValue({
        success: true,
        data: {
          projectId,
          storyId: 'story-1',
          scenarioId: 'scenario-1',
          promptId: 'prompt-1',
          videoId: 'video-1',
          transactionId: 'tx-12345'
        }
      });

      const result = await storage.savePipelineTransaction(projectId, pipelineData);

      expect(result.success).toBe(true);
      expect(result.data?.transactionId).toBeTruthy();
      expect(mockDualStorage.savePipelineTransaction).toHaveBeenCalledWith(
        projectId,
        pipelineData
      );
    });

    it('트랜잭션 실패 시 롤백되어야 한다', async () => {
      const pipelineData = {
        story: { content: '스토리', title: '제목' }
      };

      mockDualStorage.savePipelineTransaction.mockRejectedValue(
        new Error('Transaction failed at scenario step')
      );

      const result = await storage.savePipelineTransaction(projectId, pipelineData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('트랜잭션 실패');
    });

    it('부분 저장된 데이터를 복구할 수 있어야 한다', async () => {
      const transactionId = 'tx-failed-123';

      mockDualStorage.recoverPartialTransaction.mockResolvedValue({
        success: true,
        data: {
          recovered: true,
          partialData: {
            story: { id: 'story-1', completed: true },
            scenario: { id: null, completed: false }
          }
        }
      });

      const result = await storage.recoverPartialTransaction(transactionId);

      expect(result.success).toBe(true);
      expect(result.data?.recovered).toBe(true);
    });
  });

  // ============================================================================
  // 프로젝트 협업 기능 테스트
  // ============================================================================

  describe('프로젝트 협업 기능', () => {
    const projectId = 'project-123';

    it('프로젝트에 협업자를 추가할 수 있어야 한다', async () => {
      const collaborator = {
        userId: 'user-456',
        role: 'editor' as const,
        permissions: ['read', 'write']
      };

      mockDualStorage.addCollaborator.mockResolvedValue({
        success: true,
        data: {
          collaboratorId: 'collab-789',
          projectId,
          ...collaborator
        }
      });

      const result = await storage.addCollaborator(projectId, collaborator);

      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe(collaborator.userId);
      expect(result.data?.role).toBe('editor');
    });

    it('프로젝트 공유 링크를 생성할 수 있어야 한다', async () => {
      const shareSettings = {
        permissions: ['read'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
        password: 'secret123'
      };

      mockDualStorage.createShareLink.mockResolvedValue({
        success: true,
        data: {
          shareToken: 'share-token-456',
          shareUrl: 'https://videoplanet.app/share/share-token-456',
          expiresAt: shareSettings.expiresAt.toISOString()
        }
      });

      const result = await storage.createShareLink(projectId, shareSettings);

      expect(result.success).toBe(true);
      expect(result.data?.shareToken).toBeTruthy();
      expect(result.data?.shareUrl).toContain('share-token-456');
    });

    it('프로젝트 버전 히스토리를 관리할 수 있어야 한다', async () => {
      const versionData = {
        description: '시나리오 업데이트',
        changes: {
          scenario: { updated: true },
          prompt: { updated: false }
        }
      };

      mockDualStorage.createVersion.mockResolvedValue({
        success: true,
        data: {
          versionId: 'version-789',
          projectId,
          version: '1.2.0',
          createdAt: '2024-01-15T12:00:00Z'
        }
      });

      const result = await storage.createVersion(projectId, versionData);

      expect(result.success).toBe(true);
      expect(result.data?.version).toBeTruthy();
    });
  });

  // ============================================================================
  // 성능 및 캐싱 테스트
  // ============================================================================

  describe('성능 및 캐싱', () => {
    const projectId = 'project-123';

    it('자주 접근하는 프로젝트 데이터를 캐싱해야 한다', async () => {
      const mockData = {
        id: projectId,
        name: '캐싱 테스트 프로젝트',
        lastAccessed: new Date().toISOString()
      };

      // 첫 번째 호출
      mockDualStorage.getProjectWorkspace.mockResolvedValueOnce({
        success: true,
        data: mockData
      });

      const result1 = await storage.getProjectWorkspace(projectId);
      expect(result1.success).toBe(true);

      // 두 번째 호출 (캐시에서 가져와야 함)
      const result2 = await storage.getProjectWorkspace(projectId);
      expect(result2.success).toBe(true);

      // 데이터베이스는 한 번만 호출되어야 함
      expect(mockDualStorage.getProjectWorkspace).toHaveBeenCalledTimes(1);
    });

    it('캐시 무효화가 올바르게 작동해야 한다', async () => {
      const projectId = 'project-456';

      // 프로젝트 데이터 조회 (캐싱)
      mockDualStorage.getProjectWorkspace.mockResolvedValue({
        success: true,
        data: { id: projectId, name: '테스트' }
      });

      await storage.getProjectWorkspace(projectId);

      // 프로젝트 업데이트 (캐시 무효화)
      mockDualStorage.updateProject.mockResolvedValue({
        success: true,
        data: { id: projectId, name: '업데이트됨' }
      });

      await storage.updateProjectWorkspace(projectId, { name: '업데이트됨' });

      // 다시 조회 시 새로운 데이터베이스 호출이 발생해야 함
      await storage.getProjectWorkspace(projectId);

      expect(mockDualStorage.getProjectWorkspace).toHaveBeenCalledTimes(2);
    });

    it('대량의 프로젝트 조회가 효율적으로 처리되어야 한다', async () => {
      const userId = 'user-123';
      const mockProjects = Array.from({ length: 50 }, (_, i) => ({
        id: `project-${i}`,
        name: `프로젝트 ${i}`,
        userId
      }));

      mockDualStorage.getUserProjects.mockResolvedValue({
        success: true,
        data: {
          projects: mockProjects,
          total: 50,
          page: 1,
          limit: 20
        }
      });

      const start = performance.now();
      const result = await storage.getUserProjects(userId, { page: 1, limit: 20 });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(result.data?.projects).toHaveLength(50);
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  });

  // ============================================================================
  // 에러 복구 및 일관성 테스트
  // ============================================================================

  describe('에러 복구 및 일관성', () => {
    it('네트워크 오류 시 재시도 메커니즘이 작동해야 한다', async () => {
      const projectData: ProjectData = {
        name: '재시도 테스트',
        userId: 'user-123'
      };

      // 처음 두 번은 실패, 세 번째는 성공
      mockDualStorage.createProject
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          data: { id: 'project-456', ...projectData }
        });

      const result = await storage.createProject(projectData);

      expect(result.success).toBe(true);
      expect(mockDualStorage.createProject).toHaveBeenCalledTimes(3);
    });

    it('데이터 불일치 감지 및 수정이 가능해야 한다', async () => {
      const projectId = 'project-123';

      mockDualStorage.checkDataConsistency.mockResolvedValue({
        success: false,
        inconsistencies: [
          {
            type: 'missing_scenario',
            storyId: 'story-1',
            expected: 'scenario-1',
            actual: null
          }
        ]
      });

      mockDualStorage.repairDataInconsistency.mockResolvedValue({
        success: true,
        repaired: 1
      });

      const checkResult = await storage.checkDataConsistency(projectId);
      expect(checkResult.success).toBe(false);
      expect(checkResult.inconsistencies).toHaveLength(1);

      const repairResult = await storage.repairDataInconsistency(projectId);
      expect(repairResult.success).toBe(true);
    });
  });
});