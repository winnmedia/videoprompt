/**
 * 결정론적 테스트 데이터 팩토리
 *
 * CLAUDE.md 준수: TDD, 결정론적 테스트, 시드 기반 랜덤 생성
 * 동일한 입력에 대해 항상 동일한 출력 보장
 */

/**
 * 시드 기반 결정론적 랜덤 생성기
 */
class DeterministicRandom {
  private seed: number

  constructor(seed: number = 12345) {
    this.seed = seed
  }

  /**
   * 다음 랜덤 값 생성 (0-1)
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  /**
   * 범위 내 정수 생성
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /**
   * 배열에서 랜덤 선택
   */
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)]
  }

  /**
   * 시드 리셋
   */
  reset(seed: number): void {
    this.seed = seed
  }
}

/**
 * 문자열을 시드로 변환
 */
function stringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }
  return Math.abs(hash)
}

/**
 * 결정론적 ID 생성
 */
function generateDeterministicId(prefix: string, seed: number): string {
  const random = new DeterministicRandom(seed)
  const suffix = random.nextInt(100000, 999999)
  return `${prefix}_${suffix}`
}

/**
 * 결정론적 날짜 생성
 */
function generateDeterministicDate(seed: number, baseDate?: Date): string {
  const random = new DeterministicRandom(seed)
  const base = baseDate || new Date('2024-01-01T00:00:00.000Z')
  const offsetMs = random.nextInt(0, 365 * 24 * 60 * 60 * 1000) // 1년 내
  const resultDate = new Date(base.getTime() + offsetMs)
  return resultDate.toISOString()
}

/**
 * 사용자 데이터 생성
 */
interface CreateUserOptions {
  email: string
  name: string
  role?: 'user' | 'admin'
  emailVerified?: boolean
  id?: string
}

function createUser(options: CreateUserOptions): any {
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
    emailVerified: options.emailVerified ?? true,
    createdAt,
    updatedAt,
    metadata: {
      source: 'deterministic-factory',
      seed
    }
  }
}

/**
 * 프로젝트 데이터 생성
 */
interface CreateProjectOptions {
  userId: string
  title: string
  description?: string
  inputData?: any
  id?: string
}

function createProject(options: CreateProjectOptions): any {
  const seed = stringToSeed(`${options.userId}:${options.title}`)
  const random = new DeterministicRandom(seed)

  const id = options.id || generateDeterministicId('proj', seed)
  const createdAt = generateDeterministicDate(seed)
  const updatedAt = generateDeterministicDate(seed + 1, new Date(createdAt))

  // 결정론적 입력 데이터 생성
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
    metadata: {
      source: 'deterministic-factory',
      seed
    }
  }
}

/**
 * 시나리오 데이터 생성
 */
interface CreateScenarioOptions {
  projectId: string
  title: string
  content?: string
  id?: string
}

function createScenario(options: CreateScenarioOptions): any {
  const seed = stringToSeed(`${options.projectId}:${options.title}`)
  const random = new DeterministicRandom(seed)

  const id = options.id || generateDeterministicId('scenario', seed)
  const createdAt = generateDeterministicDate(seed)
  const updatedAt = generateDeterministicDate(seed + 1, new Date(createdAt))

  return {
    id,
    projectId: options.projectId,
    title: options.title,
    content: options.content || '결정론적 시나리오 내용',
    order: random.nextInt(1, 10),
    status: random.choice(['draft', 'review', 'approved']),
    createdAt,
    updatedAt,
    metadata: {
      source: 'deterministic-factory',
      seed
    }
  }
}

/**
 * 스토리 스텝 데이터 생성
 */
interface CreateStoryStepsOptions {
  projectId: string
  inputData?: any
  regenerateFromStep?: number
  count?: number
}

function createStorySteps(options: CreateStoryStepsOptions): any[] {
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
      keyPoints: [
        `핵심 포인트 ${index + 1}-1`,
        `핵심 포인트 ${index + 1}-2`
      ],
      duration: stepDuration + stepRandom.nextInt(-5, 5), // 약간의 변동
      createdAt: generateDeterministicDate(stepSeed),
      updatedAt: generateDeterministicDate(stepSeed + 1),
      metadata: {
        source: 'deterministic-factory',
        seed: stepSeed
      }
    }
  })
}

/**
 * 샷 시퀀스 데이터 생성
 */
interface CreateShotSequencesOptions {
  projectId: string
  storySteps: any[]
  shotCount?: number
}

function createShotSequences(options: CreateShotSequencesOptions): any[] {
  const seed = stringToSeed(`${options.projectId}:shots`)
  const random = new DeterministicRandom(seed)

  const shotCount = options.shotCount || 12
  const shotTypes = ['close-up', 'medium', 'wide', 'extreme-close-up', 'long-shot']
  const movements = ['static', 'pan', 'tilt', 'zoom', 'dolly']

  return Array.from({ length: shotCount }, (_, index) => {
    const shotSeed = seed + index
    const shotRandom = new DeterministicRandom(shotSeed)

    // 스토리 스텝에 샷 분배
    const storyStepIndex = Math.floor(index / (shotCount / options.storySteps.length))
    const storyStep = options.storySteps[Math.min(storyStepIndex, options.storySteps.length - 1)]

    return {
      id: generateDeterministicId('shot', shotSeed),
      projectId: options.projectId,
      storyStepId: storyStep.id,
      order: index + 1,
      title: `Shot ${index + 1}`,
      description: `샷 ${index + 1}의 상세 설명`,
      duration: shotRandom.nextInt(10, 20),
      shotType: shotRandom.choice(shotTypes),
      cameraMovement: shotRandom.choice(movements),
      createdAt: generateDeterministicDate(shotSeed),
      updatedAt: generateDeterministicDate(shotSeed + 1),
      metadata: {
        source: 'deterministic-factory',
        seed: shotSeed
      }
    }
  })
}

/**
 * 인서트 샷 데이터 생성
 */
interface CreateInsertShotsOptions {
  shotSequences: any[]
  insertCount?: number
}

function createInsertShots(options: CreateInsertShotsOptions): any[] {
  const seed = stringToSeed('insert-shots')
  const random = new DeterministicRandom(seed)

  const insertCount = options.insertCount || Math.min(3, options.shotSequences.length)
  const purposes = ['감정 강조', '분위기 전환', '정보 전달', '시간 경과']

  return Array.from({ length: insertCount }, (_, index) => {
    const insertSeed = seed + index
    const insertRandom = new DeterministicRandom(insertSeed)

    const shotSequence = insertRandom.choice(options.shotSequences)

    return {
      id: generateDeterministicId('insert', insertSeed),
      shotSequenceId: shotSequence.id,
      order: index + 1,
      description: `인서트 샷 ${index + 1}`,
      purpose: insertRandom.choice(purposes),
      duration: insertRandom.nextInt(3, 8),
      createdAt: generateDeterministicDate(insertSeed),
      updatedAt: generateDeterministicDate(insertSeed + 1),
      metadata: {
        source: 'deterministic-factory',
        seed: insertSeed
      }
    }
  })
}

/**
 * 스토리보드 데이터 생성
 */
interface CreateStoryboardOptions {
  projectId: string
  title: string
  frames?: number
}

function createStoryboard(options: CreateStoryboardOptions): any {
  const seed = stringToSeed(`${options.projectId}:${options.title}`)
  const random = new DeterministicRandom(seed)

  const id = generateDeterministicId('storyboard', seed)
  const frameCount = options.frames || random.nextInt(5, 15)

  const frames = Array.from({ length: frameCount }, (_, index) => {
    const frameSeed = seed + index
    const frameRandom = new DeterministicRandom(frameSeed)

    return {
      id: generateDeterministicId('frame', frameSeed),
      order: index + 1,
      imageUrl: `https://cdn.test.com/storyboard/${id}/frame_${index + 1}.jpg`,
      description: `프레임 ${index + 1} 설명`,
      duration: frameRandom.nextInt(2, 8),
      notes: `프레임 ${index + 1} 참고사항`
    }
  })

  return {
    id,
    projectId: options.projectId,
    title: options.title,
    frames,
    totalDuration: frames.reduce((sum, frame) => sum + frame.duration, 0),
    status: random.choice(['draft', 'review', 'approved']),
    createdAt: generateDeterministicDate(seed),
    updatedAt: generateDeterministicDate(seed + 1),
    metadata: {
      source: 'deterministic-factory',
      seed
    }
  }
}

/**
 * 테스트 에러 시나리오 생성
 */
interface CreateErrorScenarioOptions {
  type: 'network' | 'validation' | 'auth' | 'server'
  endpoint: string
  message?: string
}

function createErrorScenario(options: CreateErrorScenarioOptions): any {
  const errorMap = {
    network: { status: 503, code: 'NETWORK_ERROR' },
    validation: { status: 400, code: 'VALIDATION_ERROR' },
    auth: { status: 401, code: 'UNAUTHORIZED' },
    server: { status: 500, code: 'INTERNAL_ERROR' }
  }

  const error = errorMap[options.type]

  return {
    status: error.status,
    error: {
      code: error.code,
      message: options.message || `Test ${options.type} error`,
      endpoint: options.endpoint,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * 내보내기: 결정론적 데이터 팩토리
 */
export const deterministicDataFactory = {
  // 기본 생성 함수들
  createUser,
  createProject,
  createScenario,
  createStorySteps,
  createShotSequences,
  createInsertShots,
  createStoryboard,
  createErrorScenario,

  // 유틸리티 함수들
  generateId: generateDeterministicId,
  generateDate: generateDeterministicDate,
  stringToSeed,

  // 랜덤 생성기 직접 접근
  createRandom: (seed: number) => new DeterministicRandom(seed),

  // 복합 데이터 생성
  createFullProject: (userId: string, title: string) => {
    const project = createProject({ userId, title })
    const storySteps = createStorySteps({ projectId: project.id })
    const shotSequences = createShotSequences({ projectId: project.id, storySteps })
    const insertShots = createInsertShots({ shotSequences })

    return {
      project,
      storySteps,
      shotSequences,
      insertShots
    }
  },

  // 테스트 데이터 검증
  validateDeterminism: (generator: () => any, iterations: number = 5): boolean => {
    const results = Array.from({ length: iterations }, generator)
    const firstResult = JSON.stringify(results[0])

    return results.every(result => JSON.stringify(result) === firstResult)
  }
}