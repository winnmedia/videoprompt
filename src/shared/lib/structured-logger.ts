/**
 * 구조화된 로깅 시스템
 * 데이터 파이프라인 모니터링 및 디버깅을 위한 결정론적 로깅
 */

import { z } from 'zod';

// ============================================
// 로그 레벨 및 카테고리 정의
// ============================================

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE',
}

export enum LogCategory {
  DATABASE = 'DATABASE',
  API = 'API',
  VALIDATION = 'VALIDATION',
  TRANSFORMATION = 'TRANSFORMATION',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
}

// ============================================
// 로그 엔트리 스키마
// ============================================

const LogContextSchema = z.object({
  requestId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  endpoint: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
});

const LogMetricsSchema = z.object({
  duration: z.number().min(0).optional(),
  memoryUsage: z.number().min(0).optional(),
  dbConnections: z.number().int().min(0).optional(),
  responseSize: z.number().min(0).optional(),
});

const LogEntrySchema = z.object({
  timestamp: z.string().datetime(),
  level: z.nativeEnum(LogLevel),
  category: z.nativeEnum(LogCategory),
  message: z.string().min(1),
  context: LogContextSchema.optional(),
  data: z.record(z.string(), z.any()).optional(),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
  }).optional(),
  metrics: LogMetricsSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export type LogContext = z.infer<typeof LogContextSchema>;
export type LogMetrics = z.infer<typeof LogMetricsSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;

// ============================================
// 구조화된 로거 클래스
// ============================================

export class StructuredLogger {
  private static instance: StructuredLogger;
  private context: LogContext = {};

  private constructor() {}

  public static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  /**
   * 글로벌 컨텍스트 설정
   */
  public setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 컨텍스트 초기화
   */
  public clearContext(): void {
    this.context = {};
  }

  /**
   * 기본 로그 엔트리 생성
   */
  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    options: {
      data?: Record<string, any>;
      error?: Error;
      metrics?: LogMetrics;
      tags?: string[];
      context?: LogContext;
    } = {}
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context: { ...this.context, ...options.context },
      data: options.data,
      metrics: options.metrics,
      tags: options.tags,
    };

    // 에러 정보 추가
    if (options.error) {
      entry.error = {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack,
        code: (options.error as any).code,
      };
    }

    // 스키마 검증
    const validation = LogEntrySchema.safeParse(entry);
    if (!validation.success) {
      console.error('로그 엔트리 스키마 검증 실패:', validation.error);
    }

    return entry;
  }

  /**
   * 로그 출력 (환경에 따른 포맷팅)
   */
  private output(entry: LogEntry): void {
    if (process.env.NODE_ENV === 'production') {
      // 프로덕션: JSON 형태로 구조화된 로그
      console.log(JSON.stringify(entry));
    } else {
      // 개발환경: 가독성 있는 형태로 출력
      const contextStr = entry.context && Object.keys(entry.context).length > 0
        ? ` [${Object.entries(entry.context).map(([k, v]) => `${k}=${v}`).join(', ')}]`
        : '';

      const metricsStr = entry.metrics
        ? ` (${Object.entries(entry.metrics).map(([k, v]) => `${k}=${v}`).join(', ')})`
        : '';

      console.log(
        `[${entry.timestamp}] ${entry.level} ${entry.category}${contextStr}: ${entry.message}${metricsStr}`
      );

      if (entry.data) {
        console.log('Data:', JSON.stringify(entry.data, null, 2));
      }

      if (entry.error) {
        console.error('Error:', entry.error);
      }
    }
  }

  /**
   * 에러 로그
   */
  public error(
    category: LogCategory,
    message: string,
    error?: Error,
    data?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.ERROR, category, message, {
      error,
      data,
      tags: ['error'],
    });
    this.output(entry);
  }

  /**
   * 경고 로그
   */
  public warn(
    category: LogCategory,
    message: string,
    data?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.WARN, category, message, {
      data,
      tags: ['warning'],
    });
    this.output(entry);
  }

  /**
   * 정보 로그
   */
  public info(
    category: LogCategory,
    message: string,
    data?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.INFO, category, message, {
      data,
    });
    this.output(entry);
  }

  /**
   * 디버그 로그 (개발환경에서만 출력)
   */
  public debug(
    category: LogCategory,
    message: string,
    data?: Record<string, any>
  ): void {
    if (process.env.NODE_ENV !== 'production') {
      const entry = this.createLogEntry(LogLevel.DEBUG, category, message, {
        data,
        tags: ['debug'],
      });
      this.output(entry);
    }
  }

  /**
   * 성능 메트릭 로그
   */
  public performance(
    category: LogCategory,
    message: string,
    metrics: LogMetrics,
    data?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.INFO, category, message, {
      metrics,
      data,
      tags: ['performance'],
    });
    this.output(entry);
  }

  /**
   * 데이터베이스 연산 로그
   */
  public database(
    operation: string,
    success: boolean,
    duration: number,
    details?: Record<string, any>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Database ${operation} ${success ? 'succeeded' : 'failed'}`;

    const entry = this.createLogEntry(level, LogCategory.DATABASE, message, {
      data: {
        operation,
        success,
        ...details,
      },
      metrics: { duration },
      tags: ['database', success ? 'success' : 'failure'],
    });

    this.output(entry);
  }

  /**
   * API 요청/응답 로그
   */
  public apiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    details?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `API ${method} ${endpoint} responded with ${statusCode}`;

    const entry = this.createLogEntry(level, LogCategory.API, message, {
      data: {
        method,
        endpoint,
        statusCode,
        ...details,
      },
      metrics: { duration },
      tags: ['api', statusCode >= 400 ? 'error' : 'success'],
    });

    this.output(entry);
  }

  /**
   * 데이터 변환 로그
   */
  public transformation(
    type: string,
    success: boolean,
    recordCount: number,
    duration: number,
    details?: Record<string, any>
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Data transformation ${type} ${success ? 'completed' : 'failed'} for ${recordCount} records`;

    const entry = this.createLogEntry(level, LogCategory.TRANSFORMATION, message, {
      data: {
        type,
        success,
        recordCount,
        ...details,
      },
      metrics: { duration },
      tags: ['transformation', success ? 'success' : 'failure'],
    });

    this.output(entry);
  }

  /**
   * 보안 관련 로그
   */
  public security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): void {
    const levelMap = {
      low: LogLevel.INFO,
      medium: LogLevel.WARN,
      high: LogLevel.ERROR,
      critical: LogLevel.ERROR,
    };

    const entry = this.createLogEntry(levelMap[severity], LogCategory.SECURITY, event, {
      data: {
        severity,
        ...details,
      },
      tags: ['security', severity],
    });

    this.output(entry);
  }
}

// ============================================
// 성능 측정 유틸리티
// ============================================

export class PerformanceTracker {
  private startTime: number;
  private operation: string;
  private logger: StructuredLogger;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
    this.logger = StructuredLogger.getInstance();
  }

  /**
   * 성능 측정 완료 및 로그 기록
   */
  public end(
    category: LogCategory,
    success: boolean = true,
    additionalData?: Record<string, any>
  ): number {
    const duration = Date.now() - this.startTime;

    this.logger.performance(
      category,
      `${this.operation} completed`,
      { duration },
      {
        operation: this.operation,
        success,
        ...additionalData,
      }
    );

    return duration;
  }

  /**
   * 중간 체크포인트 기록
   */
  public checkpoint(message: string, data?: Record<string, any>): number {
    const elapsed = Date.now() - this.startTime;

    this.logger.debug(
      LogCategory.PERFORMANCE,
      `${this.operation} checkpoint: ${message}`,
      {
        operation: this.operation,
        elapsed,
        ...data,
      }
    );

    return elapsed;
  }
}

// ============================================
// 편의 함수들
// ============================================

export const logger = StructuredLogger.getInstance();

/**
 * 성능 측정 데코레이터
 */
export function measurePerformance(operation: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracker = new PerformanceTracker(`${operation}.${propertyName}`);

      try {
        const result = await originalMethod.apply(this, args);
        tracker.end(LogCategory.PERFORMANCE, true);
        return result;
      } catch (error) {
        tracker.end(LogCategory.PERFORMANCE, false, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 함수 래핑을 통한 성능 측정
 */
export async function withPerformanceLogging<T>(
  operation: string,
  category: LogCategory,
  fn: () => Promise<T>
): Promise<T> {
  const tracker = new PerformanceTracker(operation);

  try {
    const result = await fn();
    tracker.end(category, true);
    return result;
  } catch (error) {
    tracker.end(category, false, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}