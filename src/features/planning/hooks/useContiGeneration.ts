/**
 * useContiGeneration Hook
 *
 * ByteDance API를 사용한 콘티 이미지 생성 기능
 * CLAUDE.md 준수: 비용 안전, 병렬 처리, $300 사건 방지
 */

import { useState, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'

import type {
  ShotSequence,
  ContiGenerationRequest,
  ContiGenerationResponse,
  ContiStyle,
} from '../../../entities/planning'

import { planningActions } from '../store/planning-slice'
import { byteDanceClient } from '../../../shared/lib/bytedance-client'
import logger from '../../../shared/lib/logger'

/**
 * 콘티 생성 상태
 */
export interface UseContiGenerationState {
  isGenerating: boolean
  progress: number // 0-100
  currentBatch: number
  totalBatches: number
  completedShots: string[] // 완료된 숏 ID 목록
  failedShots: string[] // 실패한 숏 ID 목록
  lastResults: ContiGenerationResponse[]
  error: string | null
}

/**
 * Hook 옵션
 */
export interface UseContiGenerationOptions {
  batchSize?: number // 병렬 처리 배치 크기
  maxRetries?: number
  retryDelay?: number // ms
  onProgress?: (progress: number, completed: number, total: number) => void
  onBatchComplete?: (batchResults: ContiGenerationResponse[]) => void
  onSuccess?: (results: ContiGenerationResponse[]) => void
  onError?: (error: string) => void
}

/**
 * 콘티 이미지 생성 Hook
 */
export function useContiGeneration(options: UseContiGenerationOptions = {}) {
  const {
    batchSize = 3, // 동시에 3개씩 처리
    maxRetries = 2,
    retryDelay = 1000,
    onProgress,
    onBatchComplete,
    onSuccess,
    onError,
  } = options

  const dispatch = useDispatch()

  // 내부 상태
  const [state, setState] = useState<UseContiGenerationState>({
    isGenerating: false,
    progress: 0,
    currentBatch: 0,
    totalBatches: 0,
    completedShots: [],
    failedShots: [],
    lastResults: [],
    error: null,
  })

  // 취소를 위한 AbortController
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeRequestsRef = useRef<Set<string>>(new Set())

  /**
   * 상태 업데이트 헬퍼
   */
  const updateState = useCallback((updates: Partial<UseContiGenerationState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates }

      // 진행률 알림
      if (onProgress && updates.progress !== undefined) {
        onProgress(
          newState.progress,
          newState.completedShots.length,
          newState.completedShots.length + newState.failedShots.length
        )
      }

      return newState
    })
  }, [onProgress])

  /**
   * 단일 숏 콘티 생성
   */
  const generateSingleConti = useCallback(async (
    shot: ShotSequence,
    projectContext?: any
  ): Promise<ContiGenerationResponse | null> => {
    // 이미 처리 중인 숏인지 확인 - $300 사건 방지
    if (activeRequestsRef.current.has(shot.id)) {
      logger.warn('이미 처리 중인 숏입니다.', { shotId: shot.id })
      return null
    }

    try {
      activeRequestsRef.current.add(shot.id)

      const request: ContiGenerationRequest = {
        shotSequence: shot,
        style: shot.contiStyle,
        projectContext,
      }

      dispatch(planningActions.setLoading(true))

      const result = await byteDanceClient.generateImage({
        prompt: buildContiPrompt(shot),
        style: shot.contiStyle,
        aspectRatio: '16:9',
        seed: generateSeed(shot),
      })

      const response: ContiGenerationResponse = {
        imageUrl: result.imageUrl,
        style: shot.contiStyle,
        prompt: result.prompt,
        seed: result.seed,
        generatedAt: new Date(),
        provider: 'bytedance',
      }

      // 숏에 이미지 URL 업데이트
      dispatch(planningActions.updateShotContiImage({
        shotId: shot.id,
        imageUrl: result.imageUrl,
      }))

      logger.info('콘티 생성 성공', {
        shotId: shot.id,
        shotTitle: shot.title,
        style: shot.contiStyle,
      })

      // 비용 로그
      logger.logCostEvent('bytedance_conti_generation', 0.05, {
        shotId: shot.id,
        style: shot.contiStyle,
      })

      return response

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '콘티 생성 실패'

      logger.error('콘티 생성 오류', {
        shotId: shot.id,
        shotTitle: shot.title,
        error: errorMessage,
      })

      throw error

    } finally {
      activeRequestsRef.current.delete(shot.id)
      dispatch(planningActions.setLoading(false))
    }
  }, [dispatch])

  /**
   * 배치 콘티 생성 (병렬 처리)
   */
  const generateBatchConti = useCallback(async (
    shots: ShotSequence[],
    projectContext?: any
  ): Promise<ContiGenerationResponse[]> => {
    if (state.isGenerating) {
      logger.warn('이미 콘티 생성이 진행 중입니다.')
      return []
    }

    // AbortController 설정
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const totalShots = shots.length
      const batches = Math.ceil(totalShots / batchSize)

      // 초기 상태 설정
      updateState({
        isGenerating: true,
        progress: 0,
        currentBatch: 0,
        totalBatches: batches,
        completedShots: [],
        failedShots: [],
        lastResults: [],
        error: null,
      })

      const allResults: ContiGenerationResponse[] = []
      const completed: string[] = []
      const failed: string[] = []

      // 배치별 처리
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        if (signal.aborted) break

        const batchStart = batchIndex * batchSize
        const batchEnd = Math.min(batchStart + batchSize, totalShots)
        const batchShots = shots.slice(batchStart, batchEnd)

        logger.info(`콘티 생성 배치 ${batchIndex + 1}/${batches} 시작`, {
          batchSize: batchShots.length,
          shotIds: batchShots.map(s => s.id),
        })

        // 배치 내 병렬 처리
        const batchPromises = batchShots.map(async (shot) => {
          let retries = 0

          while (retries <= maxRetries) {
            try {
              const result = await generateSingleConti(shot, projectContext)
              if (result) {
                completed.push(shot.id)
                return result
              }
            } catch (error) {
              retries++
              if (retries <= maxRetries) {
                logger.warn(`콘티 생성 재시도 ${retries}/${maxRetries}`, {
                  shotId: shot.id,
                  error: error instanceof Error ? error.message : String(error),
                })
                await new Promise(resolve => setTimeout(resolve, retryDelay))
              } else {
                failed.push(shot.id)
                logger.error(`콘티 생성 최종 실패`, {
                  shotId: shot.id,
                  retries,
                })
              }
            }
          }

          return null
        })

        // 배치 완료 대기
        const batchResults = await Promise.allSettled(batchPromises)
        const successResults = batchResults
          .filter((result): result is PromiseFulfilledResult<ContiGenerationResponse> =>
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value)

        allResults.push(...successResults)

        // 진행률 업데이트
        const progress = Math.round(((batchIndex + 1) / batches) * 100)
        updateState({
          progress,
          currentBatch: batchIndex + 1,
          completedShots: [...completed],
          failedShots: [...failed],
          lastResults: allResults,
        })

        onBatchComplete?.(successResults)

        // 다음 배치 전 잠시 대기 (API 레이트 리미트 고려)
        if (batchIndex < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // 완료 처리
      updateState({
        isGenerating: false,
        progress: 100,
      })

      onSuccess?.(allResults)

      logger.info('배치 콘티 생성 완료', {
        totalShots,
        completed: completed.length,
        failed: failed.length,
        batches,
      })

      return allResults

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '배치 콘티 생성 실패'

      updateState({
        isGenerating: false,
        error: errorMessage,
      })

      onError?.(errorMessage)

      logger.error('배치 콘티 생성 오류', {
        error: errorMessage,
        totalShots: shots.length,
      })

      return []

    } finally {
      abortControllerRef.current = null
      activeRequestsRef.current.clear()
    }
  }, [state.isGenerating, batchSize, maxRetries, retryDelay, generateSingleConti, updateState, onBatchComplete, onSuccess, onError])

  /**
   * 콘티 재생성
   */
  const regenerateConti = useCallback(async (
    shot: ShotSequence,
    newStyle?: ContiStyle,
    projectContext?: any
  ): Promise<ContiGenerationResponse | null> => {
    const updatedShot = newStyle ? { ...shot, contiStyle: newStyle } : shot

    try {
      const result = await generateSingleConti(updatedShot, projectContext)

      if (result && newStyle) {
        // 스타일 변경도 반영
        dispatch(planningActions.updateShotStyle({
          shotId: shot.id,
          style: newStyle,
        }))
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '콘티 재생성 실패'
      onError?.(errorMessage)
      return null
    }
  }, [generateSingleConti, dispatch, onError])

  /**
   * 실패한 콘티 재시도
   */
  const retryFailedConti = useCallback(async (
    shots: ShotSequence[],
    projectContext?: any
  ): Promise<ContiGenerationResponse[]> => {
    const failedShotIds = new Set(state.failedShots)
    const failedShots = shots.filter(shot => failedShotIds.has(shot.id))

    if (failedShots.length === 0) {
      logger.info('재시도할 실패한 콘티가 없습니다.')
      return []
    }

    logger.info('실패한 콘티 재시도 시작', {
      failedCount: failedShots.length,
      shotIds: failedShots.map(s => s.id),
    })

    return generateBatchConti(failedShots, projectContext)
  }, [state.failedShots, generateBatchConti])

  /**
   * 생성 취소
   */
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 진행 중인 요청들 정리
    activeRequestsRef.current.clear()

    updateState({
      isGenerating: false,
      progress: 0,
      currentBatch: 0,
      error: null,
    })

    dispatch(planningActions.setLoading(false))

    logger.info('콘티 생성이 취소되었습니다.')
  }, [updateState, dispatch])

  /**
   * 에러 클리어
   */
  const clearError = useCallback(() => {
    updateState({ error: null })
  }, [updateState])

  /**
   * 상태 리셋
   */
  const reset = useCallback(() => {
    if (state.isGenerating) {
      cancelGeneration()
    }

    setState({
      isGenerating: false,
      progress: 0,
      currentBatch: 0,
      totalBatches: 0,
      completedShots: [],
      failedShots: [],
      lastResults: [],
      error: null,
    })
  }, [state.isGenerating, cancelGeneration])

  return {
    // 상태
    state,
    isGenerating: state.isGenerating,
    progress: state.progress,
    currentBatch: state.currentBatch,
    totalBatches: state.totalBatches,
    completedShots: state.completedShots,
    failedShots: state.failedShots,
    lastResults: state.lastResults,
    error: state.error,

    // 액션
    generateSingleConti,
    generateBatchConti,
    regenerateConti,
    retryFailedConti,
    cancelGeneration,
    clearError,
    reset,

    // 유틸리티
    hasFailedShots: state.failedShots.length > 0,
    successRate: state.completedShots.length / (state.completedShots.length + state.failedShots.length) || 0,
  }
}

/**
 * 콘티 프롬프트 빌더
 */
function buildContiPrompt(shot: ShotSequence): string {
  const {
    title,
    description,
    contiDescription,
    shotType,
    cameraMovement,
    location,
    characters,
    visualElements,
  } = shot

  let prompt = `영상 콘티: ${title}\n`
  prompt += `설명: ${description}\n`
  prompt += `콘티 요구사항: ${contiDescription}\n`

  if (shotType) {
    const shotTypeKorean = {
      'close_up': '클로즈업',
      'medium': '미디엄 샷',
      'wide': '와이드 샷',
      'extreme_wide': '익스트림 와이드',
    }
    prompt += `샷 타입: ${shotTypeKorean[shotType]}\n`
  }

  if (cameraMovement && cameraMovement !== 'static') {
    const movementKorean = {
      'pan': '팬',
      'tilt': '틸트',
      'zoom': '줌',
      'dolly': '달리',
    }
    prompt += `카메라 움직임: ${movementKorean[cameraMovement]}\n`
  }

  if (location) {
    prompt += `장소: ${location}\n`
  }

  if (characters && characters.length > 0) {
    prompt += `등장인물: ${characters.join(', ')}\n`
  }

  if (visualElements && visualElements.length > 0) {
    prompt += `시각적 요소: ${visualElements.join(', ')}\n`
  }

  prompt += '\n콘티보드 스타일로 그려주세요. 명확하고 이해하기 쉽게 구성해주세요.'

  return prompt
}

/**
 * 재현 가능한 시드 생성
 */
function generateSeed(shot: ShotSequence): number {
  // 숏의 고유 정보를 바탕으로 일관된 시드 생성
  const seedString = `${shot.id}_${shot.title}_${shot.contiStyle}`

  let hash = 0
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }

  return Math.abs(hash)
}