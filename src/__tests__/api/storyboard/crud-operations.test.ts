/**
 * Storyboard CRUD Operations Tests
 *
 * TDD Red-Green-Refactor: 전체 CRUD 라이프사이클 테스트
 * CLAUDE.md 준수: TDD, 비용 안전 규칙, 결정론적 테스트
 *
 * 스토리보드의 전체 생명주기: Create → Read → Update → Delete
 */

import type {
  StoryboardCreateInput,
  Storyboard,
  StoryboardFrame,
  StoryboardMetadata,
  StoryboardSettings,
  StoryboardStatistics,
} from '../../../entities/storyboard'

/**
 * 스토리보드 저장소 인터페이스 (Repository Pattern)
 */
interface IStoryboardRepository {
  create(input: StoryboardCreateInput): Promise<Storyboard>
  findById(id: string): Promise<Storyboard | null>
  findByScenarioId(scenarioId: string): Promise<Storyboard[]>
  findByUserId(userId: string): Promise<Storyboard[]>
  update(id: string, updates: Partial<Storyboard>): Promise<Storyboard>
  delete(id: string): Promise<boolean>
  addFrame(storyboardId: string, frame: Omit<StoryboardFrame, 'metadata'>): Promise<StoryboardFrame>
  updateFrame(storyboardId: string, frameId: string, updates: Partial<StoryboardFrame>): Promise<StoryboardFrame>
  deleteFrame(storyboardId: string, frameId: string): Promise<boolean>
  reorderFrames(storyboardId: string, frameIds: string[]): Promise<boolean>
}

/**
 * 메모리 기반 스토리보드 저장소 구현 (테스트용)
 */
class InMemoryStoryboardRepository implements IStoryboardRepository {
  private storyboards = new Map<string, Storyboard>()
  private frames = new Map<string, Map<string, StoryboardFrame>>() // storyboardId -> frameId -> frame
  private idCounter = 1

  async create(input: StoryboardCreateInput): Promise<Storyboard> {
    const id = `storyboard-${this.idCounter++}`
    const now = new Date()

    const storyboard: Storyboard = {
      metadata: {
        id,
        scenarioId: input.scenarioId,
        title: input.title,
        description: input.description,
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        userId: input.userId,
        version: 1,
      },
      frames: [],
      settings: {
        defaultConfig: {
          model: 'seedream-4.0',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
          ...input.config,
        },
        globalConsistencyRefs: input.consistencyRefs || [],
        autoGeneration: false,
        qualityThreshold: 0.7,
        maxRetries: 3,
        batchSize: 5,
      },
      statistics: {
        totalFrames: 0,
        completedFrames: 0,
        failedFrames: 0,
        totalCost: 0,
        averageProcessingTime: 0,
        averageRating: 0,
      },
    }

    this.storyboards.set(id, storyboard)
    this.frames.set(id, new Map())

    return storyboard
  }

  async findById(id: string): Promise<Storyboard | null> {
    const storyboard = this.storyboards.get(id)
    if (!storyboard) return null

    // 프레임 정보 추가
    const frameMap = this.frames.get(id) || new Map()
    const frames = Array.from(frameMap.values()).sort((a, b) => a.metadata.order - b.metadata.order)

    return {
      ...storyboard,
      frames,
    }
  }

  async findByScenarioId(scenarioId: string): Promise<Storyboard[]> {
    const results: Storyboard[] = []

    for (const storyboard of this.storyboards.values()) {
      if (storyboard.metadata.scenarioId === scenarioId) {
        const fullStoryboard = await this.findById(storyboard.metadata.id)
        if (fullStoryboard) {
          results.push(fullStoryboard)
        }
      }
    }

    return results.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
  }

  async findByUserId(userId: string): Promise<Storyboard[]> {
    const results: Storyboard[] = []

    for (const storyboard of this.storyboards.values()) {
      if (storyboard.metadata.userId === userId) {
        const fullStoryboard = await this.findById(storyboard.metadata.id)
        if (fullStoryboard) {
          results.push(fullStoryboard)
        }
      }
    }

    return results.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
  }

  async update(id: string, updates: Partial<Storyboard>): Promise<Storyboard> {
    const existing = this.storyboards.get(id)
    if (!existing) {
      throw new Error('스토리보드를 찾을 수 없습니다')
    }

    const updated: Storyboard = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
        version: existing.metadata.version + 1,
      },
    }

    this.storyboards.set(id, updated)

    return this.findById(id) as Promise<Storyboard>
  }

  async delete(id: string): Promise<boolean> {
    const exists = this.storyboards.has(id)
    if (exists) {
      this.storyboards.delete(id)
      this.frames.delete(id)
    }
    return exists
  }

  async addFrame(storyboardId: string, frameData: Omit<StoryboardFrame, 'metadata'>): Promise<StoryboardFrame> {
    if (!this.storyboards.has(storyboardId)) {
      throw new Error('스토리보드를 찾을 수 없습니다')
    }

    const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const frameMap = this.frames.get(storyboardId) || new Map()

    const frame: StoryboardFrame = {
      ...frameData,
      metadata: {
        id: frameId,
        sceneId: frameData.prompt?.basePrompt || 'unknown',
        order: frameMap.size + 1,
        title: `프레임 ${frameMap.size + 1}`,
        description: frameData.prompt?.basePrompt || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending',
        userId: this.storyboards.get(storyboardId)!.metadata.userId,
      },
    }

    frameMap.set(frameId, frame)
    this.frames.set(storyboardId, frameMap)

    // 통계 업데이트
    await this.updateStatistics(storyboardId)

    return frame
  }

  async updateFrame(storyboardId: string, frameId: string, updates: Partial<StoryboardFrame>): Promise<StoryboardFrame> {
    const frameMap = this.frames.get(storyboardId)
    if (!frameMap) {
      throw new Error('스토리보드를 찾을 수 없습니다')
    }

    const existing = frameMap.get(frameId)
    if (!existing) {
      throw new Error('프레임을 찾을 수 없습니다')
    }

    const updated: StoryboardFrame = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    }

    frameMap.set(frameId, updated)

    // 통계 업데이트
    await this.updateStatistics(storyboardId)

    return updated
  }

  async deleteFrame(storyboardId: string, frameId: string): Promise<boolean> {
    const frameMap = this.frames.get(storyboardId)
    if (!frameMap) return false

    const deleted = frameMap.delete(frameId)

    if (deleted) {
      // 순서 재정렬
      const frames = Array.from(frameMap.values())
      frames.sort((a, b) => a.metadata.order - b.metadata.order)
      frames.forEach((frame, index) => {
        frame.metadata.order = index + 1
        frameMap.set(frame.metadata.id, frame)
      })

      // 통계 업데이트
      await this.updateStatistics(storyboardId)
    }

    return deleted
  }

  async reorderFrames(storyboardId: string, frameIds: string[]): Promise<boolean> {
    const frameMap = this.frames.get(storyboardId)
    if (!frameMap) return false

    // 순서 업데이트
    frameIds.forEach((frameId, index) => {
      const frame = frameMap.get(frameId)
      if (frame) {
        frame.metadata.order = index + 1
        frame.metadata.updatedAt = new Date()
        frameMap.set(frameId, frame)
      }
    })

    return true
  }

  private async updateStatistics(storyboardId: string): Promise<void> {
    const storyboard = this.storyboards.get(storyboardId)
    const frameMap = this.frames.get(storyboardId)

    if (!storyboard || !frameMap) return

    const frames = Array.from(frameMap.values())
    const completedFrames = frames.filter(f => f.metadata.status === 'completed')
    const failedFrames = frames.filter(f => f.metadata.status === 'failed')

    const totalCost = completedFrames.reduce((sum, frame) => sum + (frame.result?.cost || 0), 0)
    const totalProcessingTime = completedFrames.reduce((sum, frame) => sum + (frame.result?.processingTime || 0), 0)

    const statistics: StoryboardStatistics = {
      totalFrames: frames.length,
      completedFrames: completedFrames.length,
      failedFrames: failedFrames.length,
      totalCost: Math.round(totalCost * 100) / 100,
      averageProcessingTime: completedFrames.length > 0 ? totalProcessingTime / completedFrames.length : 0,
      averageRating: 0, // 구현 예정
    }

    storyboard.statistics = statistics
    storyboard.metadata.updatedAt = new Date()
    this.storyboards.set(storyboardId, storyboard)
  }

  // 테스트 헬퍼 메서드
  clear(): void {
    this.storyboards.clear()
    this.frames.clear()
    this.idCounter = 1
  }

  getAll(): Storyboard[] {
    return Array.from(this.storyboards.values())
  }
}

describe('Storyboard CRUD Operations Tests', () => {
  let repository: InMemoryStoryboardRepository

  beforeEach(() => {
    repository = new InMemoryStoryboardRepository()
  })

  describe('Red Phase: Create Operations (스토리보드 생성)', () => {
    it('유효한 입력으로 스토리보드를 생성할 수 있어야 함', async () => {
      // Given: 유효한 스토리보드 생성 입력
      const input: StoryboardCreateInput = {
        scenarioId: 'scenario-001',
        title: '테스트 스토리보드',
        description: '테스트용 스토리보드입니다',
        userId: 'user-001',
        config: {
          model: 'seedream-4.0',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
        },
        consistencyRefs: [],
      }

      // When: 스토리보드 생성
      const result = await repository.create(input)

      // Then: 올바른 스토리보드가 생성되어야 함
      expect(result.metadata.id).toBeDefined()
      expect(result.metadata.scenarioId).toBe('scenario-001')
      expect(result.metadata.title).toBe('테스트 스토리보드')
      expect(result.metadata.description).toBe('테스트용 스토리보드입니다')
      expect(result.metadata.userId).toBe('user-001')
      expect(result.metadata.status).toBe('draft')
      expect(result.metadata.version).toBe(1)
      expect(result.metadata.createdAt).toBeInstanceOf(Date)
      expect(result.metadata.updatedAt).toBeInstanceOf(Date)

      expect(result.frames).toEqual([])
      expect(result.settings.defaultConfig.model).toBe('seedream-4.0')
      expect(result.settings.defaultConfig.aspectRatio).toBe('16:9')
      expect(result.settings.globalConsistencyRefs).toEqual([])

      expect(result.statistics.totalFrames).toBe(0)
      expect(result.statistics.completedFrames).toBe(0)
      expect(result.statistics.totalCost).toBe(0)
    })

    it('최소 필수 정보만으로도 스토리보드를 생성할 수 있어야 함', async () => {
      // Given: 최소 필수 정보
      const minimalInput: StoryboardCreateInput = {
        scenarioId: 'scenario-002',
        title: '최소 스토리보드',
        userId: 'user-002',
      }

      // When: 스토리보드 생성
      const result = await repository.create(minimalInput)

      // Then: 기본값으로 채워져야 함
      expect(result.metadata.title).toBe('최소 스토리보드')
      expect(result.metadata.description).toBeUndefined()
      expect(result.settings.defaultConfig.model).toBe('seedream-4.0')
      expect(result.settings.defaultConfig.aspectRatio).toBe('16:9')
      expect(result.settings.globalConsistencyRefs).toEqual([])
    })

    it('동일 사용자가 여러 스토리보드를 생성할 수 있어야 함', async () => {
      // Given: 동일 사용자의 여러 스토리보드
      const inputs = [
        { scenarioId: 'scenario-001', title: '스토리보드 1', userId: 'user-001' },
        { scenarioId: 'scenario-002', title: '스토리보드 2', userId: 'user-001' },
        { scenarioId: 'scenario-003', title: '스토리보드 3', userId: 'user-001' },
      ]

      // When: 여러 스토리보드 생성
      const results = await Promise.all(inputs.map(input => repository.create(input)))

      // Then: 모든 스토리보드가 고유해야 함
      const ids = results.map(r => r.metadata.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3) // 모든 ID가 고유

      results.forEach((result, index) => {
        expect(result.metadata.title).toBe(inputs[index].title)
        expect(result.metadata.userId).toBe('user-001')
      })
    })
  })

  describe('Red Phase: Read Operations (스토리보드 조회)', () => {
    it('ID로 스토리보드를 조회할 수 있어야 함', async () => {
      // Given: 생성된 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: 'ID 조회 테스트',
        userId: 'user-001',
      })

      // When: ID로 조회
      const found = await repository.findById(created.metadata.id)

      // Then: 올바른 스토리보드가 반환되어야 함
      expect(found).toBeDefined()
      expect(found!.metadata.id).toBe(created.metadata.id)
      expect(found!.metadata.title).toBe('ID 조회 테스트')
      expect(found!.metadata.userId).toBe('user-001')
    })

    it('존재하지 않는 ID로 조회 시 null을 반환해야 함', async () => {
      // When: 존재하지 않는 ID로 조회
      const found = await repository.findById('non-existent-id')

      // Then: null이 반환되어야 함
      expect(found).toBeNull()
    })

    it('시나리오 ID로 스토리보드 목록을 조회할 수 있어야 함', async () => {
      // Given: 동일 시나리오의 여러 스토리보드
      const scenarioId = 'scenario-shared'
      await repository.create({ scenarioId, title: '스토리보드 A', userId: 'user-001' })
      await repository.create({ scenarioId, title: '스토리보드 B', userId: 'user-002' })
      await repository.create({ scenarioId: 'scenario-other', title: '다른 스토리보드', userId: 'user-001' })

      // When: 시나리오 ID로 조회
      const found = await repository.findByScenarioId(scenarioId)

      // Then: 해당 시나리오의 스토리보드들만 반환되어야 함
      expect(found).toHaveLength(2)
      expect(found.every(s => s.metadata.scenarioId === scenarioId)).toBe(true)

      const titles = found.map(s => s.metadata.title).sort()
      expect(titles).toEqual(['스토리보드 A', '스토리보드 B'])
    })

    it('사용자 ID로 스토리보드 목록을 조회할 수 있어야 함', async () => {
      // Given: 동일 사용자의 여러 스토리보드
      const userId = 'user-shared'
      await repository.create({ scenarioId: 'scenario-001', title: '내 스토리보드 1', userId })
      await repository.create({ scenarioId: 'scenario-002', title: '내 스토리보드 2', userId })
      await repository.create({ scenarioId: 'scenario-003', title: '다른 사용자', userId: 'other-user' })

      // When: 사용자 ID로 조회
      const found = await repository.findByUserId(userId)

      // Then: 해당 사용자의 스토리보드들만 반환되어야 함
      expect(found).toHaveLength(2)
      expect(found.every(s => s.metadata.userId === userId)).toBe(true)

      const titles = found.map(s => s.metadata.title).sort()
      expect(titles).toEqual(['내 스토리보드 1', '내 스토리보드 2'])
    })

    it('조회 결과가 생성일 역순으로 정렬되어야 함', async () => {
      // Given: 시간차를 두고 생성된 스토리보드들
      const storyboards = []
      for (let i = 1; i <= 3; i++) {
        const sb = await repository.create({
          scenarioId: 'scenario-001',
          title: `스토리보드 ${i}`,
          userId: 'user-001',
        })
        storyboards.push(sb)

        // 시간차 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // When: 시나리오별 조회
      const found = await repository.findByScenarioId('scenario-001')

      // Then: 최신순으로 정렬되어야 함
      expect(found).toHaveLength(3)
      expect(found[0].metadata.title).toBe('스토리보드 3') // 가장 최신
      expect(found[1].metadata.title).toBe('스토리보드 2')
      expect(found[2].metadata.title).toBe('스토리보드 1') // 가장 오래된
    })
  })

  describe('Red Phase: Update Operations (스토리보드 수정)', () => {
    it('스토리보드 메타데이터를 수정할 수 있어야 함', async () => {
      // Given: 생성된 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: '원본 제목',
        description: '원본 설명',
        userId: 'user-001',
      })

      // 시간차 확보를 위한 지연
      await new Promise(resolve => setTimeout(resolve, 10))

      // When: 메타데이터 수정
      const updated = await repository.update(created.metadata.id, {
        metadata: {
          ...created.metadata,
          title: '수정된 제목',
          description: '수정된 설명',
          status: 'in_progress',
        },
      })

      // Then: 수정사항이 반영되어야 함
      expect(updated.metadata.title).toBe('수정된 제목')
      expect(updated.metadata.description).toBe('수정된 설명')
      expect(updated.metadata.status).toBe('in_progress')
      expect(updated.metadata.version).toBe(2) // 버전 증가
      expect(updated.metadata.updatedAt.getTime()).toBeGreaterThan(created.metadata.updatedAt.getTime())

      // 변경되지 않은 필드는 유지되어야 함
      expect(updated.metadata.id).toBe(created.metadata.id)
      expect(updated.metadata.scenarioId).toBe(created.metadata.scenarioId)
      expect(updated.metadata.userId).toBe(created.metadata.userId)
      expect(updated.metadata.createdAt).toEqual(created.metadata.createdAt)
    })

    it('스토리보드 설정을 수정할 수 있어야 함', async () => {
      // Given: 생성된 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: '설정 테스트',
        userId: 'user-001',
      })

      // When: 설정 수정
      const newSettings: StoryboardSettings = {
        defaultConfig: {
          model: 'dall-e-3',
          aspectRatio: '9:16',
          quality: '4k',
          style: 'anime',
        },
        globalConsistencyRefs: [
          {
            id: 'ref-001',
            type: 'character',
            name: '주인공 스타일',
            description: '일관된 주인공 외모',
            referenceImageUrl: 'https://example.com/ref.jpg',
            keyFeatures: ['갈색 머리', '파란 눈'],
            weight: 0.8,
            isActive: true,
          },
        ],
        autoGeneration: true,
        qualityThreshold: 0.9,
        maxRetries: 5,
        batchSize: 3,
      }

      const updated = await repository.update(created.metadata.id, {
        settings: newSettings,
      })

      // Then: 설정이 변경되어야 함
      expect(updated.settings.defaultConfig.model).toBe('dall-e-3')
      expect(updated.settings.defaultConfig.aspectRatio).toBe('9:16')
      expect(updated.settings.defaultConfig.quality).toBe('4k')
      expect(updated.settings.defaultConfig.style).toBe('anime')
      expect(updated.settings.globalConsistencyRefs).toHaveLength(1)
      expect(updated.settings.globalConsistencyRefs[0].name).toBe('주인공 스타일')
      expect(updated.settings.autoGeneration).toBe(true)
      expect(updated.settings.qualityThreshold).toBe(0.9)
      expect(updated.settings.maxRetries).toBe(5)
      expect(updated.settings.batchSize).toBe(3)
    })

    it('존재하지 않는 스토리보드 수정 시 에러가 발생해야 함', async () => {
      // When & Then: 존재하지 않는 ID로 수정 시도
      await expect(repository.update('non-existent-id', {
        metadata: { title: '새 제목' } as any,
      })).rejects.toThrow('스토리보드를 찾을 수 없습니다')
    })

    it('부분 수정이 가능해야 함', async () => {
      // Given: 생성된 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: '부분 수정 테스트',
        description: '원본 설명',
        userId: 'user-001',
      })

      // When: 제목만 수정
      const updated = await repository.update(created.metadata.id, {
        metadata: {
          ...created.metadata,
          title: '수정된 제목',
        },
      })

      // Then: 제목만 변경되고 나머지는 유지되어야 함
      expect(updated.metadata.title).toBe('수정된 제목')
      expect(updated.metadata.description).toBe('원본 설명') // 유지
      expect(updated.metadata.scenarioId).toBe('scenario-001') // 유지
      expect(updated.metadata.userId).toBe('user-001') // 유지
    })
  })

  describe('Red Phase: Delete Operations (스토리보드 삭제)', () => {
    it('스토리보드를 삭제할 수 있어야 함', async () => {
      // Given: 생성된 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: '삭제 테스트',
        userId: 'user-001',
      })

      // When: 삭제
      const deleted = await repository.delete(created.metadata.id)

      // Then: 삭제 성공 및 조회 불가
      expect(deleted).toBe(true)

      const found = await repository.findById(created.metadata.id)
      expect(found).toBeNull()
    })

    it('존재하지 않는 스토리보드 삭제 시 false를 반환해야 함', async () => {
      // When: 존재하지 않는 ID로 삭제 시도
      const deleted = await repository.delete('non-existent-id')

      // Then: false 반환
      expect(deleted).toBe(false)
    })

    it('스토리보드 삭제 시 관련 프레임도 함께 삭제되어야 함', async () => {
      // Given: 프레임이 있는 스토리보드
      const created = await repository.create({
        scenarioId: 'scenario-001',
        title: '프레임 포함 삭제 테스트',
        userId: 'user-001',
      })

      // 프레임 추가
      await repository.addFrame(created.metadata.id, {
        prompt: {
          basePrompt: '테스트 프레임',
          enhancedPrompt: '테스트 프레임 향상',
          styleModifiers: [],
          technicalSpecs: [],
        },
        config: {
          model: 'seedream-4.0',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
        },
        consistencyRefs: [],
        attempts: [],
      })

      // When: 스토리보드 삭제
      const deleted = await repository.delete(created.metadata.id)

      // Then: 스토리보드와 프레임 모두 삭제됨
      expect(deleted).toBe(true)
      const found = await repository.findById(created.metadata.id)
      expect(found).toBeNull()
    })
  })

  describe('Red Phase: Frame Operations (프레임 관리)', () => {
    let storyboard: Storyboard

    beforeEach(async () => {
      storyboard = await repository.create({
        scenarioId: 'scenario-001',
        title: '프레임 테스트 스토리보드',
        userId: 'user-001',
      })
    })

    it('스토리보드에 프레임을 추가할 수 있어야 함', async () => {
      // Given: 프레임 데이터
      const frameData = {
        prompt: {
          basePrompt: '주인공이 커피숍에 들어오는 모습',
          enhancedPrompt: '주인공이 커피숍에 들어오는 모습, cinematic lighting',
          styleModifiers: ['cinematic lighting'],
          technicalSpecs: ['16:9 aspect ratio'],
        },
        config: {
          model: 'seedream-4.0' as const,
          aspectRatio: '16:9' as const,
          quality: 'hd' as const,
          style: 'cinematic' as const,
        },
        consistencyRefs: [],
        attempts: [],
      }

      // When: 프레임 추가
      const frame = await repository.addFrame(storyboard.metadata.id, frameData)

      // Then: 프레임이 생성되어야 함
      expect(frame.metadata.id).toBeDefined()
      expect(frame.metadata.order).toBe(1)
      expect(frame.metadata.status).toBe('pending')
      expect(frame.metadata.userId).toBe('user-001')
      expect(frame.prompt.basePrompt).toBe('주인공이 커피숍에 들어오는 모습')
      expect(frame.config.model).toBe('seedream-4.0')

      // 스토리보드 통계 업데이트 확인
      const updated = await repository.findById(storyboard.metadata.id)
      expect(updated!.statistics.totalFrames).toBe(1)
      expect(updated!.frames).toHaveLength(1)
      expect(updated!.frames[0].metadata.id).toBe(frame.metadata.id)
    })

    it('여러 프레임의 순서가 올바르게 관리되어야 함', async () => {
      // Given: 여러 프레임 추가
      const frames = []
      for (let i = 1; i <= 3; i++) {
        const frame = await repository.addFrame(storyboard.metadata.id, {
          prompt: {
            basePrompt: `프레임 ${i}`,
            enhancedPrompt: `프레임 ${i} 향상`,
            styleModifiers: [],
            technicalSpecs: [],
          },
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          consistencyRefs: [],
          attempts: [],
        })
        frames.push(frame)
      }

      // When: 스토리보드 조회
      const updated = await repository.findById(storyboard.metadata.id)

      // Then: 순서대로 정렬되어야 함
      expect(updated!.frames).toHaveLength(3)
      expect(updated!.frames[0].metadata.order).toBe(1)
      expect(updated!.frames[1].metadata.order).toBe(2)
      expect(updated!.frames[2].metadata.order).toBe(3)
      expect(updated!.frames[0].prompt.basePrompt).toBe('프레임 1')
      expect(updated!.frames[1].prompt.basePrompt).toBe('프레임 2')
      expect(updated!.frames[2].prompt.basePrompt).toBe('프레임 3')
    })

    it('프레임을 수정할 수 있어야 함', async () => {
      // Given: 프레임 추가
      const frame = await repository.addFrame(storyboard.metadata.id, {
        prompt: { basePrompt: '원본 프롬프트', enhancedPrompt: '원본', styleModifiers: [], technicalSpecs: [] },
        config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
        consistencyRefs: [],
        attempts: [],
      })

      // When: 프레임 수정
      const updated = await repository.updateFrame(storyboard.metadata.id, frame.metadata.id, {
        metadata: {
          ...frame.metadata,
          status: 'completed',
          title: '수정된 프레임',
        },
        result: {
          imageUrl: 'https://example.com/generated.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          generationId: 'gen-123',
          model: 'seedream-4.0',
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          prompt: { basePrompt: '원본 프롬프트', enhancedPrompt: '원본', styleModifiers: [], technicalSpecs: [] },
          generatedAt: new Date(),
          processingTime: 15.5,
          cost: 0.05,
        },
      })

      // Then: 수정사항이 반영되어야 함
      expect(updated.metadata.status).toBe('completed')
      expect(updated.metadata.title).toBe('수정된 프레임')
      expect(updated.result).toBeDefined()
      expect(updated.result!.imageUrl).toBe('https://example.com/generated.jpg')
      expect(updated.result!.cost).toBe(0.05)
    })

    it('프레임을 삭제할 수 있어야 함', async () => {
      // Given: 여러 프레임 추가
      const frames = []
      for (let i = 1; i <= 3; i++) {
        const frame = await repository.addFrame(storyboard.metadata.id, {
          prompt: { basePrompt: `프레임 ${i}`, enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          consistencyRefs: [],
          attempts: [],
        })
        frames.push(frame)
      }

      // When: 중간 프레임 삭제
      const deleted = await repository.deleteFrame(storyboard.metadata.id, frames[1].metadata.id)

      // Then: 삭제 성공 및 순서 재정렬
      expect(deleted).toBe(true)

      const updated = await repository.findById(storyboard.metadata.id)
      expect(updated!.frames).toHaveLength(2)
      expect(updated!.frames[0].prompt.basePrompt).toBe('프레임 1')
      expect(updated!.frames[1].prompt.basePrompt).toBe('프레임 3')
      expect(updated!.frames[0].metadata.order).toBe(1)
      expect(updated!.frames[1].metadata.order).toBe(2) // 재정렬됨
    })

    it('프레임 순서를 변경할 수 있어야 함', async () => {
      // Given: 3개 프레임 추가
      const frames = []
      for (let i = 1; i <= 3; i++) {
        const frame = await repository.addFrame(storyboard.metadata.id, {
          prompt: { basePrompt: `프레임 ${i}`, enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          consistencyRefs: [],
          attempts: [],
        })
        frames.push(frame)
      }

      // When: 순서 변경 (3, 1, 2 순서로)
      const newOrder = [frames[2].metadata.id, frames[0].metadata.id, frames[1].metadata.id]
      const reordered = await repository.reorderFrames(storyboard.metadata.id, newOrder)

      // Then: 순서가 변경되어야 함
      expect(reordered).toBe(true)

      const updated = await repository.findById(storyboard.metadata.id)
      expect(updated!.frames[0].prompt.basePrompt).toBe('프레임 3')
      expect(updated!.frames[1].prompt.basePrompt).toBe('프레임 1')
      expect(updated!.frames[2].prompt.basePrompt).toBe('프레임 2')
    })
  })

  describe('Red Phase: Statistics and Analytics (통계 및 분석)', () => {
    let storyboard: Storyboard

    beforeEach(async () => {
      storyboard = await repository.create({
        scenarioId: 'scenario-001',
        title: '통계 테스트 스토리보드',
        userId: 'user-001',
      })
    })

    it('프레임 추가 시 통계가 업데이트되어야 함', async () => {
      // Given: 초기 통계 확인
      let current = await repository.findById(storyboard.metadata.id)
      expect(current!.statistics.totalFrames).toBe(0)

      // When: 프레임 추가
      await repository.addFrame(storyboard.metadata.id, {
        prompt: { basePrompt: '테스트', enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
        config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
        consistencyRefs: [],
        attempts: [],
      })

      // Then: 통계 업데이트
      current = await repository.findById(storyboard.metadata.id)
      expect(current!.statistics.totalFrames).toBe(1)
      expect(current!.statistics.completedFrames).toBe(0)
      expect(current!.statistics.failedFrames).toBe(0)
    })

    it('완료된 프레임의 비용과 처리 시간이 통계에 반영되어야 함', async () => {
      // Given: 프레임 추가 및 완료 처리
      const frame = await repository.addFrame(storyboard.metadata.id, {
        prompt: { basePrompt: '테스트', enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
        config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
        consistencyRefs: [],
        attempts: [],
      })

      // When: 프레임 완료 처리
      await repository.updateFrame(storyboard.metadata.id, frame.metadata.id, {
        metadata: { ...frame.metadata, status: 'completed' },
        result: {
          imageUrl: 'https://example.com/test.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          generationId: 'gen-001',
          model: 'seedream-4.0',
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          prompt: { basePrompt: '테스트', enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
          generatedAt: new Date(),
          processingTime: 12.5,
          cost: 0.05,
        },
      })

      // Then: 통계 반영
      const updated = await repository.findById(storyboard.metadata.id)
      expect(updated!.statistics.totalFrames).toBe(1)
      expect(updated!.statistics.completedFrames).toBe(1)
      expect(updated!.statistics.failedFrames).toBe(0)
      expect(updated!.statistics.totalCost).toBe(0.05)
      expect(updated!.statistics.averageProcessingTime).toBe(12.5)
    })

    it('여러 프레임의 통계가 정확하게 집계되어야 함', async () => {
      // Given: 여러 상태의 프레임들
      const frames = []

      // 완료된 프레임 2개
      for (let i = 1; i <= 2; i++) {
        const frame = await repository.addFrame(storyboard.metadata.id, {
          prompt: { basePrompt: `완료 프레임 ${i}`, enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
          config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
          consistencyRefs: [],
          attempts: [],
        })

        await repository.updateFrame(storyboard.metadata.id, frame.metadata.id, {
          metadata: { ...frame.metadata, status: 'completed' },
          result: {
            imageUrl: `https://example.com/test${i}.jpg`,
            thumbnailUrl: `https://example.com/thumb${i}.jpg`,
            generationId: `gen-${i}`,
            model: 'seedream-4.0',
            config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
            prompt: { basePrompt: `완료 프레임 ${i}`, enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
            generatedAt: new Date(),
            processingTime: 10 + i, // 11, 12
            cost: 0.05,
          },
        })
        frames.push(frame)
      }

      // 실패한 프레임 1개
      const failedFrame = await repository.addFrame(storyboard.metadata.id, {
        prompt: { basePrompt: '실패 프레임', enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
        config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
        consistencyRefs: [],
        attempts: [],
      })

      await repository.updateFrame(storyboard.metadata.id, failedFrame.metadata.id, {
        metadata: { ...failedFrame.metadata, status: 'failed' },
      })

      // 대기 중인 프레임 1개
      await repository.addFrame(storyboard.metadata.id, {
        prompt: { basePrompt: '대기 프레임', enhancedPrompt: '', styleModifiers: [], technicalSpecs: [] },
        config: { model: 'seedream-4.0', aspectRatio: '16:9', quality: 'hd', style: 'cinematic' },
        consistencyRefs: [],
        attempts: [],
      })

      // When: 통계 확인
      const updated = await repository.findById(storyboard.metadata.id)

      // Then: 정확한 통계
      expect(updated!.statistics.totalFrames).toBe(4)
      expect(updated!.statistics.completedFrames).toBe(2)
      expect(updated!.statistics.failedFrames).toBe(1)
      expect(updated!.statistics.totalCost).toBe(0.10) // 2 * 0.05
      expect(updated!.statistics.averageProcessingTime).toBe(11.5) // (11 + 12) / 2
    })
  })
})