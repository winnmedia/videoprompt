/**
 * Video Generation Error Handler
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * 영상 생성 과정의 에러 처리 및 복구 전략
 */

import logger from './logger'
import { VideoProvider } from '../entities/video'

/**
 * 에러 분류
 */
export enum ErrorCategory {
  VALIDATION = 'validation',      // 입력 검증 오류
  AUTHENTICATION = 'auth',        // 인증 오류
  AUTHORIZATION = 'authz',        // 권한 오류
  RATE_LIMIT = 'rate_limit',     // 요청 제한 오류
  QUOTA_EXCEEDED = 'quota',       // 할당량 초과
  PAYMENT_REQUIRED = 'payment',   // 결제 필요
  NETWORK = 'network',           // 네트워크 오류
  SERVER_ERROR = 'server',       // 서버 오류
  TIMEOUT = 'timeout',           // 타임아웃
  UNKNOWN = 'unknown'            // 알 수 없는 오류
}

/**
 * 에러 심각도
 */
export enum ErrorSeverity {
  LOW = 'low',        // 로그만 기록
  MEDIUM = 'medium',  // 알림 + 로그
  HIGH = 'high',      // 즉시 알림 + 에러 추적
  CRITICAL = 'critical' // 긴급 알림 + 시스템 중단
}

/**
 * 복구 전략
 */
export enum RecoveryStrategy {
  RETRY = 'retry',                    // 재시도
  FALLBACK_PROVIDER = 'fallback',     // 다른 제공업체로 전환
  QUEUE_DELAY = 'queue_delay',        // 큐에 지연 추가
  USER_NOTIFICATION = 'notify_user',  // 사용자에게 알림
  ADMIN_INTERVENTION = 'admin',       // 관리자 개입 필요
  NO_RECOVERY = 'no_recovery'         // 복구 불가
}

/**
 * 에러 컨텍스트
 */
export interface ErrorContext {
  provider: VideoProvider
  userId?: string
  projectId?: string
  videoGenerationId?: string
  requestId?: string
  timestamp: Date
  additionalData?: Record<string, unknown>
}

/**
 * 처리된 에러 정보
 */
export interface ProcessedError {
  originalError: Error
  category: ErrorCategory
  severity: ErrorSeverity
  recoveryStrategy: RecoveryStrategy
  retryable: boolean
  retryDelay?: number
  userMessage: string
  technicalMessage: string
  context: ErrorContext
}

/**
 * 에러 패턴 매칭
 */
interface ErrorPattern {
  pattern: RegExp | string
  category: ErrorCategory
  severity: ErrorSeverity
  recoveryStrategy: RecoveryStrategy
  retryable: boolean
  retryDelay?: number
  userMessage: string
}

/**
 * 영상 생성 에러 핸들러
 */
export class VideoErrorHandler {
  private static readonly ERROR_PATTERNS: ErrorPattern[] = [
    // 인증 관련
    {
      pattern: /unauthorized|401/i,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.ADMIN_INTERVENTION,
      retryable: false,
      userMessage: '인증에 실패했습니다. 잠시 후 다시 시도해주세요.'
    },

    // 권한 관련
    {
      pattern: /forbidden|403/i,
      category: ErrorCategory.AUTHORIZATION,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.USER_NOTIFICATION,
      retryable: false,
      userMessage: '권한이 없습니다. 계정 상태를 확인해주세요.'
    },

    // 요청 제한
    {
      pattern: /rate limit|429/i,
      category: ErrorCategory.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.QUEUE_DELAY,
      retryable: true,
      retryDelay: 60000, // 1분
      userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
    },

    // 할당량 초과
    {
      pattern: /quota|limit exceeded/i,
      category: ErrorCategory.QUOTA_EXCEEDED,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.FALLBACK_PROVIDER,
      retryable: false,
      userMessage: '일일 생성 한도를 초과했습니다. 내일 다시 시도하거나 다른 방법을 이용해주세요.'
    },

    // 결제 필요
    {
      pattern: /payment required|402|insufficient credits/i,
      category: ErrorCategory.PAYMENT_REQUIRED,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.USER_NOTIFICATION,
      retryable: false,
      userMessage: '크레딧이 부족합니다. 크레딧을 충전하거나 다른 방법을 이용해주세요.'
    },

    // 네트워크 오류
    {
      pattern: /network|connection|dns|ENOTFOUND|ECONNREFUSED/i,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      retryDelay: 5000, // 5초
      userMessage: '네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해주세요.'
    },

    // 타임아웃
    {
      pattern: /timeout|408/i,
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      retryDelay: 10000, // 10초
      userMessage: '요청 시간이 초과되었습니다. 다시 시도해주세요.'
    },

    // 서버 오류
    {
      pattern: /5\d{2}|server error|internal error/i,
      category: ErrorCategory.SERVER_ERROR,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.FALLBACK_PROVIDER,
      retryable: true,
      retryDelay: 30000, // 30초
      userMessage: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    },

    // 입력 검증 오류
    {
      pattern: /validation|invalid|bad request|400/i,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.USER_NOTIFICATION,
      retryable: false,
      userMessage: '입력 내용을 확인하고 다시 시도해주세요.'
    }
  ]

  /**
   * 에러 처리 및 분석
   */
  static processError(error: Error, context: ErrorContext): ProcessedError {
    const pattern = this.matchErrorPattern(error)

    const processedError: ProcessedError = {
      originalError: error,
      category: pattern.category,
      severity: pattern.severity,
      recoveryStrategy: pattern.recoveryStrategy,
      retryable: pattern.retryable,
      retryDelay: pattern.retryDelay,
      userMessage: pattern.userMessage,
      technicalMessage: error.message,
      context
    }

    // 로그 기록
    this.logError(processedError)

    // 모니터링 시스템에 에러 전송
    this.reportError(processedError)

    return processedError
  }

  /**
   * 에러 패턴 매칭
   */
  private static matchErrorPattern(error: Error): ErrorPattern {
    const errorMessage = error.message.toLowerCase()

    for (const pattern of this.ERROR_PATTERNS) {
      const regex = typeof pattern.pattern === 'string'
        ? new RegExp(pattern.pattern, 'i')
        : pattern.pattern

      if (regex.test(errorMessage)) {
        return pattern
      }
    }

    // 기본 패턴
    return {
      pattern: '',
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      retryDelay: 15000,
      userMessage: '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.'
    }
  }

  /**
   * 에러 로그 기록
   */
  private static logError(processedError: ProcessedError): void {
    const logData = {
      category: processedError.category,
      severity: processedError.severity,
      provider: processedError.context.provider,
      userId: processedError.context.userId,
      projectId: processedError.context.projectId,
      videoGenerationId: processedError.context.videoGenerationId,
      error: processedError.technicalMessage,
      retryable: processedError.retryable,
      recoveryStrategy: processedError.recoveryStrategy,
      timestamp: processedError.context.timestamp.toISOString()
    }

    switch (processedError.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('CRITICAL 영상 생성 오류', logData)
        break
      case ErrorSeverity.HIGH:
        logger.error('HIGH 영상 생성 오류', logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn('MEDIUM 영상 생성 오류', logData)
        break
      case ErrorSeverity.LOW:
        logger.info('LOW 영상 생성 오류', logData)
        break
    }
  }

  /**
   * 모니터링 시스템에 에러 리포트
   */
  private static reportError(processedError: ProcessedError): void {
    // 실제 구현에서는 Sentry, DataDog, CloudWatch 등으로 전송
    if (processedError.severity === ErrorSeverity.CRITICAL ||
        processedError.severity === ErrorSeverity.HIGH) {

      const errorReport = {
        fingerprint: this.generateErrorFingerprint(processedError),
        level: processedError.severity,
        tags: {
          category: processedError.category,
          provider: processedError.context.provider,
          recoveryStrategy: processedError.recoveryStrategy
        },
        extra: {
          context: processedError.context,
          retryable: processedError.retryable,
          userMessage: processedError.userMessage
        },
        message: processedError.technicalMessage
      }

      // 예시: 실제로는 모니터링 서비스 API 호출
      logger.error('에러 리포트 생성됨', errorReport)
    }
  }

  /**
   * 에러 지문 생성 (같은 종류의 에러 그룹핑용)
   */
  private static generateErrorFingerprint(processedError: ProcessedError): string {
    const components = [
      processedError.category,
      processedError.context.provider,
      processedError.originalError.name,
      processedError.originalError.message.substring(0, 100)
    ]

    return Buffer.from(components.join('|')).toString('base64').substring(0, 16)
  }

  /**
   * 제공업체별 에러 통계
   */
  static getErrorStats(timeRange: 'hour' | 'day' | 'week' = 'day'): Record<VideoProvider, {
    total: number
    byCategory: Record<ErrorCategory, number>
    bySeverity: Record<ErrorSeverity, number>
    retryableCount: number
    successRate: number
  }> {
    // 실제 구현에서는 데이터베이스나 메트릭 저장소에서 조회
    // 여기서는 타입 정의만 제공
    return {} as any
  }

  /**
   * 복구 전략 실행
   */
  static async executeRecoveryStrategy(
    processedError: ProcessedError,
    originalParams: any
  ): Promise<{
    success: boolean
    message: string
    fallbackProvider?: VideoProvider
    retryDelay?: number
  }> {
    const { recoveryStrategy, context } = processedError

    switch (recoveryStrategy) {
      case RecoveryStrategy.RETRY:
        return {
          success: true,
          message: '재시도가 예약되었습니다',
          retryDelay: processedError.retryDelay
        }

      case RecoveryStrategy.FALLBACK_PROVIDER:
        const fallbackProvider = this.selectFallbackProvider(context.provider)
        if (fallbackProvider) {
          return {
            success: true,
            message: `${fallbackProvider}로 전환하여 재시도합니다`,
            fallbackProvider
          }
        } else {
          return {
            success: false,
            message: '사용 가능한 대체 제공업체가 없습니다'
          }
        }

      case RecoveryStrategy.QUEUE_DELAY:
        return {
          success: true,
          message: '큐에 지연이 추가되었습니다',
          retryDelay: processedError.retryDelay
        }

      case RecoveryStrategy.USER_NOTIFICATION:
        // 사용자 알림 로직 (실제로는 이메일, 푸시 알림 등)
        logger.info('사용자 알림 발송', {
          userId: context.userId,
          message: processedError.userMessage
        })

        return {
          success: true,
          message: '사용자에게 알림이 전송되었습니다'
        }

      case RecoveryStrategy.ADMIN_INTERVENTION:
        // 관리자 알림 로직
        logger.error('관리자 개입 필요', {
          error: processedError,
          context
        })

        return {
          success: false,
          message: '관리자 개입이 필요합니다'
        }

      case RecoveryStrategy.NO_RECOVERY:
      default:
        return {
          success: false,
          message: '복구할 수 없는 오류입니다'
        }
    }
  }

  /**
   * 대체 제공업체 선택
   */
  private static selectFallbackProvider(failedProvider: VideoProvider): VideoProvider | null {
    const fallbackMap: Record<VideoProvider, VideoProvider[]> = {
      'runway': ['seedance', 'stable-video'],
      'seedance': ['runway', 'stable-video'],
      'stable-video': ['runway', 'seedance']
    }

    const candidates = fallbackMap[failedProvider] || []

    // 실제 구현에서는 각 제공업체의 상태를 확인하고 선택
    // 여기서는 첫 번째 후보를 반환
    return candidates[0] || null
  }

  /**
   * 에러 발생률 모니터링
   */
  static isErrorRateHigh(provider: VideoProvider, threshold: number = 0.1): boolean {
    // 실제 구현에서는 최근 N분간의 에러율 계산
    // 여기서는 임시로 false 반환
    return false
  }

  /**
   * Circuit Breaker 패턴 구현
   */
  static shouldCircuitBreak(provider: VideoProvider): boolean {
    // 실제 구현에서는 최근 실패율을 기반으로 Circuit Breaker 상태 결정
    const errorRate = this.getRecentErrorRate(provider)
    const threshold = 0.5 // 50% 실패율

    return errorRate > threshold
  }

  /**
   * 최근 에러율 조회
   */
  private static getRecentErrorRate(provider: VideoProvider): number {
    // 실제 구현에서는 메트릭 저장소에서 조회
    return 0
  }

  /**
   * 에러 알림 설정
   */
  static configureAlerts(config: {
    emailRecipients: string[]
    slackWebhook?: string
    severityThreshold: ErrorSeverity
    rateThreshold: number
  }): void {
    // 실제 구현에서는 알림 시스템 설정
    logger.info('에러 알림 설정 업데이트됨', config)
  }
}

/**
 * 에러 헬퍼 함수들
 */
export const VideoErrorHelpers = {
  /**
   * 사용자 친화적 에러 메시지 생성
   */
  formatUserMessage(error: ProcessedError): string {
    const baseMessage = error.userMessage

    if (error.context.provider) {
      return `${baseMessage} (${error.context.provider})`
    }

    return baseMessage
  },

  /**
   * 에러 복구 가능 여부 확인
   */
  isRecoverable(error: ProcessedError): boolean {
    return error.retryable ||
           error.recoveryStrategy === RecoveryStrategy.FALLBACK_PROVIDER ||
           error.recoveryStrategy === RecoveryStrategy.QUEUE_DELAY
  },

  /**
   * 에러 카테고리별 색상 코드
   */
  getCategoryColor(category: ErrorCategory): string {
    const colors = {
      [ErrorCategory.VALIDATION]: '#FFA500', // 주황
      [ErrorCategory.AUTHENTICATION]: '#FF0000', // 빨강
      [ErrorCategory.AUTHORIZATION]: '#FF0000', // 빨강
      [ErrorCategory.RATE_LIMIT]: '#FFFF00', // 노랑
      [ErrorCategory.QUOTA_EXCEEDED]: '#FFA500', // 주황
      [ErrorCategory.PAYMENT_REQUIRED]: '#FF4500', // 진한 주황
      [ErrorCategory.NETWORK]: '#0000FF', // 파랑
      [ErrorCategory.SERVER_ERROR]: '#800080', // 보라
      [ErrorCategory.TIMEOUT]: '#008080', // 청록
      [ErrorCategory.UNKNOWN]: '#808080' // 회색
    }

    return colors[category] || colors[ErrorCategory.UNKNOWN]
  }
}