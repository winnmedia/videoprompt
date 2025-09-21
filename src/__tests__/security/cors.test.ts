/**
 * CORS 보안 정책 테스트
 * TDD 원칙: RED → GREEN → REFACTOR
 */

import { describe, test, expect } from 'vitest';
import { isOriginAllowed, createCorsHeaders } from '@/shared/lib/cors';

describe('CORS 보안 정책 테스트', () => {
  describe('isOriginAllowed', () => {
    test('허용된 프로덕션 도메인들이 통과해야 함', () => {
      const allowedOrigins = [
        'https://videoprompt.vridge.kr',
        'https://www.vridge.kr',
        'https://vridge.kr',
      ];

      allowedOrigins.forEach(origin => {
        expect(isOriginAllowed(origin)).toBe(true);
      });
    });

    test('허용되지 않은 도메인들이 차단되어야 함', () => {
      const blockedOrigins = [
        'https://malicious-site.com',
        'https://fake-vridge.com',
        'http://vridge.kr', // HTTP는 차단
        null,
        '',
      ];

      blockedOrigins.forEach(origin => {
        expect(isOriginAllowed(origin)).toBe(false);
      });
    });

    test('개발 환경에서 localhost가 허용되어야 함', () => {
      // 개발 환경 모킹
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devOrigins = [
        'http://localhost:3000',
        'https://localhost:3000',
        'http://127.0.0.1:3000',
        'https://test-abc123.vercel.app',
      ];

      devOrigins.forEach(origin => {
        expect(isOriginAllowed(origin)).toBe(true);
      });

      // 환경 복원
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createCorsHeaders', () => {
    test('허용된 Origin에 대해 적절한 CORS 헤더를 생성해야 함', () => {
      const allowedOrigin = 'https://videoprompt.vridge.kr';
      const headers = createCorsHeaders(allowedOrigin);

      expect(headers['Access-Control-Allow-Origin']).toBe(allowedOrigin);
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    test('허용되지 않은 Origin에 대해 제한적인 헤더를 생성해야 함', () => {
      const blockedOrigin = 'https://malicious-site.com';
      const headers = createCorsHeaders(blockedOrigin);

      expect(headers['Access-Control-Allow-Origin']).toBe('null');
      expect(headers['Access-Control-Max-Age']).toBe('0');
    });

    test('Origin이 없는 경우 제한적인 헤더를 생성해야 함', () => {
      const headers = createCorsHeaders(null);

      expect(headers['Access-Control-Allow-Origin']).toBe('null');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    });
  });
});