/**
 * EmptyState Component
 *
 * CLAUDE.md 준수: Tailwind CSS, 접근성, 이모지 금지
 * 환각 코드 방지: 명확한 프로퍼티와 variants
 */

import React from 'react'
import { clsx } from 'clsx'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  variant?: 'default' | 'search' | 'error' | 'loading'
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  variant = 'default',
  className
}) => {
  // 기본 아이콘들 (variant별)
  const defaultIcons = {
    default: (
      <svg
        className="h-12 w-12 text-gray-400"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    search: (
      <svg
        className="h-12 w-12 text-gray-400"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    error: (
      <svg
        className="h-12 w-12 text-red-400"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    loading: (
      <svg
        className="h-12 w-12 animate-spin text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )
  }

  // variant별 스타일
  const variantStyles = {
    default: 'text-gray-500',
    search: 'text-gray-500',
    error: 'text-red-500',
    loading: 'text-gray-500'
  }

  const displayIcon = icon || defaultIcons[variant]

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* 아이콘 */}
      <div className="mb-4">
        {displayIcon}
      </div>

      {/* 제목 */}
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        {title}
      </h3>

      {/* 설명 */}
      {description && (
        <p className="mb-6 max-w-sm text-sm text-gray-500">
          {description}
        </p>
      )}

      {/* 액션 버튼 */}
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  )
}

// 특화된 EmptyState 컴포넌트들
export const EmptySearchState: React.FC<{
  query?: string
  onReset?: () => void
}> = ({ query, onReset }) => (
  <EmptyState
    variant="search"
    title={query ? `"${query}"에 대한 검색 결과가 없습니다` : '검색 결과가 없습니다'}
    description="다른 키워드로 검색해보시거나 필터를 조정해보세요."
    action={
      onReset && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          검색 초기화
        </button>
      )
    }
  />
)

export const EmptyDataState: React.FC<{
  entity: string
  onCreate?: () => void
  createLabel?: string
}> = ({ entity, onCreate, createLabel = '새로 만들기' }) => (
  <EmptyState
    title={`${entity}가 없습니다`}
    description={`첫 번째 ${entity}를 만들어보세요.`}
    action={
      onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {createLabel}
        </button>
      )
    }
  />
)

export const LoadingState: React.FC<{
  message?: string
}> = ({ message = '로딩 중...' }) => (
  <EmptyState
    variant="loading"
    title={message}
    description="잠시만 기다려주세요."
  />
)

export const ErrorState: React.FC<{
  title?: string
  description?: string
  onRetry?: () => void
}> = ({
  title = '오류가 발생했습니다',
  description = '잠시 후 다시 시도해주세요.',
  onRetry
}) => (
  <EmptyState
    variant="error"
    title={title}
    description={description}
    action={
      onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          다시 시도
        </button>
      )
    }
  />
)

export default EmptyState