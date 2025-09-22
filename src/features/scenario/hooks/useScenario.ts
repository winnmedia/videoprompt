/**
 * useScenario Hook
 *
 * 시나리오 기능의 통합 훅
 * CLAUDE.md 준수: React 19, FSD features 레이어
 */

import { useState, useCallback } from 'react'
import type { Scene } from '../../../entities/scenario'

export interface UseScenarioState {
  currentScenario: any | null
  scenes: Scene[]
  selectedSceneIds: string[]
  isLoading: boolean
  error: string | null
  editMode: 'view' | 'edit'
}

export interface UseScenarioActions {
  createScenario: (data: any) => Promise<void>
  updateScenes: (scenes: Scene[]) => void
  selectScene: (sceneId: string) => void
  toggleEditMode: () => void
  deleteScene: (sceneId: string) => void
  reorderScenes: (fromIndex: number, toIndex: number) => void
}

export type UseScenarioReturn = UseScenarioState & UseScenarioActions

/**
 * 시나리오 관리 훅
 */
export function useScenario(): UseScenarioReturn {
  // 상태 관리
  const [currentScenario, setCurrentScenario] = useState<any | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<'view' | 'edit'>('view')

  // 시나리오 생성
  const createScenario = useCallback(async (data: any) => {
    setIsLoading(true)
    setError(null)

    try {
      // TODO: 실제 API 호출 구현
      console.log('Creating scenario with data:', data)

      // 임시 더미 데이터
      const dummyScenario = {
        id: Date.now().toString(),
        title: data.title || '새 시나리오',
        ...data
      }

      setCurrentScenario(dummyScenario)

      // 임시 더미 씬들
      const dummyScenes: Scene[] = [
        {
          id: '1',
          order: 1,
          type: 'dialogue',
          title: '오프닝',
          description: '시나리오 시작 장면',
          duration: 30,
          location: '스튜디오',
          characters: ['호스트'],
          dialogue: '안녕하세요, 오늘의 주제는...',
          actionDescription: '카메라를 향해 인사',
          notes: '밝은 톤으로 시작'
        },
        {
          id: '2',
          order: 2,
          type: 'action',
          title: '메인 컨텐츠',
          description: '주요 내용 전달',
          duration: 120,
          location: '스튜디오',
          characters: ['호스트'],
          dialogue: '',
          actionDescription: '프레젠테이션 진행',
          notes: '핵심 포인트 강조'
        }
      ]

      setScenes(dummyScenes)
    } catch (err) {
      setError(err instanceof Error ? err.message : '시나리오 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 씬 업데이트
  const updateScenes = useCallback((newScenes: Scene[]) => {
    setScenes(newScenes)
  }, [])

  // 씬 선택
  const selectScene = useCallback((sceneId: string) => {
    setSelectedSceneIds(prev =>
      prev.includes(sceneId)
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    )
  }, [])

  // 편집 모드 토글
  const toggleEditMode = useCallback(() => {
    setEditMode(prev => prev === 'view' ? 'edit' : 'view')
  }, [])

  // 씬 삭제
  const deleteScene = useCallback((sceneId: string) => {
    setScenes(prev => prev.filter(scene => scene.id !== sceneId))
    setSelectedSceneIds(prev => prev.filter(id => id !== sceneId))
  }, [])

  // 씬 재정렬
  const reorderScenes = useCallback((fromIndex: number, toIndex: number) => {
    setScenes(prev => {
      const newScenes = [...prev]
      const [movedScene] = newScenes.splice(fromIndex, 1)
      newScenes.splice(toIndex, 0, movedScene)

      // order 속성 업데이트
      return newScenes.map((scene, index) => ({
        ...scene,
        order: index + 1
      }))
    })
  }, [])

  return {
    // State
    currentScenario,
    scenes,
    selectedSceneIds,
    isLoading,
    error,
    editMode,

    // Actions
    createScenario,
    updateScenes,
    selectScene,
    toggleEditMode,
    deleteScene,
    reorderScenes
  }
}