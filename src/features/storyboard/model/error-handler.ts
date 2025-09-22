/**
 * Error Handler & Retry Logic
 *
 * 스토리보드 이미지 생성 에러 처리 및 재시도 로직
 * CLAUDE.md 준수: FSD features 레이어, 비용 안전 규칙, 지수 백오프
 */

import logger from '../../../shared/lib/logger'

/**
 * 에러 타입 정의
 */
export type ErrorType =
  | 'NETWORK_ERROR'
  | 'API_RATE_LIMIT'
  | 'AUTHENTICATION_ERROR'
  | 'INVALID_PROMPT'
  | 'INSUFFICIENT_CREDITS'
  | 'MODEL_OVERLOADED'
  | 'CONTENT_POLICY_VIOLATION'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * 에러 심각도
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * 상세 에러 정보
 */
export interface DetailedError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError?: Error
  context?: Record<string, unknown>
  timestamp: Date
  retryable: boolean
  suggestedAction?: string
}

/**
 * 재시도 정책 설정
 */
export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  exponentialBackoff: boolean
  jitter: boolean
  retryableErrorTypes: ErrorType[]
}

/**
 * 재시도 상태
 */
export interface RetryState {
  attemptCount: number
  totalDelay: number
  lastError?: DetailedError
  startTime: Date
}

/**
 * 기본 재시도 정책
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrorTypes: [
    'NETWORK_ERROR',
    'API_RATE_LIMIT',
    'MODEL_OVERLOADED',
    'TIMEOUT_ERROR'
  ]
}

/**
 * 비용 안전 재시도 정책 (더 보수적)
 */
export const COST_SAFE_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrorTypes: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR'
  ]
}

/**
 * 에러 분류 및 처리 클래스
 */
export class StoryboardErrorHandler {
  private retryPolicy: RetryPolicy
  private retryStates: Map<string, RetryState> = new Map()

  constructor(retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.retryPolicy = retryPolicy
  }

  /**
   * 에러 분석 및 분류
   */
  analyzeError(error: Error, context?: Record<string, unknown>): DetailedError {
    const detailedError: DetailedError = {
      type: this.classifyError(error),
      severity: this.determineSeverity(error),
      message: this.createUserFriendlyMessage(error),
      originalError: error,
      context,
      timestamp: new Date(),
      retryable: false,
      suggestedAction: undefined
    }

    // 재시도 가능성 및 제안 액션 설정
    this.setRetryabilityAndAction(detailedError)

    logger.error('스토리보드 에러 발생', {
      type: detailedError.type,
      severity: detailedError.severity,
      message: detailedError.message,
      context: detailedError.context
    })

    return detailedError
  }

  /**
   * 재시도 가능 여부 확인
   */
  shouldRetry(frameId: string, error: DetailedError): boolean {
    const retryState = this.getRetryState(frameId)

    // 최대 재시도 횟수 초과
    if (retryState.attemptCount >= this.retryPolicy.maxRetries) {
      logger.warn('최대 재시도 횟수 초과', {
        frameId,
        attemptCount: retryState.attemptCount,
        maxRetries: this.retryPolicy.maxRetries
      })
      return false
    }

    // 재시도 불가능한 에러 타입
    if (!this.retryPolicy.retryableErrorTypes.includes(error.type)) {
      logger.info('재시도 불가능한 에러 타입', {
        frameId,
        errorType: error.type
      })
      return false
    }

    // 에러 자체가 재시도 불가능으로 표시됨
    if (!error.retryable) {
      logger.info('재시도 불가능한 에러', {
        frameId,
        error: error.message
      })
      return false
    }

    return true
  }

  /**
   * 재시도 지연 시간 계산
   */
  calculateRetryDelay(frameId: string): number {
    const retryState = this.getRetryState(frameId)
    let delay = this.retryPolicy.baseDelayMs

    if (this.retryPolicy.exponentialBackoff) {
      delay = Math.min(
        this.retryPolicy.baseDelayMs * Math.pow(2, retryState.attemptCount),
        this.retryPolicy.maxDelayMs
      )
    }

    // 지터 추가 (동시 재시도 방지)
    if (this.retryPolicy.jitter) {
      const jitterFactor = 0.1 // 10% 지터
      const jitter = delay * jitterFactor * (Math.random() * 2 - 1)
      delay = Math.max(0, delay + jitter)
    }

    logger.info('재시도 지연 계산', {
      frameId,
      attemptCount: retryState.attemptCount,
      delay,
      policy: {
        exponentialBackoff: this.retryPolicy.exponentialBackoff,
        jitter: this.retryPolicy.jitter
      }
    })

    return Math.round(delay)
  }

  /**
   * 재시도 실행
   */
  async executeWithRetry<T>(
    frameId: string,
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: DetailedError, delay: number) => void
  ): Promise<T> {
    const retryState = this.initializeRetryState(frameId)

    while (true) {
      try {
        retryState.attemptCount++
        const result = await operation()

        // 성공 시 재시도 상태 정리
        this.clearRetryState(frameId)

        logger.info('작업 성공', {
          frameId,
          attemptCount: retryState.attemptCount,
          totalDelay: retryState.totalDelay
        })

        return result

      } catch (error) {
        const detailedError = this.analyzeError(
          error instanceof Error ? error : new Error(String(error)),
          { frameId, attemptCount: retryState.attemptCount }
        )

        retryState.lastError = detailedError

        if (!this.shouldRetry(frameId, detailedError)) {
          this.clearRetryState(frameId)
          throw detailedError
        }

        const delay = this.calculateRetryDelay(frameId)
        retryState.totalDelay += delay

        logger.warn('작업 실패, 재시도 예정', {
          frameId,
          attemptCount: retryState.attemptCount,
          error: detailedError.message,
          delay
        })

        onRetry?.(retryState.attemptCount, detailedError, delay)

        // 지연 실행
        await this.delay(delay)
      }
    }
  }

  /**
   * 특정 프레임의 재시도 상태 초기화
   */
  resetRetryState(frameId: string): void {
    this.retryStates.delete(frameId)
    logger.info('재시도 상태 초기화', { frameId })
  }

  /**
   * 모든 재시도 상태 초기화
   */
  resetAllRetryStates(): void {
    const frameIds = Array.from(this.retryStates.keys())
    this.retryStates.clear()
    logger.info('모든 재시도 상태 초기화', { frameCount: frameIds.length })
  }

  /**
   * 재시도 정책 업데이트
   */
  updateRetryPolicy(newPolicy: Partial<RetryPolicy>): void {
    this.retryPolicy = { ...this.retryPolicy, ...newPolicy }
    logger.info('재시도 정책 업데이트', { policy: this.retryPolicy })
  }

  /**
   * 재시도 통계 조회
   */
  getRetryStatistics(): {
    activeRetries: number
    totalRetries: number
    averageRetryCount: number
    mostCommonErrorType: ErrorType | null
  } {
    const activeRetries = this.retryStates.size
    const retryStatesArray = Array.from(this.retryStates.values())

    const totalRetries = retryStatesArray.reduce(
      (sum, state) => sum + state.attemptCount,
      0
    )

    const averageRetryCount = activeRetries > 0 ? totalRetries / activeRetries : 0

    // 가장 흔한 에러 타입 찾기
    const errorTypes = retryStatesArray
      .map(state => state.lastError?.type)
      .filter((type): type is ErrorType => type !== undefined)

    const errorTypeFreq = errorTypes.reduce((freq, type) => {
      freq[type] = (freq[type] || 0) + 1
      return freq
    }, {} as Record<ErrorType, number>)

    const mostCommonErrorType = Object.entries(errorTypeFreq)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as ErrorType || null

    return {
      activeRetries,
      totalRetries,
      averageRetryCount,
      mostCommonErrorType
    }
  }

  // === Private Helper Methods ===

  /**
   * 에러 분류
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR'
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return 'API_RATE_LIMIT'
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return 'AUTHENTICATION_ERROR'
    }

    if (message.includes('credits') || message.includes('quota')) {
      return 'INSUFFICIENT_CREDITS'
    }

    if (message.includes('overloaded') || message.includes('503')) {
      return 'MODEL_OVERLOADED'
    }

    if (message.includes('content policy') || message.includes('safety')) {
      return 'CONTENT_POLICY_VIOLATION'
    }

    if (message.includes('timeout') || message.includes('408')) {
      return 'TIMEOUT_ERROR'
    }

    if (message.includes('prompt') || message.includes('400')) {
      return 'INVALID_PROMPT'
    }

    return 'UNKNOWN_ERROR'
  }

  /**
   * 에러 심각도 결정
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()

    if (message.includes('credits') || message.includes('unauthorized')) {
      return 'critical'
    }

    if (message.includes('content policy') || message.includes('safety')) {
      return 'high'
    }

    if (message.includes('rate limit') || message.includes('overloaded')) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * 사용자 친화적 메시지 생성
   */
  private createUserFriendlyMessage(error: Error): string {
    const message = error.message.toLowerCase()

    if (message.includes('network')) {
      return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.'
    }

    if (message.includes('rate limit')) {
      return 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
    }

    if (message.includes('unauthorized')) {
      return '인증에 실패했습니다. API 키를 확인해주세요.'
    }

    if (message.includes('credits')) {
      return '크레딧이 부족합니다. 요금제를 확인해주세요.'
    }

    if (message.includes('overloaded')) {
      return '서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
    }

    if (message.includes('content policy')) {
      return '콘텐츠 정책 위반으로 이미지를 생성할 수 없습니다. 프롬프트를 수정해주세요.'
    }

    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.'
    }

    return '이미지 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
  }

  /**
   * 재시도 가능성 및 제안 액션 설정
   */
  private setRetryabilityAndAction(error: DetailedError): void {
    switch (error.type) {
      case 'NETWORK_ERROR':
      case 'API_RATE_LIMIT':
      case 'MODEL_OVERLOADED':
      case 'TIMEOUT_ERROR':
        error.retryable = true
        error.suggestedAction = '잠시 후 자동으로 재시도됩니다.'
        break

      case 'AUTHENTICATION_ERROR':
        error.retryable = false
        error.suggestedAction = 'API 키를 확인하고 다시 시도해주세요.'
        break

      case 'INSUFFICIENT_CREDITS':
        error.retryable = false
        error.suggestedAction = '크레딧을 충전하고 다시 시도해주세요.'
        break

      case 'CONTENT_POLICY_VIOLATION':
        error.retryable = false
        error.suggestedAction = '프롬프트를 수정하고 다시 시도해주세요.'
        break

      case 'INVALID_PROMPT':
        error.retryable = false
        error.suggestedAction = '유효한 프롬프트를 입력해주세요.'
        break

      default:
        error.retryable = true
        error.suggestedAction = '문제가 지속되면 고객지원에 문의해주세요.'
    }
  }

  /**
   * 재시도 상태 조회 또는 생성
   */
  private getRetryState(frameId: string): RetryState {
    let state = this.retryStates.get(frameId)
    if (!state) {
      state = this.initializeRetryState(frameId)
    }
    return state
  }

  /**
   * 재시도 상태 초기화
   */
  private initializeRetryState(frameId: string): RetryState {
    const state: RetryState = {
      attemptCount: 0,
      totalDelay: 0,
      startTime: new Date()
    }
    this.retryStates.set(frameId, state)
    return state
  }

  /**
   * 재시도 상태 정리
   */
  private clearRetryState(frameId: string): void {
    this.retryStates.delete(frameId)
  }

  /**
   * 지연 실행
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 전역 에러 핸들러 인스턴스
 */
export const storyboardErrorHandler = new StoryboardErrorHandler(
  process.env.NODE_ENV === 'production' ? COST_SAFE_RETRY_POLICY : DEFAULT_RETRY_POLICY
)