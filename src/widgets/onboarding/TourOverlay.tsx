/**
 * 투어 오버레이 메인 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 UI 컴포넌트
 * - Tailwind CSS v4 디자인 시스템 활용
 * - 접근성 WCAG 2.1 AA 준수
 * - 성능 최적화 (React.memo, 불필요한 리렌더링 방지)
 */

'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useOnboarding, useTourNavigation, useTourHighlight } from '../../features/onboarding'
import { TourStep } from './TourStep'
import { TourBackdrop } from './TourBackdrop'

/**
 * 투어 오버레이 Props
 */
interface TourOverlayProps {
  /**
   * 투어 자동 시작 여부
   */
  autoStart?: boolean

  /**
   * 키보드 네비게이션 활성화
   */
  enableKeyboardNavigation?: boolean

  /**
   * 자동 진행 활성화
   */
  enableAutoAdvance?: boolean

  /**
   * 사용자 ID (선택적)
   */
  userId?: string

  /**
   * 투어 완료 콜백
   */
  onTourComplete?: (tourId: string) => void

  /**
   * 단계 변경 콜백
   */
  onStepChange?: (stepId: string) => void

  /**
   * 에러 발생 콜백
   */
  onError?: (error: string) => void

  /**
   * 커스텀 CSS 클래스
   */
  className?: string

  /**
   * 투어 테마 오버라이드
   */
  theme?: {
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
    borderRadius?: string
  }
}

/**
 * 투어 오버레이 컴포넌트
 */
export const TourOverlay = React.memo<TourOverlayProps>(({
  autoStart = true,
  enableKeyboardNavigation = true,
  enableAutoAdvance = true,
  userId,
  onTourComplete,
  onStepChange,
  onError,
  className = '',
  theme = {}
}) => {
  const portalRef = useRef<HTMLDivElement | null>(null)

  // 온보딩 상태 및 액션
  const {
    currentTour,
    currentStep,
    isVisible,
    isLoading,
    error,
    progress,
    canGoNext,
    canGoPrevious,
    canSkip,
    nextStep,
    previousStep,
    skipCurrentStep,
    skipEntireTour,
    hide,
    clearErrors
  } = useOnboarding({
    autoStart,
    userId,
    onTourComplete,
    onStepChange,
    onError
  })

  // 투어 네비게이션
  const {
    isAutoAdvancing,
    timeRemaining,
    pauseAutoAdvance,
    resumeAutoAdvance
  } = useTourNavigation({
    enableKeyboardNavigation,
    enableAutoAdvance,
    onNext: nextStep,
    onPrevious: previousStep,
    onSkip: skipCurrentStep,
    onEscape: hide
  })

  // 요소 하이라이트
  useTourHighlight()

  // 포털 DOM 생성
  useEffect(() => {
    const portalContainer = document.createElement('div')
    portalContainer.id = 'tour-overlay-portal'
    portalContainer.setAttribute('role', 'dialog')
    portalContainer.setAttribute('aria-modal', 'true')
    portalContainer.setAttribute('aria-label', '온보딩 투어')

    document.body.appendChild(portalContainer)
    portalRef.current = portalContainer

    return () => {
      if (portalRef.current && document.body.contains(portalRef.current)) {
        document.body.removeChild(portalRef.current)
      }
    }
  }, [])

  // 에러 처리
  useEffect(() => {
    if (error) {
      console.error('Tour error:', error)
      // 5초 후 자동으로 에러 클리어
      const timer = setTimeout(clearErrors, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearErrors])

  // 키보드 트랩 (접근성)
  useEffect(() => {
    if (!isVisible || !portalRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = portalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )

        if (!focusableElements || focusableElements.length === 0) return

        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  // 투어가 비활성화되어 있으면 렌더링하지 않음
  if (!isVisible || !currentTour || !currentStep || !portalRef.current) {
    return null
  }

  // 테마 CSS 변수 생성
  const themeStyles = {
    '--tour-primary-color': theme.primaryColor || '#3b82f6',
    '--tour-background-color': theme.backgroundColor || '#ffffff',
    '--tour-text-color': theme.textColor || '#1f2937',
    '--tour-border-radius': theme.borderRadius || '0.5rem'
  } as React.CSSProperties

  const overlayContent = (
    <div
      className={`
        fixed inset-0 z-[9999] pointer-events-none
        ${className}
      `}
      style={themeStyles}
      data-testid="tour-overlay"
    >
      {/* 배경 오버레이 */}
      <TourBackdrop
        isVisible={isVisible}
        onClick={pauseAutoAdvance}
      />

      {/* 투어 단계 컴포넌트 */}
      <TourStep
        step={currentStep}
        tour={currentTour}
        progress={progress}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        canSkip={canSkip}
        isAutoAdvancing={isAutoAdvancing}
        timeRemaining={timeRemaining}
        onNext={nextStep}
        onPrevious={previousStep}
        onSkip={skipCurrentStep}
        onSkipTour={skipEntireTour}
        onClose={hide}
        onPauseAutoAdvance={pauseAutoAdvance}
        onResumeAutoAdvance={resumeAutoAdvance}
      />

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div
          className="
            absolute inset-0 flex items-center justify-center
            bg-black bg-opacity-50 pointer-events-auto
          "
          data-testid="tour-loading"
        >
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div
              className="
                w-5 h-5 border-2 border-blue-600 border-t-transparent
                rounded-full animate-spin
              "
              role="status"
              aria-label="투어 로딩 중"
            />
            <span className="text-gray-700 font-medium">
              투어를 준비하고 있습니다...
            </span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div
          className="
            absolute bottom-4 right-4 max-w-md
            bg-red-50 border border-red-200 rounded-lg p-4
            pointer-events-auto shadow-lg
          "
          role="alert"
          data-testid="tour-error"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                투어 오류가 발생했습니다
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={clearErrors}
              className="
                flex-shrink-0 text-red-400 hover:text-red-600
                transition-colors duration-200
              "
              aria-label="오류 메시지 닫기"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 개발 모드 디버깅 정보 */}
      {process.env.NODE_ENV === 'development' && (
        <div
          className="
            absolute top-4 right-4 max-w-xs
            bg-gray-900 text-white text-xs rounded p-2
            pointer-events-auto font-mono
          "
          data-testid="tour-debug"
        >
          <div>Tour: {currentTour.id}</div>
          <div>Step: {currentStep.id}</div>
          <div>Progress: {progress}%</div>
          <div>Auto: {isAutoAdvancing ? 'ON' : 'OFF'}</div>
          {isAutoAdvancing && (
            <div>Remaining: {Math.ceil(timeRemaining / 1000)}s</div>
          )}
        </div>
      )}
    </div>
  )

  return createPortal(overlayContent, portalRef.current)
})

TourOverlay.displayName = 'TourOverlay'