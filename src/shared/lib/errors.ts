/**
 * 공통 에러 클래스 정의
 * FSD: shared/lib 레이어
 */

/**
 * 기본 애플리케이션 에러 클래스
 */
export abstract class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // V8 스택 추적 개선
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Planning API 관련 에러
 */
export class PlanningApiError extends AppError {
  constructor(
    message: string,
    code: string = 'PLANNING_API_ERROR',
    statusCode: number = 500
  ) {
    super(message, code, statusCode);
  }

  static projectNotFound(projectId: string): PlanningApiError {
    return new PlanningApiError(
      `Project not found: ${projectId}`,
      'PROJECT_NOT_FOUND',
      404
    );
  }

  static storageError(operation: string): PlanningApiError {
    return new PlanningApiError(
      `Storage operation failed: ${operation}`,
      'STORAGE_ERROR',
      500
    );
  }

  static validationFailed(field: string): PlanningApiError {
    return new PlanningApiError(
      `Validation failed for field: ${field}`,
      'VALIDATION_FAILED',
      400
    );
  }
}

/**
 * 검증 에러
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, code, 400);
    this.field = field;
    this.value = value;
  }

  static required(field: string): ValidationError {
    return new ValidationError(
      `${field} is required`,
      field,
      undefined,
      'FIELD_REQUIRED'
    );
  }

  static invalid(field: string, value: unknown): ValidationError {
    return new ValidationError(
      `Invalid value for ${field}`,
      field,
      value,
      'INVALID_VALUE'
    );
  }

  static typeError(field: string, expectedType: string, actualType: string): ValidationError {
    return new ValidationError(
      `Expected ${expectedType} for ${field}, got ${actualType}`,
      field,
      actualType,
      'TYPE_ERROR'
    );
  }
}

/**
 * 인증 에러
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: string = 'AUTHENTICATION_REQUIRED'
  ) {
    super(message, code, 401);
  }

  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(
      'Authentication token has expired',
      'TOKEN_EXPIRED'
    );
  }

  static invalidToken(): AuthenticationError {
    return new AuthenticationError(
      'Invalid authentication token',
      'INVALID_TOKEN'
    );
  }
}

/**
 * 권한 에러
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    code: string = 'INSUFFICIENT_PERMISSIONS'
  ) {
    super(message, code, 403);
  }
}

/**
 * 비용 안전 에러 ($300 사건 방지)
 */
export class CostSafetyError extends AppError {
  public readonly operation: string;
  public readonly estimatedCost?: number;

  constructor(
    message: string,
    operation: string,
    estimatedCost?: number,
    code: string = 'COST_SAFETY_VIOLATION'
  ) {
    super(message, code, 429); // Too Many Requests
    this.operation = operation;
    this.estimatedCost = estimatedCost;
  }

  static infiniteLoop(operation: string): CostSafetyError {
    return new CostSafetyError(
      `Infinite loop detected in ${operation} - operation blocked`,
      operation,
      300, // $300 reference
      'INFINITE_LOOP_DETECTED'
    );
  }

  static rateLimitExceeded(operation: string): CostSafetyError {
    return new CostSafetyError(
      `Rate limit exceeded for ${operation}`,
      operation,
      undefined,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * 에러 타입 가드
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isPlanningApiError(error: unknown): error is PlanningApiError {
  return error instanceof PlanningApiError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isCostSafetyError(error: unknown): error is CostSafetyError {
  return error instanceof CostSafetyError;
}

/**
 * 에러 정보 추출 유틸리티
 */
export function getErrorInfo(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  isOperational: boolean;
} {
  if (isAppError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      isOperational: false,
    };
  }

  return {
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    isOperational: false,
  };
}