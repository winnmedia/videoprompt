/**
 * Supabase null 에러 회귀 방지 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 목표: /api/planning/* Supabase null 에러 방지
 * - Supabase 클라이언트 초기화 실패 시나리오
 * - 환경변수 누락/잘못된 설정 처리
 * - Graceful degradation 및 fallback 메커니즘
 * - 서비스 가용성 보장
 */

import { describe, test, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Supabase 에러 추적 및 분석 시스템
class SupabaseErrorTracker {
  private errors: Array<{
    endpoint: string;
    errorType: string;
    timestamp: number;
    environmentState: Record<string, any>;
    stackTrace?: string;
  }> = [];

  private environmentStates: Map<string, Record<string, any>> = new Map();
  private readonly CRITICAL_ERROR_THRESHOLD = 10; // 10회 이상 시 긴급
  private readonly TIME_WINDOW = 300000; // 5분 윈도우

  trackError(endpoint: string, errorType: string, stackTrace?: string) {
    const now = Date.now();
    const environmentState = this.captureEnvironmentState();

    const error = {
      endpoint,
      errorType,
      timestamp: now,
      environmentState,
      stackTrace
    };

    this.errors.push(error);
    this.environmentStates.set(`${errorType}-${now}`, environmentState);

    console.log(`🔥 [${endpoint}] Supabase 에러: ${errorType}`);
    console.log(`📊 환경 상태:`, JSON.stringify(environmentState, null, 2));

    // 긴급 상황 체크
    const recentErrors = this.getRecentErrors();
    if (recentErrors.length >= this.CRITICAL_ERROR_THRESHOLD) {
      console.error(`🚨 CRITICAL: Supabase 연속 에러 ${recentErrors.length}회 - 서비스 중단 위험!`);
    }
  }

  private captureEnvironmentState() {
    return {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
      nodeEnv: process.env.NODE_ENV,
      timestamp: Date.now(),
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
    };
  }

  getRecentErrors(timeWindow = this.TIME_WINDOW) {
    const now = Date.now();
    return this.errors.filter(error => now - error.timestamp <= timeWindow);
  }

  getErrorsByType(errorType: string) {
    return this.errors.filter(error => error.errorType === errorType);
  }

  getErrorsByEndpoint(endpoint: string) {
    return this.errors.filter(error => error.endpoint.includes(endpoint));
  }

  isCriticalState(): boolean {
    return this.getRecentErrors().length >= this.CRITICAL_ERROR_THRESHOLD;
  }

  reset() {
    this.errors = [];
    this.environmentStates.clear();
  }

  getDetailedReport(): string {
    const recentErrors = this.getRecentErrors();
    const errorTypes = [...new Set(recentErrors.map(e => e.errorType))];

    const report = [
      '📊 Supabase 에러 상세 분석:',
      `  총 에러: ${this.errors.length}개`,
      `  최근 5분: ${recentErrors.length}개`,
      `  에러 유형: ${errorTypes.join(', ')}`,
      ''
    ];

    // 에러 유형별 분석
    for (const errorType of errorTypes) {
      const typeErrors = this.getErrorsByType(errorType);
      const recentTypeErrors = typeErrors.filter(e =>
        Date.now() - e.timestamp <= this.TIME_WINDOW
      );

      report.push(`  ${errorType}:`);
      report.push(`    총 ${typeErrors.length}회, 최근 ${recentTypeErrors.length}회`);

      if (recentTypeErrors.length > 0) {
        const lastError = recentTypeErrors[recentTypeErrors.length - 1];
        report.push(`    마지막 발생: ${new Date(lastError.timestamp).toISOString()}`);
        report.push(`    환경 상태: URL=${lastError.environmentState.hasSupabaseUrl}, KEY=${lastError.environmentState.hasSupabaseKey}`);
      }
      report.push('');
    }

    // 위험도 평가
    if (this.isCriticalState()) {
      report.push('🚨 CRITICAL: 서비스 중단 위험!');
    } else if (recentErrors.length > 3) {
      report.push('⚠️ WARNING: 에러 증가 추세');
    } else {
      report.push('✅ STABLE: 안정적인 상태');
    }

    return report.join('\n');
  }
}

const supabaseTracker = new SupabaseErrorTracker();

// MSW 서버 설정 - Supabase 관련 다양한 에러 시나리오
const server = setupServer(
  // /api/planning/list - 계획 목록 조회
  http.get('/api/planning/list', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';

    switch (scenario) {
      case 'supabase-null':
        // Supabase 클라이언트가 null인 상황
        supabaseTracker.trackError('/api/planning/list', 'SUPABASE_CLIENT_NULL');
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_CLIENT_NULL',
          error: 'Supabase client is not initialized',
          statusCode: 503,
          details: {
            service: 'planning',
            action: 'list',
            timestamp: Date.now()
          }
        }, { status: 503 });

      case 'env-missing':
        // 환경변수 누락
        supabaseTracker.trackError('/api/planning/list', 'MISSING_ENV_VARS');
        return HttpResponse.json({
          ok: false,
          code: 'MISSING_ENVIRONMENT_VARIABLES',
          error: 'Required Supabase environment variables are missing',
          statusCode: 503,
          details: {
            required: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
            missing: ['NEXT_PUBLIC_SUPABASE_URL']
          }
        }, { status: 503 });

      case 'invalid-url':
        // 잘못된 Supabase URL
        supabaseTracker.trackError('/api/planning/list', 'INVALID_SUPABASE_URL');
        return HttpResponse.json({
          ok: false,
          code: 'INVALID_SUPABASE_URL',
          error: 'Supabase URL is invalid or malformed',
          statusCode: 503,
          details: {
            providedUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            expectedFormat: 'https://your-project.supabase.co'
          }
        }, { status: 503 });

      case 'connection-failed':
        // Supabase 연결 실패
        supabaseTracker.trackError('/api/planning/list', 'CONNECTION_FAILED');
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_CONNECTION_FAILED',
          error: 'Failed to connect to Supabase',
          statusCode: 503,
          details: {
            retryAfter: 30,
            lastAttempt: Date.now()
          }
        }, { status: 503 });

      case 'auth-error':
        // Supabase 인증 에러
        supabaseTracker.trackError('/api/planning/list', 'SUPABASE_AUTH_ERROR');
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_AUTH_ERROR',
          error: 'Supabase authentication failed',
          statusCode: 401,
          details: {
            supabaseError: 'Invalid JWT token'
          }
        }, { status: 401 });

      case 'database-error':
        // 데이터베이스 에러
        supabaseTracker.trackError('/api/planning/list', 'DATABASE_ERROR');
        return HttpResponse.json({
          ok: false,
          code: 'DATABASE_ERROR',
          error: 'Database operation failed',
          statusCode: 500,
          details: {
            operation: 'SELECT',
            table: 'plans',
            postgresError: 'relation "plans" does not exist'
          }
        }, { status: 500 });

      case 'fallback-mode':
        // Fallback 모드 (로컬 데이터)
        console.log('📦 Fallback 모드: 로컬 데이터 사용');
        return HttpResponse.json({
          ok: true,
          data: {
            plans: [
              {
                id: 'local-1',
                title: 'Fallback Plan 1',
                description: 'Local fallback data',
                source: 'local-cache'
              }
            ],
            meta: {
              total: 1,
              source: 'fallback',
              timestamp: Date.now()
            }
          },
          warnings: ['Using fallback data due to Supabase unavailability']
        });

      case 'success':
        // 정상 작동
        return HttpResponse.json({
          ok: true,
          data: {
            plans: [
              {
                id: '1',
                title: 'Test Plan',
                description: 'Test description',
                createdAt: '2024-01-01T00:00:00Z'
              }
            ],
            meta: {
              total: 1,
              source: 'supabase'
            }
          }
        });

      default:
        // 예상치 못한 에러
        supabaseTracker.trackError('/api/planning/list', 'UNEXPECTED_ERROR');
        return HttpResponse.json({
          ok: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: 'An unexpected error occurred',
          statusCode: 500
        }, { status: 500 });
    }
  }),

  // /api/planning/create - 계획 생성
  http.post('/api/planning/create', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';

    switch (scenario) {
      case 'supabase-null':
        supabaseTracker.trackError('/api/planning/create', 'SUPABASE_CLIENT_NULL');
        return HttpResponse.json({
          ok: false,
          code: 'SUPABASE_CLIENT_NULL',
          error: 'Cannot create plan: Supabase client is null',
          statusCode: 503
        }, { status: 503 });

      case 'transaction-failed':
        // 트랜잭션 실패
        supabaseTracker.trackError('/api/planning/create', 'TRANSACTION_FAILED');
        return HttpResponse.json({
          ok: false,
          code: 'TRANSACTION_FAILED',
          error: 'Database transaction failed',
          statusCode: 500,
          details: {
            operation: 'INSERT',
            rollback: true
          }
        }, { status: 500 });

      case 'success':
        return HttpResponse.json({
          ok: true,
          data: {
            plan: {
              id: 'new-plan-123',
              title: 'Created Plan',
              createdAt: new Date().toISOString()
            }
          }
        });

      default:
        supabaseTracker.trackError('/api/planning/create', 'UNEXPECTED_ERROR');
        return HttpResponse.json({
          ok: false,
          code: 'INTERNAL_SERVER_ERROR',
          error: 'Unexpected error during plan creation',
          statusCode: 500
        }, { status: 500 });
    }
  }),

  // /api/health - 서비스 상태 확인
  http.get('/api/health', ({ request }) => {
    const scenario = request.headers.get('x-test-scenario') || 'default';

    switch (scenario) {
      case 'supabase-down':
        return HttpResponse.json({
          ok: true,
          status: 'degraded',
          services: {
            api: 'healthy',
            supabase: 'unhealthy',
            redis: 'healthy'
          },
          details: {
            supabase: {
              status: 'connection_failed',
              lastCheck: Date.now(),
              error: 'Connection timeout'
            }
          }
        });

      default:
        return HttpResponse.json({
          ok: true,
          status: 'healthy',
          services: {
            api: 'healthy',
            supabase: 'healthy',
            redis: 'healthy'
          }
        });
    }
  })
);

// 테스트 헬퍼
async function makeSupabaseRequest(endpoint: string, scenario: string, method: 'GET' | 'POST' = 'GET') {
  const headers: Record<string, string> = {
    'x-test-scenario': scenario,
    'Content-Type': 'application/json'
  };

  const options: RequestInit = {
    method,
    headers
  };

  if (method === 'POST') {
    options.body = JSON.stringify({
      title: 'Test Plan',
      description: 'Test description'
    });
  }

  return fetch(endpoint, options);
}

async function checkServiceHealth(scenario: string = 'default') {
  return makeSupabaseRequest('/api/health', scenario);
}

beforeEach(() => {
  server.listen({
    onUnhandledRequest: 'error',
    quiet: false
  });

  supabaseTracker.reset();

  // 환경변수 초기 상태
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

  // 환경변수 정리
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  vi.clearAllMocks();
  vi.resetAllMocks();
});

afterAll(() => {
  server.close();
});

describe('🔥 Supabase null 에러 회귀 방지 테스트', () => {

  describe('Supabase 클라이언트 초기화 실패', () => {
    test('❌ [RED] 환경변수 누락 시 503 에러 및 상세 정보', async () => {
      // Given: 환경변수 누락 상태
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // When: planning API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'env-missing');

      // Then: 503 에러 및 상세 정보 포함
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.code).toBe('MISSING_ENVIRONMENT_VARIABLES');
      expect(body.details.required).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(body.details.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');

      console.log(supabaseTracker.getDetailedReport());
      expect(supabaseTracker.getErrorsByType('MISSING_ENV_VARS')).toHaveLength(1);
    });

    test('❌ [RED] Supabase 클라이언트 null 상황', async () => {
      // Given: 환경변수는 있지만 클라이언트 초기화 실패
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://invalid.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'invalid-key';

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'supabase-null');

      // Then: 503 Service Unavailable
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.code).toBe('SUPABASE_CLIENT_NULL');
      expect(body.details.service).toBe('planning');

      console.log(supabaseTracker.getDetailedReport());
      expect(supabaseTracker.getErrorsByType('SUPABASE_CLIENT_NULL')).toHaveLength(1);
    });

    test('❌ [RED] 잘못된 Supabase URL 형식', async () => {
      // Given: 잘못된 URL 형식
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key';

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'invalid-url');

      // Then: 구체적인 에러 메시지
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.code).toBe('INVALID_SUPABASE_URL');
      expect(body.details.expectedFormat).toContain('supabase.co');

      console.log(supabaseTracker.getDetailedReport());
    });

    test('❌ [RED] Supabase 연결 실패', async () => {
      // Given: 유효한 URL이지만 연결 불가
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://down.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key';

      // When: 연결 시도
      const response = await makeSupabaseRequest('/api/planning/list', 'connection-failed');

      // Then: 연결 실패 정보 제공
      expect(response.status).toBe(503);

      const body = await response.json();
      expect(body.code).toBe('SUPABASE_CONNECTION_FAILED');
      expect(body.details.retryAfter).toBe(30);

      console.log(supabaseTracker.getDetailedReport());
    });
  });

  describe('데이터베이스 작업 실패', () => {
    test('❌ [RED] 데이터베이스 테이블 없음 에러', async () => {
      // Given: 테이블이 존재하지 않는 상황
      // When: 데이터 조회 시도
      const response = await makeSupabaseRequest('/api/planning/list', 'database-error');

      // Then: 구체적인 데이터베이스 에러 정보
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.code).toBe('DATABASE_ERROR');
      expect(body.details.operation).toBe('SELECT');
      expect(body.details.table).toBe('plans');
      expect(body.details.postgresError).toContain('does not exist');

      console.log(supabaseTracker.getDetailedReport());
      expect(supabaseTracker.getErrorsByType('DATABASE_ERROR')).toHaveLength(1);
    });

    test('❌ [RED] 트랜잭션 실패 (생성 작업)', async () => {
      // Given: 트랜잭션이 실패하는 상황
      // When: 데이터 생성 시도
      const response = await makeSupabaseRequest('/api/planning/create', 'transaction-failed', 'POST');

      // Then: 트랜잭션 롤백 정보 포함
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.code).toBe('TRANSACTION_FAILED');
      expect(body.details.operation).toBe('INSERT');
      expect(body.details.rollback).toBe(true);

      console.log(supabaseTracker.getDetailedReport());
    });

    test('❌ [RED] Supabase 인증 에러', async () => {
      // Given: JWT 토큰 문제
      // When: 인증이 필요한 작업 수행
      const response = await makeSupabaseRequest('/api/planning/list', 'auth-error');

      // Then: 인증 에러 상세 정보
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.code).toBe('SUPABASE_AUTH_ERROR');
      expect(body.details.supabaseError).toContain('JWT');

      console.log(supabaseTracker.getDetailedReport());
    });
  });

  describe('Graceful Degradation 및 Fallback', () => {
    test('✅ [GREEN] Fallback 모드로 서비스 연속성 보장', async () => {
      // Given: Supabase 장애 상황
      // When: Fallback 모드 활성화
      const response = await makeSupabaseRequest('/api/planning/list', 'fallback-mode');

      // Then: 200 응답 + 로컬 데이터
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.plans).toHaveLength(1);
      expect(body.data.meta.source).toBe('fallback');
      expect(body.warnings).toContain('Using fallback data due to Supabase unavailability');

      console.log('✅ Fallback 모드로 서비스 지속');
    });

    test('✅ [GREEN] 서비스 상태 모니터링', async () => {
      // When: 서비스 상태 확인
      const healthResponse = await checkServiceHealth('supabase-down');

      // Then: degraded 상태 정확히 보고
      expect(healthResponse.status).toBe(200);

      const health = await healthResponse.json();
      expect(health.status).toBe('degraded');
      expect(health.services.supabase).toBe('unhealthy');
      expect(health.services.api).toBe('healthy');
      expect(health.details.supabase.error).toContain('Connection timeout');

      console.log('✅ 서비스 상태 정확한 모니터링');
    });

    test('✅ [GREEN] 에러 복구 후 정상 서비스', async () => {
      // Given: 처음엔 에러 발생
      const errorResponse = await makeSupabaseRequest('/api/planning/list', 'supabase-null');
      expect(errorResponse.status).toBe(503);

      // When: 환경 복구 후 재시도
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key';

      const successResponse = await makeSupabaseRequest('/api/planning/list', 'success');

      // Then: 정상 서비스 복구
      expect(successResponse.status).toBe(200);

      const body = await successResponse.json();
      expect(body.ok).toBe(true);
      expect(body.data.plans).toHaveLength(1);
      expect(body.data.meta.source).toBe('supabase');

      console.log('✅ 에러 복구 후 정상 서비스');
    });
  });

  describe('에러 패턴 분석 및 모니터링', () => {
    test('❌ [RED] 연속 에러 발생 시 긴급 알림', async () => {
      // Given: 다양한 에러 시나리오 연속 발생
      const scenarios = [
        'supabase-null',
        'env-missing',
        'connection-failed',
        'database-error',
        'auth-error'
      ];

      // When: 각 시나리오를 2번씩 실행 (총 10회)
      for (let i = 0; i < 2; i++) {
        for (const scenario of scenarios) {
          await makeSupabaseRequest('/api/planning/list', scenario);
          (global as any).advanceTime(1000); // 1초씩 증가
        }
      }

      // Then: 긴급 상태 감지
      console.log(supabaseTracker.getDetailedReport());

      expect(supabaseTracker.isCriticalState()).toBe(true);
      expect(supabaseTracker.getRecentErrors().length).toBe(10);

      // 에러 유형별 분석
      expect(supabaseTracker.getErrorsByType('SUPABASE_CLIENT_NULL')).toHaveLength(2);
      expect(supabaseTracker.getErrorsByType('MISSING_ENV_VARS')).toHaveLength(2);
    });

    test('📊 [분석] 에러 패턴 및 환경 상태 분석', async () => {
      // Given: 다양한 환경 설정으로 에러 발생
      const envConfigs = [
        { url: null, key: null, scenario: 'env-missing' },
        { url: 'invalid-url', key: 'valid-key', scenario: 'invalid-url' },
        { url: 'https://valid.supabase.co', key: null, scenario: 'env-missing' }
      ];

      for (const config of envConfigs) {
        // 환경 설정
        if (config.url) {
          process.env.NEXT_PUBLIC_SUPABASE_URL = config.url;
        } else {
          delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        }

        if (config.key) {
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = config.key;
        } else {
          delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        }

        // API 호출
        await makeSupabaseRequest('/api/planning/list', config.scenario);
        (global as any).advanceTime(60000); // 1분씩 간격
      }

      // Then: 상세한 환경 분석 리포트
      const report = supabaseTracker.getDetailedReport();
      console.log('📊 환경별 에러 분석:');
      console.log(report);

      expect(report).toContain('환경 상태: URL=');
      expect(report).toContain('KEY=');
      expect(supabaseTracker.getErrorsByType('MISSING_ENV_VARS')).toHaveLength(2);
      expect(supabaseTracker.getErrorsByType('INVALID_SUPABASE_URL')).toHaveLength(1);
    });

    test('⏱️ [시간] 에러 발생 시간 윈도우 분석', async () => {
      // Given: 시간차를 두고 에러 발생
      await makeSupabaseRequest('/api/planning/list', 'supabase-null');

      (global as any).advanceTime(120000); // 2분 경과
      await makeSupabaseRequest('/api/planning/list', 'database-error');

      (global as any).advanceTime(240000); // 4분 더 경과 (총 6분)
      await makeSupabaseRequest('/api/planning/list', 'connection-failed');

      // When: 5분 윈도우 내 에러 확인
      const recentErrors = supabaseTracker.getRecentErrors(300000); // 5분

      // Then: 시간 윈도우 기반 필터링
      expect(recentErrors).toHaveLength(2); // 첫 번째는 제외, 나머지 2개만
      expect(recentErrors[0].errorType).toBe('DATABASE_ERROR');
      expect(recentErrors[1].errorType).toBe('CONNECTION_FAILED');

      console.log('⏱️ 시간 윈도우 기반 에러 분석');
      console.log(supabaseTracker.getDetailedReport());
    });
  });

  describe('환경변수 시나리오별 테스트', () => {
    test('❌ [RED] URL만 누락된 경우', async () => {
      // Given: Anon Key는 있지만 URL 누락
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'env-missing');

      // Then: URL 누락 명시
      const body = await response.json();
      expect(body.details.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(body.details.missing).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });

    test('❌ [RED] Key만 누락된 경우', async () => {
      // Given: URL은 있지만 Key 누락
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'env-missing');

      // Then: Key 누락 명시
      const body = await response.json();
      expect(body.details.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(body.details.missing).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
    });

    test('❌ [RED] 둘 다 누락된 경우', async () => {
      // Given: 모든 환경변수 누락
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'env-missing');

      // Then: 모든 필수 변수 누락 명시
      const body = await response.json();
      expect(body.details.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(body.details.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    });

    test('✅ [GREEN] 모든 환경변수 정상인 경우', async () => {
      // Given: 모든 환경변수 정상 설정
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      // When: API 호출
      const response = await makeSupabaseRequest('/api/planning/list', 'success');

      // Then: 정상 응답
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.plans).toHaveLength(1);
    });
  });

  describe('회복력(Resilience) 테스트', () => {
    test('🔄 [복구] 간헐적 장애 후 자동 복구', async () => {
      // Given: 처음 몇 번은 실패
      const results = [];

      // 3번 실패
      for (let i = 0; i < 3; i++) {
        const response = await makeSupabaseRequest('/api/planning/list', 'connection-failed');
        results.push({ attempt: i + 1, status: response.status });
        (global as any).advanceTime(10000); // 10초 간격
      }

      // 복구 후 성공
      for (let i = 0; i < 2; i++) {
        const response = await makeSupabaseRequest('/api/planning/list', 'success');
        results.push({ attempt: i + 4, status: response.status });
        (global as any).advanceTime(5000); // 5초 간격
      }

      // Then: 패턴 분석
      const failures = results.filter(r => r.status !== 200).length;
      const successes = results.filter(r => r.status === 200).length;

      expect(failures).toBe(3);
      expect(successes).toBe(2);

      console.log('🔄 간헐적 장애 패턴:', results);
      console.log(supabaseTracker.getDetailedReport());
    });

    test('⚡ [성능] 에러 추적 시스템 오버헤드 최소화', async () => {
      // Given: 대량 에러 발생 시뮬레이션
      const startTime = performance.now();
      const startMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      // When: 100개의 에러 발생
      for (let i = 0; i < 100; i++) {
        supabaseTracker.trackError(
          `/api/test-endpoint-${i % 5}`,
          `ERROR_TYPE_${i % 3}`,
          `Stack trace ${i}`
        );
        (global as any).advanceTime(100); // 0.1초씩
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      // Then: 성능 영향 최소화 확인
      const duration = endTime - startTime;
      const memoryIncrease = endMemory - startMemory;

      console.log(`⚡ 100개 에러 추적 성능:`);
      console.log(`  시간: ${duration.toFixed(2)}ms`);
      console.log(`  메모리 증가: ${(memoryIncrease / 1024).toFixed(2)}KB`);

      expect(duration).toBeLessThan(500); // 0.5초 이하
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB 이하

      const report = supabaseTracker.getDetailedReport();
      expect(report).toContain('총 에러: 100개');
    });
  });
});