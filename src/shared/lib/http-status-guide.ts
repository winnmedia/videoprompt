/**
 * HTTP 상태 코드 사용 가이드라인
 *
 * API 계약의 일관성을 보장하기 위한 상태 코드 표준화
 * Benjamin의 계약 검증 원칙에 따른 에러 처리 가이드
 */

/**
 * 401 Unauthorized - 인증 관련 에러
 *
 * 사용 사례:
 * - 토큰이 없는 경우 (NO_AUTH_TOKEN)
 * - 토큰이 유효하지 않거나 만료된 경우 (INVALID_AUTH_TOKEN)
 * - 토큰 갱신 실패 (REFRESH_TOKEN_FAILED)
 * - 사용자가 인증되지 않은 상태에서 보호된 리소스 접근
 *
 * 중요: 401은 클라이언트가 재인증을 시도하도록 유도합니다.
 */
export const HTTP_401_CASES = {
  NO_AUTH_TOKEN: '인증 토큰이 없습니다.',
  INVALID_AUTH_TOKEN: '유효하지 않거나 만료된 토큰입니다.',
  REFRESH_TOKEN_FAILED: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
  UNAUTHORIZED: '인증이 필요합니다.',
  USER_NOT_FOUND: '사용자 정보를 조회할 수 없습니다.' // 인증된 토큰이지만 사용자가 삭제된 경우
} as const;

/**
 * 400 Bad Request - 클라이언트 요청 오류
 *
 * 사용 사례:
 * - 필수 매개변수 누락 (MISSING_REFRESH_TOKEN, MISSING_FILE)
 * - 잘못된 요청 형식 (VALIDATION_ERROR, INVALID_REQUEST)
 * - 비즈니스 규칙 위반 (RATE_LIMIT_EXCEEDED는 429 사용)
 * - 데이터 형식 오류
 *
 * 중요: 400은 클라이언트가 요청을 수정해야 함을 의미합니다.
 */
export const HTTP_400_CASES = {
  MISSING_REFRESH_TOKEN: 'Refresh token이 필요합니다.',
  MISSING_FILE: '업로드할 파일이 필요합니다.',
  VALIDATION_ERROR: '입력 데이터가 올바르지 않습니다.',
  INVALID_REQUEST: '올바르지 않은 요청 형식입니다.',
  INVALID_PATH: '올바르지 않은 경로입니다.',
  INVALID_PARAMETER: '올바르지 않은 매개변수입니다.'
} as const;

/**
 * 404 Not Found - 리소스 없음
 *
 * 사용 사례:
 * - 요청된 리소스가 존재하지 않는 경우
 * - API 엔드포인트가 존재하지 않는 경우
 */
export const HTTP_404_CASES = {
  NOT_FOUND: '리소스를 찾을 수 없습니다.',
  ENDPOINT_NOT_FOUND: 'API 엔드포인트를 찾을 수 없습니다.',
  PROJECT_NOT_FOUND: '프로젝트를 찾을 수 없습니다.'
} as const;

/**
 * 429 Too Many Requests - 요청 제한 초과
 */
export const HTTP_429_CASES = {
  RATE_LIMIT_EXCEEDED: '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.'
} as const;

/**
 * 500 Internal Server Error - 서버 오류
 */
export const HTTP_500_CASES = {
  INTERNAL_SERVER_ERROR: '서버에서 오류가 발생했습니다.',
  DATABASE_ERROR: '데이터베이스 연결 오류가 발생했습니다.',
  EXTERNAL_API_ERROR: '외부 API 호출 중 오류가 발생했습니다.',
  // TDD로 구현된 환경변수 검증 에러
  ENV_VALIDATION_ERROR: '필수 환경변수가 설정되지 않았습니다.',
  ENV_CONFIG_ERROR: '환경변수 형식이 올바르지 않습니다.'
} as const;

/**
 * 503 Service Unavailable - 서비스 이용 불가
 */
export const HTTP_503_CASES = {
  SERVICE_UNAVAILABLE: '서비스가 일시적으로 이용 불가능합니다.',
  SUPABASE_CONFIG_ERROR: 'Backend configuration error. Please contact support.',
  ALL_AI_SERVICES_FAILED: 'AI 서비스가 현재 이용 불가능합니다.',
  // 환경변수 누락으로 인한 서비스 불가
  SUPABASE_DISABLED: 'Supabase 설정이 올바르지 않습니다. 관리자에게 문의하세요.',
  ENV_VALIDATION_FAILED: '환경변수 검증에 실패했습니다.'
} as const;

/**
 * 501 Not Implemented - 기능 미구현/제한
 */
export const HTTP_501_CASES = {
  NOT_IMPLEMENTED: '해당 기능이 구현되지 않았습니다.',
  // degraded 모드 - Service Role Key 없음
  SUPABASE_DEGRADED: '제한된 기능으로 동작 중입니다. 일부 기능을 사용할 수 없습니다.',
  ADMIN_FEATURE_DISABLED: '관리자 기능이 비활성화되었습니다.'
} as const;

/**
 * 상태 코드 결정 헬퍼 함수들
 */

/**
 * 인증 관련 에러인지 확인
 */
export function isAuthenticationError(errorCode: string): boolean {
  return Object.keys(HTTP_401_CASES).includes(errorCode);
}

/**
 * 클라이언트 요청 오류인지 확인
 */
export function isBadRequestError(errorCode: string): boolean {
  return Object.keys(HTTP_400_CASES).includes(errorCode);
}

/**
 * 에러 코드에 따른 적절한 HTTP 상태 코드 반환
 */
export function getHttpStatusForError(errorCode: string): number {
  if (isAuthenticationError(errorCode)) return 401;
  if (isBadRequestError(errorCode)) return 400;
  if (Object.keys(HTTP_404_CASES).includes(errorCode)) return 404;
  if (Object.keys(HTTP_429_CASES).includes(errorCode)) return 429;
  if (Object.keys(HTTP_501_CASES).includes(errorCode)) return 501;
  if (Object.keys(HTTP_503_CASES).includes(errorCode)) return 503;
  if (Object.keys(HTTP_500_CASES).includes(errorCode)) return 500;

  // 기본값: 500 (알 수 없는 에러)
  return 500;
}

/**
 * 환경변수 누락/설정 오류에 따른 HTTP 상태 코드 결정
 */
export function getHttpStatusForEnvError(error: {
  mode: 'full' | 'degraded' | 'disabled'
  shouldReturn503?: boolean
}): number {
  // disabled 모드 = 필수 환경변수 누락 = 서비스 불가
  if (error.mode === 'disabled') {
    return 503 // HTTP_503_CASES.SUPABASE_DISABLED
  }

  // degraded 모드 = Service Role Key 누락 = 기능 제한
  if (error.mode === 'degraded') {
    return 501 // HTTP_501_CASES.SUPABASE_DEGRADED
  }

  // shouldReturn503 플래그가 명시적으로 설정된 경우
  if (error.shouldReturn503) {
    return 503
  }

  // 기본값 = 내부 서버 에러
  return 500
}

/**
 * 상태 코드 가이드라인 검증
 *
 * 개발 시 사용할 수 있는 검증 함수
 */
export function validateHttpStatusUsage(errorCode: string, providedStatus: number): {
  isValid: boolean;
  expectedStatus: number;
  message?: string;
} {
  const expectedStatus = getHttpStatusForError(errorCode);
  const isValid = expectedStatus === providedStatus;

  if (!isValid) {
    return {
      isValid: false,
      expectedStatus,
      message: `에러 코드 '${errorCode}'는 ${expectedStatus} 상태 코드를 사용해야 하지만 ${providedStatus}가 제공되었습니다.`
    };
  }

  return { isValid: true, expectedStatus };
}

/**
 * 무한 루프 방지를 위한 특별 규칙들
 */
export const INFINITE_LOOP_PREVENTION = {
  /**
   * MISSING_REFRESH_TOKEN은 반드시 400을 사용해야 함
   * 401을 사용하면 클라이언트가 refresh를 다시 시도하여 무한 루프 발생
   */
  MISSING_REFRESH_TOKEN_MUST_BE_400: true,

  /**
   * 토큰 갱신 API에서 사용자 입력 오류는 400 사용
   * 토큰 자체의 문제는 401 사용
   */
  REFRESH_API_ERROR_STRATEGY: {
    missingToken: 400,      // 토큰이 아예 없음
    invalidToken: 401,      // 토큰이 있지만 유효하지 않음
    expiredToken: 401,      // 토큰이 만료됨
    malformedRequest: 400   // 요청 형식 자체가 잘못됨
  }
} as const;