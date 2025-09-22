/**
 * 멘션 시스템 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux 상태와 연동
 * - $300 사건 방지: 중복 멘션 생성 방지
 * - 실시간 알림 및 사운드 처리
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch } from '../../../app/store'
import type {
  Mention,
  CreateMentionRequest,
  MentionContext,
  MentionType,
  CollaborationSearchFilters
} from '../../../entities/collaboration'
import { CollaborationDomain } from '../../../entities/collaboration'
import {
  createMentionAsync,
  markMentionAsReadAsync,
  addMention,
  setSelectedMention,
  toggleMentionPanel,
  clearMentionError,
  selectMentions,
  selectUnreadMentions,
  selectMyMentions,
  selectCurrentSession,
  selectMyPresence,
  selectCollaborationLoadingState,
  selectCollaborationErrors
} from '../store/collaboration-slice'

// ===========================================
// 타입 정의
// ===========================================

export interface UseMentionsOptions {
  /**
   * 자동으로 소리 알림을 재생할지 여부
   */
  readonly enableSoundNotifications?: boolean

  /**
   * 자동으로 브라우저 알림을 표시할지 여부
   */
  readonly enableBrowserNotifications?: boolean

  /**
   * 멘션 필터 (내 멘션만 표시 등)
   */
  readonly defaultFilters?: CollaborationSearchFilters

  /**
   * 실시간 업데이트 간격 (ms)
   */
  readonly updateInterval?: number

  /**
   * 자동 읽음 처리 (포커스 시)
   */
  readonly autoMarkAsRead?: boolean
}

export interface UseMentionsReturn {
  // 멘션 데이터
  readonly mentions: readonly Mention[]
  readonly unreadMentions: readonly Mention[]
  readonly myMentions: readonly Mention[]
  readonly filteredMentions: readonly Mention[]

  // 멘션 통계
  readonly unreadCount: number
  readonly totalMentions: number
  readonly mentionsByType: Record<MentionType, number>

  // 현재 선택된 멘션
  readonly selectedMention: Mention | null

  // UI 상태
  readonly showMentionPanel: boolean
  readonly isCreatingMention: boolean
  readonly error: string | null

  // 액션 함수들
  readonly createMention: (request: CreateMentionRequest) => Promise<void>
  readonly markAsRead: (mentionId: string) => Promise<void>
  readonly markAllAsRead: () => Promise<void>
  readonly selectMention: (mentionId: string | null) => void
  readonly togglePanel: () => void
  readonly clearErrors: () => void

  // 멘션 생성 헬퍼들
  readonly mentionUser: (userId: string, message: string, context: MentionContext, contextId: string) => Promise<void>
  readonly mentionEveryone: (message: string, context: MentionContext, contextId: string) => Promise<void>
  readonly mentionHere: (message: string, context: MentionContext, contextId: string) => Promise<void>

  // 검색 및 필터링
  readonly searchMentions: (query: string) => readonly Mention[]
  readonly filterMentions: (filters: CollaborationSearchFilters) => readonly Mention[]

  // 유틸리티
  readonly formatMentionText: (mention: Mention) => string
  readonly getMentionPriority: (mention: Mention) => number
}

// ===========================================
// 알림 유틸리티 함수들
// ===========================================

const playNotificationSound = (() => {
  let audioContext: AudioContext | null = null

  return () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    // 간단한 알림음 생성
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }
})()

const showBrowserNotification = (mention: Mention) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('새 멘션', {
      body: `${mention.mentionedBy.name}: ${mention.message}`,
      icon: mention.mentionedBy.avatar || '/default-avatar.png',
      tag: `mention-${mention.id}`,
      requireInteraction: false
    })

    setTimeout(() => notification.close(), 5000)
  }
}

// ===========================================
// 메인 훅
// ===========================================

export function useMentions(options: UseMentionsOptions = {}): UseMentionsReturn {
  const {
    enableSoundNotifications = true,
    enableBrowserNotifications = true,
    defaultFilters = {},
    updateInterval = 5000,
    autoMarkAsRead = true
  } = options

  const dispatch = useDispatch<AppDispatch>()

  // 이전 상태 추적용
  const prevUnreadCountRef = useRef(0)
  const lastFocusTimeRef = useRef(Date.now())

  // Redux 상태 선택
  const mentions = useSelector(selectMentions)
  const unreadMentions = useSelector(selectUnreadMentions)
  const myMentions = useSelector(selectMyMentions)
  const currentSession = useSelector(selectCurrentSession)
  const myPresence = useSelector(selectMyPresence)
  const { isCreatingMention } = useSelector(selectCollaborationLoadingState)
  const { mentionError } = useSelector(selectCollaborationErrors)

  const state = useSelector((state: any) => state.collaboration)
  const { selectedMentionId, showMentionPanel } = state

  // ===========================================
  // 계산된 값들
  // ===========================================

  const selectedMention = useMemo(() => {
    return selectedMentionId ? mentions.find(m => m.id === selectedMentionId) || null : null
  }, [mentions, selectedMentionId])

  const unreadCount = unreadMentions.length

  const totalMentions = mentions.length

  const mentionsByType = useMemo(() => {
    return mentions.reduce((acc, mention) => {
      acc[mention.type] = (acc[mention.type] || 0) + 1
      return acc
    }, {} as Record<MentionType, number>)
  }, [mentions])

  const filteredMentions = useMemo(() => {
    if (Object.keys(defaultFilters).length === 0) {
      return mentions
    }

    return CollaborationDomain.Mention.filterMentions(mentions, defaultFilters)
  }, [mentions, defaultFilters])

  // ===========================================
  // 액션 함수들
  // ===========================================

  const createMention = useCallback(async (request: CreateMentionRequest) => {
    if (!currentSession || !myPresence) {
      throw new Error('No active collaboration session')
    }

    // $300 사건 방지: 중복 생성 방지
    if (isCreatingMention) {
      throw new Error('Mention creation already in progress')
    }

    await dispatch(createMentionAsync(request)).unwrap()
  }, [dispatch, currentSession, myPresence, isCreatingMention])

  const markAsRead = useCallback(async (mentionId: string) => {
    await dispatch(markMentionAsReadAsync(mentionId)).unwrap()
  }, [dispatch])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = unreadMentions.map(m => m.id)
    await Promise.all(unreadIds.map(id => dispatch(markMentionAsReadAsync(id))))
  }, [dispatch, unreadMentions])

  const selectMention = useCallback((mentionId: string | null) => {
    dispatch(setSelectedMention(mentionId))

    // 선택한 멘션을 자동으로 읽음 처리
    if (mentionId && autoMarkAsRead) {
      const mention = mentions.find(m => m.id === mentionId)
      if (mention && !mention.isRead) {
        markAsRead(mentionId)
      }
    }
  }, [dispatch, mentions, autoMarkAsRead, markAsRead])

  const togglePanel = useCallback(() => {
    dispatch(toggleMentionPanel())
  }, [dispatch])

  const clearErrors = useCallback(() => {
    dispatch(clearMentionError())
  }, [dispatch])

  // ===========================================
  // 멘션 생성 헬퍼들
  // ===========================================

  const mentionUser = useCallback(async (
    userId: string,
    message: string,
    context: MentionContext,
    contextId: string
  ) => {
    const request: CreateMentionRequest = {
      type: 'user',
      mentionedUserIds: [userId],
      context,
      contextId,
      message
    }

    await createMention(request)
  }, [createMention])

  const mentionEveryone = useCallback(async (
    message: string,
    context: MentionContext,
    contextId: string
  ) => {
    const request: CreateMentionRequest = {
      type: 'everyone',
      mentionedUserIds: [],
      context,
      contextId,
      message
    }

    await createMention(request)
  }, [createMention])

  const mentionHere = useCallback(async (
    message: string,
    context: MentionContext,
    contextId: string
  ) => {
    const request: CreateMentionRequest = {
      type: 'here',
      mentionedUserIds: [],
      context,
      contextId,
      message
    }

    await createMention(request)
  }, [createMention])

  // ===========================================
  // 검색 및 필터링
  // ===========================================

  const searchMentions = useCallback((query: string) => {
    if (!query.trim()) return mentions

    const lowerQuery = query.toLowerCase()
    return mentions.filter(mention =>
      mention.message.toLowerCase().includes(lowerQuery) ||
      mention.mentionedBy.name.toLowerCase().includes(lowerQuery) ||
      mention.mentionedUsers.some(user => user.name.toLowerCase().includes(lowerQuery))
    )
  }, [mentions])

  const filterMentions = useCallback((filters: CollaborationSearchFilters) => {
    return CollaborationDomain.Mention.filterMentions(mentions, filters)
  }, [mentions])

  // ===========================================
  // 유틸리티 함수들
  // ===========================================

  const formatMentionText = useCallback((mention: Mention) => {
    return CollaborationDomain.formatMentionText(mention)
  }, [])

  const getMentionPriority = useCallback((mention: Mention) => {
    return CollaborationDomain.calculateMentionPriority(mention)
  }, [])

  // ===========================================
  // 사이드 이펙트 처리
  // ===========================================

  // 새 멘션에 대한 알림 처리
  useEffect(() => {
    const currentUnreadCount = unreadCount

    // 읽지 않은 멘션이 증가한 경우 알림
    if (currentUnreadCount > prevUnreadCountRef.current) {
      const newMentions = unreadMentions.slice(0, currentUnreadCount - prevUnreadCountRef.current)

      newMentions.forEach(mention => {
        // 내가 보낸 멘션은 알림하지 않음
        if (mention.mentionedBy.id === myPresence?.userId) {
          return
        }

        // 사운드 알림
        if (enableSoundNotifications) {
          try {
            playNotificationSound()
          } catch (error) {
            console.warn('Failed to play notification sound:', error)
          }
        }

        // 브라우저 알림
        if (enableBrowserNotifications) {
          showBrowserNotification(mention)
        }
      })
    }

    prevUnreadCountRef.current = currentUnreadCount
  }, [unreadCount, unreadMentions, myPresence, enableSoundNotifications, enableBrowserNotifications])

  // 포커스 시 자동 읽음 처리
  useEffect(() => {
    if (!autoMarkAsRead) return

    const handleFocus = () => {
      const now = Date.now()

      // 5초 이상 포커스를 잃었다가 다시 돌아온 경우
      if (now - lastFocusTimeRef.current > 5000) {
        const recentUnreadMentions = unreadMentions.filter(
          mention => mention.createdAt.getTime() > lastFocusTimeRef.current
        )

        recentUnreadMentions.forEach(mention => {
          markAsRead(mention.id)
        })
      }

      lastFocusTimeRef.current = now
    }

    const handleBlur = () => {
      lastFocusTimeRef.current = Date.now()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [autoMarkAsRead, unreadMentions, markAsRead])

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if (enableBrowserNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [enableBrowserNotifications])

  // ===========================================
  // 반환값
  // ===========================================

  return {
    // 멘션 데이터
    mentions,
    unreadMentions,
    myMentions,
    filteredMentions,

    // 멘션 통계
    unreadCount,
    totalMentions,
    mentionsByType,

    // 현재 선택된 멘션
    selectedMention,

    // UI 상태
    showMentionPanel,
    isCreatingMention,
    error: mentionError,

    // 액션 함수들
    createMention,
    markAsRead,
    markAllAsRead,
    selectMention,
    togglePanel,
    clearErrors,

    // 멘션 생성 헬퍼들
    mentionUser,
    mentionEveryone,
    mentionHere,

    // 검색 및 필터링
    searchMentions,
    filterMentions,

    // 유틸리티
    formatMentionText,
    getMentionPriority
  }
}

// ===========================================
// 특수 목적 훅들
// ===========================================

/**
 * 읽지 않은 멘션만 조회하는 간단한 훅
 */
export function useUnreadMentions() {
  const unreadMentions = useSelector(selectUnreadMentions)
  const unreadCount = unreadMentions.length

  return {
    unreadMentions,
    unreadCount,
    hasUnreadMentions: unreadCount > 0
  }
}

/**
 * 멘션 알림 관리 훅
 */
export function useMentionNotifications(enabled = true) {
  const { unreadCount } = useUnreadMentions()

  useEffect(() => {
    if (!enabled || unreadCount === 0) return

    // 브라우저 탭 제목에 읽지 않은 멘션 수 표시
    const originalTitle = document.title
    document.title = `(${unreadCount}) ${originalTitle}`

    return () => {
      document.title = originalTitle
    }
  }, [enabled, unreadCount])

  return {
    unreadCount,
    isNotificationEnabled: enabled
  }
}