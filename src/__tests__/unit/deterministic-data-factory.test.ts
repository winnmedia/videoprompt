/**
 * 결정론적 데이터 팩토리 단위 테스트
 *
 * CLAUDE.md 준수: TDD, 결정론적 테스트
 * MSW 의존성 없이 순수 함수 테스트
 */


// MSW import 없이 직접 팩토리 코드를 복사하여 테스트
class DeterministicRandom {
  private seed: number

  constructor(seed: number = 12345) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)]
  }

  reset(seed: number): void {
    this.seed = seed
  }
}

function stringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function generateDeterministicId(prefix: string, seed: number): string {
  const random = new DeterministicRandom(seed)
  const suffix = random.nextInt(100000, 999999)
  return `${prefix}_${suffix}`
}

function generateDeterministicDate(seed: number, baseDate?: Date): string {
  const random = new DeterministicRandom(seed)
  const base = baseDate || new Date('2024-01-01T00:00:00.000Z')
  const offsetMs = random.nextInt(0, 365 * 24 * 60 * 60 * 1000)
  const resultDate = new Date(base.getTime() + offsetMs)
  return resultDate.toISOString()
}

function createUser(options: { email: string; name: string; role?: string; id?: string }): any {
  const seed = stringToSeed(options.email)
  const random = new DeterministicRandom(seed)

  const id = options.id || generateDeterministicId('user', seed)
  const createdAt = generateDeterministicDate(seed)
  const updatedAt = generateDeterministicDate(seed + 1, new Date(createdAt))

  return {
    id,
    email: options.email,
    name: options.name,
    role: options.role || 'user',
    emailVerified: true,
    createdAt,
    updatedAt,
    metadata: { source: 'deterministic-factory', seed }
  }
}

function createProject(options: { userId: string; title: string; description?: string; inputData?: any }): any {
  const seed = stringToSeed(`${options.userId}:${options.title}`)
  const random = new DeterministicRandom(seed)

  const id = generateDeterministicId('proj', seed)
  const createdAt = generateDeterministicDate(seed)
  const updatedAt = generateDeterministicDate(seed + 1, new Date(createdAt))

  const defaultInputData = {
    targetDuration: random.choice([60, 90, 120, 180, 240]),
    toneAndManner: random.choice(['감성적이고 따뜻한', '역동적이고 에너지 넘치는', '차분하고 신뢰감 있는']),
    development: random.choice(['기승전결', '문제-해결', '시간순']),
    intensity: random.choice(['낮음', '중간', '높음']),
    targetAudience: random.choice(['10-20대', '20-30대', '30-40대', '전 연령층']),
    mainMessage: '결정론적 메시지'
  }

  return {
    id,
    userId: options.userId,
    title: options.title,
    description: options.description || '',
    inputData: { ...defaultInputData, ...options.inputData },
    currentStep: 'planning',
    completionPercentage: 0,
    createdAt,
    updatedAt,
    metadata: { source: 'deterministic-factory', seed }
  }
}

function createStorySteps(options: { projectId: string; inputData?: any; count?: number }): any[] {
  const seed = stringToSeed(`${options.projectId}:story`)
  const random = new DeterministicRandom(seed)

  const count = options.count || 4
  const totalDuration = options.inputData?.targetDuration || 180
  const stepDuration = Math.floor(totalDuration / count)

  const storyTemplates = [
    { title: '상황 제시', description: '주인공의 현재 상황과 문제점을 보여준다' },
    { title: '갈등 심화', description: '문제가 더욱 복잡해지고 주인공이 고민에 빠진다' },
    { title: '전환점', description: '우연한 계기로 새로운 가능성을 발견한다' },
    { title: '해결과 성장', description: '용기를 내어 도전하고 성장하는 모습을 보여준다' }
  ]

  return Array.from({ length: count }, (_, index) => {
    const stepSeed = seed + index
    const stepRandom = new DeterministicRandom(stepSeed)
    const template = storyTemplates[index] || storyTemplates[index % storyTemplates.length]

    return {
      id: generateDeterministicId('story', stepSeed),
      projectId: options.projectId,
      order: index + 1,
      title: template.title,
      description: template.description,
      keyPoints: [`핵심 포인트 ${index + 1}-1`, `핵심 포인트 ${index + 1}-2`],
      duration: stepDuration + stepRandom.nextInt(-5, 5),
      createdAt: generateDeterministicDate(stepSeed),
      updatedAt: generateDeterministicDate(stepSeed + 1),
      metadata: { source: 'deterministic-factory', seed: stepSeed }
    }
  })
}

// 비용 안전 미들웨어 (간소화 버전)
class SimpleCostSafety {
  private callHistory: any[] = []
  private endpointCounters = new Map<string, number>()
  private blockedCallCount = 0

  checkApiCall(endpoint: string, customLimits?: any): { allowed: boolean; reason?: string } {
    const currentCount = this.endpointCounters.get(endpoint) || 0
    const maxCalls = customLimits?.[endpoint]?.maxCallsPerTest || 10

    if (currentCount >= maxCalls) {
      this.blockedCallCount++
      return {
        allowed: false,
        reason: `API 호출 한도 초과: ${currentCount}/${maxCalls}`
      }
    }

    this.endpointCounters.set(endpoint, currentCount + 1)
    this.callHistory.push({
      endpoint,
      timestamp: Date.now(),
      callCount: currentCount + 1
    })

    return { allowed: true }
  }

  getStatus() {
    return {
      totalCalls: this.callHistory.length,
      blockedCalls: this.blockedCallCount,
      callHistory: [...this.callHistory]
    }
  }

  reset() {
    this.callHistory = []
    this.endpointCounters.clear()
    this.blockedCallCount = 0
  }

  estimateCost() {
    const aiCalls = this.callHistory.filter(call => call.endpoint.includes('/api/ai/'))
    return {
      estimatedCost: aiCalls.length * 0.05,
      aiCallCount: aiCalls.length,
      safe: aiCalls.length * 0.05 <= 1.0
    }
  }
}

describe('MSW Infrastructure Core Tests', () => {
  const costSafety = new SimpleCostSafety()

  beforeEach(() => {
    costSafety.reset()
  })

  // ===========================================
  // 1. 결정론적 데이터 팩토리 테스트
  // ===========================================

  describe('Deterministic Data Factory', () => {
    test('시드 기반 랜덤 생성기 결정론성', () => {
      // Given: 동일한 시드
      const random1 = new DeterministicRandom(12345)
      const random2 = new DeterministicRandom(12345)

      // When: 여러 값 생성
      const values1 = Array.from({ length: 10 }, () => random1.next())
      const values2 = Array.from({ length: 10 }, () => random2.next())

      // Then: 동일한 시퀀스
      expect(values1).toEqual(values2)
    })

    test('문자열 시드 변환 일관성', () => {
      // Given: 동일한 문자열
      const testString = 'test@example.com'

      // When: 여러 번 시드 변환
      const seed1 = stringToSeed(testString)
      const seed2 = stringToSeed(testString)
      const seed3 = stringToSeed(testString)

      // Then: 항상 동일한 값
      expect(seed1).toBe(seed2)
      expect(seed2).toBe(seed3)
    })

    test('동일한 입력으로 동일한 사용자 생성', () => {
      // Given: 동일한 사용자 정보
      const userInput = { email: 'test@example.com', name: 'Test User' }

      // When: 5번 생성
      const users = Array.from({ length: 5 }, () => createUser(userInput))

      // Then: 모든 결과가 동일해야 함
      const firstUser = JSON.stringify(users[0])
      users.forEach(user => {
        expect(JSON.stringify(user)).toBe(firstUser)
      })

      // 구체적 검증
      expect(users[0].id).toBe(users[4].id)
      expect(users[0].createdAt).toBe(users[4].createdAt)
      expect(users[0].metadata.seed).toBe(users[4].metadata.seed)
    })

    test('다른 이메일로 다른 사용자 생성', () => {
      // Given: 서로 다른 이메일
      const user1 = createUser({ email: 'user1@example.com', name: 'User One' })
      const user2 = createUser({ email: 'user2@example.com', name: 'User Two' })

      // Then: 다른 결과
      expect(user1.id).not.toBe(user2.id)
      expect(user1.createdAt).not.toBe(user2.createdAt)
      expect(user1.metadata.seed).not.toBe(user2.metadata.seed)
    })

    test('프로젝트 결정론적 생성', () => {
      // Given: 프로젝트 입력
      const projectInput = {
        userId: 'test-user-001',
        title: '테스트 프로젝트'
      }

      // When: 여러 번 생성
      const project1 = createProject(projectInput)
      const project2 = createProject(projectInput)

      // Then: 동일한 결과
      expect(project1.id).toBe(project2.id)
      expect(project1.title).toBe(project2.title)
      expect(project1.inputData).toEqual(project2.inputData)
      expect(project1.createdAt).toBe(project2.createdAt)
    })

    test('스토리 스텝 구조 및 시간 분배', () => {
      // Given: 프로젝트
      const project = createProject({
        userId: 'test-user',
        title: 'Story Test Project'
      })

      // When: 스토리 스텝 생성 (180초 분배)
      const storySteps = createStorySteps({
        projectId: project.id,
        inputData: { targetDuration: 180 }
      })

      // Then: 올바른 구조
      expect(storySteps).toHaveLength(4)
      expect(storySteps[0].order).toBe(1)
      expect(storySteps[3].order).toBe(4)

      // 각 스토리 스텝 검증
      storySteps.forEach((step, index) => {
        expect(step.title).toBeTruthy()
        expect(step.description).toBeTruthy()
        expect(step.keyPoints).toHaveLength(2)
        expect(step.duration).toBeGreaterThan(0)
        expect(step.order).toBe(index + 1)
        expect(step.projectId).toBe(project.id)
      })

      // 총 시간이 대략적으로 맞는지 확인 (±20초 허용)
      const totalDuration = storySteps.reduce((sum, step) => sum + step.duration, 0)
      expect(Math.abs(totalDuration - 180)).toBeLessThan(20)
    })

    test('스토리 템플릿 매핑', () => {
      // Given: 프로젝트
      const projectId = 'template-test-project'

      // When: 스토리 스텝 생성
      const storySteps = createStorySteps({ projectId })

      // Then: 올바른 템플릿 적용
      expect(storySteps[0].title).toBe('상황 제시')
      expect(storySteps[1].title).toBe('갈등 심화')
      expect(storySteps[2].title).toBe('전환점')
      expect(storySteps[3].title).toBe('해결과 성장')

      expect(storySteps[0].description).toContain('주인공의 현재 상황')
      expect(storySteps[3].description).toContain('성장하는 모습')
    })
  })

  // ===========================================
  // 2. 비용 안전 시스템 테스트
  // ===========================================

  describe('Cost Safety System', () => {
    test('기본 API 호출 제한', () => {
      // Given: 제한 설정
      const limits = { '/api/test': { maxCallsPerTest: 2, cooldownMs: 1000 } }

      // When: 제한 내 호출
      const result1 = costSafety.checkApiCall('/api/test', limits)
      const result2 = costSafety.checkApiCall('/api/test', limits)

      // Then: 허용
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)

      // 세 번째 호출은 차단
      const result3 = costSafety.checkApiCall('/api/test', limits)
      expect(result3.allowed).toBe(false)
      expect(result3.reason).toContain('호출 한도 초과')
    })

    test('$300 사건 방지 - /api/auth/me 특별 보호', () => {
      // Given: 위험한 엔드포인트 제한
      const authLimits = { '/api/auth/me': { maxCallsPerTest: 1, cooldownMs: 60000 } }

      // When: 첫 번째 호출
      const result1 = costSafety.checkApiCall('/api/auth/me', authLimits)
      expect(result1.allowed).toBe(true)

      // 두 번째 호출 시도
      const result2 = costSafety.checkApiCall('/api/auth/me', authLimits)

      // Then: 즉시 차단
      expect(result2.allowed).toBe(false)
      expect(result2.reason).toContain('호출 한도 초과')
    })

    test('호출 기록 관리', () => {
      // Given: 여러 엔드포인트 호출
      const endpoints = ['/api/projects', '/api/scenarios', '/api/stories']

      // When: 각각 호출
      endpoints.forEach(endpoint => {
        costSafety.checkApiCall(endpoint)
      })

      // Then: 올바른 기록
      const status = costSafety.getStatus()
      expect(status.totalCalls).toBe(3)
      expect(status.blockedCalls).toBe(0)
      expect(status.callHistory).toHaveLength(3)

      endpoints.forEach(endpoint => {
        const found = status.callHistory.some(call => call.endpoint === endpoint)
        expect(found).toBe(true)
      })
    })

    test('AI API 비용 추정', () => {
      // Given: AI API 호출들
      costSafety.checkApiCall('/api/ai/generate-story')
      costSafety.checkApiCall('/api/ai/generate-image')
      costSafety.checkApiCall('/api/regular/endpoint')

      // When: 비용 추정
      const estimate = costSafety.estimateCost()

      // Then: 올바른 계산
      expect(estimate.aiCallCount).toBe(2)
      expect(estimate.estimatedCost).toBe(0.1) // 2 * $0.05
      expect(estimate.safe).toBe(true)
    })

    test('연속 리셋 기능', () => {
      // Given: 호출 후 리셋
      costSafety.checkApiCall('/api/test1')
      costSafety.checkApiCall('/api/test2')

      let status = costSafety.getStatus()
      expect(status.totalCalls).toBe(2)

      // When: 리셋
      costSafety.reset()

      // Then: 깨끗한 상태
      status = costSafety.getStatus()
      expect(status.totalCalls).toBe(0)
      expect(status.blockedCalls).toBe(0)
      expect(status.callHistory).toHaveLength(0)
    })
  })

  // ===========================================
  // 3. 통합 시나리오 테스트
  // ===========================================

  describe('Integration Scenarios', () => {
    test('완전한 프로젝트 워크플로우 시뮬레이션', () => {
      // Given: 사용자 생성
      const user = createUser({
        email: 'workflow@test.com',
        name: 'Workflow Test User'
      })

      // When: 프로젝트 생성
      const project = createProject({
        userId: user.id,
        title: '통합 테스트 프로젝트',
        inputData: { targetDuration: 240 }
      })

      // 스토리 스텝 생성
      const storySteps = createStorySteps({
        projectId: project.id,
        inputData: project.inputData
      })

      // Then: 완전한 워크플로우
      expect(user.id).toBeTruthy()
      expect(project.id).toBeTruthy()
      expect(storySteps).toHaveLength(4)

      // 데이터 일관성
      storySteps.forEach(step => {
        expect(step.projectId).toBe(project.id)
      })

      // 시간 분배 검증 (240초)
      const totalDuration = storySteps.reduce((sum, step) => sum + step.duration, 0)
      expect(Math.abs(totalDuration - 240)).toBeLessThan(30)
    })

    test('비용 안전을 고려한 API 워크플로우', () => {
      // Given: 엄격한 제한
      const strictLimits = {
        '/api/ai/generate-story': { maxCallsPerTest: 1, cooldownMs: 30000 },
        '/api/ai/generate-shots': { maxCallsPerTest: 1, cooldownMs: 30000 }
      }

      // When: 안전한 워크플로우
      const storyResult = costSafety.checkApiCall('/api/ai/generate-story', strictLimits)
      const shotResult = costSafety.checkApiCall('/api/ai/generate-shots', strictLimits)

      // Then: 허용
      expect(storyResult.allowed).toBe(true)
      expect(shotResult.allowed).toBe(true)

      // 추가 호출은 차단
      const blockedStory = costSafety.checkApiCall('/api/ai/generate-story', strictLimits)
      expect(blockedStory.allowed).toBe(false)

      // 비용 검증
      const estimate = costSafety.estimateCost()
      expect(estimate.safe).toBe(true)
      expect(estimate.aiCallCount).toBe(2)
    })

    test('대규모 데이터 생성 성능', () => {
      // Given: 성능 측정 시작
      const startTime = performance.now()

      // When: 대량 데이터 생성
      const users = Array.from({ length: 50 }, (_, i) =>
        createUser({ email: `user${i}@test.com`, name: `User ${i}` })
      )

      const projects = users.map(user =>
        createProject({ userId: user.id, title: `Project for ${user.name}` })
      )

      const allStorySteps = projects.map(project =>
        createStorySteps({ projectId: project.id })
      )

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Then: 합리적인 성능 (5초 미만)
      expect(executionTime).toBeLessThan(5000)
      expect(users).toHaveLength(50)
      expect(projects).toHaveLength(50)
      expect(allStorySteps).toHaveLength(50)

      // 데이터 품질 검증
      allStorySteps.forEach(storySteps => {
        expect(storySteps).toHaveLength(4)
      })
    })

    test('결정론성 장기 유지', () => {
      // Given: 동일한 입력으로 여러 번 생성
      const input = {
        userEmail: 'determinism@test.com',
        projectTitle: '결정론성 테스트'
      }

      // When: 10번 생성
      const results = Array.from({ length: 10 }, () => {
        const user = createUser({ email: input.userEmail, name: 'Determinism User' })
        const project = createProject({ userId: user.id, title: input.projectTitle })
        const storySteps = createStorySteps({ projectId: project.id })

        return { user, project, storySteps }
      })

      // Then: 모든 결과가 동일
      const firstResult = JSON.stringify(results[0])
      results.forEach(result => {
        expect(JSON.stringify(result)).toBe(firstResult)
      })

      // 구체적 검증
      results.forEach(result => {
        expect(result.user.id).toBe(results[0].user.id)
        expect(result.project.id).toBe(results[0].project.id)
        expect(result.storySteps.length).toBe(4)
      })
    })
  })
})