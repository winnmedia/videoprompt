/**
 * 투어 네비게이션 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 UI 컴포넌트
 * - Tailwind CSS v4 디자인 시스템
 * - 접근성 WCAG 2.1 AA 준수
 * - 키보드 네비게이션 지원
 */

'use client'

import React from 'react'

/**
 * 투어 네비게이션 Props
 */
interface TourNavigationProps {
  canGoNext: boolean
  canGoPrevious: boolean
  canSkip: boolean
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onSkipTour: () => void
}

/**
 * 투어 네비게이션 컴포넌트
 */
export const TourNavigation = React.memo<TourNavigationProps>(({
  canGoNext,
  canGoPrevious,
  canSkip,
  isFirstStep,
  isLastStep,
  onNext,
  onPrevious,
  onSkip,
  onSkipTour
}) => {
  return (
    <div
      className="
        bg-gray-50 px-6 py-4
        border-t border-gray-200
      "
      data-testid="tour-navigation"
    >
      {/* 메인 버튼 그룹 */}
      <div className="flex items-center justify-between">
        {/* 이전 버튼 */}
        <div className="flex items-center space-x-2">
          {canGoPrevious && !isFirstStep ? (
            <button
              type="button"
              onClick={onPrevious}
              className="
                inline-flex items-center px-3 py-2
                text-sm font-medium text-gray-700
                bg-white border border-gray-300 rounded-md
                hover:bg-gray-50 hover:text-gray-900
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              data-testid="tour-previous-button"
              aria-label="이전 단계로 이동"
            >
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              이전
            </button>
          ) : (
            <div className="w-16" /> // 공간 유지용 플레이스홀더
          )}
        </div>

        {/* 중앙 건너뛰기 버튼 */}
        <div className="flex items-center space-x-2">
          {canSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="
                text-sm text-gray-500 hover:text-gray-700
                underline decoration-dotted underline-offset-4
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                rounded px-2 py-1
              "
              data-testid="tour-skip-step-button"
              aria-label="현재 단계 건너뛰기"
            >
              건너뛰기
            </button>
          )}

          {/* 전체 투어 건너뛰기 (작은 버튼) */}
          <button
            type="button"
            onClick={onSkipTour}
            className="
              text-xs text-gray-400 hover:text-gray-600
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              rounded px-2 py-1
            "
            data-testid="tour-skip-all-button"
            aria-label="투어 전체 건너뛰기"
            title="투어 전체 건너뛰기"
          >
            투어 종료
          </button>
        </div>

        {/* 다음/완료 버튼 */}
        <div className="flex items-center space-x-2">
          {canGoNext ? (
            <button
              type="button"
              onClick={onNext}
              className="
                inline-flex items-center px-4 py-2
                text-sm font-medium text-white
                bg-blue-600 border border-transparent rounded-md
                hover:bg-blue-700 focus:bg-blue-700
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              data-testid="tour-next-button"
              aria-label={isLastStep ? "투어 완료" : "다음 단계로 이동"}
            >
              {isLastStep ? '완료' : '다음'}
              {!isLastStep && (
                <svg
                  className="w-4 h-4 ml-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLastStep && (
                <svg
                  className="w-4 h-4 ml-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ) : (
            <div className="w-20" /> // 공간 유지용 플레이스홀더
          )}
        </div>
      </div>

      {/* 키보드 단축키 힌트 */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">
              ←
            </kbd>
            <span>이전</span>
          </div>

          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">
              →
            </kbd>
            <span>다음</span>
          </div>

          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">
              S
            </kbd>
            <span>건너뛰기</span>
          </div>

          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono">
              ESC
            </kbd>
            <span>종료</span>
          </div>
        </div>
      </div>
    </div>
  )
})

TourNavigation.displayName = 'TourNavigation'