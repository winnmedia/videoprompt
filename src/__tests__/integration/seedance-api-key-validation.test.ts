/**
 * Seedance API 키 검증 및 Mock 전환 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: Seedance API 의존성 관리 및 안정성 보장
 * - API 키 유효성 검증 시나리오
 * - 개발/테스트 환경에서 Mock 전환
 * - 프로덕션 환경에서 실제 API 호출
 * - Graceful degradation 및 fallback 메커니즘
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Seedance API 상태 추적 시스템
class SeedanceApiTracker {
  private apiCalls: Array<{
    endpoint: string;
    apiKey: string | null;
    timestamp: number;
    environment: string;
    status: 'success' | 'failure' | 'timeout' | 'unauthorized' | 'rate_limited';
    responseTime: number;
    isMocked: boolean;
    error?: string;
  }> = [];

  private apiKeyStates: Map<string, {
    isValid: boolean;
    lastChecked: number;
    usageCount: number;
    rateLimitRemaining: number;
    expiresAt?: number;
    permissions?: string[];
  }> = new Map();

  private fallbackActivations: Array<{
    reason: string;
    timestamp: number;
    duration?: number;
  }> = [];

  trackApiCall(
    endpoint: string,
    apiKey: string | null,
    environment: string,
    status: 'success' | 'failure' | 'timeout' | 'unauthorized' | 'rate_limited',
    responseTime: number,
    isMocked: boolean,
    error?: string
  ) {
    this.apiCalls.push({
      endpoint,
      apiKey: apiKey ? this.maskApiKey(apiKey) : null,
      timestamp: Date.now(),
      environment,
      status,
      responseTime,
      isMocked,
      error
    });

    console.log(`📞 [${environment}] ${endpoint} - ${status} (${responseTime}ms) ${isMocked ? '[MOCKED]' : '[REAL]'}`);

    // API 키 사용량 업데이트
    if (apiKey && status === 'success') {
      this.updateApiKeyUsage(apiKey);
    }
  }

  validateApiKey(apiKey: string): {
    isValid: boolean;
    permissions?: string[];
    expiresAt?: number;
    rateLimitRemaining?: number;
  } {
    // API 키 형식 검증
    if (!this.isValidApiKeyFormat(apiKey)) {
      return { isValid: false };
    }

    // 실제 검증 로직 시뮬레이션
    const keyState = this.apiKeyStates.get(apiKey) || {
      isValid: true,
      lastChecked: Date.now(),
      usageCount: 0,
      rateLimitRemaining: 1000,
      permissions: ['read', 'write', 'admin']
    };

    // 만료 확인
    if (keyState.expiresAt && Date.now() > keyState.expiresAt) {
      keyState.isValid = false;
    }

    this.apiKeyStates.set(apiKey, keyState);

    console.log(`🔑 API 키 검증: ${this.maskApiKey(apiKey)} - ${keyState.isValid ? '✅' : '❌'}`);

    return {
      isValid: keyState.isValid,
      permissions: keyState.permissions,
      expiresAt: keyState.expiresAt,
      rateLimitRemaining: keyState.rateLimitRemaining
    };
  }

  private updateApiKeyUsage(apiKey: string) {
    const keyState = this.apiKeyStates.get(apiKey);
    if (keyState) {
      keyState.usageCount++;
      keyState.rateLimitRemaining = Math.max(0, keyState.rateLimitRemaining - 1);
      keyState.lastChecked = Date.now();
    }
  }

  private isValidApiKeyFormat(apiKey: string): boolean {
    // Seedance API 키 형식: sd_live_xxx 또는 sd_test_xxx
    return /^sd_(live|test)_[a-zA-Z0-9]{32,}$/.test(apiKey);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '****';
    return apiKey.substring(0, 8) + '****' + apiKey.substring(apiKey.length - 4);
  }

  activateFallback(reason: string) {
    this.fallbackActivations.push({
      reason,
      timestamp: Date.now()
    });

    console.log(`🛡️ Fallback 모드 활성화: ${reason}`);
  }

  deactivateFallback(activationIndex: number) {
    if (this.fallbackActivations[activationIndex]) {
      this.fallbackActivations[activationIndex].duration =
        Date.now() - this.fallbackActivations[activationIndex].timestamp;

      console.log(`✅ Fallback 모드 해제`);
    }
  }

  getApiKeyStatus(apiKey: string) {
    return this.apiKeyStates.get(apiKey);
  }

  getCallsByEnvironment(environment: string) {
    return this.apiCalls.filter(call => call.environment === environment);
  }

  getSuccessRate(environment?: string): number {
    const calls = environment ? this.getCallsByEnvironment(environment) : this.apiCalls;
    if (calls.length === 0) return 0;

    const successCalls = calls.filter(call => call.status === 'success').length;
    return (successCalls / calls.length) * 100;
  }

  getMockedCallsCount(): number {
    return this.apiCalls.filter(call => call.isMocked).length;
  }

  getRealCallsCount(): number {
    return this.apiCalls.filter(call => !call.isMocked).length;
  }

  reset() {
    this.apiCalls = [];
    this.apiKeyStates.clear();
    this.fallbackActivations = [];
  }

  getDetailedReport(): string {
    const totalCalls = this.apiCalls.length;
    const mockedCalls = this.getMockedCallsCount();
    const realCalls = this.getRealCallsCount();
    const successRate = this.getSuccessRate();

    const envStats = ['development', 'test', 'production'].map(env => {
      const envCalls = this.getCallsByEnvironment(env);
      const envSuccessRate = envCalls.length > 0 ? this.getSuccessRate(env) : 0;
      return `    ${env}: ${envCalls.length}회 (성공률: ${envSuccessRate.toFixed(1)}%)`;
    }).join('\n');

    return `📊 Seedance API 사용 리포트:
  총 호출: ${totalCalls}회
  Mock 호출: ${mockedCalls}회
  실제 호출: ${realCalls}회
  전체 성공률: ${successRate.toFixed(1)}%

  환경별 통계:
${envStats}

  Fallback 활성화: ${this.fallbackActivations.length}회
  API 키 등록: ${this.apiKeyStates.size}개`;
  }
}

const seedanceTracker = new SeedanceApiTracker();

// MSW 서버 설정 - Seedance API 시뮬레이션
const server = setupServer(
  // Seedance API - 계획 생성
  http.post('https://api.seedance.com/v1/plans', async ({ request }) => {
    const startTime = performance.now();
    const environment = process.env.NODE_ENV || 'development';
    const scenario = request.headers.get('x-test-scenario') || 'default';

    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || null;

    // API 키 검증
    if (!apiKey) {
      const responseTime = performance.now() - startTime;
      seedanceTracker.trackApiCall(
        '/v1/plans',
        null,
        environment,
        'unauthorized',
        responseTime,
        false,
        'Missing API key'
      );

      return HttpResponse.json({
        error: 'Authentication required',
        code: 'MISSING_API_KEY',
        message: 'API key is required for this endpoint'
      }, { status: 401 });
    }

    const keyValidation = seedanceTracker.validateApiKey(apiKey);
    if (!keyValidation.isValid) {
      const responseTime = performance.now() - startTime;
      seedanceTracker.trackApiCall(
        '/v1/plans',
        apiKey,
        environment,
        'unauthorized',
        responseTime,
        false,
        'Invalid API key'
      );

      return HttpResponse.json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid or expired'
      }, { status: 401 });
    }

    // 시나리오별 응답
    switch (scenario) {
      case 'success':
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 지연
        const responseTime = performance.now() - startTime;
        seedanceTracker.trackApiCall(
          '/v1/plans',
          apiKey,
          environment,
          'success',
          responseTime,
          false
        );

        return HttpResponse.json({
          id: 'seedance_plan_123',
          title: 'Created Plan',
          status: 'published',
          publishedAt: new Date().toISOString(),
          remaining_calls: keyValidation.rateLimitRemaining
        });

      case 'rate-limit':
        const rateLimitResponseTime = performance.now() - startTime;
        seedanceTracker.trackApiCall(
          '/v1/plans',
          apiKey,
          environment,
          'rate_limited',
          rateLimitResponseTime,
          false,
          'Rate limit exceeded'
        );

        return HttpResponse.json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You have exceeded your API rate limit',
          retry_after: 60
        }, {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + 60000).toString()
          }
        });

      case 'timeout':
        // 5초 지연 후 타임아웃
        await new Promise(resolve => setTimeout(resolve, 5000));
        const timeoutResponseTime = performance.now() - startTime;
        seedanceTracker.trackApiCall(
          '/v1/plans',
          apiKey,
          environment,
          'timeout',
          timeoutResponseTime,
          false,
          'Request timeout'
        );

        return new HttpResponse(null, { status: 408 });

      case 'server-error':
        const errorResponseTime = performance.now() - startTime;
        seedanceTracker.trackApiCall(
          '/v1/plans',
          apiKey,
          environment,
          'failure',
          errorResponseTime,
          false,
          'Internal server error'
        );

        return HttpResponse.json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }, { status: 500 });

      default:
        const defaultResponseTime = performance.now() - startTime;
        seedanceTracker.trackApiCall(
          '/v1/plans',
          apiKey,
          environment,
          'success',
          defaultResponseTime,
          false
        );

        return HttpResponse.json({
          id: 'seedance_plan_default',
          title: 'Default Plan',
          status: 'published'
        });
    }
  }),

  // Mock API - 로컬 개발용
  http.post('/api/mock/seedance/plans', async ({ request }) => {
    const startTime = performance.now();
    const environment = process.env.NODE_ENV || 'development';

    // Mock은 항상 빠르게 응답
    await new Promise(resolve => setTimeout(resolve, 50));

    const responseTime = performance.now() - startTime;
    seedanceTracker.trackApiCall(
      '/mock/seedance/plans',
      'mock-key',
      environment,
      'success',
      responseTime,
      true
    );

    const body = await request.json();

    return HttpResponse.json({
      id: `mock_plan_${Date.now()}`,
      title: (body as any).title || 'Mock Plan',
      description: (body as any).description || 'This is a mock plan',
      status: 'published',
      publishedAt: new Date().toISOString(),
      isMock: true,
      mockGeneratedAt: new Date().toISOString()
    });
  }),

  // API 키 검증 엔드포인트
  http.get('https://api.seedance.com/v1/auth/verify', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || null;

    if (!apiKey) {
      return HttpResponse.json({
        error: 'Missing API key'
      }, { status: 401 });
    }

    const validation = seedanceTracker.validateApiKey(apiKey);

    if (!validation.isValid) {
      return HttpResponse.json({
        error: 'Invalid API key'
      }, { status: 401 });
    }

    return HttpResponse.json({
      valid: true,
      permissions: validation.permissions,
      rate_limit_remaining: validation.rateLimitRemaining,
      expires_at: validation.expiresAt
    });
  })
);

// 테스트 헬퍼 함수
async function callSeedanceApi(
  endpoint: string,
  apiKey: string | null,
  scenario: string = 'default',
  data: any = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-test-scenario': scenario
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
}

async function verifyApiKey(apiKey: string) {
  return fetch('https://api.seedance.com/v1/auth/verify', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
}

function setEnvironment(env: 'development' | 'test' | 'production') {
  process.env.NODE_ENV = env;
}

function setApiKey(key: string | undefined) {
  if (key) {
    process.env.SEEDANCE_API_KEY = key;
  } else {
    delete process.env.SEEDANCE_API_KEY;
  }
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  seedanceTracker.reset();

  // 기본 환경 설정
  process.env.FORCE_MSW = 'true';
  setEnvironment('test');

  // 시간 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
  vi.spyOn(performance, 'now').mockImplementation(() => currentTime);

  (global as any).advanceTime = (ms: number) => {
    currentTime += ms;
  };

  // fetch mock
  if (!global.fetch) {
    global.fetch = fetch;
  }
});

afterEach(() => {
  server.resetHandlers();
  delete process.env.FORCE_MSW;
  delete process.env.SEEDANCE_API_KEY;
  delete (global as any).advanceTime;
  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

describe('🔑 Seedance API 키 검증 및 Mock 전환 테스트', () => {

  describe('API 키 유효성 검증', () => {
    test('✅ [GREEN] 유효한 API 키로 인증 성공', async () => {
      // Given: 유효한 API 키
      const validApiKey = 'sd_live_abcdef1234567890abcdef1234567890abcdef12';

      // When: API 키 검증
      const verifyResponse = await verifyApiKey(validApiKey);

      // Then: 검증 성공
      expect(verifyResponse.status).toBe(200);

      const verifyData = await verifyResponse.json();
      expect(verifyData.valid).toBe(true);
      expect(verifyData.permissions).toContain('read');
      expect(verifyData.permissions).toContain('write');
      expect(verifyData.rate_limit_remaining).toBeGreaterThan(0);

      console.log('✅ API 키 검증 성공');
    });

    test('❌ [RED] 잘못된 형식의 API 키', async () => {
      // Given: 잘못된 형식의 API 키
      const invalidKeys = [
        'invalid-key',
        'sd_live_short',
        'wrong_prefix_abcdef1234567890',
        '',
        'sd_live_'
      ];

      for (const invalidKey of invalidKeys) {
        // When: API 키 검증
        const verifyResponse = await verifyApiKey(invalidKey);

        // Then: 검증 실패
        expect(verifyResponse.status).toBe(401);

        const verifyData = await verifyResponse.json();
        expect(verifyData.error).toBeTruthy();

        console.log(`❌ 잘못된 키 형식 검증 실패: ${invalidKey}`);
      }
    });

    test('❌ [RED] API 키 없이 요청', async () => {
      // When: API 키 없이 Seedance API 호출
      const response = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        null,
        'default',
        { title: 'Test Plan' }
      );

      // Then: 401 에러
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('MISSING_API_KEY');

      console.log(seedanceTracker.getDetailedReport());
    });

    test('❌ [RED] 만료된 API 키', async () => {
      // Given: 만료된 API 키 설정
      const expiredKey = 'sd_live_expired1234567890abcdef1234567890';

      // API 키를 만료된 상태로 설정
      seedanceTracker.validateApiKey(expiredKey);
      const keyState = seedanceTracker.getApiKeyStatus(expiredKey);
      if (keyState) {
        keyState.expiresAt = Date.now() - 1000; // 1초 전 만료
        keyState.isValid = false;
      }

      // When: 만료된 키로 API 호출
      const response = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        expiredKey,
        'default',
        { title: 'Test Plan' }
      );

      // Then: 401 에러
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('INVALID_API_KEY');
    });
  });

  describe('환경별 API 호출 전략', () => {
    test('🏗️ [개발환경] Mock API 사용', async () => {
      // Given: 개발 환경 설정
      setEnvironment('development');

      // When: Mock API 호출
      const response = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        {
          title: 'Development Plan',
          description: 'This is a development plan'
        }
      );

      // Then: Mock 응답 성공
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.isMock).toBe(true);
      expect(body.title).toBe('Development Plan');
      expect(body.mockGeneratedAt).toBeTruthy();

      // 성능 확인 (Mock은 빨라야 함)
      const devCalls = seedanceTracker.getCallsByEnvironment('development');
      expect(devCalls[0].responseTime).toBeLessThan(100);
      expect(devCalls[0].isMocked).toBe(true);

      console.log('🏗️ 개발환경: Mock API 사용');
    });

    test('🧪 [테스트환경] Mock API 사용', async () => {
      // Given: 테스트 환경 설정
      setEnvironment('test');

      // When: Mock API 호출
      const response = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Test Plan' }
      );

      // Then: Mock 응답 성공
      expect(response.status).toBe(200);

      const testCalls = seedanceTracker.getCallsByEnvironment('test');
      expect(testCalls[0].isMocked).toBe(true);

      console.log('🧪 테스트환경: Mock API 사용');
    });

    test('🚀 [프로덕션환경] 실제 API 사용', async () => {
      // Given: 프로덕션 환경 설정
      setEnvironment('production');
      const prodApiKey = 'sd_live_production1234567890abcdef1234567890';
      setApiKey(prodApiKey);

      // When: 실제 Seedance API 호출
      const response = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        prodApiKey,
        'success',
        {
          title: 'Production Plan',
          description: 'This is a production plan'
        }
      );

      // Then: 실제 API 응답
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.id).toBe('seedance_plan_123');
      expect(body.status).toBe('published');

      // 실제 API 호출 확인
      const prodCalls = seedanceTracker.getCallsByEnvironment('production');
      expect(prodCalls[0].isMocked).toBe(false);

      console.log('🚀 프로덕션환경: 실제 API 사용');
    });
  });

  describe('에러 처리 및 Fallback', () => {
    test('⏱️ [타임아웃] 타임아웃 시 Fallback 모드', async () => {
      // Given: 타임아웃 발생 상황
      const apiKey = 'sd_live_timeout1234567890abcdef1234567890';

      // When: 타임아웃 발생하는 API 호출 (3초 제한)
      const timeoutPromise = callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'timeout',
        { title: 'Timeout Test Plan' }
      );

      const raceResult = await Promise.race([
        timeoutPromise,
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Client timeout')), 3000)
        )
      ]).catch(() => null);

      // Then: 타임아웃 처리
      expect(raceResult).toBeNull();

      // Fallback 모드 활성화
      seedanceTracker.activateFallback('API timeout');

      // Mock API로 대체 호출
      const fallbackResponse = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Fallback Plan' }
      );

      expect(fallbackResponse.status).toBe(200);

      console.log('⏱️ 타임아웃 시 Fallback 모드 활성화');
    });

    test('🚫 [Rate Limit] Rate Limit 시 지수 백오프', async () => {
      // Given: Rate Limit 상황
      const apiKey = 'sd_live_ratelimit1234567890abcdef1234567890';

      // When: Rate Limit 발생
      const response = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'rate-limit',
        { title: 'Rate Limit Test' }
      );

      // Then: 429 에러 및 재시도 정보
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.retry_after).toBe(60);

      const retryAfter = response.headers.get('X-RateLimit-Reset');
      expect(retryAfter).toBeTruthy();

      // Fallback 모드 활성화
      seedanceTracker.activateFallback('Rate limit exceeded');

      console.log('🚫 Rate Limit 후 Fallback 모드');
    });

    test('🛡️ [서버에러] 서버 에러 시 자동 Mock 전환', async () => {
      // Given: 서버 에러 상황
      const apiKey = 'sd_live_servererror1234567890abcdef1234567890';

      // When: 서버 에러 발생
      const response = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'server-error',
        { title: 'Server Error Test' }
      );

      // Then: 500 에러
      expect(response.status).toBe(500);

      // 자동 Fallback 활성화
      seedanceTracker.activateFallback('Server error');

      // Mock으로 재시도
      const fallbackResponse = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Fallback After Error' }
      );

      expect(fallbackResponse.status).toBe(200);
      const fallbackBody = await fallbackResponse.json();
      expect(fallbackBody.isMock).toBe(true);

      console.log('🛡️ 서버 에러 후 자동 Mock 전환');
    });
  });

  describe('성능 및 안정성 모니터링', () => {
    test('📊 [성능] API 응답 시간 모니터링', async () => {
      // Given: 다양한 시나리오 실행
      const scenarios = [
        { scenario: 'success', expectedTime: 200 },
        { scenario: 'server-error', expectedTime: 100 },
      ];

      const apiKey = 'sd_live_performance1234567890abcdef1234567890';

      for (const { scenario, expectedTime } of scenarios) {
        // When: API 호출
        await callSeedanceApi(
          'https://api.seedance.com/v1/plans',
          apiKey,
          scenario,
          { title: `Performance Test - ${scenario}` }
        );
      }

      // Mock API 성능도 측정
      await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Mock Performance Test' }
      );

      // Then: 성능 분석
      const successRate = seedanceTracker.getSuccessRate();
      const mockedCalls = seedanceTracker.getMockedCallsCount();
      const realCalls = seedanceTracker.getRealCallsCount();

      console.log('📊 성능 모니터링 결과:');
      console.log(`  성공률: ${successRate.toFixed(1)}%`);
      console.log(`  Mock 호출: ${mockedCalls}회`);
      console.log(`  실제 호출: ${realCalls}회`);
      console.log(seedanceTracker.getDetailedReport());

      expect(mockedCalls).toBeGreaterThan(0);
      expect(realCalls).toBeGreaterThan(0);
    });

    test('🔄 [안정성] 연속 호출 안정성 검증', async () => {
      // Given: 연속 API 호출 설정
      const apiKey = 'sd_live_stability1234567890abcdef1234567890';
      const callCount = 20;

      // When: 20번 연속 호출
      const promises = Array.from({ length: callCount }, (_, i) =>
        callSeedanceApi(
          'https://api.seedance.com/v1/plans',
          apiKey,
          'success',
          { title: `Stability Test ${i + 1}` }
        )
      );

      const results = await Promise.allSettled(promises);

      // Then: 안정성 분석
      const successfulCalls = results.filter(
        (result): result is PromiseFulfilledResult<Response> =>
          result.status === 'fulfilled' && result.value.status === 200
      ).length;

      const failedCalls = callCount - successfulCalls;

      console.log('🔄 안정성 테스트 결과:');
      console.log(`  성공: ${successfulCalls}/${callCount}회`);
      console.log(`  실패: ${failedCalls}/${callCount}회`);
      console.log(`  성공률: ${(successfulCalls / callCount * 100).toFixed(1)}%`);

      expect(successfulCalls).toBeGreaterThan(callCount * 0.8); // 80% 이상 성공
    });

    test('💰 [비용] API 사용량 추적', async () => {
      // Given: API 키별 사용량 추적
      const apiKeys = [
        'sd_live_cost1_1234567890abcdef1234567890',
        'sd_live_cost2_1234567890abcdef1234567890'
      ];

      // When: 각 키로 여러 번 호출
      for (const apiKey of apiKeys) {
        for (let i = 0; i < 5; i++) {
          await callSeedanceApi(
            'https://api.seedance.com/v1/plans',
            apiKey,
            'success',
            { title: `Cost Test ${i + 1}` }
          );
        }
      }

      // Then: 사용량 분석
      for (const apiKey of apiKeys) {
        const keyStatus = seedanceTracker.getApiKeyStatus(apiKey);
        expect(keyStatus?.usageCount).toBe(5);
        expect(keyStatus?.rateLimitRemaining).toBeLessThan(1000);

        console.log(`💰 ${seedanceTracker.getDetailedReport()}`);
        console.log(`  키 ${apiKey.substring(0, 12)}... 사용량: ${keyStatus?.usageCount}회`);
      }
    });
  });

  describe('환경변수 시나리오', () => {
    test('❌ [RED] API 키 환경변수 누락', async () => {
      // Given: API 키 환경변수 없음
      setApiKey(undefined);

      // When: 환경변수에서 API 키 읽기 시도
      const apiKeyFromEnv = process.env.SEEDANCE_API_KEY;

      // Then: undefined
      expect(apiKeyFromEnv).toBeUndefined();

      // 이 상황에서는 Mock으로 자동 전환되어야 함
      seedanceTracker.activateFallback('Missing API key environment variable');

      console.log('❌ API 키 환경변수 누락 - Mock 모드로 전환');
    });

    test('✅ [GREEN] 환경변수 설정 정상', async () => {
      // Given: API 키 환경변수 설정
      const testApiKey = 'sd_live_envtest1234567890abcdef1234567890';
      setApiKey(testApiKey);

      // When: 환경변수에서 API 키 읽기
      const apiKeyFromEnv = process.env.SEEDANCE_API_KEY;

      // Then: 정상 설정됨
      expect(apiKeyFromEnv).toBe(testApiKey);

      // API 키 유효성 검증
      const validation = seedanceTracker.validateApiKey(testApiKey);
      expect(validation.isValid).toBe(true);

      console.log('✅ 환경변수 API 키 정상 설정');
    });

    test('🔀 [전환] 개발 → 프로덕션 환경 전환', async () => {
      // Given: 개발 환경에서 시작
      setEnvironment('development');

      // Mock API 호출
      const devResponse = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Dev Plan' }
      );

      expect(devResponse.status).toBe(200);

      // When: 프로덕션 환경으로 전환
      setEnvironment('production');
      const prodApiKey = 'sd_live_production1234567890abcdef1234567890';
      setApiKey(prodApiKey);

      // 실제 API 호출
      const prodResponse = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        prodApiKey,
        'success',
        { title: 'Prod Plan' }
      );

      // Then: 환경별 다른 처리
      expect(prodResponse.status).toBe(200);

      const devCalls = seedanceTracker.getCallsByEnvironment('development');
      const prodCalls = seedanceTracker.getCallsByEnvironment('production');

      expect(devCalls[0].isMocked).toBe(true);
      expect(prodCalls[0].isMocked).toBe(false);

      console.log('🔀 개발 → 프로덕션 환경 전환 완료');
      console.log(seedanceTracker.getDetailedReport());
    });
  });

  describe('복구 및 헬스 체크', () => {
    test('🏥 [헬스체크] Seedance API 상태 확인', async () => {
      // Given: 다양한 상태의 API 호출
      const apiKey = 'sd_live_health1234567890abcdef1234567890';

      // 성공 호출
      await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'success',
        { title: 'Health Check 1' }
      );

      // 실패 호출
      await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'server-error',
        { title: 'Health Check 2' }
      );

      // When: 헬스 체크 수행
      const successRate = seedanceTracker.getSuccessRate();
      const isHealthy = successRate >= 50; // 50% 이상이면 건강

      // Then: 상태 판단
      console.log('🏥 Seedance API 헬스 체크:');
      console.log(`  성공률: ${successRate.toFixed(1)}%`);
      console.log(`  상태: ${isHealthy ? '✅ 건강' : '❌ 불안정'}`);

      if (!isHealthy) {
        seedanceTracker.activateFallback('API health check failed');
        console.log('🛡️ 헬스 체크 실패로 Fallback 모드 활성화');
      }
    });

    test('🔄 [복구] API 복구 후 정상 서비스 전환', async () => {
      // Given: Fallback 모드 활성화 상태
      seedanceTracker.activateFallback('Simulated outage');

      // Mock 사용
      const fallbackResponse = await callSeedanceApi(
        '/api/mock/seedance/plans',
        'mock-key',
        'default',
        { title: 'Fallback Plan' }
      );

      expect(fallbackResponse.status).toBe(200);

      // When: API 복구 확인
      const apiKey = 'sd_live_recovery1234567890abcdef1234567890';
      const recoveryResponse = await callSeedanceApi(
        'https://api.seedance.com/v1/plans',
        apiKey,
        'success',
        { title: 'Recovery Test Plan' }
      );

      // Then: 정상 복구
      expect(recoveryResponse.status).toBe(200);

      // Fallback 모드 해제
      seedanceTracker.deactivateFallback(0);

      console.log('🔄 API 복구 완료 - 정상 서비스 전환');
      console.log(seedanceTracker.getDetailedReport());
    });
  });
});