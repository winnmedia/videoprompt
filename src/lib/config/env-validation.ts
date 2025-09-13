/**
 * 환경변수 검증 및 더미 값 감지 유틸리티
 * 환각 코드 방지를 위한 안전한 환경변수 처리
 */

const DUMMY_VALUES = [
  'your-api-key-here',
  'your-seedance-api-key-here',
  'your-veo-api-key-here',
  'your-webhook-secret-here',
  'your-secret-here',
  'change-me',
  'replace-me',
  'dummy',
  'test',
  'example',
];

/**
 * 더미 값인지 확인
 */
function isDummyValue(value: string | undefined): boolean {
  if (!value) return true;
  return DUMMY_VALUES.some(dummy =>
    value.toLowerCase().includes(dummy.toLowerCase())
  );
}

/**
 * API 키가 실제 설정되었는지 확인
 */
export function validateApiKey(key: string | undefined, serviceName: string): {
  isValid: boolean;
  isDummy: boolean;
  error?: string;
} {
  if (!key) {
    return {
      isValid: false,
      isDummy: false,
      error: `${serviceName} API key is not set`
    };
  }

  if (isDummyValue(key)) {
    return {
      isValid: false,
      isDummy: true,
      error: `${serviceName} API key is using dummy value. Please set a real API key.`
    };
  }

  if (key.length < 10) {
    return {
      isValid: false,
      isDummy: false,
      error: `${serviceName} API key appears to be too short`
    };
  }

  return {
    isValid: true,
    isDummy: false
  };
}

/**
 * 환경변수 상태 검사 결과
 */
export interface EnvStatus {
  serviceName: string;
  isConfigured: boolean;
  isDummy: boolean;
  error?: string;
}

/**
 * 모든 서비스의 환경변수 상태를 검사
 */
export function checkEnvironmentStatus(): EnvStatus[] {
  const services = [
    { name: 'Seedance', key: process.env.SEEDANCE_API_KEY },
    { name: 'VEO', key: process.env.VEO_API_KEY },
    { name: 'Webhook Secret', key: process.env.SEEDANCE_WEBHOOK_SECRET },
  ];

  return services.map(service => {
    const validation = validateApiKey(service.key, service.name);

    return {
      serviceName: service.name,
      isConfigured: validation.isValid,
      isDummy: validation.isDummy,
      error: validation.error
    };
  });
}

/**
 * 프로덕션 환경에서 필수 환경변수 검사
 */
export function validateProductionEnvironment(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    const statuses = checkEnvironmentStatus();

    statuses.forEach(status => {
      if (!status.isConfigured) {
        errors.push(`Production environment missing: ${status.serviceName} - ${status.error}`);
      }
    });

    // 데이터베이스 URL 검사
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}