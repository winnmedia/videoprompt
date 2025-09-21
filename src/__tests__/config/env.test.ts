/**
 * 환경변수 시스템 테스트
 * TDD 원칙: RED → GREEN → REFACTOR
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';

// 테스트 전용 환경변수 모킹
const mockEnv = (envVars: Record<string, string>) => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...envVars };
  return () => { process.env = originalEnv; };
};

describe('환경변수 시스템 테스트', () => {
  let restoreEnv: () => void;

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv();
    }
  });

  describe('환경변수 검증', () => {
    test('필수 환경변수가 모두 설정된 경우 통과해야 함', async () => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'test-jwt-secret-with-32-characters',
        NODE_ENV: 'test'
      });

      // 동적 import로 환경변수 모듈 테스트
      const { getEnv } = await import('@/shared/config/env');
      
      expect(() => getEnv()).not.toThrow();
      const env = getEnv();
      expect(env.NODE_ENV).toBe('test');
      expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/test');
    });

    test('DATABASE_URL이 잘못된 형식인 경우 실패해야 함', async () => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'invalid-database-url',
        JWT_SECRET: 'test-jwt-secret-with-32-characters',
        NODE_ENV: 'test'
      });

      const { getEnv } = await import('@/shared/config/env');
      
      expect(() => getEnv()).toThrow();
    });

    test('JWT_SECRET이 너무 짧은 경우 실패해야 함', async () => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'short', // 32자 미만
        NODE_ENV: 'test'
      });

      const { getEnv } = await import('@/shared/config/env');
      
      expect(() => getEnv()).toThrow();
    });
  });

  describe('헬퍼 함수들', () => {
    beforeEach(() => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'test-jwt-secret-with-32-characters',
        NODE_ENV: 'test',
        GOOGLE_GEMINI_API_KEY: 'test-gemini-key',
        SEEDANCE_API_KEY: 'test-seedance-key',
        E2E_FAST_PREVIEW: '1',
      });
    });

    test('envUtils.required가 설정된 값을 반환해야 함', async () => {
      const { envUtils } = await import('@/shared/config/env');
      
      expect(envUtils.required('DATABASE_URL')).toBe('postgresql://localhost:5432/test');
    });

    test('envUtils.required가 미설정 시 에러를 던져야 함', async () => {
      const { envUtils } = await import('@/shared/config/env');
      
      expect(() => envUtils.required('SENDGRID_API_KEY' as any)).toThrow();
    });

    test('envUtils.optional이 설정된 값을 반환해야 함', async () => {
      const { envUtils } = await import('@/shared/config/env');
      
      expect(envUtils.optional('GOOGLE_GEMINI_API_KEY')).toBe('test-gemini-key');
    });

    test('envUtils.optional이 미설정 시 기본값을 반환해야 함', async () => {
      const { envUtils } = await import('@/shared/config/env');
      
      expect(envUtils.optional('SENDGRID_API_KEY' as any, 'default-value')).toBe('default-value');
    });

    test('envUtils.boolean이 true 값들을 올바르게 파싱해야 함', async () => {
      const { envUtils } = await import('@/shared/config/env');
      
      expect(envUtils.boolean('E2E_FAST_PREVIEW')).toBe(true);
    });

    test('환경 감지 함수들이 올바르게 작동해야 함', async () => {
      const { isProd, isDev, isTest } = await import('@/shared/config/env');
      
      expect(isTest).toBe(true);
      expect(isDev).toBe(false);
      expect(isProd).toBe(false);
    });

    test('getAIApiKeys가 올바른 키들을 반환해야 함', async () => {
      const { getAIApiKeys } = await import('@/shared/config/env');
      
      const keys = getAIApiKeys();
      expect(keys.gemini).toBe('test-gemini-key');
      expect(keys.seedance).toBe('test-seedance-key');
    });

    test('getServiceUrls이 올바른 URL들을 반환해야 함', async () => {
      const { getServiceUrls } = await import('@/shared/config/env');
      
      const urls = getServiceUrls();
      expect(urls.appUrl).toBe('http://localhost:3000'); // 기본값
    });
  });

  describe('기본값 처리', () => {
    test('NODE_ENV 기본값이 development여야 함', async () => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'test-jwt-secret-with-32-characters',
        // NODE_ENV 설정하지 않음
      });

      const { getEnv } = await import('@/shared/config/env');
      
      const env = getEnv();
      expect(env.NODE_ENV).toBe('development');
    });


    test('GOOGLE_IMAGE_MODEL 기본값이 설정되어야 함', async () => {
      restoreEnv = mockEnv({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        JWT_SECRET: 'test-jwt-secret-with-32-characters',
        NODE_ENV: 'test',
      });

      const { getEnv } = await import('@/shared/config/env');
      
      const env = getEnv();
      expect(env.GOOGLE_IMAGE_MODEL).toBe('imagen-4.0-generate-preview-06-06');
    });
  });
});