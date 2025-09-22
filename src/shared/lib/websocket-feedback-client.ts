/**
 * WebSocket Feedback Client
 *
 * CLAUDE.md 준수: shared/lib 레이어 실시간 통신
 * 피드백 시스템을 위한 WebSocket 실시간 협업 클라이언트
 */

import { type RealtimeEvent, type RealtimeEventType } from '../../entities/feedback'

/**
 * WebSocket 연결 상태
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error'

/**
 * 연결 옵션
 */
export interface ConnectionOptions {
  readonly autoReconnect: boolean
  readonly maxReconnectAttempts: number
  readonly reconnectInterval: number // milliseconds
  readonly heartbeatInterval: number // milliseconds
  readonly timeout: number // milliseconds
}

/**
 * 이벤트 리스너
 */
export type EventListener<T = any> = (data: T) => void

/**
 * WebSocket 피드백 클라이언트
 */
export class WebSocketFeedbackClient {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private state: ConnectionState = 'disconnected'
  private listeners = new Map<RealtimeEventType, Set<EventListener>>()
  private stateListeners = new Set<(state: ConnectionState) => void>()
  private options: ConnectionOptions
  private reconnectAttempts = 0
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(options: Partial<ConnectionOptions> = {}) {
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
      heartbeatInterval: 30000,
      timeout: 10000,
      ...options
    }
  }

  /**
   * 세션에 연결
   */
  async connect(sessionId: string, token?: string): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.warn('이미 연결되어 있거나 연결 중입니다')
      return
    }

    this.sessionId = sessionId
    this.setState('connecting')

    try {
      const wsUrl = this.buildWebSocketUrl(sessionId, token)
      this.ws = new WebSocket(wsUrl)

      this.setupEventHandlers()

      // 연결 타임아웃 설정
      const connectTimeout = setTimeout(() => {
        if (this.state === 'connecting') {
          this.ws?.close()
          this.setState('error')
          throw new Error('WebSocket 연결 시간 초과')
        }
      }, this.options.timeout)

      return new Promise((resolve, reject) => {
        const onOpen = () => {
          clearTimeout(connectTimeout)
          this.setState('connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          resolve()
        }

        const onError = (error: Event) => {
          clearTimeout(connectTimeout)
          this.setState('error')
          reject(new Error('WebSocket 연결 실패'))
        }

        this.ws!.addEventListener('open', onOpen, { once: true })
        this.ws!.addEventListener('error', onError, { once: true })
      })
    } catch (error) {
      this.setState('error')
      throw error
    }
  }

  /**
   * 연결 해제
   */
  disconnect(): void {
    if (this.state === 'disconnected' || this.state === 'disconnecting') {
      return
    }

    this.setState('disconnecting')
    this.stopHeartbeat()
    this.stopReconnect()

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.setState('disconnected')
    this.sessionId = null
  }

  /**
   * 이벤트 전송
   */
  send(eventType: RealtimeEventType, data: any): void {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error('WebSocket이 연결되지 않았습니다')
    }

    const event: RealtimeEvent = {
      type: eventType,
      sessionId: this.sessionId!,
      data,
      timestamp: new Date(),
      authorId: this.getCurrentUserId() // 현재 사용자 ID 가져오기
    }

    this.ws.send(JSON.stringify(event))
  }

  /**
   * 이벤트 리스너 등록
   */
  on<T = any>(eventType: RealtimeEventType, listener: EventListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)
  }

  /**
   * 이벤트 리스너 해제
   */
  off<T = any>(eventType: RealtimeEventType, listener: EventListener<T>): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }

  /**
   * 연결 상태 리스너 등록
   */
  onStateChange(listener: (state: ConnectionState) => void): void {
    this.stateListeners.add(listener)
  }

  /**
   * 연결 상태 리스너 해제
   */
  offStateChange(listener: (state: ConnectionState) => void): void {
    this.stateListeners.delete(listener)
  }

  /**
   * 현재 연결 상태 반환
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * 연결 여부 확인
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }

  /**
   * WebSocket URL 생성
   */
  private buildWebSocketUrl(sessionId: string, token?: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    let url = `${protocol}//${host}/api/feedback/ws/${sessionId}`

    if (token) {
      url += `?token=${encodeURIComponent(token)}`
    }

    return url
  }

  /**
   * WebSocket 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('WebSocket 연결됨')
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket 연결 종료:', event.code, event.reason)
      this.handleDisconnect(event.code)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket 오류:', error)
      this.setState('error')
    }

    this.ws.onmessage = (event) => {
      try {
        const realtimeEvent: RealtimeEvent = JSON.parse(event.data)
        this.handleIncomingEvent(realtimeEvent)
      } catch (error) {
        console.error('메시지 파싱 실패:', error)
      }
    }
  }

  /**
   * 수신된 이벤트 처리
   */
  private handleIncomingEvent(event: RealtimeEvent): void {
    // 자신이 보낸 이벤트는 무시 (옵션)
    if (event.authorId === this.getCurrentUserId()) {
      return
    }

    // 특별한 시스템 이벤트 처리
    if (event.type === 'participant_joined' || event.type === 'participant_left') {
      console.log(`참여자 ${event.type}:`, event.data)
    }

    // 등록된 리스너들에게 이벤트 전달
    const listeners = this.listeners.get(event.type)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event.data)
        } catch (error) {
          console.error('이벤트 리스너 오류:', error)
        }
      })
    }

    // 모든 이벤트에 대한 범용 리스너
    const allListeners = this.listeners.get('*' as RealtimeEventType)
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.error('범용 이벤트 리스너 오류:', error)
        }
      })
    }
  }

  /**
   * 연결 해제 처리
   */
  private handleDisconnect(code: number): void {
    this.stopHeartbeat()

    // 정상적인 종료가 아닌 경우 재연결 시도
    if (code !== 1000 && this.options.autoReconnect && this.sessionId) {
      this.scheduleReconnect()
    } else {
      this.setState('disconnected')
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('최대 재연결 시도 횟수 초과')
      this.setState('error')
      return
    }

    this.reconnectAttempts++
    const delay = this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId).catch(error => {
          console.error('재연결 실패:', error)
          this.scheduleReconnect()
        })
      }
    }, delay)
  }

  /**
   * 재연결 타이머 중지
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
  }

  /**
   * 하트비트 시작
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('session_updated', { type: 'heartbeat' })
      }
    }, this.options.heartbeatInterval)
  }

  /**
   * 하트비트 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 연결 상태 변경
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState
      this.stateListeners.forEach(listener => {
        try {
          listener(newState)
        } catch (error) {
          console.error('상태 리스너 오류:', error)
        }
      })
    }
  }

  /**
   * 현재 사용자 ID 가져오기
   * TODO: 실제 인증 시스템과 연동
   */
  private getCurrentUserId(): string {
    // 임시 구현 - 실제로는 auth store에서 가져와야 함
    return localStorage.getItem('userId') || 'anonymous'
  }

  /**
   * 정리 작업
   */
  destroy(): void {
    this.disconnect()
    this.listeners.clear()
    this.stateListeners.clear()
  }
}

/**
 * 싱글톤 WebSocket 클라이언트
 */
class WebSocketManager {
  private clients = new Map<string, WebSocketFeedbackClient>()

  /**
   * 세션용 클라이언트 가져오기 또는 생성
   */
  getClient(sessionId: string, options?: Partial<ConnectionOptions>): WebSocketFeedbackClient {
    if (!this.clients.has(sessionId)) {
      const client = new WebSocketFeedbackClient(options)
      this.clients.set(sessionId, client)

      // 연결 해제 시 자동 정리
      client.onStateChange((state) => {
        if (state === 'disconnected') {
          this.clients.delete(sessionId)
        }
      })
    }

    return this.clients.get(sessionId)!
  }

  /**
   * 특정 세션 클라이언트 해제
   */
  disconnect(sessionId: string): void {
    const client = this.clients.get(sessionId)
    if (client) {
      client.disconnect()
      this.clients.delete(sessionId)
    }
  }

  /**
   * 모든 클라이언트 해제
   */
  disconnectAll(): void {
    this.clients.forEach(client => client.disconnect())
    this.clients.clear()
  }
}

// 전역 WebSocket 매니저
export const webSocketManager = new WebSocketManager()

// 편의 함수들
export function connectToFeedbackSession(
  sessionId: string,
  options?: Partial<ConnectionOptions>
): WebSocketFeedbackClient {
  return webSocketManager.getClient(sessionId, options)
}

export function disconnectFromFeedbackSession(sessionId: string): void {
  webSocketManager.disconnect(sessionId)
}