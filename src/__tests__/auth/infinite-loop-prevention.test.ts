/**
 * 무한 루프 방지 테스트 스위트 - $300 폭탄 재발 방지
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. checkAuth 무한 호출 방지
 * 2. refresh token 무한 호출 방지
 * 3. API 호출 횟수 모니터링
 * 4. 캐싱 메커니즘 검증
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';
// import { initializeAuth, cleanupAuth } from '@/shared/store/auth-setup';

// API 호출 카운터
let apiCallCount = {
  authMe: 0,
  refresh: 0,
  total: 0
};

// MSW 서버 설정 - 호출 횟수 추적
const server = setupServer(
  // /api/auth/me 핸들러 - 호출 횟수 추적
  http.get('/api/auth/me', ({ request }) => {
    apiCallCount.authMe++;
    apiCallCount.total++;


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

  // /api/auth/refresh 핸들러 - 호출 횟수 추적
  http.post('/api/auth/refresh', ({ request }) => {
    apiCallCount.refresh++;
    apiCallCount.total++;


    // 401 에러로 무한 루프 시뮬레이션 가능
    return new HttpResponse(null, { status: 401 });
  })
);

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  // API 호출 카운터 초기화
  apiCallCount = { authMe: 0, refresh: 0, total: 0 };

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
  vi.spyOn(Date, 'now').mockReturnValue(1000); // 고정 시간
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
});

afterAll(() => {
  server.close();
});

describe('🚨 무한 루프 방지 테스트 - $300 폭탄 재발 방지', () => {

  describe('checkAuth 무한 호출 방지', () => {
    test('❌ [RED] 동시에 checkAuth를 여러 번 호출해도 API는 1번만 호출되어야 함', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 동시에 5번 checkAuth 호출 (무한 루프 시뮬레이션)
      const promises = Array.from({ length: 5 }, () => checkAuth());

      await Promise.all(promises);

      // Then: API 호출은 1번만 발생해야 함 (현재 실패할 것으로 예상)
      expect(apiCallCount.authMe).toBe(1);
    });

    test('❌ [RED] 5분 캐시 기간 내 중복 호출은 API 호출하지 않아야 함', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 첫 번째 checkAuth 호출
      await checkAuth();

      const firstCallCount = apiCallCount.authMe;

      // When: 5분 이내 두 번째 checkAuth 호출 (캐시 기간 내)
      vi.spyOn(Date, 'now').mockReturnValue(1000 + (4 * 60 * 1000)); // 4분 후
      await checkAuth();

      // Then: 두 번째 호출은 API 호출 없어야 함
      expect(apiCallCount.authMe).toBe(firstCallCount); // 증가하지 않아야 함
    });

    test('❌ [RED] 5분 캐시 기간 초과 후에는 새로운 API 호출이 발생해야 함', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 첫 번째 checkAuth 호출
      await checkAuth();
      const firstCallCount = apiCallCount.authMe;

      // When: 5분 후 두 번째 checkAuth 호출 (캐시 기간 초과)
      vi.spyOn(Date, 'now').mockReturnValue(1000 + (6 * 60 * 1000)); // 6분 후
      await checkAuth();

      // Then: 새로운 API 호출 발생
      expect(apiCallCount.authMe).toBe(firstCallCount + 1);
    });

    test('❌ [RED] isLoading 상태일 때 중복 호출 방지', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      // Given: 이미 로딩 상태로 설정
      const { setLoading, checkAuth } = useAuthStore.getState();
      setLoading(true);

      // When: 로딩 상태에서 checkAuth 호출
      await checkAuth();

      // Then: API 호출 발생하지 않아야 함
      expect(apiCallCount.authMe).toBe(0);
    });
  });

  describe('refresh token 무한 호출 방지', () => {
    test('❌ [RED] refresh token이 실패해도 재시도하지 않아야 함', async () => {
      // Given: 인증된 사용자 상태
      const { setUser, refreshAccessToken } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'old-token'
      });

      // When: refresh token 호출 (401 에러 발생)
      const result = await refreshAccessToken();

      // Then: null 반환하고 API는 1번만 호출
      expect(result).toBeNull();
      expect(apiCallCount.refresh).toBe(1);

      // When: 다시 refresh token 호출
      const result2 = await refreshAccessToken();

      // Then: 추가 호출 없이 null 반환 (로그아웃 상태)
      expect(result2).toBeNull();
      expect(apiCallCount.refresh).toBe(2); // 각각 1번씩만
    });

    test('❌ [RED] 동시 refresh token 호출 시 중복 방지', async () => {
      // Given: 인증된 사용자 상태
      const { setUser, refreshAccessToken } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'old-token'
      });

      // When: 동시에 3번 refresh token 호출
      const promises = Array.from({ length: 3 }, () => refreshAccessToken());

      const results = await Promise.all(promises);

      // Then: 첫 번째만 실행되고 나머지는 null
      expect(results.filter(r => r === null)).toHaveLength(3); // 모두 null (실패)
      expect(apiCallCount.refresh).toBe(1); // API는 1번만 호출
    });

    test('❌ [RED] isRefreshing 상태일 때 추가 호출 방지', async () => {
      // Given: 인증된 사용자 상태
      const { setUser, setRefreshing, refreshAccessToken } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'old-token'
      });

      // Given: 이미 갱신 중 상태
      setRefreshing(true);

      // When: 갱신 중 상태에서 refresh 호출
      const result = await refreshAccessToken();

      // Then: null 반환하고 API 호출 없음
      expect(result).toBeNull();
      expect(apiCallCount.refresh).toBe(0);
    });
  });

  describe('API 호출 횟수 모니터링', () => {
    test('❌ [RED] 1분 내 총 API 호출 횟수가 임계값을 초과하지 않아야 함', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      const MAX_API_CALLS_PER_MINUTE = 10; // 임계값 설정

      // When: 15번 연속 checkAuth 호출 (임계값 초과 시뮬레이션)
      for (let i = 0; i < 15; i++) {
        await checkAuth();
        // 시간을 조금씩 증가시켜 캐시 무효화 (극단적 케이스)
        vi.spyOn(Date, 'now').mockReturnValue(1000 + (i * 1000)); // 1초씩 증가
      }

      // Then: 총 API 호출 횟수가 임계값 이하여야 함
      expect(apiCallCount.total).toBeLessThanOrEqual(MAX_API_CALLS_PER_MINUTE);
    });

    test('❌ [RED] useEffect에서 함수를 의존성으로 사용하면 무한 루프 발생', async () => {
      // 이 테스트는 실제 React 컴포넌트에서 실행되어야 하므로
      // 현재는 개념적 테스트로 작성

      // Given: 함수를 의존성 배열에 포함하는 패턴 시뮬레이션
      let effectCallCount = 0;
      const checkAuth = vi.fn(() => {
        effectCallCount++;
      });

      // 함수가 매번 새로 생성되는 것을 시뮬레이션
      const createCheckAuth = () => vi.fn(() => {
        effectCallCount++;
      });

      // When: useEffect 패턴 시뮬레이션 (잘못된 패턴)
      for (let i = 0; i < 5; i++) {
        const newCheckAuth = createCheckAuth();
        newCheckAuth(); // useEffect 내부 호출 시뮬레이션
      }

      // Then: 호출 횟수가 1회를 초과하면 무한 루프 패턴
      expect(effectCallCount).toBeGreaterThan(1); // 문제 패턴 감지
    });
  });

  describe('극단적 시나리오 테스트', () => {
    test('❌ [RED] 네트워크 오류 시 재시도 제한', async () => {
      // MSW 핸들러를 네트워크 오류로 변경
      server.use(
        http.get('/api/auth/me', () => {
          apiCallCount.authMe++;
          apiCallCount.total++;
          throw new Error('Network Error');
        })
      );

      // Given: localStorage에 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 5번 연속 checkAuth 호출 (네트워크 오류 발생)
      for (let i = 0; i < 5; i++) {
        try {
          await checkAuth();
        } catch (error) {
          // 에러 무시하고 계속
        }
        // 시간 증가로 캐시 무효화
        vi.spyOn(Date, 'now').mockReturnValue(1000 + ((i + 1) * 6 * 60 * 1000));
      }

      // Then: 네트워크 오류에도 불구하고 5번 모두 API 호출 발생
      // (캐시가 무효화되었기 때문)
      expect(apiCallCount.authMe).toBe(5);
    });

    test('❌ [RED] 서버 응답 지연 시 타임아웃 처리', async () => {
      // MSW 핸들러를 지연 응답으로 변경
      server.use(
        http.get('/api/auth/me', async () => {
          apiCallCount.authMe++;
          apiCallCount.total++;

          // 5초 지연 시뮬레이션
          await new Promise(resolve => setTimeout(resolve, 5000));

          return HttpResponse.json({
            ok: true,
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              role: 'user',
              token: 'valid-token'
            },
            traceId: 'test-trace-id'
          });
        })
      );

      // Given: localStorage에 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const { checkAuth } = useAuthStore.getState();

      // When: 타임아웃이 있는 checkAuth 호출
      const startTime = performance.now();

      try {
        await Promise.race([
          checkAuth(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);
      } catch (error) {
        // 타임아웃 예상
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: 3초 이내 타임아웃 발생
      expect(duration).toBeLessThan(3100); // 타임아웃 + 여유시간
      expect(apiCallCount.authMe).toBe(1); // API는 호출됨
    });
  });

  describe('상태 일관성 테스트', () => {
    test('❌ [RED] 인증 실패 후 상태가 올바르게 초기화되어야 함', async () => {
      // Given: 인증된 상태
      const { setUser, checkAuth } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'valid-token'
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // MSW 핸들러를 401 에러로 변경
      server.use(
        http.get('/api/auth/me', () => {
          apiCallCount.authMe++;
          return new HttpResponse(null, { status: 401 });
        })
      );

      // When: checkAuth 호출 (401 에러 발생)
      await checkAuth();

      // Then: 상태가 올바르게 초기화
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(apiCallCount.authMe).toBe(1);
    });

    test('❌ [RED] Promise 재사용 메커니즘 검증', async () => {
      // Given: localStorage에 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      // MSW 핸들러를 지연 응답으로 변경
      server.use(
        http.get('/api/auth/me', async () => {
          apiCallCount.authMe++;
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 지연
          return HttpResponse.json({
            ok: true,
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              role: 'user',
              token: 'valid-token'
            },
            traceId: 'test-trace-id'
          });
        })
      );

      const { checkAuth } = useAuthStore.getState();

      // When: 동시에 3번 checkAuth 호출
      const promise1 = checkAuth();
      const promise2 = checkAuth();
      const promise3 = checkAuth();

      // 모든 Promise가 동일한지 확인 (참조 동일성)
      expect(promise1).toBe(promise2);
      expect(promise2).toBe(promise3);

      await Promise.all([promise1, promise2, promise3]);

      // Then: API는 1번만 호출
      expect(apiCallCount.authMe).toBe(1);
    });
  });
});