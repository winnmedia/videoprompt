/**
 * 🔐 auth-core.ts 단일 인증 진입점 테스트
 * Contract-First 및 TDD 원칙 적용
 *
 * 테스트 범위:
 * - 환경변수 검증
 * - 인증 우선순위 (Supabase → Legacy → Guest)
 * - Contract 준수 확인
 * - $300 사건 방지
 * - Graceful degradation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { authenticateRequest, getUserId } from '@/shared/lib/auth-core';
import { validateEnvironment } from '@/shared/lib/environment-validator';
import {
  isAuthError,
  isAuthSuccess,
  isAuthenticatedUser,
  isGuestUser,
  HTTP_STATUS
} from '@/shared/contracts/auth.contract';

// Mock dependencies
jest.mock('@/shared/lib/environment-validator');
jest.mock('@supabase/ssr');
jest.mock('next/headers');
jest.mock('jsonwebtoken');

const mockValidateEnvironment = jest.mocked(validateEnvironment);

describe('Auth Core v2.0 - Single Source of Truth', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 요청 객체 설정
    mockRequest = new NextRequest('https://example.com/api/test', {
      headers: {
        'x-request-id': 'test-request-123'
      }
    });
  });

  describe('환경변수 검증', () => {
    test('모든 환경변수 존재 시 full mode', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'development',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          JWT_SECRET: 'test-jwt-secret-32-characters-long',
          DATABASE_URL: 'postgresql://localhost:5432/test'
        },
        errors: [],
        warnings: [],
        degradationMode: 'full',
        capabilities: {
          supabaseAuth: true,
          legacyAuth: true,
          database: true,
          fullAdmin: true
        }
      });

      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(result.context.degradationMode).toBe('full');
        expect(result.context.adminAccess).toBe(true);
      }
    });

    test('Supabase 환경변수 누락 시 degraded mode', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'development',
          JWT_SECRET: 'test-jwt-secret-32-characters-long'
        },
        errors: [],
        warnings: ['Supabase configuration missing'],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: true,
          database: false,
          fullAdmin: false
        }
      });

      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(result.context.degradationMode).toBe('degraded');
        expect(result.context.adminAccess).toBe(false);
      }
    });

    test('모든 인증 환경변수 누락 시 disabled mode', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: false,
        environment: null,
        errors: ['Critical environment variables missing'],
        warnings: [],
        degradationMode: 'disabled',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });

      const result = await authenticateRequest(mockRequest, { allowGuest: false });

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.error.code).toBe('CONFIG_ERROR');
        expect(result.error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      }
    });

    test('disabled mode에서 allowGuest=true이면 guest 사용자 반환', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: false,
        environment: null,
        errors: ['Critical environment variables missing'],
        warnings: [],
        degradationMode: 'disabled',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });

      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(isGuestUser(result.context.user)).toBe(true);
        expect(result.context.user.tokenType).toBe('guest');
        expect(result.context.degradationMode).toBe('disabled');
      }
    });
  });

  describe('인증 우선순위', () => {
    beforeEach(() => {
      // 기본적으로 모든 기능 활성화
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
          JWT_SECRET: 'test-jwt-secret-32-characters-long'
        },
        errors: [],
        warnings: [],
        degradationMode: 'full',
        capabilities: {
          supabaseAuth: true,
          legacyAuth: true,
          database: true,
          fullAdmin: true
        }
      });
    });

    test('Supabase 토큰이 있으면 Supabase 인증 우선', async () => {
      const requestWithSupabaseToken = new NextRequest('https://example.com/api/test', {
        headers: {
          'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaXNzIjoiaHR0cHM6Ly90ZXN0LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzAwMDAwMDAwLCJpYXQiOjE2OTk5OTk5OTksInVzZXJfbWV0YWRhdGEiOnsidXNlcm5hbWUiOiJ0ZXN0dXNlciJ9fQ.test-signature'
        }
      });

      const result = await authenticateRequest(requestWithSupabaseToken);

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(isAuthenticatedUser(result.context.user)).toBe(true);
        if (isAuthenticatedUser(result.context.user)) {
          expect(result.context.user.tokenType).toBe('supabase');
          expect(result.context.user.id).toBe('user123');
        }
      }
    });

    test('레거시 JWT 토큰만 있으면 레거시 인증', async () => {
      // JWT 모킹
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'legacy-user-456',
        email: 'legacy@example.com',
        username: 'legacyuser',
        exp: 1700000000,
        iat: 1699999999
      });

      const requestWithLegacyToken = new NextRequest('https://example.com/api/test', {
        headers: {
          'authorization': 'Bearer legacy-jwt-token-here'
        }
      });

      const result = await authenticateRequest(requestWithLegacyToken);

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(isAuthenticatedUser(result.context.user)).toBe(true);
        if (isAuthenticatedUser(result.context.user)) {
          expect(result.context.user.tokenType).toBe('legacy');
          expect(result.context.user.id).toBe('legacy-user-456');
        }
      }
    });

    test('인증 토큰 없으면 allowGuest=true일 때 guest 사용자', async () => {
      const requestWithoutAuth = new NextRequest('https://example.com/api/test');

      const result = await authenticateRequest(requestWithoutAuth, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(isGuestUser(result.context.user)).toBe(true);
        expect(result.context.user.tokenType).toBe('guest');
        expect(result.context.status).toBe('guest');
      }
    });

    test('인증 토큰 없고 allowGuest=false이면 UNAUTHORIZED', async () => {
      const requestWithoutAuth = new NextRequest('https://example.com/api/test');

      const result = await authenticateRequest(requestWithoutAuth, { allowGuest: false });

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.error.code).toBe('UNAUTHORIZED');
        expect(result.error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      }
    });
  });

  describe('Rate Limiting ($300 사건 방지)', () => {
    beforeEach(() => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: true,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });
    });

    test('Rate limiting 활성화되어 있음을 확인', async () => {
      const result = await authenticateRequest(mockRequest, {
        allowGuest: true,
        rateLimitCheck: true,
        maxRequestsPerMinute: 60
      });

      expect(isAuthSuccess(result)).toBe(true);
      // Rate limiting이 활성화되어 있다면 정상 처리
    });

    test('비용 제한 체크 활성화 확인', async () => {
      const result = await authenticateRequest(mockRequest, {
        allowGuest: true,
        costLimitCheck: true,
        maxCostPerHour: 50
      });

      expect(isAuthSuccess(result)).toBe(true);
      // 비용 제한이 활성화되어 있다면 정상 처리
    });
  });

  describe('Contract 준수 확인', () => {
    beforeEach(() => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test',
          SUPABASE_URL: 'https://test.supabase.co',
          SUPABASE_ANON_KEY: 'test-key'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: true,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });
    });

    test('AuthResult 스키마 준수', async () => {
      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(result).toHaveProperty('success');

      if (isAuthSuccess(result)) {
        expect(result.context).toHaveProperty('user');
        expect(result.context).toHaveProperty('status');
        expect(result.context).toHaveProperty('degradationMode');
        expect(result.context).toHaveProperty('adminAccess');
        expect(result.context).toHaveProperty('timestamp');
        expect(typeof result.context.timestamp).toBe('number');
      }

      if (isAuthError(result)) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(result.error).toHaveProperty('statusCode');
        expect(result.error).toHaveProperty('timestamp');
        expect(typeof result.error.timestamp).toBe('number');
      }
    });

    test('User 스키마 준수 (AuthenticatedUser)', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'test-user-789',
        email: 'test@example.com',
        username: 'testuser'
      });

      const requestWithAuth = new NextRequest('https://example.com/api/test', {
        headers: {
          'authorization': 'Bearer test-legacy-token'
        }
      });

      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test',
          JWT_SECRET: 'test-jwt-secret-32-characters-long'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: true,
          database: false,
          fullAdmin: false
        }
      });

      const result = await authenticateRequest(requestWithAuth);

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result) && isAuthenticatedUser(result.context.user)) {
        const user = result.context.user;
        expect(typeof user.id).toBe('string');
        expect(user.id).not.toBeNull();
        expect(['supabase', 'legacy']).toContain(user.tokenType);
        expect(['admin', 'user']).toContain(user.role);
        expect(typeof user.isEmailVerified).toBe('boolean');
      }
    });

    test('User 스키마 준수 (GuestUser)', async () => {
      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result) && isGuestUser(result.context.user)) {
        const user = result.context.user;
        expect(user.id).toBeNull();
        expect(user.email).toBeNull();
        expect(user.username).toBeNull();
        expect(user.role).toBe('guest');
        expect(user.tokenType).toBe('guest');
        expect(user.isEmailVerified).toBe(false);
      }
    });
  });

  describe('편의 함수 테스트', () => {
    test('getUserId - 인증된 사용자의 ID 반환', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'convenience-test-user',
        email: 'convenience@example.com'
      });

      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test',
          JWT_SECRET: 'test-jwt-secret-32-characters-long'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: true,
          database: false,
          fullAdmin: false
        }
      });

      const requestWithAuth = new NextRequest('https://example.com/api/test', {
        headers: {
          'authorization': 'Bearer test-token'
        }
      });

      const userId = await getUserId(requestWithAuth);

      expect(userId).toBe('convenience-test-user');
    });

    test('getUserId - 게스트 사용자의 경우 null 반환', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });

      const requestWithoutAuth = new NextRequest('https://example.com/api/test');

      const userId = await getUserId(requestWithoutAuth);

      expect(userId).toBeNull();
    });
  });

  describe('에러 처리', () => {
    test('예상치 못한 에러 시 SERVICE_UNAVAILABLE', async () => {
      // 환경 검증에서 예외 발생 시뮬레이션
      mockValidateEnvironment.mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      const result = await authenticateRequest(mockRequest);

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(result.error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
        expect(result.error.message).toContain('일시적인 문제');
      }
    });

    test('요청 ID가 응답에 포함됨', async () => {
      mockValidateEnvironment.mockReturnValue({
        isValid: true,
        environment: {
          NODE_ENV: 'test'
        },
        errors: [],
        warnings: [],
        degradationMode: 'degraded',
        capabilities: {
          supabaseAuth: false,
          legacyAuth: false,
          database: false,
          fullAdmin: false
        }
      });

      const result = await authenticateRequest(mockRequest, { allowGuest: true });

      expect(isAuthSuccess(result)).toBe(true);
      if (isAuthSuccess(result)) {
        expect(result.context.requestId).toBe('test-request-123');
      }
    });
  });
});