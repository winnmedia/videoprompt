/**
 * Storyboard Generation Hook
 *
 * 스토리보드 이미지 생성을 위한 React 훅
 * CLAUDE.md 준수: FSD features 레이어, Redux 통합, 비용 안전 규칙
 */

import { useCallback, useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import {
  storyboardActions,
  storyboardSelectors,
  type StoryboardFrame,
  type FrameGenerationRequest,
  type BatchGenerationRequest
} from '../../../entities/storyboard'
import { ImageGenerationEngine, type ImageGenerationAPIClient } from '../model/image-generator'
import { ConsistencyManager, type ConsistencyExtractor } from '../model/consistency-manager'
import logger from '../../../shared/lib/logger'

/**
 * 훅 옵션
 */
export interface UseStoryboardGenerationOptions {
  apiClient: ImageGenerationAPIClient
  consistencyExtractor: ConsistencyExtractor
  autoSave?: boolean
  onGenerationComplete?: (frameId: string) => void
  onGenerationError?: (frameId: string, error: Error) => void
  onBatchComplete?: () => void
}

/**
 * 스토리보드 생성 훅 반환값
 */
export interface UseStoryboardGenerationReturn {
  // 상태
  isGenerating: boolean
  isLoading: boolean
  currentStoryboard: any
  selectedFrame: StoryboardFrame | null
  batchGeneration: any
  error: string | null

  // 단일 프레임 생성
  generateSingleFrame: (frameId: string) => Promise<void>

  // 배치 생성
  generateAllPendingFrames: () => Promise<void>
  generateSelectedFrames: (frameIds: string[]) => Promise<void>
  generateSequentialBatch: (frameIds: string[]) => Promise<void>

  // 생성 제어
  cancelGeneration: () => void
  retryFailedFrame: (frameId: string) => Promise<void>

  // 일관성 관리
  extractConsistencyFromFrame: (frameId: string) => Promise<void>
  calculateConsistencyScore: () => Promise<void>
  applyConsistencyToFrame: (frameId: string, referenceFrameId: string) => Promise<void>

  // 유틸리티
  clearError: () => void
  refreshFrame: (frameId: string) => void
}

/**
 * 스토리보드 생성 훅
 *
 * 비용 안전 규칙:
 * - 중복 API 호출 방지
 * - 자동 재시도 제한
 * - 진행 상태 추적
 */
export function useStoryboardGeneration(
  options: UseStoryboardGenerationOptions
): UseStoryboardGenerationReturn {
  const dispatch = useAppDispatch()

  // Redux 상태 선택
  const isGenerating = useAppSelector(storyboardSelectors.getIsGenerating)
  const isLoading = useAppSelector(storyboardSelectors.getIsLoading)
  const currentStoryboard = useAppSelector(storyboardSelectors.getCurrentStoryboard)
  const selectedFrame = useAppSelector(storyboardSelectors.getSelectedFrame)
  const batchGeneration = useAppSelector(storyboardSelectors.getBatchGeneration)
  const error = useAppSelector(storyboardSelectors.getError)

  // 생성 엔진 및 일관성 관리자
  const engineRef = useRef<ImageGenerationEngine>()
  const consistencyManagerRef = useRef<ConsistencyManager>()
  const generatingFramesRef = useRef<Set<string>>(new Set())

  // 초기화
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new ImageGenerationEngine(options.apiClient)
    }
    if (!consistencyManagerRef.current) {
      consistencyManagerRef.current = new ConsistencyManager(options.consistencyExtractor)
    }
  }, [options.apiClient, options.consistencyExtractor])

  /**
   * 단일 프레임 생성
   */
  const generateSingleFrame = useCallback(async (frameId: string): Promise<void> => {
    if (!currentStoryboard || !engineRef.current) {
      throw new Error('스토리보드가 로드되지 않았습니다')
    }

    // 중복 호출 방지 (비용 안전)
    if (generatingFramesRef.current.has(frameId)) {
      logger.warn('이미 생성 중인 프레임입니다', { frameId })
      return
    }

    const frame = currentStoryboard.frames.find(f => f.metadata.id === frameId)
    if (!frame) {
      throw new Error('프레임을 찾을 수 없습니다')
    }

    if (frame.metadata.status === 'generating') {
      logger.warn('이미 생성 중인 프레임입니다', { frameId })
      return
    }

    try {
      generatingFramesRef.current.add(frameId)
      dispatch(storyboardActions.setGenerating(true))
      dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'generating' }))

      // 일관성 참조 수집
      const activeRefs = currentStoryboard.settings.globalConsistencyRefs.filter(ref => ref.isActive)

      // 참조 이미지 찾기 (이전 완성된 프레임)
      const referenceFrame = currentStoryboard.frames
        .filter(f => f.metadata.order < frame.metadata.order && f.metadata.status === 'completed')
        .sort((a, b) => b.metadata.order - a.metadata.order)[0]

      // 생성 요청 구성
      const request = {
        frameId,
        prompt: frame.prompt,
        config: frame.config,
        consistencyRefs: [...frame.consistencyRefs, ...activeRefs],
        referenceImageUrl: referenceFrame?.result?.imageUrl,
        retryAttempt: frame.attempts.length
      }

      // 생성 실행
      const result = await engineRef.current.generateSingleFrame(request, {
        onProgress: (frameId, progress, status) => {
          dispatch(storyboardActions.updateGenerationProgress({
            frameId,
            status: 'generating',
            progress,
            currentStep: status
          }))
        },
        onComplete: (frameId, result) => {
          dispatch(storyboardActions.addGenerationResult({ frameId, result }))
          dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'completed' }))

          // 자동 저장
          if (options.autoSave) {
            // TODO: 자동 저장 로직 호출
          }

          options.onGenerationComplete?.(frameId)
        },
        onError: (frameId, error) => {
          dispatch(storyboardActions.setFrameError({ frameId, error: error.message }))
          dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'failed' }))
          options.onGenerationError?.(frameId, error)
        }
      })

      logger.info('프레임 생성 완료', {
        frameId,
        processingTime: result.processingTime,
        cost: result.cost
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

      dispatch(storyboardActions.setFrameError({ frameId, error: errorMessage }))
      dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'failed' }))

      logger.error('프레임 생성 실패', { frameId, error: errorMessage })

      options.onGenerationError?.(frameId, error instanceof Error ? error : new Error(errorMessage))
      throw error

    } finally {
      generatingFramesRef.current.delete(frameId)

      // 다른 생성 중인 프레임이 없으면 생성 상태 해제
      if (generatingFramesRef.current.size === 0) {
        dispatch(storyboardActions.setGenerating(false))
      }
    }
  }, [currentStoryboard, dispatch, options])

  /**
   * 모든 대기 중인 프레임 생성
   */
  const generateAllPendingFrames = useCallback(async (): Promise<void> => {
    if (!currentStoryboard) return

    const pendingFrames = currentStoryboard.frames.filter(f =>
      f.metadata.status === 'pending' || f.metadata.status === 'failed'
    )

    if (pendingFrames.length === 0) {
      logger.info('생성할 프레임이 없습니다')
      return
    }

    const frameIds = pendingFrames.map(f => f.metadata.id)
    await generateSequentialBatch(frameIds)
  }, [currentStoryboard])

  /**
   * 선택된 프레임들 생성
   */
  const generateSelectedFrames = useCallback(async (frameIds: string[]): Promise<void> => {
    if (frameIds.length === 0) return

    // 병렬 생성 (빠르지만 일관성 보장 X)
    const promises = frameIds.map(frameId => generateSingleFrame(frameId))
    await Promise.allSettled(promises)
  }, [generateSingleFrame])

  /**
   * 순차적 배치 생성 (일관성 보장)
   */
  const generateSequentialBatch = useCallback(async (frameIds: string[]): Promise<void> => {
    if (!currentStoryboard || !engineRef.current || frameIds.length === 0) return

    try {
      dispatch(storyboardActions.setGenerating(true))

      // 배치 요청 생성
      const batchRequest: BatchGenerationRequest = {
        frames: frameIds.map(frameId => {
          const frame = currentStoryboard.frames.find(f => f.metadata.id === frameId)!
          return {
            sceneId: frame.metadata.sceneId,
            sceneDescription: frame.metadata.description,
            additionalPrompt: frame.prompt.basePrompt,
            config: frame.config,
            consistencyRefs: frame.consistencyRefs.map(ref => ref.id),
            priority: 'normal'
          }
        }),
        batchSettings: {
          maxConcurrent: 1, // 순차 생성
          delayBetweenRequests: 1000,
          stopOnError: false
        }
      }

      dispatch(storyboardActions.startBatchGeneration(batchRequest))

      // 순차적으로 생성
      for (let i = 0; i < frameIds.length; i++) {
        const frameId = frameIds[i]

        try {
          await generateSingleFrame(frameId)
          dispatch(storyboardActions.completeFrameGeneration(frameId))

          // 첫 번째 프레임 완성 후 일관성 데이터 추출
          if (i === 0) {
            await extractConsistencyFromFrame(frameId)
          }

        } catch (error) {
          dispatch(storyboardActions.failFrameGeneration(frameId))
          logger.error('배치 생성 중 프레임 실패', { frameId, error })
        }
      }

      dispatch(storyboardActions.stopBatchGeneration())
      options.onBatchComplete?.()

    } catch (error) {
      dispatch(storyboardActions.stopBatchGeneration())
      dispatch(storyboardActions.setError(
        error instanceof Error ? error.message : '배치 생성 실패'
      ))
      throw error
    }
  }, [currentStoryboard, dispatch, generateSingleFrame, extractConsistencyFromFrame, options])

  /**
   * 생성 취소
   */
  const cancelGeneration = useCallback((): void => {
    engineRef.current?.cancelGeneration()
    dispatch(storyboardActions.stopBatchGeneration())
    dispatch(storyboardActions.setGenerating(false))
    generatingFramesRef.current.clear()

    logger.info('생성이 취소되었습니다')
  }, [dispatch])

  /**
   * 실패한 프레임 재시도
   */
  const retryFailedFrame = useCallback(async (frameId: string): Promise<void> => {
    if (!currentStoryboard) return

    const frame = currentStoryboard.frames.find(f => f.metadata.id === frameId)
    if (!frame || frame.metadata.status !== 'failed') {
      logger.warn('재시도할 수 없는 프레임입니다', { frameId, status: frame?.metadata.status })
      return
    }

    // 재시도 횟수 제한 (비용 안전)
    const maxRetries = currentStoryboard.settings.maxRetries
    if (frame.attempts.length >= maxRetries) {
      throw new Error(`최대 재시도 횟수(${maxRetries})를 초과했습니다`)
    }

    // 프레임 상태를 대기로 변경 후 생성
    dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'pending' }))
    await generateSingleFrame(frameId)
  }, [currentStoryboard, dispatch, generateSingleFrame])

  /**
   * 프레임에서 일관성 데이터 추출
   */
  const extractConsistencyFromFrame = useCallback(async (frameId: string): Promise<void> => {
    if (!currentStoryboard || !consistencyManagerRef.current) return

    const frame = currentStoryboard.frames.find(f => f.metadata.id === frameId)
    if (!frame || !frame.result?.imageUrl) {
      throw new Error('완성된 프레임이 아닙니다')
    }

    try {
      const consistencyRefs = await consistencyManagerRef.current.extractConsistencyFromFrame(frame)

      // 추출된 일관성 참조를 전역 설정에 추가
      consistencyRefs.forEach(ref => {
        dispatch(storyboardActions.addConsistencyReference(ref))
      })

      logger.info('일관성 데이터 추출 완료', {
        frameId,
        extractedRefs: consistencyRefs.length
      })

    } catch (error) {
      logger.error('일관성 데이터 추출 실패', { frameId, error })
      throw error
    }
  }, [currentStoryboard, dispatch])

  /**
   * 일관성 점수 계산
   */
  const calculateConsistencyScore = useCallback(async (): Promise<void> => {
    if (!currentStoryboard || !consistencyManagerRef.current) return

    try {
      const score = await consistencyManagerRef.current.calculateConsistencyScore(
        currentStoryboard.frames
      )

      // 검증 결과에 일관성 정보 추가
      dispatch(storyboardActions.setValidationResult({
        isValid: score.overall >= 0.7,
        errors: score.overall < 0.5 ? [{
          code: 'LOW_CONSISTENCY',
          message: `일관성이 낮습니다 (${Math.round(score.overall * 100)}%)`
        }] : [],
        warnings: score.recommendations
      }))

      logger.info('일관성 점수 계산 완료', { score })

    } catch (error) {
      logger.error('일관성 점수 계산 실패', { error })
      throw error
    }
  }, [currentStoryboard, dispatch])

  /**
   * 프레임에 일관성 적용
   */
  const applyConsistencyToFrame = useCallback(async (
    frameId: string,
    referenceFrameId: string
  ): Promise<void> => {
    if (!currentStoryboard || !consistencyManagerRef.current) return

    const frame = currentStoryboard.frames.find(f => f.metadata.id === frameId)
    const referenceFrame = currentStoryboard.frames.find(f => f.metadata.id === referenceFrameId)

    if (!frame || !referenceFrame) {
      throw new Error('프레임을 찾을 수 없습니다')
    }

    try {
      // 참조 프레임에서 일관성 데이터 추출
      const consistencyRefs = await consistencyManagerRef.current.extractConsistencyFromFrame(referenceFrame)

      // 대상 프레임에 일관성 참조 적용
      dispatch(storyboardActions.updateFrame({
        frameId,
        updates: {
          consistencyRefs: [...frame.consistencyRefs, ...consistencyRefs]
        }
      }))

      logger.info('일관성 적용 완료', { frameId, referenceFrameId })

    } catch (error) {
      logger.error('일관성 적용 실패', { frameId, referenceFrameId, error })
      throw error
    }
  }, [currentStoryboard, dispatch])

  /**
   * 오류 지우기
   */
  const clearError = useCallback((): void => {
    dispatch(storyboardActions.clearError())
  }, [dispatch])

  /**
   * 프레임 새로고침
   */
  const refreshFrame = useCallback((frameId: string): void => {
    // 프레임을 대기 상태로 변경
    dispatch(storyboardActions.updateFrameStatus({ frameId, status: 'pending' }))
  }, [dispatch])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (generatingFramesRef.current.size > 0) {
        cancelGeneration()
      }
    }
  }, [cancelGeneration])

  return {
    // 상태
    isGenerating,
    isLoading,
    currentStoryboard,
    selectedFrame,
    batchGeneration,
    error,

    // 단일 프레임 생성
    generateSingleFrame,

    // 배치 생성
    generateAllPendingFrames,
    generateSelectedFrames,
    generateSequentialBatch,

    // 생성 제어
    cancelGeneration,
    retryFailedFrame,

    // 일관성 관리
    extractConsistencyFromFrame,
    calculateConsistencyScore,
    applyConsistencyToFrame,

    // 유틸리티
    clearError,
    refreshFrame
  }
}