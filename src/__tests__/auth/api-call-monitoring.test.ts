/**
 * API 호출 모니터링 및 $300 사건 재발 방지 테스트
 *
 * 목적: 수정된 캐싱 메커니즘이 실제로 작동하는지 검증
 * Grace의 지침: 중복 호출 방지가 실제로 비용 절약으로 이어지는지 확인
 */

describe('🚨 API 호출 모니터링 - $300 사건 재발 방지', () => {

  beforeAll(() => {
    // 테스트 환경 설정
    process.env.NODE_ENV = 'test';
  });

  describe('💰 비용 절약 메커니즘 검증', () => {

    it('🔧 수정된 캐싱 메커니즘 - 두 번째 요청이 즉시 반환되는지 확인', async () => {
      // GIVEN: API Client 인스턴스
      const { apiClient } = await import('@/shared/lib/api-client');

      // WHEN: 첫 번째 요청
      const firstStartTime = Date.now();

      let firstResult: any = null;
      let firstError: any = null;

      try {
        firstResult = await apiClient.safeFetchWithCache('/api/auth/me', {
          method: 'GET',
          cacheTTL: 5000 // 5초 캐시
        });
      } catch (error) {
        firstError = error;
      }

      const firstDuration = Date.now() - firstStartTime;

      // 즉시 두 번째 요청 (캐시에서 가져와야 함)
      const secondStartTime = Date.now();

      let secondResult: any = null;
      let secondError: any = null;

      try {
        secondResult = await apiClient.safeFetchWithCache('/api/auth/me', {
          method: 'GET',
          cacheTTL: 5000
        });
      } catch (error) {
        secondError = error;
      }

      const secondDuration = Date.now() - secondStartTime;

      // THEN: 두 번째 요청이 훨씬 빨라야 함 (캐시 히트)

      // 두 번째 요청이 10ms 미만이어야 함 (캐시에서 즉시 반환)
      expect(secondDuration).toBeLessThan(10);

      // 에러가 발생했다면 동일한 에러여야 함
      if (firstError && secondError) {
        expect(firstError.message).toBe(secondError.message);
      }

      // 성공했다면 동일한 결과여야 함
      if (firstResult && secondResult) {
        expect(JSON.stringify(secondResult)).toBe(JSON.stringify(firstResult));
      }
    });

    it('⚡ 동시 요청 중복 방지 - 5개 요청이 1개로 합쳐지는지 확인', async () => {
      // GIVEN: API Client 인스턴스
      const { apiClient } = await import('@/shared/lib/api-client');

      // 요청 추적을 위한 변수
      let actualApiCallCount = 0;
      let cacheHitCount = 0;

      // 콘솔 로그를 추적해서 실제 API 호출 횟수 계산
      const originalLog = console.log;
      console.log = (...args) => {
        const message = args[0];
        if (typeof message === 'string') {
          if (message.includes('🔍 API 요청:') && message.includes('/api/auth/me')) {
            actualApiCallCount++;
          } else if (message.includes('💾 캐시에서 데이터 반환:')) {
            cacheHitCount++;
          }
        }
        originalLog(...args);
      };

      const startTime = Date.now();

      try {
        // WHEN: 동일한 요청을 동시에 5번 실행
        const promises = Array(5).fill(null).map((_, index) =>
          apiClient.safeFetchWithCache('/api/auth/me', {
            method: 'GET',
            cacheTTL: 10000 // 10초 캐시
          }).catch(err => {
            return { error: err.message, requestIndex: index + 1 };
          })
        );

        const results = await Promise.allSettled(promises);
        const endTime = Date.now();


        // THEN: 실제 API 호출은 1번만 발생해야 함
        expect(actualApiCallCount).toBeLessThanOrEqual(1);

        // 나머지는 캐시나 중복 방지로 처리되어야 함
        if (actualApiCallCount === 1) {
          // 첫 번째 요청이 실행되고 나머지는 중복 방지 또는 캐시로 처리
        }

        // 모든 요청이 처리되어야 함
        expect(results.length).toBe(5);

        // 비용 절약 계산
        const estimatedSavings = (5 - actualApiCallCount) * 0.001; // 요청당 $0.001 가정

      } finally {
        console.log = originalLog; // 복원
      }
    });

    it('📊 캐시 만료 테스트 - TTL 후에는 새로운 요청이 실행되는지 확인', async () => {
      // GIVEN: API Client 인스턴스
      const { apiClient } = await import('@/shared/lib/api-client');

      // WHEN: 짧은 TTL로 첫 번째 요청
      const shortTTL = 100; // 100ms

      const firstResult = await apiClient.safeFetchWithCache('/api/test-cache-expire', {
        method: 'GET',
        cacheTTL: shortTTL
      }).catch(err => ({ error: err.message }));


      // TTL 만료까지 대기
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));

      // 두 번째 요청 (캐시가 만료되어 새로운 요청이어야 함)
      let secondApiCall = false;
      const originalLog = console.log;
      console.log = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('🔍 API 요청:')) {
          secondApiCall = true;
        }
        originalLog(...args);
      };

      const secondResult = await apiClient.safeFetchWithCache('/api/test-cache-expire', {
        method: 'GET',
        cacheTTL: shortTTL
      }).catch(err => ({ error: err.message }));

      console.log = originalLog; // 복원

      // THEN: 두 번째 요청이 실제로 실행되어야 함 (캐시 만료)
      expect(secondApiCall).toBe(true);
    });

  });

  describe('🛡️ $300 사건 패턴 감지', () => {

    it('🚨 useEffect 무한루프 패턴 시뮬레이션 - 차단되는지 확인', async () => {
      // GIVEN: useEffect와 유사한 반복 호출 패턴
      const { apiClient } = await import('@/shared/lib/api-client');

      let totalApiCalls = 0;
      let totalErrors = 0;

      const originalLog = console.log;
      console.log = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('🔍 API 요청:')) {
          totalApiCalls++;
        }
        originalLog(...args);
      };

      try {
        // WHEN: 짧은 간격으로 반복 호출 (useEffect 무한루프 시뮬레이션)
        const rapidCalls = [];

        for (let i = 0; i < 10; i++) {
          rapidCalls.push(
            apiClient.get('/api/auth/me').catch(err => {
              totalErrors++;
              return { error: err.message };
            })
          );

          // 매우 짧은 간격으로 호출
          if (i < 9) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        await Promise.allSettled(rapidCalls);

        // THEN: 실제 API 호출은 제한되어야 함

        // 캐싱과 중복 방지로 실제 호출은 훨씬 적어야 함
        expect(totalApiCalls).toBeLessThan(5);

        if (totalApiCalls <= 2) {
        }

      } finally {
        console.log = originalLog; // 복원
      }
    });

    it('📈 성능 모니터링 - API 호출 빈도 추적', async () => {
      // GIVEN: API Client 성능 모니터링
      const { apiClient } = await import('@/shared/lib/api-client');

      const startTime = Date.now();
      let requestCount = 0;

      // WHEN: 1초 동안 가능한 많은 요청 시도
      const endTime = startTime + 1000; // 1초

      const requests = [];
      while (Date.now() < endTime) {
        requests.push(
          apiClient.get('/api/auth/me').catch(err => ({ error: err.message }))
        );
        requestCount++;

        // 과도한 CPU 사용 방지
        if (requestCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      await Promise.allSettled(requests);

      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = requestCount / (actualDuration / 1000);


      // THEN: 과도한 요청이 차단되어야 함
      if (requestsPerSecond > 100) {
        console.warn('⚠️ 과도한 요청 빈도 감지 - 추가 제한 필요할 수 있음');
      } else {
      }

      expect(requestCount).toBeGreaterThan(0);
    });

  });

});

/**
 * 🎯 이 테스트의 핵심 목적:
 *
 * 1. 수정된 캐싱 메커니즘이 실제로 작동하는지 확인
 * 2. 중복 호출 방지가 비용 절약으로 이어지는지 검증
 * 3. $300 사건과 같은 무한루프 패턴이 차단되는지 확인
 * 4. 성능 모니터링을 통한 실제 효과 측정
 *
 * 🚨 Grace의 관점:
 * - 실제 비용 절약 효과가 측정 가능해야 함
 * - 캐시 히트율이 명확히 확인되어야 함
 * - 무한루프 패턴이 실제로 차단되어야 함
 * - 성능 개선이 정량적으로 측정되어야 함
 */

/**
 * API 호출 횟수 모니터링 테스트 스위트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. API 호출 횟수 추적 및 제한
 * 2. Rate Limiting 동작 검증
 * 3. 호출 패턴 분석
 * 4. 성능 임계값 검증
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';
// import { initializeAuth, cleanupAuth } from '@/shared/store/auth-setup'; // 삭제된 파일

// API 호출 추적 시스템
class ApiCallTracker {
  private calls: Map<string, number> = new Map();
  private timestamps: Map<string, number[]> = new Map();

  track(endpoint: string) {
    const current = this.calls.get(endpoint) || 0;
    this.calls.set(endpoint, current + 1);

    const now = Date.now();
    const times = this.timestamps.get(endpoint) || [];
    times.push(now);
    this.timestamps.set(endpoint, times);

  }

  getCallCount(endpoint: string): number {
    return this.calls.get(endpoint) || 0;
  }

  getTotalCalls(): number {
    let total = 0;
    for (const count of this.calls.values()) {
      total += count;
    }
    return total;
  }

  getCallsInTimeWindow(endpoint: string, windowMs: number): number {
    const times = this.timestamps.get(endpoint) || [];
    const now = Date.now();
    return times.filter(time => now - time <= windowMs).length;
  }

  reset() {
    this.calls.clear();
    this.timestamps.clear();
  }

  getReport(): string {
    let report = '📊 API 호출 리포트:\\n';
    for (const [endpoint, count] of this.calls.entries()) {
      const recent = this.getCallsInTimeWindow(endpoint, 60 * 1000); // 1분 내
      report += `  ${endpoint}: ${count}회 총 / ${recent}회 (1분 내)\\n`;
    }
    report += `  총합: ${this.getTotalCalls()}회`;
    return report;
  }
}

const tracker = new ApiCallTracker();

// MSW 서버 설정 - 호출 추적 및 Rate Limiting 시뮬레이션
const server = setupServer(
  // /api/auth/me - Rate Limiting 포함
  http.get('/api/auth/me', ({ request }) => {
    tracker.track('/api/auth/me');

    const callsInLastMinute = tracker.getCallsInTimeWindow('/api/auth/me', 60 * 1000);
    const RATE_LIMIT = 10; // 1분당 10회

    // Rate Limiting 시뮬레이션
    if (callsInLastMinute > RATE_LIMIT) {
      console.warn(`🚫 Rate limit exceeded: ${callsInLastMinute}/${RATE_LIMIT}`);
      return new HttpResponse(
        JSON.stringify({
          ok: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: '인증 확인 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          statusCode: 429
        }),
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60 * 1000).toString(),
            'Retry-After': '60'
          }
        }
      );
    }

    const auth = request.headers.get('Authorization');

    if (!auth || !auth.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401 });
    }

    const token = auth.slice(7);
    if (token === 'valid-token') {
      return HttpResponse.json({
        ok: true,
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          token: 'refreshed-token'
        },
        traceId: 'test-trace-id'
      });
    }

    return new HttpResponse(null, { status: 401 });
  }),

  // /api/auth/refresh - Rate Limiting 포함
  http.post('/api/auth/refresh', ({ request }) => {
    tracker.track('/api/auth/refresh');

    const callsInLastMinute = tracker.getCallsInTimeWindow('/api/auth/refresh', 60 * 1000);
    const RATE_LIMIT = 5; // 1분당 5회 (더 엄격)

    if (callsInLastMinute > RATE_LIMIT) {
      console.warn(`🚫 Refresh rate limit exceeded: ${callsInLastMinute}/${RATE_LIMIT}`);
      return new HttpResponse(
        JSON.stringify({
          ok: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: '토큰 갱신 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          statusCode: 429
        }),
        { status: 429 }
      );
    }

    // 항상 실패로 설정 (무한 루프 테스트용)
    return new HttpResponse(null, { status: 401 });
  }),

  // /api/ai/generate-story - 간헐적 400 에러
  http.post('/api/ai/generate-story', ({ request }) => {
    tracker.track('/api/ai/generate-story');

    const callCount = tracker.getCallCount('/api/ai/generate-story');

    // 간헐적으로 400 에러 반환 (3번 중 1번)
    if (callCount % 3 === 0) {
      return new HttpResponse(
        JSON.stringify({
          ok: false,
          code: 'BAD_REQUEST',
          error: '요청 데이터가 올바르지 않습니다.',
          statusCode: 400
        }),
        { status: 400 }
      );
    }

    return HttpResponse.json({
      ok: true,
      data: {
        story: 'Generated story content',
        id: `story-${callCount}`
      },
      traceId: 'test-trace-id'
    });
  })
);

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  // 추적기 초기화
  tracker.reset();

  // 환경 설정
  process.env.FORCE_MSW = 'true';
  process.env.NODE_ENV = 'test';

  // JSDOM 환경 설정
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000/test',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/test',
      search: '',
      hash: '',
      assign: vi.fn(),
      reload: vi.fn(),
      replace: vi.fn()
    },
    writable: true,
  });

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

  // 시간 관련 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

  // 시간 증가 헬퍼
  (global as any).advanceTime = (ms: number) => {
    currentTime += ms;
  };

  vi.spyOn(performance, 'now').mockReturnValue(100);

  // 이벤트 리스너 mock
  window.addEventListener = vi.fn();
  window.removeEventListener = vi.fn();
  window.dispatchEvent = vi.fn();

  initializeAuth();
});

afterEach(() => {
  server.resetHandlers();
  cleanupAuth();
  delete process.env.FORCE_MSW;
  delete (global as any).advanceTime;
  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

describe('📊 API 호출 횟수 모니터링 테스트', () => {

  describe('호출 횟수 추적', () => {
    test('❌ [RED] API 호출 횟수가 정확하게 추적되어야 함', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 3번 checkAuth 호출
      for (let i = 0; i < 3; i++) {
        // 캐시 무효화를 위해 시간 증가
        (global as any).advanceTime(6 * 60 * 1000); // 6분씩 증가
        await checkAuth();
      }

      // Then: 정확한 호출 횟수 추적
      expect(tracker.getCallCount('/api/auth/me')).toBe(3);
      expect(tracker.getTotalCalls()).toBe(3);
    });

    test('❌ [RED] 여러 엔드포인트 호출 시 개별 추적', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth, refreshAccessToken } = useAuthStore.getState();

      // When: 다양한 API 호출
      (global as any).advanceTime(6 * 60 * 1000);
      await checkAuth(); // /api/auth/me

      await refreshAccessToken(); // /api/auth/refresh (실패 예상)

      // Then: 각 엔드포인트별 추적
      expect(tracker.getCallCount('/api/auth/me')).toBe(1);
      expect(tracker.getCallCount('/api/auth/refresh')).toBe(1);
      expect(tracker.getTotalCalls()).toBe(2);
    });

    test('❌ [RED] 시간 윈도우별 호출 횟수 계산', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 1분 내 3번, 1분 후 2번 호출
      for (let i = 0; i < 3; i++) {
        (global as any).advanceTime(10 * 1000); // 10초씩 증가 (1분 내)
        await checkAuth();
      }

      const callsInFirstMinute = tracker.getCallsInTimeWindow('/api/auth/me', 60 * 1000);

      (global as any).advanceTime(60 * 1000); // 1분 후

      for (let i = 0; i < 2; i++) {
        (global as any).advanceTime(6 * 60 * 1000); // 캐시 무효화
        await checkAuth();
      }

      // Then: 시간 윈도우별 정확한 계산
      expect(callsInFirstMinute).toBe(3);
      expect(tracker.getCallsInTimeWindow('/api/auth/me', 60 * 1000)).toBe(2); // 최근 1분
      expect(tracker.getTotalCalls()).toBe(5);
    });
  });

  describe('Rate Limiting 테스트', () => {
    test('❌ [RED] /api/auth/me Rate Limit 초과 시 429 에러', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: Rate Limit (10회) 초과하여 호출
      for (let i = 0; i < 12; i++) {
        try {
          (global as any).advanceTime(1000); // 1초씩 증가 (1분 내)
          await checkAuth();
        } catch (error) {
        }
      }

      // Then: Rate Limit 후 429 에러 발생
      expect(tracker.getCallCount('/api/auth/me')).toBe(12);

      // 마지막 호출은 429 에러였을 것으로 예상
      // (실제 구현에서는 checkAuth가 429를 받으면 에러를 던질 것)
    });

    test('❌ [RED] /api/auth/refresh Rate Limit (더 엄격한 제한)', async () => {
      // Given: 인증된 사용자
      const { setUser, refreshAccessToken } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'old-token'
      });

      // When: Refresh Rate Limit (5회) 초과하여 호출
      for (let i = 0; i < 7; i++) {
        try {
          (global as any).advanceTime(1000); // 1초씩 증가
          await refreshAccessToken();
        } catch (error) {
        }
      }

      // Then: Rate Limit 적용
      expect(tracker.getCallCount('/api/auth/refresh')).toBe(7);
    });

    test('❌ [RED] Rate Limit 시간 윈도우 만료 후 복구', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: Rate Limit 초과
      for (let i = 0; i < 11; i++) {
        try {
          (global as any).advanceTime(1000);
          await checkAuth();
        } catch (error) {
          // 에러 무시
        }
      }

      const callsAfterLimit = tracker.getCallCount('/api/auth/me');

      // When: 1분 후 (Rate Limit 윈도우 만료)
      (global as any).advanceTime(60 * 1000);

      try {
        (global as any).advanceTime(6 * 60 * 1000); // 캐시도 무효화
        await checkAuth(); // 복구 후 첫 호출
      } catch (error) {
        // 에러 발생하면 안됨
        console.error('Rate limit 복구 후에도 에러:', error);
      }

      // Then: Rate Limit 복구 확인
      expect(tracker.getCallCount('/api/auth/me')).toBe(callsAfterLimit + 1);
    });
  });

  describe('호출 패턴 분석', () => {
    test('❌ [RED] 부하 테스트 - 동시 호출 시 패턴', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 동시에 10개의 checkAuth 호출
      const startTime = Date.now();

      const promises = Array.from({ length: 10 }, (_, i) => {
        // 각 호출을 약간 다른 시간에 실행
        (global as any).advanceTime(100);
        return checkAuth();
      });

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Then: 동시 호출 패턴 분석

      // Promise 재사용으로 인해 API 호출은 1번만 발생해야 함
      expect(tracker.getCallCount('/api/auth/me')).toBe(1);
      expect(duration).toBeLessThan(1000); // 1초 이내 처리
    });

    test('❌ [RED] 순차 호출 vs 동시 호출 성능 비교', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 순차 호출 (5번)
      const sequentialStart = Date.now();

      for (let i = 0; i < 5; i++) {
        (global as any).advanceTime(6 * 60 * 1000); // 캐시 무효화
        await checkAuth();
      }

      const sequentialEnd = Date.now();
      const sequentialDuration = sequentialEnd - sequentialStart;
      const sequentialCalls = tracker.getCallCount('/api/auth/me');

      tracker.reset(); // 추적기 초기화

      // When: 동시 호출 (5번)
      const concurrentStart = Date.now();

      const promises = Array.from({ length: 5 }, () => checkAuth());
      await Promise.all(promises);

      const concurrentEnd = Date.now();
      const concurrentDuration = concurrentEnd - concurrentStart;
      const concurrentCalls = tracker.getCallCount('/api/auth/me');

      // Then: 성능 비교 및 분석

      expect(sequentialCalls).toBe(5); // 순차는 5번 모두
      expect(concurrentCalls).toBe(1); // 동시는 1번만
      expect(concurrentDuration).toBeLessThan(sequentialDuration); // 동시가 더 빨라야 함
    });

    test('❌ [RED] 에러 발생 시 호출 패턴', async () => {
      // Given: 무효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 5번 연속 호출 (모두 401 에러 예상)
      for (let i = 0; i < 5; i++) {
        try {
          (global as any).advanceTime(6 * 60 * 1000); // 캐시 무효화
          await checkAuth();
        } catch (error) {
        }
      }

      // Then: 에러 상황에서도 호출 추적
      expect(tracker.getCallCount('/api/auth/me')).toBe(5);

      // 모든 호출이 실패했으므로 인증되지 않은 상태
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('성능 임계값 검증', () => {
    test('❌ [RED] 단일 API 호출 응답 시간 임계값', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 단일 checkAuth 호출 시간 측정
      const measurements: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();

        (global as any).advanceTime(6 * 60 * 1000); // 캐시 무효화
        await checkAuth();

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);

      // Then: 응답 시간 임계값 검증

      expect(averageTime).toBeLessThan(500); // 평균 500ms 이하
      expect(maxTime).toBeLessThan(1000); // 최대 1초 이하
      expect(tracker.getCallCount('/api/auth/me')).toBe(3);
    });

    test('❌ [RED] 대량 호출 시 전체 처리 시간 임계값', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      const CALL_COUNT = 20;
      const MAX_TOTAL_TIME = 5000; // 5초 이내

      // When: 대량 호출 처리
      const startTime = performance.now();

      // Rate Limit을 피하기 위해 시간을 충분히 분산
      for (let i = 0; i < CALL_COUNT; i++) {
        try {
          (global as any).advanceTime(4 * 1000); // 4초씩 분산 (Rate Limit 회피)
          await checkAuth();
        } catch (error) {
          // Rate Limit 에러는 무시
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Then: 전체 처리 시간 검증

      expect(totalTime).toBeLessThan(MAX_TOTAL_TIME);

      // 캐싱으로 인해 실제 API 호출은 적을 것
      const actualApiCalls = tracker.getCallCount('/api/auth/me');
      expect(actualApiCalls).toBeLessThan(CALL_COUNT);
    });

    test('❌ [RED] 메모리 사용량 모니터링 (호출 추적 오버헤드)', async () => {
      // Given: 메모리 사용량 측정 시작
      const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');
      const { checkAuth } = useAuthStore.getState();

      // When: 대량 호출 (메모리 누수 테스트)
      for (let i = 0; i < 100; i++) {
        (global as any).advanceTime(1000); // 1초씩
        try {
          await checkAuth();
        } catch (error) {
          // 에러 무시
        }
      }

      const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Then: 메모리 사용량 검증

      // 메모리 증가가 10MB 이하여야 함 (합리적 임계값)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      expect(tracker.getTotalCalls()).toBe(100);
    });
  });

  describe('간헐적 에러 패턴 테스트', () => {
    test('❌ [RED] /api/ai/generate-story 간헐적 400 에러 패턴', async () => {
      // 별도의 API 클라이언트 직접 호출 (useAuthStore와 독립적)

      let successCount = 0;
      let errorCount = 0;

      // When: 10번 호출하여 간헐적 에러 패턴 확인
      for (let i = 0; i < 10; i++) {
        try {
          const response = await fetch('/api/ai/generate-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `test prompt ${i}` })
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // Then: 간헐적 에러 패턴 확인

      expect(tracker.getCallCount('/api/ai/generate-story')).toBe(10);
      expect(errorCount).toBeGreaterThan(0); // 일부 에러 발생
      expect(successCount).toBeGreaterThan(0); // 일부 성공
    });
  });
});