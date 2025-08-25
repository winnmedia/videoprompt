/**
 * API 설정
 * 환경별로 적절한 API 엔드포인트를 제공
 */

// 환경별 API 베이스 URL
export const getApiBase = (): string => {
  // 환경 변수로 설정 가능
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // 기본값: 개발환경은 로컬, 프로덕션은 Railway
  if (process.env.NODE_ENV === 'production') {
    return 'https://videoprompt-production.up.railway.app/api';
  }
  
  return '/api';
};

// API 엔드포인트들
export const API_ENDPOINTS = {
  IMAGEN_PREVIEW: '/imagen/preview',
  VEO_CREATE: '/veo/create',
  SEEDANCE_CREATE: '/seedance/create',
  SEEDANCE_STATUS: '/seedance/status',
  AI_GENERATE_STORY: '/ai/generate-story',
} as const;

// 전체 API URL 생성
export const getApiUrl = (endpoint: string): string => {
  return `${getApiBase()}${endpoint}`;
};
