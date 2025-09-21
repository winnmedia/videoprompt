import { logger } from '@/shared/lib/logger';

/**
 * 강화된 구조화 로깅 시스템
 *
 * - 레벨별 로깅 (DEBUG, INFO, WARN, ERROR)
 * - 구조화된 메타데이터
 * - 프로덕션 환경 최적화
 * - 성능 메트릭 추적
 * - 오류 컨텍스트 보존
 * - Gemini API 호출 추적
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogMetadata {
  timestamp: string;
  level: LogLevel;
  service: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  gemini?: {
    model: string;
    tokensUsed?: number;
    rateLimitRemaining?: number;
    retryCount?: number;
  };
  performance?: {
    memory: NodeJS.MemoryUsage;
    timing: {
      [key: string]: number;
    };
  };
  [key: string]: any;
}

class Logger {
  private currentLevel: LogLevel;
  private context: Record<string, unknown> = {};

  constructor() {
    // 환경별 로그 레벨 설정
    this.currentLevel = this.getLogLevel();
  }

  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    const nodeEnv = process.env.NODE_ENV;

    if (envLevel) {
      switch (envLevel) {
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
      }
    }

    // 기본값: 환경별 설정
    return nodeEnv === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }

  private formatMessage(level: LogLevel, message: string, metadata: Record<string, unknown> = {}): string {
    const baseMetadata: LogMetadata = {
      timestamp: new Date().toISOString(),
      level,
      service: 'videoprompt-api',
      ...this.context,
      ...metadata
    };

    // 민감 정보 마스킹
    const sanitizedMetadata = maskSensitiveData(baseMetadata);

    // 개발 환경: 읽기 쉬운 형태
    if (process.env.NODE_ENV === 'development') {
      const levelName = LogLevel[level];
      const operation = sanitizedMetadata.operation ? ` [${sanitizedMetadata.operation}]` : '';
      const duration = sanitizedMetadata.duration ? ` (${sanitizedMetadata.duration}ms)` : '';

      return `[${sanitizedMetadata.timestamp}] ${levelName}${operation}: ${message}${duration}`;
    }

    // 프로덕션 환경: JSON 구조화
    return JSON.stringify({
      message,
      ...sanitizedMetadata
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  debug(message: string, metadata: Record<string, unknown> = {}): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      logger.debug(this.formatMessage(LogLevel.DEBUG, message, metadata));
    }
  }

  info(message: string, metadata: Record<string, unknown> = {}): void {
    if (this.shouldLog(LogLevel.INFO)) {
      logger.info(this.formatMessage(LogLevel.INFO, message, metadata));
    }
  }

  warn(message: string, metadata: Record<string, unknown> = {}): void {
    if (this.shouldLog(LogLevel.WARN)) {
      logger.warn(this.formatMessage(LogLevel.WARN, message, metadata));
    }
  }

  error(message: string, error?: Error, metadata: Record<string, unknown> = {}): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMetadata = error ? {
        error: {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          code: (error as any).code
        }
      } : {};

      console.error(this.formatMessage(LogLevel.ERROR, message, {
        ...metadata,
        ...errorMetadata
      }));
    }
  }

  /**
   * API 요청 시작 로깅
   */
  apiStart(operation: string, metadata: Record<string, unknown> = {}): string {
    const requestId = generateRequestId();

    this.info(`API request started: ${operation}`, {
      operation,
      requestId,
      ...metadata
    });

    return requestId;
  }

  /**
   * API 요청 완료 로깅
   */
  apiEnd(
    operation: string,
    requestId: string,
    startTime: number,
    statusCode: number,
    metadata: Record<string, unknown> = {}
  ): void {
    const duration = Date.now() - startTime;
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `API request completed: ${operation}`;

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, {
        operation,
        requestId,
        duration,
        statusCode,
        ...metadata
      });
    } else {
      this.info(message, {
        operation,
        requestId,
        duration,
        statusCode,
        ...metadata
      });
    }
  }

  /**
   * Gemini API 호출 로깅
   */
  geminiCall(
    model: string,
    operation: string,
    metadata: Record<string, unknown> = {}
  ): void {
    this.info(`Gemini API call: ${operation}`, {
      operation: `gemini-${operation}`,
      gemini: {
        model,
        ...metadata.gemini
      },
      ...metadata
    });
  }

  /**
   * 성능 메트릭 로깅
   */
  performance(
    operation: string,
    timing: { [key: string]: number },
    metadata: Record<string, unknown> = {}
  ): void {
    this.info(`Performance metrics: ${operation}`, {
      operation,
      performance: {
        memory: process.memoryUsage(),
        timing
      },
      ...metadata
    });
  }

  /**
   * Rate limit 로깅
   */
  rateLimitHit(
    limiterName: string,
    key: string,
    remaining: number,
    resetTime: number
  ): void {
    this.warn(`Rate limit hit: ${limiterName}`, {
      operation: 'rate-limit-hit',
      rateLimitInfo: {
        limiterName,
        key: key.startsWith('ip:') ? key : '[REDACTED]', // IP만 로깅
        remaining,
        resetTime: new Date(resetTime).toISOString()
      }
    });
  }

  /**
   * 보안 이벤트 로깅
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata: Record<string, unknown> = {}
  ): void {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN;
    const message = `Security event: ${event}`;

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, {
        operation: 'security-event',
        securityEvent: {
          event,
          severity
        },
        ...metadata
      });
    } else {
      this.warn(message, {
        operation: 'security-event',
        securityEvent: {
          event,
          severity
        },
        ...metadata
      });
    }
  }

  // Legacy 호환성을 위한 기존 메서드들
  apiError(endpoint: string, error: Error | unknown): void {
    this.error(`API 호출 실패: ${endpoint}`, error instanceof Error ? error : new Error(String(error)));
  }

  userAction(action: string, data?: Record<string, unknown>): void {
    this.info(`사용자 액션: ${action}`, { userActionData: data });
  }
}

/**
 * 요청 ID 생성
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 민감 정보 마스킹
 */
function maskSensitiveData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'apikey', 'authorization', 'cookie', 'email'];
  const masked = { ...data };

  for (const key in masked) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      if (typeof masked[key] === 'string' && masked[key].length > 8) {
        masked[key] = `${masked[key].substring(0, 4)}****${masked[key].slice(-4)}`;
      } else {
        masked[key] = '[REDACTED]';
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

/**
 * 성능 타이머
 */
export class PerformanceTimer {
  private startTime: number;
  private markers: { [key: string]: number } = {};

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.markers[name] = Date.now() - this.startTime;
  }

  getTiming(): { [key: string]: number } {
    return {
      total: Date.now() - this.startTime,
      ...this.markers
    };
  }
}

// 싱글톤 인스턴스 (기존 호환성 유지)
export const logger = new Logger();

// 전역 에러 핸들러 (Next.js API 라우트용)
export function withErrorLogging<T extends (...args: unknown[]) => unknown>(
  handler: T,
  operation: string
): T {
  return (async (...args: unknown[]) => {
    const startTime = Date.now();
    const requestId = logger.apiStart(operation);

    try {
      const result = await handler(...args);
      logger.apiEnd(operation, requestId, startTime, 200);
      return result;
    } catch (error) {
      logger.apiEnd(operation, requestId, startTime, 500);
      logger.error(`Operation failed: ${operation}`, error as Error, {
        operation,
        requestId
      });
      throw error;
    }
  }) as T;
}





