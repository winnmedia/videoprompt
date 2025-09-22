/**
 * Video Generation Queue System
 *
 * CLAUDE.md 준수: shared/lib 기술 구현
 * 영상 생성 작업의 비동기 큐 시스템
 */

import logger from './logger'
import { VideoQueueItem, VideoProvider } from '../entities/video'
import { VideoClientFactory } from './video-clients'

/**
 * 큐 이벤트 타입
 */
export type QueueEventType =
  | 'item_added'
  | 'item_started'
  | 'item_completed'
  | 'item_failed'
  | 'item_cancelled'
  | 'queue_paused'
  | 'queue_resumed'

/**
 * 큐 이벤트
 */
export interface QueueEvent {
  type: QueueEventType
  item?: VideoQueueItem
  error?: Error
  timestamp: Date
}

/**
 * 큐 설정
 */
export interface QueueConfig {
  maxConcurrent: number
  retryDelay: number
  maxRetries: number
  processingTimeout: number
  enablePersistence: boolean
}

/**
 * 큐 상태
 */
export interface QueueStatus {
  pending: number
  processing: number
  completed: number
  failed: number
  paused: boolean
  totalProcessed: number
}

/**
 * 영상 생성 큐 관리자
 */
export class VideoQueue {
  private queue: VideoQueueItem[] = []
  private processing: Map<string, VideoQueueItem> = new Map()
  private completed: Map<string, VideoQueueItem> = new Map()
  private failed: Map<string, VideoQueueItem> = new Map()

  private config: QueueConfig
  private isPaused: boolean = false
  private isProcessing: boolean = false

  // 이벤트 리스너들
  private listeners: Map<QueueEventType, Array<(event: QueueEvent) => void>> = new Map()

  // 통계
  private stats = {
    totalAdded: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    startTime: new Date()
  }

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxConcurrent: 3,
      retryDelay: 30000, // 30초
      maxRetries: 3,
      processingTimeout: 600000, // 10분
      enablePersistence: true,
      ...config
    }

    // 프로세스 종료 시 정리 작업
    process.on('SIGINT', () => this.gracefulShutdown())
    process.on('SIGTERM', () => this.gracefulShutdown())
  }

  /**
   * 큐에 아이템 추가
   */
  async enqueue(item: VideoQueueItem): Promise<void> {
    // 중복 확인
    if (this.findItem(item.id)) {
      logger.warn('큐에 이미 존재하는 아이템입니다', { itemId: item.id })
      return
    }

    // 우선순위에 따라 삽입 위치 결정
    const insertIndex = this.queue.findIndex(queueItem =>
      queueItem.priority > item.priority
    )

    if (insertIndex === -1) {
      this.queue.push(item)
    } else {
      this.queue.splice(insertIndex, 0, item)
    }

    this.stats.totalAdded++

    logger.info('큐에 아이템 추가됨', {
      itemId: item.id,
      priority: item.priority,
      provider: item.provider,
      queueLength: this.queue.length
    })

    this.emitEvent('item_added', item)

    // 자동 처리 시작
    await this.processQueue()
  }

  /**
   * 큐에서 아이템 제거
   */
  async dequeue(itemId: string): Promise<boolean> {
    // 대기 중인 큐에서 제거
    const queueIndex = this.queue.findIndex(item => item.id === itemId)
    if (queueIndex !== -1) {
      const [item] = this.queue.splice(queueIndex, 1)
      logger.info('큐에서 아이템 제거됨', { itemId })
      this.emitEvent('item_cancelled', item)
      return true
    }

    // 처리 중인 아이템 취소
    const processingItem = this.processing.get(itemId)
    if (processingItem) {
      try {
        const client = VideoClientFactory.getClient(processingItem.provider)
        await client.cancelJob(processingItem.videoGenerationId)

        this.processing.delete(itemId)
        this.failed.set(itemId, { ...processingItem, retryCount: this.config.maxRetries })

        logger.info('처리 중인 아이템 취소됨', { itemId })
        this.emitEvent('item_cancelled', processingItem)
        return true
      } catch (error) {
        logger.error('아이템 취소 실패', {
          itemId,
          error: error instanceof Error ? error.message : error
        })
        return false
      }
    }

    return false
  }

  /**
   * 큐 처리 시작
   */
  private async processQueue(): Promise<void> {
    if (this.isPaused || this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0 && this.processing.size < this.config.maxConcurrent) {
        const item = this.queue.shift()
        if (!item) break

        // 예약 시간 확인
        if (item.scheduledAt && new Date() < item.scheduledAt) {
          // 다시 큐에 추가 (맨 앞에)
          this.queue.unshift(item)
          break
        }

        await this.processItem(item)
      }
    } finally {
      this.isProcessing = false
    }

    // 더 처리할 아이템이 있다면 다시 시도
    if (this.queue.length > 0 && this.processing.size < this.config.maxConcurrent) {
      setTimeout(() => this.processQueue(), 1000)
    }
  }

  /**
   * 개별 아이템 처리
   */
  private async processItem(item: VideoQueueItem): Promise<void> {
    const startTime = Date.now()

    // 처리 중으로 이동
    this.processing.set(item.id, item)
    this.emitEvent('item_started', item)

    logger.info('아이템 처리 시작', {
      itemId: item.id,
      provider: item.provider,
      attempt: item.retryCount + 1,
      maxRetries: item.maxRetries
    })

    // 처리 타임아웃 설정
    const timeoutId = setTimeout(() => {
      this.handleItemTimeout(item)
    }, this.config.processingTimeout)

    try {
      const client = VideoClientFactory.getClient(item.provider)
      const result = await client.generateVideo(item.params)

      // 성공적으로 처리됨
      clearTimeout(timeoutId)
      this.processing.delete(item.id)
      this.completed.set(item.id, item)

      const processingTime = Date.now() - startTime
      this.updateProcessingStats(processingTime)

      logger.info('아이템 처리 완료', {
        itemId: item.id,
        jobId: result.id,
        processingTime: `${processingTime}ms`
      })

      this.emitEvent('item_completed', item)

      // 다음 아이템 처리
      await this.processQueue()

    } catch (error) {
      clearTimeout(timeoutId)
      await this.handleItemError(item, error as Error)
    }
  }

  /**
   * 아이템 처리 오류 핸들링
   */
  private async handleItemError(item: VideoQueueItem, error: Error): Promise<void> {
    this.processing.delete(item.id)

    const updatedItem = {
      ...item,
      retryCount: item.retryCount + 1
    }

    logger.error('아이템 처리 실패', {
      itemId: item.id,
      error: error.message,
      retryCount: updatedItem.retryCount,
      maxRetries: item.maxRetries
    })

    // 재시도 가능한지 확인
    if (updatedItem.retryCount < item.maxRetries && this.isRetryableError(error)) {
      // 재시도 큐에 추가 (지연 시간 적용)
      const retryDelay = this.calculateRetryDelay(updatedItem.retryCount)
      const scheduledAt = new Date(Date.now() + retryDelay)

      const retryItem = {
        ...updatedItem,
        scheduledAt
      }

      this.queue.unshift(retryItem) // 높은 우선순위로 다시 추가

      logger.info('아이템 재시도 예약', {
        itemId: item.id,
        retryCount: updatedItem.retryCount,
        scheduledAt: scheduledAt.toISOString()
      })

      // 재시도 타이머 설정
      setTimeout(() => this.processQueue(), retryDelay)

    } else {
      // 최종 실패
      this.failed.set(item.id, updatedItem)
      this.stats.totalFailed++

      logger.error('아이템 최종 실패', {
        itemId: item.id,
        totalRetries: updatedItem.retryCount
      })

      this.emitEvent('item_failed', updatedItem, error)
    }

    // 다음 아이템 처리 계속
    await this.processQueue()
  }

  /**
   * 아이템 처리 타임아웃 핸들링
   */
  private async handleItemTimeout(item: VideoQueueItem): Promise<void> {
    logger.warn('아이템 처리 타임아웃', {
      itemId: item.id,
      timeout: this.config.processingTimeout
    })

    const timeoutError = new Error(`Processing timeout after ${this.config.processingTimeout}ms`)
    await this.handleItemError(item, timeoutError)
  }

  /**
   * 재시도 가능한 오류인지 확인
   */
  private isRetryableError(error: Error): boolean {
    // 네트워크 오류, 일시적 서버 오류 등은 재시도 가능
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /502/,
      /503/,
      /504/,
      /connection/i,
      /rate limit/i
    ]

    return retryablePatterns.some(pattern => pattern.test(error.message))
  }

  /**
   * 재시도 지연 시간 계산 (지수 백오프)
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelay
    const maxDelay = baseDelay * 16 // 최대 지연 시간
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay)

    // 지터 추가 (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1)
    return Math.round(delay + jitter)
  }

  /**
   * 처리 통계 업데이트
   */
  private updateProcessingStats(processingTime: number): void {
    this.stats.totalProcessed++

    // 평균 처리 시간 계산 (이동 평균)
    const alpha = 0.1 // 스무딩 팩터
    this.stats.averageProcessingTime =
      alpha * processingTime + (1 - alpha) * this.stats.averageProcessingTime
  }

  /**
   * 큐 일시정지
   */
  pause(): void {
    this.isPaused = true
    logger.info('큐가 일시정지되었습니다')
    this.emitEvent('queue_paused')
  }

  /**
   * 큐 재개
   */
  async resume(): Promise<void> {
    this.isPaused = false
    logger.info('큐가 재개되었습니다')
    this.emitEvent('queue_resumed')
    await this.processQueue()
  }

  /**
   * 큐 상태 조회
   */
  getStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      paused: this.isPaused,
      totalProcessed: this.stats.totalProcessed
    }
  }

  /**
   * 큐 통계 조회
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime()
    const throughput = this.stats.totalProcessed / (uptime / 1000 / 60) // per minute

    return {
      ...this.stats,
      uptime,
      throughput: Math.round(throughput * 100) / 100,
      successRate: this.stats.totalProcessed / (this.stats.totalProcessed + this.stats.totalFailed) || 0
    }
  }

  /**
   * 아이템 찾기
   */
  private findItem(itemId: string): VideoQueueItem | undefined {
    return this.queue.find(item => item.id === itemId) ||
           this.processing.get(itemId) ||
           this.completed.get(itemId) ||
           this.failed.get(itemId)
  }

  /**
   * 이벤트 리스너 등록
   */
  on(eventType: QueueEventType, listener: (event: QueueEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }

    this.listeners.get(eventType)!.push(listener)

    // 리스너 제거 함수 반환
    return () => {
      const listeners = this.listeners.get(eventType)
      if (listeners) {
        const index = listeners.indexOf(listener)
        if (index !== -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(type: QueueEventType, item?: VideoQueueItem, error?: Error): void {
    const event: QueueEvent = {
      type,
      item,
      error,
      timestamp: new Date()
    }

    const listeners = this.listeners.get(type) || []
    listeners.forEach(listener => {
      try {
        listener(event)
      } catch (listenerError) {
        logger.error('큐 이벤트 리스너 오류', {
          eventType: type,
          error: listenerError instanceof Error ? listenerError.message : listenerError
        })
      }
    })
  }

  /**
   * 우아한 종료
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('영상 생성 큐 종료 시작...')

    this.pause()

    // 처리 중인 작업들이 완료될 때까지 대기 (최대 30초)
    const maxWaitTime = 30000
    const checkInterval = 1000
    let waitedTime = 0

    while (this.processing.size > 0 && waitedTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval))
      waitedTime += checkInterval
    }

    if (this.processing.size > 0) {
      logger.warn('일부 작업이 완료되지 않고 종료됩니다', {
        remainingJobs: this.processing.size
      })
    }

    logger.info('영상 생성 큐 종료 완료')
  }

  /**
   * 큐 클리어
   */
  clear(): void {
    this.queue = []
    this.processing.clear()
    this.completed.clear()
    this.failed.clear()

    logger.info('큐가 클리어되었습니다')
  }

  /**
   * 제공업체별 큐 상태
   */
  getProviderStatus(): Record<VideoProvider, { pending: number; processing: number }> {
    const result = {} as Record<VideoProvider, { pending: number; processing: number }>

    const providers: VideoProvider[] = ['runway', 'seedance', 'stable-video']
    providers.forEach(provider => {
      result[provider] = {
        pending: this.queue.filter(item => item.provider === provider).length,
        processing: Array.from(this.processing.values())
          .filter(item => item.provider === provider).length
      }
    })

    return result
  }
}

/**
 * 전역 큐 인스턴스 (싱글톤)
 */
export const globalVideoQueue = new VideoQueue({
  maxConcurrent: 3,
  retryDelay: 30000,
  maxRetries: 3,
  processingTimeout: 600000,
  enablePersistence: true
})