/**
 * 템플릿 상태 관리 Redux Slice
 *
 * CLAUDE.md 준수사항:
 * - FSD features 레이어 (비즈니스 로직)
 * - Redux Toolkit 2.0 사용
 * - entities/templates 도메인 모델 활용
 * - $300 사건 방지: 비동기 작업 중복 호출 방지
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import type {
  ProjectTemplate,
  TemplateSearchFilters,
  TemplateSortOption,
  TemplateCategory,
  TemplateDifficulty,
  CreateProjectFromTemplateRequest
} from '../../../entities/templates'
import { TemplateDomain, PREDEFINED_TEMPLATES } from '../../../entities/templates'

// ===========================================
// 상태 타입 정의
// ===========================================

export interface TemplateState {
  // 템플릿 데이터
  readonly templates: readonly ProjectTemplate[]
  readonly filteredTemplates: readonly ProjectTemplate[]
  readonly featuredTemplates: readonly ProjectTemplate[]
  readonly popularTemplates: readonly ProjectTemplate[]
  readonly recommendedTemplates: readonly ProjectTemplate[]

  // 검색 및 필터
  readonly searchQuery: string
  readonly activeFilters: TemplateSearchFilters
  readonly sortBy: TemplateSortOption
  readonly sortOrder: 'asc' | 'desc'

  // UI 상태
  readonly selectedTemplateId: string | null
  readonly previewMode: boolean
  readonly galleryView: 'grid' | 'list'
  readonly itemsPerPage: number
  readonly currentPage: number

  // 로딩 상태 ($300 사건 방지)
  readonly isLoading: boolean
  readonly isSearching: boolean
  readonly isCreatingProject: boolean
  readonly lastSearchTime: number
  readonly pendingOperations: readonly string[]

  // 에러 상태
  readonly error: string | null
  readonly searchError: string | null
  readonly createProjectError: string | null
}

// ===========================================
// 비동기 Thunk 액션 (중복 호출 방지)
// ===========================================

/**
 * 템플릿 검색 (디바운싱 및 중복 방지)
 */
export const searchTemplatesAsync = createAsyncThunk(
  'templates/searchTemplates',
  async (
    params: {
      query?: string
      filters?: TemplateSearchFilters
      sortBy?: TemplateSortOption
      sortOrder?: 'asc' | 'desc'
    },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { templates: TemplateState }
    const now = Date.now()

    // $300 사건 방지: 1초 내 중복 검색 방지
    if (state.templates.isSearching || (now - state.templates.lastSearchTime < 1000)) {
      return rejectWithValue('Search already in progress or too frequent')
    }

    try {
      const {
        query = '',
        filters = {},
        sortBy = 'popularity',
        sortOrder = 'desc'
      } = params

      // 도메인 로직 활용하여 검색
      let results = TemplateDomain.searchTemplates(PREDEFINED_TEMPLATES, query)

      // 필터 적용
      if (Object.keys(filters).length > 0) {
        results = TemplateDomain.filterTemplates(results, filters)
      }

      // 정렬 적용
      results = TemplateDomain.sortTemplates(results, sortBy, sortOrder)

      return {
        templates: results,
        query,
        filters,
        sortBy,
        sortOrder
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Search failed')
    }
  }
)

/**
 * 추천 템플릿 로드
 */
export const loadRecommendedTemplatesAsync = createAsyncThunk(
  'templates/loadRecommended',
  async (
    params: {
      userId?: string
      userType?: 'beginner' | 'intermediate' | 'advanced'
      categories?: readonly TemplateCategory[]
      limit?: number
    },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { templates: TemplateState }

    // 중복 로딩 방지
    if (state.templates.pendingOperations.includes('loadRecommended')) {
      return rejectWithValue('Already loading recommended templates')
    }

    try {
      const { userType = 'beginner', categories, limit = 4 } = params

      const recommended = TemplateDomain.getRecommendedTemplates(
        PREDEFINED_TEMPLATES,
        { userType, categories, limit }
      )

      return recommended
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load recommendations')
    }
  }
)

/**
 * 템플릿으로부터 프로젝트 생성
 */
export const createProjectFromTemplateAsync = createAsyncThunk(
  'templates/createProjectFromTemplate',
  async (
    request: CreateProjectFromTemplateRequest,
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { templates: TemplateState }

    // 중복 생성 방지
    if (state.templates.isCreatingProject) {
      return rejectWithValue('Project creation already in progress')
    }

    try {
      // 실제로는 API 호출
      // 여기서는 도메인 로직으로 시뮬레이션
      const template = PREDEFINED_TEMPLATES.find(t => t.id === request.templateId)

      if (!template) {
        throw new Error('Template not found')
      }

      // 프로젝트 생성 로직 (실제로는 API 연동)
      const projectId = `project_${Date.now()}`

      return {
        projectId,
        templateId: request.templateId,
        projectName: request.projectName,
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Project creation failed')
    }
  }
)

// ===========================================
// 초기 상태
// ===========================================

const initialState: TemplateState = {
  // 템플릿 데이터
  templates: PREDEFINED_TEMPLATES,
  filteredTemplates: PREDEFINED_TEMPLATES,
  featuredTemplates: PREDEFINED_TEMPLATES.filter(t => t.status === 'featured'),
  popularTemplates: TemplateDomain.getPopularTemplates(PREDEFINED_TEMPLATES, 6),
  recommendedTemplates: [],

  // 검색 및 필터
  searchQuery: '',
  activeFilters: {},
  sortBy: 'popularity',
  sortOrder: 'desc',

  // UI 상태
  selectedTemplateId: null,
  previewMode: false,
  galleryView: 'grid',
  itemsPerPage: 12,
  currentPage: 1,

  // 로딩 상태
  isLoading: false,
  isSearching: false,
  isCreatingProject: false,
  lastSearchTime: 0,
  pendingOperations: [],

  // 에러 상태
  error: null,
  searchError: null,
  createProjectError: null
}

// ===========================================
// Redux Slice
// ===========================================

const templateSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    // 기본 액션들
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },

    setActiveFilters: (state, action: PayloadAction<TemplateSearchFilters>) => {
      state.activeFilters = action.payload
    },

    setSortOptions: (state, action: PayloadAction<{
      sortBy: TemplateSortOption
      sortOrder: 'asc' | 'desc'
    }>) => {
      state.sortBy = action.payload.sortBy
      state.sortOrder = action.payload.sortOrder
    },

    setSelectedTemplate: (state, action: PayloadAction<string | null>) => {
      state.selectedTemplateId = action.payload
    },

    setPreviewMode: (state, action: PayloadAction<boolean>) => {
      state.previewMode = action.payload
    },

    setGalleryView: (state, action: PayloadAction<'grid' | 'list'>) => {
      state.galleryView = action.payload
    },

    setPagination: (state, action: PayloadAction<{
      itemsPerPage?: number
      currentPage?: number
    }>) => {
      if (action.payload.itemsPerPage !== undefined) {
        state.itemsPerPage = action.payload.itemsPerPage
      }
      if (action.payload.currentPage !== undefined) {
        state.currentPage = action.payload.currentPage
      }
    },

    // 에러 클리어
    clearError: (state) => {
      state.error = null
      state.searchError = null
      state.createProjectError = null
    },

    // 필터 리셋
    resetFilters: (state) => {
      state.activeFilters = {}
      state.searchQuery = ''
      state.filteredTemplates = state.templates
      state.currentPage = 1
    },

    // 로컬 필터링 (실시간 UI 피드백용)
    applyLocalFilters: (state) => {
      let filtered = [...state.templates]

      // 검색어 적용
      if (state.searchQuery.trim()) {
        filtered = TemplateDomain.searchTemplates(filtered, state.searchQuery)
      }

      // 필터 적용
      if (Object.keys(state.activeFilters).length > 0) {
        filtered = TemplateDomain.filterTemplates(filtered, state.activeFilters)
      }

      // 정렬 적용
      filtered = TemplateDomain.sortTemplates(filtered, state.sortBy, state.sortOrder)

      state.filteredTemplates = filtered
      state.currentPage = 1 // 필터 변경 시 첫 페이지로 리셋
    }
  },

  extraReducers: (builder) => {
    // 템플릿 검색
    builder
      .addCase(searchTemplatesAsync.pending, (state) => {
        state.isSearching = true
        state.searchError = null
        state.lastSearchTime = Date.now()
      })
      .addCase(searchTemplatesAsync.fulfilled, (state, action) => {
        state.isSearching = false
        state.filteredTemplates = action.payload.templates
        state.searchQuery = action.payload.query
        state.activeFilters = action.payload.filters
        state.sortBy = action.payload.sortBy
        state.sortOrder = action.payload.sortOrder
        state.currentPage = 1
      })
      .addCase(searchTemplatesAsync.rejected, (state, action) => {
        state.isSearching = false
        state.searchError = action.payload as string
      })

    // 추천 템플릿 로드
    builder
      .addCase(loadRecommendedTemplatesAsync.pending, (state) => {
        state.pendingOperations = [...state.pendingOperations, 'loadRecommended']
      })
      .addCase(loadRecommendedTemplatesAsync.fulfilled, (state, action) => {
        state.recommendedTemplates = action.payload
        state.pendingOperations = state.pendingOperations.filter(op => op !== 'loadRecommended')
      })
      .addCase(loadRecommendedTemplatesAsync.rejected, (state, action) => {
        state.error = action.payload as string
        state.pendingOperations = state.pendingOperations.filter(op => op !== 'loadRecommended')
      })

    // 프로젝트 생성
    builder
      .addCase(createProjectFromTemplateAsync.pending, (state) => {
        state.isCreatingProject = true
        state.createProjectError = null
      })
      .addCase(createProjectFromTemplateAsync.fulfilled, (state) => {
        state.isCreatingProject = false
        // 성공 시 추가 로직 (예: 프로젝트 페이지로 리다이렉트)
      })
      .addCase(createProjectFromTemplateAsync.rejected, (state, action) => {
        state.isCreatingProject = false
        state.createProjectError = action.payload as string
      })
  }
})

// ===========================================
// 액션 및 셀렉터 내보내기
// ===========================================

export const {
  setSearchQuery,
  setActiveFilters,
  setSortOptions,
  setSelectedTemplate,
  setPreviewMode,
  setGalleryView,
  setPagination,
  clearError,
  resetFilters,
  applyLocalFilters
} = templateSlice.actions

export default templateSlice.reducer

// 유용한 셀렉터들
export const selectAllTemplates = (state: { templates: TemplateState }) => state.templates.templates
export const selectFilteredTemplates = (state: { templates: TemplateState }) => state.templates.filteredTemplates
export const selectFeaturedTemplates = (state: { templates: TemplateState }) => state.templates.featuredTemplates
export const selectPopularTemplates = (state: { templates: TemplateState }) => state.templates.popularTemplates
export const selectRecommendedTemplates = (state: { templates: TemplateState }) => state.templates.recommendedTemplates
export const selectSelectedTemplate = (state: { templates: TemplateState }) => {
  const { templates, selectedTemplateId } = state.templates
  return selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) || null : null
}
export const selectTemplateLoadingState = (state: { templates: TemplateState }) => ({
  isLoading: state.templates.isLoading,
  isSearching: state.templates.isSearching,
  isCreatingProject: state.templates.isCreatingProject
})
export const selectTemplateErrors = (state: { templates: TemplateState }) => ({
  error: state.templates.error,
  searchError: state.templates.searchError,
  createProjectError: state.templates.createProjectError
})