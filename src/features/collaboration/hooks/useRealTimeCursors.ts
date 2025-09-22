/**
 * 실시간 커서 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux 상태와 연동
 * - $300 사건 방지: 과도한 커서 업데이트 방지 (디바운싱)
 * - 부드러운 애니메이션과 성능 최적화
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch } from '../../../app/store'
import type {
  RealTimeCursor,
  UpdateCursorRequest,
  CursorState,
  CollaborationUser
} from '../../../entities/collaboration'
import { CollaborationDomain } from '../../../entities/collaboration'
import {
  updateCursorAsync,
  updateOtherCursor,
  removeUserCursor,
  setCursorHighlights,
  toggleCursorTrails,
  selectCursors,
  selectMyCursor,
  selectParticipants,
  selectMyPresence,
  selectConnectionStatus,
  selectCollaborationLoadingState,
  selectCollaborationErrors
} from '../store/collaboration-slice'

// ===========================================
// 타입 정의
// ===========================================

export interface UseRealTimeCursorsOptions {
  /**
   * 커서 업데이트 디바운싱 시간 (ms)
   */
  readonly updateDebounceMs?: number

  /**
   * 커서 애니메이션 활성화 여부
   */
  readonly enableAnimation?: boolean

  /**
   * 커서 트레일 표시 여부
   */
  readonly enableTrails?: boolean

  /**
   * 내 커서 표시 여부
   */
  readonly showMyCursor?: boolean

  /**
   * 비활성 커서 자동 숨김 시간 (ms)
   */
  readonly hideIdleCursorsAfter?: number

  /**
   * 커서 충돌 감지 활성화
   */
  readonly enableCollisionDetection?: boolean

  /**
   * 커서 충돌 임계값 (픽셀)
   */
  readonly collisionThreshold?: number
}

export interface CursorWithUser extends RealTimeCursor {
  readonly color: string
  readonly isColliding: boolean
  readonly animationPath?: Array<{ x: number; y: number }>
}

export interface UseRealTimeCursorsReturn {
  // 커서 데이터
  readonly cursors: readonly CursorWithUser[]
  readonly myCursor: RealTimeCursor | null
  readonly activeCursors: readonly CursorWithUser[]
  readonly idleCursors: readonly CursorWithUser[]

  // 커서 상태
  readonly cursorCount: number
  readonly isConnected: boolean
  readonly isUpdatingCursor: boolean

  // 충돌 감지
  readonly collisions: Array<{
    cursor1: RealTimeCursor
    cursor2: RealTimeCursor
    distance: number
  }>

  // UI 설정
  readonly showTrails: boolean
  readonly highlightedCursors: readonly string[]

  // 액션 함수들
  readonly updateCursor: (request: UpdateCursorRequest) => Promise<void>
  readonly updateCursorPosition: (x: number, y: number, elementId?: string) => void
  readonly updateCursorState: (state: CursorState) => void
  readonly highlightCursors: (userIds: readonly string[]) => void
  readonly toggleTrails: () => void

  // 마우스 이벤트 핸들러들
  readonly handleMouseMove: (event: MouseEvent) => void
  readonly handleMouseDown: (event: MouseEvent) => void
  readonly handleMouseUp: (event: MouseEvent) => void
  readonly handleMouseEnter: (elementId: string) => void
  readonly handleMouseLeave: () => void

  // 유틸리티
  readonly getCursorColor: (userId: string) => string
  readonly getCursorDistance: (cursor1: RealTimeCursor, cursor2: RealTimeCursor) => number
  readonly isUserActive: (userId: string) => boolean
}

// ===========================================
// 커서 색상 생성 유틸리티
// ===========================================

const generateCursorColor = (userId: string): string => {
  // 사용자 ID를 기반으로 일관성 있는 색상 생성
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  // HSL 색상으로 변환 (채도와 명도는 고정하여 시인성 보장)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 85%, 60%)`
}

// ===========================================
// 디바운싱 유틸리티
// ===========================================

function useDebounce<T extends any[]>(
  callback: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
}

// ===========================================
// 메인 훅
// ===========================================

export function useRealTimeCursors(
  options: UseRealTimeCursorsOptions = {}
): UseRealTimeCursorsReturn {
  const {
    updateDebounceMs = 100,
    enableAnimation = true,
    enableTrails = true,
    showMyCursor = false,
    hideIdleCursorsAfter = 30000,
    enableCollisionDetection = true,
    collisionThreshold = 50
  } = options

  const dispatch = useDispatch<AppDispatch>()

  // 로컬 상태
  const [currentCursorState, setCurrentCursorState] = useState<CursorState>('idle')
  const [currentElementId, setCurrentElementId] = useState<string>()
  const [lastUpdateTime, setLastUpdateTime] = useState(0)

  // 참조
  const viewportRef = useRef<{ width: number; height: number; scrollX: number; scrollY: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY
  })

  // Redux 상태 선택
  const cursors = useSelector(selectCursors)
  const myCursor = useSelector(selectMyCursor)
  const participants = useSelector(selectParticipants)
  const myPresence = useSelector(selectMyPresence)
  const connectionStatus = useSelector(selectConnectionStatus)
  const { isUpdatingCursor } = useSelector(selectCollaborationLoadingState)

  const state = useSelector((state: any) => state.collaboration)
  const { cursorHighlights, showCursorTrails } = state

  // ===========================================
  // 계산된 값들
  // ===========================================

  const cursorsWithMetadata = useMemo(() => {
    return cursors.map(cursor => {
      const color = generateCursorColor(cursor.userId)

      return {
        ...cursor,
        color,
        isColliding: false // 나중에 충돌 감지 로직에서 설정
      }
    }).filter(cursor => showMyCursor || cursor.userId !== myPresence?.userId)
  }, [cursors, showMyCursor, myPresence])

  const activeCursors = useMemo(() => {
    return CollaborationDomain.RealTimeCursor.filterActiveCursors(
      cursorsWithMetadata,
      hideIdleCursorsAfter
    )
  }, [cursorsWithMetadata, hideIdleCursorsAfter])

  const idleCursors = useMemo(() => {
    return cursorsWithMetadata.filter(cursor => !activeCursors.includes(cursor))
  }, [cursorsWithMetadata, activeCursors])

  const collisions = useMemo(() => {
    if (!enableCollisionDetection) return []

    return CollaborationDomain.RealTimeCursor.detectCursorCollisions(
      activeCursors,
      collisionThreshold
    )
  }, [activeCursors, enableCollisionDetection, collisionThreshold])

  // 충돌 정보를 커서에 반영
  const cursorsWithCollisions = useMemo(() => {
    const collidingUserIds = new Set(
      collisions.flatMap(collision => [collision.cursor1.userId, collision.cursor2.userId])
    )

    return cursorsWithMetadata.map(cursor => ({
      ...cursor,
      isColliding: collidingUserIds.has(cursor.userId)
    }))
  }, [cursorsWithMetadata, collisions])

  const cursorCount = cursors.length
  const isConnected = connectionStatus === 'connected'

  // ===========================================
  // 디바운싱된 커서 업데이트 함수
  // ===========================================

  const debouncedUpdateCursor = useDebounce(
    async (request: UpdateCursorRequest) => {
      if (!isConnected || !myPresence) return

      // $300 사건 방지: 너무 빈번한 업데이트 방지
      const now = Date.now()
      if (now - lastUpdateTime < updateDebounceMs) return

      try {
        await dispatch(updateCursorAsync(request)).unwrap()
        setLastUpdateTime(now)
      } catch (error) {
        console.warn('Failed to update cursor:', error)
      }
    },
    updateDebounceMs
  )

  // ===========================================
  // 액션 함수들
  // ===========================================

  const updateCursor = useCallback(async (request: UpdateCursorRequest) => {
    await debouncedUpdateCursor(request)
  }, [debouncedUpdateCursor])

  const updateCursorPosition = useCallback((
    x: number,
    y: number,
    elementId?: string
  ) => {
    const request: UpdateCursorRequest = {
      position: {
        x: Math.round(x),
        y: Math.round(y),
        elementId,
        componentType: elementId ? 'element' : undefined
      },
      state: currentCursorState,
      viewport: viewportRef.current
    }

    updateCursor(request)
  }, [updateCursor, currentCursorState])

  const updateCursorState = useCallback((state: CursorState) => {
    setCurrentCursorState(state)

    if (myCursor) {
      const request: UpdateCursorRequest = {
        position: myCursor.position,
        state,
        viewport: viewportRef.current
      }

      updateCursor(request)
    }
  }, [updateCursor, myCursor])

  const highlightCursors = useCallback((userIds: readonly string[]) => {
    dispatch(setCursorHighlights(userIds))
  }, [dispatch])

  const toggleTrails = useCallback(() => {
    dispatch(toggleCursorTrails())
  }, [dispatch])

  // ===========================================
  // 마우스 이벤트 핸들러들
  // ===========================================

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const { clientX, clientY } = event
    updateCursorPosition(clientX, clientY, currentElementId)
    updateCursorState('moving')
  }, [updateCursorPosition, updateCursorState, currentElementId])

  const handleMouseDown = useCallback((event: MouseEvent) => {
    updateCursorState('selecting')
  }, [updateCursorState])

  const handleMouseUp = useCallback((event: MouseEvent) => {
    updateCursorState('idle')
  }, [updateCursorState])

  const handleMouseEnter = useCallback((elementId: string) => {
    setCurrentElementId(elementId)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setCurrentElementId(undefined)
  }, [])

  // ===========================================
  // 유틸리티 함수들
  // ===========================================

  const getCursorColor = useCallback((userId: string) => {
    return generateCursorColor(userId)
  }, [])

  const getCursorDistance = useCallback((
    cursor1: RealTimeCursor,
    cursor2: RealTimeCursor
  ) => {
    return CollaborationDomain.RealTimeCursor.calculateCursorDistance(cursor1, cursor2)
  }, [])

  const isUserActive = useCallback((userId: string) => {
    return participants.some(p => p.userId === userId && p.status === 'active')
  }, [participants])

  // ===========================================
  // 사이드 이펙트 처리
  // ===========================================

  // 뷰포트 크기 변경 감지
  useEffect(() => {
    const updateViewport = () => {
      viewportRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      }
    }

    const handleResize = () => updateViewport()
    const handleScroll = () => updateViewport()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 마우스 이벤트 리스너 등록
  useEffect(() => {
    if (!isConnected) return

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isConnected, handleMouseMove, handleMouseDown, handleMouseUp])

  // 비활성 상태 감지 (5초 동안 마우스 움직임 없으면 idle)
  useEffect(() => {
    const idleTimeout = setTimeout(() => {
      if (currentCursorState !== 'idle') {
        updateCursorState('idle')
      }
    }, 5000)

    return () => clearTimeout(idleTimeout)
  }, [lastUpdateTime, currentCursorState, updateCursorState])

  // 페이지 언로드 시 커서 제거
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (myPresence) {
        dispatch(removeUserCursor(myPresence.userId))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [myPresence, dispatch])

  // ===========================================
  // 반환값
  // ===========================================

  return {
    // 커서 데이터
    cursors: cursorsWithCollisions,
    myCursor,
    activeCursors,
    idleCursors,

    // 커서 상태
    cursorCount,
    isConnected,
    isUpdatingCursor,

    // 충돌 감지
    collisions,

    // UI 설정
    showTrails: showCursorTrails,
    highlightedCursors: cursorHighlights,

    // 액션 함수들
    updateCursor,
    updateCursorPosition,
    updateCursorState,
    highlightCursors,
    toggleTrails,

    // 마우스 이벤트 핸들러들
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseEnter,
    handleMouseLeave,

    // 유틸리티
    getCursorColor,
    getCursorDistance,
    isUserActive
  }
}

// ===========================================
// 특수 목적 훅들
// ===========================================

/**
 * 간단한 커서 표시 훅 (읽기 전용)
 */
export function useCursorDisplay() {
  const cursors = useSelector(selectCursors)
  const myPresence = useSelector(selectMyPresence)

  const otherCursors = useMemo(() => {
    return cursors.filter(cursor => cursor.userId !== myPresence?.userId)
  }, [cursors, myPresence])

  return {
    cursors: otherCursors,
    cursorCount: otherCursors.length
  }
}

/**
 * 커서 애니메이션 훅
 */
export function useCursorAnimation(cursor: RealTimeCursor, enabled = true) {
  const [animatedPosition, setAnimatedPosition] = useState(cursor.position)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    if (!enabled) {
      setAnimatedPosition(cursor.position)
      return
    }

    const animate = () => {
      setAnimatedPosition(prev => {
        const dx = cursor.position.x - prev.x
        const dy = cursor.position.y - prev.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // 거리가 작으면 즉시 이동
        if (distance < 2) {
          return cursor.position
        }

        // 부드러운 이동 (lerp)
        const speed = 0.2
        return {
          x: prev.x + dx * speed,
          y: prev.y + dy * speed,
          elementId: cursor.position.elementId,
          componentType: cursor.position.componentType
        }
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [cursor.position, enabled])

  return animatedPosition
}