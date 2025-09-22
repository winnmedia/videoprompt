/**
 * Realtime Events System - Phase 3.9
 *
 * Supabase Realtime을 활용한 실시간 이벤트 시스템
 * CLAUDE.md 준수: 타입 안전성, 에러 처리, 성능 최적화
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import logger from './structured-logger'

// ===========================================
// 타입 정의
// ===========================================

export type ExtendedRealtimeEventType =
  | 'version_uploaded'
  | 'version_activated'
  | 'version_deleted'
  | 'thread_created'
  | 'thread_resolved'
  | 'comment_replied'
  | 'emotion_updated'
  | 'screenshot_captured'
  | 'screenshot_downloaded'
  | 'share_link_created'
  | 'share_link_accessed'
  | 'share_link_deactivated'

export interface ExtendedRealtimeEvent {
  readonly type: ExtendedRealtimeEventType
  readonly sessionId: string
  readonly userId: string
  readonly userName: string
  readonly timestamp: string
  readonly data: Record<string, any>
}

export interface RealtimeEventHandler {
  (event: ExtendedRealtimeEvent): void | Promise<void>
}

export interface RealtimeChannelOptions {
  sessionId: string
  userId?: string
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

// ===========================================
// 실시간 이벤트 매니저 클래스
// ===========================================

export class RealtimeEventsManager {
  private supabase: SupabaseClient
  private channels: Map<string, RealtimeChannel> = new Map()
  private eventHandlers: Map<ExtendedRealtimeEventType, Set<RealtimeEventHandler>> = new Map()
  private isInitialized = false

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 10, // 초당 최대 10개 이벤트
        },
      },
    })

    // 이벤트 핸들러 맵 초기화
    const eventTypes: ExtendedRealtimeEventType[] = [
      'version_uploaded',
      'version_activated',
      'version_deleted',
      'thread_created',
      'thread_resolved',
      'comment_replied',
      'emotion_updated',
      'screenshot_captured',
      'screenshot_downloaded',
      'share_link_created',
      'share_link_accessed',
      'share_link_deactivated',
    ]

    eventTypes.forEach(type => {
      this.eventHandlers.set(type, new Set())
    })
  }

  /**
   * 매니저 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Supabase 연결 상태 확인
      const { data, error } = await this.supabase.auth.getSession()

      if (error) {
        logger.warn('Realtime 매니저 초기화 시 인증 확인 실패', {
          error: error.message,
        })
      }

      this.isInitialized = true

      logger.info('Realtime 이벤트 매니저 초기화 완료', {
        component: 'RealtimeEventsManager',
        hasAuth: !!data.session,
      })

    } catch (error) {
      logger.error(
        'Realtime 매니저 초기화 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'RealtimeEventsManager',
        }
      )
      throw error
    }
  }

  /**
   * 세션 채널 구독
   */
  async subscribeToSession(options: RealtimeChannelOptions): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const channelName = `feedback_session_${options.sessionId}`

    // 이미 구독 중인 채널인지 확인
    if (this.channels.has(channelName)) {
      logger.warn('이미 구독 중인 채널입니다', { channelName })
      return channelName
    }

    try {
      const channel = this.supabase.channel(channelName, {
        config: {
          broadcast: { self: false }, // 자신이 보낸 이벤트는 받지 않음
          presence: { key: options.userId || 'anonymous' },
        },
      })

      // 브로드캐스트 이벤트 리스너
      channel.on('broadcast', { event: '*' }, (payload) => {
        this.handleBroadcastEvent(payload, options.sessionId)
      })

      // 연결 상태 리스너
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        logger.info('실시간 채널 presence 동기화', {
          channelName,
          presenceCount: Object.keys(state).length,
        })
      })

      // 채널 상태 변경 리스너
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info('실시간 채널 구독 성공', { channelName })
          options.onConnect?.()
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('실시간 채널 오류', err || new Error('Unknown channel error'), {
            channelName,
          })
          options.onError?.(err || new Error('Unknown channel error'))
        } else if (status === 'TIMED_OUT') {
          logger.warn('실시간 채널 타임아웃', { channelName })
          options.onError?.(new Error('Channel subscription timed out'))
        } else if (status === 'CLOSED') {
          logger.info('실시간 채널 연결 종료', { channelName })
          options.onDisconnect?.()
        }
      })

      // 채널 저장
      this.channels.set(channelName, channel)

      return channelName

    } catch (error) {
      logger.error(
        '실시간 채널 구독 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          channelName,
          sessionId: options.sessionId,
        }
      )
      throw error
    }
  }

  /**
   * 세션 채널 구독 해제
   */
  async unsubscribeFromSession(sessionId: string): Promise<void> {
    const channelName = `feedback_session_${sessionId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      logger.warn('구독 해제할 채널을 찾을 수 없습니다', { channelName })
      return
    }

    try {
      await this.supabase.removeChannel(channel)
      this.channels.delete(channelName)

      logger.info('실시간 채널 구독 해제 완료', { channelName })

    } catch (error) {
      logger.error(
        '실시간 채널 구독 해제 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          channelName,
        }
      )
      throw error
    }
  }

  /**
   * 이벤트 핸들러 등록
   */
  addEventListener(
    eventType: ExtendedRealtimeEventType,
    handler: RealtimeEventHandler
  ): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.add(handler)
      logger.debug('실시간 이벤트 핸들러 등록', {
        eventType,
        handlerCount: handlers.size,
      })
    }
  }

  /**
   * 이벤트 핸들러 제거
   */
  removeEventListener(
    eventType: ExtendedRealtimeEventType,
    handler: RealtimeEventHandler
  ): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      logger.debug('실시간 이벤트 핸들러 제거', {
        eventType,
        handlerCount: handlers.size,
      })
    }
  }

  /**
   * 이벤트 브로드캐스트
   */
  async broadcastEvent(
    sessionId: string,
    event: Omit<ExtendedRealtimeEvent, 'sessionId'>
  ): Promise<void> {
    const channelName = `feedback_session_${sessionId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      logger.warn('브로드캐스트할 채널을 찾을 수 없습니다', { channelName })
      return
    }

    try {
      const fullEvent: ExtendedRealtimeEvent = {
        ...event,
        sessionId,
      }

      await channel.send({
        type: 'broadcast',
        event: event.type,
        payload: fullEvent,
      })

      logger.debug('실시간 이벤트 브로드캐스트 성공', {
        sessionId,
        eventType: event.type,
        userId: event.userId,
      })

    } catch (error) {
      logger.error(
        '실시간 이벤트 브로드캐스트 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          sessionId,
          eventType: event.type,
        }
      )
      throw error
    }
  }

  /**
   * 연결된 사용자 목록 조회
   */
  getPresenceUsers(sessionId: string): Record<string, any> {
    const channelName = `feedback_session_${sessionId}`
    const channel = this.channels.get(channelName)

    if (!channel) {
      return {}
    }

    return channel.presenceState()
  }

  /**
   * 모든 채널 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      for (const [channelName, channel] of this.channels) {
        await this.supabase.removeChannel(channel)
      }

      this.channels.clear()
      this.isInitialized = false

      logger.info('모든 실시간 채널 연결 해제 완료')

    } catch (error) {
      logger.error(
        '실시간 채널 연결 해제 실패',
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }

  /**
   * 브로드캐스트 이벤트 처리
   */
  private async handleBroadcastEvent(payload: any, sessionId: string): Promise<void> {
    try {
      const event: ExtendedRealtimeEvent = payload.payload

      // 이벤트 타입 검증
      if (!this.eventHandlers.has(event.type)) {
        logger.warn('알 수 없는 실시간 이벤트 타입', {
          eventType: event.type,
          sessionId,
        })
        return
      }

      const handlers = this.eventHandlers.get(event.type)
      if (!handlers || handlers.size === 0) {
        return
      }

      // 모든 핸들러에 이벤트 전달
      const handlerPromises = Array.from(handlers).map(async (handler) => {
        try {
          await handler(event)
        } catch (error) {
          logger.error(
            '실시간 이벤트 핸들러 실행 실패',
            error instanceof Error ? error : new Error(String(error)),
            {
              eventType: event.type,
              sessionId,
              userId: event.userId,
            }
          )
        }
      })

      await Promise.allSettled(handlerPromises)

      logger.debug('실시간 이벤트 처리 완료', {
        eventType: event.type,
        sessionId,
        handlerCount: handlers.size,
      })

    } catch (error) {
      logger.error(
        '브로드캐스트 이벤트 처리 실패',
        error instanceof Error ? error : new Error(String(error)),
        {
          sessionId,
        }
      )
    }
  }
}

// ===========================================
// 글로벌 인스턴스
// ===========================================

let globalRealtimeManager: RealtimeEventsManager | null = null

/**
 * 글로벌 실시간 이벤트 매니저 인스턴스 반환
 */
export function getRealtimeManager(): RealtimeEventsManager {
  if (!globalRealtimeManager) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL 또는 키가 설정되지 않았습니다')
    }

    globalRealtimeManager = new RealtimeEventsManager(supabaseUrl, supabaseKey)
  }

  return globalRealtimeManager
}

// ===========================================
// 유틸리티 함수들
// ===========================================

/**
 * 세션 실시간 이벤트 간편 구독
 */
export async function subscribeToSessionEvents(
  sessionId: string,
  userId?: string,
  eventHandlers?: Partial<Record<ExtendedRealtimeEventType, RealtimeEventHandler>>
): Promise<string> {
  const manager = getRealtimeManager()

  // 이벤트 핸들러 등록
  if (eventHandlers) {
    Object.entries(eventHandlers).forEach(([eventType, handler]) => {
      if (handler) {
        manager.addEventListener(eventType as ExtendedRealtimeEventType, handler)
      }
    })
  }

  return manager.subscribeToSession({
    sessionId,
    userId,
    onConnect: () => {
      logger.info('세션 실시간 이벤트 구독 성공', { sessionId, userId })
    },
    onDisconnect: () => {
      logger.info('세션 실시간 이벤트 연결 해제', { sessionId, userId })
    },
    onError: (error) => {
      logger.error('세션 실시간 이벤트 오류', error, { sessionId, userId })
    },
  })
}

/**
 * 세션 실시간 이벤트 구독 해제
 */
export async function unsubscribeFromSessionEvents(sessionId: string): Promise<void> {
  const manager = getRealtimeManager()
  return manager.unsubscribeFromSession(sessionId)
}

/**
 * 실시간 이벤트 브로드캐스트 간편 함수
 */
export async function broadcastSessionEvent(
  sessionId: string,
  eventType: ExtendedRealtimeEventType,
  userId: string,
  userName: string,
  data: Record<string, any>
): Promise<void> {
  const manager = getRealtimeManager()

  return manager.broadcastEvent(sessionId, {
    type: eventType,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    data,
  })
}

// ===========================================
// React Hook (선택적)
// ===========================================

/**
 * React용 실시간 이벤트 훅
 * 클라이언트 사이드에서만 사용
 */
export function useRealtimeEvents(
  sessionId: string,
  userId?: string,
  eventHandlers?: Partial<Record<ExtendedRealtimeEventType, RealtimeEventHandler>>
) {
  // 실제 구현에서는 useEffect, useState 등 React hooks 사용
  // 여기서는 타입 정의만 제공

  return {
    isConnected: false, // 연결 상태
    presenceUsers: {}, // 현재 접속 사용자
    connectionError: null as Error | null, // 연결 오류
    disconnect: async () => {}, // 연결 해제 함수
    broadcast: async (eventType: ExtendedRealtimeEventType, data: Record<string, any>) => {}, // 이벤트 브로드캐스트
  }
}