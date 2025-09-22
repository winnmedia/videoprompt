/**
 * 템플릿 검색 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 * - 디바운싱으로 성능 최적화
 */

'use client'

import React, { memo, useState, useCallback, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplateSearchProps {
  /**
   * 현재 검색어
   */
  readonly value: string

  /**
   * 검색어 변경 콜백
   */
  readonly onChange: (query: string) => void

  /**
   * 검색 중 상태
   */
  readonly isSearching?: boolean

  /**
   * 플레이스홀더 텍스트
   */
  readonly placeholder?: string

  /**
   * 디바운싱 시간 (ms)
   */
  readonly debounceMs?: number

  /**
   * 자동 포커스 여부
   */
  readonly autoFocus?: boolean

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 검색 제안사항 표시 여부
   */
  readonly showSuggestions?: boolean

  /**
   * 최근 검색어 표시 여부
   */
  readonly showRecentSearches?: boolean

  /**
   * 인기 검색어 목록
   */
  readonly popularSearches?: readonly string[]

  /**
   * 검색 제출 시 콜백
   */
  readonly onSubmit?: (query: string) => void

  /**
   * 검색어 클리어 시 콜백
   */
  readonly onClear?: () => void
}

// ===========================================
// 기본 검색 제안사항
// ===========================================

const DEFAULT_POPULAR_SEARCHES = [
  '광고',
  '교육',
  '프레젠테이션',
  '소셜미디어',
  '제품 소개',
  '스토리텔링',
  '초급자',
  '짧은 영상'
] as const

// ===========================================
// 서브 컴포넌트들
// ===========================================

const SearchIcon = memo(function SearchIcon({
  isSearching = false
}: {
  isSearching?: boolean
}) {
  if (isSearching) {
    return (
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <MagnifyingGlassIcon
      className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
      aria-hidden="true"
    />
  )
})

const ClearButton = memo(function ClearButton({
  onClear,
  visible = false
}: {
  onClear: () => void
  visible?: boolean
}) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onClear}
      className="
        absolute right-3 top-1/2 transform -translate-y-1/2
        p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-blue-500
        transition-colors duration-200
      "
      aria-label="검색어 지우기"
    >
      <XMarkIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
})

const SearchSuggestions = memo(function SearchSuggestions({
  visible,
  onSuggestionClick,
  popularSearches = DEFAULT_POPULAR_SEARCHES
}: {
  visible: boolean
  onSuggestionClick: (suggestion: string) => void
  popularSearches?: readonly string[]
}) {
  if (!visible) return null

  return (
    <div className="
      absolute top-full left-0 right-0 z-10 mt-1
      bg-white dark:bg-gray-800
      border border-gray-200 dark:border-gray-600
      rounded-md shadow-lg
      max-h-64 overflow-y-auto
    ">
      <div className="p-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          인기 검색어
        </div>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map((search) => (
            <button
              key={search}
              type="button"
              onClick={() => onSuggestionClick(search)}
              className="
                px-3 py-1 text-sm
                bg-gray-100 dark:bg-gray-700
                text-gray-700 dark:text-gray-300
                rounded-full
                hover:bg-gray-200 dark:hover:bg-gray-600
                focus:outline-none focus:ring-2 focus:ring-blue-500
                transition-colors duration-200
              "
            >
              {search}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplateSearch = memo(function TemplateSearch({
  value,
  onChange,
  isSearching = false,
  placeholder = '템플릿 검색...',
  debounceMs = 300,
  autoFocus = false,
  className = '',
  showSuggestions = true,
  showRecentSearches = false,
  popularSearches = DEFAULT_POPULAR_SEARCHES,
  onSubmit,
  onClear
}: TemplateSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()
  const containerRef = useRef<HTMLDivElement>(null)

  // ===========================================
  // 디바운싱 로직
  // ===========================================

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [localValue, value, onChange, debounceMs])

  // 외부에서 value가 변경될 때 로컬 상태 동기화
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // ===========================================
  // 이벤트 핸들러들
  // ===========================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }, [])

  const handleInputFocus = useCallback(() => {
    setIsFocused(true)
    if (showSuggestions) {
      setShowDropdown(true)
    }
  }, [showSuggestions])

  const handleInputBlur = useCallback(() => {
    setIsFocused(false)
    // 드롭다운 클릭을 허용하기 위해 지연
    setTimeout(() => setShowDropdown(false), 200)
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    // 즉시 onChange 호출 (디바운싱 무시)
    if (localValue !== value) {
      onChange(localValue)
    }

    onSubmit?.(localValue)

    // 포커스 해제
    inputRef.current?.blur()
  }, [localValue, value, onChange, onSubmit])

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }, [onChange, onClear])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setLocalValue(suggestion)
    onChange(suggestion)
    setShowDropdown(false)
    inputRef.current?.focus()
  }, [onChange])

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setShowDropdown(false)
        inputRef.current?.blur()
        break
      case 'ArrowDown':
        if (showSuggestions && !showDropdown) {
          e.preventDefault()
          setShowDropdown(true)
        }
        break
    }
  }, [showSuggestions, showDropdown])

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ===========================================
  // 렌더링
  // ===========================================

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          {/* 검색 아이콘 */}
          <SearchIcon isSearching={isSearching} />

          {/* 검색 입력 필드 */}
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`
              w-full pl-10 pr-10 py-3
              border border-gray-300 dark:border-gray-600
              rounded-lg
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              placeholder-gray-500 dark:placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              transition-colors duration-200
              ${isFocused ? 'ring-2 ring-blue-500 border-blue-500' : ''}
            `}
            aria-label="템플릿 검색"
            aria-describedby="search-description"
          />

          {/* 클리어 버튼 */}
          <ClearButton
            onClear={handleClear}
            visible={localValue.length > 0}
          />
        </div>

        {/* 검색 설명 (스크린 리더용) */}
        <div id="search-description" className="sr-only">
          템플릿 이름, 카테고리, 태그로 검색할 수 있습니다
        </div>

        {/* 숨겨진 제출 버튼 (폼 제출용) */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          검색
        </button>
      </form>

      {/* 검색 제안사항 드롭다운 */}
      <SearchSuggestions
        visible={showDropdown && showSuggestions}
        onSuggestionClick={handleSuggestionClick}
        popularSearches={popularSearches}
      />
    </div>
  )
})

// ===========================================
// 간단한 검색 바 컴포넌트 (최소 기능)
// ===========================================

export const SimpleTemplateSearch = memo(function SimpleTemplateSearch({
  value,
  onChange,
  isSearching = false,
  placeholder = '템플릿 검색...',
  className = ''
}: Pick<TemplateSearchProps, 'value' | 'onChange' | 'isSearching' | 'placeholder' | 'className'>) {
  return (
    <TemplateSearch
      value={value}
      onChange={onChange}
      isSearching={isSearching}
      placeholder={placeholder}
      className={className}
      showSuggestions={false}
      showRecentSearches={false}
    />
  )
})

// 기본 내보내기
export default TemplateSearch