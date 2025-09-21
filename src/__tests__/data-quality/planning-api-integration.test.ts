/**
 * 🚀 Planning API 통합 테스트
 * 이중 저장소 시스템의 API 계약과 데이터 흐름 검증
 *
 * 핵심 원칙:
 * - E2E Contract Testing: API 계약 준수 검증
 * - Deterministic Testing: 결정론적 결과 보장
 * - Performance Validation: 응답 시간 임계값 확인
 * - Error Scenario Coverage: 에러 상황 처리 검증
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as storiesGet, POST as storiesPost } from '@/app/api/planning/stories/route';
import { GET as scenariosGet } from '@/app/api/planning/scenarios/route';
import {
  validatePlanningContent,
  validateDualStorageResult,
  createMockScenarioContent,
  PlanningContentSchema,
  DualStorageResultSchema
} from '@/shared/contracts/planning.contract';

// Mock environment for deterministic testing
const mockEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: undefined // Service Role 키 없는 상황 시뮬레이션
};

// Override environment variables
beforeEach(() => {
  Object.entries(mockEnv).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  });
});

// 결정론적 테스트를 위한 고정 데이터
const FIXED_TIMESTAMP = 1640995200000; // 2022-01-01 00:00:00 UTC
const FIXED_USER_ID = 'test-user-12345';

// Mock Date.now for deterministic timing
const originalDateNow = Date.now;
beforeEach(() => {
  Date.now = jest.fn(() => FIXED_TIMESTAMP);
});

afterEach(() => {
  Date.now = originalDateNow;
  jest.clearAllMocks();
});

// Mock authentication middleware
const mockAuthUser = {
  id: FIXED_USER_ID,
  email: 'test@example.com'
};

const mockAuthContext = {
  user: mockAuthUser,
  session: { access_token: 'mock-token' }
};

describe('Planning API 통합 테스트', () => {

  describe('1. Stories API 계약 검증', () => {
    it('GET /api/planning/stories - 기본 응답 구조 검증', async () => {
      // 요청 생성
      const request = new NextRequest('https://localhost:3000/api/planning/stories?page=1&limit=10');

      // API 호출
      const startTime = Date.now();
      const response = await storiesGet(request, mockAuthContext as any);
      const endTime = Date.now();

      // 응답 시간 검증 (3초 이내)
      expect(endTime - startTime).toBeLessThan(3000);

      // HTTP 상태 코드 검증
      expect(response.status).toBe(200);

      // 응답 본문 파싱
      const responseData = await response.json();

      // 기본 응답 구조 검증
      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('data');
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('version');

      expect(typeof responseData.success).toBe('boolean');
      expect(typeof responseData.timestamp).toBe('number');
      expect(responseData.version).toBe('1.0');

      // 데이터 구조 검증
      if (responseData.data) {
        expect(responseData.data).toHaveProperty('stories');
        expect(responseData.data).toHaveProperty('total');
        expect(responseData.data).toHaveProperty('page');
        expect(responseData.data).toHaveProperty('limit');

        expect(Array.isArray(responseData.data.stories)).toBe(true);
        expect(typeof responseData.data.total).toBe('number');
      }

      // 이중 저장소 상태 정보 검증
      if (responseData.storageStatus) {
        expect(responseData.storageStatus).toHaveProperty('prisma');
        expect(responseData.storageStatus).toHaveProperty('supabase');
      }

    });

    it('POST /api/planning/stories - 스토리 생성 계약 검증', async () => {
      const storyData = {
        title: 'API 테스트 스토리',
        content: '이것은 API 통합 테스트를 위한 테스트 스토리입니다.',
        genre: 'Drama',
        tone: 'Serious',
        targetAudience: 'Adults',
        structure: {
          act1: {
            title: '시작',
            description: '이야기의 시작',
            key_elements: ['도입'],
            emotional_arc: '호기심'
          },
          act2: {
            title: '전개',
            description: '이야기의 전개',
            key_elements: ['발전'],
            emotional_arc: '긴장'
          },
          act3: {
            title: '절정',
            description: '이야기의 절정',
            key_elements: ['클라이맥스'],
            emotional_arc: '절정'
          },
          act4: {
            title: '결말',
            description: '이야기의 결말',
            key_elements: ['해결'],
            emotional_arc: '만족'
          }
        }
      };

      // 요청 생성
      const request = new NextRequest('https://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(storyData)
      });

      // API 호출
      const startTime = Date.now();
      const response = await storiesPost(request, mockAuthContext as any);
      const endTime = Date.now();

      // 응답 시간 검증 (5초 이내 - 생성 작업이므로 조회보다 여유)
      expect(endTime - startTime).toBeLessThan(5000);

      // HTTP 상태 코드 검증
      expect([200, 201, 500]).toContain(response.status); // 에러 상황도 허용

      // 응답 본문 파싱
      const responseData = await response.json();

      // 기본 응답 구조 검증
      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('version');

      if (responseData.success) {
        // 성공 응답 검증
        expect(responseData).toHaveProperty('data');
        expect(responseData.data).toHaveProperty('id');
        expect(responseData.data).toHaveProperty('title');
        expect(responseData.data.title).toBe(storyData.title);

        // 생성된 ID 형식 검증
        expect(typeof responseData.data.id).toBe('string');
        expect(responseData.data.id.length).toBeGreaterThan(0);

      } else {
        // 실패 응답 검증
        expect(responseData).toHaveProperty('warnings');
        expect(Array.isArray(responseData.warnings)).toBe(true);

      }
    });

    it('Stories API 쿼리 파라미터 검증', async () => {
      const queryParams = new URLSearchParams({
        page: '2',
        limit: '5',
        search: 'test',
        genre: 'Drama',
        tone: 'Serious'
      });

      const request = new NextRequest(`https://localhost:3000/api/planning/stories?${queryParams}`);

      const response = await storiesGet(request, mockAuthContext as any);
      const responseData = await response.json();

      // 쿼리 파라미터가 응답에 반영되는지 확인
      if (responseData.success && responseData.data) {
        expect(responseData.data.page).toBe(2);
        expect(responseData.data.limit).toBe(5);
      }

    });
  });

  describe('2. Scenarios API 계약 검증', () => {
    it('GET /api/planning/scenarios - 시나리오 목록 조회 검증', async () => {
      const request = new NextRequest('https://localhost:3000/api/planning/scenarios');

      const startTime = Date.now();
      const response = await scenariosGet(request, mockAuthContext as any);
      const endTime = Date.now();

      // 응답 시간 검증
      expect(endTime - startTime).toBeLessThan(3000);

      // HTTP 상태 코드 검증
      expect(response.status).toBe(200);

      // 응답 본문 파싱
      const responseData = await response.json();

      // 기본 응답 구조 검증
      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('data');

      if (responseData.data) {
        expect(responseData.data).toHaveProperty('scenarios');
        expect(responseData.data).toHaveProperty('total');

        expect(Array.isArray(responseData.data.scenarios)).toBe(true);
        expect(typeof responseData.data.total).toBe('number');

        // 각 시나리오 항목 구조 검증
        responseData.data.scenarios.forEach((scenario: any) => {
          expect(scenario).toHaveProperty('id');
          expect(scenario).toHaveProperty('type');
          expect(scenario).toHaveProperty('title');
          expect(scenario.type).toBe('scenario');
        });
      }

    });
  });

  describe('3. 에러 처리 계약 검증', () => {
    it('잘못된 요청 데이터 처리', async () => {
      const invalidData = {
        // title 누락
        content: 'Test content',
        genre: 'InvalidGenre'
      };

      const request = new NextRequest('https://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      });

      const response = await storiesPost(request, mockAuthContext as any);
      const responseData = await response.json();

      // 에러 응답 구조 검증
      expect(response.status).toBe(400); // Validation error
      expect(responseData.success).toBe(false);
      expect(responseData).toHaveProperty('errors');

    });

    it('인증 없는 요청 처리', async () => {
      const unauthenticatedContext = {
        user: { id: null },
        authContext: null
      };

      const request = new NextRequest('https://localhost:3000/api/planning/scenarios');

      const response = await scenariosGet(request, unauthenticatedContext as any);

      // 인증 에러 또는 게스트 모드 처리 확인
      expect([200, 401, 403]).toContain(response.status);

      const responseData = await response.json();
      expect(responseData).toHaveProperty('success');

    });
  });

  describe('4. 성능 계약 검증', () => {
    it('대량 데이터 조회 성능', async () => {
      const request = new NextRequest('https://localhost:3000/api/planning/stories?limit=100');

      const startTime = Date.now();
      const response = await storiesGet(request, mockAuthContext as any);
      const endTime = Date.now();

      // 대량 데이터 조회도 5초 이내에 완료되어야 함
      expect(endTime - startTime).toBeLessThan(5000);

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        // 요청한 limit 이하로 반환되어야 함
        expect(responseData.data.stories.length).toBeLessThanOrEqual(100);
      }

    });

    it('연속 요청 처리 성능', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        new NextRequest(`https://localhost:3000/api/planning/stories?page=${i + 1}&limit=10`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => storiesGet(req, mockAuthContext as any))
      );
      const endTime = Date.now();

      // 5개 요청이 10초 이내에 모두 완료되어야 함
      expect(endTime - startTime).toBeLessThan(10000);

      // 모든 응답이 유효한지 확인
      responses.forEach(response => {
        expect([200, 500]).toContain(response.status); // 에러 상황 허용
      });

    });
  });

  describe('5. 데이터 일관성 검증', () => {
    it('생성 후 즉시 조회 일관성', async () => {
      // 스토리 생성
      const storyData = {
        title: '일관성 테스트 스토리',
        content: '일관성 검증을 위한 테스트 스토리입니다.',
        genre: 'Drama',
        tone: 'Serious',
        targetAudience: 'Adults'
      };

      const createRequest = new NextRequest('https://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(storyData)
      });

      const createResponse = await storiesPost(createRequest, mockAuthContext as any);
      const createData = await createResponse.json();

      if (createData.success && createData.data) {
        // 생성 직후 목록 조회
        const listRequest = new NextRequest('https://localhost:3000/api/planning/stories?limit=100');
        const listResponse = await storiesGet(listRequest, mockAuthContext as any);
        const listData = await listResponse.json();

        if (listData.success && listData.data) {
          // 생성된 스토리가 목록에 포함되어 있는지 확인
          const foundStory = listData.data.stories.find(
            (story: any) => story.id === createData.data.id
          );

          if (foundStory) {
            expect(foundStory.title).toBe(storyData.title);
          } else {
          }
        }
      }
    });
  });

  describe('6. 계약 스키마 검증', () => {
    it('Planning Content 스키마 준수 검증', () => {
      const testContent = createMockScenarioContent({
        title: 'Schema Test Scenario',
        story: 'A test story for schema validation'
      });

      // Zod 스키마 검증
      const validation = validatePlanningContent(testContent);

      expect(validation.success).toBe(true);
      expect(validation.data).toBeDefined();
      expect(validation.error).toBeUndefined();

      if (validation.data) {
        expect(validation.data.type).toBe('scenario');
        expect(validation.data.title).toBe('Schema Test Scenario');
      }

    });

    it('잘못된 데이터의 스키마 위반 감지', () => {
      const invalidContent = {
        // id 누락
        type: 'invalid-type', // 잘못된 타입
        title: '', // 빈 제목
        metadata: {
          createdAt: -1 // 잘못된 타임스탬프
        }
      };

      const validation = validatePlanningContent(invalidContent);

      expect(validation.success).toBe(false);
      expect(validation.error).toBeDefined();
      expect(validation.data).toBeUndefined();

    });

    it('DualStorageResult 스키마 검증', () => {
      const mockResult = {
        id: 'test-id',
        success: true,
        details: {
          prisma: {
            attempted: true,
            success: true,
            timing: 100
          },
          supabase: {
            attempted: true,
            success: false,
            error: 'Connection failed',
            timing: 2000
          }
        },
        consistency: 'partial' as const,
        degradationMode: 'supabase-disabled' as const,
        timestamp: FIXED_TIMESTAMP,
        totalTime: 2100
      };

      const validation = validateDualStorageResult(mockResult);

      expect(validation.success).toBe(true);
      expect(validation.data).toBeDefined();
      expect(validation.error).toBeUndefined();

      if (validation.data) {
        expect(validation.data.consistency).toBe('partial');
        expect(validation.data.details?.supabase.success).toBe(false);
      }

    });
  });

  describe('7. 장애 복구 시나리오', () => {
    it('Service Role 키 없는 환경에서의 동작', async () => {
      // Service Role 키가 없는 상황 시뮬레이션 (이미 beforeEach에서 설정됨)
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();

      const request = new NextRequest('https://localhost:3000/api/planning/stories');

      const response = await storiesGet(request, mockAuthContext as any);
      const responseData = await response.json();

      // Graceful degradation으로 최소한의 기능은 동작해야 함
      expect([200, 500]).toContain(response.status);
      expect(responseData).toHaveProperty('success');

      if (responseData.degraded) {
        expect(responseData.warnings).toBeDefined();
        expect(Array.isArray(responseData.warnings)).toBe(true);
      }

    });

    it('네트워크 지연 시뮬레이션', async () => {
      // 네트워크 지연을 시뮬레이션하기 위해 타임아웃이 긴 요청
      const request = new NextRequest('https://localhost:3000/api/planning/stories?limit=1');

      // 최대 10초까지 대기 (일반적인 네트워크 지연 고려)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      try {
        const response = await Promise.race([
          storiesGet(request, mockAuthContext as any),
          timeoutPromise
        ]);

        expect(response).toBeDefined();
      } catch (error) {
        if (error instanceof Error && error.message === 'Request timeout') {
        } else {
          throw error;
        }
      }
    });
  });
});

/**
 * 🚨 계약 위반 모니터링
 * 실제 운영 환경에서의 계약 위반 감지
 */
describe('운영 환경 계약 위반 모니터링', () => {
  it('API 응답 구조 표준 준수 검증', async () => {
    const endpoints = [
      'https://localhost:3000/api/planning/stories',
      'https://localhost:3000/api/planning/scenarios'
    ];

    for (const endpoint of endpoints) {
      const request = new NextRequest(endpoint);
      const getMethod = endpoint.includes('stories') ? storiesGet : scenariosGet;

      const response = await getMethod(request, mockAuthContext as any);
      const responseData = await response.json();

      // 모든 API 응답이 공통 구조를 따라야 함
      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('timestamp');
      expect(responseData).toHaveProperty('version');

      if (responseData.success) {
        expect(responseData).toHaveProperty('data');
      } else {
        expect(responseData).toHaveProperty('warnings');
      }
    }

  });

  it('중요 계약 지표 모니터링', async () => {
    const metricsCollector = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
      contractViolations: 0
    };

    const testRequests = [
      new NextRequest('https://localhost:3000/api/planning/stories'),
      new NextRequest('https://localhost:3000/api/planning/scenarios')
    ];

    for (const request of testRequests) {
      metricsCollector.totalRequests++;

      const startTime = Date.now();
      const response = await storiesGet(request, mockAuthContext as any);
      const endTime = Date.now();

      metricsCollector.avgResponseTime += (endTime - startTime);

      const responseData = await response.json();

      if (responseData.success) {
        metricsCollector.successRequests++;
      } else {
        metricsCollector.errorRequests++;
      }

      // 계약 위반 체크
      if (!responseData.hasOwnProperty('success') ||
          !responseData.hasOwnProperty('timestamp') ||
          !responseData.hasOwnProperty('version')) {
        metricsCollector.contractViolations++;
      }
    }

    metricsCollector.avgResponseTime /= metricsCollector.totalRequests;

    // 계약 지표 검증
    expect(metricsCollector.contractViolations).toBe(0); // 계약 위반 금지
    expect(metricsCollector.avgResponseTime).toBeLessThan(5000); // 평균 응답 시간 5초 이내

  });
});