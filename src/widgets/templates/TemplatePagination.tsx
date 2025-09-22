/**
 * 템플릿 페이지네이션 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 */

'use client'

import React, { memo, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplatePaginationProps {
  /**
   * 현재 페이지 (1부터 시작)
   */
  readonly currentPage: number

  /**
   * 총 페이지 수
   */
  readonly totalPages: number

  /**
   * 페이지 변경 콜백
   */
  readonly onPageChange: (page: number) => void

  /**
   * 표시할 페이지 버튼 수 (기본값: 5)
   */
  readonly visiblePages?: number

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 크기
   */
  readonly size?: 'sm' | 'md' | 'lg'

  /**
   * 간단한 모드 (이전/다음 버튼만)
   */
  readonly simple?: boolean
}

// ===========================================
// 유틸리티 함수
// ===========================================

function generatePageNumbers(currentPage: number, totalPages: number, visiblePages: number): (number | '...')[] {
  if (totalPages <= visiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = []
  const half = Math.floor(visiblePages / 2)

  let start = Math.max(1, currentPage - half)
  let end = Math.min(totalPages, start + visiblePages - 1)

  // 끝에서 시작 지점 조정
  if (end - start + 1 < visiblePages) {
    start = Math.max(1, end - visiblePages + 1)
  }

  // 첫 페이지 추가
  if (start > 1) {
    pages.push(1)
    if (start > 2) {
      pages.push('...')
    }
  }

  // 중간 페이지들 추가
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  // 마지막 페이지 추가
  if (end < totalPages) {
    if (end < totalPages - 1) {
      pages.push('...')
    }
    pages.push(totalPages)
  }

  return pages
}

// ===========================================
// 서브 컴포넌트들
// ===========================================

const PageButton = memo(function PageButton({
  page,
  isActive = false,
  isDisabled = false,
  onClick,
  size = 'md'
}: {
  page: number | '...'
  isActive?: boolean
  isDisabled?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  }

  if (page === '...') {
    return (
      <span
        className={`
          ${sizeClasses[size]}
          text-gray-500 dark:text-gray-400
        `}
        aria-hidden="true"
      >
        …
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${sizeClasses[size]}
        font-medium rounded-md transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isActive
          ? 'bg-blue-600 text-white'
          : isDisabled
            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
      `}
      aria-label={`페이지 ${page}로 이동`}
      aria-current={isActive ? 'page' : undefined}
    >
      {page}
    </button>
  )
})

const NavigationButton = memo(function NavigationButton({
  direction,
  onClick,
  isDisabled = false,
  size = 'md'
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  isDisabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  }

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const Icon = direction === 'prev' ? ChevronLeftIcon : ChevronRightIcon
  const label = direction === 'prev' ? '이전 페이지' : '다음 페이지'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${sizeClasses[size]}
        rounded-md transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isDisabled
          ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }
      `}
      aria-label={label}
    >
      <Icon className={iconSizeClasses[size]} aria-hidden="true" />
    </button>
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplatePagination = memo(function TemplatePagination({
  currentPage,
  totalPages,
  onPageChange,
  visiblePages = 5,
  className = '',
  size = 'md',
  simple = false
}: TemplatePaginationProps) {
  const pageNumbers = useMemo(() => {
    if (simple) return []
    return generatePageNumbers(currentPage, totalPages, visiblePages)
  }, [currentPage, totalPages, visiblePages, simple])

  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < totalPages

  const handlePrevClick = () => {
    if (canGoPrev) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextClick = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      onPageChange(page)
    }
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <nav
      className={`template-pagination ${className}`}
      role="navigation"
      aria-label="템플릿 페이지네이션"
    >
      <div className="flex items-center justify-center space-x-1">
        {/* 이전 버튼 */}
        <NavigationButton
          direction="prev"
          onClick={handlePrevClick}
          isDisabled={!canGoPrev}
          size={size}
        />

        {/* 페이지 번호들 (simple 모드가 아닌 경우) */}
        {!simple && (
          <div className="flex items-center space-x-1">
            {pageNumbers.map((page, index) => (
              <PageButton
                key={typeof page === 'number' ? page : `ellipsis-${index}`}
                page={page}
                isActive={page === currentPage}
                onClick={typeof page === 'number' ? () => handlePageClick(page) : undefined}
                size={size}
              />
            ))}
          </div>
        )}

        {/* 간단한 모드에서의 페이지 정보 */}
        {simple && (
          <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
            {currentPage} / {totalPages}
          </span>
        )}

        {/* 다음 버튼 */}
        <NavigationButton
          direction="next"
          onClick={handleNextClick}
          isDisabled={!canGoNext}
          size={size}
        />
      </div>

      {/* 페이지 정보 (접근성용) */}
      <div className="sr-only">
        현재 페이지: {currentPage}, 총 페이지: {totalPages}
      </div>
    </nav>
  )
})

// ===========================================
// 간단한 페이지네이션 컴포넌트
// ===========================================

export const SimpleTemplatePagination = memo(function SimpleTemplatePagination({
  currentPage,
  totalPages,
  onPageChange,
  className = ''
}: Pick<TemplatePaginationProps, 'currentPage' | 'totalPages' | 'onPageChange' | 'className'>) {
  return (
    <TemplatePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      className={className}
      simple={true}
    />
  )
})

// 기본 내보내기
export default TemplatePagination