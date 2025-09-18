/**
 * @vitest-environment node
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 쿠키 설정 유틸리티만 직접 테스트
import {
  getOptimizedCookieOptions,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions
} from '@/shared/lib/cookie-security';
import { NextRequest } from 'next/server';

describe('Cookie Security Settings Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Production Environment Cookie Settings', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('프로덕션에서 동일 도메인 요청 시 sameSite lax 사용해야 함', () => {
      // Arrange
      const request = new NextRequest('https://www.vridge.kr/api/auth/refresh', {
        method: 'POST',
        headers: {
          'origin': 'https://www.vridge.kr',
          'referer': 'https://www.vridge.kr'
        }
      });

      // Act
      const accessOptions = getAccessTokenCookieOptions(request);
      const refreshOptions = getRefreshTokenCookieOptions(request);

      // Assert
      expect(accessOptions).toEqual(expect.objectContaining({
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60
      }));

      expect(refreshOptions).toEqual(expect.objectContaining({
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
        path: '/',
        maxAge: 7 * 24 * 60 * 60
      }));
    });

    it('프로덕션에서 크로스 도메인 요청 시 sameSite none 사용해야 함', () => {
      // Arrange
      const request = new NextRequest('https://api.vridge.kr/api/auth/refresh', {
        method: 'POST',
        headers: {
          'origin': 'https://app.different.kr',
          'referer': 'https://app.different.kr'
        }
      });

      // Act
      const options = getAccessTokenCookieOptions(request);

      // Assert
      expect(options).toEqual(expect.objectContaining({
        sameSite: 'none',
        secure: true,
        httpOnly: true
      }));
    });

    it('HTTPS 환경에서만 secure true 설정해야 함', () => {
      // Arrange
      const request = new NextRequest('https://www.vridge.kr/api/auth/refresh', {
        method: 'POST'
      });

      // Act
      const options = getAccessTokenCookieOptions(request);

      // Assert
      expect(options).toEqual(expect.objectContaining({
        secure: true
      }));
    });
  });

  describe('Development Environment Cookie Settings', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('개발환경에서 HTTP 허용하고 secure false 설정해야 함', () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST'
      });

      // Act
      const options = getAccessTokenCookieOptions(request);

      // Assert
      expect(options).toEqual(expect.objectContaining({
        sameSite: 'lax',
        secure: false,
        httpOnly: true
      }));
    });
  });

  describe('Cookie Security Validation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('모든 쿠키가 httpOnly true 설정되어야 함', () => {
      // Arrange
      const request = new NextRequest('https://www.vridge.kr/api/auth/refresh', {
        method: 'POST'
      });

      // Act
      const accessOptions = getAccessTokenCookieOptions(request);
      const refreshOptions = getRefreshTokenCookieOptions(request);

      // Assert
      expect(accessOptions.httpOnly).toBe(true);
      expect(refreshOptions.httpOnly).toBe(true);
    });

    it('적절한 maxAge 설정되어야 함', () => {
      // Arrange
      const request = new NextRequest('https://www.vridge.kr/api/auth/refresh', {
        method: 'POST'
      });

      // Act
      const accessOptions = getAccessTokenCookieOptions(request);
      const refreshOptions = getRefreshTokenCookieOptions(request);

      // Assert
      // Access token: 1시간
      expect(accessOptions.maxAge).toBe(60 * 60);
      // Refresh token: 7일
      expect(refreshOptions.maxAge).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('Domain-based Cookie Settings', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('동일 도메인 감지 정확성 테스트', () => {
      // Same domain test
      const sameOriginRequest = new NextRequest('https://www.vridge.kr/api/auth/refresh', {
        method: 'POST',
        headers: {
          'origin': 'https://app.vridge.kr'
        }
      });

      const sameDomainOptions = getOptimizedCookieOptions(sameOriginRequest, 3600);
      expect(sameDomainOptions.sameSite).toBe('lax');

      // Cross domain test
      const crossOriginRequest = new NextRequest('https://api.vridge.kr/api/auth/refresh', {
        method: 'POST',
        headers: {
          'origin': 'https://different.com'
        }
      });

      const crossDomainOptions = getOptimizedCookieOptions(crossOriginRequest, 3600);
      expect(crossDomainOptions.sameSite).toBe('none');
    });
  });
});