/**
 * 환경변수 스키마 검증 테스트
 * TDD: Red → Green → Refactor
 * FSD Architecture - Test Coverage for Shared Config
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  getEnv,
  getDegradationMode,
  getEnvironmentCapabilities,
  getSupabaseConfig,
  getAIApiKeys
} from '@/shared/config/env';

// 원본 환경변수 백업
const originalEnv = { ...process.env };

describe('환경변수 스키마 검증', () => {
  beforeEach(() => {
    // 각 테스트 전에 환경변수 초기화
    jest.resetModules();
  });

  afterEach(() => {
    // 각 테스트 후에 원본 환경변수 복원
    process.env = { ...originalEnv };
  });

  describe('기본 환경변수 검증', () => {
    test('NODE_ENV 기본값이 development로 설정됨', () => {
      delete process.env.NODE_ENV;
      const env = getEnv();
      expect(env.NODE_ENV).toBe('development');
    });

    test('필수 SUPABASE 환경변수가 누락되면 undefined 반환', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const env = getEnv();
      expect(env.SUPABASE_URL).toBeUndefined();
      expect(env.SUPABASE_ANON_KEY).toBeUndefined();
    });

    test('SUPABASE 환경변수가 설정되면 올바르게 반환', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';

      const env = getEnv();
      expect(env.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(env.SUPABASE_ANON_KEY).toBe('test_anon_key');
    });

    test('JWT_SECRET 최소 길이 검증', () => {
      // 32자 미만은 에러
      process.env.JWT_SECRET = 'short_secret';
      expect(() => getEnv()).toThrow('JWT_SECRET must be at least 32 characters long');

      // 32자 이상은 정상
      process.env.JWT_SECRET = 'valid_jwt_secret_with_32_chars_minimum';
      const env = getEnv();
      expect(env.JWT_SECRET).toBe('valid_jwt_secret_with_32_chars_minimum');
    });
  });

  describe('Degradation Mode 검증', () => {
    test('SUPABASE 환경변수 모두 있으면 full mode', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const mode = getDegradationMode();
      expect(mode).toBe('full');
    });

    test('SUPABASE_SERVICE_ROLE_KEY 없으면 degraded mode', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const mode = getDegradationMode();
      expect(mode).toBe('degraded');
    });

    test('SUPABASE 기본 설정 없으면 degraded mode (개발환경)', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const mode = getDegradationMode();
      expect(mode).toBe('degraded');
    });

    test('SUPABASE 기본 설정 없으면 disabled mode (프로덕션)', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;

      const mode = getDegradationMode();
      expect(mode).toBe('disabled');
    });
  });

  describe('Environment Capabilities 검증', () => {
    test('모든 서비스 설정된 경우 모든 capabilities 활성화', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
      process.env.JWT_SECRET = 'valid_jwt_secret_with_32_chars_minimum';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.SEEDANCE_API_KEY = 'test_seedance_key';

      const capabilities = getEnvironmentCapabilities();

      expect(capabilities.supabaseAuth).toBe(true);
      expect(capabilities.legacyAuth).toBe(true);
      expect(capabilities.database).toBe(true);
      expect(capabilities.fullAdmin).toBe(true);
      expect(capabilities.seedanceVideo).toBe(true);
      expect(capabilities.degradationMode).toBe('full');
    });

    test('서비스별 개별 비활성화 테스트', () => {
      // Supabase만 비활성화
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.JWT_SECRET = 'valid_jwt_secret_with_32_chars_minimum';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

      const capabilities = getEnvironmentCapabilities();

      expect(capabilities.supabaseAuth).toBe(false);
      expect(capabilities.legacyAuth).toBe(true);
      expect(capabilities.database).toBe(true);
      expect(capabilities.fullAdmin).toBe(false);
    });
  });

  describe('Supabase Config 검증', () => {
    test('완전한 Supabase 설정 반환', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';

      const config = getSupabaseConfig();

      expect(config.url).toBe('https://test.supabase.co');
      expect(config.anonKey).toBe('test_anon_key');
      expect(config.serviceRoleKey).toBe('test_service_key');
      expect(config.isConfigured).toBe(true);
      expect(config.hasFullAdmin).toBe(true);
      expect(config.degradationMode).toBe('full');
    });

    test('부분적 Supabase 설정 - Service Role Key 없음', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_anon_key';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const config = getSupabaseConfig();

      expect(config.isConfigured).toBe(true);
      expect(config.hasFullAdmin).toBe(false);
      expect(config.degradationMode).toBe('degraded');
    });
  });

  describe('AI API Keys 검증', () => {
    test('AI 서비스 키들이 올바르게 반환됨', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'test_gemini_key';
      process.env.SEEDANCE_API_KEY = 'test_seedance_key';
      process.env.SEEDREAM_API_KEY = 'test_seedream_key';
      process.env.MODELARK_API_KEY = 'test_modelark_key';

      const keys = getAIApiKeys();

      expect(keys.gemini).toBe('test_gemini_key');
      expect(keys.seedance).toBe('test_seedance_key');
      expect(keys.seedream).toBe('test_seedream_key');
      expect(keys.modelark).toBe('test_modelark_key');
    });

    test('GOOGLE_API_KEY가 GOOGLE_GEMINI_API_KEY 대신 사용됨', () => {
      delete process.env.GOOGLE_GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = 'fallback_google_key';

      const keys = getAIApiKeys();
      expect(keys.gemini).toBe('fallback_google_key');
    });

    test('GOOGLE_GEMINI_API_KEY가 우선순위 높음', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'primary_gemini_key';
      process.env.GOOGLE_API_KEY = 'fallback_google_key';

      const keys = getAIApiKeys();
      expect(keys.gemini).toBe('primary_gemini_key');
    });
  });

  describe('에러 처리 및 예외 상황', () => {
    test('환경변수 파싱 에러 시 적절한 에러 메시지', () => {
      // 잘못된 URL 형식
      process.env.SUPABASE_URL = 'invalid-url';

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    test('캐시된 환경변수 반환 확인', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';

      const env1 = getEnv();
      const env2 = getEnv();

      expect(env1).toBe(env2); // 같은 객체 참조 (캐시됨)
    });
  });

  describe('$300 사건 방지 테스트', () => {
    test('환경변수 검증 함수들이 무한 루프를 발생시키지 않음', () => {
      const startTime = Date.now();

      // 여러 번 호출해도 빠르게 반환되어야 함
      for (let i = 0; i < 100; i++) {
        getDegradationMode();
        getEnvironmentCapabilities();
        getSupabaseConfig();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 100ms 이내
    });

    test('캐시 메커니즘이 정상 작동함', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';

      const startTime = Date.now();

      // 첫 번째 호출 (캐시 생성)
      getEnv();

      // 이후 호출들 (캐시 사용)
      for (let i = 0; i < 50; i++) {
        getEnv();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // 50ms 이내
    });
  });
});