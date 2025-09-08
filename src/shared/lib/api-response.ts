import { NextRequest, NextResponse } from 'next/server';

export type ApiSuccess<T> = { 
  ok: true; 
  data: T; 
  traceId?: string;
  timestamp?: string;
};

export type ApiError = {
  ok: false;
  code: string;
  error: string;
  details?: string;
  traceId?: string;
  timestamp?: string;
  statusCode?: number;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// 에러 코드 상수 정의
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Input Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Database & External Services
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  DATABASE_UNREACHABLE: 'DATABASE_UNREACHABLE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Business Logic
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  EXPIRED: 'EXPIRED',
  
  // Generic
  UNKNOWN: 'UNKNOWN',
  RATE_LIMITED: 'RATE_LIMITED'
} as const;

export function success<T>(data: T, status = 200, traceId?: string) {
  const response: ApiSuccess<T> = { 
    ok: true, 
    data, 
    timestamp: new Date().toISOString(),
    ...(traceId ? { traceId } : {})
  };
  
  return NextResponse.json(response, { status });
}

export function failure(
  code: string,
  error: string,
  status = 400,
  details?: string,
  traceId?: string,
) {
  const response: ApiError = {
    ok: false,
    code,
    error,
    statusCode: status,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
    ...(traceId ? { traceId } : {}),
  };

  // 에러 로깅
  console.error(`🚨 API Error [${code}]:`, {
    error,
    details,
    status,
    traceId,
    timestamp: response.timestamp
  });

  return NextResponse.json(response, { status });
}

// 표준 에러 응답 헬퍼들
export const standardErrors = {
  unauthorized: (traceId?: string) => 
    failure(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다.', 401, undefined, traceId),
    
  forbidden: (traceId?: string) => 
    failure(ERROR_CODES.FORBIDDEN, '접근 권한이 없습니다.', 403, undefined, traceId),
    
  notFound: (resource: string, traceId?: string) => 
    failure(ERROR_CODES.NOT_FOUND, `${resource}을(를) 찾을 수 없습니다.`, 404, undefined, traceId),
    
  invalidInput: (field: string, traceId?: string) => 
    failure(ERROR_CODES.INVALID_INPUT, `잘못된 입력입니다: ${field}`, 400, undefined, traceId),
    
  databaseError: (traceId?: string) => 
    failure(ERROR_CODES.DATABASE_ERROR, '데이터베이스 오류가 발생했습니다.', 500, 'Database operation failed', traceId),
    
  serviceUnavailable: (service: string, traceId?: string) => 
    failure(ERROR_CODES.SERVICE_UNAVAILABLE, `${service} 서비스를 일시적으로 사용할 수 없습니다.`, 503, undefined, traceId),
};

export function getTraceId(req: NextRequest): string {
  return (
    req.headers.get('x-trace-id') ||
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
  );
}





