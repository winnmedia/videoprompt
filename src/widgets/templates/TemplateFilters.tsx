/**
 * 템플릿 필터링 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 */

'use client'

import React, { memo, useCallback } from 'react'
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type {
  TemplateSearchFilters,
  TemplateCategory,
  TemplateDifficulty,
  TemplateDuration
} from '../../entities/templates'
import { TemplateFeatureUtils, TEMPLATE_FEATURE_CONSTANTS } from '../../features/templates'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplateFiltersProps {
  /**
   * 현재 활성 필터
   */
  readonly activeFilters: TemplateSearchFilters

  /**
   * 필터 변경 콜백
   */
  readonly onFiltersChange: (filters: TemplateSearchFilters) => void

  /**
   * 필터 리셋 콜백
   */
  readonly onReset: () => void

  /**
   * 카테고리 탭 표시 여부
   */
  readonly showCategoryTabs?: boolean

  /**
   * 컴팩트 모드
   */
  readonly compact?: boolean

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string
}

// ===========================================
// 필터 옵션 정의
// ===========================================

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string; icon: string }> = [
  { value: 'advertising', label: '광고/마케팅', icon: '📢' },
  { value: 'education', label: '교육', icon: '📚' },
  { value: 'entertainment', label: '엔터테인먼트', icon: '🎭' },
  { value: 'business', label: '비즈니스', icon: '💼' },
  { value: 'social', label: '소셜미디어', icon: '📱' },
  { value: 'product', label: '제품 소개', icon: '📦' },
  { value: 'storytelling', label: '스토리텔링', icon: '📖' },
  { value: 'tutorial', label: '가이드', icon: '🛠️' }
]

const DIFFICULTY_OPTIONS: Array<{ value: TemplateDifficulty; label: string; color: string }> = [
  { value: 'beginner', label: '초급', color: 'bg-green-100 text-green-800' },
  { value: 'intermediate', label: '중급', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'advanced', label: '고급', color: 'bg-red-100 text-red-800' }
]

const DURATION_OPTIONS: Array<{ value: TemplateDuration; label: string }> = [
  { value: 'short', label: '짧음 (15초 이하)' },
  { value: 'medium', label: '보통 (15-60초)' },
  { value: 'long', label: '길음 (60초 이상)' }
]

// ===========================================
// 서브 컴포넌트들
// ===========================================

const CategoryTabs = memo(function CategoryTabs({
  activeCategory,
  onCategoryChange
}: {
  activeCategory?: TemplateCategory
  onCategoryChange: (category?: TemplateCategory) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onCategoryChange(undefined)}
        className={`
          px-4 py-2 text-sm font-medium rounded-full
          transition-colors duration-200
          ${!activeCategory
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }
        `}
      >
        전체
      </button>

      {CATEGORY_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onCategoryChange(option.value)}
          className={`
            px-4 py-2 text-sm font-medium rounded-full
            transition-colors duration-200
            ${activeCategory === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <span className="mr-2" aria-hidden="true">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  )
})

const FilterDropdown = memo(function FilterDropdown({
  title,
  children,
  hasActiveFilter = false
}: {
  title: string
  children: React.ReactNode
  hasActiveFilter?: boolean
}) {
  return (
    <details className="relative">
      <summary className={`
        flex items-center justify-between px-4 py-2 text-sm font-medium
        bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
        rounded-md cursor-pointer
        hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-blue-500
        transition-colors duration-200
        ${hasActiveFilter ? 'ring-2 ring-blue-500 border-blue-500' : ''}
      `}>
        <span className="flex items-center">
          <FunnelIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          {title}
          {hasActiveFilter && (
            <span className="ml-2 w-2 h-2 bg-blue-600 rounded-full" aria-label="필터 적용됨" />
          )}
        </span>
        <svg className="w-4 h-4 ml-2 transform transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>

      <div className="
        absolute top-full left-0 z-20 mt-1 min-w-full
        bg-white dark:bg-gray-800
        border border-gray-300 dark:border-gray-600
        rounded-md shadow-lg
        max-h-64 overflow-y-auto
      ">
        {children}
      </div>
    </details>
  )
})

const ActiveFilters = memo(function ActiveFilters({
  filters,
  onRemoveFilter,
  onClearAll
}: {
  filters: TemplateSearchFilters
  onRemoveFilter: (key: keyof TemplateSearchFilters) => void
  onClearAll: () => void
}) {
  const activeFilterCount = Object.keys(filters).filter(key =>
    filters[key as keyof TemplateSearchFilters] !== undefined
  ).length

  if (activeFilterCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
        활성 필터:
      </span>

      {filters.category && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
          카테고리: {TemplateFeatureUtils.getCategoryDisplayName(filters.category)}
          <button
            onClick={() => onRemoveFilter('category')}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
            aria-label="카테고리 필터 제거"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      )}

      {filters.difficulty && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
          난이도: {TemplateFeatureUtils.getDifficultyDisplayName(filters.difficulty)}
          <button
            onClick={() => onRemoveFilter('difficulty')}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
            aria-label="난이도 필터 제거"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      )}

      {filters.duration && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
          길이: {TemplateFeatureUtils.getDurationDisplayName(filters.duration)}
          <button
            onClick={() => onRemoveFilter('duration')}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
            aria-label="길이 필터 제거"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      )}

      {filters.isFeatured && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
          추천 템플릿만
          <button
            onClick={() => onRemoveFilter('isFeatured')}
            className="ml-1 p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700"
            aria-label="추천 필터 제거"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        </span>
      )}

      <button
        onClick={onClearAll}
        className="
          ml-2 px-3 py-1 text-xs font-medium
          text-blue-700 dark:text-blue-300
          hover:text-blue-900 dark:hover:text-blue-100
          hover:underline
          transition-colors duration-200
        "
      >
        모두 지우기
      </button>
    </div>
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplateFilters = memo(function TemplateFilters({
  activeFilters,
  onFiltersChange,
  onReset,
  showCategoryTabs = true,
  compact = false,
  className = ''
}: TemplateFiltersProps) {
  // ===========================================
  // 이벤트 핸들러들
  // ===========================================

  const handleCategoryChange = useCallback((category?: TemplateCategory) => {
    onFiltersChange({
      ...activeFilters,
      category
    })
  }, [activeFilters, onFiltersChange])

  const handleDifficultyChange = useCallback((difficulty?: TemplateDifficulty) => {
    onFiltersChange({
      ...activeFilters,
      difficulty
    })
  }, [activeFilters, onFiltersChange])

  const handleDurationChange = useCallback((duration?: TemplateDuration) => {
    onFiltersChange({
      ...activeFilters,
      duration
    })
  }, [activeFilters, onFiltersChange])

  const handleToggleFilter = useCallback((key: keyof TemplateSearchFilters, value: any) => {
    onFiltersChange({
      ...activeFilters,
      [key]: activeFilters[key] === value ? undefined : value
    })
  }, [activeFilters, onFiltersChange])

  const handleRemoveFilter = useCallback((key: keyof TemplateSearchFilters) => {
    const newFilters = { ...activeFilters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }, [activeFilters, onFiltersChange])

  // ===========================================
  // 렌더링
  // ===========================================

  return (
    <div className={`template-filters ${className}`}>
      {/* 카테고리 탭 */}
      {showCategoryTabs && !compact && (
        <CategoryTabs
          activeCategory={activeFilters.category}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {/* 필터 드롭다운들 */}
      <div className="flex flex-wrap gap-3">
        {/* 카테고리 드롭다운 (컴팩트 모드) */}
        {(compact || !showCategoryTabs) && (
          <FilterDropdown
            title="카테고리"
            hasActiveFilter={!!activeFilters.category}
          >
            <div className="p-2">
              <button
                onClick={() => handleCategoryChange(undefined)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md
                  transition-colors duration-200
                  ${!activeFilters.category
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                전체
              </button>
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleCategoryChange(option.value)}
                  className={`
                    w-full text-left px-3 py-2 text-sm rounded-md
                    transition-colors duration-200
                    ${activeFilters.category === option.value
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <span className="mr-2" aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </FilterDropdown>
        )}

        {/* 난이도 필터 */}
        <FilterDropdown
          title="난이도"
          hasActiveFilter={!!activeFilters.difficulty}
        >
          <div className="p-2">
            <button
              onClick={() => handleDifficultyChange(undefined)}
              className={`
                w-full text-left px-3 py-2 text-sm rounded-md
                transition-colors duration-200
                ${!activeFilters.difficulty
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              전체
            </button>
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleDifficultyChange(option.value)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md
                  transition-colors duration-200
                  ${activeFilters.difficulty === option.value
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mr-2 ${option.color}`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </FilterDropdown>

        {/* 길이 필터 */}
        <FilterDropdown
          title="길이"
          hasActiveFilter={!!activeFilters.duration}
        >
          <div className="p-2">
            <button
              onClick={() => handleDurationChange(undefined)}
              className={`
                w-full text-left px-3 py-2 text-sm rounded-md
                transition-colors duration-200
                ${!activeFilters.duration
                  ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              전체
            </button>
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleDurationChange(option.value)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md
                  transition-colors duration-200
                  ${activeFilters.duration === option.value
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterDropdown>

        {/* 기타 필터들 */}
        <FilterDropdown
          title="기타"
          hasActiveFilter={!!activeFilters.isFeatured || !!activeFilters.isPopular}
        >
          <div className="p-2">
            <label className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <input
                type="checkbox"
                checked={!!activeFilters.isFeatured}
                onChange={() => handleToggleFilter('isFeatured', true)}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              추천 템플릿만
            </label>
            <label className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <input
                type="checkbox"
                checked={!!activeFilters.isPopular}
                onChange={() => handleToggleFilter('isPopular', true)}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              인기 템플릿만
            </label>
            <label className="flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <input
                type="checkbox"
                checked={!!activeFilters.hasPreview}
                onChange={() => handleToggleFilter('hasPreview', true)}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              미리보기 있는 것만
            </label>
          </div>
        </FilterDropdown>
      </div>

      {/* 활성 필터 표시 */}
      <ActiveFilters
        filters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={onReset}
      />
    </div>
  )
})

// 기본 내보내기
export default TemplateFilters