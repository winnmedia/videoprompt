/**
 * Planning API Utilities
 *
 * 시나리오 기획 API를 위한 공통 유틸리티
 * CLAUDE.md 준수: 비용 안전 규칙, JWT 검증, 에러 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { CostSafetyMiddleware } from '../lib/cost-safety-middleware';
import logger from '../lib/structured-logger';
import type { User } from './dto-transformers';

// ===========================================
// 상수 정의
// ===========================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const COST_SAFETY_CONFIG = {
  minuteLimit: 30, // 분당 30회 제한 (CLAUDE.md 요구사항)
  hourlyLimit: 300,
  costThreshold: 50, // $50 임계값
  infiniteLoopWindow: 5000,
  infiniteLoopThreshold: 10,
};

// ===========================================
// 글로벌 비용 안전 미들웨어 인스턴스
// ===========================================

const costSafety = new CostSafetyMiddleware({
  logger: {
    error: (data) => logger.error('비용 안전 오류', undefined, data),
    warn: (data) => logger.warn('비용 안전 경고', data),
    info: (data) => logger.info('비용 안전 정보', data),
  },
  onEmergencyShutdown: (params) => {
    logger.error('비상 셧다운 실행', undefined, {
      component: 'CostSafety',
      metadata: params,
    });
  },
  ...COST_SAFETY_CONFIG,
});

// ===========================================
// 에러 타입 정의
// ===========================================

export class PlanningApiError extends Error {
  constructor(
    public message: string,
    public code: string = 'PLANNING_API_ERROR',
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'PlanningApiError';
  }
}

export class ValidationError extends PlanningApiError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends PlanningApiError {
  constructor(message: string = '인증이 필요합니다.') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends PlanningApiError {
  constructor(message: string = 'API 호출 제한을 초과했습니다.') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

// ===========================================
// JWT 토큰 검증
// ===========================================

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export function extractJwtToken(request: NextRequest): string | null {
  // Authorization 헤더에서 토큰 추출
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 쿠키에서 토큰 추출
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export function verifyJwtToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // 토큰 만료 체크
    if (decoded.exp * 1000 < Date.now()) {
      throw new AuthenticationError('토큰이 만료되었습니다.');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('유효하지 않은 토큰입니다.');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('토큰이 만료되었습니다.');
    }
    throw error;
  }
}

export function requireAuth(request: NextRequest): JwtPayload {
  const token = extractJwtToken(request);
  if (!token) {
    throw new AuthenticationError('인증 토큰이 필요합니다.');
  }

  return verifyJwtToken(token);
}

// ===========================================
// 요청 검증 미들웨어
// ===========================================

export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new ValidationError('요청 데이터 검증 실패', {
        errors: errorDetails,
        received: error.errors[0]?.received,
      });
    }

    if (error instanceof SyntaxError) {
      throw new ValidationError('잘못된 JSON 형식입니다.');
    }

    throw error;
  }
}

export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    // 숫자 문자열을 숫자로 변환
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
        params[key] = Number(value);
      }
    });

    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorDetails = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new ValidationError('쿼리 파라미터 검증 실패', {
        errors: errorDetails,
      });
    }
    throw error;
  }
}

// ===========================================
// 비용 안전 미들웨어 적용
// ===========================================

export async function applyCostSafety(endpoint: string): Promise<void> {
  const result = await costSafety.checkApiCallLimit(endpoint);

  if (!result.allowed) {
    switch (result.reason) {
      case 'RATE_LIMIT_EXCEEDED':
        throw new RateLimitError(`분당 호출 제한(${COST_SAFETY_CONFIG.minuteLimit}회)을 초과했습니다.`);
      case 'HOURLY_LIMIT_EXCEEDED':
        throw new RateLimitError(`시간당 호출 제한(${COST_SAFETY_CONFIG.hourlyLimit}회)을 초과했습니다.`);
      case 'EMERGENCY_SHUTDOWN_ACTIVE':
        throw new RateLimitError('비상 셧다운이 활성화되어 있습니다. 관리자에게 문의하세요.');
      case 'AUTH_ME_SINGLE_CALL_ONLY':
        throw new RateLimitError('auth/me 엔드포인트는 앱 전체에서 1회만 호출 가능합니다.');
      case 'CACHE_HIT':
        // 캐시된 응답이 있는 경우 반환
        if (result.cachedResponse) {
          return result.cachedResponse;
        }
        throw new RateLimitError('중복 호출입니다. 1분 후 다시 시도해주세요.');
      default:
        throw new RateLimitError('API 호출이 제한되었습니다.');
    }
  }

  // 로그 기록
  logger.info('API 호출 허용', {
    component: 'CostSafety',
    metadata: {
      endpoint,
      remainingCalls: result.remainingCalls,
      type: 'api_call_allowed',
    },
  });
}

export function setCachedResponse(endpoint: string, data: any): void {
  costSafety.setCachedResponse(endpoint, data);
}

export function reportApiCost(cost: number): void {
  costSafety.reportCost(cost);
}

// ===========================================
// 응답 헬퍼
// ===========================================

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  metadata?: {
    requestId: string;
    timestamp: string;
    userId?: string;
    cost?: number;
    processingTime?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    userId?: string;
  };
}

export function createSuccessResponse<T>(
  data: T,
  metadata?: Partial<ApiSuccessResponse['metadata']>
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  return NextResponse.json(response, { status: 200 });
}

export function createErrorResponse(
  error: PlanningApiError,
  metadata?: Partial<ApiErrorResponse['metadata']>
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  // 에러 로깅
  logger.error(
    `API 에러: ${error.code}`,
    error,
    {
      component: 'PlanningAPI',
      metadata: {
        ...response.metadata,
        errorCode: error.code,
        errorStatus: error.status,
      },
    }
  );

  return NextResponse.json(response, { status: error.status });
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  metadata?: Partial<ApiSuccessResponse['metadata']>
): NextResponse {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const response = {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  return NextResponse.json(response, { status: 200 });
}

// ===========================================
// API 핸들러 래퍼
// ===========================================

export interface ApiHandlerOptions {
  requireAuth?: boolean;
  costSafety?: boolean;
  endpoint?: string;
}

export function withApiHandler(
  handler: (
    request: NextRequest,
    context: { params?: any; user?: JwtPayload }
  ) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest, context: { params?: any } = {}) => {
    const startTime = Date.now();
    let user: JwtPayload | undefined;

    try {
      // 1. 인증 검증
      if (options.requireAuth !== false) {
        user = requireAuth(request);
      }

      // 2. 비용 안전 미들웨어 적용
      if (options.costSafety !== false) {
        const endpoint = options.endpoint || new URL(request.url).pathname;
        await applyCostSafety(endpoint);
      }

      // 3. 실제 핸들러 실행
      const response = await handler(request, { ...context, user });

      // 4. 성공 로깅
      const processingTime = Date.now() - startTime;
      logger.logApiRequest(
        request.method,
        new URL(request.url).pathname,
        response.status,
        processingTime,
        {
          userId: user?.userId,
          metadata: {
            success: true,
            processingTime,
          },
        }
      );

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 에러 처리
      if (error instanceof PlanningApiError) {
        logger.logApiRequest(
          request.method,
          new URL(request.url).pathname,
          error.status,
          processingTime,
          {
            userId: user?.userId,
            metadata: {
              success: false,
              errorCode: error.code,
              processingTime,
            },
          }
        );

        return createErrorResponse(error, {
          userId: user?.userId,
          processingTime,
        });
      }

      // 예상치 못한 에러
      logger.error('예상치 못한 API 에러', error instanceof Error ? error : new Error(String(error)), {
        userId: user?.userId,
        component: 'PlanningAPI',
        metadata: {
          method: request.method,
          url: request.url,
          processingTime,
        },
      });

      return createErrorResponse(
        new PlanningApiError('내부 서버 오류가 발생했습니다.', 'INTERNAL_ERROR', 500),
        {
          userId: user?.userId,
          processingTime,
        }
      );
    }
  };
}

// ===========================================
// CORS 헤더 설정
// ===========================================

export function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

export function handleCorsPreflightRequest(): NextResponse {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response);
}

// ===========================================
// 비용 안전 상태 조회
// ===========================================

export function getCostSafetyStatus() {
  return costSafety.getStatus();
}