/**
 * 인증 refresh route 일관성 개선 테스트 (TDD Red Phase)
 * Supabase 클라이언트 사용의 일관성 확보
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// 모킹할 모듈들
vi.mock('@/shared/lib/supabase-safe', () => ({
  getSupabaseClientSafe: vi.fn(),
  ServiceConfigError: class ServiceConfigError extends Error {
    constructor(statusCode, message, errorCode = 'SERVICE_UNAVAILABLE') {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      this.name = 'ServiceConfigError';
    }
  }
}));

vi.mock('@/shared/lib/api-response', () => ({
  success: vi.fn((data, status, traceId) => ({
    json: vi.fn().mockResolvedValue({ data, traceId }),
    status,
    headers: new Map(),
    cookies: { set: vi.fn(), delete: vi.fn() }
  })),
  failure: vi.fn((code, message, status, details, traceId) => ({
    json: vi.fn().mockResolvedValue({ error: { code, message, details }, traceId }),
    status,
    headers: new Map(),
    cookies: { set: vi.fn(), delete: vi.fn() }
  })),
  getTraceId: vi.fn(() => 'test-trace-id')
}));

vi.mock('@/shared/lib/cors-utils', () => ({
  addCorsHeaders: vi.fn((response) => response)
}));

vi.mock('@/shared/lib/loop-prevention', () => ({
  withLoopPrevention: vi.fn((handler) => handler)
}));

vi.mock('@/shared/lib/http-error-handler', () => ({
  createMissingRefreshTokenError: vi.fn(() => ({
    status: 400,
    headers: new Map(),
    cookies: { set: vi.fn(), delete: vi.fn() }
  })),
  createUnauthorizedError: vi.fn(() => ({
    status: 401,
    headers: new Map(),
    cookies: { set: vi.fn(), delete: vi.fn() }
  }))
}));

vi.mock('@/shared/lib/cookie-security', () => ({
  getAccessTokenCookieOptions: vi.fn(() => ({})),
  getRefreshTokenCookieOptions: vi.fn(() => ({})),
  getCookieDebugInfo: vi.fn(() => 'debug info')
}));

vi.mock('@/shared/contracts/auth.contract', () => ({
  AUTH_CONSTANTS: {
    COOKIES: {
      SUPABASE_ACCESS: 'sb-access-token',
      SUPABASE_REFRESH: 'sb-refresh-token',
      LEGACY_REFRESH: 'refresh_token',
      LEGACY_SESSION: 'session'
    }
  }
}));

describe('Refresh Route Supabase 클라이언트 일관성', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // getSupabaseClientSafe mock 설정
    mockSupabaseClient = {
      auth: {
        setSession: vi.fn()
      }
    };

    const { getSupabaseClientSafe } = require('@/shared/lib/supabase-safe');
    getSupabaseClientSafe.mockResolvedValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSupabaseClientSafe 사용 일관성', () => {
    it('직접 supabase import 대신 getSupabaseClientSafe(anon) 사용해야 함', async () => {
      // Given: 유효한 refresh token이 있는 요청
      const mockRequest = {
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token' };
            }
            return undefined;
          })
        }
      } as any;

      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token'
          },
          user: {
            id: 'user-id',
            email: 'test@example.com'
          }
        },
        error: null
      });

      // When: refresh route 호출
      const { POST } = await import('@/app/api/auth/refresh/route');
      await POST(mockRequest as NextRequest);

      // Then: getSupabaseClientSafe가 'anon' 모드로 호출되어야 함
      const { getSupabaseClientSafe } = require('@/shared/lib/supabase-safe');
      expect(getSupabaseClientSafe).toHaveBeenCalledWith('anon');
    });

    it('Supabase 클라이언트 초기화 실패 시 503 에러 반환해야 함', async () => {
      // Given: getSupabaseClientSafe가 ServiceConfigError 던짐
      const { getSupabaseClientSafe, ServiceConfigError } = require('@/shared/lib/supabase-safe');
      getSupabaseClientSafe.mockRejectedValue(new ServiceConfigError(
        503,
        'Supabase service not available',
        'SUPABASE_UNAVAILABLE'
      ));

      const mockRequest = {
        cookies: {
          get: vi.fn()
        }
      } as any;

      // When: refresh route 호출
      const { POST } = await import('@/app/api/auth/refresh/route');
      const response = await POST(mockRequest as NextRequest);

      // Then: 503 에러와 적절한 에러 메시지 반환
      const { failure } = require('@/shared/lib/api-response');
      expect(failure).toHaveBeenCalledWith(
        'SUPABASE_UNAVAILABLE',
        'Supabase service not available',
        503,
        'Supabase client not initialized',
        'test-trace-id'
      );
    });

    it('환경변수 누락 시 일관된 에러 처리가 되어야 함', async () => {
      // Given: Supabase 환경변수 관련 에러
      const { getSupabaseClientSafe } = require('@/shared/lib/supabase-safe');
      getSupabaseClientSafe.mockRejectedValue(new Error('SUPABASE_URL is not configured'));

      const mockRequest = {
        cookies: {
          get: vi.fn()
        }
      } as any;

      // When: refresh route 호출
      const { POST } = await import('@/app/api/auth/refresh/route');
      const response = await POST(mockRequest as NextRequest);

      // Then: Supabase 설정 에러로 처리되어야 함
      const { failure } = require('@/shared/lib/api-response');
      expect(failure).toHaveBeenCalledWith(
        'SUPABASE_CONFIG_ERROR',
        'Backend configuration error. Please contact support.',
        503,
        'Supabase client initialization failed',
        'test-trace-id'
      );
    });
  });

  describe('에러 핸들링 일관성', () => {
    it('네트워크 에러 시 503 에러와 Retry-After 헤더 반환해야 함', async () => {
      // Given: 네트워크 에러 발생
      mockSupabaseClient.auth.setSession.mockRejectedValue(new Error('fetch failed'));

      const mockRequest = {
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'valid-refresh-token' };
            }
            return undefined;
          })
        }
      } as any;

      // When: refresh route 호출
      const { POST } = await import('@/app/api/auth/refresh/route');
      const response = await POST(mockRequest as NextRequest);

      // Then: 503 에러와 재시도 헤더가 설정되어야 함
      const { failure } = require('@/shared/lib/api-response');
      expect(failure).toHaveBeenCalledWith(
        'SERVICE_UNAVAILABLE',
        expect.stringContaining('일시적으로 접근할 수 없습니다'),
        503,
        expect.stringContaining('Network error'),
        'test-trace-id'
      );
    });

    it('토큰 갱신 실패 시 401 에러와 쿠키 정리가 되어야 함', async () => {
      // Given: 토큰 갱신 실패
      mockSupabaseClient.auth.setSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' }
      });

      const mockRequest = {
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'sb-refresh-token') {
              return { value: 'invalid-refresh-token' };
            }
            return undefined;
          })
        }
      } as any;

      // When: refresh route 호출
      const { POST } = await import('@/app/api/auth/refresh/route');
      const response = await POST(mockRequest as NextRequest);

      // Then: 401 에러가 반환되어야 함
      const { createUnauthorizedError } = require('@/shared/lib/http-error-handler');
      expect(createUnauthorizedError).toHaveBeenCalledWith(
        mockRequest,
        'supabase',
        '토큰 갱신에 실패했습니다. 다시 로그인해주세요.'
      );
    });
  });
});