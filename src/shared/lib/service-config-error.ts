/**
 * ServiceConfigError - 도메인 중심 서비스 설정 에러 처리
 *
 * 설계 원칙:
 * 1. 타입 안전성: 모든 에러는 명확한 계약을 가짐
 * 2. 환경별 대응: 개발/프로덕션 환경에 맞는 가이드 제공
 * 3. 사용자 친화성: 기술적 세부사항을 숨기고 해결방법 제시
 * 4. 계약 기반: OpenAPI 스펙과 일관된 에러 형식
 */

/**
 * 서비스 설정 에러 정보
 */
export interface EnvironmentSetupGuide {
  environment: 'development' | 'production' | 'test';
  steps: string[];
  setupMethods: {
    local?: LocalSetupMethod;
    vercel?: VercelSetupMethod;
    railway?: RailwaySetupMethod;
  };
  troubleshooting: Record<string, string>;
  helpUrl: string;
  supportContact?: string;
}

export interface LocalSetupMethod {
  title: string;
  description: string;
  commands: string[];
  files: {
    path: string;
    content: string;
  }[];
  verification: string[];
}

export interface VercelSetupMethod {
  title: string;
  description: string;
  steps: string[];
  environmentVariables: {
    name: string;
    value: string;
    environments: ('production' | 'preview' | 'development')[];
  }[];
  deploymentSteps: string[];
}

export interface RailwaySetupMethod {
  title: string;
  description: string;
  steps: string[];
  environmentVariables: {
    name: string;
    value: string;
  }[];
  deploymentNote: string;
}

/**
 * API 키 분석 정보
 */
export interface KeyAnalysis {
  providedKey: string; // 마스킹된 키
  expectedFormat: string;
  currentLength: number;
  minimumLength: number;
  hasValidPrefix: boolean;
  isTestKey: boolean;
  validationErrors: string[];
}

/**
 * Seedance 설정 검증 결과
 */
export interface SeedanceConfigValidationResult {
  provider: 'mock' | 'seedance';
  ready: boolean;
  environment: string;
  keyStatus?: {
    valid: boolean;
    source: string;
    format: string;
  };
}

/**
 * 서비스 설정 에러 클래스
 *
 * 도메인 규칙:
 * - HTTP 상태 코드는 4xx 또는 5xx만 허용
 * - 에러 코드는 서비스_상황 패턴 (예: SEEDANCE_NOT_CONFIGURED)
 * - 메시지는 사용자 친화적이어야 함
 */
export class ServiceConfigError extends Error {
  public readonly httpStatus: number;
  public readonly errorCode: string;
  public readonly setupGuide?: EnvironmentSetupGuide;
  public readonly keyAnalysis?: KeyAnalysis;

  constructor(
    httpStatus: number,
    message: string,
    errorCode: string,
    setupGuide?: EnvironmentSetupGuide,
    keyAnalysis?: KeyAnalysis
  ) {
    super(message);

    // 도메인 불변 조건 검증
    if (httpStatus < 400 || httpStatus >= 600) {
      throw new Error('HTTP 상태 코드는 4xx 또는 5xx여야 합니다');
    }

    if (!errorCode || errorCode.trim().length === 0) {
      throw new Error('에러 코드는 필수입니다');
    }

    this.name = 'ServiceConfigError';
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
    this.setupGuide = setupGuide;
    this.keyAnalysis = keyAnalysis;

    // Error.captureStackTrace 사용 (Node.js 환경에서만)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ServiceConfigError);
    }
  }

  /**
   * JSON 직렬화 지원
   */
  toJSON() {
    return {
      name: this.name,
      httpStatus: this.httpStatus,
      errorCode: this.errorCode,
      message: this.message,
      setupGuide: this.setupGuide,
      keyAnalysis: this.keyAnalysis,
      stack: this.stack
    };
  }
}

/**
 * ServiceConfigError 팩토리 함수들
 * 계약 기반으로 일관된 에러 생성
 */
export const createServiceConfigError = {
  /**
   * SEEDANCE_NOT_CONFIGURED: API 키가 설정되지 않은 경우
   */
  seedanceNotConfigured(): ServiceConfigError {
    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';

    const setupGuide: EnvironmentSetupGuide = {
      environment,
      steps: environment === 'development'
        ? ['local', 'verification']
        : ['key_acquisition', 'platform_setup', 'verification'],
      setupMethods: {
        local: environment === 'development' ? {
          title: '🔧 로컬 개발 환경 설정',
          description: '개발 환경에서 SEEDANCE_API_KEY 설정',
          commands: [
            'touch .env.local',
            'echo "SEEDANCE_API_KEY=ark_your_api_key_here" >> .env.local',
            'npm run dev'
          ],
          files: [
            {
              path: '.env.local',
              content: 'SEEDANCE_API_KEY=<YOUR_API_KEY_HERE>\n# 또는 개발용 Mock 키\nSEEDANCE_API_KEY=mock_development_key_40_characters_long_for_testing'
            }
          ],
          verification: [
            'GET /api/seedance/create로 상태 확인',
            'configuration.hasApiKey: true 확인',
            'Mock 모드 또는 실제 API 연결 확인'
          ]
        } : undefined,
        vercel: environment === 'production' ? {
          title: '☁️ Vercel 환경변수 설정',
          description: 'Vercel 대시보드에서 환경변수 설정',
          steps: [
            'Vercel 대시보드에서 프로젝트 선택',
            'Settings → Environment Variables로 이동',
            '환경변수 추가 및 배포'
          ],
          environmentVariables: [
            {
              name: 'SEEDANCE_API_KEY',
              value: '<YOUR_API_KEY_HERE>',
              environments: ['production', 'preview', 'development']
            }
          ],
          deploymentSteps: [
            'Save 버튼 클릭',
            'Deployments 탭으로 이동',
            'Redeploy 실행'
          ]
        } : undefined,
        railway: environment === 'production' ? {
          title: '🚂 Railway 환경변수 설정',
          description: 'Railway 대시보드에서 환경변수 설정',
          steps: [
            'Railway 대시보드에서 프로젝트 선택',
            'Variables 탭 클릭',
            '환경변수 추가'
          ],
          environmentVariables: [
            {
              name: 'SEEDANCE_API_KEY',
              value: '<YOUR_API_KEY_HERE>'
            }
          ],
          deploymentNote: 'Railway는 환경변수 변경 시 자동으로 재배포됩니다.'
        } : undefined
      },
      troubleshooting: {
        'env_not_loaded': '환경변수가 로드되지 않는 경우 서버 재시작 필요',
        'vercel_not_applied': 'Vercel에서 환경변수 설정 후 재배포 필요',
        'railway_sync_delay': 'Railway 환경변수 동기화에 1-2분 소요될 수 있음'
      },
      helpUrl: 'https://docs.bytedance.com/modelark/api',
      supportContact: 'BytePlus 고객지원: https://www.volcengine.com/support'
    };

    return new ServiceConfigError(
      503,
      'SEEDANCE_API_KEY 환경변수가 설정되지 않았습니다',
      'SEEDANCE_NOT_CONFIGURED',
      setupGuide
    );
  },

  /**
   * SEEDANCE_INVALID_KEY: API 키 형식이 잘못된 경우
   */
  seedanceInvalidKey(providedKey: string): ServiceConfigError {
    const keyAnalysis: KeyAnalysis = {
      providedKey: providedKey.substring(0, Math.min(providedKey.length, 5)) + '...',
      expectedFormat: 'ark_*',
      currentLength: providedKey.length,
      minimumLength: 36,
      hasValidPrefix: providedKey.startsWith('ark_'),
      isTestKey: providedKey.toLowerCase().includes('test') ||
                providedKey.toLowerCase().includes('demo') ||
                providedKey.toLowerCase().includes('mock'),
      validationErrors: [
        !providedKey.startsWith('ark_') ? 'ark_ 접두사 누락' : null,
        providedKey.length < 36 ? '키 길이 부족' : null
      ].filter(Boolean) as string[]
    };

    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';

    const setupGuide: EnvironmentSetupGuide = {
      environment,
      steps: ['key_verification', 'key_replacement'],
      setupMethods: {},
      troubleshooting: {
        'invalid_format': 'BytePlus ModelArk에서 발급받은 정확한 키는 "ark_"로 시작합니다',
        'copy_paste_error': '복사/붙여넣기 시 공백이나 특수문자가 포함되지 않았는지 확인하세요',
        'old_key_format': '이전 형식의 키를 사용 중이라면 새 키를 발급받아야 합니다'
      },
      helpUrl: 'https://console.volcengine.com/ark'
    };

    return new ServiceConfigError(
      503,
      'Seedance API 키 형식이 올바르지 않습니다 (ark_로 시작해야 함)',
      'SEEDANCE_INVALID_KEY',
      setupGuide,
      keyAnalysis
    );
  },

  /**
   * SEEDANCE_KEY_TOO_SHORT: API 키가 너무 짧은 경우
   */
  seedanceKeyTooShort(providedKey: string): ServiceConfigError {
    const keyAnalysis: KeyAnalysis = {
      providedKey: providedKey.substring(0, 8) + '...',
      expectedFormat: 'ark_ + 36자리 이상',
      currentLength: providedKey.length,
      minimumLength: 36,
      hasValidPrefix: providedKey.startsWith('ark_'),
      isTestKey: true, // 짧은 키는 대부분 테스트 키
      validationErrors: ['키 길이 부족 (최소 36자 필요)']
    };

    const environment = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';

    const setupGuide: EnvironmentSetupGuide = {
      environment,
      steps: ['key_verification', 'production_key_acquisition'],
      setupMethods: {},
      troubleshooting: {
        'test_key_detected': '현재 키는 테스트용으로 보입니다. 프로덕션용 키가 필요합니다',
        'incomplete_key': '키가 완전히 복사되지 않았을 수 있습니다. 전체 키를 다시 복사해보세요',
        'development_mock': '개발 환경에서는 mock_development_key_40_characters_long_for_testing을 사용할 수 있습니다'
      },
      helpUrl: 'https://console.volcengine.com/ark'
    };

    return new ServiceConfigError(
      503,
      'Seedance API 키가 너무 짧습니다 (최소 36자 필요)',
      'SEEDANCE_KEY_TOO_SHORT',
      setupGuide,
      keyAnalysis
    );
  }
};

/**
 * Seedance 설정 검증 함수
 *
 * 도메인 규칙:
 * 1. API 키 없음 → SEEDANCE_NOT_CONFIGURED 에러
 * 2. 개발 환경 + Mock 키 → Mock Provider 사용
 * 3. 프로덕션 환경 + 잘못된 키 → 적절한 에러 던지기
 * 4. 유효한 키 → Real Provider 사용
 */
export function validateSeedanceConfig(): SeedanceConfigValidationResult {
  const apiKey = process.env.SEEDANCE_API_KEY;
  const environment = process.env.NODE_ENV || 'development';

  // 1. API 키 존재 여부 확인
  if (!apiKey) {
    throw createServiceConfigError.seedanceNotConfigured();
  }

  // 2. 개발/테스트 환경에서 Mock 키 허용
  if (environment === 'development' || environment === 'test') {
    const mockKey = 'mock_development_key_40_characters_long_for_testing';
    if (apiKey === mockKey) {
      return {
        provider: 'mock',
        ready: true,
        environment,
        keyStatus: {
          valid: true,
          source: 'SEEDANCE_API_KEY',
          format: 'mock_development_key'
        }
      };
    }
  }

  // 3. 프로덕션 환경에서 실제 키 검증
  if (!apiKey.startsWith('ark_')) {
    throw createServiceConfigError.seedanceInvalidKey(apiKey);
  }

  if (apiKey.length < 36) {
    throw createServiceConfigError.seedanceKeyTooShort(apiKey);
  }

  // 4. 유효한 키인 경우
  return {
    provider: 'seedance',
    ready: true,
    environment,
    keyStatus: {
      valid: true,
      source: 'SEEDANCE_API_KEY',
      format: 'ark_production_key'
    }
  };
}