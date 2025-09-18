/**
 * 🚨 $300 사건 재발 방지 - /api/auth/me 무한 루프 차단 테스트
 * getActualAccessToken null 케이스에서 guest 모드 fallback 검증
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auth/me/route';
import type { AuthenticatedUser } from '@/shared/lib/unified-auth';

// Mock dependencies
vi.mock('@/shared/lib/api-response', () => ({
  success: vi.fn((data, status, traceId) => ({
    json: () => Promise.resolve({ data, status, traceId }),
    headers: new Map(),
    status
  })),
  failure: vi.fn((code, message, status, details, traceId) => ({
    json: () => Promise.resolve({ error: { code, message }, status, traceId }),
    headers: new Map(),
    status
  })),
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

vi.mock('@/shared/lib/auth-middleware', () => ({
  withAuth: vi.fn((handler, options) => async (req, params) => {
    // Mock authenticated user with minimal data
    const mockUser: AuthenticatedUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      tokenType: 'supabase' as const,
      isEmailVerified: true,
    };

    return handler(req, {
      user: mockUser,
      degradationMode: false,
      adminAccess: false,
    });
  }),
}));

vi.mock('@/shared/lib/loop-prevention', () => ({
  withLoopPrevention: vi.fn((handler) => handler),
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: vi.fn(),
    },
  },
}));

describe('🚨 /api/auth/me 무한 루프 방지 - $300 사건 재발 차단', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('❌ FAILING TESTS - 현재 문제 상황', () => {
    test('인증된 사용자 + actualToken null + refresh 실패 → guest 모드 (401 대신)', async () => {
      // Arrange: 인증된 사용자이지만 토큰을 읽을 수 없고 refresh도 실패
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'expired-refresh-token' };
            }
            return undefined;
          }),
        },
      });

      // Supabase 토큰 갱신 실패 모킹
      const { supabase } = require('@/lib/supabase');
      supabase.auth.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid refresh token', status: 401 },
      });

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert: 401 대신 200 + guest 모드
      expect(response.status).toBe(200); // 401이 아닌 200
      expect(result.data.accessToken).toBeNull();
      expect(result.data.isAuthenticated).toBe(false);
      expect(result.data.isGuest).toBe(true);
      expect(result.data.serviceMode).toBe('guest');

      console.log('✅ guest 모드로 graceful degradation 성공');
    });

    test('인증된 사용자 + refresh token 없음 → guest 모드 즉시 전환', async () => {
      // Arrange: refresh token도 없는 경우
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn(() => undefined), // 모든 쿠키 없음
        },
      });

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert: guest 모드로 즉시 전환
      expect(response.status).toBe(200);
      expect(result.data.accessToken).toBeNull();
      expect(result.data.isGuest).toBe(true);
      expect(result.data.serviceMode).toBe('guest');

      console.log('✅ refresh token 없음 - guest 모드 즉시 전환');
    });

    test('토큰 갱신 성공 → 새 토큰으로 인증 상태 유지', async () => {
      // Arrange: 토큰 갱신 성공 케이스
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token' };
            }
            return undefined;
          }),
        },
      });

      // Supabase 토큰 갱신 성공 모킹
      const { supabase } = require('@/lib/supabase');
      supabase.auth.setSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'eyJ.new-valid-token.signature',
            refresh_token: 'valid-refresh-token',
          },
        },
        error: null,
      });

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert: 갱신된 토큰으로 인증 유지
      expect(response.status).toBe(200);
      expect(result.data.accessToken).toBe('eyJ.new-valid-token.signature');
      expect(result.data.isAuthenticated).toBe(true);
      expect(result.data.isGuest).toBe(false);
      expect(result.data.serviceMode).toBe('full');

      console.log('✅ 토큰 갱신 성공 - 인증 상태 유지');
    });
  });

  describe('🔒 안전장치 검증', () => {
    test('무한 루프 방지 헤더 확인', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn(() => undefined),
        },
      });

      // Act
      const response = await GET(request);

      // Assert: 무한 루프 방지 헤더 존재
      expect(response.headers.get('X-Loop-Prevention')).toBe('active');
      expect(response.headers.get('X-Cache-Policy')).toBe('client-cache-required');
      expect(response.headers.get('X-Guest-Mode')).toBe('true');
      expect(response.headers.get('X-Client-Action')).toBe('continue-as-guest');
      expect(response.headers.get('X-Retry-Policy')).toBe('no-retry');

      console.log('✅ 무한 루프 방지 헤더 모두 설정됨');
    });

    test('캐싱 헤더로 비용 절약', async () => {
      // Arrange: ETag 일치하는 요청
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'if-none-match': '"user-test-user-id-test@example.com"',
        },
      });

      // Act
      const response = await GET(request);

      // Assert: 304 Not Modified
      expect(response.status).toBe(304);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');

      console.log('✅ 304 Not Modified로 API 호출 비용 절약');
    });

    test('일시적 에러는 401 반환 (재시도 허용)', async () => {
      // Arrange: 네트워크 에러 (재시도 가능한 에러)
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token' };
            }
            return undefined;
          }),
        },
      });

      // 네트워크 에러 모킹
      const { supabase } = require('@/lib/supabase');
      supabase.auth.setSession.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert: 일시적 에러는 401 반환 (재시도 허용)
      expect(response.status).toBe(401);
      expect(result.error.code).toBe('TOKEN_REFRESH_FAILED');

      console.log('✅ 일시적 에러는 401 반환하여 재시도 허용');
    });
  });

  describe('💰 비용 안전 검증', () => {
    test('attemptTokenRefresh 최대 1회만 시도', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token' };
            }
            return undefined;
          }),
        },
      });

      const { supabase } = require('@/lib/supabase');
      supabase.auth.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid token' },
      });

      // Act
      await GET(request);

      // Assert: setSession 1회만 호출됨
      expect(supabase.auth.setSession).toHaveBeenCalledTimes(1);

      console.log('✅ 토큰 갱신 최대 1회만 시도');
    });

    test('비용 안전 헤더 확인', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      // Act
      const response = await GET(request);

      // Assert: 비용 안전 헤더 존재
      expect(response.headers.get('X-Cost-Safety')).toBe('enforced');
      expect(response.headers.get('X-Rate-Limit-Policy')).toBe('active');

      console.log('✅ 비용 안전 헤더 설정됨');
    });
  });

  describe('🔍 개발 환경 디버깅', () => {
    test('개발환경에서 디버깅 정보 포함', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const request = new NextRequest('http://localhost:3000/api/auth/me');

      Object.defineProperty(request, 'cookies', {
        value: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'debug-token' };
            }
            return undefined;
          }),
        },
      });

      // Act
      const response = await GET(request);
      const result = await response.json();

      // Assert: 디버깅 정보 포함
      expect(result.data._debug).toBeDefined();
      expect(result.data._debug.hasRefreshToken).toBe(true);
      expect(result.data._debug.userTokenType).toBe('supabase');

      // Cleanup
      process.env.NODE_ENV = originalEnv;

      console.log('✅ 개발환경 디버깅 정보 포함됨');
    });
  });
});