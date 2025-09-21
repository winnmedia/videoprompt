/**
 * Seedance 환경별 에러 메시지 및 설정 가이드
 * 사용자와 개발자를 위한 명확한 안내 제공
 */

export type Environment = 'development' | 'production' | 'test';
export type ErrorContext = 'api_key' | 'network' | 'quota' | 'model' | 'validation' | 'unknown';

export interface ErrorDetails {
  userMessage: string;        // 사용자용 메시지
  developerMessage: string;   // 개발자용 상세 메시지
  actionRequired: string[];   // 필요한 조치사항
  helpUrl?: string;          // 도움말 URL
  estimatedFixTime?: string; // 예상 해결 시간
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 환경별 에러 메시지 매트릭스
 */
export const errorMessageMatrix: Record<Environment, Record<ErrorContext, ErrorDetails>> = {
  development: {
    api_key: {
      userMessage: '개발 환경에서 API 키가 설정되지 않았습니다. Mock 모드로 자동 전환되었습니다.',
      developerMessage: 'SEEDANCE_API_KEY 환경변수가 없거나 유효하지 않습니다. 개발 중에는 Mock 모드가 자동으로 활성화됩니다.',
      actionRequired: [
        '실제 API를 테스트하려면 .env.local에 SEEDANCE_API_KEY=ark_your_key_here 추가',
        'BytePlus ModelArk 콘솔에서 API 키 발급받기',
        'Mock 모드로 계속 개발하려면 아무 조치 불필요'
      ],
      helpUrl: 'https://www.volcengine.com/docs/6348/74419',
      estimatedFixTime: '5-10분 (API 키 발급 시간 포함)',
      severity: 'low'
    },
    network: {
      userMessage: '네트워크 연결에 문제가 있습니다. Mock 모드로 전환되었습니다.',
      developerMessage: 'BytePlus API 서버에 연결할 수 없습니다. 개발 환경에서는 자동으로 Mock 모드로 폴백됩니다.',
      actionRequired: [
        '인터넷 연결 상태 확인',
        'VPN 또는 방화벽 설정 확인',
        'Mock 모드로 계속 개발 가능'
      ],
      estimatedFixTime: '1-5분',
      severity: 'low'
    },
    quota: {
      userMessage: 'API 사용량이 한도를 초과했습니다. Mock 모드로 전환되었습니다.',
      developerMessage: 'BytePlus API 할당량이 소진되었습니다. 개발 중에는 Mock 모드를 사용하여 계속 작업할 수 있습니다.',
      actionRequired: [
        'BytePlus 콘솔에서 사용량 확인',
        '필요시 할당량 증가 요청',
        'Mock 모드로 기능 개발 계속'
      ],
      helpUrl: 'https://console.volcengine.com/billing',
      estimatedFixTime: '1-2시간 (할당량 리셋 대기)',
      severity: 'medium'
    },
    model: {
      userMessage: '선택한 모델이 활성화되지 않았습니다. 기본 모델로 전환되었습니다.',
      developerMessage: '요청한 모델이 계정에서 활성화되지 않았습니다. 기본 모델을 사용하거나 Mock 모드로 전환됩니다.',
      actionRequired: [
        'BytePlus 콘솔에서 모델 활성화',
        '지원되는 모델 목록 확인',
        'Mock 모드로 UI 개발 계속'
      ],
      estimatedFixTime: '10-30분',
      severity: 'medium'
    },
    validation: {
      userMessage: '입력 데이터에 문제가 있습니다. 요청을 확인해주세요.',
      developerMessage: 'API 요청 파라미터가 BytePlus 스펙에 맞지 않습니다.',
      actionRequired: [
        '프롬프트 길이 및 형식 확인',
        '지원되는 aspect_ratio 값 확인',
        'duration_seconds 범위 확인 (1-30초)'
      ],
      estimatedFixTime: '5분',
      severity: 'low'
    },
    unknown: {
      userMessage: '예상치 못한 오류가 발생했습니다. Mock 모드로 전환되었습니다.',
      developerMessage: '알 수 없는 오류가 발생했습니다. 로그를 확인하고 필요시 이슈를 보고해주세요.',
      actionRequired: [
        '브라우저 콘솔 및 서버 로그 확인',
        '요청 파라미터 재검토',
        'Mock 모드로 임시 우회'
      ],
      estimatedFixTime: '변수 (디버깅 필요)',
      severity: 'medium'
    }
  },
  production: {
    api_key: {
      userMessage: '영상 생성 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      developerMessage: '프로덕션 환경에서 SEEDANCE_API_KEY가 설정되지 않았거나 유효하지 않습니다. 즉시 조치가 필요합니다.',
      actionRequired: [
        '즉시 운영팀에 알림',
        'Vercel 환경변수에 SEEDANCE_API_KEY 설정',
        'API 키 유효성 및 권한 확인',
        '모니터링 시스템 알림 설정'
      ],
      helpUrl: 'https://vercel.com/docs/concepts/projects/environment-variables',
      estimatedFixTime: '15-30분 (긴급 배포 필요)',
      severity: 'critical'
    },
    network: {
      userMessage: '영상 생성 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      developerMessage: 'BytePlus API 서버에 연결할 수 없습니다. 네트워크 또는 서비스 상태를 확인해야 합니다.',
      actionRequired: [
        'BytePlus 서비스 상태 페이지 확인',
        'CDN 및 프록시 설정 점검',
        '사용자에게 일시적 장애 안내',
        '복구 시간 모니터링'
      ],
      helpUrl: 'https://status.volcengine.com',
      estimatedFixTime: '5-60분 (외부 서비스 의존)',
      severity: 'high'
    },
    quota: {
      userMessage: '현재 서비스 사용량이 많습니다. 잠시 후 다시 시도해주세요.',
      developerMessage: 'API 할당량이 소진되었습니다. 즉시 할당량 증가 또는 사용량 관리가 필요합니다.',
      actionRequired: [
        '즉시 BytePlus 콘솔에서 할당량 확인',
        '긴급 할당량 증가 요청',
        'Rate limiting 구현',
        '사용량 알림 시스템 강화'
      ],
      estimatedFixTime: '1-4시간 (계정 승인 필요)',
      severity: 'high'
    },
    model: {
      userMessage: '영상 생성에 문제가 발생했습니다. 고객지원팀에 문의해주세요.',
      developerMessage: '모델이 비활성화되었거나 접근 권한이 없습니다. 계정 설정을 확인해야 합니다.',
      actionRequired: [
        'BytePlus 계정 상태 확인',
        '모델 라이선스 및 권한 점검',
        '백업 모델로 자동 전환 고려',
        '고객지원팀 에스컬레이션'
      ],
      estimatedFixTime: '2-8시간 (지원팀 응답 시간)',
      severity: 'high'
    },
    validation: {
      userMessage: '입력한 정보에 문제가 있습니다. 다시 확인해주세요.',
      developerMessage: '클라이언트에서 잘못된 데이터가 전송되었습니다. 입력 검증 로직을 강화해야 합니다.',
      actionRequired: [
        '클라이언트 측 검증 로직 점검',
        'API 스펙 변경사항 확인',
        '에러 로그 패턴 분석',
        '사용자 입력 가이드 개선'
      ],
      estimatedFixTime: '1-2시간 (핫픽스 배포)',
      severity: 'medium'
    },
    unknown: {
      userMessage: '일시적인 서비스 오류가 발생했습니다. 계속 문제가 지속되면 고객지원팀에 문의해주세요.',
      developerMessage: '예상치 못한 오류가 발생했습니다. 즉시 조사 및 모니터링 강화가 필요합니다.',
      actionRequired: [
        '즉시 에러 로그 및 스택 트레이스 수집',
        '모니터링 대시보드 확인',
        'Sentry/DataDog 알림 점검',
        '필요시 서비스 롤백 고려'
      ],
      estimatedFixTime: '30분-4시간 (원인 조사 필요)',
      severity: 'high'
    }
  },
  test: {
    api_key: {
      userMessage: '테스트 환경에서 API 키 문제가 발생했습니다.',
      developerMessage: '테스트 환경에서 유효하지 않은 API 키가 감지되었습니다. Mock 모드로 전환됩니다.',
      actionRequired: [
        'TEST_SEEDANCE_API_KEY 환경변수 확인',
        'CI/CD 환경변수 설정 점검',
        'Mock 데이터로 테스트 계속'
      ],
      estimatedFixTime: '5-10분',
      severity: 'low'
    },
    network: {
      userMessage: '테스트 환경에서 네트워크 문제가 발생했습니다.',
      developerMessage: '테스트 환경에서 외부 API 호출이 실패했습니다. Mock 서버를 사용하여 테스트를 계속합니다.',
      actionRequired: [
        'MSW 핸들러 확인',
        '테스트 격리 상태 점검',
        'Mock 응답 데이터 업데이트'
      ],
      estimatedFixTime: '즉시 (Mock으로 우회)',
      severity: 'low'
    },
    quota: {
      userMessage: '테스트 환경에서 할당량 문제가 발생했습니다.',
      developerMessage: '테스트용 API 할당량이 소진되었습니다. Mock 모드로 전환됩니다.',
      actionRequired: [
        '테스트용 API 키 할당량 확인',
        '테스트 빈도 조정',
        'Mock 테스트로 대체'
      ],
      estimatedFixTime: '즉시 (Mock으로 우회)',
      severity: 'low'
    },
    model: {
      userMessage: '테스트 환경에서 모델 문제가 발생했습니다.',
      developerMessage: '테스트 환경에서 모델 접근 권한 문제가 발생했습니다.',
      actionRequired: [
        '테스트용 모델 권한 확인',
        'Mock 모델 응답 사용',
        '테스트 시나리오 재검토'
      ],
      estimatedFixTime: '즉시 (Mock으로 우회)',
      severity: 'low'
    },
    validation: {
      userMessage: '테스트 데이터 검증 오류가 발생했습니다.',
      developerMessage: '테스트 케이스의 입력 데이터가 유효하지 않습니다.',
      actionRequired: [
        '테스트 케이스 데이터 검토',
        '검증 로직 확인',
        '테스트 시나리오 수정'
      ],
      estimatedFixTime: '5-15분',
      severity: 'low'
    },
    unknown: {
      userMessage: '테스트 환경에서 알 수 없는 오류가 발생했습니다.',
      developerMessage: '테스트 실행 중 예상치 못한 오류가 발생했습니다.',
      actionRequired: [
        '테스트 로그 확인',
        'Mock 서버 상태 점검',
        '테스트 환경 재시작'
      ],
      estimatedFixTime: '5-30분',
      severity: 'medium'
    }
  }
};

/**
 * 환경과 에러 컨텍스트에 따른 적절한 에러 메시지 생성
 */
export function getErrorMessage(
  environment: Environment,
  context: ErrorContext,
  originalError?: string
): ErrorDetails {
  const baseMessage = errorMessageMatrix[environment][context];

  // 원본 에러가 있으면 개발자 메시지에 추가
  if (originalError && environment === 'development') {
    return {
      ...baseMessage,
      developerMessage: `${baseMessage.developerMessage}\n\n원본 에러: ${originalError}`
    };
  }

  return baseMessage;
}

/**
 * 에러 컨텍스트 자동 감지
 */
export function detectErrorContext(error: string | Error): ErrorContext {
  const errorStr = error instanceof Error ? error.message : error;
  const lowerError = errorStr.toLowerCase();

  if (lowerError.includes('api') && (lowerError.includes('key') || lowerError.includes('auth'))) {
    return 'api_key';
  }

  if (lowerError.includes('network') || lowerError.includes('timeout') || lowerError.includes('econnreset')) {
    return 'network';
  }

  if (lowerError.includes('quota') || lowerError.includes('limit') || lowerError.includes('429')) {
    return 'quota';
  }

  if (lowerError.includes('model') || lowerError.includes('endpoint')) {
    return 'model';
  }

  if (lowerError.includes('validation') || lowerError.includes('invalid') || lowerError.includes('400')) {
    return 'validation';
  }

  return 'unknown';
}

/**
 * 환경 감지
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
}

/**
 * 사용자 친화적 에러 응답 생성
 */
export function createUserFriendlyError(error: string | Error, context?: ErrorContext) {
  const environment = getCurrentEnvironment();
  const detectedContext = context || detectErrorContext(error);
  const errorDetails = getErrorMessage(environment, detectedContext, error instanceof Error ? error.message : error);

  return {
    success: false,
    error: {
      code: `SEEDANCE_${detectedContext.toUpperCase()}_ERROR`,
      message: errorDetails.userMessage,
      severity: errorDetails.severity,
      ...(environment === 'development' && {
        developmentInfo: {
          detailedMessage: errorDetails.developerMessage,
          actionRequired: errorDetails.actionRequired,
          helpUrl: errorDetails.helpUrl,
          estimatedFixTime: errorDetails.estimatedFixTime,
        }
      })
    }
  };
}