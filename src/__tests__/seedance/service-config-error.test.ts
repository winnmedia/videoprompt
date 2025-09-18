/**
 * ServiceConfigError 도메인 계약 테스트
 * TDD 접근: 계약 기반 검증 시스템 구현
 *
 * 도메인 규칙:
 * 1. ServiceConfigError는 서비스 설정 관련 에러만 표현
 * 2. HTTP 상태 코드, 에러 코드, 메시지는 필수
 * 3. 개발/프로덕션 환경별 다른 가이드 제공
 * 4. 타입 안전성과 검증 가능성 보장
 */

import { describe, it, expect, beforeEach } from 'vitest';

// 아직 구현되지 않은 타입들 - RED 단계
import {
  ServiceConfigError,
  createServiceConfigError,
  validateSeedanceConfig,
  SeedanceConfigValidationResult,
  EnvironmentSetupGuide
} from '@/shared/lib/service-config-error';

describe('ServiceConfigError - 도메인 계약 검증', () => {
  describe('ServiceConfigError 생성자 계약', () => {
    it('필수 필드들이 올바르게 설정되어야 함', () => {
      const error = new ServiceConfigError(
        503,
        'API 키가 설정되지 않았습니다',
        'SEEDANCE_NOT_CONFIGURED'
      );

      expect(error.httpStatus).toBe(503);
      expect(error.message).toBe('API 키가 설정되지 않았습니다');
      expect(error.errorCode).toBe('SEEDANCE_NOT_CONFIGURED');
      expect(error.name).toBe('ServiceConfigError');
      expect(error).toBeInstanceOf(Error);
    });

    it('잘못된 HTTP 상태 코드는 거부되어야 함', () => {
      expect(() => {
        new ServiceConfigError(
          200, // 성공 코드는 에러에 부적절
          'Test message',
          'TEST_CODE'
        );
      }).toThrow('HTTP 상태 코드는 4xx 또는 5xx여야 합니다');
    });

    it('빈 에러 코드는 거부되어야 함', () => {
      expect(() => {
        new ServiceConfigError(503, 'Test message', '');
      }).toThrow('에러 코드는 필수입니다');
    });
  });

  describe('createServiceConfigError 팩토리 함수 계약', () => {
    it('SEEDANCE_NOT_CONFIGURED 에러를 올바르게 생성해야 함', () => {
      const error = createServiceConfigError.seedanceNotConfigured();

      expect(error.httpStatus).toBe(503);
      expect(error.errorCode).toBe('SEEDANCE_NOT_CONFIGURED');
      expect(error.message).toContain('SEEDANCE_API_KEY');
      expect(error.setupGuide).toBeDefined();
      expect(error.setupGuide?.environment).toBe(process.env.NODE_ENV);
    });

    it('SEEDANCE_INVALID_KEY 에러를 올바르게 생성해야 함', () => {
      const error = createServiceConfigError.seedanceInvalidKey('test_key');

      expect(error.httpStatus).toBe(503);
      expect(error.errorCode).toBe('SEEDANCE_INVALID_KEY');
      expect(error.keyAnalysis).toBeDefined();
      expect(error.keyAnalysis?.providedKey).toBe('test_...');
      expect(error.keyAnalysis?.expectedFormat).toBe('ark_*');
    });

    it('SEEDANCE_KEY_TOO_SHORT 에러를 올바르게 생성해야 함', () => {
      const shortKey = 'ark_short';
      const error = createServiceConfigError.seedanceKeyTooShort(shortKey);

      expect(error.httpStatus).toBe(503);
      expect(error.errorCode).toBe('SEEDANCE_KEY_TOO_SHORT');
      expect(error.keyAnalysis?.currentLength).toBe(shortKey.length);
      expect(error.keyAnalysis?.minimumLength).toBe(40);
    });
  });

  describe('validateSeedanceConfig 함수 계약', () => {
    beforeEach(() => {
      // 환경변수 초기화
      delete process.env.SEEDANCE_API_KEY;
      delete process.env.NODE_ENV;
    });

    it('API 키가 없으면 SEEDANCE_NOT_CONFIGURED 에러를 던져야 함', () => {
      expect(() => {
        validateSeedanceConfig();
      }).toThrow(ServiceConfigError);

      try {
        validateSeedanceConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceConfigError);
        expect((error as ServiceConfigError).errorCode).toBe('SEEDANCE_NOT_CONFIGURED');
      }
    });

    it('개발 환경에서 mock 키는 valid provider로 인식해야 함', () => {
      process.env.NODE_ENV = 'development';
      process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

      const result = validateSeedanceConfig();

      expect(result.provider).toBe('mock');
      expect(result.ready).toBe(true);
      expect(result.environment).toBe('development');
    });

    it('프로덕션 환경에서 ark_ 접두사가 없으면 에러를 던져야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'invalid_key_without_ark_prefix';

      expect(() => {
        validateSeedanceConfig();
      }).toThrow(ServiceConfigError);

      try {
        validateSeedanceConfig();
      } catch (error) {
        expect((error as ServiceConfigError).errorCode).toBe('SEEDANCE_INVALID_KEY');
      }
    });

    it('프로덕션 환경에서 키가 너무 짧으면 에러를 던져야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_short_key';

      expect(() => {
        validateSeedanceConfig();
      }).toThrow(ServiceConfigError);

      try {
        validateSeedanceConfig();
      } catch (error) {
        expect((error as ServiceConfigError).errorCode).toBe('SEEDANCE_KEY_TOO_SHORT');
      }
    });

    it('유효한 프로덕션 키는 real provider로 인식해야 함', () => {
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(40); // 유효한 길이의 실제 키

      const result = validateSeedanceConfig();

      expect(result.provider).toBe('seedance');
      expect(result.ready).toBe(true);
      expect(result.environment).toBe('production');
    });
  });

  describe('EnvironmentSetupGuide 계약', () => {
    it('개발 환경 가이드는 로컬 설정 방법을 포함해야 함', () => {
      // NODE_ENV를 명시적으로 development로 설정
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = createServiceConfigError.seedanceNotConfigured();
      const guide = error.setupGuide!;

      expect(guide.environment).toBe('development');
      expect(guide.steps).toContain('local');
      expect(guide.setupMethods.local).toBeDefined();

      // 환경변수 복원
      process.env.NODE_ENV = originalEnv;
    });

    it('프로덕션 환경 가이드는 Vercel/Railway 설정 방법을 포함해야 함', () => {
      process.env.NODE_ENV = 'production';
      const error = createServiceConfigError.seedanceNotConfigured();
      const guide = error.setupGuide!;

      expect(guide.environment).toBe('production');
      expect(guide.setupMethods.vercel).toBeDefined();
      expect(guide.setupMethods.railway).toBeDefined();
    });
  });

  describe('계약 불변 조건 (Contract Invariants)', () => {
    it('모든 ServiceConfigError는 JSON 직렬화 가능해야 함', () => {
      const error = createServiceConfigError.seedanceNotConfigured();

      expect(() => JSON.stringify(error)).not.toThrow();

      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.httpStatus).toBe(error.httpStatus);
      expect(serialized.errorCode).toBe(error.errorCode);
      expect(serialized.message).toBe(error.message);
    });

    it('에러 메시지는 항상 사용자 친화적이어야 함', () => {
      const errors = [
        createServiceConfigError.seedanceNotConfigured(),
        createServiceConfigError.seedanceInvalidKey('test'),
        createServiceConfigError.seedanceKeyTooShort('ark_short')
      ];

      errors.forEach(error => {
        expect(error.message).not.toMatch(/undefined|null|NaN/);
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.message).toMatch(/[가-힣]/); // 한국어 포함 확인
      });
    });

    it('HTTP 상태 코드는 RFC 7231 규격을 준수해야 함', () => {
      const validStatusCodes = [400, 401, 403, 404, 422, 429, 500, 502, 503, 504];

      const errors = [
        createServiceConfigError.seedanceNotConfigured(), // 503
        createServiceConfigError.seedanceInvalidKey('test'), // 503
        createServiceConfigError.seedanceKeyTooShort('ark_short') // 503
      ];

      errors.forEach(error => {
        expect(validStatusCodes).toContain(error.httpStatus);
      });
    });
  });
});