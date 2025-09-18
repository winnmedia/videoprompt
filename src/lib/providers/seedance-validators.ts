/**
 * Seedance API 키 검증 및 Provider 선택 로직
 * TDD로 구현된 안전한 검증 시스템
 * 중앙화된 환경 시스템과 통합
 */

import { getAIApiKeys, getEnvironmentCapabilities, getDegradationMode } from '@/shared/config/env';

/**
 * BytePlus ModelArk API 키 형식 검증
 * @param key API 키
 * @returns 유효한 형식이면 true
 */
export function isValidSeedanceApiKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  try {
    // 매우 긴 키로 인한 메모리 문제 방지
    if (key.length > 1000) {
      console.warn('⚠️ API 키가 비정상적으로 깁니다:', key.length);
      return false;
    }

    // UUID 형식 키도 허용 (실제 API 키가 UUID 형식일 수 있음)
    // 단, 알려진 테스트 키는 여전히 차단

    // 하드코딩된 테스트 키 패턴 명시적 차단
    const blockedTestKeys = [
      '007f7ffe-84c3-4cdc-b0af-4e00dafdc81c',
      'test-key-',
      'mock-key-',
      'fake-key-',
      'demo-key-'
    ];

    for (const blockedKey of blockedTestKeys) {
      if (key.toLowerCase().includes(blockedKey.toLowerCase())) {
        console.warn('🚫 차단된 테스트 키 패턴이 감지되었습니다:', blockedKey);
        return false;
      }
    }

    // 최소 길이 검증
    if (key.length < 36) {
      return false;
    }

    // BytePlus ModelArk 공식 키 형식
    // 1. 'ark_' 접두사가 있는 경우 (공식 형식)
    if (key.startsWith('ark_')) {
      return true;
    }

    // 2. 길이가 50자 이상인 경우 (실제 API 키로 간주)
    if (key.length >= 50) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ API 키 검증 중 오류:', error);
    return false;
  }
}

/**
 * 환경변수에서 API 키 가져오기 (중앙화된 환경 시스템 사용)
 */
export function getApiKeyFromEnv(): string | null {
  // 중앙화된 환경 시스템 사용
  const apiKeys = getAIApiKeys();

  // 우선순위: SEEDANCE_API_KEY > MODELARK_API_KEY
  return apiKeys.seedance || apiKeys.modelark || null;
}

/**
 * Mock provider 사용 여부 결정
 * @returns Mock 사용해야 하면 true
 */
export function shouldUseMockProvider(): boolean {
  try {
    // 1. Mock 강제 비활성화 (프로덕션 시나리오 테스트용)
    if (process.env.FORCE_DISABLE_MOCK_API === 'true') {
      console.log('🚫 Mock API가 강제로 비활성화되었습니다 (프로덕션 시나리오 테스트)');
      return false;
    }

    // 2. 테스트 환경에서는 기본적으로 Mock 사용
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 테스트 환경에서는 기본적으로 Mock provider 사용');
      return true;
    }

    // 2. 명시적으로 Mock 활성화된 경우
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true') {
      console.log('🎭 Mock API가 명시적으로 활성화되었습니다');
      return true;
    }

    // 3. API 키 검증
    const apiKey = getApiKeyFromEnv();

    if (!apiKey || !isValidSeedanceApiKey(apiKey)) {
      const environment = process.env.NODE_ENV || 'development';

      if (environment === 'development') {
        console.warn('🔧 개발 환경에서 유효하지 않은 API 키 감지 - Mock provider 자동 활성화');
        console.warn('💡 실제 API 키를 사용하려면 SEEDANCE_API_KEY 환경변수를 설정하세요');
        return true;
      }

      // 프로덕션에서는 Mock 사용하지 않음 (에러 발생시킴)
      console.error('❌ 프로덕션 환경에서 유효하지 않은 API 키:', {
        hasKey: !!apiKey,
        keyFormat: apiKey ? `${apiKey.slice(0, 8)}...` : 'none',
        environment
      });
      return false;
    }

    // 4. 유효한 API 키가 있는 경우 실제 API 사용
    return false;
  } catch (error) {
    console.error('❌ Mock provider 결정 중 오류:', error);
    // 안전장치: 오류 발생 시 개발/테스트환경에서는 Mock 사용
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }
}

/**
 * API 키 상태 정보 반환 (중앙화된 환경 시스템과 통합)
 */
export function getApiKeyStatus() {
  const apiKey = getApiKeyFromEnv();
  const apiKeys = getAIApiKeys();
  const capabilities = getEnvironmentCapabilities();
  const degradationMode = getDegradationMode();
  const isValid = apiKey ? isValidSeedanceApiKey(apiKey) : false;
  const shouldUseMock = shouldUseMockProvider();

  return {
    hasApiKey: !!apiKey,
    keySource: apiKeys.seedance ? 'SEEDANCE_API_KEY' :
               apiKeys.modelark ? 'MODELARK_API_KEY' : 'none',
    keyFormat: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` : 'none',
    isValid,
    shouldUseMock,
    environment: process.env.NODE_ENV || 'development',
    mockExplicitlyEnabled: process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true',

    // 중앙화된 환경 시스템과의 통합 정보
    capabilities: {
      seedanceVideo: capabilities.seedanceVideo,
      degradationMode: degradationMode,
      canFallbackToMock: true
    },

    // 서비스 상태
    serviceStatus: {
      isHealthy: isValid || shouldUseMock,
      mode: shouldUseMock ? 'mock' : isValid ? 'real' : 'disabled',
      reliability: isValid ? 1.0 : shouldUseMock ? 0.8 : 0.0
    }
  };
}