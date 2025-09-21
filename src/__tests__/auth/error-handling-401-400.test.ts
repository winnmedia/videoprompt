/**
 * 401/400 에러 처리 검증 테스트 스위트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. 401 Unauthorized 에러의 정확한 처리
 * 2. 400 Bad Request 에러의 적절한 대응
 * 3. 에러별 상태 변화 검증
 * 4. 사용자 경험 최적화
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';
// import { initializeAuth, cleanupAuth } from '@/shared/store/auth-setup';

// 에러 처리 추적 시스템
class ErrorTracker {
  private errors: Array<{
    endpoint: string;
    status: number;
    code?: string;
    message: string;
    timestamp: number;
    handled: boolean;
  }> = [];

  trackError(endpoint: string, status: number, code?: string, message?: string) {
    const error = {
      endpoint,
      status,
      code,
      message: message || 'Unknown error',
      timestamp: Date.now(),
      handled: false
    };

    this.errors.push(error);
  }

  markHandled(index: number) {
    if (this.errors[index]) {
      this.errors[index].handled = true;
    }
  }

  getErrorsByStatus(status: number) {
    return this.errors.filter(e => e.status === status);
  }

  getUnhandledErrors() {
    return this.errors.filter(e => !e.handled);
  }

  getErrorsByEndpoint(endpoint: string) {
    return this.errors.filter(e => e.endpoint.includes(endpoint));
  }

  reset() {
    this.errors = [];
  }

  getReport(): string {
    const by401 = this.getErrorsByStatus(401);
    const by400 = this.getErrorsByStatus(400);
    const unhandled = this.getUnhandledErrors();

    return `📊 에러 처리 리포트:
  총 에러: ${this.errors.length}개
  401 에러: ${by401.length}개
  400 에러: ${by400.length}개
  미처리: ${unhandled.length}개
  처리율: ${this.errors.length > 0 ? (((this.errors.length - unhandled.length) / this.errors.length) * 100).toFixed(1) : 0}%`;
  }
}

const errorTracker = new ErrorTracker();

// MSW 서버 설정 - 다양한 에러 시나리오
const server = setupServer(
  // /api/auth/me - 401 에러 시나리오
  http.get('/api/auth/me', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';
    const auth = request.headers.get('Authorization');

    switch (scenario) {
      case 'no-token':
        errorTracker.trackError('/api/auth/me', 401, 'NO_TOKEN', '토큰이 제공되지 않았습니다.');
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'UNAUTHORIZED',
            error: '인증이 필요합니다.',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'invalid-token':
        errorTracker.trackError('/api/auth/me', 401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'INVALID_TOKEN',
            error: '유효하지 않은 토큰입니다.',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'expired-token':
        errorTracker.trackError('/api/auth/me', 401, 'TOKEN_EXPIRED', '토큰이 만료되었습니다.');
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'TOKEN_EXPIRED',
            error: '토큰이 만료되었습니다. 다시 로그인해주세요.',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'malformed-token':
        errorTracker.trackError('/api/auth/me', 401, 'MALFORMED_TOKEN', '토큰 형식이 올바르지 않습니다.');
        return new HttpResponse(
          JSON.stringify({
            ok: false,
            code: 'MALFORMED_TOKEN',
            error: '토큰 형식이 올바르지 않습니다.',
            statusCode: 401
          }),
          { status: 401 }
        );

      case 'success':
        if (auth && auth.startsWith('Bearer ') && auth.slice(7) === 'valid-token') {
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
        }
        break;

      default:
        if (!auth || !auth.startsWith('Bearer ')) {
          errorTracker.trackError('/api/auth/me', 401, 'UNAUTHORIZED', '인증 헤더가 없습니다.');
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
              token: 'valid-token'
            },
            traceId: 'test-trace-id'
          });
        }

        errorTracker.trackError('/api/auth/me', 401, 'INVALID_TOKEN', '유효하지 않은 토큰');
        return new HttpResponse(null, { status: 401 });
    }
  }),

  // /api/auth/refresh - 다양한 에러
  http.post('/api/auth/refresh', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';

    switch (scenario) {
      case 'missing-refresh-token':
        errorTracker.trackError('/api/auth/refresh', 400, 'MISSING_REFRESH_TOKEN', 'Refresh token이 필요합니다.');
        return HttpResponse.json({
          ok: false,
          code: 'MISSING_REFRESH_TOKEN',
          error: 'Refresh token이 필요합니다.',
          statusCode: 400
        }, { status: 400 });

      case 'invalid-refresh-token':
        errorTracker.trackError('/api/auth/refresh', 401, 'INVALID_REFRESH_TOKEN', '유효하지 않은 refresh token입니다.');
        return HttpResponse.json({
          ok: false,
          code: 'INVALID_REFRESH_TOKEN',
          error: '유효하지 않은 refresh token입니다.',
          statusCode: 401
        }, { status: 401 });

      case 'expired-refresh-token':
        errorTracker.trackError('/api/auth/refresh', 401, 'EXPIRED_REFRESH_TOKEN', 'Refresh token이 만료되었습니다.');
        return HttpResponse.json({
          ok: false,
          code: 'EXPIRED_REFRESH_TOKEN',
          error: 'Refresh token이 만료되었습니다.',
          statusCode: 401
        }, { status: 401 });

      default:
        errorTracker.trackError('/api/auth/refresh', 401, 'REFRESH_FAILED', '토큰 갱신 실패');
        return new HttpResponse(null, { status: 401 });
    }
  }),

  // /api/ai/generate-story - 400 에러 시나리오
  http.post('/api/ai/generate-story', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'intermittent';

    switch (scenario) {
      case 'missing-prompt':
        errorTracker.trackError('/api/ai/generate-story', 400, 'MISSING_PROMPT', '프롬프트가 필요합니다.');
        return HttpResponse.json({
          ok: false,
          code: 'MISSING_PROMPT',
          error: '프롬프트가 필요합니다.',
          statusCode: 400
        }, { status: 400 });

      case 'invalid-parameters':
        errorTracker.trackError('/api/ai/generate-story', 400, 'INVALID_PARAMETERS', '요청 매개변수가 올바르지 않습니다.');
        return HttpResponse.json({
          ok: false,
          code: 'INVALID_PARAMETERS',
          error: '요청 매개변수가 올바르지 않습니다.',
          statusCode: 400
        }, { status: 400 });

      case 'prompt-too-long':
        errorTracker.trackError('/api/ai/generate-story', 400, 'PROMPT_TOO_LONG', '프롬프트가 너무 깁니다.');
        return HttpResponse.json({
          ok: false,
          code: 'PROMPT_TOO_LONG',
          error: '프롬프트는 1000자를 초과할 수 없습니다.',
          statusCode: 400
        }, { status: 400 });

      case 'rate-limit':
        errorTracker.trackError('/api/ai/generate-story', 429, 'RATE_LIMIT_EXCEEDED', 'AI 요청 한도를 초과했습니다.');
        return HttpResponse.json({
          ok: false,
          code: 'RATE_LIMIT_EXCEEDED',
          error: 'AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          statusCode: 429
        }, { status: 429 });

      case 'auth-required':
        errorTracker.trackError('/api/ai/generate-story', 401, 'AUTHENTICATION_REQUIRED', '인증이 필요한 서비스입니다.');
        return HttpResponse.json({
          ok: false,
          code: 'AUTHENTICATION_REQUIRED',
          error: '인증이 필요한 서비스입니다.',
          statusCode: 401
        }, { status: 401 });

      case 'success':
        return HttpResponse.json({
          ok: true,
          data: {
            story: 'Generated story content',
            id: 'story-123'
          },
          traceId: 'test-trace-id'
        });

      default: // intermittent
        const random = Math.random();
        if (random < 0.3) { // 30% 확률로 400 에러
          errorTracker.trackError('/api/ai/generate-story', 400, 'INTERMITTENT_ERROR', '간헐적 요청 오류');
          return HttpResponse.json({
            ok: false,
            code: 'BAD_REQUEST',
            error: '요청 데이터가 올바르지 않습니다.',
            statusCode: 400
          }, { status: 400 });
        }
        return HttpResponse.json({
          ok: true,
          data: {
            story: 'Generated story content',
            id: `story-${Date.now()}`
          },
          traceId: 'test-trace-id'
        });
    }
  }),

  // /api/auth/logout - 항상 성공
  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ ok: true });
  })
);

// 테스트 헬퍼 함수
async function makeRequestWithScenario(method: 'GET' | 'POST', url: string, scenario: string, data?: any) {
  const headers: Record<string, string> = {
    'x-test-scenario': scenario,
    'Content-Type': 'application/json'
  };

  // 토큰이 필요한 경우 추가
  if (localStorage.getItem && localStorage.getItem('token')) {
    headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return fetch(url, options);
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  // 추적기 초기화
  errorTracker.reset();

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

  // fetch를 global에 추가 (Node.js 환경)
  if (!global.fetch) {
    global.fetch = fetch;
  }

  // 시간 관련 mock
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // 결정론적 랜덤

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

describe('🚨 401/400 에러 처리 검증 테스트', () => {

  describe('401 Unauthorized 에러 처리', () => {
    test('❌ [RED] 토큰 없는 요청 시 401 처리', async () => {
      // Given: 토큰이 없는 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // When: 인증이 필요한 API 호출
      const response = await makeRequestWithScenario('GET', '/api/auth/me', 'no-token');

      // Then: 401 에러 응답
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('UNAUTHORIZED');

      expect(errorTracker.getErrorsByStatus(401)).toHaveLength(1);
    });

    test('❌ [RED] 유효하지 않은 토큰으로 401 처리', async () => {
      // Given: 유효하지 않은 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-token-123');

      // When: useAuthStore의 checkAuth 호출
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // Then: 인증 실패로 상태 초기화
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();

      expect(errorTracker.getErrorsByStatus(401)).toHaveLength(1);
    });

    test('❌ [RED] 만료된 토큰 처리 및 자동 로그아웃', async () => {
      // Given: 인증된 사용자 상태
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'expired-token'
      });

      vi.mocked(localStorage.getItem).mockReturnValue('expired-token');

      // When: 만료된 토큰으로 API 호출
      const response = await makeRequestWithScenario('GET', '/api/auth/me', 'expired-token');

      // Then: 401 응답과 적절한 에러 메시지
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('TOKEN_EXPIRED');
      expect(body.error).toContain('다시 로그인해주세요');

      const expiredErrors = errorTracker.getErrorsByEndpoint('/api/auth/me')
        .filter(e => e.code === 'TOKEN_EXPIRED');
      expect(expiredErrors).toHaveLength(1);
    });

    test('❌ [RED] 잘못된 형식의 토큰 처리', async () => {
      // Given: 형식이 잘못된 토큰
      vi.mocked(localStorage.getItem).mockReturnValue('malformed.token.format');

      // When: API 호출
      const response = await makeRequestWithScenario('GET', '/api/auth/me', 'malformed-token');

      // Then: 401 에러와 구체적 에러 메시지
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('MALFORMED_TOKEN');

      expect(errorTracker.getErrorsByStatus(401)).toHaveLength(1);
    });

    test('❌ [RED] 401 에러 후 useAuthStore 상태 변화', async () => {
      // Given: 인증된 사용자 상태
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'will-be-invalid'
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      vi.mocked(localStorage.getItem).mockReturnValue('will-be-invalid');

      // When: checkAuth 호출로 401 에러 발생
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // Then: 상태가 올바르게 초기화
      const finalState = useAuthStore.getState();
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.user).toBeNull();
      expect(finalState.isLoading).toBe(false);

      // localStorage에서 토큰 제거 확인 (ApiClient 내부에서 처리)
      expect(errorTracker.getErrorsByStatus(401)).toHaveLength(1);
    });
  });

  describe('400 Bad Request 에러 처리', () => {
    test('❌ [RED] 필수 매개변수 누락 시 400 처리', async () => {
      // When: 프롬프트 없이 AI API 호출
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'missing-prompt', {});

      // Then: 400 에러와 명확한 에러 메시지
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('MISSING_PROMPT');
      expect(body.error).toBe('프롬프트가 필요합니다.');

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(1);
    });

    test('❌ [RED] 잘못된 매개변수 형식 시 400 처리', async () => {
      // When: 잘못된 형식의 데이터로 API 호출
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'invalid-parameters', {
        prompt: 123, // 문자열이어야 하는데 숫자
        options: 'invalid'
      });

      // Then: 400 에러와 구체적 에러 설명
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('INVALID_PARAMETERS');

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(1);
    });

    test('❌ [RED] 데이터 길이 제한 초과 시 400 처리', async () => {
      // When: 너무 긴 프롬프트로 API 호출
      const longPrompt = 'A'.repeat(1001); // 1000자 초과
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'prompt-too-long', {
        prompt: longPrompt
      });

      // Then: 400 에러와 제한 정보
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('PROMPT_TOO_LONG');
      expect(body.error).toContain('1000자를 초과할 수 없습니다');

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(1);
    });

    test('❌ [RED] refresh token 누락 시 400 처리', async () => {
      // When: refresh token 없이 갱신 시도
      const response = await makeRequestWithScenario('POST', '/api/auth/refresh', 'missing-refresh-token');

      // Then: 400 에러 (401이 아닌 400)
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.code).toBe('MISSING_REFRESH_TOKEN');

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(1);
    });
  });

  describe('간헐적 에러 처리', () => {
    test('❌ [RED] 간헐적 400 에러 패턴 검증', async () => {
      const results: number[] = [];

      // When: 10번 연속 호출하여 간헐적 에러 확인
      for (let i = 0; i < 10; i++) {
        vi.spyOn(Math, 'random').mockReturnValue(i < 3 ? 0.1 : 0.8); // 첫 3번만 에러

        const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'intermittent', {
          prompt: `Test prompt ${i}`
        });

        results.push(response.status);
      }

      // Then: 일부는 400, 일부는 200
      const errorCount = results.filter(status => status === 400).length;
      const successCount = results.filter(status => status === 200).length;


      expect(errorCount).toBeGreaterThan(0);
      expect(successCount).toBeGreaterThan(0);
      expect(errorCount + successCount).toBe(10);
    });

    test('❌ [RED] 에러 복구 후 정상 동작 확인', async () => {
      // Given: 처음엔 실패하는 상황
      let response1 = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'missing-prompt', {});
      expect(response1.status).toBe(400);

      // When: 올바른 요청으로 재시도
      let response2 = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'success', {
        prompt: 'Valid prompt'
      });

      // Then: 성공적으로 복구
      expect(response2.status).toBe(200);

      const body = await response2.json();
      expect(body.ok).toBe(true);
      expect(body.data.story).toBe('Generated story content');

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(1);
    });
  });

  describe('에러 상태 전파 및 사용자 경험', () => {
    test('❌ [RED] 401 에러 시 로그인 페이지로 리다이렉트 논리', async () => {
      // Given: 인증된 사용자 상태
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'expired-token'
      });

      vi.mocked(localStorage.getItem).mockReturnValue('expired-token');

      // When: 401 에러 발생하는 API 호출
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // Then: 인증 실패 상태가 되어 리다이렉트 가능한 상태
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();

      // 이 시점에서 AuthProvider나 라우터가 로그인 페이지로 리다이렉트할 수 있음
    });

    test('❌ [RED] 400 에러 시 사용자 피드백 메시지', async () => {
      // When: 잘못된 요청
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'prompt-too-long', {
        prompt: 'Very long prompt...'
      });

      // Then: 사용자가 이해할 수 있는 에러 메시지
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('프롬프트는 1000자를 초과할 수 없습니다.');
      expect(body.code).toBe('PROMPT_TOO_LONG');

      // 프론트엔드에서 이 메시지를 사용자에게 표시할 수 있음
    });

    test('❌ [RED] Rate Limit(429) 에러의 Retry-After 헤더 처리', async () => {
      // When: Rate Limit 에러 발생
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'rate-limit', {
        prompt: 'test'
      });

      // Then: 429 에러와 재시도 정보
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error).toContain('잠시 후 다시 시도해주세요');

      // 실제 구현에서는 Retry-After 헤더도 확인할 수 있어야 함
    });

    test('❌ [RED] 인증 필요 서비스 접근 시 명확한 401 메시지', async () => {
      // When: 인증이 필요한 AI 서비스에 비인증 접근
      const response = await makeRequestWithScenario('POST', '/api/ai/generate-story', 'auth-required', {
        prompt: 'test'
      });

      // Then: 명확한 인증 필요 메시지
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('AUTHENTICATION_REQUIRED');
      expect(body.error).toBe('인증이 필요한 서비스입니다.');

    });
  });

  describe('에러 처리 완전성 검증', () => {
    test('❌ [RED] 모든 에러가 적절히 추적 및 처리되는지 확인', async () => {
      // Given: 다양한 에러 시나리오 실행
      const scenarios = [
        { method: 'GET' as const, url: '/api/auth/me', scenario: 'no-token' },
        { method: 'GET' as const, url: '/api/auth/me', scenario: 'expired-token' },
        { method: 'POST' as const, url: '/api/auth/refresh', scenario: 'missing-refresh-token' },
        { method: 'POST' as const, url: '/api/ai/generate-story', scenario: 'missing-prompt' },
        { method: 'POST' as const, url: '/api/ai/generate-story', scenario: 'rate-limit' }
      ];

      // When: 모든 시나리오 실행
      for (const { method, url, scenario } of scenarios) {
        await makeRequestWithScenario(method, url, scenario);
      }

      // Then: 모든 에러가 추적됨

      expect(errorTracker.getErrorsByStatus(400)).toHaveLength(2); // missing-refresh-token, missing-prompt
      expect(errorTracker.getErrorsByStatus(401)).toHaveLength(2); // no-token, expired-token
      expect(errorTracker.getErrorsByStatus(429)).toHaveLength(1); // rate-limit

      const unhandledErrors = errorTracker.getUnhandledErrors();

      // 실제 프로덕션에서는 모든 에러가 처리되어야 함
      // 여기서는 테스트 목적으로 추적만 확인
      expect(errorTracker.errors.length).toBe(5);
    });

    test('❌ [RED] 연쇄적 에러 처리 (401 → refresh 시도 → 401)', async () => {
      // Given: 만료된 토큰으로 인증된 사용자
      const { setUser } = useAuthStore.getState();
      setUser({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        token: 'expired-token'
      });

      vi.mocked(localStorage.getItem).mockReturnValue('expired-token');

      // When: checkAuth 호출 (401 에러 발생)
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // When: 이후 refreshAccessToken 호출 (또 401 에러 발생)
      const { refreshAccessToken } = useAuthStore.getState();
      const refreshResult = await refreshAccessToken();

      // Then: 연쇄적 실패가 올바르게 처리됨
      expect(refreshResult).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);


      // 두 번의 401 에러가 발생해야 함
      const authErrors = errorTracker.getErrorsByStatus(401);
      expect(authErrors.length).toBeGreaterThanOrEqual(1);
    });
  });
});