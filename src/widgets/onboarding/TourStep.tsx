/**
 * 투어 단계 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 UI 컴포넌트
 * - Tailwind CSS v4 디자인 시스템
 * - 접근성 WCAG 2.1 AA 준수
 * - 반응형 디자인 (모바일 대응)
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { TourStep as TourStepType, TourFlow } from '../../entities/onboarding'
import { TourNavigation } from './TourNavigation'
import { TourProgress } from './TourProgress'

/**
 * 투어 단계 Props
 */
interface TourStepProps {
  step: TourStepType
  tour: TourFlow
  progress: number
  canGoNext: boolean
  canGoPrevious: boolean
  canSkip: boolean
  isAutoAdvancing: boolean
  timeRemaining: number
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onSkipTour: () => void
  onClose: () => void
  onPauseAutoAdvance: () => void
  onResumeAutoAdvance: () => void
}

/**
 * 단계별 아이콘 매핑
 */
const STEP_ICONS = {
  welcome: '👋',
  feature: '✨',
  action: '🎯',
  tip: '💡',
  completion: '🎉'
} as const

/**
 * 투어 단계 컴포넌트
 */
export const TourStep = React.memo<TourStepProps>(({
  step,
  tour,
  progress,
  canGoNext,
  canGoPrevious,
  canSkip,
  isAutoAdvancing,
  timeRemaining,
  onNext,
  onPrevious,
  onSkip,
  onSkipTour,
  onClose,
  onPauseAutoAdvance,
  onResumeAutoAdvance
}) => {
  const stepRef = useRef<HTMLDivElement>(null)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [stepPosition, setStepPosition] = useState<{ x: number; y: number; position: string }>({
    x: 0,
    y: 0,
    position: 'center'
  })

  // 타겟 요소 찾기 및 위치 계산
  useEffect(() => {
    if (!step.target?.selector) {
      // 타겟이 없으면 중앙 배치
      setStepPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        position: 'center'
      })
      return
    }

    const element = document.querySelector(step.target.selector) as HTMLElement
    if (!element) {
      // 타겟을 찾을 수 없으면 폴백 위치 사용
      setStepPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        position: step.target.fallbackPosition || 'center'
      })
      return
    }

    setTargetElement(element)

    // 타겟 요소의 위치 계산
    const rect = element.getBoundingClientRect()
    const stepWidth = 400 // 예상 스텝 컴포넌트 너비
    const stepHeight = 200 // 예상 스텝 컴포넌트 높이

    let x = rect.left + rect.width / 2
    let y = rect.top + rect.height / 2
    let position = step.position

    // 화면 밖으로 나가지 않도록 조정
    const margin = 20
    const maxX = window.innerWidth - stepWidth - margin
    const maxY = window.innerHeight - stepHeight - margin

    switch (position) {
      case 'top':
        y = rect.top - stepHeight - margin
        if (y < margin) {
          y = rect.bottom + margin
          position = 'bottom'
        }
        break
      case 'bottom':
        y = rect.bottom + margin
        if (y > maxY) {
          y = rect.top - stepHeight - margin
          position = 'top'
        }
        break
      case 'left':
        x = rect.left - stepWidth - margin
        if (x < margin) {
          x = rect.right + margin
          position = 'right'
        }
        break
      case 'right':
        x = rect.right + margin
        if (x > maxX) {
          x = rect.left - stepWidth - margin
          position = 'left'
        }
        break
      case 'center':
        // 중앙 배치는 변경 없음
        break
      default:
        // 복합 위치 (top-left, bottom-right 등)는 기본 계산 사용
        break
    }

    // 최종 경계 체크
    x = Math.max(margin, Math.min(x, maxX))
    y = Math.max(margin, Math.min(y, maxY))

    setStepPosition({ x, y, position })
  }, [step])

  // 컴포넌트 마운트 시 포커스 설정
  useEffect(() => {
    if (stepRef.current) {
      stepRef.current.focus()
    }
  }, [step.id])

  // 마우스 진입/이탈 시 자동 진행 제어
  const handleMouseEnter = () => {
    if (isAutoAdvancing) {
      onPauseAutoAdvance()
    }
  }

  const handleMouseLeave = () => {
    if (step.autoAdvance && !isAutoAdvancing) {
      onResumeAutoAdvance()
    }
  }

  // 위치 스타일 계산
  const getPositionStyles = () => {
    if (stepPosition.position === 'center') {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    }

    return {
      position: 'fixed' as const,
      left: stepPosition.x,
      top: stepPosition.y,
      transform: getTransformByPosition(stepPosition.position)
    }
  }

  const getTransformByPosition = (position: string) => {
    switch (position) {
      case 'top':
      case 'bottom':
        return 'translateX(-50%)'
      case 'left':
      case 'right':
        return 'translateY(-50%)'
      case 'top-left':
        return 'translate(0, 0)'
      case 'top-right':
        return 'translate(-100%, 0)'
      case 'bottom-left':
        return 'translate(0, -100%)'
      case 'bottom-right':
        return 'translate(-100%, -100%)'
      default:
        return 'translate(-50%, -50%)'
    }
  }

  // 화살표 위치 계산
  const getArrowClasses = () => {
    if (!targetElement || stepPosition.position === 'center') return ''

    const baseClasses = 'absolute w-3 h-3 bg-white border border-gray-200 transform rotate-45'

    switch (stepPosition.position) {
      case 'top':
        return `${baseClasses} -bottom-1.5 left-1/2 -translate-x-1/2 border-t-0 border-l-0`
      case 'bottom':
        return `${baseClasses} -top-1.5 left-1/2 -translate-x-1/2 border-b-0 border-r-0`
      case 'left':
        return `${baseClasses} -right-1.5 top-1/2 -translate-y-1/2 border-t-0 border-l-0`
      case 'right':
        return `${baseClasses} -left-1.5 top-1/2 -translate-y-1/2 border-b-0 border-r-0`
      default:
        return ''
    }
  }

  return (
    <div
      ref={stepRef}
      className="pointer-events-auto focus:outline-none"
      style={getPositionStyles()}
      tabIndex={-1}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={`tour-step-${step.id}`}
      role="dialog"
      aria-labelledby={`tour-step-title-${step.id}`}
      aria-describedby={`tour-step-content-${step.id}`}
    >
      {/* 화살표 (타겟이 있을 때만) */}
      {targetElement && stepPosition.position !== 'center' && (
        <div className={getArrowClasses()} />
      )}

      {/* 메인 카드 */}
      <div
        className="
          bg-white rounded-lg shadow-xl border border-gray-200
          w-80 sm:w-96 max-w-sm
          overflow-hidden
          animate-in fade-in slide-in-from-bottom-4 duration-300
        "
      >
        {/* 헤더 */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {/* 단계 아이콘 */}
              <div
                className="
                  w-10 h-10 rounded-full bg-blue-100
                  flex items-center justify-center text-xl
                "
                aria-hidden="true"
              >
                {STEP_ICONS[step.type] || '📍'}
              </div>

              {/* 단계 정보 */}
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  {step.order}단계 / {tour.steps.length}단계
                </div>
                <h2
                  id={`tour-step-title-${step.id}`}
                  className="text-lg font-semibold text-gray-900 mt-1"
                >
                  {step.title}
                </h2>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              className="
                text-gray-400 hover:text-gray-600
                transition-colors duration-200
                rounded-full p-1 hover:bg-gray-100
              "
              aria-label="투어 닫기"
              data-testid="tour-close-button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* 진행률 바 */}
          <TourProgress
            progress={progress}
            totalSteps={tour.steps.length}
            currentStep={step.order}
            className="mt-4"
          />
        </div>

        {/* 콘텐츠 */}
        <div className="px-6 pb-4">
          <p
            id={`tour-step-content-${step.id}`}
            className="text-gray-700 leading-relaxed"
          >
            {step.content}
          </p>
        </div>

        {/* 자동 진행 표시 */}
        {isAutoAdvancing && step.autoAdvance && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>자동으로 다음 단계로 진행됩니다</span>
              <span>{Math.ceil(timeRemaining / 1000)}초</span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${((step.autoAdvance - timeRemaining) / step.autoAdvance) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        {/* 네비게이션 */}
        <TourNavigation
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          canSkip={canSkip}
          isFirstStep={step.order === 1}
          isLastStep={step.order === tour.steps.length}
          onNext={onNext}
          onPrevious={onPrevious}
          onSkip={onSkip}
          onSkipTour={onSkipTour}
        />
      </div>
    </div>
  )
})

TourStep.displayName = 'TourStep'