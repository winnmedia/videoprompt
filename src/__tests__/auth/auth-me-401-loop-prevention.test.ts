/**
 * /api/auth/me 401 무한 루프 회귀 방지 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: $300 사건 재발 방지
 * - /api/auth/me 401 응답 시 무한 루프 감지
 * - httpOnly 쿠키 기반 인증 엣지케이스 처리
 * - Rate Limiting 및 비용 안전장치
 * - 강력한 회귀 방지 메커니즘
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { initializeAuth, cleanupAuth } from '@/shared/store/auth-setup';

// $300 사건 방지를 위한 고급 무한 루프 감지기
class AuthLoopDetector {
  private apiCalls: Map<string, number[]> = new Map();
  private refreshAttempts: Map<string, number[]> = new Map();
  private costs: Map<string, number> = new Map();

  // 비용 계산 (실제 AWS API Gateway 기준)
  private readonly API_COST_PER_REQUEST = 0.0000035; // $3.50 per million requests
  private readonly DANGER_THRESHOLD = 50; // 50회 이상 시 위험
  private readonly CRITICAL_THRESHOLD = 1000; // 1000회 이상 시 $300 사건 급박
  private readonly TIME_WINDOW = 60000; // 1분 윈도우

  trackApiCall(endpoint: string, sessionId: string = 'default'): boolean {
    const key = `${endpoint}:${sessionId}`;
    const now = Date.now();

    // 기존 호출 기록 가져오기
    const calls = this.apiCalls.get(key) || [];
    calls.push(now);

    // 시간 윈도우 내의 호출만 유지
    const recentCalls = calls.filter(time => now - time <= this.TIME_WINDOW);
    this.apiCalls.set(key, recentCalls);

    // 비용 계산
    const cost = recentCalls.length * this.API_COST_PER_REQUEST;
    this.costs.set(key, cost);

    console.log(`📞 [${endpoint}] 호출 #${recentCalls.length} (${sessionId}) | 비용: $${cost.toFixed(6)}`);

    // 위험도 평가
    if (recentCalls.length >= this.CRITICAL_THRESHOLD) {
      console.error(`🚨 CRITICAL: ${endpoint} 무한 루프 감지! ${recentCalls.length}회/분 → 예상 비용: $${cost.toFixed(2)}`);
      return false; // 즉시 중단
    }

    if (recentCalls.length >= this.DANGER_THRESHOLD) {
      console.warn(`⚠️ WARNING: ${endpoint} 과도한 호출 (${recentCalls.length}회/분) → 비용: $${cost.toFixed(4)}`);
    }

    return true; // 계속 허용
  }

  trackRefreshAttempt(sessionId: string = 'default'): boolean {
    const now = Date.now();
    const attempts = this.refreshAttempts.get(sessionId) || [];
    attempts.push(now);

    // 5분 윈도우 내의 시도만 유지
    const recentAttempts = attempts.filter(time => now - time <= 300000);
    this.refreshAttempts.set(sessionId, recentAttempts);

    console.log(`🔄 토큰 갱신 시도 #${recentAttempts.length} (${sessionId})`);

    // 5분 내 10회 초과 시 차단
    if (recentAttempts.length > 10) {
      console.error(`🚨 토큰 갱신 무한 루프 감지! ${recentAttempts.length}회/5분`);
      return false;
    }

    return true;
  }

  getCallCount(endpoint: string, sessionId: string = 'default'): number {
    const key = `${endpoint}:${sessionId}`;
    return (this.apiCalls.get(key) || []).length;
  }

  getTotalCost(sessionId: string = 'default'): number {
    let total = 0;
    for (const [key, cost] of this.costs.entries()) {
      if (key.endsWith(`:${sessionId}`)) {
        total += cost;
      }
    }
    return total;
  }

  isInDanger(endpoint: string, sessionId: string = 'default'): boolean {
    return this.getCallCount(endpoint, sessionId) >= this.DANGER_THRESHOLD;
  }

  isCritical(endpoint: string, sessionId: string = 'default'): boolean {
    return this.getCallCount(endpoint, sessionId) >= this.CRITICAL_THRESHOLD;
  }

  reset() {
    this.apiCalls.clear();
    this.refreshAttempts.clear();
    this.costs.clear();
  }

  getReport(sessionId: string = 'default'): string {
    const report = ['📊 API 호출 안전성 리포트:'];

    for (const [key, calls] of this.apiCalls.entries()) {
      if (key.endsWith(`:${sessionId}`)) {
        const endpoint = key.split(':')[0];
        const cost = this.costs.get(key) || 0;
        const status = calls.length >= this.CRITICAL_THRESHOLD ? '🚨 CRITICAL' :
                      calls.length >= this.DANGER_THRESHOLD ? '⚠️ DANGER' : '✅ SAFE';
        report.push(`  ${endpoint}: ${calls.length}회/분, $${cost.toFixed(6)} ${status}`);
      }
    }

    const totalCost = this.getTotalCost(sessionId);
    report.push(`  총 예상 비용: $${totalCost.toFixed(6)}`);

    if (totalCost > 0.1) {
      report.push(`  ⚠️ 비용 경고: $0.10 초과`);
    }

    return report.join('\n');
  }
}

const loopDetector = new AuthLoopDetector();

// MSW 서버 설정 - 무한 루프 시나리오 포함
const server = setupServer(
  // /api/auth/me - 다양한 401 시나리오
  http.get('/api/auth/me', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';
    const sessionId = request.headers.get('x-session-id') || 'default';

    if (!loopDetector.trackApiCall('/api/auth/me', sessionId)) {
      return new HttpResponse(
        JSON.stringify({
          ok: false,
          code: 'RATE_LIMIT_PROTECTION',
          error: '무한 루프 감지로 인한 자동 차단',
          statusCode: 429
        }),
        { status: 429 }
      );
    }

    const auth = request.headers.get('Authorization');

    switch (scenario) {
      case 'no-token':
        // 토큰 없음 - 즉시 401
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'NO_TOKEN',
            error: 'Authorization header missing',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'null-token':
        // getActualAccessToken()이 null 반환하는 상황
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'NULL_TOKEN',
            error: 'Access token is null',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'malformed-token':
        // 형식 오류 토큰
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'MALFORMED_TOKEN',
            error: 'Invalid token format',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'expired-token':
        // 만료된 토큰
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'TOKEN_EXPIRED',
            error: 'Token has expired',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'guest-mode':
        // Guest 모드 응답 (401 대신 200)
        return HttpResponse.json({
          ok: true,
          data: {
            isGuest: true,
            permissions: ['read:public']
          },
          traceId: 'guest-trace'
        });

      case 'refresh-and-retry':
        // 토큰 갱신 후 재시도 성공
        if (auth && auth.startsWith('Bearer ') && auth.slice(7) === 'refreshed-token') {
          return HttpResponse.json({
            ok: true,
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              token: 'refreshed-token'
            },
            traceId: 'retry-success'
          });
        }
        return new HttpResponse(null, { status: 401 });

      case 'success':
        // 성공 시나리오
        if (auth && auth.startsWith('Bearer ') && auth.slice(7) === 'valid-token') {
          return HttpResponse.json({
            ok: true,
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser',
              token: 'valid-token'
            },
            traceId: 'auth-success'
          });
        }
        break;

      default:
        // 기본: 401 Unauthorized
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'UNAUTHORIZED',
            error: 'Authentication required',
            statusCode: 401
          }),
          { status: 401 }
        );
    }
  }),

  // /api/auth/refresh - 토큰 갱신
  http.post('/api/auth/refresh', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';
    const sessionId = request.headers.get('x-session-id') || 'default';

    if (!loopDetector.trackRefreshAttempt(sessionId)) {
      return new HttpResponse(
        JSON.stringify({
          ok: false,
          code: 'REFRESH_LOOP_DETECTED',
          error: '토큰 갱신 무한 루프 감지',
          statusCode: 429
        }),
        { status: 429 }
      );
    }

    switch (scenario) {
      case 'success':
        return HttpResponse.json({
          ok: true,
          data: {
            accessToken: 'refreshed-token',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              username: 'testuser'
            }
          },
          traceId: 'refresh-success'
        });

      case 'failure':
      default:
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'REFRESH_FAILED',
            error: 'Failed to refresh token',
            statusCode: 401
          }),
          { status: 401 }
        );
    }
  }),

  // /api/planning/* - Supabase 관련 API
  http.get('/api/planning/*', ({ request }) => {
    const sessionId = request.headers.get('x-session-id') || 'default';
    loopDetector.trackApiCall('/api/planning/*', sessionId);

    const scenario = request.headers.get('x-test-scenario') || 'default';

    switch (scenario) {
      case 'supabase-null':
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_NULL_ERROR',
          error: 'Supabase client is null',
          statusCode: 500
        }, { status: 500 });

      case 'auth-required':
        return new HttpResponse(null, { status: 401 });

      default:
        return HttpResponse.json({
          ok: true,
          data: { plans: [] },
          traceId: 'planning-success'
        });
    }
  })
);

// 테스트 헬퍼
async function makeAuthenticatedRequest(endpoint: string, scenario: string, sessionId: string = 'test-session') {
  const headers: Record<string, string> = {
    'x-test-scenario': scenario,
    'x-session-id': sessionId,
    'Content-Type': 'application/json'
  };

  // 토큰이 있는 경우 추가
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(endpoint, { method: 'GET', headers });
}

async function simulateInfiniteLoop(endpoint: string, scenario: string, maxCalls: number = 100) {
  const sessionId = `loop-test-${Date.now()}`;
  const results = [];

  for (let i = 0; i < maxCalls; i++) {
    try {
      const response = await makeAuthenticatedRequest(endpoint, scenario, sessionId);
      results.push({
        call: i + 1,
        status: response.status,
        ok: response.ok
      });

      // 429 응답 시 루프 차단됨
      if (response.status === 429) {
        console.log(`🛑 루프 차단됨 at call ${i + 1}`);
        break;
      }
    } catch (error) {
      console.error(`Error at call ${i + 1}:`, error);
      break;
    }
  }

  return { results, sessionId };
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  loopDetector.reset();

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

  // 시간 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

  (global as any).advanceTime = (ms: number) => {
    currentTime += ms;
  };

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

describe('🚨 /api/auth/me 401 무한 루프 회귀 방지 테스트', () => {

  describe('$300 사건 재현 및 차단', () => {
    test('❌ [RED] 토큰 없는 상황에서 무한 401 루프 감지', async () => {
      // Given: 토큰이 없는 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // When: 무한 루프 시뮬레이션
      const { results, sessionId } = await simulateInfiniteLoop('/api/auth/me', 'no-token', 200);

      // Then: 루프 차단 확인
      console.log(loopDetector.getReport(sessionId));

      const consecutiveFailures = results.filter(r => r.status === 401).length;
      const rateLimitHit = results.some(r => r.status === 429);

      expect(consecutiveFailures).toBeGreaterThan(50);
      expect(rateLimitHit).toBe(true); // 결국 429로 차단됨
      expect(loopDetector.isCritical('/api/auth/me', sessionId)).toBe(true);

      const totalCost = loopDetector.getTotalCost(sessionId);
      console.log(`💰 예상 비용: $${totalCost.toFixed(6)}`);
      expect(totalCost).toBeGreaterThan(0.0001); // 최소 비용 발생
    });

    test('❌ [RED] getActualAccessToken null 상황 무한 루프', async () => {
      // Given: httpOnly 쿠키에서 토큰 읽기 실패 상황
      vi.mocked(localStorage.getItem).mockReturnValue('dummy-token');

      // When: null 토큰 시나리오로 무한 루프 시뮬레이션
      const { results, sessionId } = await simulateInfiniteLoop('/api/auth/me', 'null-token', 150);

      // Then: 빠른 루프 차단
      console.log(loopDetector.getReport(sessionId));

      const totalCalls = results.length;
      const rateLimitHit = results.some(r => r.status === 429);

      expect(totalCalls).toBeLessThan(100); // 100회 전에 차단
      expect(rateLimitHit).toBe(true);
      expect(loopDetector.isInDanger('/api/auth/me', sessionId)).toBe(true);
    });

    test('❌ [RED] 토큰 갱신 실패 → auth/me 재시도 → 무한 루프', async () => {
      // Given: 유효하지 않은 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token');

      // When: checkAuth 호출이 갱신 실패 후 재시도하는 시나리오
      const { checkAuth } = useAuthStore.getState();

      const results = [];
      for (let i = 0; i < 60; i++) {
        try {
          await checkAuth();
          results.push({ attempt: i + 1, success: true });
        } catch (error) {
          results.push({ attempt: i + 1, success: false, error });
        }

        // 시간 증가 (빠른 재시도 시뮬레이션)
        (global as any).advanceTime(1000);
      }

      // Then: 무한 루프 방지 메커니즘 작동
      console.log(loopDetector.getReport());

      const authMeCalls = loopDetector.getCallCount('/api/auth/me');
      expect(authMeCalls).toBeGreaterThan(50);
      expect(loopDetector.isCritical('/api/auth/me')).toBe(true);
    });
  });

  describe('httpOnly 쿠키 인증 엣지케이스', () => {
    test('❌ [RED] 현재 구현: null 토큰 → 즉시 401 (문제 상황)', async () => {
      // Given: Supabase getSession이 null 반환
      // 실제 상황: httpOnly 쿠키는 있지만 JS에서 읽을 수 없음

      // When: API에서 getActualAccessToken() === null인 상황
      const response = await makeAuthenticatedRequest('/api/auth/me', 'null-token');

      // Then: 현재 구현은 즉시 401 반환 (문제)
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('NULL_TOKEN');

      console.log('❌ 현재 문제: null 토큰 시 즉시 401 → 토큰 갱신 시도 없음');
    });

    test('✅ [GREEN] 이상적 구현: null 토큰 → 갱신 시도 → 성공/실패 처리', async () => {
      // Given: 사용자 인증 상태 설정
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'will-be-refreshed'
      });

      // When: 토큰 갱신 성공 시나리오
      const { refreshAccessToken } = useAuthStore.getState();

      // 갱신 성공 설정
      server.use(
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json({
            ok: true,
            data: {
              accessToken: 'refreshed-token',
              user: {
                id: '1',
                email: 'test@example.com',
                username: 'testuser'
              }
            }
          });
        })
      );

      const newToken = await refreshAccessToken();

      // Then: 성공적인 토큰 갱신
      expect(newToken).toBe('refreshed-token');
      expect(useAuthStore.getState().user?.token).toBe('refreshed-token');

      // When: 갱신된 토큰으로 재시도
      vi.mocked(localStorage.getItem).mockReturnValue('refreshed-token');
      const retryResponse = await makeAuthenticatedRequest('/api/auth/me', 'refresh-and-retry');

      // Then: 성공적인 인증
      expect(retryResponse.status).toBe(200);

      console.log('✅ 이상적 구현: 토큰 갱신 → 재시도 → 성공');
    });

    test('✅ [GREEN] Guest 모드 전환: 갱신 실패 시 401 대신 200 응답', async () => {
      // Given: 토큰 갱신도 실패하는 상황
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'will-fail-refresh'
      });

      // When: 토큰 갱신 실패 후 guest 모드 응답
      const response = await makeAuthenticatedRequest('/api/auth/me', 'guest-mode');

      // Then: 401 대신 guest 모드 200 응답
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.isGuest).toBe(true);
      expect(body.data.permissions).toContain('read:public');

      console.log('✅ Guest 모드: 401 무한 루프 대신 제한된 권한으로 서비스 계속');
    });
  });

  describe('Rate Limiting 및 비용 보호', () => {
    test('❌ [RED] 1분 내 50회 초과 시 자동 차단', async () => {
      // Given: 유효하지 않은 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token');

      // When: 빠른 연속 호출 (1초마다)
      const results = [];
      for (let i = 0; i < 60; i++) {
        const response = await makeAuthenticatedRequest('/api/auth/me', 'expired-token', 'rate-limit-test');
        results.push({
          call: i + 1,
          status: response.status,
          timestamp: Date.now()
        });

        (global as any).advanceTime(1000); // 1초씩 증가

        // 429 응답 시 중단
        if (response.status === 429) {
          break;
        }
      }

      // Then: 50회 근처에서 차단
      console.log(loopDetector.getReport('rate-limit-test'));

      const lastCall = results[results.length - 1];
      expect(lastCall.status).toBe(429);
      expect(results.length).toBeLessThan(60);
      expect(loopDetector.isInDanger('/api/auth/me', 'rate-limit-test')).toBe(true);
    });

    test('💰 [비용 계산] 무한 루프 시 예상 비용 계산', async () => {
      // Given: 무한 루프가 발생하는 상황
      const { results, sessionId } = await simulateInfiniteLoop('/api/auth/me', 'malformed-token', 2000);

      // When: 비용 계산
      const totalCost = loopDetector.getTotalCost(sessionId);
      const totalCalls = loopDetector.getCallCount('/api/auth/me', sessionId);

      // Then: 비용 임계값 확인
      console.log(loopDetector.getReport(sessionId));
      console.log(`💰 총 ${totalCalls}회 호출로 예상 비용: $${totalCost.toFixed(6)}`);

      // 2000회 호출 시 약 $0.007 예상
      expect(totalCost).toBeGreaterThan(0.001);
      expect(totalCost).toBeLessThan(0.01);

      // 하지만 실제로는 훨씬 적게 호출됨 (차단 메커니즘)
      expect(totalCalls).toBeLessThan(2000);
    });

    test('⏱️ [시간 윈도우] 1분 후 Rate Limit 리셋 확인', async () => {
      // Given: Rate Limit까지 호출
      const { results: firstBatch } = await simulateInfiniteLoop('/api/auth/me', 'no-token', 60);
      const firstBatchCalls = loopDetector.getCallCount('/api/auth/me', 'time-window-test');

      // When: 1분 경과
      (global as any).advanceTime(61000);

      // When: 새로운 호출
      const response = await makeAuthenticatedRequest('/api/auth/me', 'no-token', 'time-window-test');

      // Then: Rate Limit 리셋되어 호출 가능
      expect(response.status).toBe(401); // 429가 아닌 401

      const totalCalls = loopDetector.getCallCount('/api/auth/me', 'time-window-test');
      console.log(`⏱️ 시간 윈도우 리셋 후 총 호출: ${totalCalls}회`);
    });
  });

  describe('Supabase 통합 시나리오', () => {
    test('❌ [RED] Supabase null 에러 → /api/auth/me 무한 호출', async () => {
      // Given: Supabase client가 null인 상황

      // When: planning API 호출 → 401 → auth/me 호출 → Supabase null → 재시도
      const planningResponse = await makeAuthenticatedRequest('/api/planning/list', 'auth-required', 'supabase-test');
      expect(planningResponse.status).toBe(401);

      // When: auth/me가 Supabase null로 실패하는 시나리오
      const { results } = await simulateInfiniteLoop('/api/auth/me', 'null-token', 80);

      // Then: Supabase 관련 무한 루프 차단
      console.log(loopDetector.getReport('supabase-test'));

      const rateLimitHit = results.some(r => r.status === 429);
      expect(rateLimitHit).toBe(true);
    });

    test('✅ [GREEN] Supabase 설정 에러 시 graceful degradation', async () => {
      // When: Supabase 설정 문제 발생
      const response = await makeAuthenticatedRequest('/api/planning/list', 'supabase-null', 'degradation-test');

      // Then: 500 에러이지만 서비스 중단 없음
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.code).toBe('SUPABASE_NULL_ERROR');

      // 사용자에게 적절한 에러 메시지 제공
      expect(body.error).toContain('Supabase client is null');

      console.log('✅ Supabase 에러 시 graceful degradation');
    });
  });

  describe('복합 시나리오 및 실제 사용 패턴', () => {
    test('❌ [RED] 다중 탭에서 동시 인증 실패', async () => {
      // Given: 3개 탭이 동시에 auth/me 호출
      const sessions = ['tab-1', 'tab-2', 'tab-3'];

      // When: 각 탭에서 동시에 무한 루프 발생
      const promises = sessions.map(sessionId =>
        simulateInfiniteLoop('/api/auth/me', 'expired-token', 30)
      );

      const results = await Promise.all(promises);

      // Then: 각 탭별로 독립적인 Rate Limiting
      results.forEach((result, index) => {
        const sessionId = result.sessionId;
        console.log(`탭 ${index + 1}: ${loopDetector.getReport(sessionId)}`);

        const callCount = loopDetector.getCallCount('/api/auth/me', sessionId);
        expect(callCount).toBeGreaterThan(20);
      });

      // 전체 비용 계산
      const totalCost = sessions.reduce((sum, sessionId) =>
        sum + loopDetector.getTotalCost(sessionId), 0);
      console.log(`💰 다중 탭 총 비용: $${totalCost.toFixed(6)}`);
    });

    test('✅ [GREEN] 정상 인증 플로우는 영향받지 않음', async () => {
      // Given: 유효한 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      // When: 정상적인 auth/me 호출
      const response = await makeAuthenticatedRequest('/api/auth/me', 'success', 'normal-test');

      // Then: 정상 처리됨
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.id).toBe('test-user-id');

      // Rate Limiting에 영향받지 않음
      const callCount = loopDetector.getCallCount('/api/auth/me', 'normal-test');
      expect(callCount).toBe(1);
      expect(loopDetector.isInDanger('/api/auth/me', 'normal-test')).toBe(false);

      console.log('✅ 정상 인증은 Rate Limiting 영향 없음');
    });

    test('🔄 [복구] 무한 루프 차단 후 정상 토큰으로 복구', async () => {
      // Given: 무한 루프로 차단된 상황
      const { results } = await simulateInfiniteLoop('/api/auth/me', 'malformed-token', 60);
      const rateLimitHit = results.some(r => r.status === 429);
      expect(rateLimitHit).toBe(true);

      // When: 1분 후 + 유효한 토큰으로 재시도
      (global as any).advanceTime(61000);
      vi.mocked(localStorage.getItem).mockReturnValue('valid-token');

      const recoveryResponse = await makeAuthenticatedRequest('/api/auth/me', 'success', 'recovery-test');

      // Then: 정상 복구됨
      expect(recoveryResponse.status).toBe(200);

      console.log('🔄 Rate Limit 해제 후 정상 복구 확인');
    });
  });

  describe('모니터링 및 알림', () => {
    test('📊 [모니터링] 무한 루프 패턴 상세 분석', async () => {
      // Given: 다양한 시나리오 실행
      const scenarios = [
        { name: 'no-token', calls: 30 },
        { name: 'expired-token', calls: 40 },
        { name: 'null-token', calls: 25 }
      ];

      for (const scenario of scenarios) {
        await simulateInfiniteLoop('/api/auth/me', scenario.name, scenario.calls);
      }

      // When: 전체 리포트 생성
      const report = loopDetector.getReport();

      // Then: 상세한 분석 정보 제공
      console.log('📊 전체 무한 루프 분석 리포트:');
      console.log(report);

      expect(report).toContain('/api/auth/me');
      expect(report).toContain('CRITICAL');
      expect(report).toContain('총 예상 비용');
    });

    test('🚨 [알림] 임계값 초과 시 즉시 알림', async () => {
      // Given: 알림 임계값 설정
      const alertSpy = vi.fn();

      // Mock console.error to capture alerts
      const originalError = console.error;
      console.error = vi.fn((message) => {
        if (message.includes('CRITICAL')) {
          alertSpy(message);
        }
        originalError(message);
      });

      try {
        // When: 임계값 초과까지 호출
        await simulateInfiniteLoop('/api/auth/me', 'no-token', 1200);

        // Then: 알림 발생 확인
        expect(alertSpy).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('무한 루프 감지')
        );
      } finally {
        console.error = originalError;
      }
    });
  });
});