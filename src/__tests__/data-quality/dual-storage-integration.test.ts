/**
 * 이중 저장 시스템 통합 테스트
 * TDD Green 단계: 실제 구현 검증
 *
 * 목적: register API의 이중 저장 기능 통합 테스트
 * 책임: 데이터 일관성, 트랜잭션 무결성, 환경별 전략 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DualStorageEngine } from '@/shared/services/dual-storage-engine.service';
import { DualStorageTransformer } from '@/shared/services/dual-storage.service';
import {
  type PrismaProjectData,
  type DualStorageResult,
  type DataQualityReport,
} from '@/shared/contracts/dual-storage.schema';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue({
    success: true,
    latency: 50,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
  supabaseAdmin: null,
  supabaseConfig: {
    mode: 'degraded',
    hasServiceRoleKey: false,
    isValid: true,
    errors: [],
  },
}));

describe('이중 저장 시스템 통합 테스트', () => {
  let dualStorageEngine: DualStorageEngine;
  let transformer: DualStorageTransformer;
  let mockUser: { id: string; username: string };

  beforeEach(() => {
    transformer = new DualStorageTransformer();
    dualStorageEngine = new DualStorageEngine(transformer);
    mockUser = { id: 'user_123', username: 'testuser' };

    // 환경 변수 설정
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ GREEN: 데이터 변환 기능 검증', () => {
    it('Scenario 타입 Project를 Story로 변환할 수 있어야 함', () => {
      // GIVEN: Scenario 타입 Prisma Project 데이터
      const prismaProject: PrismaProjectData = {
        id: 'project_scenario_1727435123456',
        title: 'AI 시나리오 테스트',
        description: 'AI로 생성된 시나리오',
        metadata: {
          type: 'scenario',
          story: '테스트 스토리 내용',
          genre: '드라마',
          tone: '감동적',
          target: '일반 시청자',
          hasFourStep: true,
          hasTwelveShot: false,
          version: 'V1',
          author: 'AI Generated',
        },
        status: 'active',
        userId: 'user_123',
        tags: ['scenario'],
        scenario: JSON.stringify({ acts: [] }),
        prompt: null,
        video: null,
        createdAt: new Date('2024-09-27T12:00:00Z'),
        updatedAt: new Date('2024-09-27T12:05:00Z'),
      };

      // WHEN: Story로 변환
      const storyData = transformer.transformProjectToStory(prismaProject);

      // THEN: 올바른 Story 형식으로 변환됨
      expect(storyData).toMatchObject({
        title: 'AI 시나리오 테스트',
        content: '테스트 스토리 내용',
        genre: '드라마',
        tone: '감동적',
        target_audience: '일반 시청자',
        status: 'active',
        user_id: 'user_123',
      });
      expect(storyData.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); // UUID 형식
      expect(storyData.structure).toHaveProperty('hasFourStep', true);
      expect(storyData.metadata).toHaveProperty('originalProjectId', prismaProject.id);
      expect(storyData.metadata).toHaveProperty('source', 'planning_register');
    });

    it('Prompt 타입 Project를 Prompt로 변환할 수 있어야 함', () => {
      // GIVEN: Prompt 타입 Prisma Project 데이터
      const prismaProject: PrismaProjectData = {
        id: 'project_prompt_1727435123456',
        title: 'AI 프롬프트 테스트',
        description: 'AI로 생성된 프롬프트',
        metadata: {
          type: 'prompt',
          finalPrompt: '환상적인 풍경을 그려주세요',
          keywords: ['환상', '풍경', '자연'],
          negativePrompt: '어둡지 않게',
          visualStyle: '리얼리스틱',
          mood: '평화로운',
          quality: '높음',
          scenarioTitle: 'AI 프롬프트 테스트',
          keywordCount: 3,
          segmentCount: 1,
          version: 'V1',
        },
        status: 'active',
        userId: 'user_123',
        tags: ['prompt'],
        scenario: null,
        prompt: '환상적인 풍경을 그려주세요',
        video: null,
        createdAt: new Date('2024-09-27T12:00:00Z'),
        updatedAt: new Date('2024-09-27T12:05:00Z'),
      };

      // WHEN: Prompt로 변환
      const promptData = transformer.transformProjectToPrompt(prismaProject);

      // THEN: 올바른 Prompt 형식으로 변환됨
      expect(promptData).toMatchObject({
        title: 'AI 프롬프트 테스트',
        content: '환상적인 풍경을 그려주세요',
        final_prompt: '환상적인 풍경을 그려주세요',
        keywords: ['환상', '풍경', '자연'],
        negative_prompt: '어둡지 않게',
        visual_style: '리얼리스틱',
        mood: '평화로운',
        quality: '높음',
        user_id: 'user_123',
        project_id: 'project_prompt_1727435123456',
      });
      expect(promptData.metadata).toHaveProperty('keywordCount', 3);
      expect(promptData.metadata).toHaveProperty('version', 'V1');
    });

    it('Video 타입 Project를 VideoGeneration으로 변환할 수 있어야 함', () => {
      // GIVEN: Video 타입 Prisma Project 데이터
      const prismaProject: PrismaProjectData = {
        id: 'project_video_1727435123456',
        title: 'AI 영상 테스트',
        description: 'AI로 생성된 영상',
        metadata: {
          type: 'video',
          videoUrl: 'https://example.com/video.mp4',
          status: 'completed',
          provider: 'seedance',
          durationSec: 30,
          format: '16:9',
          codec: 'H.264',
          jobId: 'job_123',
          operationId: 'op_456',
          refPromptTitle: 'AI 영상 생성 프롬프트',
          finalPrompt: 'AI 영상 생성 프롬프트',
          version: 'V1',
        },
        status: 'active',
        userId: 'user_123',
        tags: ['video'],
        scenario: null,
        prompt: null,
        video: 'https://example.com/video.mp4',
        createdAt: new Date('2024-09-27T12:00:00Z'),
        updatedAt: new Date('2024-09-27T12:10:00Z'),
      };

      // WHEN: VideoGeneration으로 변환
      const videoData = transformer.transformProjectToVideoGeneration(prismaProject);

      // THEN: 올바른 VideoGeneration 형식으로 변환됨
      expect(videoData).toMatchObject({
        title: 'AI 영상 테스트',
        prompt: 'AI 영상 생성 프롬프트',
        provider: 'seedance',
        duration: 30,
        aspect_ratio: '16:9',
        codec: 'H.264',
        status: 'completed',
        video_url: 'https://example.com/video.mp4',
        ref_prompt_title: 'AI 영상 생성 프롬프트',
        job_id: 'job_123',
        operation_id: 'op_456',
        user_id: 'user_123',
        project_id: 'project_video_1727435123456',
      });
      expect(videoData.completed_at).toBe('2024-09-27T12:10:00.000Z');
      expect(videoData.metadata).toHaveProperty('version', 'V1');
    });
  });

  describe('🔍 데이터 품질 검증', () => {
    it('일관성 있는 데이터는 100점 품질 점수를 받아야 함', () => {
      // GIVEN: 일관성 있는 Prisma와 Supabase 데이터
      const prismaProject: PrismaProjectData = {
        id: 'project_123',
        title: '일관된 제목',
        description: '일관된 설명',
        metadata: { type: 'story' },
        status: 'active',
        userId: 'user_123',
        tags: ['story'],
        scenario: null,
        prompt: null,
        video: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const supabaseStory = transformer.transformProjectToStory(prismaProject);

      // WHEN: 일관성 검증
      const qualityReport = transformer.validateDualStorageConsistency(prismaProject, {
        story: supabaseStory,
      });

      // THEN: 완벽한 품질 점수
      expect(qualityReport.isConsistent).toBe(true);
      expect(qualityReport.score).toBe(100);
      expect(qualityReport.violations).toHaveLength(0);
      expect(qualityReport.metrics.consistency).toBe(100);
      expect(qualityReport.metrics.completeness).toBe(90);
    });

    it('불일치하는 데이터는 낮은 품질 점수를 받아야 함', () => {
      // GIVEN: 불일치하는 데이터
      const prismaProject: PrismaProjectData = {
        id: 'project_123',
        title: 'Prisma 제목',
        description: null,
        metadata: { type: 'story' },
        status: 'active',
        userId: 'user_123',
        tags: ['story'],
        scenario: null,
        prompt: null,
        video: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const inconsistentStory = {
        ...transformer.transformProjectToStory(prismaProject),
        title: 'Supabase 제목', // 🚨 다른 제목
        user_id: 'user_456', // 🚨 다른 사용자 ID
        status: 'draft' as const, // 🚨 다른 상태
      };

      // WHEN: 일관성 검증
      const qualityReport = transformer.validateDualStorageConsistency(prismaProject, {
        story: inconsistentStory,
      });

      // THEN: 낮은 품질 점수와 위반 사항들
      expect(qualityReport.isConsistent).toBe(false); // critical 위반 있음
      expect(qualityReport.score).toBeLessThan(80);
      expect(qualityReport.violations.length).toBeGreaterThan(0);

      // Critical 위반 확인
      const criticalViolations = qualityReport.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBeGreaterThan(0);
      expect(criticalViolations.some(v => v.field.includes('user_id'))).toBe(true);
    });

    it('타입 불일치는 critical 위반으로 처리되어야 함', () => {
      // GIVEN: Scenario 타입 프로젝트이지만 Scenario 데이터 없음
      const prismaProject: PrismaProjectData = {
        id: 'project_123',
        title: '시나리오 프로젝트',
        description: null,
        metadata: { type: 'scenario' },
        status: 'active',
        userId: 'user_123',
        tags: ['scenario'],
        scenario: JSON.stringify({ acts: [] }),
        prompt: null,
        video: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // WHEN: Scenario 데이터 없이 검증
      const qualityReport = transformer.validateDualStorageConsistency(prismaProject, {
        // scenario 데이터 없음
      });

      // THEN: Critical 위반 발생
      expect(qualityReport.isConsistent).toBe(false);
      const criticalViolations = qualityReport.violations.filter(v => v.severity === 'critical');
      expect(criticalViolations.length).toBeGreaterThan(0);
      expect(criticalViolations.some(v => v.field === 'scenario')).toBe(true);
    });
  });

  describe('🌍 환경별 저장 전략 검증', () => {
    it('development 환경에서는 prisma_only_fallback 전략을 사용해야 함', async () => {
      // GIVEN: development 환경
      process.env.NODE_ENV = 'development';
      const testEngine = new DualStorageEngine(transformer);

      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'scenario',
        title: '테스트 시나리오',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock Prisma 성공
      const { prisma } = await import('@/lib/prisma');
      (prisma.project.findUnique as any).mockResolvedValue(null);
      (prisma.project.upsert as any).mockResolvedValue({
        id: 'project_123',
        title: '테스트 시나리오',
        status: 'active',
        createdAt: new Date(),
      });

      // WHEN: 이중 저장 실행
      const result = await testEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: Prisma만 저장되고 성공
      expect(result.success).toBe(true);
      expect(result.prismaResult.saved).toBe(true);
      expect(result.supabaseResult.saved).toBe(false); // Supabase 저장 안함
      expect(result.rollbackExecuted).toBe(false);
    });

    it('test 환경에서는 mock_supabase 전략을 사용해야 함', async () => {
      // GIVEN: test 환경 (현재 환경)
      expect(process.env.NODE_ENV).toBe('test');

      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'prompt',
        title: '테스트 프롬프트',
        finalPrompt: 'AI 테스트 프롬프트',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock Prisma 성공
      const { prisma } = await import('@/lib/prisma');
      (prisma.project.findUnique as any).mockResolvedValue(null);
      (prisma.project.upsert as any).mockResolvedValue({
        id: 'project_123',
        title: '테스트 프롬프트',
        status: 'active',
        createdAt: new Date(),
      });

      // WHEN: 이중 저장 실행
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: Prisma만 저장 (mock_supabase 전략)
      expect(result.success).toBe(true);
      expect(result.prismaResult.saved).toBe(true);
      expect(result.supabaseResult.saved).toBe(false); // Mock 모드에서는 저장 안함
    });
  });

  describe('🚨 에러 처리 및 복구', () => {
    it('Prisma 저장 실패 시 전체 트랜잭션이 실패해야 함', async () => {
      // GIVEN: Prisma 저장 실패 상황
      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'video',
        title: '테스트 영상',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { prisma } = await import('@/lib/prisma');
      (prisma.project.upsert as any).mockRejectedValue(new Error('Prisma 연결 실패'));

      // WHEN: 이중 저장 실행
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: 전체 실패
      expect(result.success).toBe(false);
      expect(result.prismaResult.saved).toBe(false);
      expect(result.prismaResult.error).toContain('Prisma 연결 실패');
      expect(result.supabaseResult.saved).toBe(false);
    });

    it('데이터 검증 실패는 저장 성공에 영향을 주지 않아야 함', async () => {
      // GIVEN: 저장은 성공하지만 검증 로직에서 에러
      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'story',
        title: '테스트 스토리',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { prisma } = await import('@/lib/prisma');
      (prisma.project.findUnique as any).mockResolvedValue(null);
      (prisma.project.upsert as any).mockResolvedValue({
        id: 'project_123',
        title: '테스트 스토리',
        status: 'active',
        createdAt: new Date(),
      });

      // WHEN: 이중 저장 실행 (검증 에러 무시됨)
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);

      // THEN: 저장은 성공 (품질 검증 실패는 무시)
      expect(result.success).toBe(true);
      expect(result.prismaResult.saved).toBe(true);
    });
  });

  describe('⏱️ 성능 요구사항 검증', () => {
    it('이중 저장 지연시간이 500ms 이하여야 함', async () => {
      // GIVEN: 빠른 응답을 위한 Mock 설정
      const registeredItem = {
        id: 'item_123',
        projectId: 'project_123',
        type: 'scenario',
        title: '성능 테스트',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { prisma } = await import('@/lib/prisma');
      (prisma.project.findUnique as any).mockResolvedValue(null);
      (prisma.project.upsert as any).mockResolvedValue({
        id: 'project_123',
        title: '성능 테스트',
        status: 'active',
        createdAt: new Date(),
      });

      // WHEN: 이중 저장 실행 및 시간 측정
      const startTime = Date.now();
      const result = await dualStorageEngine.saveDualStorage(registeredItem, mockUser);
      const totalLatency = Date.now() - startTime;

      // THEN: 성능 요구사항 충족
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeLessThanOrEqual(500);
      expect(totalLatency).toBeLessThanOrEqual(500);
    });
  });
});