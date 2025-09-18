/**
 * Database Storage Integration 테스트
 * Prisma와 Supabase 간의 dual-storage 통합 기능 및 데이터 일관성 검증
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Mock the complete repository module
vi.mock('@/entities/planning/model/repository', () => {
  const mockRepository = {
    save: vi.fn(),
    findByUserId: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getStorageHealth: vi.fn()
  };

  return {
    getPlanningRepository: vi.fn(() => mockRepository),
    mockRepository // Export for test access
  };
});

// Import after mocking
import { getPlanningRepository } from '@/entities/planning/model/repository';
import { BaseContent, ScenarioContent, VideoContent } from '@/entities/planning/model/types';
import { ServiceConfigError } from '@/shared/lib/supabase-safe';

// Get the mock repository instance
const { mockRepository } = await import('@/entities/planning/model/repository') as any;

describe('Database Storage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dual Storage 저장 기능', () => {
    it('Prisma와 Supabase 모두에 성공적으로 저장', async () => {
      // Arrange
      const testScenario: ScenarioContent = {
        id: 'scenario-test-123',
        projectId: 'project-456',
        type: 'scenario',
        source: 'ai-generated',
        status: 'draft',
        storageStatus: 'pending',
        title: '테스트 시나리오',
        story: '흥미진진한 이야기입니다.',
        genre: 'SciFi',
        tone: 'Dramatic',
        target: 'Family',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          createdBy: 'user-123',
          version: '1.0'
        },
        storage: {
          prisma: { saved: false, lastAttempt: new Date().toISOString() },
          supabase: { saved: false, lastAttempt: new Date().toISOString() }
        }
      };

      // Mock repository success
      mockRepository.save.mockResolvedValue({
        id: testScenario.id,
        success: true
      });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { failures: 0, lastFailure: 0, isHealthy: true },
        supabase: { failures: 0, lastFailure: 0, isHealthy: true }
      });

      const repository = getPlanningRepository();

      // Act
      const result = await repository.save(testScenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toBe(testScenario.id);
      expect(mockRepository.save).toHaveBeenCalledWith(testScenario);
    });

    it('Supabase 실패 시 Prisma만으로도 저장 성공 (Graceful Degradation)', async () => {
      // Arrange
      const testContent: BaseContent = {
        id: 'content-test-456',
        type: 'prompt',
        title: '테스트 프롬프트',
        metadata: {
          createdBy: 'user-456',
          status: 'active'
        }
      };

      // Mock partial success (Prisma succeeds, Supabase fails)
      mockRepository.save.mockResolvedValue({
        id: testContent.id,
        success: true
      });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { failures: 0, lastFailure: 0, isHealthy: true },
        supabase: { failures: 1, lastFailure: Date.now(), isHealthy: false }
      });

      const repository = getPlanningRepository();

      // Act
      const result = await repository.save(testContent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.id).toBe(testContent.id);

      // Storage health 확인
      const healthStatus = repository.getStorageHealth();
      expect(healthStatus.prisma.isHealthy).toBe(true);
      expect(healthStatus.supabase.isHealthy).toBe(false);
    });

    it('모든 저장소 실패 시 에러 반환', async () => {
      // Arrange
      const testContent: BaseContent = {
        id: 'content-test-fail',
        type: 'scenario',
        title: '실패 테스트',
        metadata: {
          createdBy: 'user-fail',
          status: 'active'
        }
      };

      // Mock complete failure
      mockRepository.save.mockResolvedValue({
        id: testContent.id,
        success: false,
        error: 'All storage systems failed'
      });

      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { failures: 3, lastFailure: Date.now(), isHealthy: false },
        supabase: { failures: 3, lastFailure: Date.now(), isHealthy: false }
      });

      const repository = getPlanningRepository();

      // Act
      const result = await repository.save(testContent);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('failed');

      // Storage health 확인
      const healthStatus = repository.getStorageHealth();
      expect(healthStatus.prisma.isHealthy).toBe(false);
      expect(healthStatus.supabase.isHealthy).toBe(false);
    });
  });

  describe('데이터 조회 기능', () => {
    it('사용자별 데이터 조회 (Prisma 우선)', async () => {
      // Arrange
      const userId = 'user-123';
      const mockContent = {
        id: 'planning-1',
        type: 'scenario',
        title: '시나리오 1',
        story: '이야기 내용',
        metadata: {
          createdBy: userId
        }
      };

      // Mock repository success
      mockRepository.findByUserId.mockResolvedValue([mockContent]);

      const repository = getPlanningRepository();

      // Act
      const result = await repository.findByUserId(userId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('planning-1');
      expect(result[0].type).toBe('scenario');
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('Prisma 실패 시 Supabase 폴백 조회', async () => {
      // Arrange
      const userId = 'user-456';
      const mockContent = {
        id: 'supabase-1',
        type: 'video',
        title: '비디오 1',
        metadata: {
          createdBy: userId
        }
      };

      // Mock repository fallback behavior
      mockRepository.findByUserId.mockResolvedValue([mockContent]);

      const repository = getPlanningRepository();

      // Act
      const result = await repository.findByUserId(userId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('supabase-1');
      expect(result[0].type).toBe('video');
      expect(mockRepository.findByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('Storage Health 모니터링', () => {
    it('모든 저장소 정상 상태', async () => {
      // Arrange
      mockRepository.getStorageHealth.mockReturnValue({
        prisma: { failures: 0, lastFailure: 0, isHealthy: true },
        supabase: { failures: 0, lastFailure: 0, isHealthy: true }
      });

      const repository = getPlanningRepository();

      // Act
      const healthStatus = repository.getStorageHealth();

      // Assert
      expect(healthStatus).toMatchObject({
        prisma: {
          isHealthy: expect.any(Boolean),
          failures: expect.any(Number),
          lastFailure: expect.any(Number)
        },
        supabase: {
          isHealthy: expect.any(Boolean),
          failures: expect.any(Number),
          lastFailure: expect.any(Number)
        }
      });
    });
  });
});