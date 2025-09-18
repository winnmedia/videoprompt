/**
 * 환경변수 프로덕션 검증 강화 테스트 (TDD Red Phase)
 * $300 사건 재발 방지를 위한 엄격한 환경변수 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// 기존 환경변수 백업
let originalEnv: Record<string, string | undefined>;

describe('환경변수 프로덕션 검증 강화', () => {
  beforeEach(() => {
    // 환경변수 백업
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 환경변수 복원
    process.env = originalEnv;

    // 모듈 캐시 리셋
    vi.resetModules();
  });

  describe('프로덕션 환경에서 SUPABASE_SERVICE_ROLE_KEY 필수 검증', () => {
    it('프로덕션 환경에서 SUPABASE_SERVICE_ROLE_KEY 누락 시 즉시 실패해야 함', async () => {
      // Given: 프로덕션 환경에서 SERVICE_ROLE_KEY 누락
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTUyNjAwfQ.test';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // When & Then: validateProductionEnv 호출 시 즉시 실패
      const { validateProductionEnv } = await import('@/shared/config/env');

      expect(() => validateProductionEnv()).toThrow(
        'Required environment variables missing in production: SUPABASE_SERVICE_ROLE_KEY'
      );
    });

    it('프로덕션 환경에서 모든 필수 환경변수가 있으면 통과해야 함', async () => {
      // Given: 프로덕션 환경에서 모든 필수 환경변수 설정
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTUyNjAwfQ.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZS1hZG1pbiIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NTI2MDB9.service_role_test';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.SEEDANCE_API_KEY = 'ark_test_key_minimum_40_characters_long_12345';

      // When & Then: validateProductionEnv 호출 시 통과
      const { validateProductionEnv } = await import('@/shared/config/env');

      expect(() => validateProductionEnv()).not.toThrow();
    });

    it('개발 환경에서는 SUPABASE_SERVICE_ROLE_KEY 누락이어도 경고만 출력해야 함', async () => {
      // Given: 개발 환경에서 SERVICE_ROLE_KEY 누락
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTUyNjAwfQ.test';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // When & Then: validateDevelopmentEnv 호출 시 에러 없음
      const { validateDevelopmentEnv } = await import('@/shared/config/env');

      expect(() => validateDevelopmentEnv()).not.toThrow();
    });
  });

  describe('getDegradationMode 개선', () => {
    it('프로덕션에서 SERVICE_ROLE_KEY 누락 시 disabled 반환해야 함', async () => {
      // Given: 프로덕션 환경에서 SERVICE_ROLE_KEY 누락
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTUyNjAwfQ.test';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // When
      const { getDegradationMode } = await import('@/shared/config/env');

      // Then: disabled 반환 (401/503 루프 방지)
      expect(getDegradationMode()).toBe('disabled');
    });

    it('프로덕션에서 모든 환경변수 설정 시 full 반환해야 함', async () => {
      // Given: 프로덕션 환경에서 모든 필수 환경변수 설정
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTUyNjAwfQ.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZS1hZG1pbiIsInJlZiI6InRlc3QiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NTI2MDB9.service_role_test';

      // When
      const { getDegradationMode } = await import('@/shared/config/env');

      // Then: full 반환
      expect(getDegradationMode()).toBe('full');
    });
  });

  describe('환경변수 스키마 검증', () => {
    it('잘못된 SUPABASE_URL 형식 시 즉시 실패해야 함', async () => {
      // Given: 잘못된 URL 형식
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'invalid-url';
      process.env.SUPABASE_ANON_KEY = 'test_key_40_characters_long_12345678901234';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key_40_characters_long_123456789';

      // When & Then: getEnv 호출 시 즉시 실패
      const { getEnv } = await import('@/shared/config/env');

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });

    it('SUPABASE_SERVICE_ROLE_KEY가 40자 미만이면 즉시 실패해야 함', async () => {
      // Given: 40자 미만의 SERVICE_ROLE_KEY
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test_key_40_characters_long_12345678901234';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'short_key'; // 40자 미만

      // When & Then: getEnv 호출 시 즉시 실패
      const { getEnv } = await import('@/shared/config/env');

      expect(() => getEnv()).toThrow('Invalid environment variables');
    });
  });
});