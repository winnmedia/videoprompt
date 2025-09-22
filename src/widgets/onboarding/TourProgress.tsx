/**
 * 투어 진행률 표시 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 UI 컴포넌트
 * - Tailwind CSS v4 디자인 시스템
 * - 접근성 WCAG 2.1 AA 준수
 * - 애니메이션 성능 최적화
 */

'use client'

import React, { useEffect, useRef } from 'react'

/**
 * 투어 진행률 Props
 */
interface TourProgressProps {
  /**
   * 전체 진행률 (0-100)
   */
  progress: number

  /**
   * 전체 단계 수
   */
  totalSteps: number

  /**
   * 현재 단계 번호 (1부터 시작)
   */
  currentStep: number

  /**
   * 추가 CSS 클래스
   */
  className?: string

  /**
   * 진행률 바 스타일 타입
   */
  variant?: 'default' | 'minimal' | 'detailed'

  /**
   * 애니메이션 활성화 여부
   */
  animated?: boolean
}

/**
 * 투어 진행률 컴포넌트
 */
export const TourProgress = React.memo<TourProgressProps>(({
  progress,
  totalSteps,
  currentStep,
  className = '',
  variant = 'default',
  animated = true
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null)

  // 진행률 애니메이션
  useEffect(() => {
    if (!animated || !progressBarRef.current) return

    const bar = progressBarRef.current
    const startWidth = parseFloat(bar.style.width || '0')
    const targetWidth = progress
    const duration = 300 // ms

    if (startWidth === targetWidth) return

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progressRatio = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progressRatio, 3)
      const currentWidth = startWidth + (targetWidth - startWidth) * easedProgress

      bar.style.width = `${currentWidth}%`

      if (progressRatio < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [progress, animated])

  // 단계별 도트 렌더링 함수
  const renderStepDots = () => {
    const dots = []
    for (let i = 1; i <= totalSteps; i++) {
      const isCompleted = i < currentStep
      const isCurrent = i === currentStep
      const isUpcoming = i > currentStep

      dots.push(
        <div
          key={i}
          className={`
            w-2 h-2 rounded-full transition-all duration-300
            ${isCompleted ? 'bg-blue-600 scale-110' : ''}
            ${isCurrent ? 'bg-blue-500 scale-125 ring-2 ring-blue-200' : ''}
            ${isUpcoming ? 'bg-gray-300' : ''}
          `}
          role="presentation"
          aria-label={`${i}단계 ${isCompleted ? '완료' : isCurrent ? '진행중' : '대기중'}`}
        />
      )
    }
    return dots
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex justify-center space-x-1 ${className}`}>
        {renderStepDots()}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* 텍스트 정보 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 font-medium">
            진행률
          </span>
          <span className="text-blue-600 font-semibold">
            {currentStep} / {totalSteps} 단계
          </span>
        </div>

        {/* 진행률 바 */}
        <div className="relative">
          <div
            className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`투어 진행률 ${progress}%`}
          >
            <div
              ref={progressBarRef}
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: animated ? '0%' : `${progress}%` }}
            />
          </div>

          {/* 퍼센티지 표시 */}
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* 단계 도트 */}
        <div className="flex justify-center space-x-2 pt-1">
          {renderStepDots()}
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className={`space-y-2 ${className}`}>
      {/* 상단 정보 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {currentStep} / {totalSteps}
        </span>
        <span className="text-sm text-blue-600 font-medium">
          {Math.round(progress)}%
        </span>
      </div>

      {/* 진행률 바 */}
      <div
        className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`투어 진행률 ${progress}%`}
      >
        <div
          ref={progressBarRef}
          className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: animated ? '0%' : `${progress}%` }}
        />
      </div>
    </div>
  )
})

TourProgress.displayName = 'TourProgress'