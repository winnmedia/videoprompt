/**
 * Seedance 설정 가이드 및 환경 진단
 * 개발자와 운영자를 위한 설정 도움말
 */

import { getApiKeyStatus, isValidSeedanceApiKey } from './seedance-validators';
import { getCurrentEnvironment, type Environment } from './seedance-error-messages';

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'warning';
  actions: string[];
  helpUrl?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface EnvironmentConfig {
  name: string;
  description: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  setupSteps: SetupStep[];
  troubleshooting: {
    common_issues: Array<{
      issue: string;
      solution: string;
      helpUrl?: string;
    }>;
  };
}

/**
 * 환경별 설정 가이드
 */
export const environmentConfigs: Record<Environment, EnvironmentConfig> = {
  development: {
    name: '개발 환경',
    description: '로컬 개발을 위한 Seedance 설정입니다. Mock 모드를 사용하거나 실제 API 키로 테스트할 수 있습니다.',
    requiredEnvVars: [],
    optionalEnvVars: [
      'SEEDANCE_API_KEY',
      'MODELARK_API_KEY',
      'SEEDANCE_MODEL',
      'SEEDANCE_API_BASE',
      'NEXT_PUBLIC_ENABLE_MOCK_API'
    ],
    setupSteps: [
      {
        id: 'create_env_file',
        title: '.env.local 파일 생성',
        description: '프로젝트 루트에 환경변수 파일을 생성합니다.',
        status: 'pending',
        actions: [
          '프로젝트 루트에 .env.local 파일 생성',
          '다음 내용 추가: SEEDANCE_API_KEY=your_api_key_here',
          '또는 Mock 모드: NEXT_PUBLIC_ENABLE_MOCK_API=true'
        ],
        priority: 'medium'
      },
      {
        id: 'get_api_key',
        title: 'BytePlus API 키 발급',
        description: 'BytePlus ModelArk 콘솔에서 API 키를 발급받습니다.',
        status: 'pending',
        actions: [
          'https://console.volcengine.com 접속',
          'BytePlus ModelArk 서비스 활성화',
          'API 키 생성 및 복사',
          '.env.local에 SEEDANCE_API_KEY 설정'
        ],
        helpUrl: 'https://www.volcengine.com/docs/6348/74419',
        priority: 'low'
      },
      {
        id: 'test_connection',
        title: '연결 테스트',
        description: 'API 키가 올바르게 작동하는지 확인합니다.',
        status: 'pending',
        actions: [
          '개발 서버 재시작',
          '/api/seedance/create GET 요청으로 상태 확인',
          '설정이 잘못된 경우 자동으로 Mock 모드 사용'
        ],
        priority: 'high'
      }
    ],
    troubleshooting: {
      common_issues: [
        {
          issue: 'API 키를 설정했는데도 Mock 모드가 활성화됨',
          solution: 'API 키 형식을 확인하세요. ark_ 접두사가 있거나 50자 이상이어야 합니다.'
        },
        {
          issue: '네트워크 에러가 계속 발생함',
          solution: 'VPN 또는 방화벽 설정을 확인하고, 필요시 Mock 모드로 개발을 계속하세요.'
        },
        {
          issue: '환경변수가 인식되지 않음',
          solution: '개발 서버를 재시작하고 .env.local 파일 위치를 확인하세요.'
        }
      ]
    }
  },
  production: {
    name: '프로덕션 환경',
    description: '실제 서비스를 위한 Seedance 설정입니다. 반드시 유효한 API 키가 필요합니다.',
    requiredEnvVars: ['SEEDANCE_API_KEY'],
    optionalEnvVars: [
      'SEEDANCE_MODEL',
      'SEEDANCE_API_BASE'
    ],
    setupSteps: [
      {
        id: 'verify_api_key',
        title: 'API 키 검증',
        description: '프로덕션용 API 키가 올바르게 설정되어 있는지 확인합니다.',
        status: 'pending',
        actions: [
          'SEEDANCE_API_KEY 환경변수 설정',
          'API 키 형식 및 권한 확인',
          'BytePlus 콘솔에서 모델 활성화 상태 점검'
        ],
        priority: 'high'
      },
      {
        id: 'set_monitoring',
        title: '모니터링 설정',
        description: 'API 사용량 및 오류 모니터링을 설정합니다.',
        status: 'pending',
        actions: [
          'BytePlus 콘솔에서 사용량 알림 설정',
          'Sentry/DataDog 등 에러 모니터링 연동',
          'API 응답 시간 모니터링 설정'
        ],
        priority: 'high'
      },
      {
        id: 'test_production',
        title: '프로덕션 테스트',
        description: '실제 환경에서 API가 정상 작동하는지 확인합니다.',
        status: 'pending',
        actions: [
          'Health check API로 서비스 상태 확인',
          '작은 규모의 테스트 영상 생성',
          '응답 시간 및 품질 검증'
        ],
        priority: 'high'
      }
    ],
    troubleshooting: {
      common_issues: [
        {
          issue: 'API 할당량 초과 에러',
          solution: 'BytePlus 콘솔에서 즉시 할당량을 증가시키거나 사용량을 제한하세요.',
          helpUrl: 'https://console.volcengine.com/billing'
        },
        {
          issue: '모델 접근 권한 에러',
          solution: '계정에서 사용하려는 모델이 활성화되어 있는지 확인하세요.'
        },
        {
          issue: '간헐적인 연결 실패',
          solution: 'Circuit Breaker 패턴이 적용되어 자동으로 복구됩니다. 지속적인 문제는 지원팀에 문의하세요.'
        }
      ]
    }
  },
  test: {
    name: '테스트 환경',
    description: 'CI/CD 및 자동화 테스트를 위한 Seedance 설정입니다.',
    requiredEnvVars: [],
    optionalEnvVars: [
      'TEST_SEEDANCE_API_KEY',
      'NEXT_PUBLIC_ENABLE_MOCK_API'
    ],
    setupSteps: [
      {
        id: 'configure_mock',
        title: 'Mock 설정',
        description: '테스트 환경에서 Mock API를 사용하도록 설정합니다.',
        status: 'pending',
        actions: [
          'NEXT_PUBLIC_ENABLE_MOCK_API=true 설정',
          'MSW 핸들러가 올바르게 로드되는지 확인',
          '테스트 시나리오에 맞는 Mock 데이터 준비'
        ],
        priority: 'high'
      },
      {
        id: 'setup_ci',
        title: 'CI/CD 환경변수',
        description: 'GitHub Actions, Jenkins 등에서 환경변수를 설정합니다.',
        status: 'pending',
        actions: [
          'CI 환경에 NEXT_PUBLIC_ENABLE_MOCK_API=true 추가',
          '선택적으로 테스트용 API 키 설정',
          '테스트 실행 시 Mock 모드 확인'
        ],
        priority: 'medium'
      },
      {
        id: 'verify_isolation',
        title: '테스트 격리 확인',
        description: '테스트가 실제 API에 의존하지 않는지 확인합니다.',
        status: 'pending',
        actions: [
          '네트워크 차단 상태에서 테스트 실행',
          'Mock 응답이 예상대로 작동하는지 확인',
          '테스트 간 상태 격리 검증'
        ],
        priority: 'high'
      }
    ],
    troubleshooting: {
      common_issues: [
        {
          issue: 'Mock 응답이 실제 API와 다름',
          solution: 'MSW 핸들러를 최신 API 스펙에 맞게 업데이트하세요.'
        },
        {
          issue: '테스트가 간헐적으로 실패함',
          solution: '테스트 간 Mock 데이터베이스가 올바르게 리셋되는지 확인하세요.'
        },
        {
          issue: 'CI에서만 테스트가 실패함',
          solution: 'CI 환경변수 설정과 타임아웃 설정을 확인하세요.'
        }
      ]
    }
  }
};

/**
 * 현재 환경의 설정 상태 진단
 */
export function diagnoseCurrentSetup(): {
  environment: Environment;
  config: EnvironmentConfig;
  steps: SetupStep[];
  overallStatus: 'healthy' | 'warning' | 'error';
  recommendations: string[];
} {
  const environment = getCurrentEnvironment();
  const config = environmentConfigs[environment];
  const apiKeyStatus = getApiKeyStatus();

  // 설정 단계별 상태 확인
  const steps = config.setupSteps.map(step => {
    const updatedStep = { ...step };

    switch (step.id) {
      case 'create_env_file':
      case 'configure_mock':
        updatedStep.status = 'completed'; // 앱이 실행되고 있으면 환경변수는 설정됨
        break;

      case 'get_api_key':
      case 'verify_api_key':
        if (apiKeyStatus.hasApiKey && apiKeyStatus.isValid) {
          updatedStep.status = 'completed';
        } else if (apiKeyStatus.hasApiKey && !apiKeyStatus.isValid) {
          updatedStep.status = 'failed';
        } else if (environment === 'development') {
          updatedStep.status = 'warning'; // 개발환경에서는 선택사항
        } else {
          updatedStep.status = 'failed';
        }
        break;

      case 'test_connection':
      case 'test_production':
      case 'verify_isolation':
        if (apiKeyStatus.shouldUseMock || (apiKeyStatus.hasApiKey && apiKeyStatus.isValid)) {
          updatedStep.status = 'completed';
        } else {
          updatedStep.status = 'pending';
        }
        break;

      default:
        updatedStep.status = 'pending';
    }

    return updatedStep;
  });

  // 전체 상태 결정
  const failedSteps = steps.filter(s => s.status === 'failed');
  const warningSteps = steps.filter(s => s.status === 'warning');

  let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';
  if (failedSteps.length > 0 && environment === 'production') {
    overallStatus = 'error';
  } else if (failedSteps.length > 0 || warningSteps.length > 0) {
    overallStatus = 'warning';
  }

  // 추천사항 생성
  const recommendations: string[] = [];

  if (!apiKeyStatus.hasApiKey && environment === 'production') {
    recommendations.push('🚨 프로덕션 환경에서 API 키가 필요합니다. 즉시 설정하세요.');
  }

  if (apiKeyStatus.hasApiKey && !apiKeyStatus.isValid) {
    recommendations.push('⚠️ API 키 형식이 올바르지 않습니다. BytePlus 콘솔에서 새 키를 발급받으세요.');
  }

  if (apiKeyStatus.shouldUseMock && environment !== 'test') {
    if (environment === 'development') {
      recommendations.push('💡 현재 Mock 모드입니다. 실제 API를 테스트하려면 유효한 API 키를 설정하세요.');
    } else {
      recommendations.push('🚨 프로덕션에서 Mock 모드는 권장하지 않습니다.');
    }
  }

  if (environment === 'production' && overallStatus === 'healthy') {
    recommendations.push('✅ 모든 설정이 완료되었습니다. 모니터링을 활성화하는 것을 권장합니다.');
  }

  return {
    environment,
    config,
    steps,
    overallStatus,
    recommendations
  };
}

/**
 * 설정 상태 요약 정보
 */
export function getSetupSummary() {
  const diagnosis = diagnoseCurrentSetup();
  const apiKeyStatus = getApiKeyStatus();

  return {
    environment: diagnosis.environment,
    status: diagnosis.overallStatus,
    mode: apiKeyStatus.shouldUseMock ? 'mock' : 'real',
    apiKey: {
      configured: apiKeyStatus.hasApiKey,
      valid: apiKeyStatus.isValid,
      source: apiKeyStatus.keySource,
    },
    completedSteps: diagnosis.steps.filter(s => s.status === 'completed').length,
    totalSteps: diagnosis.steps.length,
    criticalIssues: diagnosis.steps.filter(s => s.status === 'failed' && s.priority === 'high').length,
    recommendations: diagnosis.recommendations,
  };
}