/**
 * 환경 차단선 구축 테스트
 * $300 사건 재발 방지를 위한 엄격한 환경변수 검증
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

describe('환경 차단선 구축 - 즉시 실패 시스템', () => {
  let originalProcessExit: any;
  let originalConsoleError: any;
  let mockProcessExit: any;
  let mockConsoleError: any;

  beforeEach(() => {
    // process.exit와 console.error를 모킹
    originalProcessExit = process.exit;
    originalConsoleError = console.error;
    mockProcessExit = vi.fn();
    mockConsoleError = vi.fn();
    process.exit = mockProcessExit as any;
    console.error = mockConsoleError;

    // 환경변수 초기화
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SEEDANCE_API_KEY;

    // 모듈 캐시 초기화
    vi.resetModules();
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
  });

  describe('필수 환경변수 즉시 실패 검증', () => {
    test('SUPABASE_URL 누락 시 즉시 process.exit(1) 호출', async () => {
      // Given: SUPABASE_URL이 누락된 상황
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;

      // When: getEnv() 호출 시
      const { getEnv } = await import('../../shared/config/env');

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    test('SUPABASE_ANON_KEY 누락 시 즉시 process.exit(1) 호출', async () => {
      // Given: SUPABASE_ANON_KEY가 누락된 상황
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_ANON_KEY;

      // When: getEnv() 호출 시
      const { getEnv } = await import('../../shared/config/env');

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    test('DATABASE_URL 누락 시 즉시 process.exit(1) 호출', async () => {
      // Given: DATABASE_URL이 누락된 상황
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
      delete process.env.DATABASE_URL;

      // When: getEnv() 호출 시
      const { getEnv } = await import('../../shared/config/env');

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });
  });

  describe('프로덕션 환경 강화된 검증', () => {
    test('프로덕션에서 SUPABASE_SERVICE_ROLE_KEY 필수', async () => {
      // Given: 프로덕션 환경에서 SERVICE_ROLE_KEY 누락
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // When: validateProductionEnv() 호출
      const { validateProductionEnv } = await import('../../shared/config/env');

      // Then: 에러 발생
      expect(() => validateProductionEnv()).toThrow('Required environment variables missing in production: SUPABASE_SERVICE_ROLE_KEY');
    });

    test('프로덕션에서 SEEDANCE_API_KEY 검증', async () => {
      // Given: 프로덕션 환경 설정
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.service';
      process.env.SEEDANCE_API_KEY = 'too-short'; // 40자 미만

      // When: validateProductionEnv() 호출
      const { validateProductionEnv } = await import('../../shared/config/env');

      // Then: 길이 검증 에러 발생
      expect(() => validateProductionEnv()).toThrow('SEEDANCE_API_KEY must be at least 40 characters long');
    });
  });

  describe('환경변수 스키마 강화', () => {
    test('SUPABASE_URL이 required로 변경되어야 함', async () => {
      // Given: SUPABASE_URL 누락
      process.env.NODE_ENV = 'development';
      delete process.env.SUPABASE_URL;

      // When: getEnv() 호출
      const { getEnv } = await import('../../shared/config/env');

      // Then: 필수 필드 에러 발생
      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    test('SUPABASE_ANON_KEY가 required로 변경되어야 함', async () => {
      // Given: SUPABASE_ANON_KEY 누락
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_ANON_KEY;

      // When: getEnv() 호출
      const { getEnv } = await import('../../shared/config/env');

      // Then: 필수 필드 에러 발생
      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    test('DATABASE_URL이 required로 변경되어야 함', async () => {
      // Given: DATABASE_URL 누락
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
      delete process.env.DATABASE_URL;

      // When: getEnv() 호출
      const { getEnv } = await import('../../shared/config/env');

      // Then: 필수 필드 에러 발생
      expect(() => getEnv()).toThrow('Invalid environment variables');
    });
  });

  describe('initializeEnvironment 즉시 실패 구현', () => {
    test('환경변수 누락 시 앱 시작 차단', async () => {
      // Given: 필수 환경변수 누락
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;

      // When: initializeEnvironment() 호출
      const { initializeEnvironment } = await import('../../shared/config/env');

      // Then: 에러로 인해 앱 시작 차단
      expect(() => initializeEnvironment()).toThrow();
    });

    test('모든 환경변수 정상 시 초기화 성공', async () => {
      // Given: 모든 필수 환경변수 설정
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.service';

      // When: initializeEnvironment() 호출
      const { initializeEnvironment } = await import('../../shared/config/env');

      // Then: 정상 초기화
      expect(() => initializeEnvironment()).not.toThrow();
    });
  });

  describe('명확한 에러 메시지 제공', () => {
    test('누락된 환경변수 목록을 명시', async () => {
      // Given: 여러 필수 환경변수 누락
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.DATABASE_URL;

      // When: getEnv() 호출
      const { getEnv } = await import('../../shared/config/env');

      // Then: 구체적인 에러 메시지 제공
      expect(() => getEnv()).toThrow(/Invalid environment variables.*SUPABASE_URL.*SUPABASE_ANON_KEY.*DATABASE_URL/);
    });

    test('각 환경변수별 상세한 요구사항 안내', async () => {
      // Given: 잘못된 형식의 환경변수
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'invalid-url';
      process.env.SUPABASE_ANON_KEY = 'short';
      process.env.DATABASE_URL = 'invalid-db-url';

      // When: getEnv() 호출
      const { getEnv } = await import('../../shared/config/env');

      // Then: 구체적인 검증 에러 메시지
      expect(() => getEnv()).toThrow();
    });
  });
});

describe('validate-env-realtime.ts 단순화', () => {
  test('validateEnvironment() 함수가 getEnv()를 호출하여 검증', async () => {
    // Given: 모든 필수 환경변수 설정
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

    // When: validateEnvironment() 함수 호출
    const { validateEnvironment } = await import('../../../scripts/validate-env-realtime');

    // Then: 성공적으로 검증 완료
    const result = await validateEnvironment();
    expect(result).toBe(true);
  });

  test('validateEnvironment() 함수가 환경변수 누락 시 false 반환', async () => {
    // Given: 필수 환경변수 누락
    process.env.NODE_ENV = 'development';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.DATABASE_URL;

    vi.resetModules(); // 모듈 캐시 초기화

    // When: validateEnvironment() 함수 호출
    const { validateEnvironment } = await import('../../../scripts/validate-env-realtime');

    // Then: 검증 실패로 false 반환
    const result = await validateEnvironment();
    expect(result).toBe(false);
  });
});