/**
 * 템플릿 뷰 토글 컴포넌트 (그리드/리스트)
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 */

'use client'

import React, { memo } from 'react'
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplateViewToggleProps {
  /**
   * 현재 뷰 모드
   */
  readonly currentView: 'grid' | 'list'

  /**
   * 뷰 변경 콜백
   */
  readonly onViewChange: (view: 'grid' | 'list') => void

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 크기
   */
  readonly size?: 'sm' | 'md' | 'lg'
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplateViewToggle = memo(function TemplateViewToggle({
  currentView,
  onViewChange,
  className = '',
  size = 'md'
}: TemplateViewToggleProps) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  }

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div
      className={`
        inline-flex items-center
        bg-gray-100 dark:bg-gray-700
        rounded-lg ${className}
      `}
      role="group"
      aria-label="템플릿 보기 방식 선택"
    >
      {/* 그리드 뷰 버튼 */}
      <button
        type="button"
        onClick={() => onViewChange('grid')}
        className={`
          ${sizeClasses[size]}
          rounded-md transition-colors duration-200
          ${currentView === 'grid'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }
        `}
        aria-label="그리드 뷰로 보기"
        aria-pressed={currentView === 'grid'}
      >
        <Squares2X2Icon
          className={iconSizeClasses[size]}
          aria-hidden="true"
        />
      </button>

      {/* 리스트 뷰 버튼 */}
      <button
        type="button"
        onClick={() => onViewChange('list')}
        className={`
          ${sizeClasses[size]}
          rounded-md transition-colors duration-200
          ${currentView === 'list'
            ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }
        `}
        aria-label="리스트 뷰로 보기"
        aria-pressed={currentView === 'list'}
      >
        <ListBulletIcon
          className={iconSizeClasses[size]}
          aria-hidden="true"
        />
      </button>
    </div>
  )
})

// 기본 내보내기
export default TemplateViewToggle