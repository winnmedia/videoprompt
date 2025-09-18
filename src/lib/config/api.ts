/**
 * API 설정
 * 환경별로 적절한 API 엔드포인트를 제공
 */

// 현재 배포 환경 기반 API 설정 관리 - Supabase 통합 아키텍처
const getEnvironmentBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL ||
         process.env.NEXT_PUBLIC_API_BASE ||
         (process.env.NODE_ENV === 'production' ? 'https://videoprompt.vercel.app' : 'http://localhost:3000');
};

export const API_CONFIG = {
  // 프로덕션 환경: 현재 배포 환경 사용
  production: {
    baseUrl: getEnvironmentBaseUrl(),
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 120000, // 120초
    retryAttempts: 3, // 재시도 횟수
    retryDelay: 2000, // 재시도 간격 (ms)
  },

  // 개발 환경: 로컬 Next.js 서버 사용
  development: {
    baseUrl: getEnvironmentBaseUrl(),
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 120000, // 120초
    retryAttempts: 3, // 재시도 횟수
    retryDelay: 2000, // 재시도 간격 (ms)
  },

  // 테스트 환경: 로컬 테스트 서버 사용
  test: {
    baseUrl: getEnvironmentBaseUrl(),
    apiPrefix: '/api',
    useProxy: false, // 직접 연결
    timeout: 60000, // 60초 - 테스트 환경
    retryAttempts: 2, // 재시도 횟수
    retryDelay: 1000, // 재시도 간격 (ms)
  },
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

// API URL 생성 - Supabase 기반 통합 백엔드
export const buildApiUrl = (endpoint: string) => {
  const config = getApiConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const apiPrefix = config.apiPrefix.replace(/^\//, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');

  return `${baseUrl}/${apiPrefix}/${cleanEndpoint}`;
};

// 기존 코드와의 호환성을 위한 함수들
export const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.replace(/^\//, '');
  // 브라우저(클라이언트)에서는 항상 동일 출처의 Next API를 경유하여 CORS/보안/폴백 일관성 확보
  if (typeof window !== 'undefined') {
    return `/api/${cleanEndpoint}`;
  }
  // 서버(SSR/라우트 핸들러)에서는 현재 배포 환경으로 직접 연결
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

// 현재 배포 환경 백엔드 상태 확인
export const checkBackendHealth = async () => {
  try {
    const baseUrl = getEnvironmentBaseUrl();
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch (error) {
    console.error('백엔드 상태 확인 실패:', error);
    return false;
  }
};
