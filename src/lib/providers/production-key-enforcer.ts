/**
 * 프로덕션 환경 실제 키 강제 검증 시스템
 * 프로덕션에서 Mock API 사용을 방지하고 실제 API 키 검증을 강제
 */

import { isValidSeedanceApiKey, getApiKeyFromEnv } from './seedance-validators';

/**
 * 프로덕션 키 검증 결과
 */
export interface ProductionKeyValidationResult {
  isValid: boolean;
  environment: string;
  keySource: string;
  enforced: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * 프로덕션 키 검증 설정
 */
export interface ProductionKeyEnforcementConfig {
  strictMode: boolean; // 엄격 모드: 프로덕션에서 무효한 키 시 앱 중단
  allowedEnvironments: string[]; // Mock 허용 환경들
  requiredKeyPatterns: string[]; // 프로덕션에서 요구되는 키 패턴
  logLevel: 'silent' | 'warn' | 'error';
}

// 기본 설정
const DEFAULT_CONFIG: ProductionKeyEnforcementConfig = {
  strictMode: true,
  allowedEnvironments: ['development', 'test'],
  requiredKeyPatterns: ['ark_'], // BytePlus 공식 키 패턴만 허용
  logLevel: 'error',
};

/**
 * 프로덕션 환경 키 검증 강제 실행
 */
export function enforceProductionKeyValidation(
  config: Partial<ProductionKeyEnforcementConfig> = {}
): ProductionKeyValidationResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const environment = process.env.NODE_ENV || 'development';
  const apiKey = getApiKeyFromEnv();

  const result: ProductionKeyValidationResult = {
    isValid: false,
    environment,
    keySource: process.env.SEEDANCE_API_KEY ? 'SEEDANCE_API_KEY' :
               process.env.MODELARK_API_KEY ? 'MODELARK_API_KEY' : 'none',
    enforced: false,
    errors: [],
    warnings: [],
    recommendations: [],
  };

  // 1. 환경 검증
  const isProductionEnvironment = environment === 'production';
  const isMockAllowedEnvironment = finalConfig.allowedEnvironments.includes(environment);

  if (finalConfig.logLevel !== 'silent') {
    console.log(`🔍 프로덕션 키 검증 시작 (환경: ${environment})`);
  }

  // 2. 프로덕션이 아닌 환경에서는 경고만
  if (!isProductionEnvironment) {
    if (isMockAllowedEnvironment) {
      result.warnings.push(`${environment} 환경에서는 Mock API 사용이 허용됩니다`);
      result.isValid = true; // 개발/테스트 환경에서는 통과
      return result;
    } else {
      result.warnings.push(`${environment} 환경은 Mock이 허용되지 않는 환경으로 설정되었습니다`);
    }
  }

  // 3. API 키 존재 여부 검증
  if (!apiKey) {
    const error = `❌ ${isProductionEnvironment ? '프로덕션' : environment} 환경에서 API 키가 설정되지 않았습니다`;
    result.errors.push(error);
    result.recommendations.push('SEEDANCE_API_KEY 또는 MODELARK_API_KEY 환경변수를 설정하세요');

    if (finalConfig.logLevel === 'error') {
      console.error(error);
    }

    if (isProductionEnvironment && finalConfig.strictMode) {
      result.enforced = true;
      throw new Error(`🚨 프로덕션 키 검증 실패: ${error}`);
    }

    return result;
  }

  // 4. API 키 형식 검증
  const isValidFormat = isValidSeedanceApiKey(apiKey);

  if (!isValidFormat) {
    const error = `❌ ${isProductionEnvironment ? '프로덕션' : environment} 환경에서 API 키 형식이 올바르지 않습니다`;
    result.errors.push(error);
    result.recommendations.push('BytePlus ModelArk에서 유효한 API 키를 발급받아 설정하세요');

    if (finalConfig.logLevel === 'error') {
      console.error(error, {
        keyFormat: `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}`,
        keyLength: apiKey.length,
      });
    }

    if (isProductionEnvironment && finalConfig.strictMode) {
      result.enforced = true;
      throw new Error(`🚨 프로덕션 키 검증 실패: ${error}`);
    }

    return result;
  }

  // 5. 프로덕션 환경에서 추가 패턴 검증
  if (isProductionEnvironment && finalConfig.requiredKeyPatterns.length > 0) {
    const matchesRequiredPattern = finalConfig.requiredKeyPatterns.some(pattern =>
      apiKey.startsWith(pattern)
    );

    if (!matchesRequiredPattern) {
      const error = `❌ 프로덕션 환경에서 요구되는 키 패턴(${finalConfig.requiredKeyPatterns.join(', ')})과 일치하지 않습니다`;
      result.errors.push(error);
      result.recommendations.push('BytePlus 공식 API 키(ark_ 접두사)를 사용하세요');

      if (finalConfig.logLevel === 'error') {
        console.error(error);
      }

      if (finalConfig.strictMode) {
        result.enforced = true;
        throw new Error(`🚨 프로덕션 키 검증 실패: ${error}`);
      }

      return result;
    }
  }

  // 6. 검증 성공
  result.isValid = true;

  if (finalConfig.logLevel !== 'silent') {
    console.log(`✅ ${isProductionEnvironment ? '프로덕션' : environment} 환경 키 검증 성공`);
  }

  if (isProductionEnvironment) {
    result.recommendations.push('프로덕션 환경에서 실제 API 키 사용 중');
  }

  return result;
}

/**
 * 애플리케이션 시작 시 키 검증 실행
 */
export function validateKeysOnStartup(): void {
  try {
    const result = enforceProductionKeyValidation({
      logLevel: 'error',
    });

    // 경고사항 출력
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
    }

    // 권장사항 출력
    if (result.recommendations.length > 0 && process.env.NODE_ENV === 'development') {
      console.log('\n💡 권장사항:');
      result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

  } catch (error) {
    console.error('🚨 애플리케이션 시작 중 키 검증 실패:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 프로덕션 환경에서 무효한 API 키로 인해 앱이 종료됩니다');
      process.exit(1); // 프로덕션에서는 앱 종료
    }
  }
}

/**
 * 런타임 키 검증 (API 호출 전)
 */
export function validateKeyBeforeApiCall(): boolean {
  try {
    const result = enforceProductionKeyValidation({
      strictMode: false, // 런타임에서는 덜 엄격
      logLevel: 'warn',
    });

    return result.isValid;
  } catch (error) {
    console.error('❌ 런타임 키 검증 실패:', error);
    return false;
  }
}

/**
 * Mock API 사용 금지 체크 (프로덕션 전용)
 */
export function checkMockApiProhibition(): void {
  const environment = process.env.NODE_ENV;

  if (environment === 'production') {
    // 프로덕션에서 Mock API 명시적 활성화 감지
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true') {
      const error = '🚨 프로덕션 환경에서 Mock API가 명시적으로 활성화되어 있습니다';
      console.error(error);
      throw new Error(error);
    }

    // 프로덕션에서 Mock 관련 환경변수 감지
    const mockRelatedVars = Object.keys(process.env).filter(key =>
      key.toLowerCase().includes('mock') ||
      key.toLowerCase().includes('test') ||
      key.toLowerCase().includes('fake')
    ).filter(key => key !== 'NODE_ENV'); // NODE_ENV는 제외

    if (mockRelatedVars.length > 0) {
      console.warn('⚠️ 프로덕션 환경에서 Mock 관련 환경변수가 감지되었습니다:', mockRelatedVars);
    }
  }
}

/**
 * 환경별 설정 검증
 */
export function validateEnvironmentConfiguration(): void {
  const environment = process.env.NODE_ENV || 'development';

  switch (environment) {
    case 'production':
      // 프로덕션: 실제 키 필수
      enforceProductionKeyValidation({
        strictMode: true,
        allowedEnvironments: [],
        requiredKeyPatterns: ['ark_'],
        logLevel: 'error',
      });
      checkMockApiProhibition();
      break;

    case 'staging':
    case 'preview':
      // 스테이징: 실제 키 권장, Mock 허용
      enforceProductionKeyValidation({
        strictMode: false,
        allowedEnvironments: ['staging', 'preview'],
        requiredKeyPatterns: ['ark_'],
        logLevel: 'warn',
      });
      break;

    case 'development':
    case 'test':
    default:
      // 개발/테스트: Mock 허용
      enforceProductionKeyValidation({
        strictMode: false,
        allowedEnvironments: ['development', 'test'],
        requiredKeyPatterns: [],
        logLevel: 'warn',
      });
      break;
  }
}

/**
 * 키 검증 상태 리포트 생성
 */
export function generateKeyValidationReport(): object {
  const result = enforceProductionKeyValidation({
    strictMode: false,
    logLevel: 'silent',
  });

  const apiKey = getApiKeyFromEnv();

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    validation: {
      isValid: result.isValid,
      keySource: result.keySource,
      hasKey: !!apiKey,
      keyFormat: apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` : 'none',
      keyLength: apiKey?.length || 0,
    },
    enforcements: {
      enforced: result.enforced,
      strictMode: result.environment === 'production',
      mockProhibited: result.environment === 'production',
    },
    issues: {
      errors: result.errors,
      warnings: result.warnings,
      recommendations: result.recommendations,
    },
    checks: {
      mockApiExplicitlyEnabled: process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true',
      requiredKeyPattern: result.environment === 'production' ? 'ark_' : 'any',
      passesValidation: result.isValid && result.errors.length === 0,
    },
  };
}