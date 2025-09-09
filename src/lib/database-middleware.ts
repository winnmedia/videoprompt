// Database error handling middleware
import { NextResponse } from 'next/server';
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library';
import { prisma, checkDatabaseConnection } from '@/lib/db';

export interface DatabaseOperationOptions {
  retries?: number;
  timeout?: number;
  fallbackMessage?: string;
}

export interface DatabaseErrorResponse {
  error: string;
  code?: string;
  details?: string;
  timestamp: string;
  retryable?: boolean;
}

/**
 * 데이터베이스 오류 분류 및 처리
 */
export const classifyDatabaseError = (error: unknown): {
  isRetryable: boolean;
  httpStatus: number;
  userMessage: string;
  technicalDetails: string;
} => {
  // Prisma 클라이언트 알려진 오류
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          isRetryable: false,
          httpStatus: 409,
          userMessage: '중복된 데이터가 존재합니다.',
          technicalDetails: `Unique constraint violation: ${error.meta?.target}`
        };
      
      case 'P2025': // Record not found
        return {
          isRetryable: false,
          httpStatus: 404,
          userMessage: '요청한 데이터를 찾을 수 없습니다.',
          technicalDetails: 'Record not found'
        };
      
      case 'P2003': // Foreign key constraint
        return {
          isRetryable: false,
          httpStatus: 400,
          userMessage: '관련된 데이터가 존재하지 않습니다.',
          technicalDetails: `Foreign key constraint: ${error.meta?.field_name}`
        };
      
      case 'P1001': // Database server unreachable
      case 'P1002': // Database server timeout
        return {
          isRetryable: true,
          httpStatus: 503,
          userMessage: '데이터베이스 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
          technicalDetails: `Connection error: ${error.code}`
        };
      
      case 'P1008': // Operation timeout
        return {
          isRetryable: true,
          httpStatus: 504,
          userMessage: '요청 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          technicalDetails: 'Database operation timeout'
        };
      
      default:
        return {
          isRetryable: false,
          httpStatus: 500,
          userMessage: '데이터베이스 오류가 발생했습니다.',
          technicalDetails: `Prisma error ${error.code}: ${error.message}`
        };
    }
  }

  // Prisma 클라이언트 알 수 없는 오류
  if (error instanceof PrismaClientUnknownRequestError) {
    return {
      isRetryable: true,
      httpStatus: 503,
      userMessage: '데이터베이스 서비스가 일시적으로 사용할 수 없습니다.',
      technicalDetails: 'Unknown database error'
    };
  }

  // 네트워크 관련 오류
  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
      return {
        isRetryable: true,
        httpStatus: 503,
        userMessage: '데이터베이스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
        technicalDetails: `Network error: ${error.message}`
      };
    }
  }

  // 기타 오류
  return {
    isRetryable: false,
    httpStatus: 500,
    userMessage: '예상치 못한 오류가 발생했습니다.',
    technicalDetails: error instanceof Error ? error.message : '알 수 없는 오류'
  };
};

/**
 * 데이터베이스 작업 실행 래퍼 (재시도 로직 포함)
 */
export async function executeDatabaseOperation<T>(
  operation: () => Promise<T>,
  options: DatabaseOperationOptions = {}
): Promise<T> {
  const { retries = 2, timeout = 10000, fallbackMessage = '데이터베이스 작업 실패' } = options;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // 연결 상태 확인 (첫 번째 시도가 아닌 경우)
      if (attempt > 1) {
        console.log(`🔄 데이터베이스 작업 재시도 중... (${attempt}/${retries + 1})`);
        const connectionCheck = await checkDatabaseConnection(prisma, 1);
        if (!connectionCheck.success) {
          throw new Error('데이터베이스 연결 확인 실패');
        }
      }

      // 타임아웃 설정
      const operationPromise = operation();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('작업 시간 초과')), timeout);
      });

      return await Promise.race([operationPromise, timeoutPromise]);

    } catch (error) {
      const errorInfo = classifyDatabaseError(error);
      
      console.error(`❌ 데이터베이스 작업 실패 (시도 ${attempt}/${retries + 1}):`, {
        error: errorInfo.technicalDetails,
        retryable: errorInfo.isRetryable
      });

      // 마지막 시도이거나 재시도 불가능한 오류인 경우
      if (attempt === retries + 1 || !errorInfo.isRetryable) {
        throw error;
      }

      // 재시도 전 대기 (지수 백오프)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(fallbackMessage);
}

/**
 * API 라우트용 데이터베이스 에러 응답 생성
 */
export function createDatabaseErrorResponse(
  error: unknown,
  requestId?: string
): NextResponse<DatabaseErrorResponse> {
  const errorInfo = classifyDatabaseError(error);
  
  const response: DatabaseErrorResponse = {
    error: errorInfo.userMessage,
    code: error instanceof PrismaClientKnownRequestError ? error.code : undefined,
    details: process.env.NODE_ENV === 'development' ? errorInfo.technicalDetails : undefined,
    timestamp: new Date().toISOString(),
    retryable: errorInfo.isRetryable
  };

  // 로깅
  console.error('🚨 데이터베이스 오류 응답:', {
    requestId,
    httpStatus: errorInfo.httpStatus,
    error: errorInfo.technicalDetails,
    userMessage: errorInfo.userMessage
  });

  return NextResponse.json(response, { status: errorInfo.httpStatus });
}

/**
 * Graceful degradation을 위한 데이터베이스 상태 확인
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const result = await checkDatabaseConnection(prisma, 1);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * API 라우트에서 사용할 데이터베이스 헬스 체크 미들웨어
 */
export async function withDatabaseHealthCheck<T>(
  operation: () => Promise<T>,
  fallbackResponse?: T
): Promise<T> {
  const isHealthy = await isDatabaseHealthy();
  
  if (!isHealthy && fallbackResponse !== undefined) {
    console.warn('⚠️ 데이터베이스 비정상 상태 - 폴백 응답 반환');
    return fallbackResponse;
  }
  
  if (!isHealthy) {
    throw new Error('데이터베이스 서비스가 사용할 수 없습니다');
  }
  
  return await operation();
}