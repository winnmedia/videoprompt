/**
 * useSceneEditing Hook
 *
 * 씬 편집 기능을 위한 React Hook
 * CLAUDE.md 준수: FSD features 레이어, 단일 책임 원칙
 */

import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { Scene, ValidationResult } from '../../../entities/scenario'
import { scenarioActions, scenarioSelectors, ScenarioModel } from '../../../entities/scenario'
import { SceneSplitter, type SceneSplitOptions } from '../model/scene-splitter'
import logger from '../../../shared/lib/logger'

/**
 * 씬 편집 모드
 */
export type SceneEditMode = 'view' | 'edit' | 'split' | 'merge'

/**
 * Hook 상태
 */
export interface UseSceneEditingState {
  editMode: SceneEditMode
  selectedScenes: string[] // 다중 선택을 위한 ID 배열
  clipboard: Scene | null // 복사된 씬
  isProcessing: boolean
  validationResults: Map<string, ValidationResult> // 씬별 검증 결과
  undoStack: Scene[][] // 실행 취소를 위한 스택
  redoStack: Scene[][]
  hasUnsavedChanges: boolean
}

/**
 * Hook 옵션
 */
export interface UseSceneEditingOptions {
  enableUndo?: boolean
  maxUndoSteps?: number
  autoValidate?: boolean
  enableMultiSelect?: boolean
  onSceneChange?: (sceneId: string, scene: Scene) => void
  onValidationChange?: (sceneId: string, result: ValidationResult) => void
}

/**
 * 씬 편집 Hook
 */
export function useSceneEditing(options: UseSceneEditingOptions = {}) {
  const {
    enableUndo = true,
    maxUndoSteps = 20,
    autoValidate = true,
    enableMultiSelect = true,
    onSceneChange,
    onValidationChange
  } = options

  const dispatch = useDispatch()
  const currentScenario = useSelector(scenarioSelectors.getCurrentScenario)
  const selectedSceneId = useSelector(scenarioSelectors.getSelectedSceneId)
  const editorState = useSelector(scenarioSelectors.getEditorState)
  
  // 내부 상태
  const [state, setState] = useState<UseSceneEditingState>({
    editMode: 'view',
    selectedScenes: [],
    clipboard: null,
    isProcessing: false,
    validationResults: new Map(),
    undoStack: [],
    redoStack: [],
    hasUnsavedChanges: false
  })

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<UseSceneEditingState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Undo/Redo를 위한 스냅샷 저장
   */
  const saveSnapshot = useCallback(() => {
    if (!enableUndo || !currentScenario) return

    setState(prev => {
      const newUndoStack = [...prev.undoStack, currentScenario.scenes]
      if (newUndoStack.length > maxUndoSteps) {
        newUndoStack.shift()
      }
      
      return {
        ...prev,
        undoStack: newUndoStack,
        redoStack: [] // 새 작업 시 redo 스택 클리어
      }
    })
  }, [enableUndo, currentScenario, maxUndoSteps])

  /**
   * 씬 검증
   */
  const validateScene = useCallback((scene: Scene) => {
    if (!autoValidate) return

    // 개별 씬 검증 로직 (간단한 버전)
    const errors = []
    if (!scene.title.trim()) {
      errors.push({ code: 'TITLE_REQUIRED', message: '씬 제목이 필요합니다.' })
    }
    if (!scene.description.trim()) {
      errors.push({ code: 'DESCRIPTION_REQUIRED', message: '씬 설명이 필요합니다.' })
    }
    if (scene.duration && scene.duration <= 0) {
      errors.push({ code: 'INVALID_DURATION', message: '지속시간이 잘못되었습니다.' })
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors
    }

    setState(prev => ({
      ...prev,
      validationResults: new Map(prev.validationResults.set(scene.id, result))
    }))

    onValidationChange?.(scene.id, result)
  }, [autoValidate, onValidationChange])

  /**
   * 씬 업데이트
   */
  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    if (!currentScenario) return

    saveSnapshot()
    dispatch(scenarioActions.updateScene({ sceneId, updates }))
    
    // 업데이트된 씬 검증
    const updatedScene = currentScenario.scenes.find(s => s.id === sceneId)
    if (updatedScene) {
      const finalScene = { ...updatedScene, ...updates }
      validateScene(finalScene)
      onSceneChange?.(sceneId, finalScene)
    }

    updateState({ hasUnsavedChanges: true })
    
    logger.debug('씬 업데이트', { sceneId, updates })
  }, [currentScenario, dispatch, saveSnapshot, validateScene, onSceneChange, updateState])

  /**
   * 새 씬 추가
   */
  const addScene = useCallback((sceneData?: Partial<Omit<Scene, 'id' | 'order'>>) => {
    if (!currentScenario) return

    saveSnapshot()
    
    const newScene: Omit<Scene, 'id' | 'order'> = {
      type: 'dialogue',
      title: `새 씬 ${currentScenario.scenes.length + 1}`,
      description: '',
      duration: 30,
      location: '',
      characters: [],
      visualElements: [],
      ...sceneData
    }

    dispatch(scenarioActions.addScene(newScene))
    updateState({ hasUnsavedChanges: true })
    
    logger.info('새 씬 추가', { title: newScene.title })
  }, [currentScenario, dispatch, saveSnapshot, updateState])

  /**
   * 씬 삭제
   */
  const removeScene = useCallback((sceneId: string) => {
    if (!currentScenario) return

    saveSnapshot()
    dispatch(scenarioActions.removeScene(sceneId))
    
    // 선택된 씬에서 제거
    setState(prev => ({
      ...prev,
      selectedScenes: prev.selectedScenes.filter(id => id !== sceneId),
      validationResults: new Map([...prev.validationResults].filter(([id]) => id !== sceneId)),
      hasUnsavedChanges: true
    }))
    
    logger.info('씬 삭제', { sceneId })
  }, [currentScenario, dispatch, saveSnapshot])

  /**
   * 씬 복사
   */
  const copyScene = useCallback((sceneId: string) => {
    if (!currentScenario) return

    const scene = currentScenario.scenes.find(s => s.id === sceneId)
    if (scene) {
      updateState({ clipboard: scene })
      logger.debug('씬 복사', { sceneId, title: scene.title })
    }
  }, [currentScenario, updateState])

  /**
   * 씬 붙여넣기
   */
  const pasteScene = useCallback((insertAfterSceneId?: string) => {
    if (!state.clipboard || !currentScenario) return

    saveSnapshot()
    
    const newScene = {
      ...state.clipboard,
      title: `${state.clipboard.title} (복사본)`
    }
    
    // ID와 order는 addScene에서 자동 처리됨
    const { id, order, ...sceneData } = newScene
    dispatch(scenarioActions.addScene(sceneData))
    
    updateState({ hasUnsavedChanges: true })
    logger.info('씬 붙여넣기', { originalTitle: state.clipboard.title })
  }, [state.clipboard, currentScenario, dispatch, saveSnapshot, updateState])

  /**
   * 씬 순서 변경
   */
  const reorderScenes = useCallback((sceneIds: string[]) => {
    if (!currentScenario) return

    saveSnapshot()
    dispatch(scenarioActions.reorderScenes(sceneIds))
    updateState({ hasUnsavedChanges: true })
    
    logger.info('씬 순서 변경', { newOrder: sceneIds })
  }, [currentScenario, dispatch, saveSnapshot, updateState])

  /**
   * 스토리 재분할
   */
  const resplitStory = useCallback(async (
    newSceneCount: number,
    options: SceneSplitOptions = {}
  ) => {
    if (!currentScenario) return

    try {
      updateState({ isProcessing: true })
      saveSnapshot()
      
      const result = await SceneSplitter.resplitScenario(
        currentScenario,
        newSceneCount,
        options
      )

      if (result.success) {
        dispatch(scenarioActions.updateCurrentScenario({
          scenes: result.scenes
        }))
        
        updateState({ hasUnsavedChanges: true })
        
        logger.info('스토리 재분할 성공', {
          originalSceneCount: currentScenario.scenes.length,
          newSceneCount: result.scenes.length
        })
      } else {
        throw new Error(result.error || '재분할에 실패했습니다.')
      }
    } catch (error) {
      logger.error('스토리 재분할 오류', {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      updateState({ isProcessing: false })
    }
  }, [currentScenario, dispatch, saveSnapshot, updateState])

  /**
   * Undo/Redo 기능
   */
  const undo = useCallback(() => {
    if (state.undoStack.length === 0 || !currentScenario) return

    const prevScenes = state.undoStack[state.undoStack.length - 1]
    
    setState(prev => ({
      ...prev,
      undoStack: prev.undoStack.slice(0, -1),
      redoStack: [...prev.redoStack, currentScenario.scenes]
    }))

    dispatch(scenarioActions.updateCurrentScenario({ scenes: prevScenes }))
    logger.debug('Undo 실행')
  }, [state.undoStack, currentScenario, dispatch])

  const redo = useCallback(() => {
    if (state.redoStack.length === 0) return

    const nextScenes = state.redoStack[state.redoStack.length - 1]
    
    setState(prev => ({
      ...prev,
      redoStack: prev.redoStack.slice(0, -1),
      undoStack: [...prev.undoStack, currentScenario?.scenes || []]
    }))

    dispatch(scenarioActions.updateCurrentScenario({ scenes: nextScenes }))
    logger.debug('Redo 실행')
  }, [state.redoStack, currentScenario, dispatch])

  /**
   * 다중 선택 관리
   */
  const toggleSceneSelection = useCallback((sceneId: string) => {
    if (!enableMultiSelect) return

    setState(prev => {
      const isSelected = prev.selectedScenes.includes(sceneId)
      return {
        ...prev,
        selectedScenes: isSelected
          ? prev.selectedScenes.filter(id => id !== sceneId)
          : [...prev.selectedScenes, sceneId]
      }
    })
  }, [enableMultiSelect])

  const clearSelection = useCallback(() => {
    updateState({ selectedScenes: [] })
  }, [updateState])

  const selectAllScenes = useCallback(() => {
    if (!currentScenario) return
    updateState({ selectedScenes: currentScenario.scenes.map(s => s.id) })
  }, [currentScenario, updateState])

  /**
   * 편집 모드 변경
   */
  const setEditMode = useCallback((mode: SceneEditMode) => {
    updateState({ editMode: mode })
    
    if (mode === 'view') {
      clearSelection()
    }
  }, [updateState, clearSelection])

  // $300 사건 방지: useEffect 의존성 배열에 함수 절대 금지
  // 선택된 씬 변경 시 상태 동기화
  useEffect(() => {
    if (selectedSceneId && !state.selectedScenes.includes(selectedSceneId)) {
      updateState({ selectedScenes: [selectedSceneId] })
    }
  }, [selectedSceneId]) // updateState, state.selectedScenes 제거로 무한 호출 방지

  return {
    // 상태
    editMode: state.editMode,
    selectedScenes: state.selectedScenes,
    clipboard: state.clipboard,
    isProcessing: state.isProcessing,
    validationResults: state.validationResults,
    hasUnsavedChanges: state.hasUnsavedChanges,
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    
    // 기본 씬 작업
    updateScene,
    addScene,
    removeScene,
    copyScene,
    pasteScene,
    reorderScenes,
    
    // 고급 기능
    resplitStory,
    undo,
    redo,
    
    // 선택 관리
    toggleSceneSelection,
    clearSelection,
    selectAllScenes,
    
    // 모드 관리
    setEditMode,
    
    // Redux 상태 (대리)
    currentScenario,
    selectedSceneId,
    editorState
  }
}

/**
 * 단일 씬 편집을 위한 간단한 Hook
 */
export function useSceneEditor(sceneId?: string) {
  const dispatch = useDispatch()
  const currentScenario = useSelector(scenarioSelectors.getCurrentScenario)
  const selectedSceneId = useSelector(scenarioSelectors.getSelectedSceneId)
  
  const targetSceneId = sceneId || selectedSceneId
  const scene = currentScenario?.scenes.find(s => s.id === targetSceneId)
  
  const updateScene = useCallback((updates: Partial<Scene>) => {
    if (targetSceneId) {
      dispatch(scenarioActions.updateScene({ sceneId: targetSceneId, updates }))
    }
  }, [targetSceneId, dispatch])
  
  const selectScene = useCallback(() => {
    if (targetSceneId) {
      dispatch(scenarioActions.setSelectedScene(targetSceneId))
    }
  }, [targetSceneId, dispatch])
  
  return {
    scene,
    isSelected: targetSceneId === selectedSceneId,
    updateScene,
    selectScene
  }
}
