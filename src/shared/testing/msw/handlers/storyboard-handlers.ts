/**
 * MSW Handlers for Storyboard API
 *
 * 스토리보드 이미지 생성 API 모킹
 * CLAUDE.md 준수: TDD, MSW 기반 모킹, 결정론적 테스트, 비용 안전 규칙
 */

import { http, HttpResponse } from 'msw'
import type {
  Storyboard,
  StoryboardFrame,
  StoryboardCreateInput,
  GenerationResult,
  ConsistencyReference,
  ImageGenerationConfig
} from '../../../../entities/storyboard'

/**
 * API 호출 제한 (비용 안전)
 */
class StoryboardApiLimiter {
  private static calls: Map<string, number> = new Map()
  private static readonly MAX_IMAGE_GENERATIONS_PER_MINUTE = 10
  private static readonly MAX_CONSISTENCY_EXTRACTIONS_PER_MINUTE = 5

  static checkImageGenerationLimit(): boolean {
    return this.checkLimit('image-generation', this.MAX_IMAGE_GENERATIONS_PER_MINUTE)
  }

  static checkConsistencyExtractionLimit(): boolean {
    return this.checkLimit('consistency-extraction', this.MAX_CONSISTENCY_EXTRACTIONS_PER_MINUTE)
  }

  private static checkLimit(endpoint: string, maxCalls: number): boolean {
    const now = Date.now()
    const key = `${endpoint}_${Math.floor(now / 60000)}` // 분 단위
    const current = this.calls.get(key) || 0

    if (current >= maxCalls) {
      return false
    }

    this.calls.set(key, current + 1)
    return true
  }

  static reset() {
    this.calls.clear()
  }
}

/**
 * 테스트용 스토리보드 데이터
 */
const mockStoryboards: Storyboard[] = [
  {
    metadata: {
      id: 'storyboard-test-001',
      scenarioId: 'scenario-test-001',
      title: '테스트 스토리보드',
      description: 'MSW 테스트용 스토리보드',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      status: 'in_progress',
      userId: 'test-user',
      version: 1
    },
    frames: [
      {
        metadata: {
          id: 'frame-test-001',
          sceneId: 'scene-001',
          order: 1,
          title: '테스트 프레임 1',
          description: '첫 번째 테스트 프레임',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          status: 'completed',
          userId: 'test-user'
        },
        prompt: {
          basePrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습',
          enhancedPrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습, cinematic lighting, high quality, detailed',
          styleModifiers: ['cinematic lighting', 'high quality', 'detailed'],
          technicalSpecs: ['8k resolution', 'professional photography'],
          negativePrompt: 'blurry, low quality, distorted',
          promptTokens: 15
        },
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
          steps: 20,
          guidanceScale: 7.5
        },
        consistencyRefs: [],
        result: {
          imageUrl: 'https://example.com/test-image-001.jpg',
          thumbnailUrl: 'https://example.com/test-image-001_thumb.jpg',
          generationId: 'gen-test-001',
          model: 'dall-e-3',
          config: {
            model: 'dall-e-3',
            aspectRatio: '16:9',
            quality: 'hd',
            style: 'cinematic'
          },
          prompt: {
            basePrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습',
            enhancedPrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습, cinematic lighting',
            styleModifiers: ['cinematic lighting'],
            technicalSpecs: ['8k resolution']
          },
          generatedAt: new Date('2024-01-01T00:05:00Z'),
          processingTime: 15,
          cost: 0.04
        },
        attempts: []
      }
    ],
    settings: {
      defaultConfig: {
        model: 'dall-e-3',
        aspectRatio: '16:9',
        quality: 'hd',
        style: 'cinematic'
      },
      globalConsistencyRefs: [],
      autoGeneration: false,
      qualityThreshold: 0.7,
      maxRetries: 3,
      batchSize: 5
    },
    statistics: {
      totalFrames: 1,
      completedFrames: 1,
      failedFrames: 0,
      totalCost: 0.04,
      averageProcessingTime: 15,
      averageRating: 4.5
    }
  }
]

/**
 * 테스트용 일관성 참조 데이터
 */
const mockConsistencyRefs: ConsistencyReference[] = [
  {
    id: 'consistency-test-001',
    type: 'style',
    name: '테스트 스타일 참조',
    description: '테스트용 스타일 일관성 참조',
    referenceImageUrl: 'https://example.com/test-image-001.jpg',
    keyFeatures: ['warm lighting', 'cozy atmosphere', 'realistic style'],
    weight: 0.8,
    isActive: true
  }
]

/**
 * MSW 핸들러 정의
 */
export const storyboardHandlers = [
  // === 스토리보드 CRUD ===

  // 스토리보드 목록 조회
  http.get('/api/storyboards', ({ request }) => {
    const url = new URL(request.url)
    const scenarioId = url.searchParams.get('scenarioId')

    let filteredStoryboards = mockStoryboards

    if (scenarioId) {
      filteredStoryboards = mockStoryboards.filter(sb => sb.metadata.scenarioId === scenarioId)
    }

    return HttpResponse.json({
      success: true,
      data: filteredStoryboards,
      pagination: {
        total: filteredStoryboards.length,
        page: 1,
        limit: 10
      }
    })
  }),

  // 스토리보드 상세 조회
  http.get('/api/storyboards/:id', ({ params }) => {
    const { id } = params
    const storyboard = mockStoryboards.find(sb => sb.metadata.id === id)

    if (!storyboard) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      success: true,
      data: storyboard
    })
  }),

  // 스토리보드 생성
  http.post('/api/storyboards', async ({ request }) => {
    const body = (await request.json()) as StoryboardCreateInput

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 500))

    const newStoryboard: Storyboard = {
      metadata: {
        id: `storyboard-${Date.now()}`,
        scenarioId: body.scenarioId,
        title: body.title,
        description: body.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
        userId: body.userId,
        version: 1
      },
      frames: [],
      settings: {
        defaultConfig: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
          ...body.config
        },
        globalConsistencyRefs: body.consistencyRefs || [],
        autoGeneration: false,
        qualityThreshold: 0.7,
        maxRetries: 3,
        batchSize: 5
      }
    }

    mockStoryboards.unshift(newStoryboard)

    return HttpResponse.json({
      success: true,
      data: newStoryboard
    })
  }),

  // 스토리보드 업데이트
  http.put('/api/storyboards/:id', async ({ params, request }) => {
    const { id } = params
    const updates = await request.json()

    const index = mockStoryboards.findIndex(sb => sb.metadata.id === id)
    if (index === -1) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    mockStoryboards[index] = {
      ...mockStoryboards[index],
      ...updates,
      metadata: {
        ...mockStoryboards[index].metadata,
        ...updates.metadata,
        updatedAt: new Date(),
        version: mockStoryboards[index].metadata.version + 1
      }
    }

    return HttpResponse.json({
      success: true,
      data: mockStoryboards[index]
    })
  }),

  // === 이미지 생성 API ===

  // ByteDance Seedream API 모킹
  http.post('/api/ai/generate-image', async ({ request }) => {
    // 비용 안전: 호출 제한 체크
    if (!StoryboardApiLimiter.checkImageGenerationLimit()) {
      return HttpResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '이미지 생성 한도 초과. 1분 후 다시 시도하세요.'
          }
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { prompt, style, width, height, referenceImage, seed, steps, guidance } = body

    // 시뮬레이션 지연 (실제 생성 시간 모방)
    const processingTime = Math.random() * 20 + 10 // 10-30초
    await new Promise(resolve => setTimeout(resolve, Math.min(processingTime * 100, 3000))) // 최대 3초로 제한

    // 실패 시뮬레이션 (10% 확률)
    if (Math.random() < 0.1) {
      return HttpResponse.json(
        {
          error: {
            code: 'GENERATION_FAILED',
            message: '이미지 생성에 실패했습니다. 다시 시도해주세요.'
          }
        },
        { status: 500 }
      )
    }

    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const imageUrl = `https://example.com/generated/${generationId}.jpg`
    const actualSeed = seed || Math.floor(Math.random() * 1000000)

    const result = {
      imageUrl,
      seed: actualSeed,
      processingTime: Math.round(processingTime),
      cost: 0.04 + Math.random() * 0.02 // $0.04-0.06
    }

    return HttpResponse.json({
      success: true,
      data: result
    })
  }),

  // 프롬프트 향상 API
  http.post('/api/ai/enhance-prompt', async ({ request }) => {
    const body = await request.json()
    const { prompt, style, consistencyRefs } = body

    await new Promise(resolve => setTimeout(resolve, 500))

    // 일관성 참조 기반 프롬프트 향상
    let enhancedPrompt = prompt

    if (consistencyRefs && consistencyRefs.length > 0) {
      const styleFeatures = consistencyRefs
        .flatMap((ref: ConsistencyReference) => ref.keyFeatures)
        .join(', ')
      enhancedPrompt = `${prompt}, ${styleFeatures}`
    }

    // 스타일별 수정자 추가
    const styleModifiers = {
      'cinematic': 'cinematic lighting, dramatic composition',
      'anime': 'anime style, vibrant colors',
      'photorealistic': 'photorealistic, detailed textures',
      'illustration': 'digital illustration, artistic style'
    }

    const modifier = styleModifiers[style as keyof typeof styleModifiers] || 'high quality'
    enhancedPrompt = `${enhancedPrompt}, ${modifier}`

    return HttpResponse.json({
      success: true,
      data: {
        enhancedPrompt,
        originalPrompt: prompt,
        addedModifiers: [modifier]
      }
    })
  }),

  // 일관성 데이터 추출 API
  http.post('/api/ai/extract-consistency', async ({ request }) => {
    // 비용 안전: 호출 제한 체크
    if (!StoryboardApiLimiter.checkConsistencyExtractionLimit()) {
      return HttpResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '일관성 추출 한도 초과. 1분 후 다시 시도하세요.'
          }
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { imageUrl } = body

    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 2000))

    const consistencyData = {
      styleFingerprint: `style_${Math.random().toString(36).substr(2, 9)}`,
      colorPalette: ['#8B4513', '#DEB887', '#F5DEB3', '#CD853F'],
      lightingProfile: 'warm_natural',
      compositionStyle: 'medium_shot',
      texturePattern: 'smooth_realistic'
    }

    return HttpResponse.json({
      success: true,
      data: consistencyData
    })
  }),

  // === 프레임 관리 ===

  // 프레임 생성
  http.post('/api/storyboards/:id/frames', async ({ params, request }) => {
    const { id } = params
    const body = await request.json()

    const storyboard = mockStoryboards.find(sb => sb.metadata.id === id)
    if (!storyboard) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await new Promise(resolve => setTimeout(resolve, 300))

    const newFrame: StoryboardFrame = {
      metadata: {
        id: `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sceneId: body.sceneId,
        order: storyboard.frames.length + 1,
        title: body.title || `프레임 ${storyboard.frames.length + 1}`,
        description: body.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        userId: storyboard.metadata.userId
      },
      prompt: {
        basePrompt: body.sceneDescription,
        enhancedPrompt: body.sceneDescription,
        styleModifiers: [],
        technicalSpecs: []
      },
      config: {
        ...storyboard.settings.defaultConfig,
        ...body.config
      },
      consistencyRefs: [],
      attempts: []
    }

    storyboard.frames.push(newFrame)
    storyboard.metadata.updatedAt = new Date()

    return HttpResponse.json({
      success: true,
      data: newFrame
    })
  }),

  // 프레임 업데이트
  http.put('/api/storyboards/:storyboardId/frames/:frameId', async ({ params, request }) => {
    const { storyboardId, frameId } = params
    const updates = await request.json()

    const storyboard = mockStoryboards.find(sb => sb.metadata.id === storyboardId)
    if (!storyboard) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const frameIndex = storyboard.frames.findIndex(f => f.metadata.id === frameId)
    if (frameIndex === -1) {
      return HttpResponse.json(
        { error: '프레임을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    storyboard.frames[frameIndex] = {
      ...storyboard.frames[frameIndex],
      ...updates,
      metadata: {
        ...storyboard.frames[frameIndex].metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    }

    return HttpResponse.json({
      success: true,
      data: storyboard.frames[frameIndex]
    })
  }),

  // 프레임 삭제
  http.delete('/api/storyboards/:storyboardId/frames/:frameId', ({ params }) => {
    const { storyboardId, frameId } = params

    const storyboard = mockStoryboards.find(sb => sb.metadata.id === storyboardId)
    if (!storyboard) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const frameIndex = storyboard.frames.findIndex(f => f.metadata.id === frameId)
    if (frameIndex === -1) {
      return HttpResponse.json(
        { error: '프레임을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    storyboard.frames.splice(frameIndex, 1)

    // 순서 재정렬
    storyboard.frames.forEach((frame, index) => {
      frame.metadata.order = index + 1
    })

    return HttpResponse.json({
      success: true,
      message: '프레임이 삭제되었습니다.'
    })
  }),

  // === 배치 생성 ===

  // 배치 생성 시작
  http.post('/api/storyboards/:id/generate-batch', async ({ params, request }) => {
    const { id } = params
    const body = await request.json()

    const storyboard = mockStoryboards.find(sb => sb.metadata.id === id)
    if (!storyboard) {
      return HttpResponse.json(
        { error: '스토리보드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 비용 안전: 배치 크기 제한
    if (body.frameIds && body.frameIds.length > 10) {
      return HttpResponse.json(
        { error: '배치 크기는 최대 10개입니다.' },
        { status: 400 }
      )
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    return HttpResponse.json({
      success: true,
      data: {
        batchId: `batch_${Date.now()}`,
        status: 'started',
        totalFrames: body.frameIds?.length || 0,
        estimatedTime: (body.frameIds?.length || 0) * 15 // 프레임당 15초 예상
      }
    })
  })
]

/**
 * 테스트 유틸리티
 */
export const storyboardTestUtils = {
  resetApiLimiter: () => StoryboardApiLimiter.reset(),
  getMockStoryboards: () => [...mockStoryboards],
  addMockStoryboard: (storyboard: Storyboard) => mockStoryboards.unshift(storyboard),
  clearMockStoryboards: () => (mockStoryboards.length = 0),
  getMockConsistencyRefs: () => [...mockConsistencyRefs],
  addMockConsistencyRef: (ref: ConsistencyReference) => mockConsistencyRefs.push(ref),

  // 특정 시나리오 조건 시뮬레이션
  simulateGenerationFailure: (shouldFail: boolean) => {
    // 실제 구현에서는 전역 플래그로 실패 시뮬레이션 제어
  },

  simulateSlowGeneration: (shouldBeSlow: boolean) => {
    // 실제 구현에서는 지연 시간 제어
  }
}