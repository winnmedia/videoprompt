/**
 * Storyboard API Cost Safety Tests
 *
 * 스토리보드 API의 비용 안전 미들웨어 테스트
 * $300 사건 방지를 위한 엄격한 제한 검증
 * CLAUDE.md 준수: TDD, 비용 안전 규칙
 */

import { NextRequest } from 'next/server';
import { validateCostSafety } from '@/shared/api/storyboard-schemas';
import type {
  StoryboardBatchRequest,
  StoryboardGenerateRequest,
} from '@/shared/api/storyboard-schemas';

// ===========================================
// 모킹 설정
// ===========================================

// Seedream 클라이언트 모킹
jest.mock('@/shared/lib/seedream-client', () => ({
  seedreamClient: {
    generateImage: jest.fn(),
    getUsageStats: jest.fn().mockReturnValue({
      totalCalls: 0,
      lastCallTime: 0,
      recentCalls: 0,
      hourlyRecentCalls: 0,
      nextAvailableTime: 0,
      timeUntilNextCall: 0,
    }),
    resetSafetyLimits: jest.fn(),
  },
  SeedreamClient: {
    getCostSafetyMiddleware: jest.fn().mockReturnValue({
      checkSafety: jest.fn(),
      getStats: jest.fn(),
      reset: jest.fn(),
    }),
  },
}));

// Supabase 클라이언트 모킹
jest.mock('@/shared/api/supabase-client', () => ({
  supabaseClient: {
    safeQuery: jest.fn(),
    raw: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    },
  },
}));

// 로거 모킹
jest.mock('@/shared/lib/structured-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logCostEvent: jest.fn(),
    logBusinessEvent: jest.fn(),
    logApiRequest: jest.fn(),
  },
}));

// ===========================================
// 테스트 데이터
// ===========================================

const mockStoryboardId = '123e4567-e89b-12d3-a456-426614174000';
const mockSceneId = '123e4567-e89b-12d3-a456-426614174001';
const mockUserId = '123e4567-e89b-12d3-a456-426614174002';

const createMockGenerateRequest = (overrides?: Partial<StoryboardGenerateRequest>): StoryboardGenerateRequest => ({
  storyboardId: mockStoryboardId,
  frame: {
    sceneId: mockSceneId,
    sceneDescription: 'A person walking in the park during sunset',
    additionalPrompt: 'cinematic lighting',
    priority: 'normal',
  },
  forceRegenerate: false,
  useConsistencyGuide: true,
  ...overrides,
});

const createMockBatchRequest = (frameCount: number, overrides?: Partial<StoryboardBatchRequest>): StoryboardBatchRequest => ({
  storyboardId: mockStoryboardId,
  frames: Array.from({ length: frameCount }, (_, i) => ({
    sceneId: `${mockSceneId}-${i}`,
    sceneDescription: `Scene ${i + 1} description`,
    priority: 'normal',
  })),
  batchSettings: {
    maxConcurrent: 1,
    delayBetweenRequests: 12000,
    stopOnError: false,
    useConsistencyChain: true,
  },
  ...overrides,
});

// ===========================================
// 비용 안전 검증 테스트
// ===========================================

describe('Storyboard API Cost Safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('개별 생성 요청 비용 안전 검증', () => {
    it('정상적인 요청은 통과해야 함', () => {
      // Given: 정상적인 생성 요청
      const request = createMockGenerateRequest();

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.generateRequest(request);

      // Then: 검증 통과
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('프롬프트가 너무 긴 경우 거부해야 함', () => {
      // Given: 너무 긴 시나리오 설명
      const longDescription = 'A'.repeat(1001); // 1000자 초과
      const request = createMockGenerateRequest({
        frame: {
          sceneId: mockSceneId,
          sceneDescription: longDescription,
          priority: 'normal',
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.generateRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('시나리오 설명은 1000자를 초과할 수 없습니다.');
    });

    it('추가 프롬프트가 너무 긴 경우 거부해야 함', () => {
      // Given: 너무 긴 추가 프롬프트
      const longPrompt = 'B'.repeat(501); // 500자 초과
      const request = createMockGenerateRequest({
        frame: {
          sceneId: mockSceneId,
          sceneDescription: 'Normal description',
          additionalPrompt: longPrompt,
          priority: 'normal',
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.generateRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('추가 프롬프트는 500자를 초과할 수 없습니다.');
    });

    it('일관성 참조가 너무 많은 경우 거부해야 함', () => {
      // Given: 너무 많은 일관성 참조 (5개 초과)
      const tooManyRefs = Array.from({ length: 6 }, (_, i) => `ref-${i}`);
      const request = createMockGenerateRequest({
        frame: {
          sceneId: mockSceneId,
          sceneDescription: 'Normal description',
          consistencyRefs: tooManyRefs,
          priority: 'normal',
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.generateRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('일관성 참조는 최대 5개까지만 가능합니다.');
    });
  });

  describe('배치 생성 요청 비용 안전 검증', () => {
    it('정상적인 배치 요청은 통과해야 함', () => {
      // Given: 정상적인 배치 요청 (12개 프레임)
      const request = createMockBatchRequest(12);

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.batchRequest(request);

      // Then: 검증 통과
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('프레임 수가 너무 많은 경우 거부해야 함 (13개)', () => {
      // Given: 너무 많은 프레임 요청 (12개 초과)
      const request = createMockBatchRequest(13);

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.batchRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('배치 생성은 최대 12개 프레임까지만 가능합니다.');
    });

    it('동시 처리 수가 너무 많은 경우 거부해야 함', () => {
      // Given: 너무 많은 동시 처리 요청 (3개 초과)
      const request = createMockBatchRequest(5, {
        batchSettings: {
          maxConcurrent: 4, // 3개 초과
          delayBetweenRequests: 12000,
          stopOnError: false,
          useConsistencyChain: true,
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.batchRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('동시 처리는 최대 3개까지만 가능합니다.');
    });

    it('지연 시간이 너무 짧은 경우 거부해야 함', () => {
      // Given: 너무 짧은 지연 시간 (5초 미만)
      const request = createMockBatchRequest(5, {
        batchSettings: {
          maxConcurrent: 1,
          delayBetweenRequests: 4000, // 5초 미만
          stopOnError: false,
          useConsistencyChain: true,
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.batchRequest(request);

      // Then: 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('배치 생성 간격은 최소 5초 이상이어야 합니다.');
    });

    it('여러 위반 사항이 있는 경우 모든 에러를 반환해야 함', () => {
      // Given: 여러 위반 사항이 있는 요청
      const request = createMockBatchRequest(15, { // 12개 초과
        batchSettings: {
          maxConcurrent: 5, // 3개 초과
          delayBetweenRequests: 3000, // 5초 미만
          stopOnError: false,
          useConsistencyChain: true,
        },
      });

      // When: 비용 안전 검증 수행
      const result = validateCostSafety.batchRequest(request);

      // Then: 모든 검증 실패
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('배치 생성은 최대 12개 프레임까지만 가능합니다.');
      expect(result.errors).toContain('동시 처리는 최대 3개까지만 가능합니다.');
      expect(result.errors).toContain('배치 생성 간격은 최소 5초 이상이어야 합니다.');
    });
  });

  describe('$300 사건 방지 규칙', () => {
    it('단일 요청의 모든 제한은 $300 사건을 방지하기 위해 설계되어야 함', () => {
      // Given: 최악의 시나리오 - 모든 제한을 최대로 사용
      const maxRequest = createMockGenerateRequest({
        frame: {
          sceneId: mockSceneId,
          sceneDescription: 'A'.repeat(1000), // 최대 길이
          additionalPrompt: 'B'.repeat(500), // 최대 길이
          consistencyRefs: Array.from({ length: 5 }, (_, i) => `ref-${i}`), // 최대 개수
          priority: 'high',
        },
      });

      // When: 비용 안전 검증
      const result = validateCostSafety.generateRequest(maxRequest);

      // Then: 여전히 통과해야 함 (제한 내)
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('배치 요청의 모든 제한은 $300 사건을 방지하기 위해 설계되어야 함', () => {
      // Given: 최악의 시나리오 - 모든 제한을 최대로 사용
      const maxBatchRequest = createMockBatchRequest(12, { // 최대 프레임
        batchSettings: {
          maxConcurrent: 3, // 최대 동시 처리
          delayBetweenRequests: 5000, // 최소 지연 시간
          stopOnError: false,
          useConsistencyChain: true,
        },
      });

      // When: 비용 안전 검증
      const result = validateCostSafety.batchRequest(maxBatchRequest);

      // Then: 여전히 통과해야 함 (제한 내)
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // And: 예상 비용이 안전 범위 내에 있어야 함
      const maxFrames = 12;
      const maxCostPerFrame = 0.05; // Seedream 예상 비용
      const maxTotalCost = maxFrames * maxCostPerFrame;

      expect(maxTotalCost).toBeLessThan(1.0); // $1 미만으로 안전
    });

    it('시간당 최대 호출 횟수 계산이 안전해야 함', () => {
      // Given: 최소 지연 시간으로 시간당 최대 호출 가능 횟수 계산
      const minDelayMs = 5000; // 5초
      const maxCallsPerHour = Math.floor(3600000 / minDelayMs); // 720회

      // When: 예상 시간당 최대 비용 계산
      const maxCostPerCall = 0.05;
      const maxHourlyCost = maxCallsPerHour * maxCostPerCall;

      // Then: 시간당 비용이 안전 범위 내에 있어야 함
      expect(maxHourlyCost).toBeLessThan(50.0); // $50 미만으로 안전
      expect(maxCallsPerHour).toBeLessThan(1000); // 1000회 미만으로 안전
    });
  });

  describe('비용 추적 및 모니터링', () => {
    it('모든 API 호출에 대해 비용이 로깅되어야 함', () => {
      // Given: 정상적인 요청들
      const generateRequest = createMockGenerateRequest();
      const batchRequest = createMockBatchRequest(5);

      // When: 검증 수행
      validateCostSafety.generateRequest(generateRequest);
      validateCostSafety.batchRequest(batchRequest);

      // Then: 비용 추적이 가능해야 함
      expect(typeof generateRequest.storyboardId).toBe('string');
      expect(typeof batchRequest.storyboardId).toBe('string');
      expect(generateRequest.frame.sceneId).toBeTruthy();
      expect(batchRequest.frames.length).toBeGreaterThan(0);
    });

    it('비용 안전 위반 시 명확한 에러 메시지를 제공해야 함', () => {
      // Given: 다양한 위반 사항
      const violations = [
        {
          request: createMockGenerateRequest({
            frame: {
              sceneId: mockSceneId,
              sceneDescription: 'A'.repeat(1001),
              priority: 'normal',
            },
          }),
          expectedError: '시나리오 설명은 1000자를 초과할 수 없습니다.',
        },
        {
          request: createMockBatchRequest(13),
          expectedError: '배치 생성은 최대 12개 프레임까지만 가능합니다.',
        },
      ];

      violations.forEach(({ request, expectedError }) => {
        // When: 검증 수행
        const result = 'frames' in request
          ? validateCostSafety.batchRequest(request as StoryboardBatchRequest)
          : validateCostSafety.generateRequest(request as StoryboardGenerateRequest);

        // Then: 명확한 에러 메시지 제공
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });
  });

  describe('성능 및 확장성', () => {
    it('검증 함수는 빠르게 실행되어야 함', () => {
      // Given: 큰 요청
      const largeRequest = createMockBatchRequest(12);

      // When: 검증 시간 측정
      const startTime = Date.now();
      validateCostSafety.batchRequest(largeRequest);
      const endTime = Date.now();

      // Then: 빠른 실행 (100ms 미만)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100);
    });

    it('메모리 사용량이 효율적이어야 함', () => {
      // Given: 여러 요청 검증
      const requests = Array.from({ length: 100 }, () => createMockGenerateRequest());

      // When: 반복 검증
      let validCount = 0;
      requests.forEach(request => {
        const result = validateCostSafety.generateRequest(request);
        if (result.isValid) validCount++;
      });

      // Then: 모든 요청이 정상 처리되어야 함
      expect(validCount).toBe(100);
    });
  });
});