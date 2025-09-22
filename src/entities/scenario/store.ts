/**
 * Scenario Entity Store (Redux Toolkit)
 *
 * 시나리오 도메인 상태 관리
 * CLAUDE.md 준수: Redux Toolkit 2.0, 전역 클라이언트 상태
 */

import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type { Scenario, Scene, ScenarioUpdateInput, ValidationResult } from './types'
import { ScenarioModel } from './model'

/**
 * 시나리오 상태 인터페이스
 */
export interface ScenarioState {
  // 현재 작업 중인 시나리오
  currentScenario: Scenario | null
  
  // 시나리오 목록 캐시
  scenarioList: Scenario[]
  
  // UI 상태
  isLoading: boolean
  isSaving: boolean
  
  // 선택된 씬
  selectedSceneId: string | null
  
  // 에디터 상태
  editorState: {
    isEditing: boolean
    hasUnsavedChanges: boolean
    lastSavedAt: Date | null
  }
  
  // 검증 결과
  validationResult: ValidationResult | null
  
  // 오류 상태
  error: string | null
}

/**
 * 초기 상태
 */
const initialState: ScenarioState = {
  currentScenario: null,
  scenarioList: [],
  isLoading: false,
  isSaving: false,
  selectedSceneId: null,
  editorState: {
    isEditing: false,
    hasUnsavedChanges: false,
    lastSavedAt: null
  },
  validationResult: null,
  error: null
}

/**
 * 시나리오 슬라이스
 */
export const scenarioSlice = createSlice({
  name: 'scenario',
  initialState,
  reducers: {
    // === 로딩 상태 ===
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
      if (action.payload) {
        state.error = null
      }
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload
    },

    // === 시나리오 관리 ===
    setCurrentScenario: (state, action: PayloadAction<Scenario | null>) => {
      state.currentScenario = action.payload
      state.selectedSceneId = null
      state.editorState.hasUnsavedChanges = false
      state.editorState.isEditing = !!action.payload
      if (action.payload) {
        state.validationResult = ScenarioModel.validate(action.payload)
      }
    },

    updateCurrentScenario: (state, action: PayloadAction<ScenarioUpdateInput>) => {
      if (state.currentScenario) {
        const updated = ScenarioModel.update(state.currentScenario, action.payload)
        state.currentScenario = updated
        state.editorState.hasUnsavedChanges = true
        state.validationResult = ScenarioModel.validate(updated)
        
        // 목록에도 반영
        const index = state.scenarioList.findIndex(s => s.metadata.id === updated.metadata.id)
        if (index !== -1) {
          state.scenarioList[index] = updated
        }
      }
    },

    // === 씬 관리 ===
    addScene: (state, action: PayloadAction<Omit<Scene, 'id' | 'order'>>) => {
      if (state.currentScenario) {
        const updated = ScenarioModel.addScene(state.currentScenario, action.payload)
        state.currentScenario = updated
        state.editorState.hasUnsavedChanges = true
        state.validationResult = ScenarioModel.validate(updated)
      }
    },

    updateScene: (state, action: PayloadAction<{ sceneId: string; updates: Partial<Scene> }>) => {
      if (state.currentScenario) {
        const { sceneId, updates } = action.payload
        const updated = ScenarioModel.updateScene(state.currentScenario, sceneId, updates)
        state.currentScenario = updated
        state.editorState.hasUnsavedChanges = true
        state.validationResult = ScenarioModel.validate(updated)
      }
    },

    removeScene: (state, action: PayloadAction<string>) => {
      if (state.currentScenario) {
        const updated = ScenarioModel.removeScene(state.currentScenario, action.payload)
        state.currentScenario = updated
        state.editorState.hasUnsavedChanges = true
        state.validationResult = ScenarioModel.validate(updated)
        
        // 삭제된 씬이 선택되어 있었다면 선택 해제
        if (state.selectedSceneId === action.payload) {
          state.selectedSceneId = null
        }
      }
    },

    reorderScenes: (state, action: PayloadAction<string[]>) => {
      if (state.currentScenario) {
        const updated = ScenarioModel.reorderScenes(state.currentScenario, action.payload)
        state.currentScenario = updated
        state.editorState.hasUnsavedChanges = true
        state.validationResult = ScenarioModel.validate(updated)
      }
    },

    // === 선택 및 UI 상태 ===
    setSelectedScene: (state, action: PayloadAction<string | null>) => {
      state.selectedSceneId = action.payload
    },

    setEditingMode: (state, action: PayloadAction<boolean>) => {
      state.editorState.isEditing = action.payload
      if (!action.payload) {
        state.selectedSceneId = null
      }
    },

    // === 저장 상태 ===
    markSaved: (state) => {
      state.editorState.hasUnsavedChanges = false
      state.editorState.lastSavedAt = new Date()
      state.isSaving = false
    },

    // === 시나리오 목록 ===
    setScenarioList: (state, action: PayloadAction<Scenario[]>) => {
      state.scenarioList = action.payload
    },

    addToScenarioList: (state, action: PayloadAction<Scenario>) => {
      const exists = state.scenarioList.some(s => s.metadata.id === action.payload.metadata.id)
      if (!exists) {
        state.scenarioList.unshift(action.payload)
      }
    },

    removeFromScenarioList: (state, action: PayloadAction<string>) => {
      state.scenarioList = state.scenarioList.filter(s => s.metadata.id !== action.payload)
    },

    // === 오류 처리 ===
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
      if (action.payload) {
        state.isLoading = false
        state.isSaving = false
      }
    },

    clearError: (state) => {
      state.error = null
    },

    // === 상태 초기화 ===
    reset: () => initialState,

    resetEditor: (state) => {
      state.currentScenario = null
      state.selectedSceneId = null
      state.editorState = {
        isEditing: false,
        hasUnsavedChanges: false,
        lastSavedAt: null
      }
      state.validationResult = null
      state.error = null
    }
  }
})

// === Actions Export ===
export const scenarioActions = scenarioSlice.actions

// === Selectors ===
export const scenarioSelectors = {
  // 기본 셀렉터
  getCurrentScenario: (state: { scenario: ScenarioState }) => state.scenario.currentScenario,
  getScenarioList: (state: { scenario: ScenarioState }) => state.scenario.scenarioList,
  getSelectedSceneId: (state: { scenario: ScenarioState }) => state.scenario.selectedSceneId,
  getIsLoading: (state: { scenario: ScenarioState }) => state.scenario.isLoading,
  getIsSaving: (state: { scenario: ScenarioState }) => state.scenario.isSaving,
  getError: (state: { scenario: ScenarioState }) => state.scenario.error,
  getValidationResult: (state: { scenario: ScenarioState }) => state.scenario.validationResult,
  getEditorState: (state: { scenario: ScenarioState }) => state.scenario.editorState,

  // 계산된 셀렉터
  getSelectedScene: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.currentScenario,
     (state: { scenario: ScenarioState }) => state.scenario.selectedSceneId],
    (scenario, selectedId) => {
      if (!scenario || !selectedId) return null
      return scenario.scenes.find(scene => scene.id === selectedId) || null
    }
  ),

  getSceneCount: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.currentScenario],
    (scenario) => scenario?.scenes.length || 0
  ),

  getTotalDuration: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.currentScenario],
    (scenario) => scenario?.totalDuration || 0
  ),

  getHasValidationErrors: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.validationResult],
    (validationResult) => validationResult ? !validationResult.isValid : false
  ),

  getValidationErrors: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.validationResult],
    (validationResult) => validationResult?.errors || []
  ),

  getValidationWarnings: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.validationResult],
    (validationResult) => validationResult?.warnings || []
  ),

  getCanSave: createSelector(
    [(state: { scenario: ScenarioState }) => state.scenario.editorState,
     (state: { scenario: ScenarioState }) => state.scenario.validationResult,
     (state: { scenario: ScenarioState }) => state.scenario.isSaving],
    (editorState, validationResult, isSaving) => {
      return editorState.hasUnsavedChanges && 
             !isSaving && 
             (!validationResult || validationResult.isValid)
    }
  )
}

// === Default Export ===
export default scenarioSlice.reducer
