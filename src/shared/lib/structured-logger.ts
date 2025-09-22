/**
 * 구조화된 로그 시스템
 *
 * 기능:
 * - 구조화된 로그 포맷
 * - 로그 레벨별 출력
 * - 민감한 정보 자동 마스킹
 * - 성능 메트릭 추적
 * - 에러 컨텍스트 수집
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  stack?: string;
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

interface PerformanceTimer {
  start: number;
  label: string;
}

export class StructuredLogger {
  private static instance: StructuredLogger;
  private logLevel: LogLevel;
  private sensitiveKeys = [
    'password', 'secret', 'token', 'key', 'apikey', 'authorization',
    'cookie', 'session', 'jwt', 'auth', 'credential', 'private'
  ];
  private performanceTimers = new Map<string, PerformanceTimer>();

  private constructor() {
    this.logLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return validLevels.includes(level as LogLevel) ? (level as LogLevel) : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    const masked = { ...data };
    for (const key in masked) {
      if (this.sensitiveKeys.some(sensitive =>
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        const value = masked[key];
        if (typeof value === 'string' && value.length > 0) {
          masked[key] = `***${value.slice(-4)}`;
        } else {
          masked[key] = '***MASKED***';
        }
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }
    return masked;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.maskSensitiveData(context),
    };

    if (error) {
      entry.stack = error.stack;
    }

    // 성능 정보 추가
    if (typeof window === 'undefined' && process.memoryUsage) {
      entry.performance = {
        memoryUsage: process.memoryUsage(),
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const logString = JSON.stringify(entry, null, 2);

    switch (entry.level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }

  /**
   * 디버그 로그
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createLogEntry('debug', message, context);
    this.output(entry);
  }

  /**
   * 정보 로그
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createLogEntry('info', message, context);
    this.output(entry);
  }

  /**
   * 경고 로그
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createLogEntry('warn', message, context);
    this.output(entry);
  }

  /**
   * 에러 로그
   */
  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createLogEntry('error', message, context, error);
    this.output(entry);
  }

  /**
   * 성능 측정 시작
   */
  startPerformanceTimer(label: string): void {
    this.performanceTimers.set(label, {
      start: performance.now(),
      label,
    });
  }

  /**
   * 성능 측정 종료 및 로그
   */
  endPerformanceTimer(label: string, context?: LogContext): void {
    const timer = this.performanceTimers.get(label);
    if (!timer) {
      this.warn(`성능 타이머 '${label}'을 찾을 수 없음`);
      return;
    }

    const duration = performance.now() - timer.start;
    this.performanceTimers.delete(label);

    this.info(`성능 측정: ${label}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        duration: `${duration.toFixed(2)}ms`,
        performanceTimer: label,
      },
    });
  }

  /**
   * API 요청 로그
   */
  logApiRequest(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';

    this[level](`API 요청: ${method} ${url} - ${status}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        method,
        url,
        status,
        duration: `${duration}ms`,
        type: 'api_request',
      },
    });
  }

  /**
   * 사용자 액션 로그
   */
  logUserAction(
    action: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`사용자 액션: ${action}`, {
      userId,
      action,
      metadata: {
        ...metadata,
        type: 'user_action',
      },
    });
  }

  /**
   * 비즈니스 이벤트 로그
   */
  logBusinessEvent(
    event: string,
    data: Record<string, any>,
    context?: LogContext
  ): void {
    this.info(`비즈니스 이벤트: ${event}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        ...data,
        type: 'business_event',
        event,
      },
    });
  }

  /**
   * 보안 이벤트 로그
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    context?: LogContext
  ): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this[level](`보안 이벤트: ${event}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        ...details,
        type: 'security_event',
        event,
        severity,
      },
    });
  }

  /**
   * $300 사건 관련 비용 로그
   */
  logCostEvent(
    event: string,
    cost: number,
    details: Record<string, any>,
    context?: LogContext
  ): void {
    const level = cost > 50 ? 'error' : cost > 10 ? 'warn' : 'info';

    this[level](`비용 이벤트: ${event} - $${cost}`, {
      ...context,
      metadata: {
        ...context?.metadata,
        ...details,
        type: 'cost_event',
        event,
        cost,
        costUSD: cost,
      },
    });
  }

  /**
   * 시스템 상태 로그
   */
  logSystemHealth(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: Record<string, any>,
    context?: LogContext
  ): void {
    const level = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info';

    this[level](`시스템 상태: ${component} - ${status}`, {
      ...context,
      component,
      metadata: {
        ...context?.metadata,
        ...metrics,
        type: 'system_health',
        component,
        status,
      },
    });
  }
}

// 싱글톤 인스턴스 export
export const logger = StructuredLogger.getInstance();

// 기본 export (기존 코드 호환성)
export default logger;

// 편의 함수들
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context);

export const logApiRequest = (method: string, url: string, status: number, duration: number, context?: LogContext) =>
  logger.logApiRequest(method, url, status, duration, context);

export const logUserAction = (action: string, userId?: string, metadata?: Record<string, any>) =>
  logger.logUserAction(action, userId, metadata);

export const logBusinessEvent = (event: string, data: Record<string, any>, context?: LogContext) =>
  logger.logBusinessEvent(event, data, context);

export const logSecurityEvent = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, any>, context?: LogContext) =>
  logger.logSecurityEvent(event, severity, details, context);

export const logCostEvent = (event: string, cost: number, details: Record<string, any>, context?: LogContext) =>
  logger.logCostEvent(event, cost, details, context);

export const startTimer = (label: string) => logger.startPerformanceTimer(label);
export const endTimer = (label: string, context?: LogContext) => logger.endPerformanceTimer(label, context);