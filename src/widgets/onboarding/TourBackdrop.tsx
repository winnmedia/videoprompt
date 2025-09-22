/**
 * 투어 배경 오버레이 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 UI 컴포넌트
 * - Tailwind CSS v4 디자인 시스템
 * - 접근성 고려 (배경 클릭 시 동작)
 * - 성능 최적화 (GPU 가속 활용)
 */

'use client'

import React from 'react'

/**
 * 투어 배경 Props
 */
interface TourBackdropProps {
  /**
   * 표시 여부
   */
  isVisible: boolean

  /**
   * 배경 클릭 시 콜백
   */
  onClick?: () => void

  /**
   * 배경 어둡기 정도 (0-1)
   */
  opacity?: number

  /**
   * 애니메이션 지속시간 (ms)
   */
  animationDuration?: number

  /**
   * 추가 CSS 클래스
   */
  className?: string

  /**
   * 하이라이트할 요소의 CSS 선택자
   */
  highlightSelector?: string
}

/**
 * 투어 배경 오버레이 컴포넌트
 */
export const TourBackdrop = React.memo<TourBackdropProps>(({
  isVisible,
  onClick,
  opacity = 0.6,
  animationDuration = 300,
  className = '',
  highlightSelector
}) => {
  if (!isVisible) return null

  // 하이라이트 마스크 생성
  const createHighlightMask = () => {
    if (!highlightSelector) return undefined

    const element = document.querySelector(highlightSelector) as HTMLElement
    if (!element) return undefined

    const rect = element.getBoundingClientRect()
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    // SVG 마스크를 위한 좌표 계산
    const x = rect.left + scrollX
    const y = rect.top + scrollY
    const width = rect.width
    const height = rect.height
    const borderRadius = 8 // 기본 border radius

    return {
      x,
      y,
      width,
      height,
      borderRadius
    }
  }

  const highlightMask = createHighlightMask()

  return (
    <div
      className={`
        fixed inset-0 pointer-events-auto
        transition-opacity duration-${animationDuration} ease-in-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
      style={{
        backgroundColor: highlightMask ? 'transparent' : `rgba(0, 0, 0, ${opacity})`,
        willChange: 'opacity',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)' // GPU 가속
      }}
      onClick={onClick}
      data-testid="tour-backdrop"
      role="presentation"
      aria-hidden="true"
    >
      {/* SVG 마스크를 사용한 하이라이트 */}
      {highlightMask && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tour-highlight-mask">
              {/* 전체 영역을 흰색으로 채움 (마스크됨) */}
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="white"
              />
              {/* 하이라이트 영역을 검은색으로 자름 (마스크 제거) */}
              <rect
                x={highlightMask.x - 4}
                y={highlightMask.y - 4}
                width={highlightMask.width + 8}
                height={highlightMask.height + 8}
                rx={highlightMask.borderRadius}
                ry={highlightMask.borderRadius}
                fill="black"
              />
            </mask>
          </defs>

          {/* 마스크가 적용된 배경 */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`rgba(0, 0, 0, ${opacity})`}
            mask="url(#tour-highlight-mask)"
          />

          {/* 하이라이트 테두리 (선택적) */}
          <rect
            x={highlightMask.x - 2}
            y={highlightMask.y - 2}
            width={highlightMask.width + 4}
            height={highlightMask.height + 4}
            rx={highlightMask.borderRadius}
            ry={highlightMask.borderRadius}
            fill="none"
            stroke="rgba(59, 130, 246, 0.8)"
            strokeWidth="2"
            strokeDasharray="8 4"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* 클릭 영역 힌트 (접근성) */}
      <div className="sr-only">
        투어 배경입니다. 클릭하면 자동 진행이 일시정지됩니다.
      </div>
    </div>
  )
})

TourBackdrop.displayName = 'TourBackdrop'