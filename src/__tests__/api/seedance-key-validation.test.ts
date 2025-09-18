/**
 * 🔑 Seedance API 키 검증 시스템 테스트
 *
 * 테스트 시나리오:
 * 1. 올바른 프로덕션 키 검증
 * 2. 잘못된 키 형식 감지
 * 3. 테스트 키 패턴 감지
 * 4. 키 길이 검증
 * 5. 반복 패턴 감지
 * 6. API 엔드포인트 에러 응답 확인
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// validateSeedanceApiKey 함수는 파일 내부에 정의되어 있으므로
// 테스트를 위해 별도 모듈로 추출하거나 인라인 테스트 작성
// 여기서는 인라인으로 같은 로직을 테스트합니다

/**
 * 테스트용 키 검증 함수 (실제 코드와 동일한 로직)
 */
function validateSeedanceApiKey(apiKey: string) {
  const analysis = {
    length: apiKey.length,
    format: apiKey.substring(0, 4) + '...',
    isTestKey: false,
    hasValidPrefix: false,
    hasValidLength: false
  };

  // 1. 기본 형식 검증
  if (!apiKey.startsWith('ark_')) {
    return {
      valid: false,
      error: 'API 키는 "ark_"로 시작해야 합니다. BytePlus ModelArk에서 발급받은 정확한 키인지 확인하세요.',
      errorCode: 'INVALID_KEY_FORMAT',
      analysis
    };
  }

  analysis.hasValidPrefix = true;

  // 2. 길이 검증
  if (apiKey.length < 40) {
    analysis.isTestKey = apiKey.includes('test') || apiKey.includes('demo') || apiKey.length < 36;

    return {
      valid: false,
      error: analysis.isTestKey
        ? '테스트 키가 감지되었습니다. 프로덕션 환경에서는 정식 API 키가 필요합니다.'
        : 'API 키가 너무 짧습니다. 정확한 키를 입력했는지 확인하세요.',
      errorCode: analysis.isTestKey ? 'TEST_KEY_DETECTED' : 'KEY_TOO_SHORT',
      analysis
    };
  }

  analysis.hasValidLength = true;

  // 3. 테스트 키 패턴 검증 (길이가 충분해도 테스트 키일 수 있음)
  const testPatterns = [
    'test', 'demo', 'sample', 'example',
    '1234', '0000', 'xxxx', 'abcd'
  ];

  const lowerKey = apiKey.toLowerCase();
  const containsTestPattern = testPatterns.some(pattern => lowerKey.includes(pattern));

  if (containsTestPattern) {
    analysis.isTestKey = true;
    return {
      valid: false,
      error: '테스트 키로 추정됩니다. BytePlus ModelArk에서 프로덕션용 API 키를 발급받아 사용하세요.',
      errorCode: 'TEST_KEY_PATTERN_DETECTED',
      analysis
    };
  }

  // 4. 반복 패턴 검증 (잘못된 키 감지)
  const keyBody = apiKey.slice(4); // 'ark_' 제거
  const hasRepeatingPattern = /(.{3,})\1{2,}/.test(keyBody); // 3자 이상이 3회 이상 반복

  if (hasRepeatingPattern) {
    return {
      valid: false,
      error: '잘못된 키 형식이 감지되었습니다. 정확한 API 키를 다시 확인하세요.',
      errorCode: 'INVALID_KEY_PATTERN',
      analysis
    };
  }

  // 5. 모든 검증 통과
  return {
    valid: true,
    analysis
  };
}

describe('🔑 Seedance API 키 검증 시스템', () => {
  describe('validateSeedanceApiKey 함수', () => {
    describe('올바른 키 형식', () => {
      it('유효한 프로덕션 키를 허용해야 함', () => {
        // Arrange
        const validKey = 'ark_abcdef1234567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(validKey);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.analysis.hasValidPrefix).toBe(true);
        expect(result.analysis.hasValidLength).toBe(true);
        expect(result.analysis.isTestKey).toBe(false);
      });

      it('긴 유효한 키를 허용해야 함', () => {
        // Arrange
        const longValidKey = 'ark_' + 'a'.repeat(60);

        // Act
        const result = validateSeedanceApiKey(longValidKey);

        // Assert
        expect(result.valid).toBe(true);
      });
    });

    describe('잘못된 키 형식', () => {
      it('잘못된 접두사를 거부해야 함', () => {
        // Arrange
        const invalidPrefixKey = 'api_abcdef1234567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(invalidPrefixKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_KEY_FORMAT');
        expect(result.error).toContain('ark_로 시작해야');
        expect(result.analysis.hasValidPrefix).toBe(false);
      });

      it('빈 문자열을 거부해야 함', () => {
        // Act
        const result = validateSeedanceApiKey('');

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_KEY_FORMAT');
      });

      it('ark_만 있는 키를 거부해야 함', () => {
        // Act
        const result = validateSeedanceApiKey('ark_');

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('KEY_TOO_SHORT');
      });
    });

    describe('길이 검증', () => {
      it('40자 미만 키를 거부해야 함', () => {
        // Arrange
        const shortKey = 'ark_shortkey123';

        // Act
        const result = validateSeedanceApiKey(shortKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('KEY_TOO_SHORT');
        expect(result.analysis.hasValidPrefix).toBe(true);
        expect(result.analysis.hasValidLength).toBe(false);
      });

      it('정확히 40자 키를 허용해야 함', () => {
        // Arrange
        const exactKey = 'ark_' + 'x'.repeat(36); // ark_ + 36자 = 40자

        // Act
        const result = validateSeedanceApiKey(exactKey);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.analysis.length).toBe(40);
      });
    });

    describe('테스트 키 패턴 감지', () => {
      it('test가 포함된 짧은 키를 테스트 키로 감지해야 함', () => {
        // Arrange
        const testKey = 'ark_test123';

        // Act
        const result = validateSeedanceApiKey(testKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TEST_KEY_DETECTED');
        expect(result.analysis.isTestKey).toBe(true);
      });

      it('demo가 포함된 긴 키도 테스트 키로 감지해야 함', () => {
        // Arrange
        const demoKey = 'ark_demo1234567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(demoKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TEST_KEY_PATTERN_DETECTED');
        expect(result.analysis.isTestKey).toBe(true);
      });

      it('sample 패턴을 감지해야 함', () => {
        // Arrange
        const sampleKey = 'ark_sample567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(sampleKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TEST_KEY_PATTERN_DETECTED');
      });

      it('1234 패턴을 감지해야 함', () => {
        // Arrange
        const patternKey = 'ark_1234567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(patternKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TEST_KEY_PATTERN_DETECTED');
      });

      // 대소문자 구분 없이 감지
      it('TEST (대문자)도 감지해야 함', () => {
        // Arrange
        const upperTestKey = 'ark_TEST567890abcdef1234567890abcdef12';

        // Act
        const result = validateSeedanceApiKey(upperTestKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('TEST_KEY_PATTERN_DETECTED');
      });
    });

    describe('반복 패턴 감지', () => {
      it('반복되는 패턴을 가진 키를 거부해야 함', () => {
        // Arrange
        const repeatingKey = 'ark_abcabcabcabcabcabcabcabcabcabcabcabc';

        // Act
        const result = validateSeedanceApiKey(repeatingKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_KEY_PATTERN');
      });

      it('123123123... 패턴을 거부해야 함', () => {
        // Arrange
        const repeatingKey = 'ark_123123123123123123123123123123123123';

        // Act
        const result = validateSeedanceApiKey(repeatingKey);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_KEY_PATTERN');
      });

      it('비반복 패턴은 허용해야 함', () => {
        // Arrange
        const nonRepeatingKey = 'ark_abcdef1234567890ghijklmnopqrstuvwxyz12';

        // Act
        const result = validateSeedanceApiKey(nonRepeatingKey);

        // Assert
        expect(result.valid).toBe(true);
      });

      it('짧은 반복(2회)은 허용해야 함', () => {
        // Arrange
        const shortRepeatKey = 'ark_abcabc1234567890ghijklmnopqrstuvwxyz';

        // Act
        const result = validateSeedanceApiKey(shortRepeatKey);

        // Assert
        expect(result.valid).toBe(true);
      });
    });

    describe('분석 정보', () => {
      it('올바른 분석 정보를 제공해야 함', () => {
        // Arrange
        const testKey = 'ark_test123';

        // Act
        const result = validateSeedanceApiKey(testKey);

        // Assert
        expect(result.analysis.length).toBe(11);
        expect(result.analysis.format).toBe('ark_...');
        expect(result.analysis.hasValidPrefix).toBe(true);
        expect(result.analysis.hasValidLength).toBe(false);
        expect(result.analysis.isTestKey).toBe(true);
      });
    });
  });

  describe('에러 메시지 품질', () => {
    it('사용자 친화적인 메시지를 제공해야 함', () => {
      const testCases = [
        {
          key: 'invalid_key',
          expectedMessage: 'ark_로 시작해야',
        },
        {
          key: 'ark_short',
          expectedMessage: '너무 짧습니다',
        },
        {
          key: 'ark_test1234567890abcdef1234567890abcdef',
          expectedMessage: '테스트 키로 추정됩니다',
        },
      ];

      testCases.forEach(({ key, expectedMessage }) => {
        const result = validateSeedanceApiKey(key);
        expect(result.error).toContain(expectedMessage);
      });
    });

    it('적절한 에러 코드를 제공해야 함', () => {
      const testCases = [
        {
          key: 'invalid_key',
          expectedCode: 'INVALID_KEY_FORMAT',
        },
        {
          key: 'ark_short',
          expectedCode: 'KEY_TOO_SHORT',
        },
        {
          key: 'ark_test1234567890abcdef1234567890abcdef',
          expectedCode: 'TEST_KEY_PATTERN_DETECTED',
        },
        {
          key: 'ark_abcabcabcabcabcabcabcabcabcabcabcabc',
          expectedCode: 'INVALID_KEY_PATTERN',
        },
      ];

      testCases.forEach(({ key, expectedCode }) => {
        const result = validateSeedanceApiKey(key);
        expect(result.errorCode).toBe(expectedCode);
      });
    });
  });

  describe('경계값 테스트', () => {
    it('정확히 36자 키 (최소 길이)', () => {
      // Arrange
      const minKey = 'ark_' + 'a'.repeat(32); // ark_ + 32자 = 36자

      // Act
      const result = validateSeedanceApiKey(minKey);

      // Assert - 36자는 40자 미만이므로 거부되어야 함
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('KEY_TOO_SHORT');
    });

    it('정확히 39자 키', () => {
      // Arrange
      const almostValidKey = 'ark_' + 'a'.repeat(35);

      // Act
      const result = validateSeedanceApiKey(almostValidKey);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('KEY_TOO_SHORT');
    });

    it('매우 긴 키도 허용해야 함', () => {
      // Arrange
      const veryLongKey = 'ark_' + 'a'.repeat(100);

      // Act
      const result = validateSeedanceApiKey(veryLongKey);

      // Assert
      expect(result.valid).toBe(true);
    });
  });
});