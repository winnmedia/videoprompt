/**
 * Seedance API 키 검증 테스트
 * TDD: Red → Green → Refactor
 */

import { isValidSeedanceApiKey, shouldUseMockProvider } from '@/lib/providers/seedance-validators';

describe('Seedance API 키 검증', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isValidSeedanceApiKey', () => {
    test('BytePlus ark_ 접두사 키는 유효해야 함', () => {
      const validKey = 'ark_' + 'a'.repeat(50); // 50자 이상
      expect(isValidSeedanceApiKey(validKey)).toBe(true);
    });

    test('50자 이상 긴 키는 유효해야 함', () => {
      const validKey = 'x'.repeat(51);
      expect(isValidSeedanceApiKey(validKey)).toBe(true);
    });

    test('하드코딩된 테스트 키(007f7ffe...)는 무효해야 함', () => {
      const testKey = '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c';
      expect(isValidSeedanceApiKey(testKey)).toBe(false);
    });

    test('UUID 형식 키는 무효해야 함', () => {
      const uuidKey = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidSeedanceApiKey(uuidKey)).toBe(false);
    });

    test('짧은 키(20자 미만)는 무효해야 함', () => {
      const shortKey = 'short';
      expect(isValidSeedanceApiKey(shortKey)).toBe(false);
    });

    test('빈 문자열은 무효해야 함', () => {
      expect(isValidSeedanceApiKey('')).toBe(false);
    });

    test('null/undefined는 무효해야 함', () => {
      expect(isValidSeedanceApiKey(null as any)).toBe(false);
      expect(isValidSeedanceApiKey(undefined as any)).toBe(false);
    });
  });

  describe('shouldUseMockProvider', () => {
    test('NEXT_PUBLIC_ENABLE_MOCK_API=true면 Mock 사용해야 함', () => {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_API = 'true';
      expect(shouldUseMockProvider()).toBe(true);
    });

    test('API 키가 없으면 개발환경에서 Mock 사용해야 함', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      expect(shouldUseMockProvider()).toBe(true);
    });

    test('잘못된 API 키면 개발환경에서 Mock 사용해야 함', () => {
      process.env.NODE_ENV = 'development';
      process.env.SEEDANCE_API_KEY = '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c'; // 테스트 키
      expect(shouldUseMockProvider()).toBe(true);
    });

    test('API 키가 없으면 프로덕션에서 Mock 사용하지 않음', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.MODELARK_API_KEY;
      expect(shouldUseMockProvider()).toBe(false);
    });

    test('유효한 API 키가 있으면 Mock 사용하지 않음', () => {
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(50);
      expect(shouldUseMockProvider()).toBe(false);
    });
  });

  describe('환경변수 우선순위', () => {
    test('SEEDANCE_API_KEY가 MODELARK_API_KEY보다 우선해야 함', () => {
      process.env.SEEDANCE_API_KEY = 'ark_seedance_key_' + 'a'.repeat(40);
      process.env.MODELARK_API_KEY = 'ark_modelark_key_' + 'b'.repeat(40);

      // SEEDANCE_API_KEY가 우선되어야 함
      expect(shouldUseMockProvider()).toBe(false);
    });

    test('SEEDANCE_API_KEY가 없으면 MODELARK_API_KEY 사용해야 함', () => {
      delete process.env.SEEDANCE_API_KEY;
      process.env.MODELARK_API_KEY = 'ark_modelark_key_' + 'b'.repeat(40);

      expect(shouldUseMockProvider()).toBe(false);
    });
  });

  describe('에러 케이스', () => {
    test('API 키 검증 중 예외 발생 시 안전하게 처리해야 함', () => {
      // 매우 긴 키로 메모리 테스트
      const extremelyLongKey = 'a'.repeat(1000000);
      expect(() => isValidSeedanceApiKey(extremelyLongKey)).not.toThrow();
    });

    test('특수 문자 포함 키 처리', () => {
      const specialCharKey = 'ark_key_with_!@#$%^&*()_+=' + 'a'.repeat(30);
      expect(isValidSeedanceApiKey(specialCharKey)).toBe(true);
    });
  });
});