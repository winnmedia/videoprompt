/**
 * HTTP 에러 핸들러 - 401/400 에러 명확한 구분
 * Contract-first 설계에 따른 일관된 에러 응답 생성
 *
 * 에러 분류 기준:
 * - 400 Bad Request: 클라이언트 요청 형식/데이터 오류
 * - 401 Unauthorized: 인증 실패 (토큰 없음, 유효하지 않음, 만료됨)
 * - 403 Forbidden: 인증은 성공했으나 권한 부족
 * - 503 Service Unavailable: 서비스 일시 중단 (Graceful degradation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/shared/lib/logger';
import { ZodError } from 'zod';

// ===== 에러 코드 정의 =====

export type HttpErrorCode =
  // 400 에러 (클라이언트 요청 오류)
  | 'INVALID_REQUEST'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FIELD_FORMAT'
  | 'INVALID_JSON'
  | 'MISSING_REFRESH_TOKEN'  // $300 사건 재발 방지
  | 'VALIDATION_ERROR'

  // 401 에러 (인증 실패)
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'AUTHENTICATION_REQUIRED'

  // 403 에러 (권한 부족)
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'GUEST_REQUIRED'

  // 503 에러 (서비스 이용 불가)
  | 'SERVICE_UNAVAILABLE'
  | 'MAINTENANCE_MODE'
  | 'RATE_LIMIT_EXCEEDED';

export interface HttpError {
  code: HttpErrorCode;
  message: string;
  statusCode: 400 | 401 | 403 | 503;
  details?: Record<string, any>;
  timestamp: string;
  path: string;
}

// ===== 에러 분류 맵핑 =====

const ERROR_STATUS_MAP: Record<HttpErrorCode, number> = {
  // 400 에러
  'INVALID_REQUEST': 400,
  'MISSING_REQUIRED_FIELD': 400,
  'INVALID_FIELD_FORMAT': 400,
  'INVALID_JSON': 400,
  'MISSING_REFRESH_TOKEN': 400,  // 🚨 무한 루프 방지: 반드시 400
  'VALIDATION_ERROR': 400,

  // 401 에러
  'UNAUTHORIZED': 401,
  'TOKEN_EXPIRED': 401,
  'INVALID_TOKEN': 401,
  'EMAIL_NOT_VERIFIED': 401,
  'AUTHENTICATION_REQUIRED': 401,

  // 403 에러
  'FORBIDDEN': 403,
  'INSUFFICIENT_PERMISSIONS': 403,
  'GUEST_REQUIRED': 403,

  // 503 에러
  'SERVICE_UNAVAILABLE': 503,
  'MAINTENANCE_MODE': 503,
  'RATE_LIMIT_EXCEEDED': 503,
};

const ERROR_MESSAGES: Record<HttpErrorCode, string> = {
  // 400 에러 메시지
  'INVALID_REQUEST': '잘못된 요청 형식입니다.',
  'MISSING_REQUIRED_FIELD': '필수 필드가 누락되었습니다.',
  'INVALID_FIELD_FORMAT': '필드 형식이 올바르지 않습니다.',
  'INVALID_JSON': 'JSON 형식이 올바르지 않습니다.',
  'MISSING_REFRESH_TOKEN': '리프레시 토큰이 필요합니다.',
  'VALIDATION_ERROR': '입력 데이터 검증에 실패했습니다.',

  // 401 에러 메시지
  'UNAUTHORIZED': '인증이 필요합니다.',
  'TOKEN_EXPIRED': '인증 토큰이 만료되었습니다.',
  'INVALID_TOKEN': '유효하지 않은 인증 토큰입니다.',
  'EMAIL_NOT_VERIFIED': '이메일 인증이 필요합니다.',
  'AUTHENTICATION_REQUIRED': '로그인이 필요합니다.',

  // 403 에러 메시지
  'FORBIDDEN': '접근 권한이 없습니다.',
  'INSUFFICIENT_PERMISSIONS': '충분한 권한이 없습니다.',
  'GUEST_REQUIRED': '게스트 접근만 허용됩니다.',

  // 503 에러 메시지
  'SERVICE_UNAVAILABLE': '서비스가 일시적으로 이용할 수 없습니다.',
  'MAINTENANCE_MODE': '서비스 점검 중입니다.',
  'RATE_LIMIT_EXCEEDED': '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
};

// ===== 에러 생성 함수들 =====

/**
 * 표준 HTTP 에러 객체 생성
 */
export function createHttpError(
  code: HttpErrorCode,
  request: NextRequest,
  customMessage?: string,
  details?: Record<string, any>
): HttpError {
  const statusCode = ERROR_STATUS_MAP[code] as 400 | 401 | 403 | 503;
  const message = customMessage || ERROR_MESSAGES[code];

  return {
    code,
    message,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
    path: request.url
  };
}

/**
 * HTTP 에러를 NextResponse로 변환
 */
export function createErrorResponse(error: HttpError): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 401 에러인 경우 WWW-Authenticate 헤더 추가
  if (error.statusCode === 401) {
    headers['WWW-Authenticate'] = 'Bearer realm="api"';
  }

  // 503 에러인 경우 Retry-After 헤더 추가
  if (error.statusCode === 503) {
    headers['Retry-After'] = '60'; // 60초 후 재시도
  }

  return NextResponse.json(error, {
    status: error.statusCode,
    headers
  });
}

// ===== 특화된 에러 생성 함수들 =====

/**
 * 400 에러: 잘못된 요청
 */
export function createBadRequestError(
  request: NextRequest,
  field?: string,
  value?: any,
  customMessage?: string
): NextResponse {
  const details: Record<string, any> = {};

  if (field) {
    details.field = field;
  }

  if (value !== undefined) {
    details.value = value;
  }

  const error = createHttpError(
    'INVALID_REQUEST',
    request,
    customMessage,
    details
  );

  return createErrorResponse(error);
}

/**
 * 400 에러: 필수 필드 누락
 */
export function createMissingFieldError(
  request: NextRequest,
  field: string,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'MISSING_REQUIRED_FIELD',
    request,
    customMessage || `${field} 필드가 필요합니다.`,
    { field }
  );

  return createErrorResponse(error);
}

/**
 * 400 에러: Zod 검증 실패
 */
export function createValidationError(
  request: NextRequest,
  zodError: ZodError,
  customMessage?: string
): NextResponse {
  const details = {
    issues: zodError.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  };

  const error = createHttpError(
    'VALIDATION_ERROR',
    request,
    customMessage || '입력 데이터가 올바르지 않습니다.',
    details
  );

  return createErrorResponse(error);
}

/**
 * 400 에러: 리프레시 토큰 누락 (무한 루프 방지)
 */
export function createMissingRefreshTokenError(
  request: NextRequest,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'MISSING_REFRESH_TOKEN',  // 🚨 반드시 400 상태 코드
    request,
    customMessage || '리프레시 토큰이 필요합니다. 다시 로그인해주세요.',
    {
      preventInfiniteLoop: true,
      statusCode: 400  // 명시적으로 400 표시
    }
  );

  return createErrorResponse(error);
}

/**
 * 401 에러: 인증 실패
 */
export function createUnauthorizedError(
  request: NextRequest,
  tokenType?: string,
  customMessage?: string
): NextResponse {
  const details: Record<string, any> = {};

  if (tokenType) {
    details.tokenType = tokenType;
  }

  const error = createHttpError(
    'UNAUTHORIZED',
    request,
    customMessage,
    details
  );

  return createErrorResponse(error);
}

/**
 * 401 에러: 토큰 만료
 */
export function createTokenExpiredError(
  request: NextRequest,
  tokenType?: string,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'TOKEN_EXPIRED',
    request,
    customMessage,
    { tokenType }
  );

  return createErrorResponse(error);
}

/**
 * 401 에러: 유효하지 않은 토큰
 */
export function createInvalidTokenError(
  request: NextRequest,
  tokenType?: string,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'INVALID_TOKEN',
    request,
    customMessage,
    { tokenType }
  );

  return createErrorResponse(error);
}

/**
 * 403 에러: 권한 부족
 */
export function createForbiddenError(
  request: NextRequest,
  permission?: string,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'FORBIDDEN',
    request,
    customMessage,
    { requiredPermission: permission }
  );

  return createErrorResponse(error);
}

/**
 * 503 에러: 서비스 이용 불가 (Graceful degradation)
 */
export function createServiceUnavailableError(
  request: NextRequest,
  reason?: string,
  customMessage?: string
): NextResponse {
  const error = createHttpError(
    'SERVICE_UNAVAILABLE',
    request,
    customMessage,
    {
      reason,
      degradationMode: true,
      retryAfter: 60
    }
  );

  return createErrorResponse(error);
}

// ===== 에러 타입 검증 함수들 =====

/**
 * 400 에러인지 확인
 */
export function isBadRequestError(error: HttpError): boolean {
  return error.statusCode === 400;
}

/**
 * 401 에러인지 확인
 */
export function isUnauthorizedError(error: HttpError): boolean {
  return error.statusCode === 401;
}

/**
 * 403 에러인지 확인
 */
export function isForbiddenError(error: HttpError): boolean {
  return error.statusCode === 403;
}

/**
 * 503 에러인지 확인
 */
export function isServiceUnavailableError(error: HttpError): boolean {
  return error.statusCode === 503;
}

// ===== 통합 에러 핸들러 =====

/**
 * 표준 에러를 HTTP 에러로 변환하는 통합 핸들러
 */
export function handleGenericError(
  error: unknown,
  request: NextRequest,
  fallbackMessage = '서버 오류가 발생했습니다.'
): NextResponse {
  logger.error('🚨 Generic error handler:', error instanceof Error ? error : new Error(String(error)));

  // Zod 검증 에러
  if (error instanceof ZodError) {
    return createValidationError(request, error);
  }

  // JSON 파싱 에러
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    const httpError = createHttpError(
      'INVALID_JSON',
      request,
      'JSON 형식이 올바르지 않습니다.',
      { originalError: error.message }
    );
    return createErrorResponse(httpError);
  }

  // 기본 500 에러 (내부 서버 오류)
  return NextResponse.json(
    {
      code: 'INTERNAL_SERVER_ERROR',
      message: fallbackMessage,
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url
    },
    { status: 500 }
  );
}

// ===== 에러 분류 가이드라인 =====

/**
 * 에러 분류 가이드라인
 *
 * 🔴 400 Bad Request (클라이언트 오류):
 * - 필수 필드 누락
 * - 잘못된 데이터 형식
 * - JSON 파싱 오류
 * - 리프레시 토큰 누락 (무한 루프 방지)
 * - Zod 검증 실패
 *
 * 🟡 401 Unauthorized (인증 실패):
 * - 토큰 없음
 * - 토큰 만료
 * - 토큰 형식 오류
 * - 이메일 미인증
 *
 * 🟠 403 Forbidden (권한 부족):
 * - 인증은 성공했으나 권한 없음
 * - 역할 기반 접근 제어 실패
 *
 * 🔵 503 Service Unavailable (서비스 중단):
 * - Graceful degradation
 * - 유지보수 모드
 * - Rate limiting
 */

export const ERROR_CLASSIFICATION_GUIDE = {
  '400': '클라이언트 요청 오류 (잘못된 형식, 필수 필드 누락)',
  '401': '인증 실패 (토큰 없음, 유효하지 않음, 만료됨)',
  '403': '권한 부족 (인증은 되었으나 접근 권한 없음)',
  '503': '서비스 일시 중단 (Graceful degradation)'
} as const;