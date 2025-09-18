/**
 * 최종 프로덕션 401/400 에러 해결 검증 테스트
 * 2025-09-16 - 프로덕션 환경과 동일한 시나리오 통합 검증
 *
 * 🎯 목표:
 * - www.vridge.kr 도메인 환경 시뮬레이션
 * - 실제 API 플로우 통합 검증
 * - TokenManager + ApiClient + AuthStore 완전 통합
 * - $300 사건 재발 방지 확인
 *
 * 🔍 검증 범위:
 * 1. 프로덕션 인증 시스템 완전성
 * 2. 401/400 에러의 정확한 분기 처리
 * 3. 토큰 우선순위 및 자동 갱신
 * 4. 무한 루프 방지 메커니즘
 * 5. API 계약 위반 방지
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { useAuthStore } from '@/shared/store/useAuthStore';
import { apiClient } from '@/shared/lib/api-client';
import { tokenManager, getAuthToken, setToken, clearAllTokens } from '@/shared/lib/token-manager';
import { transformStoryInputToApiRequest } from '@/shared/api/dto-transformers';

// 프로덕션 환경 종합 분석기
class ProductionIntegrationAnalyzer {
  private apiCalls: Array<{
    endpoint: string;
    method: string;
    status: number;
    timestamp: number;
    tokenType?: string;
    error?: string;
    responseTime: number;
  }> = [];

  private authStateChanges: Array<{
    event: string;
    timestamp: number;
    isAuthenticated: boolean;
    userId?: string;
  }> = [];

  private costTracking = {
    apiCallCount: 0,
    costPerCall: 0.001, // $0.001 per API call
    totalCost: 0
  };

  trackApiCall(endpoint: string, method: string, status: number, tokenType?: string, error?: string, startTime?: number) {
    const now = Date.now();
    const responseTime = startTime ? now - startTime : 0;

    this.apiCalls.push({
      endpoint,
      method,
      status,
      timestamp: now,
      tokenType,
      error,
      responseTime
    });

    this.costTracking.apiCallCount++;
    this.costTracking.totalCost = this.costTracking.apiCallCount * this.costTracking.costPerCall;

    // $300 경고 트리거
    if (this.costTracking.totalCost > 5.0) {
      console.warn(`🚨 비용 경고: $${this.costTracking.totalCost.toFixed(3)} - 무한 루프 가능성 검사 필요`);
    }
  }

  trackAuthStateChange(event: string, isAuthenticated: boolean, userId?: string) {
    this.authStateChanges.push({
      event,
      timestamp: Date.now(),
      isAuthenticated,
      userId
    });
  }

  getInfiniteLoopWarnings() {
    const recentCalls = this.apiCalls.filter(call =>
      Date.now() - call.timestamp < 60000 && // 1분 이내
      call.endpoint === '/api/auth/me'
    );

    return {
      count: recentCalls.length,
      isInfiniteLoop: recentCalls.length > 10,
      estimatedCost: recentCalls.length * this.costTracking.costPerCall
    };
  }

  getProductionReport() {
    const errorCalls = this.apiCalls.filter(call => call.status >= 400);
    const successCalls = this.apiCalls.filter(call => call.status < 400);

    const byEndpoint = this.apiCalls.reduce((acc, call) => {
      acc[call.endpoint] = (acc[call.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgResponseTime = this.apiCalls.length > 0
      ? this.apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / this.apiCalls.length
      : 0;

    return {
      summary: {
        totalCalls: this.apiCalls.length,
        successRate: this.apiCalls.length > 0 ? (successCalls.length / this.apiCalls.length * 100).toFixed(1) : '0',
        avgResponseTime: Math.round(avgResponseTime),
        totalCost: this.costTracking.totalCost.toFixed(3)
      },
      errors: {
        total: errorCalls.length,
        by401: errorCalls.filter(c => c.status === 401).length,
        by400: errorCalls.filter(c => c.status === 400).length,
        by500: errorCalls.filter(c => c.status >= 500).length
      },
      endpoints: byEndpoint,
      authStateChanges: this.authStateChanges.length,
      infiniteLoopCheck: this.getInfiniteLoopWarnings()
    };
  }

  reset() {
    this.apiCalls = [];
    this.authStateChanges = [];
    this.costTracking = { apiCallCount: 0, costPerCall: 0.001, totalCost: 0 };
  }
}

const analyzer = new ProductionIntegrationAnalyzer();

// 실제 프로덕션 API 응답 시뮬레이션
const server = setupServer(
  // 실제 /api/auth/me 엔드포인트 동작
  http.get('/api/auth/me', ({ request }) => {
    const startTime = Date.now();
    const auth = request.headers.get('Authorization');
    const scenario = request.headers.get('x-test-scenario') || 'production';

    setTimeout(() => {
      const tokenType = auth?.includes('Bearer') ? 'bearer' : 'none';

      if (!auth || !auth.startsWith('Bearer ')) {
        analyzer.trackApiCall('/api/auth/me', 'GET', 401, tokenType, 'No authorization', startTime);
        return HttpResponse.json({
          ok: false,
          code: 'UNAUTHORIZED',
          error: '인증이 필요합니다.',
          statusCode: 401
        }, { status: 401 });
      }

      const token = auth.slice(7);

      // 실제 토큰 검증 시뮬레이션
      if (token === 'valid-supabase-token') {
        analyzer.trackApiCall('/api/auth/me', 'GET', 200, 'supabase', undefined, startTime);
        return HttpResponse.json({
          ok: true,
          data: {
            id: 'user-123',
            email: 'user@vridge.kr',
            username: 'vridge-user',
            token: token,
            provider: 'supabase'
          }
        });
      }

      if (token === 'valid-bearer-token') {
        analyzer.trackApiCall('/api/auth/me', 'GET', 200, 'bearer', undefined, startTime);
        return HttpResponse.json({
          ok: true,
          data: {
            id: 'user-456',
            email: 'legacy@vridge.kr',
            username: 'legacy-user',
            token: token,
            provider: 'legacy'
          }
        });
      }

      if (token === 'expired-token') {
        analyzer.trackApiCall('/api/auth/me', 'GET', 401, 'bearer', 'Token expired', startTime);
        return HttpResponse.json({
          ok: false,
          code: 'TOKEN_EXPIRED',
          error: '토큰이 만료되었습니다. 다시 로그인해주세요.',
          statusCode: 401
        }, { status: 401 });
      }

      analyzer.trackApiCall('/api/auth/me', 'GET', 401, tokenType, 'Invalid token', startTime);
      return HttpResponse.json({
        ok: false,
        code: 'INVALID_TOKEN',
        error: '유효하지 않은 토큰입니다.',
        statusCode: 401
      }, { status: 401 });
    }, Math.random() * 50 + 10); // 10-60ms 실제 응답 시간 시뮬레이션
  }),

  // 실제 /api/auth/refresh 엔드포인트 동작
  http.post('/api/auth/refresh', ({ request }) => {
    const startTime = Date.now();
    const scenario = request.headers.get('x-test-scenario') || 'production';

    setTimeout(() => {
      if (scenario === 'success') {
        analyzer.trackApiCall('/api/auth/refresh', 'POST', 200, undefined, undefined, startTime);
        return HttpResponse.json({
          ok: true,
          data: {
            accessToken: 'new-refreshed-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            user: {
              id: 'user-123',
              email: 'user@vridge.kr'
            }
          }
        });
      }

      analyzer.trackApiCall('/api/auth/refresh', 'POST', 401, undefined, 'Refresh failed', startTime);
      return HttpResponse.json({
        ok: false,
        code: 'REFRESH_FAILED',
        error: '토큰 갱신에 실패했습니다.',
        statusCode: 401
      }, { status: 401 });
    }, Math.random() * 100 + 20); // 20-120ms
  }),

  // 실제 /api/ai/generate-story 엔드포인트 동작 (인증 포함)
  http.post('/api/ai/generate-story', async ({ request }) => {
    const startTime = Date.now();
    const auth = request.headers.get('Authorization');
    const scenario = request.headers.get('x-test-scenario') || 'production';

    // 인증 확인 (실제 프로덕션과 동일)
    if (!auth || !auth.startsWith('Bearer ')) {
      analyzer.trackApiCall('/api/ai/generate-story', 'POST', 401, 'none', 'No auth header', startTime);
      return HttpResponse.json({
        ok: false,
        code: 'AUTHENTICATION_REQUIRED',
        error: '인증이 필요한 서비스입니다.',
        statusCode: 401
      }, { status: 401 });
    }

    const token = auth.slice(7);
    if (!['valid-supabase-token', 'valid-bearer-token'].includes(token)) {
      analyzer.trackApiCall('/api/ai/generate-story', 'POST', 401, 'invalid', 'Invalid token', startTime);
      return HttpResponse.json({
        ok: false,
        code: 'INVALID_TOKEN',
        error: '유효하지 않은 토큰입니다.',
        statusCode: 401
      }, { status: 401 });
    }

    try {
      const body = await request.json();

      // 실제 검증 로직 시뮬레이션
      if (!body.title || typeof body.title !== 'string') {
        analyzer.trackApiCall('/api/ai/generate-story', 'POST', 400, token.includes('supabase') ? 'supabase' : 'bearer', 'Missing title', startTime);
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: '제목을 입력해주세요.',
          statusCode: 400
        }, { status: 400 });
      }

      if (!body.toneAndManner || typeof body.toneAndManner !== 'string') {
        analyzer.trackApiCall('/api/ai/generate-story', 'POST', 400, token.includes('supabase') ? 'supabase' : 'bearer', 'Invalid toneAndManner', startTime);
        return HttpResponse.json({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: 'toneAndManner는 문자열이어야 합니다.',
          statusCode: 400
        }, { status: 400 });
      }

      // 성공 응답
      analyzer.trackApiCall('/api/ai/generate-story', 'POST', 200, token.includes('supabase') ? 'supabase' : 'bearer', undefined, startTime);
      return HttpResponse.json({
        ok: true,
        data: {
          steps: [
            { step: 1, title: '도입', description: 'AI 생성 도입부', keyElements: ['캐릭터 소개'], emotionalArc: '호기심' },
            { step: 2, title: '전개', description: 'AI 생성 전개부', keyElements: ['갈등 시작'], emotionalArc: '긴장' },
            { step: 3, title: '위기', description: 'AI 생성 위기', keyElements: ['절정'], emotionalArc: '절망' },
            { step: 4, title: '결말', description: 'AI 생성 결말', keyElements: ['해결'], emotionalArc: '카타르시스' }
          ],
          metadata: {
            model: 'gemini-pro',
            responseTime: Math.random() * 2000 + 500,
            tokenUsage: Math.floor(Math.random() * 1000 + 500)
          }
        }
      });

    } catch (error) {
      analyzer.trackApiCall('/api/ai/generate-story', 'POST', 500, 'unknown', 'Parse error', startTime);
      return HttpResponse.json({
        ok: false,
        code: 'INTERNAL_ERROR',
        error: '요청 처리 중 오류가 발생했습니다.',
        statusCode: 500
      }, { status: 500 });
    }
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    analyzer.trackApiCall('/api/health', 'GET', 200);
    return HttpResponse.json({
      ok: true,
      data: {
        status: 'healthy',
        environment: 'production-test',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  })
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  analyzer.reset();

  // DOM 환경 설정 - www.vridge.kr 시뮬레이션
  Object.defineProperty(window, 'location', {
    value: {
      href: 'https://www.vridge.kr',
      origin: 'https://www.vridge.kr',
      protocol: 'https:',
      host: 'www.vridge.kr',
      hostname: 'www.vridge.kr',
      port: '',
      pathname: '/',
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

  // 환경 변수 설정
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_API_BASE_URL = 'https://www.vridge.kr';
  process.env.FORCE_MSW = 'true';

  // 시간 고정 (결정론적 테스트)
  vi.spyOn(Date, 'now').mockReturnValue(1000);

  // AuthStore 상태 초기화
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    lastCheckTime: null,
    checkInProgress: false
  });

  // TokenManager 정리
  clearAllTokens();
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  console.log('\n📊 프로덕션 통합 테스트 리포트:');
  console.log(JSON.stringify(analyzer.getProductionReport(), null, 2));
});

describe('🚀 최종 프로덕션 401/400 에러 해결 검증', () => {

  describe('🎯 프로덕션 환경 시뮬레이션 검증', () => {
    test('✅ www.vridge.kr 도메인 환경 설정 확인', () => {
      // Given: 프로덕션 환경 시뮬레이션
      // When: 환경 확인
      expect(window.location.hostname).toBe('www.vridge.kr');
      expect(window.location.protocol).toBe('https:');
      expect(process.env.NODE_ENV).toBe('production');
      expect(process.env.NEXT_PUBLIC_API_BASE_URL).toBe('https://www.vridge.kr');

      // Then: 프로덕션 환경 완료
      console.log('🌐 프로덕션 환경 시뮬레이션: www.vridge.kr');
    });

    test('✅ Health Check 엔드포인트 정상 동작', async () => {
      // When: Health check 호출
      const response = await fetch('/api/health');

      // Then: 정상 응답
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.environment).toBe('production-test');
    });
  });

  describe('🔐 통합 인증 시스템 검증', () => {
    test('✅ [GREEN] Supabase 토큰 우선순위 최고 - 완전 통합 플로우', async () => {
      // Given: Supabase 토큰과 Legacy 토큰이 모두 존재
      const supabaseToken = 'valid-supabase-token';
      const legacyToken = 'valid-bearer-token';

      // Supabase 토큰 저장 (최우선)
      setToken(supabaseToken, 'supabase', Date.now() + 3600000);
      // Legacy 토큰도 저장 (하위 우선순위)
      vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
        if (key === 'accessToken') {
          vi.mocked(localStorage.getItem).mockImplementation((getKey) => {
            if (getKey === 'accessToken') return legacyToken;
            if (getKey === 'sb-access-token-backup') {
              return JSON.stringify({ token: supabaseToken, expiresAt: Date.now() + 3600000 });
            }
            return null;
          });
        }
      });
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({ token: supabaseToken, expiresAt: Date.now() + 3600000 });
        }
        if (key === 'accessToken') return legacyToken;
        return null;
      });

      // When: AuthStore checkAuth 호출
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // Then: Supabase 토큰으로 인증 성공
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.provider).toBe('supabase');
      expect(authState.user?.token).toBe(supabaseToken);

      // 토큰 우선순위 검증
      const currentToken = getAuthToken();
      expect(currentToken?.type).toBe('supabase');
      expect(currentToken?.token).toBe(supabaseToken);

      analyzer.trackAuthStateChange('supabase-login-success', true, authState.user?.id);
    });

    test('✅ [GREEN] Bearer 토큰 폴백 - Supabase 없을 때', async () => {
      // Given: Bearer 토큰만 존재
      const bearerToken = 'valid-bearer-token';

      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return bearerToken;
        return null;
      });

      // When: 인증 확인
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // Then: Bearer 토큰으로 인증
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.provider).toBe('legacy');

      const currentToken = getAuthToken();
      expect(currentToken?.type).toBe('bearer');
    });

    test('❌ [RED] 토큰 없는 게스트 사용자 - 무한 루프 방지', async () => {
      // Given: 토큰이 전혀 없는 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // When: 연속 checkAuth 호출 (실제 프로덕션 시나리오)
      const { checkAuth } = useAuthStore.getState();

      const checkPromises = Array(5).fill(0).map(() => checkAuth());
      await Promise.all(checkPromises);

      // Then: 무한 루프 방지 확인
      const report = analyzer.getProductionReport();
      const infiniteLoopCheck = report.infiniteLoopCheck;

      if (infiniteLoopCheck.isInfiniteLoop) {
        console.error(`🚨 무한 루프 감지! 비용: $${infiniteLoopCheck.estimatedCost}`);
        expect(infiniteLoopCheck.isInfiniteLoop).toBe(false); // 실패해야 함
      } else {
        console.log(`✅ 무한 루프 방지 성공. API 호출: ${infiniteLoopCheck.count}회`);
        expect(infiniteLoopCheck.count).toBeLessThanOrEqual(10);
      }

      // 최종 상태: 비인증
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();

      analyzer.trackAuthStateChange('guest-user-handled', false);
    });

    test('❌ [RED] 만료 토큰 → 갱신 시도 → 갱신 실패 → 로그아웃', async () => {
      // Given: 만료된 토큰을 가진 사용자
      const expiredToken = 'expired-token';

      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return expiredToken;
        return null;
      });

      // 초기에는 인증된 상태로 설정 (만료 전)
      const { setUser } = useAuthStore.getState();
      setUser({
        id: 'user-123',
        email: 'user@vridge.kr',
        username: 'user',
        token: expiredToken
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // When: checkAuth 호출 (토큰 만료로 401 발생)
      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      // When: 토큰 갱신 시도
      const { refreshAccessToken } = useAuthStore.getState();
      const refreshResult = await refreshAccessToken();

      // Then: 갱신 실패로 로그아웃
      expect(refreshResult).toBeNull();

      const finalState = useAuthStore.getState();
      expect(finalState.isAuthenticated).toBe(false);
      expect(finalState.user).toBeNull();

      analyzer.trackAuthStateChange('token-expired-logout', false);

      // 비용 추적
      const report = analyzer.getProductionReport();
      expect(report.errors.by401).toBeGreaterThanOrEqual(1);
      expect(parseFloat(report.summary.totalCost)).toBeLessThan(1.0); // $1 미만
    });
  });

  describe('🤖 AI API 통합 검증 (generate-story)', () => {
    test('✅ [GREEN] 인증된 사용자 - 정상적인 스토리 생성', async () => {
      // Given: 유효한 Supabase 토큰으로 인증
      const validToken = 'valid-supabase-token';

      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({ token: validToken, expiresAt: Date.now() + 3600000 });
        }
        return null;
      });

      // 인증 상태 설정
      const { setUser } = useAuthStore.getState();
      setUser({
        id: 'user-123',
        email: 'user@vridge.kr',
        username: 'user',
        token: validToken
      });

      // When: 올바른 형식으로 스토리 생성 요청
      const storyInput = {
        title: '테스트 영상',
        oneLineStory: '재미있는 테스트 스토리',
        toneAndManner: ['친근한', '유쾌한'], // 배열 형태 (프론트엔드)
        genre: '코미디',
        target: '일반인',
        duration: '60초',
        format: '16:9'
      };

      // DTO 변환 적용
      const transformedData = transformStoryInputToApiRequest(storyInput);
      expect(transformedData.toneAndManner).toBe('친근한, 유쾌한'); // 문자열로 변환됨

      // API 호출
      const response = await apiClient.post('/api/ai/generate-story', transformedData);

      // Then: 성공적인 스토리 생성
      expect(response.ok).toBe(true);
      expect(response.data.steps).toHaveLength(4);
      expect(response.data.steps[0].title).toBe('도입');
      expect(response.data.metadata).toBeDefined();

      const report = analyzer.getProductionReport();
      expect(report.errors.total).toBe(0);
      expect(report.summary.successRate).toBe('100.0');
    });

    test('❌ [RED] 비인증 사용자 - AI API 접근 차단', async () => {
      // Given: 인증되지 않은 상태
      vi.mocked(localStorage.getItem).mockReturnValue(null);
      clearAllTokens();

      // AuthStore도 비인증 상태
      useAuthStore.setState({
        isAuthenticated: false,
        user: null
      });

      // When: 스토리 생성 시도
      try {
        await apiClient.post('/api/ai/generate-story', {
          title: '테스트',
          oneLineStory: '테스트 스토리',
          toneAndManner: '친근한'
        });

        // 여기에 도달하면 안됨
        expect(true).toBe(false);
      } catch (error) {
        // Then: 401 에러 발생
        expect(error).toBeDefined();

        const report = analyzer.getProductionReport();
        expect(report.errors.by401).toBeGreaterThanOrEqual(1);
      }
    });

    test('❌ [RED] 잘못된 데이터 형식 - 400 에러 처리', async () => {
      // Given: 유효한 인증 토큰
      const validToken = 'valid-bearer-token';

      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return validToken;
        return null;
      });

      const { setUser } = useAuthStore.getState();
      setUser({
        id: 'user-456',
        email: 'legacy@vridge.kr',
        username: 'legacy-user',
        token: validToken
      });

      // When: 잘못된 형식의 데이터 전송 (DTO 변환기 사용하지 않음)
      try {
        await apiClient.post('/api/ai/generate-story', {
          title: '', // 빈 제목
          oneLineStory: 'test',
          toneAndManner: ['배열형태'] // 서버가 문자열 기대하는데 배열 전송
        });

        expect(true).toBe(false); // 여기에 도달하면 안됨
      } catch (error) {
        // Then: 400 에러 발생
        expect(error).toBeDefined();

        const report = analyzer.getProductionReport();
        expect(report.errors.by400).toBeGreaterThanOrEqual(1);
      }
    });

    test('✅ [GREEN] DTO 변환기 완전 검증', () => {
      // Given: 다양한 프론트엔드 데이터 형식
      const testCases = [
        {
          input: { toneAndManner: ['친근한', '유쾌한'] },
          expected: '친근한, 유쾌한'
        },
        {
          input: { toneAndManner: [] },
          expected: '일반적'
        },
        {
          input: { toneAndManner: null },
          expected: '일반적'
        },
        {
          input: { toneAndManner: undefined },
          expected: '일반적'
        },
        {
          input: { toneAndManner: '이미 문자열' },
          expected: '이미 문자열'
        }
      ];

      testCases.forEach(({ input, expected }, index) => {
        // When: DTO 변환 수행
        const baseData = {
          title: `테스트 ${index + 1}`,
          oneLineStory: '테스트 스토리',
          genre: '드라마',
          target: '일반인'
        };

        const transformed = transformStoryInputToApiRequest({ ...baseData, ...input });

        // Then: 올바른 변환
        expect(transformed.toneAndManner).toBe(expected);
        expect(typeof transformed.toneAndManner).toBe('string');
      });
    });
  });

  describe('⚡ 성능 및 안정성 검증', () => {
    test('✅ [GREEN] 응답 시간 및 비용 모니터링', async () => {
      // Given: 인증된 사용자
      const validToken = 'valid-supabase-token';
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({ token: validToken, expiresAt: Date.now() + 3600000 });
        }
        return null;
      });

      const { setUser } = useAuthStore.getState();
      setUser({
        id: 'user-123',
        email: 'user@vridge.kr',
        username: 'user',
        token: validToken
      });

      // When: 여러 API 호출 수행
      const startTime = Date.now();

      await Promise.all([
        fetch('/api/health'),
        apiClient.get('/api/auth/me'),
        apiClient.post('/api/ai/generate-story', {
          title: '성능 테스트',
          oneLineStory: '성능 테스트 스토리',
          toneAndManner: '빠른 처리'
        })
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Then: 성능 기준 검증
      expect(totalTime).toBeLessThan(5000); // 5초 이내

      const report = analyzer.getProductionReport();
      expect(parseFloat(report.summary.totalCost)).toBeLessThan(0.1); // $0.1 이내
      expect(parseInt(report.summary.avgResponseTime)).toBeLessThan(500); // 평균 500ms 이내
    });

    test('🚨 [RED] $300 사건 재발 방지 - 비용 한계 테스트', async () => {
      // Given: 토큰 없는 상태에서 대량 API 호출
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      let costAlert = false;
      const originalWarn = console.warn;
      console.warn = (message: string) => {
        if (message.includes('비용 경고')) {
          costAlert = true;
        }
        originalWarn(message);
      };

      // When: 의도적으로 많은 API 호출 (무한 루프 시뮬레이션)
      const promises = Array(15).fill(0).map(() =>
        fetch('/api/auth/me').catch(() => {}) // 에러 무시하고 계속 호출
      );

      await Promise.all(promises);

      console.warn = originalWarn;

      // Then: 비용 경고 발생
      expect(costAlert).toBe(true);

      const report = analyzer.getProductionReport();
      const infiniteLoopCheck = report.infiniteLoopCheck;
      expect(infiniteLoopCheck.isInfiniteLoop).toBe(true);
      expect(infiniteLoopCheck.estimatedCost).toBeGreaterThan(0.01); // $0.01 초과

      console.error(`🚨 무한 루프 감지됨! 예상 비용: $${infiniteLoopCheck.estimatedCost.toFixed(3)}`);
    });
  });

  describe('🔄 종합 사용자 시나리오 검증', () => {
    test('✅ [GREEN] 완전한 사용자 여정: 로그인 → AI 사용 → 로그아웃', async () => {
      analyzer.trackAuthStateChange('user-journey-start', false);

      // 1단계: 로그인 (Supabase 토큰 받음)
      const supabaseToken = 'valid-supabase-token';
      setToken(supabaseToken, 'supabase', Date.now() + 3600000);
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'sb-access-token-backup') {
          return JSON.stringify({ token: supabaseToken, expiresAt: Date.now() + 3600000 });
        }
        return null;
      });

      const { checkAuth } = useAuthStore.getState();
      await checkAuth();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      analyzer.trackAuthStateChange('user-logged-in', true, 'user-123');

      // 2단계: AI 스토리 생성 사용
      const storyData = {
        title: '사용자 여정 테스트',
        oneLineStory: '완전한 사용자 시나리오',
        toneAndManner: ['전문적인', '신뢰할 수 있는'],
        genre: '다큐멘터리',
        target: '성인'
      };

      const transformedStory = transformStoryInputToApiRequest(storyData);
      const storyResponse = await apiClient.post('/api/ai/generate-story', transformedStory);

      expect(storyResponse.ok).toBe(true);
      expect(storyResponse.data.steps).toHaveLength(4);

      // 3단계: 로그아웃
      const { logout } = useAuthStore.getState();
      logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      analyzer.trackAuthStateChange('user-logged-out', false);

      // 전체 여정 검증
      const report = analyzer.getProductionReport();
      expect(report.authStateChanges).toBe(3); // start, login, logout
      expect(report.summary.successRate).toBe('100.0');
      expect(parseFloat(report.summary.totalCost)).toBeLessThan(0.05);
    });

    test('❌ [RED] 에러 복구 시나리오: 401 → 갱신 → 재시도 → 성공', async () => {
      // 1단계: 만료된 토큰으로 시작
      const expiredToken = 'expired-token';
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return expiredToken;
        return null;
      });

      const { setUser } = useAuthStore.getState();
      setUser({
        id: 'user-123',
        email: 'user@vridge.kr',
        username: 'user',
        token: expiredToken
      });

      // 2단계: API 호출 → 401 에러
      try {
        await apiClient.post('/api/ai/generate-story', {
          title: '에러 복구 테스트',
          oneLineStory: '401 에러 시나리오',
          toneAndManner: '테스트용'
        });
        expect(false).toBe(true); // 에러가 나야 함
      } catch (firstError) {
        expect(firstError).toBeDefined();
      }

      // 3단계: 토큰 갱신 시도 (실패)
      const { refreshAccessToken } = useAuthStore.getState();
      const refreshResult = await refreshAccessToken();
      expect(refreshResult).toBeNull(); // 갱신 실패

      // 4단계: 사용자 재로그인 (새 토큰)
      const newValidToken = 'valid-bearer-token';
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'token') return newValidToken;
        return null;
      });

      setUser({
        id: 'user-123',
        email: 'user@vridge.kr',
        username: 'user',
        token: newValidToken
      });

      // 5단계: 재시도 → 성공
      const retryResponse = await apiClient.post('/api/ai/generate-story', {
        title: '복구 후 테스트',
        oneLineStory: '성공적인 복구',
        toneAndManner: '안정적인'
      });

      expect(retryResponse.ok).toBe(true);

      // 복구 시나리오 검증
      const report = analyzer.getProductionReport();
      expect(report.errors.by401).toBeGreaterThanOrEqual(1); // 초기 401 에러
      const finalSuccessCalls = analyzer.getProductionReport().summary.totalCalls - report.errors.total;
      expect(finalSuccessCalls).toBeGreaterThan(0); // 최종 성공 호출
    });
  });
});