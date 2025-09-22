/**
 * Storyboard Entity Model
 *
 * 스토리보드 도메인 비즈니스 로직
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성, 단일 책임 원칙
 */

import type {
  Storyboard,
  StoryboardFrame,
  StoryboardCreateInput,
  StoryboardUpdateInput,
  FrameGenerationRequest,
  BatchGenerationRequest,
  StoryboardValidationResult,
  StoryboardError,
  ConsistencyReference,
  ImageGenerationConfig,
  PromptEngineering,
  GenerationResult,
  StoryboardAnalytics,
  StoryboardFrameStatus,
  ImageGenerationModel
} from './types'

/**
 * 스토리보드 비즈니스 로직 모델
 */
export class StoryboardModel {
  /**
   * 새로운 스토리보드 생성
   */
  static create(input: StoryboardCreateInput): Storyboard {
    const now = new Date()

    return {
      metadata: {
        id: StoryboardModel.generateId(),
        scenarioId: input.scenarioId,
        title: input.title,
        description: input.description,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        userId: input.userId,
        version: 1
      },
      frames: [],
      settings: {
        defaultConfig: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
          ...input.config
        },
        globalConsistencyRefs: input.consistencyRefs || [],
        autoGeneration: false,
        qualityThreshold: 0.7,
        maxRetries: 3,
        batchSize: 5
      }
    }
  }

  /**
   * 스토리보드 업데이트
   */
  static update(storyboard: Storyboard, input: StoryboardUpdateInput): Storyboard {
    const updatedStoryboard: Storyboard = {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        ...Object.fromEntries(
          Object.entries(input).filter(([key]) =>
            ['title', 'description'].includes(key)
          )
        ),
        updatedAt: new Date(),
        version: storyboard.metadata.version + 1
      }
    }

    if (input.settings) {
      updatedStoryboard.settings = {
        ...storyboard.settings,
        ...input.settings
      }
    }

    if (input.frames) {
      updatedStoryboard.frames = input.frames
      updatedStoryboard.statistics = StoryboardModel.calculateStatistics(input.frames)
    }

    return updatedStoryboard
  }

  /**
   * 프레임 추가
   */
  static addFrame(
    storyboard: Storyboard,
    request: FrameGenerationRequest
  ): Storyboard {
    const newFrame: StoryboardFrame = {
      metadata: {
        id: StoryboardModel.generateId(),
        sceneId: request.sceneId,
        order: storyboard.frames.length + 1,
        title: `프레임 ${storyboard.frames.length + 1}`,
        description: request.sceneDescription,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        userId: storyboard.metadata.userId
      },
      prompt: {
        basePrompt: request.sceneDescription,
        enhancedPrompt: request.additionalPrompt
          ? `${request.sceneDescription}. ${request.additionalPrompt}`
          : request.sceneDescription,
        styleModifiers: [],
        technicalSpecs: []
      },
      config: {
        ...storyboard.settings.defaultConfig,
        ...request.config
      },
      consistencyRefs: request.consistencyRefs
        ? storyboard.settings.globalConsistencyRefs.filter(ref =>
            request.consistencyRefs!.includes(ref.id)
          )
        : [],
      attempts: []
    }

    const updatedFrames = [...storyboard.frames, newFrame]

    return {
      ...storyboard,
      frames: updatedFrames,
      statistics: StoryboardModel.calculateStatistics(updatedFrames),
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 프레임 업데이트
   */
  static updateFrame(
    storyboard: Storyboard,
    frameId: string,
    updates: Partial<StoryboardFrame>
  ): Storyboard {
    const updatedFrames = storyboard.frames.map(frame =>
      frame.metadata.id === frameId
        ? {
            ...frame,
            ...updates,
            metadata: {
              ...frame.metadata,
              ...updates.metadata,
              updatedAt: new Date()
            }
          }
        : frame
    )

    return {
      ...storyboard,
      frames: updatedFrames,
      statistics: StoryboardModel.calculateStatistics(updatedFrames),
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 프레임 삭제
   */
  static removeFrame(storyboard: Storyboard, frameId: string): Storyboard {
    const updatedFrames = storyboard.frames
      .filter(frame => frame.metadata.id !== frameId)
      .map((frame, index) => ({
        ...frame,
        metadata: {
          ...frame.metadata,
          order: index + 1
        }
      }))

    return {
      ...storyboard,
      frames: updatedFrames,
      statistics: StoryboardModel.calculateStatistics(updatedFrames),
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 프레임 순서 변경
   */
  static reorderFrames(storyboard: Storyboard, frameIds: string[]): Storyboard {
    const frameMap = new Map(storyboard.frames.map(frame => [frame.metadata.id, frame]))

    const reorderedFrames = frameIds
      .map(id => frameMap.get(id))
      .filter((frame): frame is StoryboardFrame => frame !== undefined)
      .map((frame, index) => ({
        ...frame,
        metadata: {
          ...frame.metadata,
          order: index + 1
        }
      }))

    return {
      ...storyboard,
      frames: reorderedFrames,
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 생성 결과 추가
   */
  static addGenerationResult(
    storyboard: Storyboard,
    frameId: string,
    result: GenerationResult
  ): Storyboard {
    return StoryboardModel.updateFrame(storyboard, frameId, {
      result: result,
      attempts: [...(storyboard.frames.find(f => f.metadata.id === frameId)?.attempts || []), result],
      metadata: {
        status: 'completed' as StoryboardFrameStatus
      }
    })
  }

  /**
   * 프레임 상태 업데이트
   */
  static updateFrameStatus(
    storyboard: Storyboard,
    frameId: string,
    status: StoryboardFrameStatus
  ): Storyboard {
    return StoryboardModel.updateFrame(storyboard, frameId, {
      metadata: { status }
    })
  }

  /**
   * 일관성 참조 추가
   */
  static addConsistencyReference(
    storyboard: Storyboard,
    reference: Omit<ConsistencyReference, 'id'>
  ): Storyboard {
    const newReference: ConsistencyReference = {
      ...reference,
      id: StoryboardModel.generateId()
    }

    return {
      ...storyboard,
      settings: {
        ...storyboard.settings,
        globalConsistencyRefs: [...storyboard.settings.globalConsistencyRefs, newReference]
      },
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 일관성 참조 업데이트
   */
  static updateConsistencyReference(
    storyboard: Storyboard,
    referenceId: string,
    updates: Partial<ConsistencyReference>
  ): Storyboard {
    const updatedRefs = storyboard.settings.globalConsistencyRefs.map(ref =>
      ref.id === referenceId ? { ...ref, ...updates } : ref
    )

    return {
      ...storyboard,
      settings: {
        ...storyboard.settings,
        globalConsistencyRefs: updatedRefs
      },
      metadata: {
        ...storyboard.metadata,
        updatedAt: new Date()
      }
    }
  }

  /**
   * 배치 생성 준비
   */
  static prepareBatchGeneration(
    storyboard: Storyboard,
    requests: FrameGenerationRequest[]
  ): BatchGenerationRequest {
    return {
      frames: requests,
      batchSettings: {
        maxConcurrent: storyboard.settings.batchSize,
        delayBetweenRequests: 1000, // 1초 간격
        stopOnError: false
      }
    }
  }

  /**
   * 스토리보드 검증
   */
  static validate(storyboard: Storyboard): StoryboardValidationResult {
    const errors: StoryboardError[] = []
    const warnings: string[] = []

    // 기본 검증
    if (!storyboard.metadata.title.trim()) {
      errors.push({
        code: 'TITLE_REQUIRED',
        message: '스토리보드 제목은 필수입니다.'
      })
    }

    if (!storyboard.metadata.scenarioId) {
      errors.push({
        code: 'SCENARIO_ID_REQUIRED',
        message: '시나리오 ID는 필수입니다.'
      })
    }

    // 프레임 검증
    let validFrames = 0
    let invalidFrames = 0

    storyboard.frames.forEach((frame, index) => {
      let frameValid = true

      if (!frame.metadata.title.trim()) {
        errors.push({
          code: 'FRAME_TITLE_REQUIRED',
          message: `프레임 ${index + 1}의 제목이 필요합니다.`,
          frameId: frame.metadata.id
        })
        frameValid = false
      }

      if (!frame.prompt.basePrompt.trim()) {
        errors.push({
          code: 'FRAME_PROMPT_REQUIRED',
          message: `프레임 ${index + 1}의 프롬프트가 필요합니다.`,
          frameId: frame.metadata.id
        })
        frameValid = false
      }

      if (frame.prompt.basePrompt.length > STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH) {
        warnings.push(`프레임 ${index + 1}의 프롬프트가 너무 깁니다.`)
      }

      if (frame.metadata.status === 'failed' && frame.attempts.length >= storyboard.settings.maxRetries) {
        warnings.push(`프레임 ${index + 1}이 최대 재시도 횟수를 초과했습니다.`)
      }

      frameValid ? validFrames++ : invalidFrames++
    })

    // 일관성 참조 검증
    storyboard.settings.globalConsistencyRefs.forEach((ref, index) => {
      if (!ref.name.trim()) {
        errors.push({
          code: 'CONSISTENCY_REF_NAME_REQUIRED',
          message: `일관성 참조 ${index + 1}의 이름이 필요합니다.`,
          details: { referenceId: ref.id }
        })
      }

      if (ref.weight < 0 || ref.weight > 1) {
        errors.push({
          code: 'INVALID_CONSISTENCY_WEIGHT',
          message: `일관성 참조 ${index + 1}의 가중치가 잘못되었습니다. (0.0 ~ 1.0)`,
          details: { referenceId: ref.id }
        })
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        validFrames,
        invalidFrames,
        missingScenes: 0 // 시나리오 연동 시 계산
      }
    }
  }

  /**
   * 스토리보드 복제
   */
  static clone(storyboard: Storyboard, newTitle?: string): Storyboard {
    const now = new Date()

    return {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        id: StoryboardModel.generateId(),
        title: newTitle || `${storyboard.metadata.title} (복사본)`,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        version: 1
      },
      frames: storyboard.frames.map(frame => ({
        ...frame,
        metadata: {
          ...frame.metadata,
          id: StoryboardModel.generateId()
        },
        result: undefined, // 복제 시 결과는 제외
        attempts: []
      }))
    }
  }

  /**
   * 분석 데이터 생성
   */
  static generateAnalytics(storyboards: Storyboard[]): StoryboardAnalytics {
    const allFrames = storyboards.flatMap(sb => sb.frames)
    const completedFrames = allFrames.filter(frame => frame.metadata.status === 'completed')
    const totalGenerations = allFrames.reduce((sum, frame) => sum + frame.attempts.length, 0)

    const modelUsage = new Map<ImageGenerationModel, { count: number; totalTime: number }>()
    const styleUsage = new Map<string, number>()
    let totalCost = 0
    let totalTime = 0
    let totalRating = 0
    let ratingCount = 0

    completedFrames.forEach(frame => {
      if (frame.result) {
        // 모델 사용량 추적
        const modelStats = modelUsage.get(frame.result.model) || { count: 0, totalTime: 0 }
        modelStats.count++
        if (frame.result.processingTime) {
          modelStats.totalTime += frame.result.processingTime
          totalTime += frame.result.processingTime
        }
        modelUsage.set(frame.result.model, modelStats)

        // 비용 추가
        if (frame.result.cost) {
          totalCost += frame.result.cost
        }

        // 스타일 사용량
        if (frame.config.style) {
          styleUsage.set(frame.config.style, (styleUsage.get(frame.config.style) || 0) + 1)
        }
      }

      // 사용자 평점
      if (frame.userFeedback?.rating) {
        totalRating += frame.userFeedback.rating
        ratingCount++
      }
    })

    const successRate = totalGenerations > 0 ? completedFrames.length / totalGenerations : 0
    const averageCost = completedFrames.length > 0 ? totalCost / completedFrames.length : 0
    const averageTime = completedFrames.length > 0 ? totalTime / completedFrames.length : 0
    const userSatisfaction = ratingCount > 0 ? totalRating / ratingCount : 0

    return {
      totalGenerations,
      successRate,
      averageCost,
      averageTime,
      popularStyles: Array.from(styleUsage.entries())
        .map(([style, usage]) => ({ style: style as any, usage }))
        .sort((a, b) => b.usage - a.usage),
      modelPerformance: Array.from(modelUsage.entries())
        .map(([model, stats]) => ({
          model,
          successRate: stats.count / totalGenerations,
          avgTime: stats.totalTime / stats.count
        })),
      userSatisfaction
    }
  }

  // === Private Helper Methods ===

  /**
   * 통계 계산
   */
  private static calculateStatistics(frames: StoryboardFrame[]) {
    const totalFrames = frames.length
    const completedFrames = frames.filter(frame => frame.metadata.status === 'completed').length
    const failedFrames = frames.filter(frame => frame.metadata.status === 'failed').length

    const totalCost = frames.reduce((sum, frame) =>
      sum + (frame.result?.cost || 0), 0
    )

    const processingTimes = frames
      .map(frame => frame.result?.processingTime)
      .filter((time): time is number => time !== undefined)

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0

    const ratings = frames
      .map(frame => frame.userFeedback?.rating)
      .filter((rating): rating is number => rating !== undefined)

    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : 0

    return {
      totalFrames,
      completedFrames,
      failedFrames,
      totalCost,
      averageProcessingTime,
      averageRating
    }
  }

  /**
   * 유니크 ID 생성
   */
  private static generateId(): string {
    return `storyboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 스토리보드 도메인 상수
 */
export const STORYBOARD_CONSTANTS = {
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_FRAME_TITLE_LENGTH: 50,
  MAX_PROMPT_LENGTH: 2000,
  MAX_FRAMES_COUNT: 100,
  DEFAULT_QUALITY_THRESHOLD: 0.7,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_BATCH_SIZE: 5,
  MIN_CONSISTENCY_WEIGHT: 0.0,
  MAX_CONSISTENCY_WEIGHT: 1.0,
  SUPPORTED_IMAGE_FORMATS: ['png', 'jpg', 'jpeg', 'webp'] as const,
  MAX_FILE_SIZE_MB: 10
} as const