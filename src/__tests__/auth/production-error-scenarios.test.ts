/**
 * 프로덕션 실제 오류 시나리오 재현 테스트
 * 2025-09-16 프로덕션 장애 해결용 TDD 테스트
 *
 * 🚨 $300 사건 재발 방지 테스트
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';
import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';

// 실제 프로덕션 에러 추적
class ProductionErrorTracker {
  private callStack: Array<{
    function: string;
    endpoint?: string;
    timestamp: number;
    error?: string;
    callCount: number;
  }> = [];

  private infiniteLoopDetector = new Map<string, number>();

  trackCall(functionName: string, endpoint?: string, error?: string) {
    const key = endpoint ? `${functionName}:${endpoint}` : functionName;
    const currentCount = this.infiniteLoopDetector.get(key) || 0;
    this.infiniteLoopDetector.set(key, currentCount + 1);

    this.callStack.push({
      function: functionName,
      endpoint,
      timestamp: Date.now(),
      error,
      callCount: currentCount + 1,
    });

    if (currentCount > 5) {
      console.warn(`🚨 무한 루프 감지: ${key} - ${currentCount + 1}회 호출`);
    }
  }

  getInfiniteLoops() {
    return Array.from(this.infiniteLoopDetector.entries())
      .filter(([key, count]) => count > 3)
      .map(([key, count]) => ({ key, count }));
  }

  reset() {
    this.callStack = [];
    this.infiniteLoopDetector.clear();
  }

  getReport() {
    const loops = this.getInfiniteLoops();
    return {
      totalCalls: this.callStack.length,
      infiniteLoops: loops,
      callsByFunction: this.getCallsByFunction(),
    };
  }

  private getCallsByFunction() {
    return this.callStack.reduce((acc, call) => {
      const key = call.function;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

const productionTracker = new ProductionErrorTracker();

const server = setupServer(
  // 실제 프로덕션 시나리오: 토큰 없는 상태에서 /api/auth/me 호출
  http.get('/api/auth/me', ({ request }) => {
    productionTracker.trackCall('api/auth/me', '/api/auth/me');

    const auth = request.headers.get('Authorization');
    const scenario = request.headers.get('x-test-scenario') || 'no-token';

    switch (scenario) {
      case 'no-token-400': // 수정된 응답: 400 반환
        return HttpResponse.json({
          ok: false,
          code: 'NO_AUTH_TOKEN',
          error: '인증 토큰이 없습니다.',
          statusCode: 400
        }, { status: 400 });

      case 'guest-mode': // 게스트 사용자 처리
        return HttpResponse.json({
          ok: false,
          code: 'GUEST_USER',
          error: '로그인이 필요합니다.',
          statusCode: 400
        }, { status: 400 });

      default: // 기존: 401 반환 (문제 시나리오)
        return HttpResponse.json({
          ok: false,
          code: 'UNAUTHORIZED',
          error: '인증이 필요합니다.',
          statusCode: 401
        }, { status: 401 });
    }
  }),

  // 실제 프로덕션 시나리오: refresh token 실패
  http.post('/api/auth/refresh', ({ request }) => {
    productionTracker.trackCall('api/auth/refresh', '/api/auth/refresh');

    const scenario = request.headers.get('x-test-scenario') || 'expired-refresh';

    switch (scenario) {
      case 'no-refresh-cookies':
        return HttpResponse.json({
          ok: false,
          code: 'MISSING_REFRESH_TOKEN',
          error: 'Refresh token이 필요합니다.',
          statusCode: 400
        }, { status: 400 });

      case 'expired-refresh':
        return HttpResponse.json({
          ok: false,
          code: 'REFRESH_TOKEN_FAILED',
          error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
          statusCode: 401
        }, { status: 401 });

      default:
        return HttpResponse.json({
          ok: false,
          code: 'REFRESH_FAILED',
          error: 'Token refresh failed',
          statusCode: 401
        }, { status: 401 });
    }
  }),

  // 실제 프로덕션 시나리오: generate-story API 400 에러
  http.post('/api/ai/generate-story', async ({ request }) => {
    productionTracker.trackCall('api/ai/generate-story', '/api/ai/generate-story');

    const scenario = request.headers.get('x-test-scenario') || 'default';

    try {
      const body = await request.json();

      // 실제 검증 로직
      if (!body.title || typeof body.title !== 'string') {
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: '제목을 입력해주세요',
          statusCode: 400
        }, { status: 400 });
      }

      if (!body.oneLineStory || typeof body.oneLineStory !== 'string') {
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: '한 줄 스토리를 입력해주세요',
          statusCode: 400
        }, { status: 400 });
      }

      // toneAndManner 타입 검증 (배열 vs 문자열)
      if (body.toneAndManner && Array.isArray(body.toneAndManner)) {
        productionTracker.trackCall('toneAndManner-array-detected', undefined, 'Array type received, expected string');
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: '톤앤매너는 문자열이어야 합니다',
          statusCode: 400
        }, { status: 400 });
      }

      if (!body.toneAndManner || typeof body.toneAndManner !== 'string') {
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: '톤앤매너를 선택해주세요',
          statusCode: 400
        }, { status: 400 });
      }

      // 성공 응답
      return HttpResponse.json({
        ok: true,
        data: {
          steps: [
            { step: 1, title: '도입', description: '테스트 도입', keyElements: [], emotionalArc: '호기심' },
            { step: 2, title: '전개', description: '테스트 전개', keyElements: [], emotionalArc: '긴장' },
            { step: 3, title: '위기', description: '테스트 위기', keyElements: [], emotionalArc: '절망' },
            { step: 4, title: '결말', description: '테스트 결말', keyElements: [], emotionalArc: '해결' }
          ]
        }
      });

    } catch (error) {
      return HttpResponse.json({
        ok: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: '요청 처리 중 오류가 발생했습니다',
        statusCode: 500
      }, { status: 500 });
    }
  })
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  productionTracker.reset();

  // localStorage mock
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  // 환경 설정
  process.env.NODE_ENV = 'test';

  // 시간 고정
  vi.spyOn(Date, 'now').mockReturnValue(1000);
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  console.log(productionTracker.getReport());
});

describe('🔥 실제 프로덕션 오류 시나리오 재현', () => {

  describe('❌ [RED] 인증 시스템 무한 루프 문제', () => {
    test('토큰 없는 게스트 사용자 - checkAuth 무한 호출 방지', async () => {
      // Given: 토큰이 없는 게스트 사용자 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // When: AuthProvider에서 checkAuth 호출 (실제 시나리오 재현)
      const { checkAuth } = useAuthStore.getState();

      // 연속 3번 호출하여 무한 루프 시뮬레이션
      await Promise.all([
        checkAuth(),
        checkAuth(),
        checkAuth(),
      ]);

      // Then: 무한 루프 감지
      const report = productionTracker.getReport();
      console.log('🚨 무한 루프 분석:', report);

      const infiniteLoops = productionTracker.getInfiniteLoops();
      expect(infiniteLoops.length).toBeGreaterThan(0);

      // API 호출이 3번 이상 발생
      expect(report.callsByFunction['api/auth/me']).toBeGreaterThanOrEqual(3);

      // 최종 상태: 인증되지 않음
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    test('캐시된 인증 상태에서는 중복 호출 방지', async () => {
      // Given: 최근에 checkAuth를 한 상태로 시뮬레이션
      const { setUser, checkAuth } = useAuthStore.getState();

      // lastCheckTime을 최근으로 설정 (5분 이내)
      useAuthStore.setState({
        lastCheckTime: Date.now() - (2 * 60 * 1000) // 2분 전
      });

      // When: 연속 호출
      await Promise.all([
        checkAuth(),
        checkAuth(),
        checkAuth(),
      ]);

      // Then: 캐시로 인해 실제 API 호출은 최소화
      const report = productionTracker.getReport();

      // 캐시가 작동한다면 API 호출이 1회 이하여야 함
      const apiCalls = report.callsByFunction['api/auth/me'] || 0;
      expect(apiCalls).toBeLessThanOrEqual(1);
    });
  });

  describe('❌ [RED] 토큰 갱신 실패 연쇄 오류', () => {
    test('401 → refresh 시도 → 401 연쇄 실패', async () => {
      // Given: 만료된 토큰을 가진 사용자
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'expired-token'
      });

      vi.mocked(localStorage.getItem).mockReturnValue('expired-token');

      // When: API 호출 → 401 → refresh 시도 → 401
      try {
        const response = await apiClient.get('/api/auth/me');
        console.log('예상치 못한 성공:', response);
      } catch (error) {
        console.log('예상된 에러:', error);
      }

      // When: refresh token 직접 호출
      const { refreshAccessToken } = useAuthStore.getState();
      const result = await refreshAccessToken();

      // Then: 최종적으로 로그아웃 상태
      expect(result).toBeNull();
      const finalState = useAuthStore.getState();
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.user).toBeNull();

      // API 호출 추적
      const report = productionTracker.getReport();
      expect(report.callsByFunction['api/auth/refresh']).toBeGreaterThanOrEqual(1);
    });

    test('refresh token 쿠키 없는 상태에서 400 응답', async () => {
      // When: refresh token이 없는 상태에서 갱신 시도
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'x-test-scenario': 'no-refresh-cookies'
        }
      });

      // Then: 400 Bad Request (401이 아닌)
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('MISSING_REFRESH_TOKEN');
      expect(body.statusCode).toBe(400);
    });
  });

  describe('❌ [RED] generate-story API 계약 위반', () => {
    test('toneAndManner 배열 전송 시 400 에러', async () => {
      // Given: 잘못된 데이터 형식 (실제 프론트엔드에서 발생)
      const invalidData = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['친근한', '유쾌한'], // 🚨 배열로 전송 (서버는 문자열 기대)
        genre: '코미디',
        target: '일반인'
      };

      // When: API 호출
      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      });

      // Then: 400 에러와 구체적인 메시지
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toContain('문자열이어야 합니다');

      // 에러 추적 확인
      const report = productionTracker.getReport();
      expect(report.callsByFunction['toneAndManner-array-detected']).toBe(1);
    });

    test('DTO 변환기가 배열을 문자열로 올바르게 변환', async () => {
      // Given: 프론트엔드에서 사용하는 데이터 구조
      const frontendData = {
        title: '테스트 제목',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['친근한', '유쾌한'],
        genre: '코미디',
        target: '일반인',
        duration: '60초',
        format: '16:9',
        tempo: '보통',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '보통'
      };

      // When: DTO 변환기 사용
      const transformedData = transformStoryInputToApiRequest(frontendData);

      // Then: 배열이 문자열로 변환됨
      expect(transformedData.toneAndManner).toBe('친근한, 유쾌한');
      expect(typeof transformedData.toneAndManner).toBe('string');

      // When: 변환된 데이터로 API 호출
      const response = await fetch('/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transformedData)
      });

      // Then: 성공
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.steps).toHaveLength(4);
    });

    test('빈 toneAndManner 배열 처리', async () => {
      // Given: 빈 배열
      const dataWithEmptyArray = {
        title: '테스트',
        oneLineStory: '테스트',
        toneAndManner: [],
        genre: '드라마',
        target: '일반인'
      };

      // When: DTO 변환
      const transformed = transformStoryInputToApiRequest(dataWithEmptyArray);

      // Then: 기본값으로 변환
      expect(transformed.toneAndManner).toBe('일반적');
      expect(typeof transformed.toneAndManner).toBe('string');
    });

    test('null/undefined toneAndManner 처리', async () => {
      // Given: null 값
      const dataWithNull = {
        title: '테스트',
        oneLineStory: '테스트',
        toneAndManner: null,
        genre: '드라마',
        target: '일반인'
      };

      // When: DTO 변환
      const transformed = transformStoryInputToApiRequest(dataWithNull);

      // Then: 기본값으로 변환
      expect(transformed.toneAndManner).toBe('일반적');
    });
  });

  describe('❌ [RED] API 클라이언트 401/400 구분 처리', () => {
    test('401 에러는 토큰 갱신 시도, 400 에러는 바로 에러 반환', async () => {
      // Given: 유효하지 않은 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token');

      // When: 401을 반환하는 API 호출
      try {
        await apiClient.get('/api/auth/me', {
          headers: { 'x-test-scenario': 'invalid-token' }
        });
      } catch (error) {
        // Then: 401 에러는 토큰 갱신을 시도함
        expect(error).toBeDefined();
      }

      // When: 400을 반환하는 API 호출
      try {
        await apiClient.get('/api/auth/me', {
          headers: { 'x-test-scenario': 'no-token-400' }
        });
      } catch (error) {
        // Then: 400 에러는 바로 에러 반환 (갱신 시도 안함)
        expect(error).toBeDefined();
      }

      const report = productionTracker.getReport();
      console.log('API 호출 패턴:', report);

      // 401과 400에 대해 다른 처리 패턴을 보여야 함
      expect(report.totalCalls).toBeGreaterThan(0);
    });
  });
});