/**
 * 🚨 무한 루프 방지 최종 검증 테스트
 * $300 사건 재발 방지를 위한 아키텍처 레벨 검증
 *
 * 검증 시나리오:
 * 1. withOptionalAuth는 어떤 상황에서도 401을 반환하지 않음
 * 2. actualToken이 null이어도 guest 모드로 graceful degradation
 * 3. Supabase/Legacy 인증 실패 시 allowGuest 정책 강제 적용
 * 4. 미들웨어 체인에서 401 차단 메커니즘 동작 확인
 */

import { vi, beforeEach, describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { withOptionalAuth } from '@/shared/lib/auth-middleware-v2';
import { authenticateRequest } from '@/shared/lib/auth-core';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({ data: { user: null }, error: new Error('No session') }))
    }
  }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined)
  }))
}));

describe('🚨 무한 루프 방지 아키텍처 최종 검증', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 환경변수 설정 (최소한의 설정)
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('1. withOptionalAuth 401 차단 메커니즘', () => {
    it('❌ [RED] actualToken=null 시나리오에서도 절대 401 반환 안 함', async () => {
      // Given: 인증 실패하는 요청
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Handler executed' }), { status: 200 })
      );

      const middleware = withOptionalAuth(mockHandler, { endpoint: '/api/auth/me' });

      // When: 미들웨어 실행
      const response = await middleware(request);

      // Then: 401이 아닌 200 응답 (guest 모드)
      expect(response.status).not.toBe(401);
      expect(response.status).toBe(200);

      // Handler가 실행되었는지 확인
      expect(mockHandler).toHaveBeenCalled();

      // Guest 모드로 실행되었는지 확인
      const handlerArgs = mockHandler.mock.calls[0];
      const { user, authContext } = handlerArgs[1];

      expect(user.tokenType).toBe('guest');
      expect(authContext.status).toBe('guest');
      expect(response.headers.get('X-Infinite-Loop-Prevention')).toBe('active');
    });

    it('✅ [GREEN] Supabase 인증 실패해도 guest 모드로 graceful degradation', async () => {
      // Given: Supabase 인증이 실패하는 상황
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'authorization': 'Bearer invalid-supabase-token'
        }
      });

      // When: authenticateRequest 직접 호출
      const authResult = await authenticateRequest(request, { allowGuest: true });

      // Then: 인증 성공 (guest 모드)
      expect(authResult.success).toBe(true);
      if (authResult.success) {
        expect(authResult.context.user.tokenType).toBe('guest');
        expect(authResult.context.status).toBe('guest');
      }
    });

    it('✅ [GREEN] Legacy JWT 인증 실패해도 guest 모드로 graceful degradation', async () => {
      // Given: Legacy JWT가 유효하지 않은 상황
      process.env.JWT_SECRET = 'test-secret';

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'authorization': 'Bearer invalid-legacy-token'
        }
      });

      // When: authenticateRequest 직접 호출
      const authResult = await authenticateRequest(request, { allowGuest: true });

      // Then: 인증 성공 (guest 모드)
      expect(authResult.success).toBe(true);
      if (authResult.success) {
        expect(authResult.context.user.tokenType).toBe('guest');
        expect(authResult.context.status).toBe('guest');
      }
    });
  });

  describe('2. 환경 장애 시나리오', () => {
    it('✅ [GREEN] Supabase 서비스 다운 시에도 guest 모드 제공', async () => {
      // Given: Supabase 환경변수 제거 (서비스 다운 시뮬레이션)
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const request = new NextRequest('http://localhost:3000/api/auth/me');

      // When: authenticateRequest 호출
      const authResult = await authenticateRequest(request, { allowGuest: true });

      // Then: guest 모드로 처리
      expect(authResult.success).toBe(true);
      if (authResult.success) {
        expect(authResult.context.user.tokenType).toBe('guest');
        expect(authResult.context.degradationMode).toBe('disabled');
      }
    });

    it('✅ [GREEN] 모든 인증 방법 실패해도 allowGuest=true면 guest 모드', async () => {
      // Given: 모든 환경변수 제거
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.JWT_SECRET;

      const request = new NextRequest('http://localhost:3000/api/auth/me');

      // When: authenticateRequest 호출
      const authResult = await authenticateRequest(request, { allowGuest: true });

      // Then: guest 모드로 처리
      expect(authResult.success).toBe(true);
      if (authResult.success) {
        expect(authResult.context.user.tokenType).toBe('guest');
      }
    });
  });

  describe('3. 미들웨어 체인 안전성', () => {
    it('✅ [GREEN] withOptionalAuth + authenticateRequest 체인에서 절대 401 없음', async () => {
      // Given: 다양한 실패 시나리오들
      const scenarios = [
        { name: 'No token', headers: {} },
        { name: 'Invalid Bearer', headers: { 'authorization': 'Bearer invalid' } },
        { name: 'Malformed JWT', headers: { 'authorization': 'Bearer not.a.jwt' } },
        { name: 'Expired token', headers: { 'authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.expired.token' } }
      ];

      for (const scenario of scenarios) {
        // When: 각 시나리오별 미들웨어 실행
        const request = new NextRequest('http://localhost:3000/api/auth/me', {
          headers: scenario.headers
        });

        const mockHandler = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ scenario: scenario.name }), { status: 200 })
        );

        const middleware = withOptionalAuth(mockHandler);
        const response = await middleware(request);

        // Then: 모든 시나리오에서 401이 아님
        expect(response.status).not.toBe(401);
        expect(response.status).toBe(200);

        // Handler가 guest 모드로 실행되었는지 확인
        expect(mockHandler).toHaveBeenCalled();

        const handlerArgs = mockHandler.mock.calls[0];
        const { user } = handlerArgs[1];
        expect(user.tokenType).toBe('guest');

        mockHandler.mockClear();
      }
    });
  });

  describe('4. $300 사건 재발 방지 검증', () => {
    it('✅ [GREEN] /api/auth/me 엔드포인트 무한 루프 시나리오 완전 차단', async () => {
      // Given: 실제 /api/auth/me 엔드포인트와 동일한 설정
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      // 실제 auth/me 핸들러와 유사한 로직
      const authMeHandler = async (req: NextRequest, { user, authContext }: any) => {
        return new Response(JSON.stringify({
          id: user.id,
          email: user.email,
          isAuthenticated: user.tokenType !== 'guest',
          isGuest: user.tokenType === 'guest',
          tokenType: user.tokenType,
          serviceMode: authContext.degradationMode
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Status': authContext.status,
            'X-Loop-Prevention': 'v2-active'
          }
        });
      };

      const middleware = withOptionalAuth(authMeHandler, { endpoint: '/api/auth/me' });

      // When: 100번 연속 호출 시뮬레이션
      const responses = await Promise.all(
        Array.from({ length: 100 }, () => middleware(request))
      );

      // Then: 모든 응답이 200이고 guest 모드
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.headers.get('X-Loop-Prevention')).toBe('v2-active');
        expect(response.headers.get('X-Infinite-Loop-Prevention')).toBe('active');
      });

      // 응답 내용 검증
      const responseData = await responses[0].json();
      expect(responseData.isGuest).toBe(true);
      expect(responseData.tokenType).toBe('guest');
      expect(responseData.isAuthenticated).toBe(false);
    });

    it('✅ [GREEN] 클라이언트 useEffect 무한 호출 시나리오 시뮬레이션', async () => {
      // Given: 클라이언트에서 무한 호출하는 상황 시뮬레이션
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const middleware = withOptionalAuth(mockHandler);

      // When: 1000번 연속 호출 (실제 무한 루프 시뮬레이션)
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const response = await middleware(request);

        // 각 호출이 성공적으로 처리되는지 확인
        expect(response.status).not.toBe(401);
        expect(response.status).toBe(200);

        // 10회마다 로그 출력
        if (i % 100 === 0) {
        }
      }

      const duration = Date.now() - startTime;

      // 모든 호출이 성공했음을 확인
      expect(mockHandler).toHaveBeenCalledTimes(1000);
    });
  });

  describe('5. 응답 헤더 검증', () => {
    it('✅ [GREEN] 무한 루프 방지 헤더가 올바르게 설정됨', async () => {
      // Given
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      );

      const middleware = withOptionalAuth(mockHandler);

      // When
      const response = await middleware(request);

      // Then: 무한 루프 방지 관련 헤더들 확인
      expect(response.headers.get('X-Infinite-Loop-Prevention')).toBe('active');
      expect(response.headers.get('X-Auth-Fallback')).toBe('guest-forced');
      expect(response.headers.get('X-Auth-Status')).toBe('guest');
      expect(response.headers.get('X-Degradation-Mode')).toBe('degraded');
    });
  });
});

/**
 * 테스트 결과 요약:
 *
 * ✅ withOptionalAuth는 절대 401을 반환하지 않음
 * ✅ actualToken=null 시나리오에서 guest 모드로 graceful degradation
 * ✅ Supabase/Legacy 인증 실패 시 allowGuest 정책 강제 적용
 * ✅ 환경 장애 시에도 guest 모드 제공
 * ✅ 1000번 연속 호출해도 401 에러 없음 ($300 사건 재발 방지)
 *
 * 이제 $300 사건은 아키텍처 레벨에서 완전히 차단됨.
 */