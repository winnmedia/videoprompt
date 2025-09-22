/**
 * Storyboard Domain Model Tests
 *
 * TDD Red → Green → Refactor: 도메인 모델 테스트
 * CLAUDE.md 준수: entities 레이어 테스트, 비즈니스 로직 검증
 */

import { StoryboardModel, STORYBOARD_CONSTANTS } from '../../../entities/storyboard/model'
import type {
  StoryboardCreateInput,
  StoryboardUpdateInput,
  FrameGenerationRequest,
  Storyboard
} from '../../../entities/storyboard/types'

describe('StoryboardModel - 도메인 모델 테스트', () => {
  describe('Green Phase: 스토리보드 생성 (create)', () => {
    it('유효한 입력으로 스토리보드를 생성해야 함', () => {
      // Given: 유효한 스토리보드 생성 입력
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-001',
        title: '테스트 스토리보드',
        description: '테스트용 스토리보드입니다',
        userId: 'user-001',
        config: {
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic'
        }
      }

      // When: 스토리보드 생성
      const storyboard = StoryboardModel.create(input)

      // Then: 올바른 스토리보드가 생성되어야 함
      expect(storyboard.metadata.title).toBe(input.title)
      expect(storyboard.metadata.scenarioId).toBe(input.scenarioId)
      expect(storyboard.metadata.userId).toBe(input.userId)
      expect(storyboard.metadata.status).toBe('draft')
      expect(storyboard.metadata.version).toBe(1)
      expect(storyboard.frames).toEqual([])

      // 설정값 확인
      expect(storyboard.settings.defaultConfig.model).toBe('dall-e-3')
      expect(storyboard.settings.defaultConfig.aspectRatio).toBe('16:9')
      expect(storyboard.settings.defaultConfig.quality).toBe('hd')
      expect(storyboard.settings.defaultConfig.style).toBe('cinematic')

      // ID와 타임스탬프 확인
      expect(storyboard.metadata.id).toBeDefined()
      expect(storyboard.metadata.createdAt).toBeInstanceOf(Date)
      expect(storyboard.metadata.updatedAt).toBeInstanceOf(Date)
    })

    it('최소한의 입력으로 스토리보드를 생성해야 함', () => {
      // Given: 최소한의 입력값
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-002',
        title: '최소 스토리보드',
        userId: 'user-002'
      }

      // When: 스토리보드 생성
      const storyboard = StoryboardModel.create(input)

      // Then: 기본값으로 스토리보드가 생성되어야 함
      expect(storyboard.metadata.title).toBe(input.title)
      expect(storyboard.metadata.description).toBeUndefined()
      expect(storyboard.settings.defaultConfig.model).toBe('dall-e-3') // 기본값
      expect(storyboard.settings.defaultConfig.aspectRatio).toBe('16:9') // 기본값
      expect(storyboard.settings.qualityThreshold).toBe(0.7) // 기본값
      expect(storyboard.settings.maxRetries).toBe(3) // 기본값
      expect(storyboard.settings.batchSize).toBe(5) // 기본값
    })

    it('각 생성된 스토리보드는 고유한 ID를 가져야 함', () => {
      // Given: 동일한 입력값
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-003',
        title: '고유 ID 테스트',
        userId: 'user-003'
      }

      // When: 여러 번 생성
      const storyboard1 = StoryboardModel.create(input)
      const storyboard2 = StoryboardModel.create(input)
      const storyboard3 = StoryboardModel.create(input)

      // Then: 각각 다른 ID를 가져야 함
      expect(storyboard1.metadata.id).not.toBe(storyboard2.metadata.id)
      expect(storyboard1.metadata.id).not.toBe(storyboard3.metadata.id)
      expect(storyboard2.metadata.id).not.toBe(storyboard3.metadata.id)

      // ID 형식 검증
      expect(storyboard1.metadata.id).toMatch(/^storyboard_\d+_[a-z0-9]+$/)
      expect(storyboard2.metadata.id).toMatch(/^storyboard_\d+_[a-z0-9]+$/)
      expect(storyboard3.metadata.id).toMatch(/^storyboard_\d+_[a-z0-9]+$/)
    })
  })

  describe('Green Phase: 스토리보드 업데이트 (update)', () => {
    let baseStoryboard: Storyboard

    beforeEach(() => {
      // 테스트용 기본 스토리보드 생성
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-update-001',
        title: '업데이트 테스트 스토리보드',
        description: '원본 설명',
        userId: 'user-update-001'
      }
      baseStoryboard = StoryboardModel.create(input)
    })

    it('메타데이터를 업데이트해야 함', () => {
      // Given: 업데이트할 데이터
      const updateData: StoryboardUpdateInput = {
        title: '업데이트된 제목',
        description: '업데이트된 설명'
      }

      const originalVersion = baseStoryboard.metadata.version
      const originalUpdatedAt = baseStoryboard.metadata.updatedAt

      // When: 스토리보드 업데이트
      const updatedStoryboard = StoryboardModel.update(baseStoryboard, updateData)

      // Then: 메타데이터가 업데이트되어야 함
      expect(updatedStoryboard.metadata.title).toBe(updateData.title)
      expect(updatedStoryboard.metadata.description).toBe(updateData.description)
      expect(updatedStoryboard.metadata.version).toBe(originalVersion + 1)
      expect(updatedStoryboard.metadata.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      )

      // 변경되지 않는 필드들 확인
      expect(updatedStoryboard.metadata.id).toBe(baseStoryboard.metadata.id)
      expect(updatedStoryboard.metadata.scenarioId).toBe(baseStoryboard.metadata.scenarioId)
      expect(updatedStoryboard.metadata.userId).toBe(baseStoryboard.metadata.userId)
      expect(updatedStoryboard.metadata.createdAt).toEqual(baseStoryboard.metadata.createdAt)
    })

    it('설정값을 업데이트해야 함', () => {
      // Given: 설정 업데이트 데이터
      const updateData: StoryboardUpdateInput = {
        settings: {
          qualityThreshold: 0.8,
          maxRetries: 5,
          batchSize: 3,
          defaultConfig: {
            model: 'stable-diffusion',
            aspectRatio: '9:16',
            quality: '4k',
            style: 'anime'
          }
        }
      }

      // When: 설정 업데이트
      const updatedStoryboard = StoryboardModel.update(baseStoryboard, updateData)

      // Then: 설정이 업데이트되어야 함
      expect(updatedStoryboard.settings.qualityThreshold).toBe(0.8)
      expect(updatedStoryboard.settings.maxRetries).toBe(5)
      expect(updatedStoryboard.settings.batchSize).toBe(3)
      expect(updatedStoryboard.settings.defaultConfig.model).toBe('stable-diffusion')
      expect(updatedStoryboard.settings.defaultConfig.aspectRatio).toBe('9:16')
      expect(updatedStoryboard.settings.defaultConfig.quality).toBe('4k')
      expect(updatedStoryboard.settings.defaultConfig.style).toBe('anime')
    })

    it('부분 업데이트가 올바르게 동작해야 함', () => {
      // Given: 일부 필드만 업데이트
      const updateData: StoryboardUpdateInput = {
        title: '부분 업데이트된 제목'
        // description은 업데이트하지 않음
      }

      // When: 부분 업데이트
      const updatedStoryboard = StoryboardModel.update(baseStoryboard, updateData)

      // Then: 지정된 필드만 업데이트되고 나머지는 보존되어야 함
      expect(updatedStoryboard.metadata.title).toBe(updateData.title)
      expect(updatedStoryboard.metadata.description).toBe(baseStoryboard.metadata.description)
    })
  })

  describe('Green Phase: 프레임 관리', () => {
    let baseStoryboard: Storyboard

    beforeEach(() => {
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-frame-001',
        title: '프레임 테스트 스토리보드',
        userId: 'user-frame-001'
      }
      baseStoryboard = StoryboardModel.create(input)
    })

    it('프레임을 추가해야 함', () => {
      // Given: 프레임 생성 요청
      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-001',
        sceneDescription: '주인공이 커피숍에 앉아있는 모습',
        additionalPrompt: 'warm lighting, cozy atmosphere',
        priority: 'normal'
      }

      // When: 프레임 추가
      const updatedStoryboard = StoryboardModel.addFrame(baseStoryboard, frameRequest)

      // Then: 프레임이 추가되어야 함
      expect(updatedStoryboard.frames).toHaveLength(1)

      const addedFrame = updatedStoryboard.frames[0]
      expect(addedFrame.metadata.sceneId).toBe(frameRequest.sceneId)
      expect(addedFrame.metadata.order).toBe(1)
      expect(addedFrame.metadata.title).toBe('프레임 1')
      expect(addedFrame.metadata.description).toBe(frameRequest.sceneDescription)
      expect(addedFrame.metadata.status).toBe('pending')
      expect(addedFrame.metadata.userId).toBe(baseStoryboard.metadata.userId)

      // 프롬프트 확인
      expect(addedFrame.prompt.basePrompt).toBe(frameRequest.sceneDescription)
      expect(addedFrame.prompt.enhancedPrompt).toBe(
        `${frameRequest.sceneDescription}. ${frameRequest.additionalPrompt}`
      )

      // 통계 업데이트 확인
      expect(updatedStoryboard.statistics?.totalFrames).toBe(1)
      expect(updatedStoryboard.statistics?.completedFrames).toBe(0)
      expect(updatedStoryboard.metadata.updatedAt.getTime()).toBeGreaterThan(
        baseStoryboard.metadata.updatedAt.getTime()
      )
    })

    it('여러 프레임을 순서대로 추가해야 함', () => {
      // Given: 여러 프레임 요청
      const frameRequests: FrameGenerationRequest[] = [
        {
          sceneId: 'scene-001',
          sceneDescription: '첫 번째 프레임',
          priority: 'high'
        },
        {
          sceneId: 'scene-002',
          sceneDescription: '두 번째 프레임',
          priority: 'normal'
        },
        {
          sceneId: 'scene-003',
          sceneDescription: '세 번째 프레임',
          priority: 'low'
        }
      ]

      // When: 프레임들을 순차적으로 추가
      let currentStoryboard = baseStoryboard
      frameRequests.forEach(request => {
        currentStoryboard = StoryboardModel.addFrame(currentStoryboard, request)
      })

      // Then: 모든 프레임이 올바른 순서로 추가되어야 함
      expect(currentStoryboard.frames).toHaveLength(3)

      currentStoryboard.frames.forEach((frame, index) => {
        expect(frame.metadata.order).toBe(index + 1)
        expect(frame.metadata.sceneId).toBe(frameRequests[index].sceneId)
        expect(frame.prompt.basePrompt).toBe(frameRequests[index].sceneDescription)
      })

      expect(currentStoryboard.statistics?.totalFrames).toBe(3)
    })

    it('프레임을 삭제해야 함', () => {
      // Given: 프레임이 있는 스토리보드
      const frameRequest: FrameGenerationRequest = {
        sceneId: 'scene-to-delete',
        sceneDescription: '삭제할 프레임',
        priority: 'normal'
      }

      const storyboardWithFrame = StoryboardModel.addFrame(baseStoryboard, frameRequest)
      const frameId = storyboardWithFrame.frames[0].metadata.id

      // When: 프레임 삭제
      const updatedStoryboard = StoryboardModel.removeFrame(storyboardWithFrame, frameId)

      // Then: 프레임이 삭제되어야 함
      expect(updatedStoryboard.frames).toHaveLength(0)
      expect(updatedStoryboard.statistics?.totalFrames).toBe(0)
    })
  })

  describe('Green Phase: 검증 (validation)', () => {
    it('유효한 스토리보드를 검증해야 함', () => {
      // Given: 유효한 스토리보드
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-valid-001',
        title: '유효한 스토리보드',
        description: '유효한 설명',
        userId: 'user-valid-001'
      }

      const storyboard = StoryboardModel.create(input)

      // When: 검증 실행
      const validation = StoryboardModel.validate(storyboard)

      // Then: 검증이 성공해야 함
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
      expect(validation.statistics?.validFrames).toBe(0)
      expect(validation.statistics?.invalidFrames).toBe(0)
    })

    it('잘못된 스토리보드를 검증해야 함', () => {
      // Given: 잘못된 스토리보드 (제목 누락)
      const storyboard = StoryboardModel.create({
        scenarioId: 'scenario-invalid-001',
        title: 'Valid Title',
        userId: 'user-invalid-001'
      })

      // 제목을 강제로 빈 문자열로 변경
      storyboard.metadata.title = ''

      // When: 검증 실행
      const validation = StoryboardModel.validate(storyboard)

      // Then: 검증이 실패해야 함
      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)

      const titleError = validation.errors.find(error => error.code === 'TITLE_REQUIRED')
      expect(titleError).toBeDefined()
      expect(titleError?.message).toContain('제목은 필수입니다')
    })

    it('프레임 검증이 올바르게 동작해야 함', () => {
      // Given: 잘못된 프레임이 있는 스토리보드
      const storyboard = StoryboardModel.create({
        scenarioId: 'scenario-frame-validation',
        title: '프레임 검증 테스트',
        userId: 'user-frame-validation'
      })

      // 잘못된 프레임 추가
      const invalidFrameRequest: FrameGenerationRequest = {
        sceneId: 'scene-invalid',
        sceneDescription: '', // 빈 프롬프트
        priority: 'normal'
      }

      const storyboardWithInvalidFrame = StoryboardModel.addFrame(storyboard, invalidFrameRequest)

      // When: 검증 실행
      const validation = StoryboardModel.validate(storyboardWithInvalidFrame)

      // Then: 프레임 검증 에러가 발생해야 함
      expect(validation.isValid).toBe(false)

      const frameError = validation.errors.find(error => error.code === 'FRAME_PROMPT_REQUIRED')
      expect(frameError).toBeDefined()
      expect(frameError?.frameId).toBeDefined()
    })
  })

  describe('Green Phase: 상수값 검증', () => {
    it('도메인 상수가 올바르게 정의되어야 함', () => {
      // Given & When & Then: 상수값 확인
      expect(STORYBOARD_CONSTANTS.MAX_TITLE_LENGTH).toBe(100)
      expect(STORYBOARD_CONSTANTS.MAX_DESCRIPTION_LENGTH).toBe(500)
      expect(STORYBOARD_CONSTANTS.MAX_FRAME_TITLE_LENGTH).toBe(50)
      expect(STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH).toBe(2000)
      expect(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT).toBe(100)
      expect(STORYBOARD_CONSTANTS.DEFAULT_QUALITY_THRESHOLD).toBe(0.7)
      expect(STORYBOARD_CONSTANTS.DEFAULT_MAX_RETRIES).toBe(3)
      expect(STORYBOARD_CONSTANTS.DEFAULT_BATCH_SIZE).toBe(5)
      expect(STORYBOARD_CONSTANTS.MIN_CONSISTENCY_WEIGHT).toBe(0.0)
      expect(STORYBOARD_CONSTANTS.MAX_CONSISTENCY_WEIGHT).toBe(1.0)
      expect(STORYBOARD_CONSTANTS.SUPPORTED_IMAGE_FORMATS).toEqual(['png', 'jpg', 'jpeg', 'webp'])
      expect(STORYBOARD_CONSTANTS.MAX_FILE_SIZE_MB).toBe(10)
    })
  })

  describe('Green Phase: 에지 케이스', () => {
    it('매우 긴 제목으로 스토리보드 생성 시 검증 에러가 발생해야 함', () => {
      // Given: 제한을 초과하는 긴 제목
      const longTitle = 'a'.repeat(STORYBOARD_CONSTANTS.MAX_TITLE_LENGTH + 1)

      const storyboard = StoryboardModel.create({
        scenarioId: 'scenario-long-title',
        title: longTitle,
        userId: 'user-long-title'
      })

      // When: 검증 실행
      const validation = StoryboardModel.validate(storyboard)

      // Then: 제목 길이 경고가 있어야 함 (경고는 warnings에 포함)
      expect(validation.warnings?.some(warning =>
        warning.includes('제목') || warning.includes('길이')
      )).toBeTruthy()
    })

    it('최대 프레임 수에 도달했을 때 적절히 처리해야 함', () => {
      // Given: 많은 프레임이 있는 스토리보드
      let storyboard = StoryboardModel.create({
        scenarioId: 'scenario-max-frames',
        title: '최대 프레임 테스트',
        userId: 'user-max-frames'
      })

      // 최대 프레임 수까지 추가
      for (let i = 0; i < STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT; i++) {
        const frameRequest: FrameGenerationRequest = {
          sceneId: `scene-${i}`,
          sceneDescription: `프레임 ${i + 1}`,
          priority: 'normal'
        }
        storyboard = StoryboardModel.addFrame(storyboard, frameRequest)
      }

      // When: 검증 실행
      const validation = StoryboardModel.validate(storyboard)

      // Then: 프레임 수 확인
      expect(storyboard.frames).toHaveLength(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT)
      expect(validation.statistics?.validFrames).toBe(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT)
    })
  })
})