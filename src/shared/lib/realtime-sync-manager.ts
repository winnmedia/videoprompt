/**
 * Realtime Sync Manager
 *
 * CLAUDE.md 준수: shared/lib 레이어 실시간 동기화
 * 실시간 이벤트 동기화 및 충돌 해결 관리자
 */

import { type RealtimeEvent, type RealtimeEventType } from '../../entities/feedback'

/**
 * 동기화 상태
 */
export type SyncState = 'synced' | 'syncing' | 'conflict' | 'error'

/**
 * 충돌 해결 전략
 */
export type ConflictResolutionStrategy = 'last_write_wins' | 'merge' | 'manual'

/**
 * 충돌 정보
 */
export interface Conflict {
  readonly id: string
  readonly localEvent: RealtimeEvent
  readonly remoteEvent: RealtimeEvent
  readonly conflictType: 'concurrent_edit' | 'state_mismatch' | 'version_conflict'
  readonly timestamp: Date
}

/**
 * 동기화 옵션
 */
export interface SyncOptions {
  readonly strategy: ConflictResolutionStrategy
  readonly batchSize: number
  readonly debounceMs: number
  readonly maxRetries: number
}

/**
 * 이벤트 큐 아이템
 */
interface QueuedEvent {
  readonly event: RealtimeEvent
  readonly timestamp: number
  readonly retryCount: number
}

/**
 * 실시간 동기화 매니저
 */
export class RealtimeSyncManager {
  private pendingEvents = new Map<string, QueuedEvent>()
  private conflictQueue: Conflict[] = []
  private syncState: SyncState = 'synced'
  private syncListeners = new Set<(state: SyncState) => void>()
  private conflictListeners = new Set<(conflict: Conflict) => void>()
  private options: SyncOptions

  // 이벤트 순서 보장을 위한 시퀀스
  private localSequence = 0
  private lastRemoteSequence = 0

  // 디바운스 타이머
  private debounceTimer: NodeJS.Timeout | null = null

  constructor(options: Partial<SyncOptions> = {}) {
    this.options = {
      strategy: 'last_write_wins',
      batchSize: 10,
      debounceMs: 100,
      maxRetries: 3,
      ...options
    }
  }

  /**
   * 로컬 이벤트 처리 (발신)
   */
  processLocalEvent(event: RealtimeEvent): void {
    const eventWithSequence = {
      ...event,
      sequence: ++this.localSequence,
      id: this.generateEventId()
    }

    // 디바운스 적용
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.queueForSync(eventWithSequence)
    }, this.options.debounceMs)
  }

  /**
   * 원격 이벤트 처리 (수신)
   */
  processRemoteEvent(event: RealtimeEvent): boolean {
    const sequence = (event as any).sequence || 0

    // 시퀀스 순서 검증
    if (sequence <= this.lastRemoteSequence) {
      console.warn('중복되거나 오래된 이벤트 무시:', event)
      return false
    }

    // 충돌 감지
    const conflict = this.detectConflict(event)
    if (conflict) {
      this.handleConflict(conflict)
      return false
    }

    this.lastRemoteSequence = sequence
    return true
  }

  /**
   * 동기화 큐에 이벤트 추가
   */
  private queueForSync(event: RealtimeEvent): void {
    const eventId = (event as any).id || this.generateEventId()

    this.pendingEvents.set(eventId, {
      event,
      timestamp: Date.now(),
      retryCount: 0
    })

    this.setSyncState('syncing')
    this.processSyncQueue()
  }

  /**
   * 동기화 큐 처리
   */
  private async processSyncQueue(): Promise<void> {
    if (this.pendingEvents.size === 0) {
      this.setSyncState('synced')
      return
    }

    const events = Array.from(this.pendingEvents.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, this.options.batchSize)

    try {
      // 배치로 이벤트 전송
      await this.sendBatchEvents(events.map(item => item.event))

      // 성공한 이벤트들 제거
      events.forEach(item => {
        const eventId = (item.event as any).id
        this.pendingEvents.delete(eventId)
      })

      // 남은 이벤트가 있으면 계속 처리
      if (this.pendingEvents.size > 0) {
        setTimeout(() => this.processSyncQueue(), 100)
      } else {
        this.setSyncState('synced')
      }
    } catch (error) {
      console.error('동기화 실패:', error)
      this.handleSyncError(events)
    }
  }

  /**
   * 배치 이벤트 전송
   */
  private async sendBatchEvents(events: RealtimeEvent[]): Promise<void> {
    // WebSocket 또는 HTTP API를 통해 이벤트 전송
    // 실제 구현에서는 WebSocketFeedbackClient 사용
    console.log('배치 이벤트 전송:', events.length)
  }

  /**
   * 동기화 오류 처리
   */
  private handleSyncError(failedEvents: QueuedEvent[]): void {
    failedEvents.forEach(item => {
      const eventId = (item.event as any).id
      const updated = {
        ...item,
        retryCount: item.retryCount + 1
      }

      if (updated.retryCount <= this.options.maxRetries) {
        this.pendingEvents.set(eventId, updated)
      } else {
        console.error('최대 재시도 횟수 초과, 이벤트 삭제:', item.event)
        this.pendingEvents.delete(eventId)
      }
    })

    this.setSyncState('error')

    // 지수 백오프로 재시도
    const delay = Math.pow(2, Math.min(failedEvents[0]?.retryCount || 1, 5)) * 1000
    setTimeout(() => this.processSyncQueue(), delay)
  }

  /**
   * 충돌 감지
   */
  private detectConflict(remoteEvent: RealtimeEvent): Conflict | null {
    // 동시 편집 감지
    const pendingEditEvents = Array.from(this.pendingEvents.values())
      .filter(item => this.isEditEvent(item.event))

    for (const pendingItem of pendingEditEvents) {
      if (this.eventsConflict(pendingItem.event, remoteEvent)) {
        return {
          id: crypto.randomUUID(),
          localEvent: pendingItem.event,
          remoteEvent,
          conflictType: 'concurrent_edit',
          timestamp: new Date()
        }
      }
    }

    return null
  }

  /**
   * 이벤트 충돌 여부 판단
   */
  private eventsConflict(localEvent: RealtimeEvent, remoteEvent: RealtimeEvent): boolean {
    // 같은 리소스에 대한 동시 수정 감지
    if (localEvent.type === 'comment_updated' && remoteEvent.type === 'comment_updated') {
      const localCommentId = (localEvent.data as any)?.commentId
      const remoteCommentId = (remoteEvent.data as any)?.commentId
      return localCommentId === remoteCommentId
    }

    if (localEvent.type === 'video_uploaded' && remoteEvent.type === 'video_uploaded') {
      const localSlot = (localEvent.data as any)?.slot
      const remoteSlot = (remoteEvent.data as any)?.slot
      return localSlot === remoteSlot
    }

    return false
  }

  /**
   * 편집 이벤트 여부 판단
   */
  private isEditEvent(event: RealtimeEvent): boolean {
    return [
      'comment_added',
      'comment_updated',
      'comment_deleted',
      'video_uploaded',
      'video_deleted',
      'session_updated'
    ].includes(event.type)
  }

  /**
   * 충돌 처리
   */
  private handleConflict(conflict: Conflict): void {
    this.conflictQueue.push(conflict)
    this.setSyncState('conflict')

    // 충돌 리스너들에게 알림
    this.conflictListeners.forEach(listener => {
      try {
        listener(conflict)
      } catch (error) {
        console.error('충돌 리스너 오류:', error)
      }
    })

    // 전략에 따른 자동 해결
    switch (this.options.strategy) {
      case 'last_write_wins':
        this.resolveConflictLastWriteWins(conflict)
        break
      case 'merge':
        this.resolveConflictMerge(conflict)
        break
      case 'manual':
        // 수동 해결 대기
        break
    }
  }

  /**
   * Last Write Wins 전략으로 충돌 해결
   */
  private resolveConflictLastWriteWins(conflict: Conflict): void {
    const localTime = conflict.localEvent.timestamp.getTime()
    const remoteTime = conflict.remoteEvent.timestamp.getTime()

    if (remoteTime > localTime) {
      // 원격 이벤트가 더 최신, 로컬 이벤트 취소
      const eventId = (conflict.localEvent as any).id
      this.pendingEvents.delete(eventId)
      console.log('충돌 해결: 원격 이벤트 적용')
    } else {
      // 로컬 이벤트가 더 최신, 원격 이벤트 무시
      console.log('충돌 해결: 로컬 이벤트 우선')
    }

    this.removeConflict(conflict.id)
  }

  /**
   * 병합 전략으로 충돌 해결
   */
  private resolveConflictMerge(conflict: Conflict): void {
    // 이벤트 타입별 병합 로직
    if (conflict.conflictType === 'concurrent_edit') {
      if (conflict.localEvent.type === 'comment_updated' && conflict.remoteEvent.type === 'comment_updated') {
        this.mergeCommentUpdates(conflict)
      }
    }

    this.removeConflict(conflict.id)
  }

  /**
   * 댓글 업데이트 병합
   */
  private mergeCommentUpdates(conflict: Conflict): void {
    const localContent = (conflict.localEvent.data as any)?.content || ''
    const remoteContent = (conflict.remoteEvent.data as any)?.content || ''

    // 간단한 병합 전략: 둘 다 포함
    const mergedContent = `${localContent}\n\n[병합됨]\n${remoteContent}`

    // 병합된 이벤트로 업데이트
    const mergedEvent: RealtimeEvent = {
      ...conflict.localEvent,
      data: {
        ...conflict.localEvent.data,
        content: mergedContent,
        merged: true
      }
    }

    const eventId = (conflict.localEvent as any).id
    this.pendingEvents.set(eventId, {
      event: mergedEvent,
      timestamp: Date.now(),
      retryCount: 0
    })

    console.log('충돌 해결: 댓글 병합 완료')
  }

  /**
   * 수동 충돌 해결
   */
  resolveConflictManually(conflictId: string, resolution: 'local' | 'remote' | 'custom', customData?: any): void {
    const conflict = this.conflictQueue.find(c => c.id === conflictId)
    if (!conflict) return

    const eventId = (conflict.localEvent as any).id

    switch (resolution) {
      case 'local':
        // 로컬 이벤트 유지
        break
      case 'remote':
        // 로컬 이벤트 제거
        this.pendingEvents.delete(eventId)
        break
      case 'custom':
        // 사용자 정의 해결
        if (customData) {
          const customEvent: RealtimeEvent = {
            ...conflict.localEvent,
            data: customData
          }
          this.pendingEvents.set(eventId, {
            event: customEvent,
            timestamp: Date.now(),
            retryCount: 0
          })
        }
        break
    }

    this.removeConflict(conflictId)
  }

  /**
   * 충돌 제거
   */
  private removeConflict(conflictId: string): void {
    this.conflictQueue = this.conflictQueue.filter(c => c.id !== conflictId)

    if (this.conflictQueue.length === 0) {
      this.setSyncState('synced')
    }
  }

  /**
   * 동기화 상태 변경
   */
  private setSyncState(newState: SyncState): void {
    if (this.syncState !== newState) {
      this.syncState = newState
      this.syncListeners.forEach(listener => {
        try {
          listener(newState)
        } catch (error) {
          console.error('동기화 상태 리스너 오류:', error)
        }
      })
    }
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 동기화 상태 리스너 등록
   */
  onSyncStateChange(listener: (state: SyncState) => void): void {
    this.syncListeners.add(listener)
  }

  /**
   * 동기화 상태 리스너 해제
   */
  offSyncStateChange(listener: (state: SyncState) => void): void {
    this.syncListeners.delete(listener)
  }

  /**
   * 충돌 리스너 등록
   */
  onConflict(listener: (conflict: Conflict) => void): void {
    this.conflictListeners.add(listener)
  }

  /**
   * 충돌 리스너 해제
   */
  offConflict(listener: (conflict: Conflict) => void): void {
    this.conflictListeners.delete(listener)
  }

  /**
   * 현재 상태 정보 반환
   */
  getStatus() {
    return {
      syncState: this.syncState,
      pendingEvents: this.pendingEvents.size,
      conflicts: this.conflictQueue.length,
      localSequence: this.localSequence,
      lastRemoteSequence: this.lastRemoteSequence
    }
  }

  /**
   * 강제 동기화
   */
  forcSync(): void {
    this.processSyncQueue()
  }

  /**
   * 모든 대기 중인 이벤트 클리어
   */
  clearPendingEvents(): void {
    this.pendingEvents.clear()
    this.setSyncState('synced')
  }

  /**
   * 정리 작업
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.pendingEvents.clear()
    this.conflictQueue = []
    this.syncListeners.clear()
    this.conflictListeners.clear()
  }
}