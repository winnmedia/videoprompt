/**
 * Structured Logger
 *
 * CLAUDE.md 준수: 개발/프로덕션 환경별 로깅, 에러 추적
 * $300 사건 방지: 로그 레벨 제어로 과도한 출력 방지
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component?: string
  action?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
  // 동적 속성 지원 (sceneId, from, error, settings, fileName, count, index, title, imageId 등)
  [key: string]: any
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: Error | string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isTest = process.env.NODE_ENV === 'test'

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private shouldLog(level: LogLevel): boolean {
    // 테스트 환경에서는 에러만 로깅
    if (this.isTest) {
      return level === 'error'
    }

    // 프로덕션에서는 info 이상만 로깅
    if (!this.isDevelopment) {
      return ['info', 'warn', 'error'].includes(level)
    }

    // 개발 환경에서는 모든 레벨 로깅
    return true
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error | string
  ): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
      error
    }
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const logMessage = this.isDevelopment
      ? this.formatDevelopmentLog(entry)
      : this.formatProductionLog(entry)

    switch (entry.level) {
      case 'debug':
        console.debug(logMessage)
        break
      case 'info':
        console.info(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      case 'error':
        console.error(logMessage)
        break
    }
  }

  private formatDevelopmentLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry

    let logParts = [
      `[${timestamp}]`,
      `[${level.toUpperCase()}]`
    ]

    if (context?.component) {
      logParts.push(`[${context.component}]`)
    }

    if (context?.action) {
      logParts.push(`[${context.action}]`)
    }

    logParts.push(message)

    if (context?.metadata) {
      logParts.push(`Context: ${JSON.stringify(context.metadata, null, 2)}`)
    }

    if (error) {
      if (error instanceof Error) {
        logParts.push(`Error: ${error.message}`)
        if (error.stack) {
          logParts.push(`Stack: ${error.stack}`)
        }
      } else {
        logParts.push(`Error: ${error}`)
      }
    }

    return logParts.join(' ')
  }

  private formatProductionLog(entry: LogEntry): any {
    // 프로덕션에서는 JSON 형태로 구조화된 로그
    return JSON.stringify(entry)
  }

  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('debug', message, context)
    this.output(entry)
  }

  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, context)
    this.output(entry)
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, context)
    this.output(entry)
  }

  error(message: string, error?: Error | string, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, context, error)
    this.output(entry)
  }

  // 성능 추적을 위한 특별 메서드
  performance(action: string, startTime: number, context?: LogContext): void {
    const duration = Date.now() - startTime
    this.info(`Performance: ${action} completed in ${duration}ms`, {
      ...context,
      action,
      metadata: {
        ...context?.metadata,
        duration,
        startTime
      }
    })
  }

  // API 호출 추적 ($300 사건 방지)
  apiCall(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info'

    this[level](`API ${method} ${url} - ${status} (${duration}ms)`, {
      ...context,
      action: 'api_call',
      metadata: {
        ...context?.metadata,
        method,
        url,
        status,
        duration
      }
    })
  }

  // 사용자 액션 추적
  userAction(
    action: string,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`User action: ${action}`, {
      action: 'user_action',
      userId,
      metadata: {
        userAction: action,
        ...metadata
      }
    })
  }
}

// 싱글톤 인스턴스
const logger = new Logger()

export { Logger, type LogLevel, type LogContext }
export default logger