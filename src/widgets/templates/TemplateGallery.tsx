/**
 * 템플릿 갤러리 메인 컴포넌트
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 (UI 컴포넌트)
 * - Tailwind CSS v4 사용
 * - 접근성 (WCAG 2.1 AA) 준수
 * - React 19.1.0 + Next.js 15.4.6 호환
 * - 성능 최적화 (React.memo, 가상화)
 */

'use client'

import React, { memo, useMemo, useCallback } from 'react'
import { useTemplateGallery } from '../../features/templates'
import type { TemplateSearchFilters, TemplateSortOption } from '../../entities/templates'
import { TemplateCard } from './TemplateCard'
import { TemplateFilters } from './TemplateFilters'
import { TemplateSearch } from './TemplateSearch'
import { TemplatePagination } from './TemplatePagination'
import { TemplateViewToggle } from './TemplateViewToggle'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { EmptyState } from '../../shared/ui/EmptyState'

// ===========================================
// 타입 정의
// ===========================================

export interface TemplateGalleryProps {
  /**
   * 갤러리 제목
   */
  readonly title?: string

  /**
   * 설명 텍스트
   */
  readonly description?: string

  /**
   * 초기 필터 설정
   */
  readonly initialFilters?: TemplateSearchFilters

  /**
   * 초기 검색어
   */
  readonly initialSearchQuery?: string

  /**
   * 페이지당 아이템 수
   */
  readonly itemsPerPage?: number

  /**
   * 추천 템플릿 표시 여부
   */
  readonly showRecommended?: boolean

  /**
   * 인기 템플릿 표시 여부
   */
  readonly showPopular?: boolean

  /**
   * 카테고리 탭 표시 여부
   */
  readonly showCategoryTabs?: boolean

  /**
   * 뷰 토글 표시 여부 (그리드/리스트)
   */
  readonly showViewToggle?: boolean

  /**
   * 정렬 옵션 표시 여부
   */
  readonly showSortOptions?: boolean

  /**
   * 컴팩트 모드 (작은 화면용)
   */
  readonly compact?: boolean

  /**
   * 사용자 정의 CSS 클래스
   */
  readonly className?: string

  /**
   * 템플릿 선택 시 콜백
   */
  readonly onTemplateSelect?: (templateId: string) => void

  /**
   * 프로젝트 생성 시 콜백
   */
  readonly onCreateProject?: (templateId: string, projectName: string) => void
}

// ===========================================
// 메인 컴포넌트
// ===========================================

export const TemplateGallery = memo(function TemplateGallery({
  title = '템플릿 갤러리',
  description = '다양한 템플릿을 선택하여 프로젝트를 시작하세요',
  initialFilters = {},
  initialSearchQuery = '',
  itemsPerPage = 12,
  showRecommended = true,
  showPopular = true,
  showCategoryTabs = true,
  showViewToggle = true,
  showSortOptions = true,
  compact = false,
  className = '',
  onTemplateSelect,
  onCreateProject
}: TemplateGalleryProps) {
  // features/templates 훅 사용
  const {
    paginatedTemplates,
    recommendedTemplates,
    popularTemplates,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    galleryView,
    currentPage,
    totalPages,
    isLoading,
    isSearching,
    error,
    search,
    setFilters,
    setSorting,
    selectTemplate,
    setView,
    goToPage,
    resetAllFilters,
    clearErrors
  } = useTemplateGallery({
    defaultFilters: initialFilters,
    pagination: { itemsPerPage },
    autoLoadRecommended: showRecommended
  })

  // ===========================================
  // 이벤트 핸들러들
  // ===========================================

  const handleSearch = useCallback((query: string) => {
    search(query)
  }, [search])

  const handleFilterChange = useCallback((filters: TemplateSearchFilters) => {
    setFilters(filters)
  }, [setFilters])

  const handleSortChange = useCallback((
    newSortBy: TemplateSortOption,
    newSortOrder: 'asc' | 'desc'
  ) => {
    setSorting(newSortBy, newSortOrder)
  }, [setSorting])

  const handleTemplateClick = useCallback((templateId: string) => {
    selectTemplate(templateId)
    onTemplateSelect?.(templateId)
  }, [selectTemplate, onTemplateSelect])

  const handleCreateProject = useCallback((templateId: string, projectName: string) => {
    onCreateProject?.(templateId, projectName)
  }, [onCreateProject])

  const handleViewToggle = useCallback((view: 'grid' | 'list') => {
    setView(view)
  }, [setView])

  const handlePageChange = useCallback((page: number) => {
    goToPage(page)
  }, [goToPage])

  const handleResetFilters = useCallback(() => {
    resetAllFilters()
  }, [resetAllFilters])

  // ===========================================
  // 렌더링 유틸리티
  // ===========================================

  const renderHeader = useMemo(() => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
              {description}
            </p>
          )}
        </div>

        {showViewToggle && !compact && (
          <TemplateViewToggle
            currentView={galleryView}
            onViewChange={handleViewToggle}
          />
        )}
      </div>

      {/* 검색 바 */}
      <div className="mb-6">
        <TemplateSearch
          value={searchQuery}
          onChange={handleSearch}
          isSearching={isSearching}
          placeholder="템플릿 검색..."
          className="w-full"
        />
      </div>

      {/* 필터 및 정렬 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <TemplateFilters
          activeFilters={activeFilters}
          onFiltersChange={handleFilterChange}
          onReset={handleResetFilters}
          showCategoryTabs={showCategoryTabs}
          compact={compact}
        />

        {showSortOptions && (
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              정렬:
            </label>
            <select
              id="sort-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as [TemplateSortOption, 'asc' | 'desc']
                handleSortChange(newSortBy, newSortOrder)
              }}
              className="
                px-3 py-2 text-sm border border-gray-300 rounded-md
                bg-white dark:bg-gray-800 dark:border-gray-600
                text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                transition-colors duration-200
              "
            >
              <option value="popularity-desc">인기순</option>
              <option value="name-asc">이름순 (가나다)</option>
              <option value="name-desc">이름순 (역순)</option>
              <option value="createdAt-desc">최신순</option>
              <option value="createdAt-asc">오래된순</option>
              <option value="downloadCount-desc">다운로드순</option>
              <option value="rating-desc">평점순</option>
            </select>
          </div>
        )}
      </div>
    </div>
  ), [
    title,
    description,
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    galleryView,
    isSearching,
    showViewToggle,
    showCategoryTabs,
    showSortOptions,
    compact,
    handleSearch,
    handleFilterChange,
    handleSortChange,
    handleViewToggle,
    handleResetFilters
  ])

  const renderRecommendedSection = useMemo(() => {
    if (!showRecommended || recommendedTemplates.length === 0) return null

    return (
      <section className="mb-12" aria-labelledby="recommended-heading">
        <h2 id="recommended-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          추천 템플릿
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {recommendedTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              view="grid"
              onClick={() => handleTemplateClick(template.id)}
              onCreateProject={(projectName) => handleCreateProject(template.id, projectName)}
              showBadge="recommended"
            />
          ))}
        </div>
      </section>
    )
  }, [showRecommended, recommendedTemplates, handleTemplateClick, handleCreateProject])

  const renderPopularSection = useMemo(() => {
    if (!showPopular || popularTemplates.length === 0) return null

    return (
      <section className="mb-12" aria-labelledby="popular-heading">
        <h2 id="popular-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          인기 템플릿
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {popularTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              view="grid"
              onClick={() => handleTemplateClick(template.id)}
              onCreateProject={(projectName) => handleCreateProject(template.id, projectName)}
              showBadge="popular"
              compact
            />
          ))}
        </div>
      </section>
    )
  }, [showPopular, popularTemplates, handleTemplateClick, handleCreateProject])

  const renderMainGallery = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-lg text-gray-600 dark:text-gray-300">
            템플릿을 불러오는 중...
          </span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 mb-4">
            템플릿을 불러오는 중 오류가 발생했습니다.
          </div>
          <button
            onClick={clearErrors}
            className="
              px-4 py-2 bg-blue-600 text-white rounded-md
              hover:bg-blue-700 focus:ring-2 focus:ring-blue-500
              transition-colors duration-200
            "
          >
            다시 시도
          </button>
        </div>
      )
    }

    if (paginatedTemplates.length === 0) {
      return (
        <EmptyState
          icon="🔍"
          title="검색 결과가 없습니다"
          description="다른 검색어나 필터를 시도해보세요"
          actionLabel="필터 초기화"
          onAction={handleResetFilters}
        />
      )
    }

    // 그리드 vs 리스트 뷰
    const gridCols = galleryView === 'grid'
      ? compact
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-1'

    return (
      <div className={`grid ${gridCols} gap-6`}>
        {paginatedTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            view={galleryView}
            onClick={() => handleTemplateClick(template.id)}
            onCreateProject={(projectName) => handleCreateProject(template.id, projectName)}
            compact={compact}
          />
        ))}
      </div>
    )
  }, [
    isLoading,
    error,
    paginatedTemplates,
    galleryView,
    compact,
    handleTemplateClick,
    handleCreateProject,
    handleResetFilters,
    clearErrors
  ])

  const renderPagination = useMemo(() => {
    if (totalPages <= 1) return null

    return (
      <div className="mt-8 flex justify-center">
        <TemplatePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    )
  }, [currentPage, totalPages, handlePageChange])

  // ===========================================
  // 메인 렌더링
  // ===========================================

  return (
    <div
      className={`template-gallery ${className}`}
      role="main"
      aria-label="템플릿 갤러리"
    >
      {renderHeader}

      {renderRecommendedSection}

      {renderPopularSection}

      <section aria-labelledby="all-templates-heading">
        <h2 id="all-templates-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          모든 템플릿 ({paginatedTemplates.length}개)
        </h2>

        {renderMainGallery}

        {renderPagination}
      </section>
    </div>
  )
})

// 기본 내보내기
export default TemplateGallery