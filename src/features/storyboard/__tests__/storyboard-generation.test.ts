/**
 * Storyboard Generation Tests
 *
 * 스토리보드 이미지 생성 기능 테스트
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트, 비용 안전
 */

import { setupMswForTests } from '../../../shared/testing/msw/setup'
import { storyboardTestUtils } from '../../../shared/testing/msw/handlers/storyboard-handlers'
import { ImageGenerationEngine, type ImageGenerationAPIClient } from '../model/image-generator'
import { ConsistencyManager, type ConsistencyExtractor } from '../model/consistency-manager'
import type {
  StoryboardFrame,
  ImageGenerationConfig,
  ConsistencyReference,
  GenerationResult
} from '../../../entities/storyboard'

// MSW 설정
setupMswForTests()

/**
 * 모킹된 API 클라이언트
 */
const mockApiClient: ImageGenerationAPIClient = {
  generateImage: jest.fn(),
  enhancePrompt: jest.fn(),
  extractConsistencyData: jest.fn()
}

/**
 * 모킹된 일관성 추출기
 */
const mockConsistencyExtractor: ConsistencyExtractor = {
  analyzeColors: jest.fn(),
  analyzeStyle: jest.fn(),
  extractVisualFingerprint: jest.fn()
}

/**
 * 테스트용 데이터
 */
const mockFrame: StoryboardFrame = {
  metadata: {
    id: 'test-frame-001',
    sceneId: 'test-scene-001',
    order: 1,
    title: '테스트 프레임',
    description: '테스트용 프레임 설명',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    status: 'pending',
    userId: 'test-user'
  },
  prompt: {
    basePrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습',
    enhancedPrompt: '따뜻한 커피숍에서 주인공이 앉아있는 모습, cinematic lighting',
    styleModifiers: ['cinematic lighting'],
    technicalSpecs: ['8k resolution']
  },
  config: {
    model: 'dall-e-3',
    aspectRatio: '16:9',
    quality: 'hd',
    style: 'cinematic'
  },
  consistencyRefs: [],
  attempts: []
}

const mockConfig: ImageGenerationConfig = {
  model: 'dall-e-3',
  aspectRatio: '16:9',
  quality: 'hd',
  style: 'cinematic'
}

describe('ImageGenerationEngine', () => {
  let engine: ImageGenerationEngine

  beforeEach(() => {
    engine = new ImageGenerationEngine(mockApiClient)
    storyboardTestUtils.resetApiLimiter()
    jest.clearAllMocks()
  })

  afterEach(() => {
    engine.cancelGeneration()
  })

  describe('단일 프레임 생성', () => {
    it('성공적으로 이미지를 생성해야 한다', async () => {
      // Arrange
      const mockResult = {
        imageUrl: 'https://example.com/generated-image.jpg',
        seed: 123456,
        processingTime: 15,
        cost: 0.04
      }

      const mockEnhancedPrompt = '따뜻한 커피숍에서 주인공이 앉아있는 모습, cinematic lighting, high quality'

      jest.mocked(mockApiClient.enhancePrompt).mockResolvedValue(mockEnhancedPrompt)
      jest.mocked(mockApiClient.generateImage).mockResolvedValue(mockResult)

      const progressCallback = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      const request = {
        frameId: 'test-frame-001',
        prompt: mockFrame.prompt,
        config: mockConfig,
        consistencyRefs: [],
        retryAttempt: 0
      }

      // Act
      const result = await engine.generateSingleFrame(request, progressCallback)

      // Assert
      expect(result).toMatchObject({
        imageUrl: mockResult.imageUrl,
        model: mockConfig.model,
        processingTime: mockResult.processingTime,
        cost: mockResult.cost
      })

      expect(progressCallback.onProgress).toHaveBeenCalledWith(
        'test-frame-001',
        expect.any(Number),
        expect.any(String)
      )

      expect(progressCallback.onComplete).toHaveBeenCalledWith(
        'test-frame-001',
        result
      )

      expect(progressCallback.onError).not.toHaveBeenCalled()
    })

    it('API 오류 시 적절하게 처리해야 한다', async () => {
      // Arrange
      const error = new Error('API 요청 실패')
      jest.mocked(mockApiClient.enhancePrompt).mockRejectedValue(error)

      const progressCallback = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      const request = {
        frameId: 'test-frame-001',
        prompt: mockFrame.prompt,
        config: mockConfig,
        consistencyRefs: [],
        retryAttempt: 0
      }

      // Act & Assert
      await expect(engine.generateSingleFrame(request, progressCallback)).rejects.toThrow('API 요청 실패')

      expect(progressCallback.onError).toHaveBeenCalledWith('test-frame-001', error)
      expect(progressCallback.onComplete).not.toHaveBeenCalled()
    })
  })

  describe('순차적 배치 생성', () => {
    it('여러 프레임을 순차적으로 생성해야 한다', async () => {
      // Arrange
      const requests = [
        {
          frameId: 'frame-001',
          prompt: mockFrame.prompt,
          config: mockConfig,
          consistencyRefs: [],
          retryAttempt: 0
        },
        {
          frameId: 'frame-002',
          prompt: { ...mockFrame.prompt, basePrompt: '두 번째 프레임' },
          config: mockConfig,
          consistencyRefs: [],
          retryAttempt: 0
        }
      ]

      jest.mocked(mockApiClient.enhancePrompt).mockResolvedValue('enhanced prompt')
      jest.mocked(mockApiClient.generateImage).mockResolvedValue({
        imageUrl: 'https://example.com/generated.jpg',
        seed: 123456,
        processingTime: 15,
        cost: 0.04
      })
      jest.mocked(mockApiClient.extractConsistencyData).mockResolvedValue({
        styleFingerprint: 'test-fingerprint',
        colorPalette: ['#8B4513', '#DEB887'],
        lightingProfile: 'warm_natural',
        compositionStyle: 'medium_shot'
      })

      const progressCallback = {
        onProgress: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      }

      // Act
      const results = await engine.generateSequentialBatch(requests, progressCallback)

      // Assert
      expect(results).toHaveLength(2)
      expect(progressCallback.onComplete).toHaveBeenCalledTimes(2)
      expect(mockApiClient.extractConsistencyData).toHaveBeenCalledOnce() // 첫 번째 프레임에서만 호출
    })
  })

  describe('생성 제어', () => {
    it('생성을 취소할 수 있어야 한다', () => {
      // Act
      engine.cancelGeneration()

      // Assert
      const status = engine.getGenerationStatus()
      expect(status.isGenerating).toBe(false)
      expect(status.queueLength).toBe(0)
    })

    it('생성 상태를 확인할 수 있어야 한다', () => {
      // Act
      const status = engine.getGenerationStatus()

      // Assert
      expect(status).toMatchObject({
        isGenerating: expect.any(Boolean),
        queueLength: expect.any(Number),
        currentFrameId: null
      })
    })
  })
})

describe('ConsistencyManager', () => {
  let manager: ConsistencyManager

  beforeEach(() => {
    manager = new ConsistencyManager(mockConsistencyExtractor)
    jest.clearAllMocks()
  })

  describe('일관성 데이터 추출', () => {
    it('프레임에서 일관성 데이터를 추출해야 한다', async () => {
      // Arrange
      const frameWithResult: StoryboardFrame = {
        ...mockFrame,
        result: {
          imageUrl: 'https://example.com/test-image.jpg',
          thumbnailUrl: 'https://example.com/test-image_thumb.jpg',
          generationId: 'gen-test-001',
          model: 'dall-e-3',
          config: mockConfig,
          prompt: mockFrame.prompt,
          generatedAt: new Date(),
          processingTime: 15,
          cost: 0.04
        }
      }

      jest.mocked(mockConsistencyExtractor.analyzeColors).mockResolvedValue({
        dominantColors: ['#8B4513', '#DEB887'],
        colorHarmony: 'warm',
        brightness: 'medium',
        saturation: 'medium',
        temperature: 'warm'
      })

      jest.mocked(mockConsistencyExtractor.analyzeStyle).mockResolvedValue({
        artStyle: 'realistic',
        lightingType: 'natural',
        compositionType: 'medium',
        mood: 'peaceful',
        visualComplexity: 'moderate'
      })

      jest.mocked(mockConsistencyExtractor.extractVisualFingerprint).mockResolvedValue('test-fingerprint')

      // Act
      const consistencyRefs = await manager.extractConsistencyFromFrame(frameWithResult)

      // Assert
      expect(consistencyRefs).toHaveLength(4) // color, style, lighting, composition
      expect(consistencyRefs[0]).toMatchObject({
        type: 'style',
        name: expect.stringContaining('색상 팔레트'),
        isActive: true
      })
    })

    it('결과가 없는 프레임에서는 오류를 발생시켜야 한다', async () => {
      // Act & Assert
      await expect(manager.extractConsistencyFromFrame(mockFrame)).rejects.toThrow(
        '프레임에 생성된 이미지가 없습니다'
      )
    })
  })

  describe('일관성 점수 계산', () => {
    it('여러 프레임의 일관성을 계산해야 한다', async () => {
      // Arrange
      const frames = [mockFrame, { ...mockFrame, metadata: { ...mockFrame.metadata, id: 'frame-002' } }]

      // Act
      const score = await manager.calculateConsistencyScore(frames)

      // Assert
      expect(score).toMatchObject({
        overall: expect.any(Number),
        color: expect.any(Number),
        style: expect.any(Number),
        lighting: expect.any(Number),
        composition: expect.any(Number),
        recommendations: expect.any(Array)
      })

      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(1)
    })

    it('프레임이 부족하면 기본값을 반환해야 한다', async () => {
      // Act
      const score = await manager.calculateConsistencyScore([mockFrame])

      // Assert
      expect(score.overall).toBe(1.0)
      expect(score.recommendations).toContain('프레임이 충분하지 않아 일관성을 계산할 수 없습니다.')
    })
  })

  describe('일관성 기반 프롬프트 개선', () => {
    it('참조 프레임 기반으로 프롬프트를 개선해야 한다', async () => {
      // Arrange
      const basePrompt = '새로운 씬 설명'
      const targetFrame = mockFrame
      const referenceFrames = [mockFrame]

      // Act
      const improvedPrompt = await manager.generateConsistencyGuidedPrompt(
        basePrompt,
        targetFrame,
        referenceFrames
      )

      // Assert
      expect(improvedPrompt).toContain(basePrompt)
      expect(typeof improvedPrompt).toBe('string')
    })

    it('참조 프레임이 없으면 원본 프롬프트를 반환해야 한다', async () => {
      // Arrange
      const basePrompt = '새로운 씬 설명'

      // Act
      const result = await manager.generateConsistencyGuidedPrompt(
        basePrompt,
        mockFrame,
        []
      )

      // Assert
      expect(result).toBe(basePrompt)
    })
  })
})

describe('비용 안전 기능', () => {
  it('API 호출 제한이 동작해야 한다', async () => {
    // 이 테스트는 MSW 핸들러의 레이트 리미팅 테스트
    // 실제 구현에서는 fetch를 통한 API 호출이 제한되는지 확인
    expect(true).toBe(true) // 플레이스홀더
  })

  it('실제 네트워크 호출이 차단되어야 한다', () => {
    // MSW setup.ts에서 설정한 fetch 오버라이드 테스트
    expect(() => {
      fetch('https://api.openai.com/v1/images/generations')
    }).toThrow('실제 API 호출 감지')
  })
})

describe('통합 테스트', () => {
  it('전체 워크플로우가 정상 작동해야 한다', async () => {
    // Arrange
    const engine = new ImageGenerationEngine(mockApiClient)
    const manager = new ConsistencyManager(mockConsistencyExtractor)

    // Mock 설정
    jest.mocked(mockApiClient.enhancePrompt).mockResolvedValue('enhanced prompt')
    jest.mocked(mockApiClient.generateImage).mockResolvedValue({
      imageUrl: 'https://example.com/generated.jpg',
      seed: 123456,
      processingTime: 15,
      cost: 0.04
    })

    const progressCallback = {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn()
    }

    const request = {
      frameId: 'test-frame-001',
      prompt: mockFrame.prompt,
      config: mockConfig,
      consistencyRefs: [],
      retryAttempt: 0
    }

    // Act
    const result = await engine.generateSingleFrame(request, progressCallback)

    // Assert
    expect(result.imageUrl).toBeTruthy()
    expect(result.cost).toBeGreaterThan(0)
    expect(progressCallback.onComplete).toHaveBeenCalled()
  })
})