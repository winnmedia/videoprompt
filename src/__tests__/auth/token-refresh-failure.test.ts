/**
 * 토큰 갱신 실패 시나리오 테스트 스위트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. 토큰 갱신 실패 시 올바른 처리
 * 2. 무한 갱신 시도 방지
 * 3. 다양한 실패 시나리오 대응
 * 4. 상태 일관성 보장
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { initializeAuth, cleanupAuth } from '@/shared/store/auth-setup';

// 토큰 갱신 시나리오 추적
class RefreshScenarioTracker {
  private attempts = 0;
  private failures = 0;
  private successes = 0;
  private scenarios: string[] = [];

  trackAttempt(scenario: string) {
    this.attempts++;
    this.scenarios.push(`${this.attempts}: ${scenario}`);
    console.log(`🔄 [${this.attempts}] 토큰 갱신 시도: ${scenario}`);
  }

  trackFailure(reason: string) {
    this.failures++;
    console.log(`❌ 토큰 갱신 실패: ${reason} (총 ${this.failures}회 실패)`);
  }

  trackSuccess() {
    this.successes++;
    console.log(`✅ 토큰 갱신 성공 (총 ${this.successes}회 성공)`);
  }

  getStats() {
    return {
      attempts: this.attempts,
      failures: this.failures,
      successes: this.successes,
      scenarios: this.scenarios
    };
  }

  reset() {
    this.attempts = 0;
    this.failures = 0;
    this.successes = 0;
    this.scenarios = [];
  }

  getReport(): string {
    return `📊 토큰 갱신 통계:
  시도: ${this.attempts}회
  성공: ${this.successes}회
  실패: ${this.failures}회
  성공률: ${this.attempts > 0 ? ((this.successes / this.attempts) * 100).toFixed(1) : 0}%
  시나리오: ${this.scenarios.join(', ')}`;
  }
}

const refreshTracker = new RefreshScenarioTracker();

// MSW 서버 설정 - 다양한 토큰 갱신 실패 시나리오
const server = setupServer(
  // /api/auth/refresh - 다양한 실패 시나리오
  http.post('/api/auth/refresh', ({ request }) => {
    const scenario = (request.headers.get('x-test-scenario') || 'default');
    refreshTracker.trackAttempt(scenario);

    switch (scenario) {
      case 'network-error':
        // 네트워크 에러 시뮬레이션
        refreshTracker.trackFailure('Network Error');
        throw new Error('Network Error');

      case 'timeout':
        // 타임아웃 시뮬레이션 (5초 지연 후 응답)
        return new Promise((resolve) => {
          setTimeout(() => {
            refreshTracker.trackFailure('Timeout');
            resolve(new HttpResponse(null, { status: 408 }));
          }, 5000);
        });

      case 'invalid-token':
        // 유효하지 않은 토큰
        refreshTracker.trackFailure('Invalid Token');
        return HttpResponse.json({
          ok: false,
          code: 'INVALID_REFRESH_TOKEN',
          error: '유효하지 않은 refresh token입니다.',
          statusCode: 401
        }, { status: 401 });

      case 'expired-token':
        // 만료된 토큰
        refreshTracker.trackFailure('Expired Token');
        return HttpResponse.json({
          ok: false,
          code: 'EXPIRED_REFRESH_TOKEN',
          error: 'Refresh token이 만료되었습니다.',
          statusCode: 401
        }, { status: 401 });

      case 'server-error':
        // 서버 내부 에러
        refreshTracker.trackFailure('Server Error');
        return HttpResponse.json({
          ok: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: '서버 오류가 발생했습니다.',
          statusCode: 500
        }, { status: 500 });

      case 'malformed-response':
        // 잘못된 응답 형식
        refreshTracker.trackFailure('Malformed Response');
        return new HttpResponse('잘못된 JSON 응답', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'missing-token':
        // 응답에 토큰이 없음
        refreshTracker.trackFailure('Missing Token in Response');
        return HttpResponse.json({
          ok: true,
          data: {
            // accessToken이 없음
            user: {
              id: '1',
              email: 'test@example.com'
            }
          }
        }, { status: 200 });

      case 'rate-limit':
        // Rate Limit 에러
        refreshTracker.trackFailure('Rate Limit');
        return HttpResponse.json({
          ok: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: '토큰 갱신 요청이 너무 많습니다.',
          statusCode: 429
        }, {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60'
          }
        });

      case 'success':
        // 성공 시나리오
        refreshTracker.trackSuccess();
        return HttpResponse.json({
          ok: true,
          data: {
            accessToken: 'new-access-token',
            user: {
              id: '1',
              email: 'test@example.com',
              username: 'testuser'
            }
          },
          traceId: 'test-trace-id'
        });

      case 'supabase-config-error':
        // Supabase 설정 에러
        refreshTracker.trackFailure('Supabase Config Error');
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_CONFIG_ERROR',
          error: 'Backend configuration error. Please check environment variables.',
          statusCode: 503
        }, { status: 503 });

      default:
        // 기본: 401 Unauthorized
        refreshTracker.trackFailure('Unauthorized');
        return new HttpResponse(null, { status: 401 });
    }
  }),

  // /api/auth/logout - 로그아웃 성공
  http.post('/api/auth/logout', () => {
    console.log('🚪 로그아웃 API 호출됨');
    return HttpResponse.json({ ok: true });
  }),

  // /api/auth/me - 인증 확인
  http.get('/api/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401 });
    }

    const token = auth.slice(7);
    if (token === 'valid-token' || token === 'new-access-token') {
      return HttpResponse.json({
        ok: true,
        data: {
          id: 'test-user-id',
          email: 'test@example.com',
          username: 'testuser',
          role: 'user',
          token: token
        },
        traceId: 'test-trace-id'
      });
    }

    return new HttpResponse(null, { status: 401 });
  })
);

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  // 추적기 초기화
  refreshTracker.reset();

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

  // fetch mock - 시나리오 헤더 추가 기능
  const originalFetch = global.fetch;
  global.fetch = vi.fn().mockImplementation((url, options) => {
    // MSW 서버로 요청 전달
    return originalFetch(url, options);
  });

  // 시간 관련 mock
  vi.spyOn(Date, 'now').mockReturnValue(1000);
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
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});

// 테스트 헬퍼 함수
async function setupAuthenticatedUser() {
  const { setUser } = useAuthStore.getState();
  setUser({
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    token: 'old-token'
  });
}

async function callRefreshWithScenario(scenario: string) {
  // 시나리오 헤더를 추가하여 refresh 호출
  server.use(
    http.post('/api/auth/refresh', ({ request }) => {
      return server.handlers.find(h => h.info.path === '/api/auth/refresh')
        ?.resolver({
          ...request,
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            'x-test-scenario': scenario
          })
        });
    })
  );

  const { refreshAccessToken } = useAuthStore.getState();
  return await refreshAccessToken();
}

describe('🔄 토큰 갱신 실패 시나리오 테스트', () => {

  describe('기본 실패 시나리오', () => {
    test('❌ [RED] 401 Unauthorized 응답 시 로그아웃 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // When: 토큰 갱신 실패 (401)
      const result = await callRefreshWithScenario('default');

      // Then: 로그아웃 처리 및 상태 초기화
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isRefreshing).toBe(false);

      // localStorage에서 토큰 제거 확인
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    test('❌ [RED] 유효하지 않은 토큰 에러 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 유효하지 않은 토큰으로 갱신 시도
      const result = await callRefreshWithScenario('invalid-token');

      // Then: 적절한 에러 처리 및 로그아웃
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(refreshTracker.getStats().failures).toBe(1);
    });

    test('❌ [RED] 만료된 토큰 에러 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 만료된 토큰으로 갱신 시도
      const result = await callRefreshWithScenario('expired-token');

      // Then: 재로그인 필요 상태로 전환
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    test('❌ [RED] 서버 내부 에러 (500) 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 서버 에러 발생
      const result = await callRefreshWithScenario('server-error');

      // Then: 로그아웃 처리 (복구 불가능한 에러로 간주)
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('네트워크 관련 실패', () => {
    test('❌ [RED] 네트워크 에러 시 로그아웃 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 네트워크 에러 발생
      try {
        await callRefreshWithScenario('network-error');
      } catch (error) {
        console.log('네트워크 에러 발생:', error);
      }

      // Then: 네트워크 에러 시에도 로그아웃 처리
      console.log(refreshTracker.getReport());
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isRefreshing).toBe(false);
    });

    test('❌ [RED] 타임아웃 에러 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 타임아웃 시나리오 (3초 제한)
      const startTime = Date.now();

      try {
        await Promise.race([
          callRefreshWithScenario('timeout'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test Timeout')), 3000)
          )
        ]);
      } catch (error) {
        console.log('타임아웃 에러:', error);
      }

      const duration = Date.now() - startTime;

      // Then: 타임아웃 내에 처리됨
      console.log(`⏱️ 타임아웃 테스트 소요 시간: ${duration}ms`);
      console.log(refreshTracker.getReport());
      expect(duration).toBeLessThan(3100);
      expect(useAuthStore.getState().isRefreshing).toBe(false);
    });
  });

  describe('응답 형식 오류', () => {
    test('❌ [RED] 잘못된 JSON 응답 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 잘못된 JSON 응답
      const result = await callRefreshWithScenario('malformed-response');

      // Then: 파싱 에러 처리
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test('❌ [RED] 응답에 토큰 누락 시 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 성공 응답이지만 토큰이 없음
      const result = await callRefreshWithScenario('missing-token');

      // Then: 토큰 누락으로 인한 로그아웃
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(refreshTracker.getStats().failures).toBe(1);
    });
  });

  describe('Rate Limiting 처리', () => {
    test('❌ [RED] 429 Rate Limit 에러 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: Rate Limit 에러 발생
      const result = await callRefreshWithScenario('rate-limit');

      // Then: Rate Limit로 인한 로그아웃
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('무한 갱신 방지', () => {
    test('❌ [RED] 연속 실패 시 재시도하지 않음', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 3번 연속 토큰 갱신 시도
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await callRefreshWithScenario('default');
        results.push(result);

        // 상태 확인: 첫 번째 실패 후 로그아웃되어야 함
        if (i === 0) {
          expect(useAuthStore.getState().isAuthenticated).toBe(false);
        }
      }

      // Then: 모든 결과가 null이고 무한 재시도 없음
      console.log(refreshTracker.getReport());
      expect(results.every(r => r === null)).toBe(true);
      expect(refreshTracker.getStats().attempts).toBe(3);
      expect(refreshTracker.getStats().failures).toBe(3);
    });

    test('❌ [RED] 동시 갱신 요청 시 중복 방지', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 동시에 5번 토큰 갱신 시도
      const promises = Array.from({ length: 5 }, () =>
        callRefreshWithScenario('default')
      );

      const results = await Promise.all(promises);

      // Then: 첫 번째만 실행되고 나머지는 중복 방지
      console.log(refreshTracker.getReport());
      expect(results.every(r => r === null)).toBe(true);
      expect(refreshTracker.getStats().attempts).toBe(1); // 하나만 실행됨
    });

    test('❌ [RED] isRefreshing 상태 동안 추가 요청 차단', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      const { setRefreshing, refreshAccessToken } = useAuthStore.getState();

      // Given: 이미 갱신 중 상태 설정
      setRefreshing(true);

      // When: 갱신 중 상태에서 추가 갱신 시도
      const result = await refreshAccessToken();

      // Then: 즉시 null 반환하고 API 호출 없음
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(refreshTracker.getStats().attempts).toBe(0);
      expect(useAuthStore.getState().isRefreshing).toBe(true); // 상태 유지
    });
  });

  describe('상태 일관성 검증', () => {
    test('❌ [RED] 갱신 실패 후 모든 상태가 올바르게 초기화', async () => {
      // Given: 인증된 사용자와 복잡한 상태
      const { setUser, setLoading, setRefreshing } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'old-token',
        role: 'admin',
        avatarUrl: 'https://example.com/avatar.jpg'
      });
      setLoading(false);

      // 상태 확인
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('admin');

      // When: 토큰 갱신 실패
      await callRefreshWithScenario('invalid-token');

      // Then: 모든 상태가 완전히 초기화
      const finalState = useAuthStore.getState();
      console.log(refreshTracker.getReport());
      console.log('최종 상태:', JSON.stringify(finalState, null, 2));

      expect(finalState.user).toBeNull();
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.isLoading).toBe(false);
      expect(finalState.isRefreshing).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    });

    test('❌ [RED] 갱신 성공 시 상태 올바른 업데이트', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();
      const oldToken = useAuthStore.getState().user?.token;

      // When: 토큰 갱신 성공
      const result = await callRefreshWithScenario('success');

      // Then: 새 토큰으로 상태 업데이트
      console.log(refreshTracker.getReport());
      expect(result).toBe('new-access-token');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.token).toBe('new-access-token');
      expect(state.user?.token).not.toBe(oldToken);
      expect(state.isRefreshing).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-access-token');
    });
  });

  describe('특수 시나리오', () => {
    test('❌ [RED] Supabase 설정 에러 처리', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: Supabase 설정 에러
      const result = await callRefreshWithScenario('supabase-config-error');

      // Then: 서비스 불가 상황 처리
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    test('❌ [RED] 사용자 없는 상태에서 갱신 시도', async () => {
      // Given: 인증되지 않은 상태 (user: null)
      expect(useAuthStore.getState().user).toBeNull();

      const { refreshAccessToken } = useAuthStore.getState();

      // When: 사용자 없는 상태에서 갱신 시도
      const result = await refreshAccessToken();

      // Then: 즉시 null 반환하고 API 호출 없음
      console.log(refreshTracker.getReport());
      expect(result).toBeNull();
      expect(refreshTracker.getStats().attempts).toBe(0);
    });
  });

  describe('복구 시나리오', () => {
    test('❌ [RED] 실패 후 성공으로 복구', async () => {
      // Given: 인증된 사용자
      await setupAuthenticatedUser();

      // When: 첫 번째 갱신 실패
      const firstResult = await callRefreshWithScenario('default');
      expect(firstResult).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // When: 새로 로그인 후 성공적인 갱신
      await setupAuthenticatedUser(); // 재로그인 시뮬레이션
      const secondResult = await callRefreshWithScenario('success');

      // Then: 성공적인 복구
      console.log(refreshTracker.getReport());
      expect(secondResult).toBe('new-access-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(refreshTracker.getStats().successes).toBe(1);
      expect(refreshTracker.getStats().failures).toBe(1);
    });
  });
});