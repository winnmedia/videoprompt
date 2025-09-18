/**
 * 🔧 environment-validator.ts 테스트
 * 환경변수 검증 및 Degradation Mode 결정 테스트
 *
 * 테스트 범위:
 * - 환경변수 스키마 검증
 * - Degradation Mode 결정 로직
 * - Capabilities 계산
 * - 프로덕션 vs 개발환경 규칙
 * - 보안 마스킹
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  validateEnvironment,
  initializeEnvironment,
  getEnvironment,
  refreshEnvironment,
  isCapabilityAvailable,
  assertEnvironmentSafety,
  getEnvironmentConfig
} from '@/shared/lib/environment-validator';

describe('Environment Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    // 캐시 초기화를 위해 refreshEnvironment 호출
    refreshEnvironment();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('환경변수 스키마 검증', () => {
    test('모든 환경변수가 올바르게 설정된 경우', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough',
        DATABASE_URL: 'postgresql://localhost:5432/test'
      };

      const result = validateEnvironment();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.degradationMode).toBe('full');
      expect(result.capabilities.supabaseAuth).toBe(true);
      expect(result.capabilities.legacyAuth).toBe(true);
      expect(result.capabilities.database).toBe(true);
      expect(result.capabilities.fullAdmin).toBe(true);
    });

    test('잘못된 URL 형식', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'invalid-url',
        DATABASE_URL: 'not-a-url'
      };

      const result = validateEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('SUPABASE_URL'))).toBe(true);
      expect(result.errors.some(err => err.includes('DATABASE_URL'))).toBe(true);
    });

    test('JWT_SECRET이 너무 짧은 경우', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        JWT_SECRET: 'too-short'
      };

      const result = validateEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('JWT_SECRET') && err.includes('32 characters'))).toBe(true);
    });

    test('유효하지 않은 NODE_ENV', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'invalid-env'
      };

      const result = validateEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('NODE_ENV'))).toBe(true);
    });
  });

  describe('Degradation Mode 결정 로직', () => {
    test('프로덕션 환경에서 모든 필수 환경변수 존재 → full', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'valid-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-service-key',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough'
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('full');
      expect(result.capabilities.fullAdmin).toBe(true);
    });

    test('프로덕션 환경에서 SERVICE_ROLE_KEY 누락 → degraded', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'valid-anon-key',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough'
        // SUPABASE_SERVICE_ROLE_KEY 누락
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('degraded');
      expect(result.capabilities.fullAdmin).toBe(false);
      expect(result.warnings.some(w => w.includes('admin features will be limited'))).toBe(true);
    });

    test('프로덕션 환경에서 필수 환경변수 누락 → disabled', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production'
        // 필수 환경변수들 모두 누락
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('disabled');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('SUPABASE_URL is required'))).toBe(true);
      expect(result.errors.some(e => e.includes('SUPABASE_ANON_KEY is required'))).toBe(true);
      expect(result.errors.some(e => e.includes('JWT_SECRET is required'))).toBe(true);
    });

    test('개발 환경에서 Supabase만 있음 → degraded', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'valid-anon-key'
        // JWT_SECRET 및 SERVICE_ROLE_KEY 누락
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('degraded');
      expect(result.capabilities.supabaseAuth).toBe(true);
      expect(result.capabilities.legacyAuth).toBe(false);
      expect(result.capabilities.fullAdmin).toBe(false);
    });

    test('개발 환경에서 JWT만 있음 → degraded', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough'
        // Supabase 환경변수들 누락
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('degraded');
      expect(result.capabilities.supabaseAuth).toBe(false);
      expect(result.capabilities.legacyAuth).toBe(true);
      expect(result.warnings.some(w => w.includes('Supabase configuration missing'))).toBe(true);
    });

    test('개발 환경에서 모든 인증 환경변수 누락 → disabled', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development'
        // 모든 인증 관련 환경변수 누락
      };

      const result = validateEnvironment();

      expect(result.degradationMode).toBe('disabled');
      expect(result.capabilities.supabaseAuth).toBe(false);
      expect(result.capabilities.legacyAuth).toBe(false);
    });
  });

  describe('Capabilities 계산', () => {
    test('Supabase capabilities', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'valid-key'
      };

      const result = validateEnvironment();

      expect(result.capabilities.supabaseAuth).toBe(true);
      expect(result.capabilities.legacyAuth).toBe(false);
      expect(result.capabilities.fullAdmin).toBe(false);
    });

    test('Legacy JWT capabilities', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough'
      };

      const result = validateEnvironment();

      expect(result.capabilities.supabaseAuth).toBe(false);
      expect(result.capabilities.legacyAuth).toBe(true);
      expect(result.capabilities.fullAdmin).toBe(false);
    });

    test('Database capabilities', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/test'
      };

      const result = validateEnvironment();

      expect(result.capabilities.database).toBe(true);
    });

    test('Full admin capabilities', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'valid-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-service-key'
      };

      const result = validateEnvironment();

      expect(result.capabilities.fullAdmin).toBe(true);
    });
  });

  describe('테스트 환경 특별 처리', () => {
    test('테스트 환경에서는 경고만 발생', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test'
        // 환경변수 누락
      };

      const result = validateEnvironment();

      // 테스트 환경에서는 에러보다는 경고 위주로 처리
      expect(result.degradationMode).toBe('disabled');
    });
  });

  describe('환경 정보 캐싱 및 접근', () => {
    test('getEnvironment()는 캐시된 결과 반환', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };

      const first = getEnvironment();
      const second = getEnvironment();

      expect(first).toBe(second); // 동일한 객체 참조
    });

    test('refreshEnvironment()는 캐시 무효화', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co'
      };

      const first = getEnvironment();

      // 환경변수 변경
      process.env.SUPABASE_ANON_KEY = 'new-key';

      const refreshed = refreshEnvironment();

      expect(first).not.toBe(refreshed); // 다른 객체
      expect(refreshed.capabilities.supabaseAuth).toBe(true);
    });

    test('isCapabilityAvailable() 편의 함수', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };

      refreshEnvironment();

      expect(isCapabilityAvailable('supabaseAuth')).toBe(true);
      expect(isCapabilityAvailable('legacyAuth')).toBe(false);
      expect(isCapabilityAvailable('fullAdmin')).toBe(false);
    });
  });

  describe('환경 안전성 검사', () => {
    test('assertEnvironmentSafety() - 유효한 환경', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };

      refreshEnvironment();

      expect(() => {
        assertEnvironmentSafety(['supabaseAuth']);
      }).not.toThrow();
    });

    test('assertEnvironmentSafety() - 유효하지 않은 환경', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development'
        // 필수 환경변수 누락
      };

      refreshEnvironment();

      expect(() => {
        assertEnvironmentSafety();
      }).toThrow('Environment validation failed');
    });

    test('assertEnvironmentSafety() - 필수 capability 누락', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough'
        // Supabase 환경변수 누락
      };

      refreshEnvironment();

      expect(() => {
        assertEnvironmentSafety(['supabaseAuth']);
      }).toThrow("Required capability 'supabaseAuth' is not available");
    });
  });

  describe('환경 설정 헬퍼', () => {
    test('getEnvironmentConfig() 헬퍼 함수', () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key',
        JWT_SECRET: 'test-jwt-secret-32-characters-long-enough',
        DATABASE_URL: 'postgresql://localhost:5432/test'
      };

      refreshEnvironment();

      const config = getEnvironmentConfig();

      expect(config.isProduction).toBe(true);
      expect(config.isDevelopment).toBe(false);
      expect(config.isTest).toBe(false);
      expect(config.hasValidSupabase).toBe(true);
      expect(config.hasValidJWT).toBe(true);
      expect(config.hasDatabase).toBe(true);
      expect(config.degradationMode).toBe('degraded'); // SERVICE_ROLE_KEY 없음
    });
  });

  describe('에러 처리', () => {
    test('환경 검증 중 예외 발생', () => {
      // process.env를 null로 설정하여 예외 발생 시뮬레이션
      const originalProcessEnv = process.env;

      try {
        // @ts-ignore - 테스트를 위한 의도적인 타입 에러
        process.env = null;

        const result = validateEnvironment();

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.degradationMode).toBe('disabled');
        expect(result.capabilities.supabaseAuth).toBe(false);
        expect(result.capabilities.legacyAuth).toBe(false);
      } finally {
        process.env = originalProcessEnv;
      }
    });
  });

  describe('보안 및 로깅', () => {
    test('초기화 시 콘솔 로그 출력 (스파이)', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'test-key'
      };

      initializeEnvironment();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment Validation Result')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Authentication Capabilities')
      );

      consoleSpy.mockRestore();
    });

    test('민감 정보 마스킹 확인', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.very-long-key-content',
        JWT_SECRET: 'super-secret-jwt-key-32-characters-long'
      };

      initializeEnvironment();

      // 로그에서 민감 정보가 마스킹되었는지 확인
      const logCalls = consoleSpy.mock.calls.flat();
      const logContent = logCalls.join(' ');

      // 전체 키가 노출되지 않았는지 확인
      expect(logContent).not.toContain('super-secret-jwt-key-32-characters-long');
      expect(logContent).not.toContain('very-long-key-content');

      // 마스킹된 형태가 포함되었는지 확인
      expect(logContent).toMatch(/\*+/); // 별표가 포함된 마스킹

      consoleSpy.mockRestore();
    });
  });
});