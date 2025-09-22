/**
 * 실시간 커서 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 부드러운 애니메이션과 성능 최적화
 * - 접근성 고려
 */

'use client'

import React, { memo, useEffect, useState, useRef } from 'react'
import { useCursorAnimation } from '../../features/collaboration'
import type { RealTimeCursor } from '../../entities/collaboration'

// ===========================================
// 타입 정의
// ===========================================

export interface RealTimeCursorProps {
  /**
   * 커서 데이터
   */
  readonly cursor: RealTimeCursor

  /**
   * 커서 색상
   */
  readonly color?: string

  /**
   * 애니메이션 활성화 여부
   */
  readonly enableAnimation?: boolean

  /**
   * 트레일 표시 여부
   */
  readonly showTrail?: boolean

  /**
   * 사용자 이름 표시 여부
   */
  readonly showUserName?: boolean

  /**
   * 아바타 표시 여부
   */
  readonly showAvatar?: boolean

  /**
   * 크기
   */
  readonly size?: 'sm' | 'md' | 'lg'

  /**
   * 하이라이트 여부
   */
  readonly isHighlighted?: boolean

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 클릭 이벤트 핸들러
   */
  readonly onClick?: (cursor: RealTimeCursor) => void
}

// ===========================================
// 서브 컴포넌트들
// ===========================================

const CursorIcon = memo(function CursorIcon({
  color,
  size = 'md',
  state,
  className = ''
}: {
  color: string
  size: 'sm' | 'md' | 'lg'
  state: string
  className?: string
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
    >
      {/* 커서 모양 */}
      <path
        d="M4 2L4 22L8.5 17.5L12 22L16 20L12.5 15.5L18 11L4 2Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />

      {/* 상태에 따른 추가 표시 */}
      {state === 'typing' && (
        <circle
          cx="20"
          cy="4"
          r="3"
          fill="#10b981"
          className="animate-pulse"
        />
      )}

      {state === 'selecting' && (
        <rect
          x="16"
          y="2"
          width="6"
          height="4"
          fill={color}
          opacity="0.6"
          className="animate-pulse"
        />
      )}
    </svg>
  )
})

const UserLabel = memo(function UserLabel({
  user,
  color,
  showAvatar = true,
  size = 'md'
}: {
  user: RealTimeCursor['user']
  color: string
  showAvatar?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }

  const avatarSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div
      className={`
        inline-flex items-center space-x-1.5
        rounded-full border border-white
        shadow-sm backdrop-blur-sm
        ${sizeClasses[size]}
      `}
      style={{
        backgroundColor: `${color}20`,
        borderColor: color
      }}
    >
      {showAvatar && user.avatar && (
        <img
          src={user.avatar}
          alt={user.name}
          className={`${avatarSizeClasses[size]} rounded-full object-cover`}
        />
      )}
      <span
        className="font-medium whitespace-nowrap"
        style={{ color }}
      >
        {user.name}
      </span>
    </div>
  )
})

const CursorTrail = memo(function CursorTrail({
  positions,
  color,
  opacity = 0.6
}: {
  positions: Array<{ x: number; y: number }>
  color: string
  opacity?: number
}) {
  if (positions.length < 2) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <path
        d={`M ${positions.map(p => `${p.x},${p.y}`).join(' L ')}`}
        stroke={color}
        strokeWidth="2"
        fill="none"
        opacity={opacity}
        strokeDasharray="2,2"
        className="animate-pulse"
      />
    </svg>
  )
})

const SelectionHighlight = memo(function SelectionHighlight({
  cursor,
  color
}: {
  cursor: RealTimeCursor
  color: string
}) {
  if (!cursor.selection || cursor.state !== 'selecting') return null

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        backgroundColor: `${color}20`,
        border: `1px solid ${color}`,
        borderRadius: '2px',
        // 실제로는 선택 영역의 정확한 위치를 계산해야 함
        width: '100px',
        height: '20px',
        top: '-10px',
        left: '20px'
      }}
    />
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const RealTimeCursor = memo(function RealTimeCursor({
  cursor,
  color = '#3b82f6',
  enableAnimation = true,
  showTrail = false,
  showUserName = true,
  showAvatar = true,
  size = 'md',
  isHighlighted = false,
  className = '',
  onClick
}: RealTimeCursorProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [trailPositions, setTrailPositions] = useState<Array<{ x: number; y: number }>>([])
  const lastPositionRef = useRef(cursor.position)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // 애니메이션된 위치 (부드러운 이동)
  const animatedPosition = useCursorAnimation(cursor, enableAnimation)

  // ===========================================
  // 트레일 처리
  // ===========================================

  useEffect(() => {
    if (!showTrail) return

    const currentPos = { x: animatedPosition.x, y: animatedPosition.y }
    const lastPos = lastPositionRef.current

    // 위치가 변경된 경우에만 트레일에 추가
    if (lastPos.x !== currentPos.x || lastPos.y !== currentPos.y) {
      setTrailPositions(prev => {
        const newTrail = [currentPos, ...prev].slice(0, 10) // 최대 10개 위치 유지
        return newTrail
      })
      lastPositionRef.current = animatedPosition
    }
  }, [animatedPosition, showTrail])

  // ===========================================
  // 가시성 처리 (30초 후 자동 숨김)
  // ===========================================

  useEffect(() => {
    // 커서가 업데이트될 때마다 가시성 리셋
    setIsVisible(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // idle 상태가 아닌 경우에만 타이머 설정
    if (cursor.state !== 'idle') {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false)
      }, 30000) // 30초
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [cursor.lastUpdated, cursor.state])

  // ===========================================
  // 이벤트 핸들러
  // ===========================================

  const handleClick = () => {
    onClick?.(cursor)
  }

  // ===========================================
  // 스타일 계산
  // ===========================================

  const cursorStyle = {
    transform: `translate(${animatedPosition.x}px, ${animatedPosition.y}px)`,
    transition: enableAnimation ? 'transform 0.1s ease-out' : 'none',
    zIndex: isHighlighted ? 1000 : 100
  }

  const highlightStyle = isHighlighted ? {
    filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))',
    transform: 'scale(1.2)'
  } : {}

  // 보이지 않는 경우 렌더링하지 않음
  if (!isVisible) return null

  // ===========================================
  // 렌더링
  // ===========================================

  return (
    <div
      className={`
        fixed pointer-events-none z-50
        ${isHighlighted ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{ ...cursorStyle, ...highlightStyle }}
      role="img"
      aria-label={`${cursor.user.name}의 커서`}
    >
      {/* 트레일 */}
      {showTrail && trailPositions.length > 1 && (
        <CursorTrail
          positions={trailPositions}
          color={color}
          opacity={0.4}
        />
      )}

      {/* 선택 영역 하이라이트 */}
      <SelectionHighlight cursor={cursor} color={color} />

      {/* 커서 아이콘 */}
      <div
        className={onClick ? 'cursor-pointer pointer-events-auto' : ''}
        onClick={handleClick}
      >
        <CursorIcon
          color={color}
          size={size}
          state={cursor.state}
          className={`
            transition-transform duration-200
            ${isHighlighted ? 'scale-110' : ''}
          `}
        />
      </div>

      {/* 사용자 라벨 */}
      {showUserName && (
        <div className="absolute top-6 left-2 pointer-events-auto">
          <UserLabel
            user={cursor.user}
            color={color}
            showAvatar={showAvatar}
            size={size}
          />
        </div>
      )}

      {/* 상태 표시 */}
      {cursor.state === 'typing' && (
        <div
          className="absolute -top-2 -right-2 w-3 h-3 rounded-full animate-ping"
          style={{ backgroundColor: '#10b981' }}
          aria-label="입력 중"
        />
      )}
    </div>
  )
})

// ===========================================
// 커서 컨테이너 컴포넌트
// ===========================================

export const CursorContainer = memo(function CursorContainer({
  cursors,
  highlightedUsers = [],
  showTrails = true,
  showUserNames = true,
  enableAnimation = true,
  onCursorClick
}: {
  cursors: Array<RealTimeCursor & { color: string }>
  highlightedUsers?: readonly string[]
  showTrails?: boolean
  showUserNames?: boolean
  enableAnimation?: boolean
  onCursorClick?: (cursor: RealTimeCursor) => void
}) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40" aria-live="polite">
      {cursors.map((cursor) => (
        <RealTimeCursor
          key={cursor.id}
          cursor={cursor}
          color={cursor.color}
          enableAnimation={enableAnimation}
          showTrail={showTrails}
          showUserName={showUserNames}
          isHighlighted={highlightedUsers.includes(cursor.userId)}
          onClick={onCursorClick}
        />
      ))}
    </div>
  )
})

// 기본 내보내기
export default RealTimeCursor