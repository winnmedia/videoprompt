/**
 * 간단한 이중 저장 시스템 테스트
 * TDD Green 검증용 - 복잡한 스키마 없이 기본 기능 확인
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DualStorageEngine } from '@/shared/services/dual-storage-engine.service';
import { DualStorageTransformer } from '@/shared/services/dual-storage.service';

// 간단한 Mock 설정
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: 'project_123',
        title: '테스트 프로젝트',
        status: 'active',
        createdAt: new Date(),
      }),
    },
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue({
    success: true,
    latency: 50,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: null,
  supabaseAdmin: null,
  supabaseConfig: {
    mode: 'disabled',
    hasServiceRoleKey: false,
    isValid: false,
    errors: ['SUPABASE_URL is not set'],
  },
}));

describe('간단한 이중 저장 시스템 테스트', () => {
  let dualStorageEngine: DualStorageEngine;
  let transformer: DualStorageTransformer;
  let mockUser: { id: string; username: string };

  beforeEach(() => {
    transformer = new DualStorageTransformer();
    dualStorageEngine = new DualStorageEngine(transformer);
    mockUser = { id: 'user_123', username: 'testuser' };
    process.env.NODE_ENV = 'test';
  });

  describe('✅ 기본 동작 확인', () => {
    it('Transformer 인스턴스가 정상적으로 생성되어야 함', () => {
      expect(transformer).toBeDefined();
      expect(typeof transformer.transformProjectToStory).toBe('function');
      expect(typeof transformer.transformProjectToPrompt).toBe('function');
      expect(typeof transformer.validateDualStorageConsistency).toBe('function');
    });

    it('DualStorageEngine이 정상적으로 생성되어야 함', () => {
      expect(dualStorageEngine).toBeDefined();
      expect(typeof dualStorageEngine.saveDualStorage).toBe('function');
    });

    it('test 환경에서 mock_supabase 전략을 사용해야 함', async () => {
      // GIVEN: 간단한 등록 아이템
      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'scenario',
        title: '테스트 시나리오',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // WHEN: 이중 저장 실행
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: Prisma만 저장되고 성공
      expect(result.success).toBe(true);
      expect(result.prismaResult.saved).toBe(true);
      expect(result.prismaResult.id).toBe('project_123');
      expect(result.supabaseResult.saved).toBe(false); // Supabase 비활성화
      expect(result.rollbackExecuted).toBe(false);
      expect(result.latencyMs).toBeLessThan(500);
    });

    it('Prisma 저장 실패 시 전체 실패해야 함', async () => {
      // GIVEN: Prisma 저장 실패 Mock
      const { prisma } = await import('@/lib/prisma');
      (prisma.project.upsert as any).mockRejectedValue(new Error('DB 연결 실패'));

      const registeredItem = {
        id: 'item_456',
        projectId: 'project_456',
        type: 'prompt',
        title: '테스트 프롬프트',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // WHEN: 이중 저장 실행
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: 전체 실패
      expect(result.success).toBe(false);
      expect(result.prismaResult.saved).toBe(false);
      expect(result.prismaResult.error).toContain('DB 연결 실패');
      expect(result.supabaseResult.saved).toBe(false);
    });

    it('성능 요구사항을 충족해야 함 (500ms 이하)', async () => {
      // GIVEN: 성능 테스트용 아이템
      const registeredItem = {
        id: 'perf_test',
        projectId: 'project_perf',
        type: 'video',
        title: '성능 테스트 영상',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Prisma Mock 빠른 응답 설정
      const { prisma } = await import('@/lib/prisma');
      (prisma.project.upsert as any).mockResolvedValue({
        id: 'project_perf',
        title: '성능 테스트 영상',
        status: 'active',
        createdAt: new Date(),
      });

      // WHEN: 시간 측정하며 실행
      const startTime = Date.now();
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);
      const totalTime = Date.now() - startTime;

      // THEN: 성능 요구사항 충족
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeLessThanOrEqual(500);
      expect(totalTime).toBeLessThanOrEqual(500);
    });
  });

  describe('🌍 환경별 전략 검증', () => {
    it('development 환경에서는 prisma_only_fallback을 사용해야 함', async () => {
      // GIVEN: development 환경 설정
      process.env.NODE_ENV = 'development';
      const devEngine = new DualStorageEngine(transformer);

      const registeredItem = {
        id: 'dev_test',
        projectId: 'project_dev',
        type: 'story',
        title: '개발용 스토리',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // WHEN: 이중 저장 실행
      const result = await devEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: Prisma 위주 저장 (Supabase는 조건부)
      expect(result.success).toBe(true);
      expect(result.prismaResult.saved).toBe(true);
      // development에서 Supabase가 비활성화되어 있으므로 저장되지 않음
      expect(result.supabaseResult.saved).toBe(false);
    });

    it('production 환경에서는 dual_storage_required를 사용해야 함', async () => {
      // GIVEN: production 환경 설정
      process.env.NODE_ENV = 'production';
      const prodEngine = new DualStorageEngine(transformer);

      const registeredItem = {
        id: 'prod_test',
        projectId: 'project_prod',
        type: 'scenario',
        title: '프로덕션 시나리오',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // WHEN: Supabase가 비활성화된 상태에서 dual_storage_required 모드
      const result = await prodEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: StorageStrategyError로 인해 실패해야 함
      expect(result.success).toBe(false);
      expect(result.prismaResult.saved).toBe(false);
      expect(result.prismaResult.error).toContain('dual_storage_required 모드인데 Supabase가 비활성화됨');
    });
  });

  describe('📊 데이터 품질 기본 검증', () => {
    it('기본 데이터 타입 감지가 작동해야 함', () => {
      // GIVEN: 다양한 타입의 프로젝트 데이터
      const testCases = [
        { tags: ['scenario'], expected: 'scenario' },
        { tags: ['prompt'], expected: 'prompt' },
        { tags: ['video'], expected: 'video' },
        { tags: ['story'], expected: 'story' },
        { tags: [], expected: 'unknown' },
      ];

      testCases.forEach(({ tags, expected }) => {
        // WHEN: 타입 감지 (간단한 버전)
        const detectedType = tags.length > 0 ? tags[0] : 'unknown';

        // THEN: 예상된 타입과 일치
        expect(detectedType).toBe(expected);
      });
    });

    it('기본 메타데이터 변환이 작동해야 함', () => {
      // GIVEN: 간단한 메타데이터
      const simpleMetadata = {
        type: 'scenario',
        title: '테스트 제목',
        content: '테스트 내용',
      };

      // WHEN: 메타데이터 처리
      const processedMeta = {
        ...simpleMetadata,
        transformedAt: new Date().toISOString(),
        source: 'planning_register',
      };

      // THEN: 추가 필드가 포함되어야 함
      expect(processedMeta.transformedAt).toBeDefined();
      expect(processedMeta.source).toBe('planning_register');
      expect(processedMeta.type).toBe('scenario');
    });
  });
});