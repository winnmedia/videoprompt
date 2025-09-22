/**
 * 템플릿 갤러리 React Hook
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux 상태와 연동
 * - 디바운싱으로 성능 최적화
 * - $300 사건 방지: 중복 API 호출 방지
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch } from '../../../app/store'
import type {
  TemplateSearchFilters,
  TemplateSortOption,
  TemplateCategory,
  TemplateDifficulty
} from '../../../entities/templates'
import {
  searchTemplatesAsync,
  loadRecommendedTemplatesAsync,
  setSearchQuery,
  setActiveFilters,
  setSortOptions,
  setSelectedTemplate,
  setPreviewMode,
  setGalleryView,
  setPagination,
  clearError,
  resetFilters,
  applyLocalFilters,
  selectFilteredTemplates,
  selectFeaturedTemplates,
  selectPopularTemplates,
  selectRecommendedTemplates,
  selectSelectedTemplate,
  selectTemplateLoadingState,
  selectTemplateErrors
} from '../store/template-slice'

// ===========================================
// 타입 정의
// ===========================================

export interface UseTemplateGalleryOptions {
  /**
   * 자동으로 추천 템플릿을 로드할지 여부
   */
  readonly autoLoadRecommended?: boolean

  /**
   * 검색 디바운싱 시간 (ms)
   */
  readonly searchDebounceMs?: number

  /**
   * 기본 필터
   */
  readonly defaultFilters?: TemplateSearchFilters

  /**
   * 기본 정렬 옵션
   */
  readonly defaultSort?: {
    readonly sortBy: TemplateSortOption
    readonly sortOrder: 'asc' | 'desc'
  }

  /**
   * 페이지네이션 설정
   */
  readonly pagination?: {
    readonly itemsPerPage: number
  }
}

export interface UseTemplateGalleryReturn {
  // 템플릿 데이터
  readonly templates: ReturnType<typeof selectFilteredTemplates>
  readonly featuredTemplates: ReturnType<typeof selectFeaturedTemplates>
  readonly popularTemplates: ReturnType<typeof selectPopularTemplates>
  readonly recommendedTemplates: ReturnType<typeof selectRecommendedTemplates>
  readonly selectedTemplate: ReturnType<typeof selectSelectedTemplate>

  // 페이지네이션된 템플릿
  readonly paginatedTemplates: ReturnType<typeof selectFilteredTemplates>
  readonly totalPages: number
  readonly currentPage: number

  // 검색 및 필터 상태
  readonly searchQuery: string
  readonly activeFilters: TemplateSearchFilters
  readonly sortBy: TemplateSortOption
  readonly sortOrder: 'asc' | 'desc'

  // UI 상태
  readonly galleryView: 'grid' | 'list'
  readonly previewMode: boolean

  // 로딩 상태
  readonly isLoading: boolean
  readonly isSearching: boolean
  readonly error: string | null

  // 액션 함수들
  readonly search: (query: string) => void
  readonly setFilters: (filters: TemplateSearchFilters) => void
  readonly setSorting: (sortBy: TemplateSortOption, sortOrder?: 'asc' | 'desc') => void
  readonly selectTemplate: (templateId: string | null) => void
  readonly setView: (view: 'grid' | 'list') => void
  readonly setPreview: (enabled: boolean) => void
  readonly goToPage: (page: number) => void
  readonly resetAllFilters: () => void
  readonly clearErrors: () => void
  readonly refresh: () => void

  // 편의 함수들
  readonly filterByCategory: (category: TemplateCategory) => void
  readonly filterByDifficulty: (difficulty: TemplateDifficulty) => void
  readonly getNextTemplate: () => string | null
  readonly getPrevTemplate: () => string | null
}

// ===========================================
// 메인 훅
// ===========================================

export function useTemplateGallery(
  options: UseTemplateGalleryOptions = {}
): UseTemplateGalleryReturn {
  const {
    autoLoadRecommended = true,
    searchDebounceMs = 500,
    defaultFilters = {},
    defaultSort = { sortBy: 'popularity', sortOrder: 'desc' },
    pagination = { itemsPerPage: 12 }
  } = options

  const dispatch = useDispatch<AppDispatch>()
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Redux 상태 선택
  const templates = useSelector(selectFilteredTemplates)
  const featuredTemplates = useSelector(selectFeaturedTemplates)
  const popularTemplates = useSelector(selectPopularTemplates)
  const recommendedTemplates = useSelector(selectRecommendedTemplates)
  const selectedTemplate = useSelector(selectSelectedTemplate)
  const { isLoading, isSearching } = useSelector(selectTemplateLoadingState)
  const { error } = useSelector(selectTemplateErrors)

  const state = useSelector((state: any) => state.templates)
  const {
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,
    galleryView,
    previewMode,
    currentPage,
    itemsPerPage
  } = state

  // ===========================================
  // 계산된 값들
  // ===========================================

  // 페이지네이션된 템플릿
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return templates.slice(startIndex, endIndex)
  }, [templates, currentPage, itemsPerPage])

  // 총 페이지 수
  const totalPages = useMemo(() => {
    return Math.ceil(templates.length / itemsPerPage)
  }, [templates.length, itemsPerPage])

  // ===========================================
  // 액션 함수들
  // ===========================================

  /**
   * 디바운싱된 검색
   */
  const search = useCallback((query: string) => {
    // 즉시 UI 업데이트
    dispatch(setSearchQuery(query))

    // 디바운싱된 서버 검색
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      dispatch(searchTemplatesAsync({
        query,
        filters: activeFilters,
        sortBy,
        sortOrder
      }))
    }, searchDebounceMs)
  }, [dispatch, activeFilters, sortBy, sortOrder, searchDebounceMs])

  /**
   * 필터 설정
   */
  const setFilters = useCallback((filters: TemplateSearchFilters) => {
    dispatch(setActiveFilters(filters))
    dispatch(applyLocalFilters()) // 즉시 로컬 필터링

    // 서버 검색 (디바운싱 없이 즉시)
    dispatch(searchTemplatesAsync({
      query: searchQuery,
      filters,
      sortBy,
      sortOrder
    }))
  }, [dispatch, searchQuery, sortBy, sortOrder])

  /**
   * 정렬 설정
   */
  const setSorting = useCallback((
    newSortBy: TemplateSortOption,
    newSortOrder: 'asc' | 'desc' = 'desc'
  ) => {
    dispatch(setSortOptions({ sortBy: newSortBy, sortOrder: newSortOrder }))
    dispatch(applyLocalFilters()) // 즉시 로컬 정렬
  }, [dispatch])

  /**
   * 템플릿 선택
   */
  const selectTemplate = useCallback((templateId: string | null) => {
    dispatch(setSelectedTemplate(templateId))
  }, [dispatch])

  /**
   * 갤러리 뷰 설정
   */
  const setView = useCallback((view: 'grid' | 'list') => {
    dispatch(setGalleryView(view))
  }, [dispatch])

  /**
   * 미리보기 모드 설정
   */
  const setPreview = useCallback((enabled: boolean) => {
    dispatch(setPreviewMode(enabled))
  }, [dispatch])

  /**
   * 페이지 이동
   */
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      dispatch(setPagination({ currentPage: page }))
    }
  }, [dispatch, totalPages])

  /**
   * 모든 필터 리셋
   */
  const resetAllFilters = useCallback(() => {
    dispatch(resetFilters())
  }, [dispatch])

  /**
   * 에러 클리어
   */
  const clearErrors = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  /**
   * 새로고침
   */
  const refresh = useCallback(() => {
    dispatch(searchTemplatesAsync({
      query: searchQuery,
      filters: activeFilters,
      sortBy,
      sortOrder
    }))

    if (autoLoadRecommended) {
      dispatch(loadRecommendedTemplatesAsync({}))
    }
  }, [dispatch, searchQuery, activeFilters, sortBy, sortOrder, autoLoadRecommended])

  // ===========================================
  // 편의 함수들
  // ===========================================

  /**
   * 카테고리별 필터링
   */
  const filterByCategory = useCallback((category: TemplateCategory) => {
    setFilters({ ...activeFilters, category })
  }, [setFilters, activeFilters])

  /**
   * 난이도별 필터링
   */
  const filterByDifficulty = useCallback((difficulty: TemplateDifficulty) => {
    setFilters({ ...activeFilters, difficulty })
  }, [setFilters, activeFilters])

  /**
   * 다음 템플릿 ID 가져오기
   */
  const getNextTemplate = useCallback(() => {
    if (!selectedTemplate) return null

    const currentIndex = templates.findIndex(t => t.id === selectedTemplate.id)
    if (currentIndex === -1 || currentIndex === templates.length - 1) return null

    return templates[currentIndex + 1].id
  }, [templates, selectedTemplate])

  /**
   * 이전 템플릿 ID 가져오기
   */
  const getPrevTemplate = useCallback(() => {
    if (!selectedTemplate) return null

    const currentIndex = templates.findIndex(t => t.id === selectedTemplate.id)
    if (currentIndex <= 0) return null

    return templates[currentIndex - 1].id
  }, [templates, selectedTemplate])

  // ===========================================
  // 초기화 및 정리
  // ===========================================

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    // 기본 설정 적용
    if (Object.keys(defaultFilters).length > 0) {
      dispatch(setActiveFilters(defaultFilters))
    }

    dispatch(setSortOptions(defaultSort))
    dispatch(setPagination({ itemsPerPage: pagination.itemsPerPage }))

    // 추천 템플릿 로드
    if (autoLoadRecommended) {
      dispatch(loadRecommendedTemplatesAsync({}))
    }

    // 로컬 필터 적용
    dispatch(applyLocalFilters())
  }, []) // 빈 의존성 배열 ($300 사건 방지)

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  // ===========================================
  // 반환값
  // ===========================================

  return {
    // 템플릿 데이터
    templates,
    featuredTemplates,
    popularTemplates,
    recommendedTemplates,
    selectedTemplate,

    // 페이지네이션된 템플릿
    paginatedTemplates,
    totalPages,
    currentPage,

    // 검색 및 필터 상태
    searchQuery,
    activeFilters,
    sortBy,
    sortOrder,

    // UI 상태
    galleryView,
    previewMode,

    // 로딩 상태
    isLoading,
    isSearching,
    error,

    // 액션 함수들
    search,
    setFilters,
    setSorting,
    selectTemplate,
    setView,
    setPreview,
    goToPage,
    resetAllFilters,
    clearErrors,
    refresh,

    // 편의 함수들
    filterByCategory,
    filterByDifficulty,
    getNextTemplate,
    getPrevTemplate
  }
}

// ===========================================
// 특수 목적 훅들
// ===========================================

/**
 * 인기 템플릿만 조회하는 간단한 훅
 */
export function usePopularTemplates(limit = 6) {
  const popularTemplates = useSelector(selectPopularTemplates)

  return useMemo(() => {
    return popularTemplates.slice(0, limit)
  }, [popularTemplates, limit])
}

/**
 * 추천 템플릿 훅 (사용자 맞춤)
 */
export function useRecommendedTemplates(
  userType: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
  categories?: readonly TemplateCategory[]
) {
  const dispatch = useDispatch<AppDispatch>()
  const recommendedTemplates = useSelector(selectRecommendedTemplates)
  const { isLoading } = useSelector(selectTemplateLoadingState)

  useEffect(() => {
    dispatch(loadRecommendedTemplatesAsync({
      userType,
      categories,
      limit: 4
    }))
  }, [dispatch, userType, categories])

  return {
    recommendedTemplates,
    isLoading
  }
}