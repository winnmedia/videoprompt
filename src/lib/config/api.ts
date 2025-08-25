/**
 * API 설정
 * 환경별로 적절한 API 엔드포인트를 제공
 */

// 배포 환경 전용 API 설정 관리
export const API_CONFIG = {
  // 프로덕션 환경: Railway 백엔드 직접 연결
  production: {
    baseUrl: 'https://videoprompt-production.up.railway.app',
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 60000, // 60초 - 배포 환경 고려
  },
  
  // 개발 환경: Railway 백엔드 직접 연결 (로컬 가정 제거)
  development: {
    baseUrl: 'https://videoprompt-production.up.railway.app',
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 60000, // 60초 - 배포 환경 고려
  },
  
  // 테스트 환경: Railway 백엔드 직접 연결
  test: {
    baseUrl: 'https://videoprompt-production.up.railway.app',
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 30000, // 30초 - 테스트 환경
  }
};

// 현재 환경 감지
export const getCurrentEnvironment = () => {
  if (process.env.NODE_ENV === 'test') return 'test';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
};

// 환경별 설정 가져오기
export const getApiConfig = () => {
  const env = getCurrentEnvironment();
  return API_CONFIG[env];
};

// API URL 생성 (Railway 백엔드 직접 연결)
export const buildApiUrl = (endpoint: string) => {
  const config = getApiConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const apiPrefix = config.apiPrefix.replace(/^\//, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');
  
  return `${baseUrl}/${apiPrefix}/${cleanEndpoint}`;
};

// 기존 코드와의 호환성을 위한 함수들
export const getApiUrl = (endpoint: string): string => {
  return buildApiUrl(endpoint);
};

export const getApiBase = (): string => {
  const config = getApiConfig();
  return `${config.baseUrl}${config.apiPrefix}`;
};

// API 엔드포인트들 (기존 코드와의 호환성)
export const API_ENDPOINTS = {
  IMAGEN_PREVIEW: '/imagen/preview',
  VEO_CREATE: '/veo/create',
  SEEDANCE_CREATE: '/seedance/create',
  SEEDANCE_STATUS: '/seedance/status',
  AI_GENERATE_STORY: '/ai/generate-story',
  FILES_SAVE: '/files/save',
} as const;

// Mock 모드 비활성화 (배포 환경 전용)
export const isMockModeEnabled = () => {
  return false; // Mock 모드 완전 비활성화
};

// 타임아웃 설정 가져오기
export const getApiTimeout = () => {
  const config = getApiConfig();
  return config.timeout;
};

// 프록시 사용 여부 (직접 연결만 사용)
export const shouldUseProxy = () => {
  return false; // 직접 연결만 사용
};

// Railway 백엔드 상태 확인
export const checkRailwayBackend = async () => {
  try {
    const response = await fetch('https://videoprompt-production.up.railway.app/api/health', {
      signal: AbortSignal.timeout(10000)
    });
    return response.ok;
  } catch (error) {
    console.error('Railway 백엔드 상태 확인 실패:', error);
    return false;
  }
};
