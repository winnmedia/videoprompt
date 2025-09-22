/**
 * 시나리오-스토리보드 통합 관리 훅
 *
 * CLAUDE.md 준수:
 * - FSD shared 레이어, 전역 클라이언트 상태 관리
 * - $300 사건 방지: 비용 안전 규칙 엄격 적용
 * - useEffect 의존성 배열에 함수 절대 금지
 */

import { useCallback, useMemo, useRef } from 'react'
// Note: This shared hook should not use app-specific stores directly
// Moving to features layer would be more appropriate
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../../app/store'
import { scenarioSelectors, scenarioActions } from '../../entities/scenario/store'
import { storyboardSelectors, storyboardActions } from '../../entities/storyboard/store'
import type { Scenario, Scene } from '../../entities/scenario/types'
import type {
  Storyboard,
  StoryboardFrame,
  FrameGenerationRequest,
  ConsistencyReference,
  BatchGenerationRequest
} from '../../entities/storyboard/types'
import logger from '../lib/logger'

/**
 * 시나리오-스토리보드 동기화 옵션
 */
interface SyncOptions {
  autoCreateStoryboard: boolean
  preserveExistingFrames: boolean
  enableConsistencyTracking: boolean
  batchSize: number
}

/**
 * 기본 동기화 옵션
 */
const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  autoCreateStoryboard: true,
  preserveExistingFrames: true,
  enableConsistencyTracking: true,
  batchSize: 3, // 비용 안전: 동시 생성 제한
}

/**
 * 시나리오-스토리보드 통합 상태
 */
interface IntegrationState {
  isLinked: boolean
  syncStatus: 'idle' | 'syncing' | 'generating' | 'completed' | 'error'
  lastSyncAt: Date | null
  frameMapping: Record<string, string> // sceneId -> frameId
  consistency: {
    hasReference: boolean
    referenceImageUrl: string | null
    activeRefs: ConsistencyReference[]
  }
}

/**
 * 시나리오-스토리보드 통합 관리 훅
 */
export function useScenarioStoryboardIntegration(options: Partial<SyncOptions> = {}) {
  const dispatch = useDispatch<AppDispatch>()

  // $300 사건 방지: 참조로 객체 고정
  const syncOptionsRef = useRef({ ...DEFAULT_SYNC_OPTIONS, ...options })
  const lastSyncTimestampRef = useRef<number>(0)

  // Redux 상태 선택
  const currentScenario = useSelector((state: RootState) => scenarioSelectors.getCurrentScenario(state))
  const currentStoryboard = useSelector((state: RootState) => storyboardSelectors.getCurrentStoryboard(state))
  const scenarioScenes = currentScenario?.scenes || []
  const storyboardFrames = currentStoryboard?.frames || []

  // 비용 안전: 1분 내 중복 동기화 방지
  const canSync = useMemo(() => {
    const now = Date.now()
    return now - lastSyncTimestampRef.current > 60000 // 60초
  }, [])

  /**
   * 통합 상태 계산
   */
  const integrationState = useMemo((): IntegrationState => {
    const isLinked = !!(currentScenario && currentStoryboard &&
                       currentStoryboard.metadata.scenarioId === currentScenario.metadata.id)

    // 씬-프레임 매핑 생성
    const frameMapping: Record<string, string> = {}
    storyboardFrames.forEach(frame => {
      frameMapping[frame.metadata.sceneId] = frame.metadata.id
    })

    // 일관성 참조 상태
    const activeRefs = currentStoryboard?.settings.globalConsistencyRefs.filter(ref => ref.isActive) || []
    const hasReference = activeRefs.length > 0
    const referenceImageUrl = activeRefs.find(ref => ref.type === 'style')?.referenceImageUrl || null

    return {
      isLinked,
      syncStatus: 'idle', // 기본값, 실제 상태는 Redux에서 관리
      lastSyncAt: null,
      frameMapping,
      consistency: {
        hasReference,
        referenceImageUrl,
        activeRefs
      }
    }
  }, [currentScenario, currentStoryboard, storyboardFrames])

  /**
   * 시나리오에서 스토리보드 생성
   */
  const createStoryboardFromScenario = useCallback(async (scenario: Scenario) => {
    if (!canSync) {
      logger.warn('동기화 제한: 1분 내 중복 요청 차단')
      return
    }

    try {
      lastSyncTimestampRef.current = Date.now()

      dispatch(storyboardActions.setLoading(true))

      // 스토리보드 메타데이터 생성
      const storyboardMetadata = {
        id: `storyboard_${scenario.metadata.id}_${Date.now()}`,
        scenarioId: scenario.metadata.id,
        title: `${scenario.metadata.title} - 스토리보드`,
        description: `${scenario.metadata.title}의 자동 생성된 스토리보드`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft' as const,
        userId: scenario.metadata.userId,
        version: 1
      }

      // 기본 설정
      const defaultSettings = {
        defaultConfig: {
          model: 'dall-e-3' as const,
          aspectRatio: '16:9' as const,
          quality: 'hd' as const,
          style: 'cinematic' as const
        },
        globalConsistencyRefs: [],
        autoGeneration: syncOptionsRef.current.enableConsistencyTracking,
        qualityThreshold: 0.8,
        maxRetries: 3,
        batchSize: syncOptionsRef.current.batchSize
      }

      // 씬에서 프레임 생성
      const frames: StoryboardFrame[] = scenario.scenes.map((scene, index) => ({
        metadata: {
          id: `frame_${scene.id}_${Date.now()}`,
          sceneId: scene.id,
          order: scene.order || index,
          title: scene.title,
          description: scene.description,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'pending' as const,
          userId: scenario.metadata.userId
        },
        prompt: {
          basePrompt: scene.description,
          enhancedPrompt: scene.description, // 향후 AI 향상 적용
          styleModifiers: [],
          technicalSpecs: []
        },
        config: defaultSettings.defaultConfig,
        consistencyRefs: [],
        attempts: []
      }))

      // 새 스토리보드 생성
      const newStoryboard: Storyboard = {
        metadata: storyboardMetadata,
        frames,
        settings: defaultSettings
      }

      // Redux 상태 업데이트
      dispatch(storyboardActions.setCurrentStoryboard(newStoryboard))
      dispatch(storyboardActions.addToStoryboardList(newStoryboard))

      // 시나리오의 씬에도 스토리보드 이미지 URL 연결 준비
      scenario.scenes.forEach((scene, index) => {
        if (frames[index]) {
          dispatch(scenarioActions.updateScene({
            sceneId: scene.id,
            updates: { storyboardImageUrl: undefined } // 생성 후 업데이트 예정
          }))
        }
      })

      logger.info('스토리보드 생성 완료', {
        scenarioId: scenario.metadata.id,
        frameCount: frames.length,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      dispatch(storyboardActions.setError(`스토리보드 생성 실패: ${errorMessage}`))
      logger.error('스토리보드 생성 실패', { error: errorMessage })
    } finally {
      dispatch(storyboardActions.setLoading(false))
    }
  }, [dispatch, canSync])

  /**
   * 씬 변경 시 스토리보드 동기화
   */
  const syncSceneChanges = useCallback((updatedScenes: Scene[]) => {
    if (!currentStoryboard || !canSync) return

    try {
      lastSyncTimestampRef.current = Date.now()

      const currentFrames = [...currentStoryboard.frames]
      const preserveExisting = syncOptionsRef.current.preserveExistingFrames

      // 새로운 씬에 대한 프레임 생성
      const newFrames: StoryboardFrame[] = []

      updatedScenes.forEach((scene, index) => {
        const existingFrame = currentFrames.find(f => f.metadata.sceneId === scene.id)

        if (existingFrame) {
          // 기존 프레임 업데이트
          if (!preserveExisting || existingFrame.metadata.status === 'pending') {
            dispatch(storyboardActions.updateFrame({
              frameId: existingFrame.metadata.id,
              updates: {
                metadata: {
                  ...existingFrame.metadata,
                  title: scene.title,
                  description: scene.description,
                  order: scene.order || index,
                  updatedAt: new Date()
                },
                prompt: {
                  ...existingFrame.prompt,
                  basePrompt: scene.description,
                  enhancedPrompt: scene.description
                }
              }
            }))
          }
        } else {
          // 새 프레임 생성
          const newFrame: StoryboardFrame = {
            metadata: {
              id: `frame_${scene.id}_${Date.now()}`,
              sceneId: scene.id,
              order: scene.order || index,
              title: scene.title,
              description: scene.description,
              createdAt: new Date(),
              updatedAt: new Date(),
              status: 'pending',
              userId: currentStoryboard.metadata.userId
            },
            prompt: {
              basePrompt: scene.description,
              enhancedPrompt: scene.description,
              styleModifiers: [],
              technicalSpecs: []
            },
            config: currentStoryboard.settings.defaultConfig,
            consistencyRefs: [...currentStoryboard.settings.globalConsistencyRefs],
            attempts: []
          }

          newFrames.push(newFrame)
        }
      })

      // 새 프레임들 추가
      newFrames.forEach(frame => {
        dispatch(storyboardActions.addFrame(frame))
      })

      // 삭제된 씬에 해당하는 프레임 제거 (옵션에 따라)
      const sceneIds = new Set(updatedScenes.map(s => s.id))
      const framesToRemove = currentFrames.filter(f => !sceneIds.has(f.metadata.sceneId))

      if (!preserveExisting) {
        framesToRemove.forEach(frame => {
          dispatch(storyboardActions.removeFrame(frame.metadata.id))
        })
      }

      logger.info('씬 변경사항 동기화 완료', {
        newFrames: newFrames.length,
        removedFrames: preserveExisting ? 0 : framesToRemove.length
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '동기화 오류'
      logger.error('씬 동기화 실패', { error: errorMessage })
    }
  }, [currentStoryboard, dispatch, canSync])

  /**
   * 배치 이미지 생성 시작
   */
  const startBatchGeneration = useCallback(async () => {
    if (!currentStoryboard || !canSync) return

    try {
      lastSyncTimestampRef.current = Date.now()

      // 생성 대상 프레임 필터링
      const pendingFrames = currentStoryboard.frames.filter(
        frame => frame.metadata.status === 'pending' || frame.metadata.status === 'failed'
      )

      if (pendingFrames.length === 0) {
        logger.info('생성할 프레임이 없습니다')
        return
      }

      // 배치 요청 생성
      const batchRequest: BatchGenerationRequest = {
        frames: pendingFrames.map(frame => ({
          sceneId: frame.metadata.sceneId,
          sceneDescription: frame.prompt.basePrompt,
          config: frame.config,
          consistencyRefs: frame.consistencyRefs.map(ref => ref.id),
          priority: 'normal'
        })),
        batchSettings: {
          maxConcurrent: syncOptionsRef.current.batchSize,
          delayBetweenRequests: 2000, // 2초 지연 (비용 안전)
          stopOnError: false
        }
      }

      // 배치 생성 시작
      dispatch(storyboardActions.startBatchGeneration(batchRequest))

      logger.info('배치 이미지 생성 시작', {
        frameCount: pendingFrames.length,
        batchSize: syncOptionsRef.current.batchSize
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '배치 생성 오류'
      dispatch(storyboardActions.setError(`배치 생성 실패: ${errorMessage}`))
      logger.error('배치 생성 실패', { error: errorMessage })
    }
  }, [currentStoryboard, dispatch, canSync])

  /**
   * 일관성 참조 추가
   */
  const addConsistencyReference = useCallback((
    type: ConsistencyReference['type'],
    name: string,
    description: string,
    imageUrl?: string
  ) => {
    if (!currentStoryboard) return

    const newReference: Omit<ConsistencyReference, 'id'> = {
      type,
      name,
      description,
      referenceImageUrl: imageUrl,
      keyFeatures: [],
      weight: 0.8,
      isActive: true
    }

    dispatch(storyboardActions.addConsistencyReference(newReference))

    logger.info('일관성 참조 추가', { type, name })
  }, [currentStoryboard, dispatch])

  return {
    // 상태
    integrationState,
    isLinked: integrationState.isLinked,
    canSync,

    // 액션
    createStoryboardFromScenario,
    syncSceneChanges,
    startBatchGeneration,
    addConsistencyReference,

    // 헬퍼
    getFrameForScene: useCallback((sceneId: string) => {
      return storyboardFrames.find(frame => frame.metadata.sceneId === sceneId)
    }, [storyboardFrames]),

    getSceneForFrame: useCallback((frameId: string) => {
      const frame = storyboardFrames.find(f => f.metadata.id === frameId)
      if (!frame) return null
      return scenarioScenes.find(scene => scene.id === frame.metadata.sceneId)
    }, [storyboardFrames, scenarioScenes])
  }
}