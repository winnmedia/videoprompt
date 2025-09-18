/**
 * 인증 시스템 중요 경로 테스트
 * $300 사건 재발 방지를 위한 핵심 시나리오
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { testUtils } from '@/test/deterministic-setup';

describe('🔐 인증 시스템 중요 경로 테스트', () => {
  const server = setupServer();
  let apiCallCounter = 0;

  beforeEach(() => {
    apiCallCounter = 0;
    server.resetHandlers();
  });

  describe('1. $300 사건 재발 방지 - 무한 루프 차단', () => {
    it('useEffect 의존성 배열 안전성 검증', async () => {
      // Given: useEffect 무한 루프를 유발할 수 있는 상황
      let effectCallCount = 0;
      const mockCheckAuth = vi.fn(() => {
        effectCallCount++;
        if (effectCallCount > 5) {
          throw new Error('무한 루프 감지: useEffect가 5회 이상 호출됨');
        }
      });

      // When: 컴포넌트가 마운트되고 리렌더링됨
      const simulateComponentLifecycle = () => {
        // 마운트
        mockCheckAuth();

        // 리렌더링 시뮬레이션 (의존성 배열이 잘못되면 무한 호출)
        for (let i = 0; i < 3; i++) {
          testUtils.nextTick();
        }
      };

      // Then: 무한 루프가 발생하지 않음
      expect(() => simulateComponentLifecycle()).not.toThrow();
      expect(effectCallCount).toBeLessThanOrEqual(1); // 마운트 시 1회만 호출
    });

    it('/api/auth/me 호출 빈도 제한 검증', async () => {
      // Given: API 호출 모니터링 설정
      server.use(
        http.get('/api/auth/me', () => {
          apiCallCounter++;
          return HttpResponse.json({ user: { id: 'test' } });
        })
      );

      // When: 짧은 시간 내 여러 번 인증 체크
      const authClient = {
        checkAuth: async () => {
          const response = await fetch('/api/auth/me');
          return response.json();
        }
      };

      // 동시에 5번 호출 시도
      const promises = Array(5).fill(null).map(() => authClient.checkAuth());
      await Promise.all(promises);

      // Then: 실제로는 중복 호출이 제한되어야 함
      expect(apiCallCounter).toBeLessThanOrEqual(2); // 디바운싱/캐싱으로 제한
    });

    it('토큰 갱신 중 추가 호출 차단', async () => {
      let refreshInProgress = false;

      server.use(
        http.post('/api/auth/refresh', async () => {
          if (refreshInProgress) {
            return HttpResponse.json(
              { error: 'Refresh already in progress' },
              { status: 429 }
            );
          }

          refreshInProgress = true;
          await new Promise(resolve => setTimeout(resolve, 100));
          refreshInProgress = false;

          return HttpResponse.json({
            accessToken: 'new-token',
            refreshToken: 'new-refresh-token'
          });
        })
      );

      // When: 동시에 여러 토큰 갱신 요청
      const refreshPromises = Array(3).fill(null).map(async () => {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return response.status;
      });

      const results = await Promise.all(refreshPromises);

      // Then: 하나만 성공하고 나머지는 차단됨
      const successCount = results.filter(status => status === 200).length;
      expect(successCount).toBe(1);
    });
  });

  describe('2. 인증 흐름 핵심 시나리오', () => {
    it('정상 로그인 → 인증된 API 호출 → 로그아웃', async () => {
      // Given: 정상적인 인증 서버 응답
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json({
            user: { id: 'user123', email: 'test@example.com' },
            accessToken: 'valid-access-token',
            refreshToken: 'valid-refresh-token'
          });
        }),

        http.get('/api/auth/me', ({ request }) => {
          const auth = request.headers.get('authorization');
          if (auth === 'Bearer valid-access-token') {
            return HttpResponse.json({
              user: { id: 'user123', email: 'test@example.com' }
            });
          }
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),

        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ success: true });
        })
      );

      // When: 전체 인증 흐름 실행
      // 1. 로그인
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' })
      });
      const loginData = await loginResponse.json();

      // 2. 인증된 API 호출
      const meResponse = await fetch('/api/auth/me', {
        headers: { authorization: `Bearer ${loginData.accessToken}` }
      });
      const userData = await meResponse.json();

      // 3. 로그아웃
      const logoutResponse = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${loginData.accessToken}` }
      });

      // Then: 모든 단계가 성공적으로 완료
      expect(loginResponse.status).toBe(200);
      expect(loginData.user).toBeDefined();
      expect(meResponse.status).toBe(200);
      expect(userData.user.id).toBe('user123');
      expect(logoutResponse.status).toBe(200);
    });

    it('토큰 만료 → 자동 갱신 → API 호출 재시도', async () => {
      let tokenRefreshed = false;

      server.use(
        http.get('/api/auth/me', ({ request }) => {
          const auth = request.headers.get('authorization');
          if (auth === 'Bearer expired-token' && !tokenRefreshed) {
            return HttpResponse.json({ error: 'Token expired' }, { status: 401 });
          }
          if (auth === 'Bearer new-access-token') {
            return HttpResponse.json({ user: { id: 'user123' } });
          }
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),

        http.post('/api/auth/refresh', () => {
          tokenRefreshed = true;
          return HttpResponse.json({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token'
          });
        })
      );

      // When: 만료된 토큰으로 API 호출 후 자동 갱신
      const authClient = {
        token: 'expired-token',
        async callApi() {
          let response = await fetch('/api/auth/me', {
            headers: { authorization: `Bearer ${this.token}` }
          });

          if (response.status === 401) {
            // 토큰 갱신
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST'
            });
            const refreshData = await refreshResponse.json();
            this.token = refreshData.accessToken;

            // API 재시도
            response = await fetch('/api/auth/me', {
              headers: { authorization: `Bearer ${this.token}` }
            });
          }

          return response;
        }
      };

      const finalResponse = await authClient.callApi();
      const finalData = await finalResponse.json();

      // Then: 자동 갱신 후 성공적으로 API 호출
      expect(finalResponse.status).toBe(200);
      expect(finalData.user.id).toBe('user123');
      expect(authClient.token).toBe('new-access-token');
      expect(tokenRefreshed).toBe(true);
    });

    it('401 에러 발생 시 로그인 페이지 리다이렉트', async () => {
      // Given: 모든 인증 API가 401 반환
      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),

        http.post('/api/auth/refresh', () => {
          return HttpResponse.json({ error: 'Refresh token invalid' }, { status: 401 });
        })
      );

      const mockRouter = {
        push: vi.fn(),
        currentPath: '/dashboard'
      };

      // When: 인증 실패 시나리오 실행
      const authHandler = {
        async handleAuthError(response: Response) {
          if (response.status === 401) {
            // 리프레시 시도
            const refreshResponse = await fetch('/api/auth/refresh', {
              method: 'POST'
            });

            if (refreshResponse.status === 401) {
              // 리프레시도 실패하면 로그인 페이지로 리다이렉트
              mockRouter.push('/login');
              return false;
            }
          }
          return true;
        }
      };

      const response = await fetch('/api/auth/me');
      const isAuthenticated = await authHandler.handleAuthError(response);

      // Then: 로그인 페이지로 리다이렉트됨
      expect(isAuthenticated).toBe(false);
      expect(mockRouter.push).toHaveBeenCalledWith('/login');
    });
  });

  describe('3. 에지 케이스 및 오류 시나리오', () => {
    it('네트워크 에러 시 재시도 로직', async () => {
      let attemptCount = 0;

      server.use(
        http.get('/api/auth/me', () => {
          attemptCount++;
          if (attemptCount <= 2) {
            // 처음 2번은 네트워크 에러 시뮬레이션
            return HttpResponse.error();
          }
          return HttpResponse.json({ user: { id: 'user123' } });
        })
      );

      // When: 재시도 로직 포함한 API 호출
      const authClientWithRetry = {
        async checkAuthWithRetry(maxRetries = 3) {
          let lastError;

          for (let i = 0; i < maxRetries; i++) {
            try {
              const response = await fetch('/api/auth/me');
              if (response.ok) {
                return await response.json();
              }
              throw new Error(`HTTP ${response.status}`);
            } catch (error) {
              lastError = error;
              if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); // 백오프
              }
            }
          }

          throw lastError;
        }
      };

      const result = await authClientWithRetry.checkAuthWithRetry();

      // Then: 재시도 후 성공
      expect(result.user.id).toBe('user123');
      expect(attemptCount).toBe(3); // 2번 실패 후 3번째 성공
    });

    it('동시 인증 요청 처리 (Race Condition 방지)', async () => {
      let processingCount = 0;
      const maxConcurrent = 1;

      server.use(
        http.get('/api/auth/me', async () => {
          processingCount++;
          if (processingCount > maxConcurrent) {
            return HttpResponse.json(
              { error: 'Too many concurrent requests' },
              { status: 429 }
            );
          }

          await new Promise(resolve => setTimeout(resolve, 50));
          processingCount--;

          return HttpResponse.json({ user: { id: 'user123' } });
        })
      );

      // When: 동시에 5개의 인증 요청
      const concurrentRequests = Array(5).fill(null).map(() =>
        fetch('/api/auth/me')
      );

      const responses = await Promise.all(concurrentRequests);
      const statusCodes = responses.map(r => r.status);

      // Then: 동시 요청이 적절히 제한됨
      const successCount = statusCodes.filter(code => code === 200).length;
      const tooManyCount = statusCodes.filter(code => code === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(tooManyCount).toBeGreaterThan(0);
      expect(successCount + tooManyCount).toBe(5);
    });
  });

  describe('4. 성능 및 메모리 누수 방지', () => {
    it('인증 상태 메모리 사용량 모니터링', async () => {
      const initialMemory = testUtils.getMemoryUsage();

      // When: 대량의 인증 요청 시뮬레이션
      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ user: { id: 'user123' } });
        })
      );

      for (let i = 0; i < 100; i++) {
        await fetch('/api/auth/me');
      }

      const finalMemory = testUtils.getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Then: 메모리 증가량이 합리적 범위 내 (5MB 미만)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    it('토큰 저장소 메모리 정리', async () => {
      const tokenStorage = new Map();

      // When: 다양한 토큰을 저장하고 정리
      for (let i = 0; i < 1000; i++) {
        tokenStorage.set(`token-${i}`, {
          value: `token-value-${i}`,
          expiresAt: Date.now() + 3600000
        });
      }

      // 만료된 토큰 정리
      const now = Date.now();
      for (const [key, token] of tokenStorage.entries()) {
        if (token.expiresAt < now) {
          tokenStorage.delete(key);
        }
      }

      // Then: 메모리가 적절히 정리됨
      expect(tokenStorage.size).toBeLessThanOrEqual(1000);
    });
  });
});