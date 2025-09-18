/**
 * 🔐 auth-middleware-v2.ts 통합 테스트
 * FSD 경계 준수 및 Contract-First 미들웨어 테스트
 *
 * 테스트 범위:
 * - withAuth, withOptionalAuth, withAdminAuth, withGuestOnly
 * - Contract 준수 확인
 * - 에러 처리 및 응답 형식
 * - 헤더 설정 확인
 * - 미들웨어 옵션 동작
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withOptionalAuth,
  withAdminAuth,
  withEmailVerified,
  withGuestOnly,
  authErrors,
  authSuccess
} from '@/shared/lib/auth-middleware-v2';
import { authenticateRequest } from '@/shared/lib/auth-core';
import {
  AuthResult,
  AuthContext,
  User,
  AuthenticatedUser,
  GuestUser,
  HTTP_STATUS,
  isAuthenticatedUser,
  isGuestUser
} from '@/shared/contracts/auth.contract';

// Mock dependencies
jest.mock('@/shared/lib/auth-core');

const mockAuthenticateRequest = jest.mocked(authenticateRequest);

describe('Auth Middleware v2.0', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = new NextRequest('https://example.com/api/test', {
      headers: {
        'x-request-id': 'test-middleware-123'
      }
    });
  });

  // Test helpers
  const createAuthenticatedContext = (user: Partial<AuthenticatedUser> = {}): AuthContext => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      tokenType: 'supabase',
      isEmailVerified: true,
      sessionId: 'session-123',
      expiresAt: Date.now() + 3600000,
      ...user
    } as AuthenticatedUser,
    status: 'authenticated',
    degradationMode: 'full',
    adminAccess: true,
    timestamp: Date.now(),
    requestId: 'test-middleware-123',
    permissions: ['user'],
    canAccessAdmin: user.role === 'admin'
  });

  const createGuestContext = (): AuthContext => ({
    user: {
      id: null,
      email: null,
      username: null,
      role: 'guest',
      tokenType: 'guest',
      isEmailVerified: false,
      sessionId: 'guest-session-123'
    } as GuestUser,
    status: 'guest',
    degradationMode: 'full',
    adminAccess: false,
    timestamp: Date.now(),
    requestId: 'test-middleware-123',
    permissions: [],
    canAccessAdmin: false
  });

  const createAuthError = (code: string, message: string, statusCode: number): AuthResult => ({
    success: false,
    error: {
      code: code as any,
      message,
      statusCode,
      timestamp: Date.now(),
      requestId: 'test-middleware-123'
    }
  });

  describe('withAuth 기본 미들웨어', () => {
    test('인증된 사용자 - 핸들러 정상 실행', async () => {
      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'success' }));
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(mockAuthenticateRequest).toHaveBeenCalledWith(mockRequest, {});
      expect(handler).toHaveBeenCalledWith(mockRequest, {
        user: authContext.user,
        authContext
      });

      expect(response.status).toBe(200);

      // 응답 헤더 확인
      expect(response.headers.get('X-Request-ID')).toBe('test-middleware-123');
      expect(response.headers.get('X-Auth-User-ID')).toBe('user-123');
      expect(response.headers.get('X-Auth-Token-Type')).toBe('supabase');
      expect(response.headers.get('X-Auth-Status')).toBe('authenticated');
    });

    test('인증 실패 - 에러 응답 반환', async () => {
      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('UNAUTHORIZED', '인증이 필요합니다.', HTTP_STATUS.UNAUTHORIZED)
      );

      const handler = jest.fn();
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);

      const body = await response.json();
      expect(body.error).toBe('UNAUTHORIZED');
      expect(body.message).toBe('인증이 필요합니다.');
      expect(body.requestId).toBe('test-middleware-123');
    });

    test('미들웨어 예외 발생 - 500 에러 반환', async () => {
      mockAuthenticateRequest.mockRejectedValue(new Error('Unexpected error'));

      const handler = jest.fn();
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      const body = await response.json();
      expect(body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(body.message).toContain('예상치 못한 오류');
    });

    test('핸들러 예외 발생 - 500 에러 반환', async () => {
      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('withOptionalAuth 미들웨어', () => {
    test('인증된 사용자 - 정상 처리', async () => {
      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ userType: 'authenticated' }));
      const middleware = withOptionalAuth(handler);

      const response = await middleware(mockRequest);

      expect(mockAuthenticateRequest).toHaveBeenCalledWith(mockRequest, { allowGuest: true });
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    test('게스트 사용자 - 정상 처리', async () => {
      const guestContext = createGuestContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: guestContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ userType: 'guest' }));
      const middleware = withOptionalAuth(handler);

      const response = await middleware(mockRequest);

      expect(handler).toHaveBeenCalledWith(mockRequest, {
        user: guestContext.user,
        authContext: guestContext
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Auth-User-ID')).toBe('guest');
    });
  });

  describe('withAdminAuth 미들웨어', () => {
    test('관리자 사용자 - 정상 처리', async () => {
      const adminContext = createAuthenticatedContext({
        role: 'admin'
      });
      adminContext.canAccessAdmin = true;

      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: adminContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'admin success' }));
      const middleware = withAdminAuth(handler);

      const response = await middleware(mockRequest);

      expect(mockAuthenticateRequest).toHaveBeenCalledWith(mockRequest, {
        requireAdmin: true,
        allowDegraded: false
      });
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    test('일반 사용자 - 403 에러', async () => {
      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('FORBIDDEN', '관리자 권한이 필요합니다.', HTTP_STATUS.FORBIDDEN)
      );

      const handler = jest.fn();
      const middleware = withAdminAuth(handler);

      const response = await middleware(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);

      const body = await response.json();
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  describe('withEmailVerified 미들웨어', () => {
    test('이메일 인증된 사용자 - 정상 처리', async () => {
      const verifiedContext = createAuthenticatedContext({
        isEmailVerified: true
      });

      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: verifiedContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'verified user' }));
      const middleware = withEmailVerified(handler);

      const response = await middleware(mockRequest);

      expect(mockAuthenticateRequest).toHaveBeenCalledWith(mockRequest, {
        requireEmailVerified: true
      });
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    test('이메일 미인증 사용자 - 403 에러', async () => {
      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('EMAIL_NOT_VERIFIED', '이메일 인증이 필요합니다.', HTTP_STATUS.FORBIDDEN)
      );

      const handler = jest.fn();
      const middleware = withEmailVerified(handler);

      const response = await middleware(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
    });
  });

  describe('withGuestOnly 미들웨어', () => {
    test('게스트 사용자 - 정상 처리', async () => {
      const guestContext = createGuestContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: guestContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'guest access' }));
      const middleware = withGuestOnly(handler);

      const response = await middleware(mockRequest);

      expect(mockAuthenticateRequest).toHaveBeenCalledWith(mockRequest, { allowGuest: true });
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    test('인증된 사용자 - 403 에러 (이미 로그인됨)', async () => {
      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn();
      const middleware = withGuestOnly(handler);

      const response = await middleware(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);

      const body = await response.json();
      expect(body.error).toBe('ALREADY_AUTHENTICATED');
      expect(body.message).toContain('이미 로그인된 사용자');
    });

    test('서비스 오류 - 에러 전파', async () => {
      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('SERVICE_UNAVAILABLE', '서비스 장애', HTTP_STATUS.SERVICE_UNAVAILABLE)
      );

      const handler = jest.fn();
      const middleware = withGuestOnly(handler);

      const response = await middleware(mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    });
  });

  describe('미들웨어 옵션', () => {
    test('endpoint 옵션 - 로깅에 사용됨', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'success' }));
      const middleware = withAuth(handler, { endpoint: '/api/custom-endpoint' });

      await middleware(mockRequest);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auth middleware success'),
        expect.objectContaining({
          endpoint: '/api/custom-endpoint'
        })
      );

      consoleSpy.mockRestore();
    });

    test('skipErrorLogging 옵션', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('UNAUTHORIZED', '인증 실패', HTTP_STATUS.UNAUTHORIZED)
      );

      const handler = jest.fn();
      const middleware = withAuth(handler, { skipErrorLogging: true });

      await middleware(mockRequest);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('응답 헤더 설정', () => {
    test('인증 정보 헤더가 올바르게 설정됨', async () => {
      const authContext = createAuthenticatedContext({
        id: 'test-user-456',
        tokenType: 'legacy',
        role: 'admin'
      });
      authContext.degradationMode = 'degraded';
      authContext.adminAccess = false;

      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'success' }));
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.headers.get('X-Request-ID')).toBe('test-middleware-123');
      expect(response.headers.get('X-Auth-User-ID')).toBe('test-user-456');
      expect(response.headers.get('X-Auth-Token-Type')).toBe('legacy');
      expect(response.headers.get('X-Auth-Status')).toBe('authenticated');
      expect(response.headers.get('X-Degradation-Mode')).toBe('degraded');
      expect(response.headers.get('X-Admin-Access')).toBe('false');
      expect(response.headers.get('X-Timestamp')).toBeTruthy();
    });

    test('게스트 사용자 헤더', async () => {
      const guestContext = createGuestContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: guestContext
      });

      const handler = jest.fn().mockResolvedValue(NextResponse.json({ message: 'guest' }));
      const middleware = withOptionalAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.headers.get('X-Auth-User-ID')).toBe('guest');
      expect(response.headers.get('X-Auth-Token-Type')).toBe('guest');
      expect(response.headers.get('X-Auth-Status')).toBe('guest');
      expect(response.headers.get('X-Admin-Access')).toBe('false');
    });

    test('에러 응답 헤더', async () => {
      mockAuthenticateRequest.mockResolvedValue(
        createAuthError('RATE_LIMITED', '요청 제한', HTTP_STATUS.TOO_MANY_REQUESTS)
      );

      const handler = jest.fn();
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.headers.get('X-Request-ID')).toBe('test-middleware-123');
      expect(response.headers.get('X-Auth-Error')).toBe('RATE_LIMITED');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('헬퍼 함수', () => {
    describe('authErrors', () => {
      test('unauthorized 헬퍼', () => {
        const response = authErrors.unauthorized('커스텀 메시지', '커스텀 권장사항');

        expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(response.headers.get('X-Auth-Error')).toBe('UNAUTHORIZED');
      });

      test('forbidden 헬퍼', () => {
        const response = authErrors.forbidden();

        expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(response.headers.get('X-Auth-Error')).toBe('FORBIDDEN');
      });

      test('badRequest 헬퍼', () => {
        const response = authErrors.badRequest('잘못된 요청');

        expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(response.headers.get('X-Auth-Error')).toBe('BAD_REQUEST');
      });

      test('tooManyRequests 헬퍼', () => {
        const response = authErrors.tooManyRequests('요청 제한', 25.50);

        expect(response.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
        expect(response.headers.get('Retry-After')).toBe('60');
        expect(response.headers.get('X-Cost-Current')).toBe('25.5');
      });
    });

    describe('authSuccess', () => {
      test('ok 헬퍼', () => {
        const data = { message: 'success' };
        const response = authSuccess.ok(data, '성공 메시지');

        expect(response.status).toBe(HTTP_STATUS.OK);
      });

      test('created 헬퍼', () => {
        const data = { id: 'new-resource' };
        const response = authSuccess.created(data);

        expect(response.status).toBe(201);
      });
    });
  });

  describe('Rate Limiting 헤더', () => {
    test('Rate limiting 에러 시 Retry-After 헤더', async () => {
      const rateLimitError = createAuthError('RATE_LIMITED', '요청 제한', HTTP_STATUS.TOO_MANY_REQUESTS);
      rateLimitError.error.retryAfter = 120;
      rateLimitError.error.cost = 15.75;

      mockAuthenticateRequest.mockResolvedValue(rateLimitError);

      const handler = jest.fn();
      const middleware = withAuth(handler);

      const response = await middleware(mockRequest);

      expect(response.headers.get('Retry-After')).toBe('120');
      expect(response.headers.get('X-Cost-Current')).toBe('15.75');
    });
  });

  describe('타입 안전성', () => {
    test('핸들러는 올바른 타입 파라미터를 받음', async () => {
      const authContext = createAuthenticatedContext();
      mockAuthenticateRequest.mockResolvedValue({
        success: true,
        context: authContext
      });

      const handler = jest.fn((req: NextRequest, context: { user: User; authContext: AuthContext }) => {
        // TypeScript 타입 체크
        expect(typeof context.user.tokenType).toBe('string');
        expect(typeof context.authContext.status).toBe('string');
        expect(typeof context.authContext.timestamp).toBe('number');

        if (isAuthenticatedUser(context.user)) {
          expect(typeof context.user.id).toBe('string');
          expect(context.user.id).not.toBeNull();
        }

        if (isGuestUser(context.user)) {
          expect(context.user.id).toBeNull();
        }

        return NextResponse.json({ success: true });
      });

      const middleware = withAuth(handler);
      await middleware(mockRequest);

      expect(handler).toHaveBeenCalled();
    });
  });
});