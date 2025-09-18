import { z } from 'zod';
import { vi } from 'vitest';

// GREEN PHASE: 구현된 함수들로 테스트 성공시키기
// $300 사건 예방을 위한 환경변수 차단선 구축 검증

describe('환경변수 검증 시스템 TDD (Green Phase)', () => {
  // 원본 process.env 백업
  const originalEnv = process.env;

  beforeEach(() => {
    // 깨끗한 환경으로 시작
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    // 원본 환경 복원
    process.env = originalEnv;
  });

  describe('프로덕션 환경 필수 변수 검증', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    test('[GREEN] SUPABASE_URL 누락 시 빌드 실패해야 함', async () => {
      // Given: SUPABASE_URL이 없는 프로덕션 환경
      delete process.env.SUPABASE_URL;

      // When & Then: 환경변수 검증 시도 시 에러 발생해야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
      }).toThrow('Required environment variables missing in production: SUPABASE_URL');
    });

    test('[GREEN] SUPABASE_ANON_KEY 누락 시 빌드 실패해야 함', () => {
      // Given: SUPABASE_ANON_KEY가 없는 환경
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.SUPABASE_ANON_KEY;

      // When & Then: 환경변수 검증 시 에러 발생해야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
      }).toThrow('Required environment variables missing in production: SUPABASE_ANON_KEY');
    });

    test('[GREEN] DATABASE_URL 형식 검증 실패 시 에러 발생해야 함', () => {
      // Given: 잘못된 DATABASE_URL 형식
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'valid-key-12345678901234567890';
      process.env.DATABASE_URL = 'invalid-url-format';

      // When & Then: 환경변수 검증 시 에러 발생해야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
      }).toThrow('DATABASE_URL must be a valid database connection string');
    });
  });

  describe('API 키 길이 검증 강화', () => {
    test('[GREEN] SEEDANCE_API_KEY 길이 40자 미만 시 실패해야 함', () => {
      // Given: 40자 미만의 SEEDANCE_API_KEY
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'valid-anon-key-minimum-length-required';
      process.env.SEEDANCE_API_KEY = 'too-short'; // 9자 < 40자

      // When & Then: 환경변수 검증 시 에러 발생해야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
      }).toThrow('SEEDANCE_API_KEY must be at least 40 characters long');
    });

    test('[GREEN] JWT_SECRET 길이 32자 미만 시 실패해야 함', () => {
      // Given: 32자 미만의 JWT_SECRET
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short'; // 5자 < 32자

      // When & Then: 환경변수 검증 시 에러 발생해야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
      }).toThrow('JWT_SECRET must be at least 32 characters long');
    });
  });

  describe('개발환경 degraded mode 허용', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    test('[GREEN] 개발환경에서는 SUPABASE_URL 누락 시 degraded mode로 동작해야 함', () => {
      // Given: SUPABASE_URL이 없는 개발 환경
      delete process.env.SUPABASE_URL;

      // When: degraded mode 확인
      const envModule = await import('@/shared/config/env');
      const mode = envModule.getDegradationMode();

      // Then: degraded mode여야 함
      expect(mode).toBe('degraded');
    });

    test('[GREEN] 개발환경에서는 API 키 누락 시 경고만 출력하고 계속 진행해야 함', () => {
      // Given: API 키들이 없는 개발 환경
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.GOOGLE_GEMINI_API_KEY;

      // When & Then: 환경변수 검증 시 에러가 발생하지 않아야 함
      expect(() => {
        const envModule = await import('@/shared/config/env');
        envModule.validateDevelopmentEnv();
      }).not.toThrow();
    });
  });

  // 더 간단한 테스트들로 TDD Green phase 검증
  test('[GREEN] 환경변수 즉시 실패 메커니즘이 동작해야 함', () => {
    // Given: 프로덕션 환경에서 필수 변수 모두 누락
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    // When & Then: 환경변수 검증 시 에러 발생해야 함
    expect(() => {
      const envModule = await import('@/shared/config/env');
        envModule.validateProductionEnv();
    }).toThrow('Required environment variables missing in production');
  });

  test('[GREEN] $300 사건 재발 방지 - 캐시 메커니즘이 동작해야 함', () => {
    // Given: 현재 getEnv는 캐시 기능이 있음
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'valid-key';

    // When: 여러 번 getEnv 호출
    const envModule = await import('@/shared/config/env');
    const env1 = envModule.getEnv();
    const env2 = envModule.getEnv();

    // Then: 동일한 객체 참조여야 함 (이미 구현됨)
    expect(env1).toBe(env2);
  });
});