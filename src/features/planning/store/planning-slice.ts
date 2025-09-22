/**
 * Planning Redux Slice
 *
 * 영상 기획 위저드의 전역 상태 관리
 * CLAUDE.md 준수: Redux Toolkit 2.0, $300 사건 방지
 */

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'

import type {
  PlanningProject,
  PlanningProjectCreateInput,
  PlanningProjectUpdateInput,
  PlanningInputData,
  StoryStep,
  ShotSequence,
  InsertShot,
  WizardStep,
  PlanningSearchFilter,
  ContiStyle,
} from '../../../entities/planning'

import {
  validatePlanningInput,
  validateStorySteps,
  validateShotSequences,
  calculateWizardProgress,
} from '../../../entities/planning'

import logger from '../../../shared/lib/logger'

/**
 * Planning 상태 타입
 */
export interface PlanningState {
  // 현재 프로젝트
  currentProject: PlanningProject | null

  // 프로젝트 목록
  projects: PlanningProject[]

  // UI 상태
  isLoading: boolean
  error: string | null

  // 필터 및 검색
  filters: PlanningSearchFilter

  // 위저드 상태
  currentStep: WizardStep

  // 캐시 및 성능
  lastFetch: number | null
  isDirty: boolean
}

/**
 * 초기 상태
 */
const initialState: PlanningState = {
  currentProject: null,
  projects: [],
  isLoading: false,
  error: null,
  filters: {
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 20,
    offset: 0,
  },
  currentStep: 'input',
  lastFetch: null,
  isDirty: false,
}

/**
 * 비동기 액션: 프로젝트 생성
 */
export const createProject = createAsyncThunk(
  'planning/createProject',
  async (input: PlanningProjectCreateInput, { rejectWithValue }) => {
    try {
      // 입력 검증
      const validation = validatePlanningInput(input.inputData)
      if (!validation.isValid) {
        throw new Error(validation.errors[0]?.message || '입력 데이터가 유효하지 않습니다')
      }

      const response = await fetch('/api/planning/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '프로젝트 생성 실패')
      }

      const project = await response.json()

      logger.info('기획 프로젝트 생성 성공', {
        projectId: project.metadata.id,
        title: project.metadata.title,
      })

      return project as PlanningProject

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      logger.error('기획 프로젝트 생성 실패', { error: errorMessage, input })
      return rejectWithValue(errorMessage)
    }
  }
)

/**
 * 비동기 액션: 프로젝트 로드
 */
export const loadProject = createAsyncThunk(
  'planning/loadProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/planning/projects/${projectId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '프로젝트 로드 실패')
      }

      const project = await response.json()

      logger.info('기획 프로젝트 로드 성공', {
        projectId: project.metadata.id,
        title: project.metadata.title,
      })

      return project as PlanningProject

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      logger.error('기획 프로젝트 로드 실패', { error: errorMessage, projectId })
      return rejectWithValue(errorMessage)
    }
  }
)

/**
 * 비동기 액션: 프로젝트 저장
 */
export const saveProject = createAsyncThunk(
  'planning/saveProject',
  async (project: PlanningProject, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/planning/projects/${project.metadata.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '프로젝트 저장 실패')
      }

      const savedProject = await response.json()

      logger.info('기획 프로젝트 저장 성공', {
        projectId: savedProject.metadata.id,
        title: savedProject.metadata.title,
      })

      return savedProject as PlanningProject

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      logger.error('기획 프로젝트 저장 실패', {
        error: errorMessage,
        projectId: project.metadata.id,
      })
      return rejectWithValue(errorMessage)
    }
  }
)

/**
 * 비동기 액션: 프로젝트 목록 로드
 */
export const loadProjects = createAsyncThunk(
  'planning/loadProjects',
  async (filters: PlanningSearchFilter, { rejectWithValue, getState }) => {
    try {
      // 캐시 체크 - $300 사건 방지
      const state = getState() as { planning: PlanningState }
      const cacheTimeout = 5 * 60 * 1000 // 5분
      const now = Date.now()

      if (
        state.planning.lastFetch &&
        now - state.planning.lastFetch < cacheTimeout &&
        state.planning.projects.length > 0
      ) {
        logger.info('기획 프로젝트 목록 캐시 사용')
        return {
          projects: state.planning.projects,
          fromCache: true,
        }
      }

      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(`/api/planning/projects?${queryParams.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '프로젝트 목록 로드 실패')
      }

      const data = await response.json()

      logger.info('기획 프로젝트 목록 로드 성공', {
        count: data.projects?.length || 0,
        filters,
      })

      return {
        projects: data.projects as PlanningProject[],
        fromCache: false,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      logger.error('기획 프로젝트 목록 로드 실패', { error: errorMessage, filters })
      return rejectWithValue(errorMessage)
    }
  }
)

/**
 * Planning Slice
 */
const planningSlice = createSlice({
  name: 'planning',
  initialState,
  reducers: {
    // 현재 프로젝트 설정
    setCurrentProject: (state, action: PayloadAction<PlanningProject>) => {
      state.currentProject = action.payload
      state.currentStep = action.payload.currentStep
      state.isDirty = false
      state.error = null
    },

    // 현재 단계 설정
    setCurrentStep: (state, action: PayloadAction<WizardStep>) => {
      state.currentStep = action.payload
      if (state.currentProject) {
        state.currentProject.currentStep = action.payload
        state.isDirty = true
      }
    },

    // 입력 데이터 업데이트
    updateInputData: (state, action: PayloadAction<Partial<PlanningInputData>>) => {
      if (state.currentProject) {
        state.currentProject.inputData = {
          ...state.currentProject.inputData,
          ...action.payload,
        }
        state.currentProject.metadata.updatedAt = new Date()
        state.isDirty = true
        state.error = null

        // 진행률 재계산
        const progress = calculateWizardProgress(state.currentProject)
        state.currentProject.completionPercentage = Math.round(
          (progress.inputCompletion + progress.storyCompletion + progress.shotsCompletion) / 3
        )
      }
    },

    // 스토리 스텝 업데이트
    updateStorySteps: (state, action: PayloadAction<StoryStep[]>) => {
      if (state.currentProject) {
        state.currentProject.storySteps = action.payload
        state.currentProject.metadata.updatedAt = new Date()
        state.isDirty = true
        state.error = null

        // 진행률 재계산
        const progress = calculateWizardProgress(state.currentProject)
        state.currentProject.completionPercentage = Math.round(
          (progress.inputCompletion + progress.storyCompletion + progress.shotsCompletion) / 3
        )

        // 총 시간 재계산
        state.currentProject.totalDuration = state.currentProject.storySteps.reduce(
          (sum, step) => sum + (step.duration || 0),
          0
        )
      }
    },

    // 숏 시퀀스 업데이트
    updateShotSequences: (state, action: PayloadAction<ShotSequence[]>) => {
      if (state.currentProject) {
        state.currentProject.shotSequences = action.payload
        state.currentProject.metadata.updatedAt = new Date()
        state.isDirty = true
        state.error = null

        // 진행률 재계산
        const progress = calculateWizardProgress(state.currentProject)
        state.currentProject.completionPercentage = Math.round(
          (progress.inputCompletion + progress.storyCompletion + progress.shotsCompletion) / 3
        )

        // 총 시간 재계산 (숏 기준이 더 정확함)
        state.currentProject.totalDuration = state.currentProject.shotSequences.reduce(
          (sum, shot) => sum + shot.duration,
          0
        )
      }
    },

    // 인서트 숏 업데이트
    updateInsertShots: (state, action: PayloadAction<InsertShot[]>) => {
      if (state.currentProject) {
        state.currentProject.insertShots = action.payload
        state.currentProject.metadata.updatedAt = new Date()
        state.isDirty = true
      }
    },

    // 개별 숏의 콘티 이미지 업데이트
    updateShotContiImage: (
      state,
      action: PayloadAction<{ shotId: string; imageUrl: string }>
    ) => {
      if (state.currentProject) {
        const { shotId, imageUrl } = action.payload
        const shot = state.currentProject.shotSequences.find(s => s.id === shotId)
        if (shot) {
          shot.contiImageUrl = imageUrl
          state.currentProject.metadata.updatedAt = new Date()
          state.isDirty = true
        }
      }
    },

    // 개별 숏의 스타일 업데이트
    updateShotStyle: (
      state,
      action: PayloadAction<{ shotId: string; style: ContiStyle }>
    ) => {
      if (state.currentProject) {
        const { shotId, style } = action.payload
        const shot = state.currentProject.shotSequences.find(s => s.id === shotId)
        if (shot) {
          shot.contiStyle = style
          state.currentProject.metadata.updatedAt = new Date()
          state.isDirty = true
        }
      }
    },

    // 필터 업데이트
    updateFilters: (state, action: PayloadAction<Partial<PlanningSearchFilter>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      }
    },

    // 로딩 상태 설정
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    // 에러 설정
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },

    // 에러 클리어
    clearError: (state) => {
      state.error = null
    },

    // 전체 상태 리셋
    reset: (state) => {
      state.currentProject = null
      state.currentStep = 'input'
      state.error = null
      state.isDirty = false
    },

    // 프로젝트 목록에서 제거
    removeProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(
        project => project.metadata.id !== action.payload
      )
    },

    // dirty 플래그 클리어
    clearDirty: (state) => {
      state.isDirty = false
    },
  },

  extraReducers: (builder) => {
    // 프로젝트 생성
    builder
      .addCase(createProject.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentProject = action.payload
        state.currentStep = action.payload.currentStep
        state.projects.unshift(action.payload) // 최신 순으로 추가
        state.isDirty = false
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 프로젝트 로드
    builder
      .addCase(loadProject.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadProject.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentProject = action.payload
        state.currentStep = action.payload.currentStep
        state.isDirty = false
      })
      .addCase(loadProject.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 프로젝트 저장
    builder
      .addCase(saveProject.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveProject.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentProject = action.payload
        state.isDirty = false

        // 목록에서도 업데이트
        const index = state.projects.findIndex(
          p => p.metadata.id === action.payload.metadata.id
        )
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(saveProject.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 프로젝트 목록 로드
    builder
      .addCase(loadProjects.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadProjects.fulfilled, (state, action) => {
        state.isLoading = false
        state.projects = action.payload.projects

        // 캐시 타임스탬프 업데이트 (캐시에서 가져온 경우 제외)
        if (!action.payload.fromCache) {
          state.lastFetch = Date.now()
        }
      })
      .addCase(loadProjects.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

/**
 * 액션 익스포트
 */
export const planningActions = planningSlice.actions

/**
 * 셀렉터
 */
export const planningSelectors = {
  getCurrentProject: (state: { planning: PlanningState }) => state.planning.currentProject,
  getProjects: (state: { planning: PlanningState }) => state.planning.projects,
  getCurrentStep: (state: { planning: PlanningState }) => state.planning.currentStep,
  getIsLoading: (state: { planning: PlanningState }) => state.planning.isLoading,
  getError: (state: { planning: PlanningState }) => state.planning.error,
  getFilters: (state: { planning: PlanningState }) => state.planning.filters,
  getIsDirty: (state: { planning: PlanningState }) => state.planning.isDirty,

  // 계산된 셀렉터
  getCurrentProjectProgress: (state: { planning: PlanningState }) => {
    const project = state.planning.currentProject
    return project ? calculateWizardProgress(project) : null
  },

  getProjectsCount: (state: { planning: PlanningState }) => state.planning.projects.length,

  getRecentProjects: (state: { planning: PlanningState }) =>
    state.planning.projects
      .slice()
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime())
      .slice(0, 5),
}

/**
 * 리듀서 익스포트
 */
export default planningSlice.reducer