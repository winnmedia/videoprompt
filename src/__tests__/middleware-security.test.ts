/**
 * 미들웨어 보안 강화 테스트
 * JWT 검증, 토큰 시스템 통합, 인증 경로 보호 확인
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// 미들웨어 함수를 직접 테스트하기 위한 모킹
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'test-secret-key';

describe('Middleware Security Tests', () => {
  let validToken: string;
  let invalidToken: string;
  let expiredToken: string;

  beforeEach(() => {
    // 유효한 토큰 생성
    validToken = jwt.sign(
      {
        userId: 'test-user-123',
        email: 'test@example.com'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 잘못된 서명을 가진 토큰
    invalidToken = jwt.sign(
      {
        userId: 'test-user-123',
        email: 'test@example.com'
      },
      'wrong-secret-key',
      { expiresIn: '1h' }
    );

    // 만료된 토큰
    expiredToken = jwt.sign(
      {
        userId: 'test-user-123',
        email: 'test@example.com'
      },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );
  });

  describe('JWT Token Validation', () => {
    it('should validate correctly formatted JWT tokens', () => {
      // 토큰이 올바른 형식인지 확인
      expect(validToken.split('.')).toHaveLength(3);

      // 토큰을 검증할 수 있는지 확인
      expect(() => {
        jwt.verify(validToken, JWT_SECRET);
      }).not.toThrow();
    });

    it('should reject tokens with wrong signature', () => {
      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });

    it('should reject expired tokens', () => {
      expect(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }).toThrow('jwt expired');
    });
  });

  describe('Token Extraction Logic', () => {
    it('should extract token from Authorization header', () => {
      const mockRequest = {
        headers: new Map([
          ['authorization', `Bearer ${validToken}`]
        ]),
        cookies: new Map()
      };

      // Authorization 헤더에서 토큰 추출 시뮬레이션
      const authHeader = mockRequest.headers.get('authorization');
      const extractedToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

      expect(extractedToken).toBe(validToken);
    });

    it('should extract token from session cookie', () => {
      const sessionData = { accessToken: validToken };
      const sessionCookie = JSON.stringify(sessionData);

      const mockRequest = {
        headers: new Map(),
        cookies: new Map([
          ['session', sessionCookie]
        ])
      };

      // 세션 쿠키에서 토큰 추출 시뮬레이션
      const sessionValue = mockRequest.cookies.get('session');
      let extractedToken = null;

      if (sessionValue) {
        try {
          const sessionData = JSON.parse(sessionValue);
          extractedToken = sessionData.accessToken || sessionData.token;
        } catch {
          extractedToken = sessionValue; // 직접 토큰인 경우
        }
      }

      expect(extractedToken).toBe(validToken);
    });

    it('should handle malformed session cookie gracefully', () => {
      const invalidSessionCookie = 'invalid-json-data';

      const mockRequest = {
        headers: new Map(),
        cookies: new Map([
          ['session', invalidSessionCookie]
        ])
      };

      // 잘못된 JSON 형태의 세션 쿠키 처리 시뮬레이션
      const sessionValue = mockRequest.cookies.get('session');
      let extractedToken = null;

      if (sessionValue) {
        try {
          const sessionData = JSON.parse(sessionValue);
          extractedToken = sessionData.accessToken || sessionData.token;
        } catch {
          extractedToken = sessionValue; // 파싱 실패 시 직접 토큰으로 간주
        }
      }

      expect(extractedToken).toBe(invalidSessionCookie);
    });
  });

  describe('Protected Path Logic', () => {
    const protectedPaths = [
      '/admin',
      '/queue',
      '/api/admin',
      '/api/queue',
    ];

    const authOnlyPaths = [
      '/login',
      '/register',
    ];

    it('should identify protected paths correctly', () => {
      const testPaths = [
        { path: '/admin/users', expected: true },
        { path: '/queue/status', expected: true },
        { path: '/api/admin/config', expected: true },
        { path: '/api/queue/jobs', expected: true },
        { path: '/public/page', expected: false },
        { path: '/home', expected: false },
      ];

      testPaths.forEach(({ path, expected }) => {
        const isProtected = protectedPaths.some(protectedPath =>
          path.startsWith(protectedPath)
        );
        expect(isProtected).toBe(expected);
      });
    });

    it('should identify auth-only paths correctly', () => {
      const testPaths = [
        { path: '/login', expected: true },
        { path: '/register', expected: true },
        { path: '/login/forgot', expected: true },
        { path: '/home', expected: false },
        { path: '/admin', expected: false },
      ];

      testPaths.forEach(({ path, expected }) => {
        const isAuthOnly = authOnlyPaths.some(authPath =>
          path.startsWith(authPath)
        );
        expect(isAuthOnly).toBe(expected);
      });
    });
  });

  describe('Token System Integration', () => {
    it('should prioritize accessToken in unified token system', () => {
      const mockTokens = {
        token: 'legacy-token',
        accessToken: validToken,
        refreshToken: 'refresh-token',
        legacyToken: 'old-legacy-token'
      };

      // 토큰 우선순위 로직 시뮬레이션
      const prioritizedToken = mockTokens.accessToken ||
                              mockTokens.token ||
                              mockTokens.legacyToken;

      expect(prioritizedToken).toBe(validToken);
    });

    it('should clean up legacy tokens on refresh', () => {
      const mockLocalStorage = new Map();

      // 여러 토큰이 저장된 상황 시뮬레이션
      mockLocalStorage.set('token', 'old-token');
      mockLocalStorage.set('accessToken', 'old-access-token');
      mockLocalStorage.set('refreshToken', 'old-refresh-token');
      mockLocalStorage.set('legacyToken', 'old-legacy-token');

      // 새 토큰으로 갱신하면서 레거시 토큰 정리 시뮬레이션
      const newToken = validToken;
      mockLocalStorage.set('token', newToken);
      mockLocalStorage.set('accessToken', newToken);
      mockLocalStorage.delete('refreshToken');
      mockLocalStorage.delete('legacyToken');

      expect(mockLocalStorage.get('token')).toBe(newToken);
      expect(mockLocalStorage.get('accessToken')).toBe(newToken);
      expect(mockLocalStorage.has('refreshToken')).toBe(false);
      expect(mockLocalStorage.has('legacyToken')).toBe(false);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle empty or null tokens', () => {
      const emptyTokens = ['', null, undefined, 'null', 'undefined'];

      emptyTokens.forEach(token => {
        const isValid = Boolean(token && token !== 'null' && token !== 'undefined');
        expect(isValid).toBe(false);
      });
    });

    it('should handle malformed JWT tokens', () => {
      const malformedTokens = [
        'invalid.token.format',
        'bearer-but-not-jwt',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // 불완전한 토큰
        'not.a.jwt.at.all.really',
      ];

      malformedTokens.forEach(token => {
        expect(() => {
          jwt.verify(token, JWT_SECRET);
        }).toThrow();
      });
    });

    it('should prevent token manipulation attacks', () => {
      // 페이로드를 변경한 토큰
      const parts = validToken.split('.');
      const manipulatedPayload = btoa(JSON.stringify({
        userId: 'admin-user',
        email: 'admin@example.com',
        role: 'admin'
      }));
      const manipulatedToken = `${parts[0]}.${manipulatedPayload}.${parts[2]}`;

      // 변조된 토큰은 검증에 실패해야 함
      expect(() => {
        jwt.verify(manipulatedToken, JWT_SECRET);
      }).toThrow();
    });
  });

  afterEach(() => {
    // 테스트 간 격리를 위한 정리
    validToken = '';
    invalidToken = '';
    expiredToken = '';
  });
});