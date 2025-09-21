/**
 * 환경변수 시나리오별 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: 다양한 환경설정 조합 검증
 * - 필수/선택적 환경변수 누락 시나리오
 * - 잘못된 형식/값의 환경변수 처리
 * - 환경별 설정 우선순위 및 상속
 * - 런타임 환경변수 변경 감지
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// 환경변수 상태 추적 시스템
class EnvironmentTracker {
  private environmentStates: Array<{
    timestamp: number;
    environment: string;
    variables: Record<string, string | undefined>;
    validation: {
      isValid: boolean;
      missingRequired: string[];
      invalidFormats: Array<{ key: string; value: string; reason: string }>;
      warnings: string[];
    };
    apiCalls: Array<{
      endpoint: string;
      success: boolean;
      fallbackUsed: boolean;
      error?: string;
    }>;
  }> = [];

  private readonly REQUIRED_VARIABLES = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  private readonly OPTIONAL_VARIABLES = [
    'SEEDANCE_API_KEY',
    'REDIS_URL',
    'NEXT_PUBLIC_APP_URL',
    'DATABASE_URL'
  ];

  private readonly VALIDATION_RULES = {
    NEXT_PUBLIC_SUPABASE_URL: {
      pattern: /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/,
      description: 'Must be a valid Supabase URL'
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      pattern: /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
      description: 'Must be a valid JWT token'
    },
    SEEDANCE_API_KEY: {
      pattern: /^sd_(live|test)_[a-zA-Z0-9]{32,}$/,
      description: 'Must be a valid Seedance API key'
    },
    REDIS_URL: {
      pattern: /^redis:\/\/.+$/,
      description: 'Must be a valid Redis URL'
    },
    NEXT_PUBLIC_APP_URL: {
      pattern: /^https?:\/\/.+$/,
      description: 'Must be a valid HTTP/HTTPS URL'
    },
    DATABASE_URL: {
      pattern: /^postgresql:\/\/.+$/,
      description: 'Must be a valid PostgreSQL connection string'
    }
  };

  captureEnvironmentState(environment: string = process.env.NODE_ENV || 'development') {
    const variables: Record<string, string | undefined> = {};

    // 모든 관련 환경변수 수집
    [...this.REQUIRED_VARIABLES, ...this.OPTIONAL_VARIABLES].forEach(key => {
      variables[key] = process.env[key];
    });

    // 추가 환경변수들
    variables['NODE_ENV'] = process.env.NODE_ENV;
    variables['VERCEL_ENV'] = process.env.VERCEL_ENV;
    variables['CI'] = process.env.CI;

    const validation = this.validateEnvironment(variables);

    const state = {
      timestamp: Date.now(),
      environment,
      variables,
      validation,
      apiCalls: []
    };

    this.environmentStates.push(state);

    return state;
  }

  private validateEnvironment(variables: Record<string, string | undefined>) {
    const missingRequired: string[] = [];
    const invalidFormats: Array<{ key: string; value: string; reason: string }> = [];
    const warnings: string[] = [];

    // 필수 변수 검사
    this.REQUIRED_VARIABLES.forEach(key => {
      if (!variables[key]) {
        missingRequired.push(key);
      }
    });

    // 형식 검증
    Object.entries(this.VALIDATION_RULES).forEach(([key, rule]) => {
      const value = variables[key];
      if (value && !rule.pattern.test(value)) {
        invalidFormats.push({
          key,
          value: this.maskSensitiveValue(key, value),
          reason: rule.description
        });
      }
    });

    // 경고 검사
    if (variables['NODE_ENV'] === 'production' && !variables['SEEDANCE_API_KEY']) {
      warnings.push('Seedance API key is missing in production environment');
    }

    if (variables['NODE_ENV'] === 'development' && variables['SEEDANCE_API_KEY']?.startsWith('sd_live_')) {
      warnings.push('Using live Seedance API key in development environment');
    }

    const isValid = missingRequired.length === 0 && invalidFormats.length === 0;

    return {
      isValid,
      missingRequired,
      invalidFormats,
      warnings
    };
  }

  private maskSensitiveValue(key: string, value: string): string {
    const sensitiveKeys = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'URL'];

    if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
      if (value.length <= 8) return '****';
      return value.substring(0, 4) + '****' + value.substring(value.length - 4);
    }

    return value;
  }

  private formatValidationSummary(validation: any): string {
    const parts = [];

    if (validation.isValid) {
      parts.push('✅ 유효');
    } else {
      parts.push('❌ 무효');
    }

    if (validation.missingRequired.length > 0) {
      parts.push(`누락: ${validation.missingRequired.length}개`);
    }

    if (validation.invalidFormats.length > 0) {
      parts.push(`형식오류: ${validation.invalidFormats.length}개`);
    }

    if (validation.warnings.length > 0) {
      parts.push(`경고: ${validation.warnings.length}개`);
    }

    return parts.join(', ');
  }

  trackApiCall(endpoint: string, success: boolean, fallbackUsed: boolean, error?: string) {
    const currentState = this.environmentStates[this.environmentStates.length - 1];
    if (currentState) {
      currentState.apiCalls.push({
        endpoint,
        success,
        fallbackUsed,
        error
      });

    }
  }

  getLatestState() {
    return this.environmentStates[this.environmentStates.length - 1];
  }

  getStateByEnvironment(environment: string) {
    return this.environmentStates.filter(state => state.environment === environment);
  }

  getValidationErrors() {
    const latest = this.getLatestState();
    if (!latest) return [];

    return [
      ...latest.validation.missingRequired.map(key => ({
        type: 'missing_required',
        key,
        message: `Required environment variable ${key} is missing`
      })),
      ...latest.validation.invalidFormats.map(format => ({
        type: 'invalid_format',
        key: format.key,
        message: `${format.key}: ${format.reason}`
      }))
    ];
  }

  reset() {
    this.environmentStates = [];
  }

  getDetailedReport(): string {
    const states = this.environmentStates;
    if (states.length === 0) return 'No environment states captured';

    const latest = states[states.length - 1];
    const totalApiCalls = states.reduce((sum, state) => sum + state.apiCalls.length, 0);
    const successfulCalls = states.reduce((sum, state) =>
      sum + state.apiCalls.filter(call => call.success).length, 0);
    const fallbackCalls = states.reduce((sum, state) =>
      sum + state.apiCalls.filter(call => call.fallbackUsed).length, 0);

    const report = [
      '📊 환경변수 시나리오 분석 리포트:',
      '',
      `현재 환경: ${latest.environment}`,
      `상태 변경: ${states.length}회`,
      '',
      '환경변수 검증:',
      `  필수 변수 누락: ${latest.validation.missingRequired.length}개`,
      `  형식 오류: ${latest.validation.invalidFormats.length}개`,
      `  경고: ${latest.validation.warnings.length}개`,
      `  전체 유효성: ${latest.validation.isValid ? '✅' : '❌'}`,
      '',
      'API 호출 통계:',
      `  총 호출: ${totalApiCalls}회`,
      `  성공: ${successfulCalls}회`,
      `  Fallback 사용: ${fallbackCalls}회`,
      `  성공률: ${totalApiCalls > 0 ? ((successfulCalls / totalApiCalls) * 100).toFixed(1) : 0}%`
    ];

    if (latest.validation.missingRequired.length > 0) {
      report.push('', '누락된 필수 변수:');
      latest.validation.missingRequired.forEach(key => {
        report.push(`  - ${key}`);
      });
    }

    if (latest.validation.invalidFormats.length > 0) {
      report.push('', '형식 오류:');
      latest.validation.invalidFormats.forEach(format => {
        report.push(`  - ${format.key}: ${format.reason}`);
      });
    }

    if (latest.validation.warnings.length > 0) {
      report.push('', '경고:');
      latest.validation.warnings.forEach(warning => {
        report.push(`  - ${warning}`);
      });
    }

    return report.join('\n');
  }
}

const envTracker = new EnvironmentTracker();

// MSW 서버 설정 - 환경변수 기반 조건부 응답
const server = setupServer(
  // 환경변수 검증 API
  http.get('/api/env/validate', ({ request }) => {
    const currentState = envTracker.getLatestState();

    if (!currentState) {
      return HttpResponse.json({
        error: 'No environment state captured'
      }, { status: 500 });
    }

    return HttpResponse.json({
      isValid: currentState.validation.isValid,
      environment: currentState.environment,
      missingRequired: currentState.validation.missingRequired,
      invalidFormats: currentState.validation.invalidFormats,
      warnings: currentState.validation.warnings,
      timestamp: currentState.timestamp
    });
  }),

  // Supabase 연결 테스트
  http.get('/api/supabase/health', ({ request }) => {
    const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasUrl || !hasKey) {
      envTracker.trackApiCall('/api/supabase/health', false, true, 'Missing Supabase credentials');

      return HttpResponse.json({
        status: 'error',
        message: 'Supabase credentials not configured',
        fallback: 'Using mock data',
        missing: {
          url: !hasUrl,
          key: !hasKey
        }
      }, { status: 503 });
    }

    // URL 형식 검증
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url && !/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(url)) {
      envTracker.trackApiCall('/api/supabase/health', false, true, 'Invalid Supabase URL format');

      return HttpResponse.json({
        status: 'error',
        message: 'Invalid Supabase URL format',
        expected: 'https://your-project.supabase.co',
        received: url
      }, { status: 400 });
    }

    envTracker.trackApiCall('/api/supabase/health', true, false);

    return HttpResponse.json({
      status: 'healthy',
      url: url?.replace(/([a-zA-Z0-9-]+)\.supabase\.co/, '******.supabase.co'),
      connected: true
    });
  }),

  // Seedance API 헬스체크
  http.get('/api/seedance/health', ({ request }) => {
    const apiKey = process.env.SEEDANCE_API_KEY;
    const environment = process.env.NODE_ENV;

    if (!apiKey) {
      // 개발/테스트 환경에서는 경고만, 프로덕션에서는 에러
      if (environment === 'production') {
        envTracker.trackApiCall('/api/seedance/health', false, true, 'Missing Seedance API key in production');

        return HttpResponse.json({
          status: 'error',
          message: 'Seedance API key is required in production',
          fallback: 'Service degraded'
        }, { status: 503 });
      } else {
        envTracker.trackApiCall('/api/seedance/health', true, true, 'Using mock in non-production');

        return HttpResponse.json({
          status: 'mock',
          message: 'Using mock Seedance API in development',
          environment
        });
      }
    }

    // API 키 형식 검증
    if (!/^sd_(live|test)_[a-zA-Z0-9]{32,}$/.test(apiKey)) {
      envTracker.trackApiCall('/api/seedance/health', false, true, 'Invalid Seedance API key format');

      return HttpResponse.json({
        status: 'error',
        message: 'Invalid Seedance API key format',
        expected: 'sd_live_xxx or sd_test_xxx'
      }, { status: 400 });
    }

    // 환경과 API 키 타입 매칭 검증
    const isLiveKey = apiKey.startsWith('sd_live_');
    const isProduction = environment === 'production';

    if (isProduction && !isLiveKey) {
      envTracker.trackApiCall('/api/seedance/health', false, false, 'Test API key in production');

      return HttpResponse.json({
        status: 'error',
        message: 'Test API key should not be used in production',
        keyType: 'test',
        environment: 'production'
      }, { status: 400 });
    }

    if (!isProduction && isLiveKey) {
      envTracker.trackApiCall('/api/seedance/health', true, false);

      return HttpResponse.json({
        status: 'warning',
        message: 'Live API key in non-production environment',
        keyType: 'live',
        environment,
        warning: 'Consider using test key for development'
      });
    }

    envTracker.trackApiCall('/api/seedance/health', true, false);

    return HttpResponse.json({
      status: 'healthy',
      keyType: isLiveKey ? 'live' : 'test',
      environment
    });
  }),

  // 통합 헬스체크
  http.get('/api/health', async ({ request }) => {
    // 각 서비스별 헬스체크 호출
    const supabaseHealth = await fetch('/api/supabase/health');
    const seedanceHealth = await fetch('/api/seedance/health');

    const supabaseData = await supabaseHealth.json();
    const seedanceData = await seedanceHealth.json();

    const overallStatus =
      supabaseData.status === 'healthy' && seedanceData.status === 'healthy' ? 'healthy' :
      supabaseData.status === 'error' || seedanceData.status === 'error' ? 'error' : 'degraded';

    return HttpResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        supabase: supabaseData,
        seedance: seedanceData
      },
      environment: process.env.NODE_ENV
    });
  })
);

// 테스트 헬퍼 함수
function setEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function setMultipleEnvVars(vars: Record<string, string | undefined>) {
  Object.entries(vars).forEach(([key, value]) => {
    setEnvVar(key, value);
  });
}

function clearAllEnvVars() {
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SEEDANCE_API_KEY',
    'REDIS_URL',
    'NEXT_PUBLIC_APP_URL',
    'DATABASE_URL'
  ];

  keys.forEach(key => delete process.env[key]);
}

async function callHealthCheck(endpoint: string) {
  return fetch(endpoint);
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  envTracker.reset();
  clearAllEnvVars();

  // 기본 환경 설정
  process.env.FORCE_MSW = 'true';
  process.env.NODE_ENV = 'test';

  // 시간 mock
  let currentTime = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

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
  delete (global as any).advanceTime;
  clearAllEnvVars();
  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

describe('🌍 환경변수 시나리오별 테스트', () => {

  describe('필수 환경변수 누락 시나리오', () => {
    test('❌ [RED] 모든 필수 환경변수 누락', async () => {
      // Given: 필수 환경변수 모두 누락
      clearAllEnvVars();

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('test');

      // Then: 검증 실패
      expect(state.validation.isValid).toBe(false);
      expect(state.validation.missingRequired).toHaveLength(2);
      expect(state.validation.missingRequired).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(state.validation.missingRequired).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');

      // API 헬스체크 실패
      const healthResponse = await callHealthCheck('/api/supabase/health');
      expect(healthResponse.status).toBe(503);

      const healthData = await healthResponse.json();
      expect(healthData.fallback).toBe('Using mock data');

    });

    test('❌ [RED] Supabase URL만 누락', async () => {
      // Given: Supabase URL만 누락
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('test');

      // Then: URL 누락 감지
      expect(state.validation.isValid).toBe(false);
      expect(state.validation.missingRequired).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(state.validation.missingRequired).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    });

    test('❌ [RED] Supabase Anon Key만 누락', async () => {
      // Given: Supabase Anon Key만 누락
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://test-project.supabase.co'
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('test');

      // Then: Anon Key 누락 감지
      expect(state.validation.isValid).toBe(false);
      expect(state.validation.missingRequired).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(state.validation.missingRequired).not.toContain('NEXT_PUBLIC_SUPABASE_URL');

    });
  });

  describe('환경변수 형식 검증', () => {
    test('❌ [RED] 잘못된 Supabase URL 형식', async () => {
      // Given: 잘못된 Supabase URL 형식들
      const invalidUrls = [
        'http://test-project.supabase.co', // HTTP (HTTPS 필요)
        'https://invalid-domain.com', // 잘못된 도메인
        'test-project.supabase.co', // 프로토콜 누락
        'https://test_project.supabase.co', // 언더스코어 사용
        'https://.supabase.co' // 빈 프로젝트명
      ];

      for (const invalidUrl of invalidUrls) {
        setMultipleEnvVars({
          'NEXT_PUBLIC_SUPABASE_URL': invalidUrl,
          'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
        });

        // When: 환경 상태 캡처
        const state = envTracker.captureEnvironmentState('test');

        // Then: 형식 오류 감지
        expect(state.validation.isValid).toBe(false);
        expect(state.validation.invalidFormats).toHaveLength(1);
        expect(state.validation.invalidFormats[0].key).toBe('NEXT_PUBLIC_SUPABASE_URL');

        // API 헬스체크도 실패
        const healthResponse = await callHealthCheck('/api/supabase/health');
        expect(healthResponse.status).toBe(400);


        envTracker.reset();
        clearAllEnvVars();
      }
    });

    test('❌ [RED] 잘못된 JWT 토큰 형식', async () => {
      // Given: 잘못된 JWT 형식들
      const invalidTokens = [
        'invalid-token',
        'not.a.jwt',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // 불완전한 JWT
        'bearer-token-format',
        ''
      ];

      for (const invalidToken of invalidTokens) {
        setMultipleEnvVars({
          'NEXT_PUBLIC_SUPABASE_URL': 'https://test-project.supabase.co',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY': invalidToken
        });

        // When: 환경 상태 캡처
        const state = envTracker.captureEnvironmentState('test');

        // Then: JWT 형식 오류 감지
        expect(state.validation.isValid).toBe(false);
        expect(state.validation.invalidFormats.some(f => f.key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(true);


        envTracker.reset();
        clearAllEnvVars();
      }
    });

    test('❌ [RED] 잘못된 Seedance API 키 형식', async () => {
      // Given: 잘못된 Seedance API 키 형식들
      const invalidApiKeys = [
        'invalid-api-key',
        'sk_live_short', // 잘못된 접두사
        'sd_live_short', // 너무 짧음
        'sd_invalid_1234567890abcdef1234567890abcdef', // 잘못된 환경
        'sd_live_', // 빈 키
        'sd_test_' // 빈 테스트 키
      ];

      for (const invalidKey of invalidApiKeys) {
        setMultipleEnvVars({
          'NEXT_PUBLIC_SUPABASE_URL': 'https://test-project.supabase.co',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
          'SEEDANCE_API_KEY': invalidKey
        });

        // When: 환경 상태 캡처
        const state = envTracker.captureEnvironmentState('test');

        // Then: API 키 형식 오류 감지
        expect(state.validation.invalidFormats.some(f => f.key === 'SEEDANCE_API_KEY')).toBe(true);

        // Seedance 헬스체크 실패
        const healthResponse = await callHealthCheck('/api/seedance/health');
        expect(healthResponse.status).toBe(400);


        envTracker.reset();
        clearAllEnvVars();
      }
    });
  });

  describe('환경별 설정 검증', () => {
    test('✅ [GREEN] 개발환경 정상 설정', async () => {
      // Given: 개발환경 적절한 설정
      process.env.NODE_ENV = 'development';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://dev-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
        'SEEDANCE_API_KEY': 'sd_test_1234567890abcdef1234567890abcdef12'
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('development');

      // Then: 모든 검증 통과
      expect(state.validation.isValid).toBe(true);
      expect(state.validation.missingRequired).toHaveLength(0);
      expect(state.validation.invalidFormats).toHaveLength(0);

      // 헬스체크 성공
      const healthResponse = await callHealthCheck('/api/health');
      expect(healthResponse.status).toBe(200);

    });

    test('⚠️ [WARNING] 개발환경에서 라이브 API 키 사용', async () => {
      // Given: 개발환경에서 라이브 키 사용
      process.env.NODE_ENV = 'development';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://dev-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
        'SEEDANCE_API_KEY': 'sd_live_1234567890abcdef1234567890abcdef12' // 라이브 키
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('development');

      // Then: 경고 발생
      expect(state.validation.warnings).toContain('Using live Seedance API key in development environment');

      // Seedance 헬스체크에서 경고
      const seedanceResponse = await callHealthCheck('/api/seedance/health');
      expect(seedanceResponse.status).toBe(200);

      const seedanceData = await seedanceResponse.json();
      expect(seedanceData.status).toBe('warning');
      expect(seedanceData.warning).toContain('Consider using test key');

    });

    test('❌ [RED] 프로덕션환경에서 테스트 API 키 사용', async () => {
      // Given: 프로덕션환경에서 테스트 키 사용
      process.env.NODE_ENV = 'production';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://prod-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
        'SEEDANCE_API_KEY': 'sd_test_1234567890abcdef1234567890abcdef12' // 테스트 키
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('production');

      // Then: 필수 변수는 있지만 환경 불일치
      expect(state.validation.missingRequired).toHaveLength(0);

      // Seedance 헬스체크 실패
      const seedanceResponse = await callHealthCheck('/api/seedance/health');
      expect(seedanceResponse.status).toBe(400);

      const seedanceData = await seedanceResponse.json();
      expect(seedanceData.message).toContain('Test API key should not be used in production');

    });

    test('❌ [RED] 프로덕션환경에서 Seedance API 키 누락', async () => {
      // Given: 프로덕션환경에서 Seedance API 키 누락
      process.env.NODE_ENV = 'production';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://prod-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
        // SEEDANCE_API_KEY 누락
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('production');

      // Then: 경고 발생
      expect(state.validation.warnings).toContain('Seedance API key is missing in production environment');

      // Seedance 헬스체크 실패
      const seedanceResponse = await callHealthCheck('/api/seedance/health');
      expect(seedanceResponse.status).toBe(503);

      const seedanceData = await seedanceResponse.json();
      expect(seedanceData.fallback).toBe('Service degraded');

    });
  });

  describe('완전한 환경 설정 시나리오', () => {
    test('✅ [GREEN] 모든 환경변수 완벽 설정', async () => {
      // Given: 모든 환경변수 완벽 설정
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://perfect-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
        'SEEDANCE_API_KEY': 'sd_test_1234567890abcdef1234567890abcdef12',
        'REDIS_URL': 'redis://localhost:6379',
        'NEXT_PUBLIC_APP_URL': 'https://app.example.com',
        'DATABASE_URL': 'postgresql://user:pass@localhost:5432/db'
      });

      // When: 환경 상태 캡처
      const state = envTracker.captureEnvironmentState('test');

      // Then: 완벽한 설정
      expect(state.validation.isValid).toBe(true);
      expect(state.validation.missingRequired).toHaveLength(0);
      expect(state.validation.invalidFormats).toHaveLength(0);
      expect(state.validation.warnings).toHaveLength(0);

      // 모든 헬스체크 성공
      const healthResponse = await callHealthCheck('/api/health');
      expect(healthResponse.status).toBe(200);

      const healthData = await healthResponse.json();
      expect(healthData.status).toBe('healthy');
      expect(healthData.services.supabase.status).toBe('healthy');
      expect(healthData.services.seedance.status).toBe('healthy');

    });

    test('🔄 [전환] 환경간 설정 전환 시나리오', async () => {
      // Given: 개발환경 설정으로 시작
      process.env.NODE_ENV = 'development';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://dev-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature',
        'SEEDANCE_API_KEY': 'sd_test_1234567890abcdef1234567890abcdef12'
      });

      const devState = envTracker.captureEnvironmentState('development');
      expect(devState.validation.isValid).toBe(true);

      // When: 스테이징환경으로 전환
      process.env.NODE_ENV = 'staging';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://staging-project.supabase.co',
        'SEEDANCE_API_KEY': 'sd_live_1234567890abcdef1234567890abcdef12' // 라이브 키로 변경
      });

      const stagingState = envTracker.captureEnvironmentState('staging');
      expect(stagingState.validation.isValid).toBe(true);

      // When: 프로덕션환경으로 전환
      process.env.NODE_ENV = 'production';
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://prod-project.supabase.co',
        'SEEDANCE_API_KEY': 'sd_live_9876543210fedcba9876543210fedcba98'
      });

      const prodState = envTracker.captureEnvironmentState('production');
      expect(prodState.validation.isValid).toBe(true);

      // Then: 환경별 상태 확인
      const devStates = envTracker.getStateByEnvironment('development');
      const stagingStates = envTracker.getStateByEnvironment('staging');
      const prodStates = envTracker.getStateByEnvironment('production');

      expect(devStates).toHaveLength(1);
      expect(stagingStates).toHaveLength(1);
      expect(prodStates).toHaveLength(1);

    });
  });

  describe('런타임 환경변수 변경 감지', () => {
    test('🔄 [동적] 런타임 환경변수 변경 감지', async () => {
      // Given: 초기 설정
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://initial-project.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
      });

      const initialState = envTracker.captureEnvironmentState('runtime-test');
      expect(initialState.validation.isValid).toBe(true);

      // When: 런타임에 환경변수 변경
      (global as any).advanceTime(60000); // 1분 후

      setEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://updated-project.supabase.co');
      setEnvVar('SEEDANCE_API_KEY', 'sd_test_1234567890abcdef1234567890abcdef12');

      const updatedState = envTracker.captureEnvironmentState('runtime-test');

      // Then: 변경 감지
      expect(updatedState.variables['NEXT_PUBLIC_SUPABASE_URL']).toBe('https://updated-project.supabase.co');
      expect(updatedState.variables['SEEDANCE_API_KEY']).toBe('sd_test_1234567890abcdef1234567890abcdef12');
      expect(updatedState.timestamp).toBeGreaterThan(initialState.timestamp);

    });

    test('⚠️ [감지] 중요 환경변수 제거 감지', async () => {
      // Given: 정상 설정으로 시작
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://will-be-removed.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
      });

      const normalState = envTracker.captureEnvironmentState('removal-test');
      expect(normalState.validation.isValid).toBe(true);

      // When: 중요 환경변수 제거
      (global as any).advanceTime(30000); // 30초 후
      setEnvVar('NEXT_PUBLIC_SUPABASE_URL', undefined);

      const degradedState = envTracker.captureEnvironmentState('removal-test');

      // Then: 제거 감지 및 검증 실패
      expect(degradedState.validation.isValid).toBe(false);
      expect(degradedState.validation.missingRequired).toContain('NEXT_PUBLIC_SUPABASE_URL');

      // 헬스체크 실패
      const healthResponse = await callHealthCheck('/api/supabase/health');
      expect(healthResponse.status).toBe(503);

    });
  });

  describe('환경변수 검증 API', () => {
    test('✅ [API] 환경변수 검증 API 정상 동작', async () => {
      // Given: 정상 설정
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'https://api-test.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ2NjI4MDAwLCJleHAiOjE5NjIyMDQwMDB9.signature'
      });

      envTracker.captureEnvironmentState('api-test');

      // When: 검증 API 호출
      const validateResponse = await callHealthCheck('/api/env/validate');

      // Then: 정상 응답
      expect(validateResponse.status).toBe(200);

      const validateData = await validateResponse.json();
      expect(validateData.isValid).toBe(true);
      expect(validateData.missingRequired).toHaveLength(0);
      expect(validateData.invalidFormats).toHaveLength(0);
      expect(validateData.environment).toBe('api-test');

    });

    test('❌ [API] 환경변수 검증 API 오류 보고', async () => {
      // Given: 오류 설정
      setMultipleEnvVars({
        'NEXT_PUBLIC_SUPABASE_URL': 'invalid-url',
        // NEXT_PUBLIC_SUPABASE_ANON_KEY 누락
        'SEEDANCE_API_KEY': 'invalid-key'
      });

      envTracker.captureEnvironmentState('api-error-test');

      // When: 검증 API 호출
      const validateResponse = await callHealthCheck('/api/env/validate');

      // Then: 오류 상세 정보
      expect(validateResponse.status).toBe(200);

      const validateData = await validateResponse.json();
      expect(validateData.isValid).toBe(false);
      expect(validateData.missingRequired.length).toBeGreaterThan(0);
      expect(validateData.invalidFormats.length).toBeGreaterThan(0);

    });
  });
});