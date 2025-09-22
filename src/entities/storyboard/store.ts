/**
 * Storyboard Entity Store (Redux Toolkit)
 *
 * 스토리보드 도메인 상태 관리
 * CLAUDE.md 준수: Redux Toolkit 2.0, 전역 클라이언트 상태
 */

import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Storyboard,
  StoryboardFrame,
  StoryboardUpdateInput,
  StoryboardValidationResult,
  ConsistencyReference,
  GenerationResult,
  GenerationProgress,
  StoryboardFrameStatus,
  BatchGenerationRequest
} from './types'
import { StoryboardModel } from './model'

/**
 * 스토리보드 상태 인터페이스
 */
export interface StoryboardState {
  // 현재 작업 중인 스토리보드
  currentStoryboard: Storyboard | null

  // 스토리보드 목록 캐시
  storyboardList: Storyboard[]

  // UI 상태
  isLoading: boolean
  isSaving: boolean
  isGenerating: boolean

  // 선택된 프레임
  selectedFrameId: string | null

  // 배치 생성 상태
  batchGeneration: {
    isActive: boolean
    request: BatchGenerationRequest | null
    progress: GenerationProgress[]
    completedCount: number
    failedCount: number
  }

  // 에디터 상태
  editorState: {
    isEditing: boolean
    hasUnsavedChanges: boolean
    lastSavedAt: Date | null
    activePanel: 'frames' | 'settings' | 'consistency' | 'analytics'
    previewMode: 'grid' | 'sequence' | 'timeline'
  }

  // 필터 및 정렬
  filters: {
    status: StoryboardFrameStatus[]
    sceneIds: string[]
    showCompleted: boolean
    showFailed: boolean
  }

  sortBy: 'order' | 'createdAt' | 'status' | 'title'
  sortOrder: 'asc' | 'desc'

  // 검증 결과
  validationResult: StoryboardValidationResult | null

  // 일관성 참조 편집
  consistencyEditor: {
    isOpen: boolean
    editingReference: ConsistencyReference | null
  }

  // 오류 상태
  error: string | null
  frameErrors: Record<string, string> // frameId -> error message
}

/**
 * 초기 상태
 */
const initialState: StoryboardState = {
  currentStoryboard: null,
  storyboardList: [],
  isLoading: false,
  isSaving: false,
  isGenerating: false,
  selectedFrameId: null,
  batchGeneration: {
    isActive: false,
    request: null,
    progress: [],
    completedCount: 0,
    failedCount: 0
  },
  editorState: {
    isEditing: false,
    hasUnsavedChanges: false,
    lastSavedAt: null,
    activePanel: 'frames',
    previewMode: 'grid'
  },
  filters: {
    status: [],
    sceneIds: [],
    showCompleted: true,
    showFailed: true
  },
  sortBy: 'order',
  sortOrder: 'asc',
  validationResult: null,
  consistencyEditor: {
    isOpen: false,
    editingReference: null
  },
  error: null,
  frameErrors: {}
}

/**
 * 스토리보드 슬라이스
 */
export const storyboardSlice = createSlice({
  name: 'storyboard',
  initialState,
  reducers: {
    // === 기본 상태 관리 ===
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload
    },

    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },

    clearError: (state) => {
      state.error = null
      state.frameErrors = {}
    },

    // === 스토리보드 관리 ===
    setCurrentStoryboard: (state, action: PayloadAction<Storyboard | null>) => {
      state.currentStoryboard = action.payload
      state.selectedFrameId = null
      state.editorState.hasUnsavedChanges = false
      state.validationResult = null
    },

    updateStoryboard: (state, action: PayloadAction<StoryboardUpdateInput>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard = StoryboardModel.update(state.currentStoryboard, action.payload)
        state.editorState.hasUnsavedChanges = true
      }
    },

    setStoryboardList: (state, action: PayloadAction<Storyboard[]>) => {
      state.storyboardList = action.payload
    },

    addToStoryboardList: (state, action: PayloadAction<Storyboard>) => {
      const existingIndex = state.storyboardList.findIndex(
        sb => sb.metadata.id === action.payload.metadata.id
      )
      if (existingIndex >= 0) {
        state.storyboardList[existingIndex] = action.payload
      } else {
        state.storyboardList.push(action.payload)
      }
    },

    removeFromStoryboardList: (state, action: PayloadAction<string>) => {
      state.storyboardList = state.storyboardList.filter(
        sb => sb.metadata.id !== action.payload
      )
    },

    // === 프레임 관리 ===
    setSelectedFrame: (state, action: PayloadAction<string | null>) => {
      state.selectedFrameId = action.payload
    },

    addFrame: (state, action: PayloadAction<StoryboardFrame>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard.frames.push(action.payload)
        state.editorState.hasUnsavedChanges = true
      }
    },

    updateFrame: (state, action: PayloadAction<{ frameId: string; updates: Partial<StoryboardFrame> }>) => {
      if (state.currentStoryboard) {
        const { frameId, updates } = action.payload
        state.currentStoryboard = StoryboardModel.updateFrame(state.currentStoryboard, frameId, updates)
        state.editorState.hasUnsavedChanges = true
      }
    },

    removeFrame: (state, action: PayloadAction<string>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard = StoryboardModel.removeFrame(state.currentStoryboard, action.payload)
        state.editorState.hasUnsavedChanges = true
        if (state.selectedFrameId === action.payload) {
          state.selectedFrameId = null
        }
      }
    },

    reorderFrames: (state, action: PayloadAction<string[]>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard = StoryboardModel.reorderFrames(state.currentStoryboard, action.payload)
        state.editorState.hasUnsavedChanges = true
      }
    },

    updateFrameStatus: (state, action: PayloadAction<{ frameId: string; status: StoryboardFrameStatus }>) => {
      if (state.currentStoryboard) {
        const { frameId, status } = action.payload
        state.currentStoryboard = StoryboardModel.updateFrameStatus(state.currentStoryboard, frameId, status)
      }
    },

    addGenerationResult: (state, action: PayloadAction<{ frameId: string; result: GenerationResult }>) => {
      if (state.currentStoryboard) {
        const { frameId, result } = action.payload
        state.currentStoryboard = StoryboardModel.addGenerationResult(state.currentStoryboard, frameId, result)
        // 프레임 에러 제거
        delete state.frameErrors[frameId]
      }
    },

    setFrameError: (state, action: PayloadAction<{ frameId: string; error: string }>) => {
      const { frameId, error } = action.payload
      state.frameErrors[frameId] = error
      if (state.currentStoryboard) {
        state.currentStoryboard = StoryboardModel.updateFrameStatus(state.currentStoryboard, frameId, 'failed')
      }
    },

    // === 배치 생성 관리 ===
    startBatchGeneration: (state, action: PayloadAction<BatchGenerationRequest>) => {
      state.batchGeneration = {
        isActive: true,
        request: action.payload,
        progress: action.payload.frames.map(frame => ({
          frameId: frame.sceneId, // 임시로 sceneId 사용
          status: 'pending',
          progress: 0
        })),
        completedCount: 0,
        failedCount: 0
      }
      state.isGenerating = true
    },

    updateGenerationProgress: (state, action: PayloadAction<GenerationProgress>) => {
      const progress = action.payload
      const existingIndex = state.batchGeneration.progress.findIndex(
        p => p.frameId === progress.frameId
      )
      if (existingIndex >= 0) {
        state.batchGeneration.progress[existingIndex] = progress
      }
    },

    completeFrameGeneration: (state, action: PayloadAction<string>) => {
      const frameId = action.payload
      state.batchGeneration.completedCount++
      const progressItem = state.batchGeneration.progress.find(p => p.frameId === frameId)
      if (progressItem) {
        progressItem.status = 'completed'
        progressItem.progress = 1.0
      }
    },

    failFrameGeneration: (state, action: PayloadAction<string>) => {
      const frameId = action.payload
      state.batchGeneration.failedCount++
      const progressItem = state.batchGeneration.progress.find(p => p.frameId === frameId)
      if (progressItem) {
        progressItem.status = 'failed'
      }
    },

    stopBatchGeneration: (state) => {
      state.batchGeneration = {
        isActive: false,
        request: null,
        progress: [],
        completedCount: 0,
        failedCount: 0
      }
      state.isGenerating = false
    },

    // === 일관성 참조 관리 ===
    addConsistencyReference: (state, action: PayloadAction<Omit<ConsistencyReference, 'id'>>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard = StoryboardModel.addConsistencyReference(
          state.currentStoryboard,
          action.payload
        )
        state.editorState.hasUnsavedChanges = true
      }
    },

    updateConsistencyReference: (state, action: PayloadAction<{ referenceId: string; updates: Partial<ConsistencyReference> }>) => {
      if (state.currentStoryboard) {
        const { referenceId, updates } = action.payload
        state.currentStoryboard = StoryboardModel.updateConsistencyReference(
          state.currentStoryboard,
          referenceId,
          updates
        )
        state.editorState.hasUnsavedChanges = true
      }
    },

    removeConsistencyReference: (state, action: PayloadAction<string>) => {
      if (state.currentStoryboard) {
        state.currentStoryboard.settings.globalConsistencyRefs =
          state.currentStoryboard.settings.globalConsistencyRefs.filter(
            ref => ref.id !== action.payload
          )
        state.editorState.hasUnsavedChanges = true
      }
    },

    // === 에디터 상태 관리 ===
    setEditing: (state, action: PayloadAction<boolean>) => {
      state.editorState.isEditing = action.payload
    },

    setActivePanel: (state, action: PayloadAction<'frames' | 'settings' | 'consistency' | 'analytics'>) => {
      state.editorState.activePanel = action.payload
    },

    setPreviewMode: (state, action: PayloadAction<'grid' | 'sequence' | 'timeline'>) => {
      state.editorState.previewMode = action.payload
    },

    markSaved: (state) => {
      state.editorState.hasUnsavedChanges = false
      state.editorState.lastSavedAt = new Date()
      state.isSaving = false
    },

    // === 필터 및 정렬 ===
    setFilters: (state, action: PayloadAction<Partial<StoryboardState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },

    setSorting: (state, action: PayloadAction<{ sortBy: StoryboardState['sortBy']; sortOrder: StoryboardState['sortOrder'] }>) => {
      state.sortBy = action.payload.sortBy
      state.sortOrder = action.payload.sortOrder
    },

    // === 검증 ===
    setValidationResult: (state, action: PayloadAction<StoryboardValidationResult | null>) => {
      state.validationResult = action.payload
    },

    // === 일관성 참조 에디터 ===
    openConsistencyEditor: (state, action: PayloadAction<ConsistencyReference | null>) => {
      state.consistencyEditor = {
        isOpen: true,
        editingReference: action.payload
      }
    },

    closeConsistencyEditor: (state) => {
      state.consistencyEditor = {
        isOpen: false,
        editingReference: null
      }
    },

    // === 리셋 ===
    resetState: () => initialState
  }
})

/**
 * 액션 생성자 내보내기
 */
export const storyboardActions = storyboardSlice.actions

/**
 * 선택자 (Selectors)
 */
export const storyboardSelectors = {
  // 기본 선택자
  getCurrentStoryboard: (state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard,
  getStoryboardList: (state: { storyboard: StoryboardState }) => state.storyboard.storyboardList,
  getSelectedFrameId: (state: { storyboard: StoryboardState }) => state.storyboard.selectedFrameId,
  getIsLoading: (state: { storyboard: StoryboardState }) => state.storyboard.isLoading,
  getIsSaving: (state: { storyboard: StoryboardState }) => state.storyboard.isSaving,
  getIsGenerating: (state: { storyboard: StoryboardState }) => state.storyboard.isGenerating,
  getError: (state: { storyboard: StoryboardState }) => state.storyboard.error,
  getEditorState: (state: { storyboard: StoryboardState }) => state.storyboard.editorState,
  getBatchGeneration: (state: { storyboard: StoryboardState }) => state.storyboard.batchGeneration,
  getValidationResult: (state: { storyboard: StoryboardState }) => state.storyboard.validationResult,

  // 계산된 선택자
  getSelectedFrame: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard,
     (state: { storyboard: StoryboardState }) => state.storyboard.selectedFrameId],
    (storyboard, selectedFrameId) => {
      if (!storyboard || !selectedFrameId) return null
      return storyboard.frames.find(frame => frame.metadata.id === selectedFrameId) || null
    }
  ),

  getFilteredFrames: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard,
     (state: { storyboard: StoryboardState }) => state.storyboard.filters,
     (state: { storyboard: StoryboardState }) => state.storyboard.sortBy,
     (state: { storyboard: StoryboardState }) => state.storyboard.sortOrder],
    (storyboard, filters, sortBy, sortOrder) => {
      if (!storyboard) return []

      let filteredFrames = storyboard.frames

      // 상태 필터 적용
      if (filters.status.length > 0) {
        filteredFrames = filteredFrames.filter(frame =>
          filters.status.includes(frame.metadata.status)
        )
      }

      // 씬 ID 필터 적용
      if (filters.sceneIds.length > 0) {
        filteredFrames = filteredFrames.filter(frame =>
          filters.sceneIds.includes(frame.metadata.sceneId)
        )
      }

      // 완료/실패 필터 적용
      if (!filters.showCompleted) {
        filteredFrames = filteredFrames.filter(frame => frame.metadata.status !== 'completed')
      }
      if (!filters.showFailed) {
        filteredFrames = filteredFrames.filter(frame => frame.metadata.status !== 'failed')
      }

      // 정렬 적용
      filteredFrames.sort((a, b) => {
        let aValue, bValue

        switch (sortBy) {
          case 'order':
            aValue = a.metadata.order
            bValue = b.metadata.order
            break
          case 'createdAt':
            aValue = a.metadata.createdAt.getTime()
            bValue = b.metadata.createdAt.getTime()
            break
          case 'status':
            aValue = a.metadata.status
            bValue = b.metadata.status
            break
          case 'title':
            aValue = a.metadata.title
            bValue = b.metadata.title
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
        return 0
      })

      return filteredFrames
    }
  ),

  getFramesByStatus: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard],
    (storyboard) => {
      if (!storyboard) return {}

      return storyboard.frames.reduce((acc, frame) => {
        const status = frame.metadata.status
        if (!acc[status]) acc[status] = []
        acc[status].push(frame)
        return acc
      }, {} as Record<StoryboardFrameStatus, StoryboardFrame[]>)
    }
  ),

  getGenerationStatistics: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard],
    (storyboard) => {
      if (!storyboard || !storyboard.statistics) {
        return {
          totalFrames: 0,
          completedFrames: 0,
          failedFrames: 0,
          successRate: 0,
          totalCost: 0
        }
      }

      const stats = storyboard.statistics
      const successRate = stats.totalFrames > 0 ? stats.completedFrames / stats.totalFrames : 0

      return {
        ...stats,
        successRate
      }
    }
  ),

  getActiveConsistencyRefs: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.currentStoryboard],
    (storyboard) => {
      if (!storyboard) return []
      return storyboard.settings.globalConsistencyRefs.filter(ref => ref.isActive)
    }
  ),

  getBatchProgress: createSelector(
    [(state: { storyboard: StoryboardState }) => state.storyboard.batchGeneration],
    (batchGeneration) => {
      if (!batchGeneration.isActive || batchGeneration.progress.length === 0) {
        return { overallProgress: 0, isComplete: false }
      }

      const totalProgress = batchGeneration.progress.reduce((sum, p) => sum + p.progress, 0)
      const overallProgress = totalProgress / batchGeneration.progress.length
      const isComplete = batchGeneration.progress.every(p => p.status === 'completed' || p.status === 'failed')

      return { overallProgress, isComplete }
    }
  )
}

/**
 * 리듀서 내보내기
 */
export default storyboardSlice.reducer

/**
 * 상태 타입 내보내기
 */
export type { StoryboardState }