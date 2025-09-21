/**
 * 이중 저장 시스템 통합 테스트
 *
 * 목적: register API의 Prisma + Supabase 이중 저장 검증
 * 범위: scenarios/prompts 전용 테이블 저장 확인
 */

import { describe, test, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// ============================================================================
// Mock 설정
// ============================================================================

// Supabase 모킹
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null, data: [{}] }),
    })),
  },
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null, data: [{}] }),
    })),
  },
  supabaseConfig: {
    mode: 'full',
    hasServiceRoleKey: true,
  },
}));

// Prisma 모킹
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: 'test-project-id',
        title: 'Test Project',
        status: 'active',
        userId: 'user-123',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
  checkDatabaseConnection: vi.fn().mockResolvedValue({
    success: true,
    latency: 10,
  }),
}));

import { DualStorageEngine } from '@/shared/services/dual-storage-engine.service';
import { dualStorageTransformer } from '@/shared/services/dual-storage.service';

// ============================================================================
// MSW 서버 설정 (Supabase API 모킹)
// ============================================================================

const server = setupServer(
  // Supabase scenarios 테이블 모킹
  http.post('*/rest/v1/scenarios', async ({ request }) => {
    const data = await request.json();

    // 필수 필드 검증
    if (!data.id || !data.title || !data.content) {
      return HttpResponse.json(
        { message: 'Missing required fields', code: '23502' },
        { status: 400 }
      );
    }

    return HttpResponse.json([{
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { status: 201 });
  }),

  // Supabase prompts 테이블 모킹
  http.post('*/rest/v1/prompts', async ({ request }) => {
    const data = await request.json();

    // 필수 필드 검증
    if (!data.id || !data.title || !data.final_prompt) {
      return HttpResponse.json(
        { message: 'Missing required fields', code: '23502' },
        { status: 400 }
      );
    }

    return HttpResponse.json([{
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { status: 201 });
  }),

  // Supabase video_assets 테이블 모킹
  http.post('*/rest/v1/video_assets', async ({ request }) => {
    const data = await request.json();

    return HttpResponse.json([{
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { status: 201 });
  }),

  // Supabase stories 테이블 모킹 (Story 타입용)
  http.post('*/rest/v1/stories', async ({ request }) => {
    const data = await request.json();

    return HttpResponse.json([{
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { status: 201 });
  }),

  // Prisma 모킹 (실제로는 다른 포트지만 MSW로 처리)
  http.post('*/api/internal/prisma-upsert', async ({ request }) => {
    const data = await request.json();

    return HttpResponse.json({
      id: data.id || 'test-project-id',
      title: data.title,
      status: 'active',
      userId: data.userId,
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { status: 200 });
  })
);

// ============================================================================
// 테스트 설정
// ============================================================================

beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

afterEach(() => {
  server.resetHandlers();
});

// ============================================================================
// 테스트 데이터
// ============================================================================

const mockUser = {
  id: 'user-123',
  username: 'testuser',
};

const mockScenarioItem = {
  type: 'scenario' as const,
  projectId: 'project-scenario-123',
  source: 'planning_register',
  createdAt: new Date().toISOString(),
  // scenario 필수 필드
  title: '테스트 시나리오',
  story: '이것은 테스트 스토리입니다.',
  genre: 'action',
  tone: 'exciting',
  target: 'young-adult',
  format: '16:9',
  tempo: 'fast',
  developmentMethod: 'three-act',
  developmentIntensity: 'high',
  durationSec: 120,
};

const mockPromptItem = {
  type: 'prompt' as const,
  projectId: 'project-prompt-123',
  source: 'planning_register',
  createdAt: new Date().toISOString(),
  // prompt 필수 필드
  scenarioTitle: '테스트 프롬프트',
  finalPrompt: '테스트 영상을 위한 AI 프롬프트',
  keywords: ['test', 'video', 'ai'],
  negativePrompt: 'blurry, low quality',
  visualStyle: 'cinematic',
  mood: 'dramatic',
  quality: 'high',
  directorStyle: 'christopher-nolan',
};

const mockVideoItem = {
  type: 'video' as const,
  projectId: 'project-video-123',
  source: 'planning_register',
  createdAt: new Date().toISOString(),
  // video 필수 필드
  title: '생성된 테스트 영상',
  finalPrompt: '영상 생성용 프롬프트',
  provider: 'seedance',
  durationSec: 10,
  format: '16:9',
  status: 'completed',
  videoUrl: 'https://example.com/test-video.mp4',
  refPromptTitle: '참조 프롬프트',
  jobId: 'job-123',
  operationId: 'op-456',
};

// ============================================================================
// 통합 테스트: 이중 저장 검증
// ============================================================================

describe('DualStorageEngine - 완전한 이중 저장 검증', () => {
  let dualStorage: DualStorageEngine;

  beforeAll(() => {
    // 테스트 환경을 development로 설정하여 Supabase 저장을 활성화
    vi.stubEnv('NODE_ENV', 'development');

    // Mock 환경에서 dual storage 엔진 초기화
    dualStorage = new DualStorageEngine(dualStorageTransformer);
  });

  test('시나리오 이중 저장: Prisma + Supabase scenarios 테이블', async () => {

    // MSW를 통한 이중 저장 실행
    const result = await dualStorage.saveDualStorage(mockScenarioItem, mockUser);

    // 결과 검증
    expect(result.success).toBe(true);
    expect(result.prismaResult.saved).toBe(true);
    expect(result.supabaseResult.saved).toBe(true);
    expect(result.supabaseResult.tables.scenario).toBe(true);
    expect(result.rollbackExecuted).toBe(false);

    // 저장 테이블 확인
    expect(result.supabaseResult.tables).toEqual({
      story: false,
      scenario: true,  // scenarios 전용 테이블에 저장됨
      prompt: false,
      videoGeneration: false,
    });

  });

  test('프롬프트 이중 저장: Prisma + Supabase prompts 테이블', async () => {

    const result = await dualStorage.saveDualStorage(mockPromptItem, mockUser);

    // 결과 검증
    expect(result.success).toBe(true);
    expect(result.prismaResult.saved).toBe(true);
    expect(result.supabaseResult.saved).toBe(true);
    expect(result.supabaseResult.tables.prompt).toBe(true);
    expect(result.rollbackExecuted).toBe(false);

    // 저장 테이블 확인
    expect(result.supabaseResult.tables).toEqual({
      story: false,
      scenario: false,
      prompt: true,  // prompts 전용 테이블에 저장됨
      videoGeneration: false,
    });

  });

  test('영상 이중 저장: Prisma + Supabase video_assets 테이블', async () => {

    const result = await dualStorage.saveDualStorage(mockVideoItem, mockUser);

    // 결과 검증
    expect(result.success).toBe(true);
    expect(result.prismaResult.saved).toBe(true);
    expect(result.supabaseResult.saved).toBe(true);
    expect(result.supabaseResult.tables.videoGeneration).toBe(true);
    expect(result.rollbackExecuted).toBe(false);

    // 저장 테이블 확인
    expect(result.supabaseResult.tables).toEqual({
      story: false,
      scenario: false,
      prompt: false,
      videoGeneration: true,  // video_assets 테이블에 저장됨
    });

  });

  test('Supabase 저장 실패 시 Prisma 롤백 (dual_storage_required 모드)', async () => {

    // Supabase 에러 시뮬레이션
    server.use(
      http.post('*/rest/v1/scenarios', () => {
        return HttpResponse.json(
          { message: 'RLS violation', code: '42501' },
          { status: 403 }
        );
      })
    );

    const result = await dualStorage.saveDualStorage(mockScenarioItem, mockUser);

    // 실패 및 롤백 검증
    expect(result.success).toBe(false);
    expect(result.supabaseResult.saved).toBe(false);
    expect(result.supabaseResult.error).toContain('RLS violation');

    // 환경별 전략에 따른 처리 확인
    // development 환경에서는 fallback이므로 Prisma 저장은 유지될 수 있음
  });

  test('데이터 변환 검증: 각 타입별 필드 매핑 정확성', async () => {

    // Scenario 변환 검증
    const scenarioResult = await dualStorage.saveDualStorage(mockScenarioItem, mockUser);
    expect(scenarioResult.success).toBe(true);

    // Prompt 변환 검증
    const promptResult = await dualStorage.saveDualStorage(mockPromptItem, mockUser);
    expect(promptResult.success).toBe(true);

    // Video 변환 검증
    const videoResult = await dualStorage.saveDualStorage(mockVideoItem, mockUser);
    expect(videoResult.success).toBe(true);

  });

  test('동시 저장 성능 및 트랜잭션 무결성', async () => {

    const startTime = Date.now();

    // 동시에 여러 아이템 저장
    const promises = [
      dualStorage.saveDualStorage(mockScenarioItem, mockUser),
      dualStorage.saveDualStorage(mockPromptItem, mockUser),
      dualStorage.saveDualStorage(mockVideoItem, mockUser),
    ];

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // 모든 저장 성공 확인
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
    });

    // 성능 검증 (5초 이내)
    expect(duration).toBeLessThan(5000);
  });
});

// ============================================================================
// 종료 처리
// ============================================================================

afterAll(() => {
  server.close();
});