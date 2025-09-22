/**
 * 템플릿 기능 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 Public API
 * - Named export 우선 사용
 * - Redux slice와 hooks 노출
 * - 타입 재내보내기
 */

// ===========================================
// Redux Slice 내보내기
// ===========================================

export { default as templateSlice } from './store/template-slice'

export {
  // 액션 생성자들
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

  // 비동기 Thunk 액션들
  searchTemplatesAsync,
  loadRecommendedTemplatesAsync,
  createProjectFromTemplateAsync,

  // 셀렉터들
  selectAllTemplates,
  selectFilteredTemplates,
  selectFeaturedTemplates,
  selectPopularTemplates,
  selectRecommendedTemplates,
  selectSelectedTemplate,
  selectTemplateLoadingState,
  selectTemplateErrors
} from './store/template-slice'

// ===========================================
// React Hooks 내보내기
// ===========================================

/**
 * 템플릿 갤러리 메인 훅
 */
export { useTemplateGallery } from './hooks/useTemplateGallery'

/**
 * 인기 템플릿 전용 훅
 */
export { usePopularTemplates } from './hooks/useTemplateGallery'

/**
 * 추천 템플릿 전용 훅
 */
export { useRecommendedTemplates } from './hooks/useTemplateGallery'

/**
 * 프로젝트 생성 메인 훅
 */
export { useProjectFromTemplate } from './hooks/useProjectFromTemplate'

/**
 * 간단한 프로젝트 생성 훅
 */
export { useQuickProjectCreation } from './hooks/useProjectFromTemplate'

/**
 * 프로젝트 생성 진행률 모니터링 훅
 */
export { useProjectCreationMonitor } from './hooks/useProjectFromTemplate'

// ===========================================
// 타입 재내보내기 (편의성)
// ===========================================

export type {
  // Redux 상태 타입
  TemplateState
} from './store/template-slice'

export type {
  // 훅 옵션 타입들
  UseTemplateGalleryOptions,
  UseTemplateGalleryReturn,
  UseProjectFromTemplateOptions,
  UseProjectFromTemplateReturn,

  // 프로젝트 생성 관련 타입들
  ProjectCreationStep
} from './hooks/useTemplateGallery'

export type {
  UseProjectFromTemplateOptions,
  UseProjectFromTemplateReturn,
  ProjectCreationStep
} from './hooks/useProjectFromTemplate'

// entities/templates 타입들 재내보내기 (convenience re-export)
export type {
  ProjectTemplate,
  TemplateStoryStep,
  TemplateShotSequence,
  TemplatePromptConfig,
  TemplateMetadata,
  TemplateAsset,
  TemplateTag,
  TemplateCollection,
  TemplateUsageHistory,
  TemplateReview,
  TemplateCategory,
  TemplateDifficulty,
  TemplateDuration,
  TemplateStatus,
  TemplateSortOption,
  TemplateSearchFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateProjectFromTemplateRequest
} from '../../entities/templates'

// ===========================================
// 유틸리티 함수들
// ===========================================

/**
 * 템플릿 관련 유틸리티 함수들
 */
export const TemplateFeatureUtils = {
  /**
   * 검색 쿼리 정규화
   */
  normalizeSearchQuery: (query: string): string => {
    return query.trim().toLowerCase().replace(/\s+/g, ' ')
  },

  /**
   * 필터 유효성 검사
   */
  validateFilters: (filters: any): boolean => {
    if (!filters || typeof filters !== 'object') return false

    // 카테고리 검증
    if (filters.category && !['advertising', 'education', 'entertainment', 'business', 'social', 'product', 'storytelling', 'tutorial'].includes(filters.category)) {
      return false
    }

    // 난이도 검증
    if (filters.difficulty && !['beginner', 'intermediate', 'advanced'].includes(filters.difficulty)) {
      return false
    }

    // 길이 검증
    if (filters.duration && !['short', 'medium', 'long'].includes(filters.duration)) {
      return false
    }

    // 평점 검증
    if (filters.minRating && (typeof filters.minRating !== 'number' || filters.minRating < 1 || filters.minRating > 5)) {
      return false
    }

    return true
  },

  /**
   * 프로젝트 이름 검증
   */
  validateProjectName: (name: string): { isValid: boolean; error?: string } => {
    const trimmed = name.trim()

    if (!trimmed) {
      return { isValid: false, error: '프로젝트 이름은 필수입니다' }
    }

    if (trimmed.length < 2) {
      return { isValid: false, error: '프로젝트 이름은 최소 2자 이상이어야 합니다' }
    }

    if (trimmed.length > 100) {
      return { isValid: false, error: '프로젝트 이름은 100자를 초과할 수 없습니다' }
    }

    // 특수문자 검증 (기본적인 문자, 숫자, 공백, 하이픈만 허용)
    const allowedPattern = /^[a-zA-Z0-9가-힣\s\-_]+$/
    if (!allowedPattern.test(trimmed)) {
      return { isValid: false, error: '프로젝트 이름에 허용되지 않은 문자가 포함되어 있습니다' }
    }

    return { isValid: true }
  },

  /**
   * 템플릿 카테고리 한글명 변환
   */
  getCategoryDisplayName: (category: string): string => {
    const categoryMap: Record<string, string> = {
      'advertising': '광고/마케팅',
      'education': '교육/튜토리얼',
      'entertainment': '엔터테인먼트',
      'business': '비즈니스',
      'social': '소셜미디어',
      'product': '제품 소개',
      'storytelling': '스토리텔링',
      'tutorial': '가이드/매뉴얼'
    }

    return categoryMap[category] || category
  },

  /**
   * 템플릿 난이도 한글명 변환
   */
  getDifficultyDisplayName: (difficulty: string): string => {
    const difficultyMap: Record<string, string> = {
      'beginner': '초급',
      'intermediate': '중급',
      'advanced': '고급'
    }

    return difficultyMap[difficulty] || difficulty
  },

  /**
   * 템플릿 길이 한글명 변환
   */
  getDurationDisplayName: (duration: string): string => {
    const durationMap: Record<string, string> = {
      'short': '짧음 (15초 이하)',
      'medium': '보통 (15-60초)',
      'long': '길음 (60초 이상)'
    }

    return durationMap[duration] || duration
  },

  /**
   * 템플릿 예상 완성 시간 포맷팅
   */
  formatEstimatedTime: (minutes: number): string => {
    if (minutes < 60) {
      return `약 ${minutes}분`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60

      if (remainingMinutes === 0) {
        return `약 ${hours}시간`
      } else {
        return `약 ${hours}시간 ${remainingMinutes}분`
      }
    }
  },

  /**
   * 템플릿 사용량 포맷팅
   */
  formatUsageCount: (count: number): string => {
    if (count < 1000) {
      return count.toString()
    } else if (count < 10000) {
      return `${(count / 1000).toFixed(1)}K`
    } else if (count < 1000000) {
      return `${Math.floor(count / 1000)}K`
    } else {
      return `${(count / 1000000).toFixed(1)}M`
    }
  }
} as const

// ===========================================
// 상수 내보내기
// ===========================================

/**
 * 템플릿 기능 관련 상수
 */
export const TEMPLATE_FEATURE_CONSTANTS = {
  /**
   * 검색 관련
   */
  SEARCH: {
    DEBOUNCE_MS: 500,
    MIN_QUERY_LENGTH: 2,
    MAX_QUERY_LENGTH: 100
  },

  /**
   * 페이지네이션 관련
   */
  PAGINATION: {
    DEFAULT_ITEMS_PER_PAGE: 12,
    ITEMS_PER_PAGE_OPTIONS: [6, 12, 24, 48],
    MAX_ITEMS_PER_PAGE: 48
  },

  /**
   * 갤러리 뷰 관련
   */
  GALLERY: {
    DEFAULT_VIEW: 'grid' as const,
    GRID_BREAKPOINTS: {
      sm: 1, // 1 column on small screens
      md: 2, // 2 columns on medium screens
      lg: 3, // 3 columns on large screens
      xl: 4  // 4 columns on extra large screens
    }
  },

  /**
   * 프로젝트 생성 관련
   */
  PROJECT_CREATION: {
    MAX_PROJECT_NAME_LENGTH: 100,
    MIN_PROJECT_NAME_LENGTH: 2,
    ESTIMATED_CREATION_TIME_SECONDS: 30,
    RETRY_ATTEMPTS: 3,
    STEP_ANIMATION_DURATION_MS: 300
  }
} as const

// ===========================================
// 기본 내보내기 (메인 훅)
// ===========================================

/**
 * 가장 많이 사용될 메인 훅을 기본 내보내기로 제공
 */
export { useTemplateGallery as default } from './hooks/useTemplateGallery'