/**
 * Seedance 설정 강화 - 통합 테스트
 * Phase 5: 키 검증 로직 강화 완전 검증
 *
 * 검증 범위:
 * 1. validateSeedanceConfig 함수의 모든 시나리오
 * 2. API 라우트에서의 통합 동작
 * 3. Mock Provider vs Real Provider 구분
 * 4. 환경별 다른 동작 확인
 * 5. 에러 메시지 형식 및 가이드 제공
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateSeedanceConfig, ServiceConfigError } from '@/shared/lib/service-config-error';
import { seedanceService } from '@/lib/providers/seedance-service';

describe('Seedance 설정 강화 - 통합 테스트', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    // 환경변수 백업
    originalEnv = { ...process.env };

    // 테스트 환경 초기화
    delete process.env.SEEDANCE_API_KEY;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // 환경변수 복원
    process.env = originalEnv;
  });

  describe('validateSeedanceConfig 함수 - 전체 시나리오', () => {
    describe('환경변수 누락 시나리오', () => {
      it('API 키가 없으면 SEEDANCE_NOT_CONFIGURED 에러를 던져야 함', () => {
        expect(() => {
          validateSeedanceConfig();
        }).toThrow(ServiceConfigError);

        try {
          validateSeedanceConfig();
        } catch (error) {
          expect(error).toBeInstanceOf(ServiceConfigError);
          const configError = error as ServiceConfigError;

          expect(configError.errorCode).toBe('SEEDANCE_NOT_CONFIGURED');
          expect(configError.httpStatus).toBe(503);
          expect(configError.message).toContain('SEEDANCE_API_KEY');
          expect(configError.setupGuide).toBeDefined();
          expect(configError.setupGuide?.environment).toBeDefined();
        }
      });

      it('개발 환경에서는 로컬 설정 가이드를 제공해야 함', () => {
        process.env.NODE_ENV = 'development';

        try {
          validateSeedanceConfig();
        } catch (error) {
          const configError = error as ServiceConfigError;
          expect(configError.setupGuide?.setupMethods.local).toBeDefined();
          expect(configError.setupGuide?.steps).toContain('local');
        }
      });

      it('프로덕션 환경에서는 Vercel 설정 가이드를 제공해야 함', () => {
        process.env.NODE_ENV = 'production';

        try {
          validateSeedanceConfig();
        } catch (error) {
          const configError = error as ServiceConfigError;
          expect(configError.setupGuide?.setupMethods.vercel).toBeDefined();
          expect(configError.setupGuide?.setupMethods.vercel).toBeDefined();
        }
      });
    });

    describe('개발 환경 Mock 키 시나리오', () => {
      it('개발 환경에서 Mock 키는 유효하게 처리되어야 함', () => {
        process.env.NODE_ENV = 'development';
        process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

        const result = validateSeedanceConfig();

        expect(result.provider).toBe('mock');
        expect(result.ready).toBe(true);
        expect(result.environment).toBe('development');
        expect(result.keyStatus?.valid).toBe(true);
        expect(result.keyStatus?.format).toBe('mock_development_key');
      });

      it('개발 환경에서도 실제 ark_ 키는 정상 처리되어야 함', () => {
        process.env.NODE_ENV = 'development';
        process.env.SEEDANCE_API_KEY = 'ark_' + 'a'.repeat(40);

        const result = validateSeedanceConfig();

        expect(result.provider).toBe('seedance');
        expect(result.ready).toBe(true);
        expect(result.environment).toBe('development');
      });
    });

    describe('프로덕션 환경 키 검증 시나리오', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
      });

      it('ark_ 접두사가 없으면 SEEDANCE_INVALID_KEY 에러를 던져야 함', () => {
        process.env.SEEDANCE_API_KEY = 'invalid_key_without_prefix';

        expect(() => {
          validateSeedanceConfig();
        }).toThrow(ServiceConfigError);

        try {
          validateSeedanceConfig();
        } catch (error) {
          const configError = error as ServiceConfigError;
          expect(configError.errorCode).toBe('SEEDANCE_INVALID_KEY');
          expect(configError.keyAnalysis?.hasValidPrefix).toBe(false);
          expect(configError.keyAnalysis?.expectedFormat).toBe('ark_*');
        }
      });

      it('키가 너무 짧으면 SEEDANCE_KEY_TOO_SHORT 에러를 던져야 함', () => {
        process.env.SEEDANCE_API_KEY = 'ark_short_key';

        expect(() => {
          validateSeedanceConfig();
        }).toThrow(ServiceConfigError);

        try {
          validateSeedanceConfig();
        } catch (error) {
          const configError = error as ServiceConfigError;
          expect(configError.errorCode).toBe('SEEDANCE_KEY_TOO_SHORT');
          expect(configError.keyAnalysis?.currentLength).toBeLessThan(40);
          expect(configError.keyAnalysis?.minimumLength).toBe(40);
          expect(configError.keyAnalysis?.isTestKey).toBe(true);
        }
      });

      it('유효한 프로덕션 키는 정상 처리되어야 함', () => {
        const validKey = 'ark_' + 'a'.repeat(40);
        process.env.SEEDANCE_API_KEY = validKey;

        const result = validateSeedanceConfig();

        expect(result.provider).toBe('seedance');
        expect(result.ready).toBe(true);
        expect(result.environment).toBe('production');
        expect(result.keyStatus?.valid).toBe(true);
        expect(result.keyStatus?.format).toBe('ark_production_key');
      });
    });
  });

  describe('seedanceService 통합 - 강화된 헬스체크', () => {
    it('유효한 설정에서 헬스체크가 성공해야 함', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

      const healthStatus = await seedanceService.runHealthCheck();

      expect(healthStatus.isHealthy).toBe(true);
      expect(healthStatus.mode).toMatch(/mock|real/);
      expect(healthStatus.lastCheck).toBeDefined();
      expect(healthStatus.capabilities.canCreateVideo).toBe(true);
      expect(healthStatus.capabilities.canCheckStatus).toBe(true);
    });

    it('설정 에러가 있어도 Graceful Degradation으로 서비스는 계속되어야 함', async () => {
      // API 키 없음
      delete process.env.SEEDANCE_API_KEY;
      process.env.NODE_ENV = 'development';

      const healthStatus = await seedanceService.runHealthCheck();

      // 헬스체크는 실패하지만 서비스는 계속 동작 (기존 폴백 시스템 덕분)
      expect(healthStatus).toBeDefined();
      expect(healthStatus.lastCheck).toBeDefined();
    });
  });

  describe('에러 응답 형식 검증', () => {
    it('ServiceConfigError는 올바른 JSON 형식으로 직렬화되어야 함', () => {
      try {
        validateSeedanceConfig();
      } catch (error) {
        const configError = error as ServiceConfigError;

        // JSON 직렬화 테스트
        const serialized = JSON.stringify(configError);
        const parsed = JSON.parse(serialized);

        expect(parsed.errorCode).toBe(configError.errorCode);
        expect(parsed.httpStatus).toBe(configError.httpStatus);
        expect(parsed.message).toBe(configError.message);
        expect(parsed.setupGuide).toEqual(configError.setupGuide);
      }
    });

    it('에러 메시지는 사용자 친화적이어야 함', () => {
      const errors = [
        () => validateSeedanceConfig(), // SEEDANCE_NOT_CONFIGURED
        () => {
          process.env.SEEDANCE_API_KEY = 'invalid';
          process.env.NODE_ENV = 'production';
          validateSeedanceConfig();
        }, // SEEDANCE_INVALID_KEY
        () => {
          process.env.SEEDANCE_API_KEY = 'ark_short';
          process.env.NODE_ENV = 'production';
          validateSeedanceConfig();
        } // SEEDANCE_KEY_TOO_SHORT
      ];

      errors.forEach(errorFn => {
        try {
          errorFn();
        } catch (error) {
          const configError = error as ServiceConfigError;

          // 메시지 품질 검증
          expect(configError.message).not.toMatch(/undefined|null|NaN/);
          expect(configError.message.length).toBeGreaterThan(10);
          expect(configError.message).toMatch(/[가-힣]/); // 한국어 포함

          // HTTP 상태 코드 검증
          expect(configError.httpStatus).toBeGreaterThanOrEqual(400);
          expect(configError.httpStatus).toBeLessThan(600);

          // 에러 코드 형식 검증
          expect(configError.errorCode).toMatch(/^SEEDANCE_[A-Z_]+$/);
        }
      });
    });
  });

  describe('환경별 동작 차이 검증', () => {
    it('개발 환경에서는 Mock 키 허용', () => {
      process.env.NODE_ENV = 'development';
      process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

      expect(() => validateSeedanceConfig()).not.toThrow();
    });

    it('프로덕션 환경에서는 Mock 키 거부', () => {
      process.env.NODE_ENV = 'production';
      process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

      expect(() => validateSeedanceConfig()).toThrow(ServiceConfigError);
    });

    it('테스트 환경은 개발 환경처럼 동작', () => {
      process.env.NODE_ENV = 'test';
      process.env.SEEDANCE_API_KEY = 'mock_development_key_40_characters_long_for_testing';

      const result = validateSeedanceConfig();
      expect(result.provider).toBe('mock');
      expect(result.environment).toBe('test');
    });
  });

  describe('계약 불변 조건 (Contract Invariants)', () => {
    it('모든 성공 응답은 provider와 ready 필드를 포함해야 함', () => {
      const validConfigs = [
        { env: 'development', key: 'mock_development_key_40_characters_long_for_testing' },
        { env: 'production', key: 'ark_' + 'a'.repeat(40) },
        { env: 'test', key: 'mock_development_key_40_characters_long_for_testing' }
      ];

      validConfigs.forEach(({ env, key }) => {
        process.env.NODE_ENV = env;
        process.env.SEEDANCE_API_KEY = key;

        const result = validateSeedanceConfig();

        expect(result.provider).toMatch(/^(mock|seedance)$/);
        expect(result.ready).toBe(true);
        expect(result.environment).toBe(env);
        expect(result.keyStatus).toBeDefined();
      });
    });

    it('모든 에러 응답은 setupGuide를 포함해야 함', () => {
      const errorConfigs = [
        { env: 'development', key: undefined },
        { env: 'production', key: 'invalid' },
        { env: 'production', key: 'ark_short' }
      ];

      errorConfigs.forEach(({ env, key }) => {
        process.env.NODE_ENV = env;
        if (key) {
          process.env.SEEDANCE_API_KEY = key;
        } else {
          delete process.env.SEEDANCE_API_KEY;
        }

        try {
          validateSeedanceConfig();
          throw new Error('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ServiceConfigError);
          const configError = error as ServiceConfigError;

          expect(configError.setupGuide).toBeDefined();
          expect(configError.setupGuide?.environment).toBeDefined();
          expect(configError.setupGuide?.troubleshooting).toBeDefined();
          expect(configError.setupGuide?.helpUrl).toBeDefined();
        }
      });
    });
  });
});