/**
 * 표준화된 Supabase 503 오류 메시지
 *
 * VideoPlanet 프로젝트에서 일관성 있는 사용자 친화적 한국어 오류 메시지를 제공합니다.
 * auth/refresh.ts를 기준으로 표준화되었습니다.
 *
 * 특징:
 * - 사용자 친화적 언어 (기술 용어 제거)
 * - 명확한 행동 지침 (재시도, 문의)
 * - 모든 라우트에서 일관된 톤앤매너
 * - Retry-After 헤더와 함께 사용
 */

/**
 * 표준화된 Supabase 오류 코드와 메시지
 */
export const SUPABASE_ERROR_MESSAGES = {
  /**
   * Supabase 설정 관련 오류 (환경변수 누락 등)
   * HTTP 503 Service Unavailable
   */
  SUPABASE_CONFIG_ERROR: {
    code: 'SUPABASE_CONFIG_ERROR',
    userMessage: 'Supabase 설정 오류. 관리자에게 문의하세요.',
    englishMessage: 'Backend configuration error. Please contact support.',
    statusCode: 503,
    retryAfter: null, // 관리자 개입 필요하므로 재시도 불가
  },

  /**
   * 일반적인 Supabase 서비스 접근 불가 (네트워크, 서버 다운 등)
   * HTTP 503 Service Unavailable
   */
  SUPABASE_UNAVAILABLE: {
    code: 'SUPABASE_UNAVAILABLE',
    userMessage: '데이터베이스 서비스에 일시적으로 접근할 수 없습니다. 잠시 후 다시 시도해주세요.',
    englishMessage: 'Database service temporarily unavailable. Please try again later.',
    statusCode: 503,
    retryAfter: 60, // 60초 후 재시도 권장
  },

  /**
   * 관리자 권한이 필요한 Supabase 서비스 접근 불가
   * HTTP 503 Service Unavailable
   */
  SUPABASE_ADMIN_UNAVAILABLE: {
    code: 'SUPABASE_ADMIN_UNAVAILABLE',
    userMessage: '관리자 권한이 필요한 서비스입니다. 설정을 확인해주세요.',
    englishMessage: 'Admin privileges required. Please check configuration.',
    statusCode: 503,
    retryAfter: null, // 권한 설정 필요하므로 재시도 불가
  },

  /**
   * 토큰 갱신 전용 서비스 접근 불가 (auth/refresh.ts 기준)
   * HTTP 503 Service Unavailable
   */
  TOKEN_REFRESH_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    userMessage: '토큰 갱신 서비스에 일시적으로 접근할 수 없습니다. 잠시 후 다시 시도해주세요.',
    englishMessage: 'Token refresh service temporarily unavailable. Please try again later.',
    statusCode: 503,
    retryAfter: 60, // 60초 후 재시도 권장
  },

  /**
   * 일반적인 서비스 접근 불가 (모든 API에서 공통 사용)
   * HTTP 503 Service Unavailable
   */
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    userMessage: '서비스에 일시적으로 접근할 수 없습니다. 잠시 후 다시 시도해주세요.',
    englishMessage: 'Service temporarily unavailable. Please try again later.',
    statusCode: 503,
    retryAfter: 60, // 60초 후 재시도 권장
  },
} as const;

/**
 * 오류 타입 정의
 */
export type SupabaseErrorType = keyof typeof SUPABASE_ERROR_MESSAGES;

/**
 * 표준화된 Supabase 오류 응답 생성 헬퍼
 *
 * @param errorType - 오류 타입
 * @param traceId - 추적 ID (선택적)
 * @param debugInfo - 디버그 정보 (선택적, 프로덕션에서는 로그에만 기록)
 * @returns 표준화된 오류 정보
 */
export function getSupabaseErrorResponse(
  errorType: SupabaseErrorType,
  traceId?: string,
  debugInfo?: string
) {
  const errorConfig = SUPABASE_ERROR_MESSAGES[errorType];

  return {
    code: errorConfig.code,
    userMessage: errorConfig.userMessage,
    englishMessage: errorConfig.englishMessage,
    statusCode: errorConfig.statusCode,
    retryAfter: errorConfig.retryAfter,
    traceId,
    debugInfo,
  };
}

/**
 * Supabase 오류 감지 헬퍼
 *
 * @param error - 오류 객체
 * @returns 감지된 오류 타입 또는 null
 */
export function detectSupabaseErrorType(error: any): SupabaseErrorType | null {
  const errorMessage = error?.message?.toLowerCase() || '';

  // 환경변수 관련 오류
  if (errorMessage.includes('supabase_url') ||
      errorMessage.includes('supabase_anon_key') ||
      errorMessage.includes('supabase_service_role_key')) {
    return 'SUPABASE_CONFIG_ERROR';
  }

  // 네트워크 관련 오류
  if (errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout')) {
    return 'SUPABASE_UNAVAILABLE';
  }

  // 권한 관련 오류 (관리자 권한 필요)
  if (errorMessage.includes('permission') ||
      errorMessage.includes('admin') ||
      errorMessage.includes('service_role')) {
    return 'SUPABASE_ADMIN_UNAVAILABLE';
  }

  return null;
}

/**
 * 기존 auth/refresh.ts와의 호환성을 위한 상수
 * @deprecated 새 코드에서는 SUPABASE_ERROR_MESSAGES 사용 권장
 */
export const LEGACY_ERROR_CODES = {
  SUPABASE_CONFIG_ERROR: 'SUPABASE_CONFIG_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;