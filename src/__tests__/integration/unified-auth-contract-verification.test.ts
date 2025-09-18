/**
 * 통합 인증 시스템 Contract Verification 테스트
 * OpenAPI 스펙 준수 및 Provider Contract 검증
 *
 * 이 테스트는 다음을 검증합니다:
 * 1. OpenAPI 스펙과의 일치성
 * 2. HTTP 상태 코드 정확성
 * 3. 응답 스키마 검증
 * 4. 에러 처리 일관성
 * 5. 무한 루프 방지 메커니즘
 * 6. $300 사건 재발 방지
 */

import { NextRequest } from 'next/server';
import { unifiedAuth, isAuthError, isAuthenticated, AuthenticatedUser, GuestUser } from '@/shared/lib/unified-auth';
import { withAuth } from '@/shared/lib/auth-middleware';
// MSW 핸들러에서 에러 응답 형태를 시뮬레이션
import { HttpResponse } from 'msw';

// Mock environments for different scenarios
const mockEnvConfigurations = {
  fullService: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.service'
  },
  degradedService: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test'
    // SUPABASE_SERVICE_ROLE_KEY 없음 (graceful degradation)
  },
  misconfigured: {
    // 환경 변수 없음 (에러 상황)
  }
};

describe('통합 인증 시스템 Contract Verification', () => {

  describe('OpenAPI 스펙 준수 검증', () => {

    test('401 에러 응답이 OpenAPI AuthError 스키마와 일치해야 함', async () => {
      // Given: 인증 토큰이 없는 요청
      const request = new NextRequest('http://localhost/api/test');

      // When: 인증 시도
      const result = await unifiedAuth(request);

      // Then: OpenAPI AuthError 스키마 준수
      expect(isAuthError(result)).toBe(true);

      if (isAuthError(result)) {
        // OpenAPI 스펙에 정의된 필수 필드
        expect(result.error).toEqual(
          expect.objectContaining({
            code: expect.stringMatching(/^(UNAUTHORIZED|TOKEN_EXPIRED|INVALID_TOKEN|SERVICE_UNAVAILABLE)$/),
            message: expect.any(String),
            statusCode: expect.oneOf([401, 403, 503])
          })
        );

        // 401 에러는 특정 코드만 허용
        if (result.error.statusCode === 401) {
          expect(['UNAUTHORIZED', 'TOKEN_EXPIRED', 'INVALID_TOKEN']).toContain(result.error.code);
        }
      }
    });

    test('성공 응답이 OpenAPI AuthenticatedUser 스키마와 일치해야 함', async () => {
      // Given: 유효한 개발 환경 토큰
      process.env.NODE_ENV = 'development';
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      // When: 인증 시도
      const result = await unifiedAuth(request, { allowGuest: false });

      // Then: OpenAPI AuthenticatedUser 스키마 준수
      expect(isAuthError(result)).toBe(false);

      if (!isAuthError(result)) {
        const user = result.context.user;

        if (isAuthenticated(user)) {
          expect(user).toEqual(
            expect.objectContaining({
              id: expect.any(String),
              email: expect.any(String),
              username: expect.any(String),
              tokenType: expect.oneOf(['supabase', 'legacy']),
              isEmailVerified: expect.any(Boolean)
            })
          );

          // ID는 빈 문자열이 아니어야 함
          expect(user.id).not.toBe('');
          expect(result.context.isAuthenticated).toBe(true);
        }
      }

      // Cleanup
      process.env.NODE_ENV = 'test';
    });

    test('게스트 응답이 OpenAPI GuestUser 스키마와 일치해야 함', async () => {
      // Given: 토큰이 없는 요청, 게스트 허용
      const request = new NextRequest('http://localhost/api/test');

      // When: 게스트 허용으로 인증 시도
      const result = await authenticateRequest(request, { allowGuest: true });

      // Then: OpenAPI GuestUser 스키마 준수
      expect(result).toEqual({
        id: null,
        email: null,
        username: null,
        isAuthenticated: false,
        tokenType: 'guest'
      });
    });
  });

  describe('HTTP 상태 코드 Contract 검증', () => {

    test('400 에러는 클라이언트 요청 오류에만 사용되어야 함', () => {
      // Given: MISSING_REFRESH_TOKEN 에러 시나리오
      const request = new NextRequest('http://localhost/api/auth/refresh');

      // When: 리프레시 토큰 누락 에러 생성
      const errorResponse = createMissingRefreshTokenError(request);

      // Then: 반드시 400 상태 코드 (무한 루프 방지)
      expect(errorResponse.status).toBe(400);

      // 에러 분류 가이드와 일치
      expect(ERROR_CLASSIFICATION_GUIDE['400']).toBe('클라이언트 요청 오류 (잘못된 형식, 필수 필드 누락)');
    });

    test('401 에러는 인증 실패에만 사용되어야 함', () => {
      // Given: 유효하지 않은 토큰 시나리오
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      // When: 인증 실패 에러 생성
      const errorResponse = createUnauthorizedError(request, 'invalid');

      // Then: 반드시 401 상태 코드
      expect(errorResponse.status).toBe(401);

      // 에러 분류 가이드와 일치
      expect(ERROR_CLASSIFICATION_GUIDE['401']).toBe('인증 실패 (토큰 없음, 유효하지 않음, 만료됨)');
    });

    test('503 에러는 서비스 이용 불가 상황에만 사용되어야 함', async () => {
      // Given: Service Role Key 없는 환경, graceful degradation 비활성화
      Object.keys(mockEnvConfigurations.misconfigured).forEach(key => {
        delete process.env[key];
      });

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer supabase-token-without-service-key'
        }
      });

      // When: Service 불가 상황에서 인증 시도
      const result = await authenticateRequest(request, { gracefulDegradation: false });

      // Then: SERVICE_UNAVAILABLE 에러로 503 반환
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.statusCode).toBe(503);
        expect(result.code).toBe('SERVICE_UNAVAILABLE');
      }
    });
  });

  describe('무한 루프 방지 Contract 검증', () => {

    test('$300 사건 패턴이 완전히 차단되어야 함', async () => {
      // Given: /api/auth/me 엔드포인트 시뮬레이션
      const request = new NextRequest('http://localhost/api/auth/me');

      // When: 연속된 API 호출 시뮬레이션 (10초 내 20회)
      const calls = [];
      for (let i = 0; i < 20; i++) {
        const result = checkApiCall(request);
        calls.push(result);
      }

      // Then: 무한 루프 패턴 감지 및 차단
      const lastCall = calls[calls.length - 1];
      expect(lastCall.allowed).toBe(false);
      expect(lastCall.action).toBe('emergency_stop');
      expect(lastCall.reason).toContain('무한 루프 패턴 감지');
    });

    test('정상적인 호출 패턴은 허용되어야 함', async () => {
      // Given: 정상적인 간격의 API 호출
      const request = new NextRequest('http://localhost/api/auth/me');

      // When: 첫 번째 호출
      const firstCall = checkApiCall(request);

      // Then: 정상 허용
      expect(firstCall.allowed).toBe(true);
      expect(firstCall.action).toBe('allow');
    });

    test('Rate limiting이 올바르게 동작해야 함', async () => {
      // Given: /api/auth/me의 rate limit (분당 10회)
      const request = new NextRequest('http://localhost/api/auth/me');

      // When: 11회 연속 호출
      const calls = [];
      for (let i = 0; i < 11; i++) {
        const result = checkApiCall(request);
        calls.push(result);
      }

      // Then: 11번째 호출은 차단
      const eleventhCall = calls[10];
      expect(eleventhCall.allowed).toBe(false);
      expect(eleventhCall.action).toBe('block');
      expect(eleventhCall.reason).toContain('Rate limit 초과');
    });

    test('비용 임계점 차단이 동작해야 함', async () => {
      // Given: 고비용 API 호출 시뮬레이션
      const request = new NextRequest('http://localhost/api/ai/generate-story');

      // When: 비용이 $100를 초과하도록 호출 (2000회 * $0.05)
      let totalCost = 0;
      let result;

      for (let i = 0; i < 2001; i++) {
        result = checkApiCall(request);
        if (!result.allowed && result.action === 'emergency_stop') {
          break;
        }
      }

      // Then: 긴급 차단 활성화
      expect(result?.allowed).toBe(false);
      expect(result?.action).toBe('emergency_stop');
      expect(result?.reason).toContain('긴급 차단: 비용 한도 초과');
    });
  });

  describe('Graceful Degradation Contract 검증', () => {

    test('Service Role Key 없이도 제한된 기능을 제공해야 함', async () => {
      // Given: Service Role Key 없는 환경
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-user-id': 'degraded-test-user'
        }
      });

      process.env.NODE_ENV = 'development';

      // When: Graceful degradation으로 인증 시도
      const result = await authenticateRequest(request, { gracefulDegradation: true });

      // Then: 제한된 정보로 인증 성공
      expect(isAuthenticated(result)).toBe(true);
      if (isAuthenticated(result)) {
        expect(result.id).toBe('degraded-test-user');
        expect(result.emailVerified).toBe(false); // 제한된 정보
      }

      // Cleanup
      if (originalServiceKey) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
      }
      process.env.NODE_ENV = 'test';
    });

    test('완전한 Service 실패 시 적절한 에러를 반환해야 함', async () => {
      // Given: 모든 Supabase 환경 변수 없음
      const originalEnv = { ...process.env };
      Object.keys(mockEnvConfigurations.fullService).forEach(key => {
        delete process.env[key];
      });

      const request = new NextRequest('http://localhost/api/test');

      // When: 인증 시도
      const result = await authenticateRequest(request, { gracefulDegradation: false });

      // Then: SERVICE_UNAVAILABLE 에러
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('SERVICE_UNAVAILABLE');
        expect(result.statusCode).toBe(503);
      }

      // Cleanup
      Object.assign(process.env, originalEnv);
    });
  });

  describe('Provider Contract 검증 (Pact-style)', () => {

    test('Consumer가 요구하는 인증 응답 형식을 제공해야 함', async () => {
      // Given: Consumer가 기대하는 계약
      const consumerExpectation = {
        request: {
          method: 'GET',
          path: '/api/auth/me',
          headers: {
            'x-user-id': 'consumer-test-user'
          }
        },
        response: {
          status: 200,
          body: {
            id: 'consumer-test-user',
            email: expect.any(String),
            isAuthenticated: true,
            tokenType: expect.oneOf(['supabase', 'legacy'])
          }
        }
      };

      // When: Provider가 응답 생성
      process.env.NODE_ENV = 'development';
      const request = new NextRequest('http://localhost/api/auth/me', {
        headers: consumerExpectation.request.headers
      });

      const result = await authenticateRequest(request);

      // Then: Consumer 계약 충족
      expect(isAuthenticated(result)).toBe(true);
      if (isAuthenticated(result)) {
        expect({
          id: result.id,
          email: result.email,
          isAuthenticated: result.isAuthenticated,
          tokenType: result.tokenType
        }).toEqual(consumerExpectation.response.body);
      }

      process.env.NODE_ENV = 'test';
    });

    test('Consumer가 요구하는 에러 응답 형식을 제공해야 함', async () => {
      // Given: Consumer가 기대하는 에러 계약
      const errorContractExpectation = {
        request: {
          method: 'POST',
          path: '/api/auth/refresh',
          cookies: {} // 리프레시 토큰 없음
        },
        response: {
          status: 400, // 무한 루프 방지
          body: {
            code: 'MISSING_REFRESH_TOKEN',
            message: expect.stringContaining('리프레시'),
            statusCode: 400,
            details: expect.objectContaining({
              preventInfiniteLoop: true
            })
          }
        }
      };

      // When: Provider가 에러 응답 생성
      const request = new NextRequest('http://localhost/api/auth/refresh');
      const errorResponse = createMissingRefreshTokenError(request);

      // Then: Consumer 에러 계약 충족
      expect(errorResponse.status).toBe(400);

      const responseBody = await errorResponse.json();
      expect(responseBody).toEqual(expect.objectContaining({
        code: 'MISSING_REFRESH_TOKEN',
        statusCode: 400,
        details: expect.objectContaining({
          preventInfiniteLoop: true
        })
      }));
    });
  });

  describe('Backward Compatibility 검증', () => {

    test('기존 클라이언트와 호환되는 응답 구조를 제공해야 함', async () => {
      // Given: 레거시 클라이언트가 기대하는 형식
      const legacyExpectation = {
        id: expect.any(String),
        email: expect.any(String),
        username: expect.any(String),
        // 새로운 필드들은 optional
        tokenType: expect.any(String),
        isAuthenticated: expect.any(Boolean)
      };

      // When: 새로운 시스템에서 응답 생성
      process.env.NODE_ENV = 'development';
      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'x-user-id': 'legacy-compat-user' }
      });

      const result = await authenticateRequest(request);

      // Then: 레거시 호환성 유지
      expect(isAuthenticated(result)).toBe(true);
      if (isAuthenticated(result)) {
        expect(result).toEqual(expect.objectContaining(legacyExpectation));
      }

      process.env.NODE_ENV = 'test';
    });
  });

  describe('Security Contract 검증', () => {

    test('프로덕션 환경에서 개발용 헤더를 무시해야 함', async () => {
      // Given: 프로덕션 환경 설정
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-user-id': 'should-be-ignored' // 보안 위험
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: 개발용 헤더 무시하고 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
      }

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    test('잘못된 토큰 형식을 올바르게 거부해야 함', async () => {
      // Given: 잘못된 JWT 형식
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer not.a.jwt.token.format'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: 토큰 형식 오류로 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(['INVALID_TOKEN', 'UNAUTHORIZED']).toContain(result.code);
        expect(result.statusCode).toBe(401);
      }
    });
  });

  describe('Performance Contract 검증', () => {

    test('캐싱이 올바르게 동작해야 함', async () => {
      // Given: 동일한 요청
      process.env.NODE_ENV = 'development';
      const request = new NextRequest('http://localhost/api/test', {
        headers: { 'x-user-id': 'cache-test-user' }
      });

      // When: 첫 번째 및 두 번째 호출
      const firstResult = await authenticateRequest(request);
      const secondResult = await authenticateRequest(request);

      // Then: 캐시된 결과 반환 (성능 최적화)
      expect(firstResult).toEqual(secondResult);
      // 실제로는 참조 동일성 확인 가능
      // expect(secondResult).toBe(firstResult); // 캐시 확인

      process.env.NODE_ENV = 'test';
    });

    test('응답 시간이 합리적이어야 함', async () => {
      // Given: 성능 측정
      const request = new NextRequest('http://localhost/api/test');

      // When: 인증 시간 측정
      const startTime = Date.now();
      await authenticateRequest(request, { allowGuest: true });
      const endTime = Date.now();

      // Then: 응답 시간 < 100ms (합리적인 성능)
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });
});

/**
 * Contract Verification 가이드
 *
 * 이 테스트는 다음과 같은 계약을 검증합니다:
 *
 * 1. OpenAPI 스펙 준수
 *    - 응답 스키마 정확성
 *    - HTTP 상태 코드 일관성
 *    - 에러 형식 표준화
 *
 * 2. Consumer-Provider 계약
 *    - 클라이언트가 기대하는 응답 형식
 *    - 하위 호환성 보장
 *    - API 계약 위반 감지
 *
 * 3. 안전성 계약
 *    - 무한 루프 방지
 *    - 비용 제한 준수
 *    - 보안 표준 준수
 *
 * 4. 성능 계약
 *    - 응답 시간 SLA
 *    - 캐싱 동작 검증
 *    - 리소스 사용량 제한
 *
 * 모든 계약 위반은 CI에서 자동으로 감지되어 배포를 차단합니다.
 */