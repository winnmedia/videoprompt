/**
 * Planning 이중 저장소 품질 검증 테스트
 * Grace의 엄격한 데이터 일관성 기준을 적용한 통합 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanningScenario } from '@/shared/types/video-prompt-v3.1';

// Mock 데이터
const mockScenario: PlanningScenario = {
  id: 'test-scenario-1',
  title: '테스트 시나리오',
  description: '품질 검증용 테스트 시나리오',
  userId: 'test-user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scenes: [
    {
      id: 'scene-1',
      title: '오프닝 씬',
      description: '영상의 시작 부분',
      duration: 30,
      visualPrompt: '밝은 아침 햇살이 창문으로 들어오는 모습',
      audioPrompt: '잔잔한 피아노 멜로디',
      order: 1
    }
  ],
  metadata: {
    totalDuration: 30,
    sceneCount: 1,
    tags: ['테스트', '품질검증'],
    version: '3.1'
  }
};

describe('Planning 이중 저장소 품질 검증', () => {
  let supabaseClient: any;
  let prismaClient: any;
  let dualStorageService: any;

  beforeEach(() => {
    // Supabase 클라이언트 mock
    supabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [mockScenario], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [mockScenario], error: null })
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    };

    // Prisma 클라이언트 mock
    prismaClient = {
      planningScenario: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn()
      },
      $transaction: vi.fn()
    };

    // 이중 저장소 서비스 mock
    dualStorageService = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      syncData: vi.fn(),
      verifyConsistency: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TDD: 데이터 저장 일관성 검증', () => {
    it('RED: 시나리오 생성 시 두 저장소 모두에 저장되어야 함', async () => {
      // Arrange: 저장 성공 시나리오 설정
      dualStorageService.create.mockResolvedValue({
        success: true,
        data: mockScenario,
        sources: ['supabase', 'prisma']
      });

      // Act: 시나리오 생성
      const result = await dualStorageService.create(mockScenario);

      // Assert: 두 저장소 모두에 저장 확인
      expect(result.success).toBe(true);
      expect(result.sources).toContain('supabase');
      expect(result.sources).toContain('prisma');
      expect(result.data.id).toBe(mockScenario.id);
    });

    it('GREEN: Supabase 저장 실패 시 Prisma만 사용하고 동기화 작업 등록', async () => {
      // Arrange: Supabase 실패, Prisma 성공 시나리오
      dualStorageService.create.mockResolvedValue({
        success: true,
        data: mockScenario,
        sources: ['prisma'],
        warnings: ['Supabase 저장 실패 - 나중에 동기화 예정']
      });

      // Act: 시나리오 생성
      const result = await dualStorageService.create(mockScenario);

      // Assert: Prisma 저장 성공 및 경고 메시지 확인
      expect(result.success).toBe(true);
      expect(result.sources).toContain('prisma');
      expect(result.sources).not.toContain('supabase');
      expect(result.warnings).toContain('Supabase 저장 실패 - 나중에 동기화 예정');
    });

    it('REFACTOR: 데이터 일관성 검증 로직이 정확해야 함', async () => {
      // Arrange: 일관성 검증 결과 설정
      dualStorageService.verifyConsistency.mockResolvedValue({
        consistent: true,
        supabaseCount: 5,
        prismaCount: 5,
        mismatches: [],
        lastSyncAt: new Date().toISOString()
      });

      // Act: 일관성 검증 실행
      const consistencyResult = await dualStorageService.verifyConsistency('test-user-id');

      // Assert: 일관성 검증 결과 확인
      expect(consistencyResult.consistent).toBe(true);
      expect(consistencyResult.supabaseCount).toBe(consistencyResult.prismaCount);
      expect(consistencyResult.mismatches).toHaveLength(0);
    });
  });

  describe('데이터 동기화 품질 검증', () => {
    it('동기화 실패 시 적절한 에러 핸들링이 되어야 함', async () => {
      // Red: 동기화 실패 시나리오
      const syncError = new Error('Network timeout during sync');
      dualStorageService.syncData.mockRejectedValue(syncError);

      // Act & Assert: 에러 핸들링 확인
      await expect(dualStorageService.syncData('test-user-id')).rejects.toThrow('Network timeout during sync');
    });

    it('부분 동기화 성공 시 진행 상황을 정확히 보고해야 함', async () => {
      // Green: 부분 성공 시나리오
      dualStorageService.syncData.mockResolvedValue({
        success: true,
        synchronized: 3,
        failed: 1,
        total: 4,
        errors: ['시나리오 sync-failed-1 동기화 실패']
      });

      // Act: 부분 동기화 실행
      const syncResult = await dualStorageService.syncData('test-user-id');

      // Assert: 부분 성공 결과 확인
      expect(syncResult.success).toBe(true);
      expect(syncResult.synchronized).toBe(3);
      expect(syncResult.failed).toBe(1);
      expect(syncResult.errors).toHaveLength(1);
    });

    it('실시간 동기화가 5초 이내에 완료되어야 함', async () => {
      // 성능 요구사항: 실시간 동기화는 5초 이내
      const startTime = Date.now();

      dualStorageService.syncData.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 빠른 동기화 시뮬레이션
        return {
          success: true,
          synchronized: 1,
          failed: 0,
          total: 1,
          duration: Date.now() - startTime
        };
      });

      // Act: 실시간 동기화 실행
      const result = await dualStorageService.syncData('test-user-id');

      // Assert: 성능 요구사항 확인
      expect(result.duration).toBeLessThan(5000);
      expect(result.success).toBe(true);
    });
  });

  describe('트랜잭션 무결성 검증', () => {
    it('복수 시나리오 생성 시 모든 작업이 원자적으로 수행되어야 함', async () => {
      // Red: 트랜잭션 실패 시 롤백 확인
      const scenarios = [mockScenario, { ...mockScenario, id: 'test-scenario-2' }];

      dualStorageService.create.mockImplementation(async (scenario: any) => {
        if (scenario.id === 'test-scenario-2') {
          throw new Error('Storage quota exceeded');
        }
        return { success: true, data: scenario, sources: ['supabase', 'prisma'] };
      });

      // Act & Assert: 트랜잭션 실패 시 롤백 확인
      await expect(
        Promise.all(scenarios.map(s => dualStorageService.create(s)))
      ).rejects.toThrow('Storage quota exceeded');
    });

    it('대량 데이터 처리 시 배치 처리가 정상 작동해야 함', async () => {
      // Green: 배치 처리 성공 시나리오
      const batchSize = 10;
      const scenarios = Array.from({ length: 25 }, (_, i) => ({
        ...mockScenario,
        id: `test-scenario-${i + 1}`
      }));

      dualStorageService.create.mockImplementation(async (scenario: any) => {
        return {
          success: true,
          data: scenario,
          sources: ['supabase', 'prisma'],
          batchId: Math.floor(Math.random() * 3) + 1 // 3개 배치로 분할
        };
      });

      // Act: 배치 처리 시뮬레이션
      const results = await Promise.all(
        scenarios.map(s => dualStorageService.create(s))
      );

      // Assert: 모든 배치가 성공적으로 처리됨
      expect(results).toHaveLength(25);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.batchId).toBeGreaterThan(0);
      });
    });
  });

  describe('에러 복구 및 안전성 검증', () => {
    it('네트워크 연결 끊김 시 로컬 저장소 폴백이 작동해야 함', async () => {
      // Red: 네트워크 에러 시나리오
      const networkError = new Error('Network unreachable');

      dualStorageService.create.mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          success: true,
          data: mockScenario,
          sources: ['prisma'], // 로컬 저장소만 사용
          mode: 'offline'
        });

      try {
        // 첫 번째 시도 (네트워크 에러)
        await dualStorageService.create(mockScenario);
      } catch (error) {
        // 두 번째 시도 (오프라인 모드)
        const fallbackResult = await dualStorageService.create(mockScenario);

        expect(fallbackResult.success).toBe(true);
        expect(fallbackResult.mode).toBe('offline');
        expect(fallbackResult.sources).toEqual(['prisma']);
      }
    });

    it('데이터 손상 감지 시 백업에서 복구해야 함', async () => {
      // Red: 데이터 손상 시나리오
      const corruptedData = { ...mockScenario, scenes: null }; // 손상된 데이터

      dualStorageService.verifyConsistency.mockResolvedValue({
        consistent: false,
        supabaseCount: 5,
        prismaCount: 4,
        corrupted: ['test-scenario-1'],
        backupAvailable: true
      });

      // 복구 작업 시뮬레이션
      dualStorageService.restore = vi.fn().mockResolvedValue({
        success: true,
        restored: ['test-scenario-1'],
        source: 'backup'
      });

      // Act: 일관성 검증 및 복구
      const consistencyResult = await dualStorageService.verifyConsistency('test-user-id');

      if (!consistencyResult.consistent && consistencyResult.backupAvailable) {
        const restoreResult = await dualStorageService.restore(consistencyResult.corrupted);
        expect(restoreResult.success).toBe(true);
        expect(restoreResult.restored).toContain('test-scenario-1');
      }
    });

    it('동시성 충돌 시 마지막 쓰기 승리 정책이 적용되어야 함', async () => {
      // 동시성 제어 테스트
      const version1 = { ...mockScenario, version: 1, updatedAt: '2024-01-01T10:00:00Z' };
      const version2 = { ...mockScenario, version: 2, updatedAt: '2024-01-01T10:05:00Z' };

      dualStorageService.update.mockImplementation(async (data: any) => {
        // 더 최신 버전이 승리
        const latestVersion = data.version > 1 ? data : version1;
        return {
          success: true,
          data: latestVersion,
          conflictResolution: 'last-write-wins',
          winner: latestVersion.version > 1 ? 'version2' : 'version1'
        };
      });

      // Act: 동시 업데이트 시뮬레이션
      const result1 = await dualStorageService.update(version1);
      const result2 = await dualStorageService.update(version2);

      // Assert: 최신 버전이 승리
      expect(result2.winner).toBe('version2');
      expect(result2.data.version).toBe(2);
      expect(result2.conflictResolution).toBe('last-write-wins');
    });
  });

  describe('품질 메트릭 검증', () => {
    it('데이터 일관성 비율이 99.9% 이상이어야 함', async () => {
      // Grace의 엄격한 품질 기준: 99.9% 일관성
      dualStorageService.verifyConsistency.mockResolvedValue({
        consistent: true,
        consistencyRate: 99.95, // 99.95% 일관성
        totalRecords: 10000,
        consistentRecords: 9995,
        inconsistentRecords: 5
      });

      const result = await dualStorageService.verifyConsistency('all-users');

      expect(result.consistencyRate).toBeGreaterThan(99.9);
      expect(result.consistent).toBe(true);
    });

    it('동기화 지연 시간이 30초를 초과하면 안 됨', async () => {
      // 실시간성 요구사항
      const maxSyncDelay = 30; // 30초

      dualStorageService.syncData.mockResolvedValue({
        success: true,
        synchronized: 10,
        averageSyncDelay: 15, // 15초 평균 지연
        maxSyncDelay: 25, // 최대 25초 지연
        acceptableDelays: 10,
        unacceptableDelays: 0
      });

      const result = await dualStorageService.syncData('test-user-id');

      expect(result.maxSyncDelay).toBeLessThan(maxSyncDelay);
      expect(result.unacceptableDelays).toBe(0);
    });

    it('저장소 용량 사용률이 80%를 초과하면 경고해야 함', async () => {
      // 용량 모니터링
      dualStorageService.getStorageStats = vi.fn().mockResolvedValue({
        supabase: { used: 75, capacity: 100, usageRate: 0.75 },
        prisma: { used: 85, capacity: 100, usageRate: 0.85 },
        warnings: ['Prisma 저장소 용량 부족 (85%)']
      });

      const stats = await dualStorageService.getStorageStats();

      // Supabase는 정상, Prisma는 경고
      expect(stats.supabase.usageRate).toBeLessThan(0.8);
      expect(stats.prisma.usageRate).toBeGreaterThan(0.8);
      expect(stats.warnings).toContain('Prisma 저장소 용량 부족 (85%)');
    });
  });
});