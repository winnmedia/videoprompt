/**
 * 통합 인증 미들웨어 TDD 테스트
 * Contract 검증 및 Graceful Degradation 패턴 테스트
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, AuthenticationOptions, AuthResult, AuthError, isAuthError, isAuthenticated } from '@/shared/lib/unified-auth';

// Mock modules
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null // Service Role Key 없는 상황 시뮬레이션
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: new Error('Mock error') }))
    }
  }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn(() => undefined)
  }))
}));

vi.mock('@/shared/lib/auth', () => ({
  verifySessionToken: vi.fn(() => null)
}));

// Mock 환경 변수
const originalEnv = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test'
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('UnifiedAuth Middleware - Contract Verification', () => {
  describe('RED: 실패 테스트 (Contract 기반)', () => {

    test('토큰 없이 요청하면 UNAUTHORIZED 에러를 반환해야 함', async () => {
      // Given: 토큰이 없는 요청
      const request = new NextRequest('http://localhost/api/test');

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Contract에 따른 UNAUTHORIZED 에러
      expect(result).toEqual({
        code: 'UNAUTHORIZED',
        message: '유효한 인증 토큰이 필요합니다.',
        statusCode: 401,
        details: {
          tokenType: 'none',
          degradationMode: false
        }
      } satisfies AuthError);
    });

    test('유효하지 않은 Supabase 토큰으로 요청하면 INVALID_TOKEN 에러를 반환해야 함', async () => {
      // Given: 유효하지 않은 Supabase Bearer 토큰
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer invalid.supabase.token'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Contract에 따른 INVALID_TOKEN 에러
      expect(result).toEqual({
        code: 'INVALID_TOKEN',
        message: '유효하지 않은 인증 토큰입니다.',
        statusCode: 401,
        details: {
          tokenType: 'supabase',
          degradationMode: false
        }
      } satisfies AuthError);
    });

    test('만료된 레거시 JWT 토큰으로 요청하면 TOKEN_EXPIRED 에러를 반환해야 함', async () => {
      // Given: 만료된 레거시 JWT
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjE2MDk0NTkyMDB9.invalid';
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': `Bearer ${expiredToken}`
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Contract에 따른 TOKEN_EXPIRED 에러
      expect(result).toEqual({
        code: 'TOKEN_EXPIRED',
        message: '인증 토큰이 만료되었습니다.',
        statusCode: 401,
        details: {
          tokenType: 'legacy',
          degradationMode: false
        }
      } satisfies AuthError);
    });

    test('이메일 미인증 사용자가 requireEmailVerified 옵션으로 요청하면 EMAIL_NOT_VERIFIED 에러를 반환해야 함', async () => {
      // Given: 이메일 미인증 사용자 토큰 (Mock)
      const unverifiedToken = 'mock.unverified.token';
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': `Bearer ${unverifiedToken}`
        }
      });

      const options: AuthenticationOptions = {
        requireEmailVerified: true
      };

      // When: 이메일 인증 필수로 인증 시도
      const result = await authenticateRequest(request, options);

      // Then: Contract에 따른 EMAIL_NOT_VERIFIED 에러
      expect(result).toEqual({
        code: 'EMAIL_NOT_VERIFIED',
        message: '이메일 인증이 필요합니다.',
        statusCode: 401,
        details: {
          tokenType: 'supabase',
          degradationMode: false
        }
      } satisfies AuthError);
    });

    test('Service Role Key 없이 Supabase 토큰 검증 시 SERVICE_UNAVAILABLE 에러를 반환해야 함', async () => {
      // Given: Service Role Key 없는 환경
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer supabase.token.without.service.key'
        }
      });

      const options: AuthenticationOptions = {
        gracefulDegradation: false // Graceful degradation 비활성화
      };

      // When: 인증 시도
      const result = await authenticateRequest(request, options);

      // Then: Contract에 따른 SERVICE_UNAVAILABLE 에러
      expect(result).toEqual({
        code: 'SERVICE_UNAVAILABLE',
        message: '인증 서비스가 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.',
        statusCode: 503,
        details: {
          tokenType: 'supabase',
          degradationMode: false
        }
      } satisfies AuthError);
    });

    test('게스트 금지 엔드포인트에 게스트가 접근하면 GUEST_REQUIRED 에러를 반환해야 함', async () => {
      // Given: 토큰 없는 게스트 요청
      const request = new NextRequest('http://localhost/api/test');

      const options: AuthenticationOptions = {
        allowGuest: false // 게스트 접근 금지
      };

      // When: 인증 시도
      const result = await authenticateRequest(request, options);

      // Then: Contract에 따른 UNAUTHORIZED 에러 (게스트 금지)
      expect(result).toEqual({
        code: 'UNAUTHORIZED',
        message: '유효한 인증 토큰이 필요합니다.',
        statusCode: 401,
        details: {
          tokenType: 'none',
          degradationMode: false
        }
      } satisfies AuthError);
    });
  });

  describe('GREEN: 성공 테스트 (Contract 기반)', () => {

    test('유효한 Supabase 토큰으로 요청하면 AuthenticatedUser를 반환해야 함', async () => {
      // Given: 유효한 Supabase Bearer 토큰 (Mock 설정 필요)
      const validSupabaseToken = 'valid.supabase.token';
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': `Bearer ${validSupabaseToken}`
        }
      });

      // Mock Supabase Admin 응답
      const mockSupabaseUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@videoplanet.co.kr',
        user_metadata: { username: 'videomaker01' }
      };

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Contract에 따른 AuthenticatedUser
      expect(result).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@videoplanet.co.kr',
        username: 'videomaker01',
        isAuthenticated: true,
        tokenType: 'supabase',
        emailVerified: true
      });
    });

    test('유효한 레거시 JWT 토큰으로 요청하면 AuthenticatedUser를 반환해야 함', async () => {
      // Given: 유효한 레거시 JWT (Mock 환경 설정)
      process.env.JWT_SECRET = 'test-secret-key';

      const validLegacyToken = 'valid.legacy.jwt.token';
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': `Bearer ${validLegacyToken}`
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Contract에 따른 AuthenticatedUser
      expect(result).toEqual({
        id: 'legacy-user-123',
        email: 'legacy@videoplanet.co.kr',
        username: 'legacyuser',
        isAuthenticated: true,
        tokenType: 'legacy',
        emailVerified: false // 레거시는 이메일 인증 정보 없음
      });
    });

    test('게스트 허용 옵션으로 토큰 없이 요청하면 GuestUser를 반환해야 함', async () => {
      // Given: 토큰 없는 요청, 게스트 허용
      const request = new NextRequest('http://localhost/api/test');

      const options: AuthenticationOptions = {
        allowGuest: true
      };

      // When: 인증 시도
      const result = await authenticateRequest(request, options);

      // Then: Contract에 따른 GuestUser
      expect(result).toEqual({
        id: null,
        email: null,
        username: null,
        isAuthenticated: false,
        tokenType: 'guest'
      });
    });

    test('Service Role Key 없어도 Graceful degradation으로 제한된 기능 제공해야 함', async () => {
      // Given: Service Role Key 없는 환경, Graceful degradation 활성화
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer limited.supabase.token'
        }
      });

      const options: AuthenticationOptions = {
        gracefulDegradation: true
      };

      // When: 인증 시도
      const result = await authenticateRequest(request, options);

      // Then: 제한된 기능으로 인증 성공 (토큰 파싱으로만 검증)
      expect(result).toEqual({
        id: 'limited-user-id',
        email: null, // 제한된 정보
        username: null,
        isAuthenticated: true,
        tokenType: 'supabase',
        emailVerified: false // 제한된 정보
      });
    });
  });

  describe('REFACTOR: 토큰 우선순위 테스트', () => {

    test('Supabase Bearer 토큰이 레거시 JWT보다 우선해야 함', async () => {
      // Given: 두 토큰 모두 있는 요청 (Supabase Bearer + 레거시 쿠키)
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer valid.supabase.token',
          'Cookie': 'session=valid.legacy.jwt'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Supabase 토큰이 선택되어야 함
      expect(result).toMatchObject({
        tokenType: 'supabase'
      });
    });

    test('Supabase 쿠키가 레거시 Bearer 토큰보다 우선해야 함', async () => {
      // Given: Supabase 쿠키 + 레거시 Bearer
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'Authorization': 'Bearer legacy.jwt.token',
          'Cookie': 'sb-access-token=valid.supabase.cookie'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: Supabase 쿠키가 선택되어야 함
      expect(result).toMatchObject({
        tokenType: 'supabase'
      });
    });
  });

  describe('무한 루프 방지 테스트', () => {

    test('동일한 요청을 1분 내 반복하면 캐시된 결과를 반환해야 함', async () => {
      // Given: 동일한 요청
      const request = new NextRequest('http://localhost/api/auth/me', {
        headers: {
          'Authorization': 'Bearer cached.token'
        }
      });

      // When: 첫 번째 요청
      const firstResult = await authenticateRequest(request);

      // And: 1분 내 동일한 요청
      const secondResult = await authenticateRequest(request);

      // Then: 캐시된 결과여야 함 (참조 동일성)
      expect(secondResult).toBe(firstResult);
    });

    test('ETag 헤더를 사용한 조건부 요청을 지원해야 함', async () => {
      // Given: ETag가 있는 요청
      const request = new NextRequest('http://localhost/api/auth/me', {
        headers: {
          'Authorization': 'Bearer etag.token',
          'If-None-Match': '"cached-etag-value"'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: 304 Not Modified 응답 정보 포함
      expect(result).toMatchObject({
        cached: true,
        etag: '"cached-etag-value"'
      });
    });
  });

  describe('타입 가드 테스트', () => {

    test('isAuthError 타입 가드가 올바르게 동작해야 함', async () => {
      // Given: 에러 결과
      const errorResult: AuthError = {
        code: 'UNAUTHORIZED',
        message: '인증 실패',
        statusCode: 401,
        details: { tokenType: 'none', degradationMode: false }
      };

      // When & Then: 타입 가드 검증
      expect(isAuthError(errorResult)).toBe(true);

      if (isAuthError(errorResult)) {
        expect(errorResult.code).toBe('UNAUTHORIZED');
        expect(errorResult.statusCode).toBe(401);
      }
    });

    test('isAuthenticated 타입 가드가 올바르게 동작해야 함', async () => {
      // Given: 인증된 사용자 결과
      const authResult: AuthResult = {
        id: 'user-id',
        email: 'user@test.com',
        username: 'testuser',
        isAuthenticated: true,
        tokenType: 'supabase',
        emailVerified: true
      };

      // When & Then: 타입 가드 검증
      expect(isAuthenticated(authResult)).toBe(true);

      if (isAuthenticated(authResult)) {
        expect(authResult.isAuthenticated).toBe(true);
        expect(authResult.id).toBe('user-id');
      }
    });
  });

  describe('환경별 동작 테스트', () => {

    test('개발 환경에서는 x-user-id 헤더를 허용해야 함', async () => {
      // Given: 개발 환경 설정
      process.env.NODE_ENV = 'development';

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-user-id': 'dev-test-user'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: 개발용 헤더로 인증 성공
      expect(result).toMatchObject({
        id: 'dev-test-user',
        isAuthenticated: true,
        tokenType: 'legacy' // 개발용은 레거시로 분류
      });
    });

    test('프로덕션 환경에서는 x-user-id 헤더를 무시해야 함', async () => {
      // Given: 프로덕션 환경 설정
      process.env.NODE_ENV = 'production';

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-user-id': 'prod-test-user'
        }
      });

      // When: 인증 시도
      const result = await authenticateRequest(request);

      // Then: 헤더 무시하고 인증 실패
      expect(result).toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401
      });
    });
  });
});

// 테스트 완료