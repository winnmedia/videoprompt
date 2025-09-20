/**
 * 🚀 Planning 듀얼 저장 응답 표준화 테스트
 * 표준화된 응답 형식과 데이터 일관성 검증 테스트
 *
 * 테스트 범위:
 * - 표준 응답 스키마 검증
 * - 저장소 상태 정보 포함 여부
 * - 데이터 일관성 검증
 * - 부분 실패 시 degraded 플래그
 * - warnings 배열 포함 여부
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DualPlanningRepository, getPlanningRepository } from '@/entities/planning';
import { BaseContent, ScenarioContent } from '@/entities/planning';
import {
  createSuccessResponse,
  createErrorResponse,
  DualStorageResult,
  StorageStatus,
  validateDataConsistency,
  BasePlanningResponseSchema,
  PlanningRegisterResponseSchema
} from '@/shared/schemas/planning-response.schema';

// 모킹
vi.mock('@/shared/lib/supabase-client');
vi.mock('@/lib/db', () => ({
  prisma: {
    planning: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}));

describe('Planning 듀얼 저장 응답 표준화', () => {
  let repository: DualPlanningRepository;
  let mockContent: ScenarioContent;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = getPlanningRepository();

    mockContent = {
      id: 'test-scenario-123',
      type: 'scenario',
      title: 'Test Scenario',
      story: 'A test story content',
      genre: 'SciFi',
      tone: 'Dramatic',
      target: 'Family',
      metadata: {
        userId: 'user-123',
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('표준 응답 스키마 검증', () => {
    it('성공 응답이 BasePlanningResponseSchema를 준수해야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: true,
        prismaSuccess: true,
        supabaseSuccess: true
      };

      const response = createSuccessResponse(
        { id: 'test-123', title: 'Test', status: 'active' },
        dualStorageResult
      );

      // 스키마 검증
      const validation = BasePlanningResponseSchema.safeParse(response);
      expect(validation.success).toBe(true);

      if (validation.success) {
        expect(validation.data.success).toBe(true);
        expect(validation.data.degraded).toBe(false);
        expect(validation.data.storageStatus).toEqual({
          prisma: 'healthy',
          supabase: 'healthy'
        });
        expect(validation.data.timestamp).toBeTypeOf('number');
        expect(validation.data.version).toBe('1.0');
      }
    });

    it('부분 실패 시 degraded 플래그가 true여야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: true,
        prismaSuccess: true,
        supabaseSuccess: false,
        supabaseError: 'Connection failed'
      };

      const response = createSuccessResponse(
        { id: 'test-123', title: 'Test', status: 'active' },
        dualStorageResult
      );

      expect(response.degraded).toBe(true);
      expect(response.warnings).toContain('Supabase 저장 실패: 데이터가 Prisma에만 저장됨');
      expect(response.storageStatus?.supabase).toBe('failed');
    });

    it('완전 실패 시 에러 응답이 표준을 준수해야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: false,
        error: 'Both storages failed'
      };

      const response = createErrorResponse('저장 실패', dualStorageResult);

      expect(response.success).toBe(false);
      expect(response.warnings).toContain('Both storages failed');
      expect(response.warnings).toContain('저장 실패');
      expect(response.timestamp).toBeTypeOf('number');
    });
  });

  describe('저장소 상태 정보', () => {
    it('건강한 저장소 상태를 올바르게 반영해야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: true,
        prismaSuccess: true,
        supabaseSuccess: true
      };

      const response = createSuccessResponse({}, dualStorageResult);

      expect(response.storageStatus).toEqual({
        prisma: 'healthy',
        supabase: 'healthy'
      });
      expect(response.degraded).toBe(false);
      expect(response.warnings).toHaveLength(0);
    });

    it('저장소 부분 실패 상태를 올바르게 반영해야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: true,
        prismaSuccess: false,
        supabaseSuccess: true,
        prismaError: 'Database connection timeout'
      };

      const response = createSuccessResponse({}, dualStorageResult);

      expect(response.storageStatus).toEqual({
        prisma: 'failed',
        supabase: 'healthy'
      });
      expect(response.degraded).toBe(true);
      expect(response.warnings).toContain('Prisma 저장 실패: 데이터가 Supabase에만 저장됨');
    });

    it('저장소 완전 실패 상태를 올바르게 반영해야 함', () => {
      const dualStorageResult: DualStorageResult = {
        id: 'test-123',
        success: false,
        prismaSuccess: false,
        supabaseSuccess: false,
        error: 'All storages failed'
      };

      const response = createErrorResponse('저장 실패', dualStorageResult);

      expect(response.storageStatus).toEqual({
        prisma: 'failed',
        supabase: 'failed'
      });
      expect(response.warnings).toContain('All storages failed');
    });
  });

  describe('데이터 일관성 검증', () => {
    it('일치하는 데이터에 대해 consistent: true를 반환해야 함', async () => {
      // Prisma와 Supabase 모킹을 동일한 데이터로 설정
      const mockPrismaRepo = {
        findById: vi.fn().mockResolvedValue(mockContent)
      };
      const mockSupabaseRepo = {
        findById: vi.fn().mockResolvedValue(mockContent)
      };

      // Repository의 내부 repo들을 모킹
      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateDataConsistency(mockContent.id);

      expect(result.consistent).toBe(true);
      expect(result.differences).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('데이터 불일치 시 differences와 recommendations를 제공해야 함', async () => {
      const supabaseContent = {
        ...mockContent,
        title: 'Different Title', // 제목 불일치
        metadata: {
          ...mockContent.metadata!,
          status: 'published' // 상태 불일치
        }
      };

      const mockPrismaRepo = {
        findById: vi.fn().mockResolvedValue(mockContent)
      };
      const mockSupabaseRepo = {
        findById: vi.fn().mockResolvedValue(supabaseContent)
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateDataConsistency(mockContent.id);

      expect(result.consistent).toBe(false);
      expect(result.differences.some(d => d.includes('title 불일치'))).toBe(true);
      expect(result.differences.some(d => d.includes('status 불일치'))).toBe(true);
      expect(result.recommendations).toContain(
        '데이터 일관성 복구를 위한 동기화 실행 권장'
      );
    });

    it('한쪽 저장소에만 데이터가 있을 때 적절한 경고를 제공해야 함', async () => {
      const mockPrismaRepo = {
        findById: vi.fn().mockResolvedValue(mockContent)
      };
      const mockSupabaseRepo = {
        findById: vi.fn().mockResolvedValue(null)
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateDataConsistency(mockContent.id);

      expect(result.consistent).toBe(false);
      expect(result.differences).toContain('한쪽 저장소에만 데이터 존재');
      expect(result.recommendations).toContain('누락된 저장소에 데이터 동기화 필요');
      expect(result.prismaData).toEqual(mockContent);
      expect(result.supabaseData).toBeUndefined();
    });

    it('업데이트 시간 차이가 5초 이상일 때 경고를 제공해야 함', async () => {
      const now = Date.now();
      const supabaseContent = {
        ...mockContent,
        metadata: {
          ...mockContent.metadata!,
          updatedAt: now + 10000 // 10초 차이
        }
      };

      const mockPrismaRepo = {
        findById: vi.fn().mockResolvedValue({
          ...mockContent,
          metadata: {
            ...mockContent.metadata!,
            updatedAt: now
          }
        })
      };
      const mockSupabaseRepo = {
        findById: vi.fn().mockResolvedValue(supabaseContent)
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateDataConsistency(mockContent.id);

      expect(result.consistent).toBe(false);
      expect(result.differences.some(d => d.includes('업데이트 시간 불일치: 10000ms 차이'))).toBe(true);
      expect(result.recommendations).toContain('최신 데이터로 동기화 필요');
    });
  });

  describe('사용자별 일관성 일괄 검증', () => {
    it('사용자의 모든 데이터에 대한 일관성 요약을 제공해야 함', async () => {
      const userId = 'user-123';
      const prismaItems = [mockContent];
      const supabaseItems = [
        {
          ...mockContent,
          title: 'Different Title' // 불일치 생성
        }
      ];

      const mockPrismaRepo = {
        findByUserId: vi.fn().mockResolvedValue(prismaItems),
        findById: vi.fn().mockResolvedValue(mockContent)
      };
      const mockSupabaseRepo = {
        findByUserId: vi.fn().mockResolvedValue(supabaseItems),
        findById: vi.fn().mockResolvedValue(supabaseItems[0])
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateUserDataConsistency(userId);

      expect(result.totalItems).toBe(1);
      expect(result.overallConsistent).toBe(false);
      expect(result.inconsistentItems).toHaveLength(1);
      expect(result.summary.dataConflicts).toBe(1);
      expect(result.summary.healthyItems).toBe(0);
    });

    it('누락된 데이터를 올바르게 식별해야 함', async () => {
      const userId = 'user-123';
      const prismaOnlyContent = { ...mockContent, id: 'prisma-only' };
      const supabaseOnlyContent = { ...mockContent, id: 'supabase-only' };

      const mockPrismaRepo = {
        findByUserId: vi.fn().mockResolvedValue([prismaOnlyContent]),
        findById: vi.fn().mockImplementation((id: string) => {
          if (id === 'prisma-only') return Promise.resolve(prismaOnlyContent);
          return Promise.resolve(null);
        })
      };
      const mockSupabaseRepo = {
        findByUserId: vi.fn().mockResolvedValue([supabaseOnlyContent]),
        findById: vi.fn().mockImplementation((id: string) => {
          if (id === 'supabase-only') return Promise.resolve(supabaseOnlyContent);
          return Promise.resolve(null);
        })
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateUserDataConsistency(userId);

      expect(result.totalItems).toBe(2);
      expect(result.overallConsistent).toBe(false);
      expect(result.summary.missingInPrisma).toBe(1);
      expect(result.summary.missingInSupabase).toBe(1);
      expect(result.inconsistentItems).toHaveLength(2);
    });
  });

  describe('스키마 검증 유틸리티', () => {
    it('validateDataConsistency 함수가 올바르게 작동해야 함', () => {
      const prismaData = { id: 'test', title: 'Test', status: 'draft' };
      const supabaseData = { id: 'test', title: 'Test', status: 'draft' };

      const result = validateDataConsistency(prismaData, supabaseData);

      expect(result.consistent).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('PlanningRegisterResponseSchema가 올바르게 검증해야 함', () => {
      const response = {
        success: true,
        data: {
          id: 'test-123',
          type: 'scenario',
          title: 'Test Scenario',
          userId: 'user-123',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        degraded: false,
        warnings: [],
        storageStatus: {
          prisma: 'healthy' as const,
          supabase: 'healthy' as const
        },
        timestamp: Date.now(),
        version: '1.0'
      };

      const validation = PlanningRegisterResponseSchema.safeParse(response);
      expect(validation.success).toBe(true);
    });

    it('잘못된 스키마는 검증에 실패해야 함', () => {
      const invalidResponse = {
        success: true,
        data: {
          id: 'test-123',
          // type 누락
          title: 'Test Scenario'
          // 필수 필드들 누락
        },
        timestamp: Date.now(),
        version: '1.0'
      };

      const validation = PlanningRegisterResponseSchema.safeParse(invalidResponse);
      expect(validation.success).toBe(false);
    });
  });

  describe('성능 및 에러 처리', () => {
    it('일관성 검증 중 에러 발생 시 적절히 처리해야 함', async () => {
      const mockPrismaRepo = {
        findById: vi.fn().mockRejectedValue(new Error('Database error'))
      };
      const mockSupabaseRepo = {
        findById: vi.fn().mockResolvedValue(mockContent)
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const result = await repository.validateDataConsistency(mockContent.id);

      expect(result.consistent).toBe(false);
      expect(result.differences.some(d => d.includes('일관성 검증 실패: Database error'))).toBe(true);
      expect(result.recommendations).toContain('수동 데이터 검증 필요');
    });

    it('대량 데이터 일관성 검증이 적절한 시간 내에 완료되어야 함', async () => {
      const userId = 'user-123';
      const largeDataSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockContent,
        id: `item-${i}`
      }));

      const mockPrismaRepo = {
        findByUserId: vi.fn().mockResolvedValue(largeDataSet),
        findById: vi.fn().mockImplementation((id: string) =>
          Promise.resolve(largeDataSet.find(item => item.id === id))
        )
      };
      const mockSupabaseRepo = {
        findByUserId: vi.fn().mockResolvedValue(largeDataSet),
        findById: vi.fn().mockImplementation((id: string) =>
          Promise.resolve(largeDataSet.find(item => item.id === id))
        )
      };

      (repository as any).prismaRepo = mockPrismaRepo;
      (repository as any).supabaseRepo = mockSupabaseRepo;

      const startTime = Date.now();
      const result = await repository.validateUserDataConsistency(userId);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
      expect(result.totalItems).toBe(100);
      expect(result.overallConsistent).toBe(true);
    });
  });
});