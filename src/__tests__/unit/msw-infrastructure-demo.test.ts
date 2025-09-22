/**
 * MSW 인프라 데모 테스트
 *
 * CLAUDE.md 준수: TDD, 결정론적 테스트, 비용 안전
 * MSW 없이 직접 함수 테스트로 인프라 검증
 */

import { deterministicDataFactory } from '@/shared/testing/msw/factories/deterministic-data-factory'
import { costSafetyMiddleware, costSafetyUtils } from '@/shared/testing/msw/middleware/cost-safety'

describe('MSW Infrastructure Demo Tests', () => {
  beforeEach(() => {
    costSafetyMiddleware.reset()
  })

  // ===========================================
  // 1. 결정론적 데이터 팩토리 테스트
  // ===========================================

  describe('Deterministic Data Factory', () => {
    test('동일한 입력으로 동일한 사용자 생성', () => {
      // Given: 동일한 사용자 정보
      const userInput = {
        email: 'test@example.com',
        name: 'Test User'
      }

      // When: 5번 생성
      const users = Array.from({ length: 5 }, () =>
        deterministicDataFactory.createUser(userInput)
      )

      // Then: 모든 결과가 동일해야 함
      const firstUser = JSON.stringify(users[0])
      users.forEach(user => {
        expect(JSON.stringify(user)).toBe(firstUser)
      })

      // 결정론적 검증
      expect(users[0].id).toBe(users[4].id)
      expect(users[0].createdAt).toBe(users[4].createdAt)
    })

    test('다른 입력으로 다른 결과 생성', () => {
      // Given: 서로 다른 사용자 정보
      const user1 = deterministicDataFactory.createUser({
        email: 'user1@example.com',
        name: 'User One'
      })

      const user2 = deterministicDataFactory.createUser({
        email: 'user2@example.com',
        name: 'User Two'
      })

      // Then: 다른 결과여야 함
      expect(user1.id).not.toBe(user2.id)
      expect(user1.createdAt).not.toBe(user2.createdAt)
      expect(user1.email).not.toBe(user2.email)
    })

    test('프로젝트 데이터 결정론적 생성', () => {
      // Given: 프로젝트 정보
      const projectInput = {
        userId: 'test-user-001',
        title: '테스트 프로젝트'
      }

      // When: 여러 번 생성
      const project1 = deterministicDataFactory.createProject(projectInput)
      const project2 = deterministicDataFactory.createProject(projectInput)

      // Then: 동일한 결과
      expect(project1.id).toBe(project2.id)
      expect(project1.title).toBe(project2.title)
      expect(project1.inputData).toEqual(project2.inputData)

      // 결정론적 검증
      expect(project1.inputData.targetDuration).toBeGreaterThan(0)
      expect(project1.inputData.toneAndManner).toBeTruthy()
    })

    test('스토리 스텝 생성 및 구조 검증', () => {
      // Given: 프로젝트
      const project = deterministicDataFactory.createProject({
        userId: 'test-user',
        title: 'Story Test Project'
      })

      // When: 스토리 스텝 생성
      const storySteps = deterministicDataFactory.createStorySteps({
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
      })

      // 총 시간 검증
      const totalDuration = storySteps.reduce((sum, step) => sum + step.duration, 0)
      expect(totalDuration).toBeCloseTo(180, 30) // ±30초 허용
    })

    test('복합 데이터 생성 (전체 프로젝트)', () => {
      // Given: 사용자 정보
      const userId = 'complex-test-user'
      const title = '복합 테스트 프로젝트'

      // When: 전체 프로젝트 생성
      const fullProject = deterministicDataFactory.createFullProject(userId, title)

      // Then: 모든 구성 요소 존재
      expect(fullProject.project).toBeDefined()
      expect(fullProject.storySteps).toHaveLength(4)
      expect(fullProject.shotSequences).toHaveLength(12)
      expect(fullProject.insertShots.length).toBeGreaterThan(0)

      // 관계 검증
      fullProject.storySteps.forEach(step => {
        expect(step.projectId).toBe(fullProject.project.id)
      })

      fullProject.shotSequences.forEach(shot => {
        expect(shot.projectId).toBe(fullProject.project.id)
        expect(fullProject.storySteps.some(step => step.id === shot.storyStepId)).toBe(true)
      })
    })

    test('결정론성 검증 도구 테스트', () => {
      // Given: 결정론적 생성기
      const generator = () => deterministicDataFactory.createUser({
        email: 'determinism@test.com',
        name: 'Determinism Test'
      })

      // When: 결정론성 검증
      const isDeterministic = deterministicDataFactory.validateDeterminism(generator, 10)

      // Then: 결정론적이어야 함
      expect(isDeterministic).toBe(true)
    })
  })

  // ===========================================
  // 2. 비용 안전 미들웨어 테스트
  // ===========================================

  describe('Cost Safety Middleware', () => {
    test('API 호출 제한 기본 동작', () => {
      // Given: 기본 제한 설정
      const limits = { '/api/test': { maxCallsPerTest: 2, cooldownMs: 1000 } }

      // When: 허용 한도 내 호출
      const result1 = costSafetyMiddleware.checkApiCall('/api/test', limits)
      const result2 = costSafetyMiddleware.checkApiCall('/api/test', limits)

      // Then: 처음 두 호출은 허용
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)

      // 세 번째 호출은 차단
      const result3 = costSafetyMiddleware.checkApiCall('/api/test', limits)
      expect(result3.allowed).toBe(false)
      expect(result3.reason).toContain('호출 한도 초과')
    })

    test('$300 사건 방지 - /api/auth/me 특별 보호', () => {
      // Given: 위험한 엔드포인트
      const authLimits = { '/api/auth/me': { maxCallsPerTest: 1, cooldownMs: 60000 } }

      // When: 첫 번째 호출
      const result1 = costSafetyMiddleware.checkApiCall('/api/auth/me', authLimits)
      expect(result1.allowed).toBe(true)

      // 두 번째 호출 시도
      const result2 = costSafetyMiddleware.checkApiCall('/api/auth/me', authLimits)

      // Then: 즉시 차단되어야 함
      expect(result2.allowed).toBe(false)
      expect(result2.reason).toContain('호출 한도 초과')
      expect(result2.retryAfter).toBeGreaterThan(0)
    })

    test('쿨다운 시간 검증', () => {
      // Given: 짧은 쿨다운 설정
      const limits = { '/api/cooldown-test': { maxCallsPerTest: 5, cooldownMs: 100 } }

      // When: 연속 호출
      const result1 = costSafetyMiddleware.checkApiCall('/api/cooldown-test', limits)
      const result2 = costSafetyMiddleware.checkApiCall('/api/cooldown-test', limits)

      // Then: 두 번째 호출은 쿨다운에 걸림
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(false)
      expect(result2.reason).toContain('쿨다운 시간')
    })

    test('호출 기록 및 통계', () => {
      // Given: 여러 API 호출
      const endpoints = ['/api/test1', '/api/test2', '/api/test3']
      const limits = endpoints.reduce((acc, endpoint) => {
        acc[endpoint] = { maxCallsPerTest: 5, cooldownMs: 10 }
        return acc
      }, {} as any)

      // When: 다양한 호출 실행
      endpoints.forEach(endpoint => {
        costSafetyMiddleware.checkApiCall(endpoint, limits)
      })

      // Then: 올바른 기록 유지
      const history = costSafetyMiddleware.getCallHistory()
      expect(history.length).toBe(3)

      const status = costSafetyMiddleware.getStatus()
      expect(status.totalCalls).toBe(3)
      expect(status.blockedCalls).toBe(0)

      const stats = costSafetyMiddleware.getStatistics()
      expect(stats.endpointCounts).toBeDefined()
      expect(Object.keys(stats.endpointCounts)).toHaveLength(3)
    })

    test('위험 점수 계산', () => {
      // Given: 위험한 패턴 시뮬레이션
      const aiLimits = {
        '/api/ai/generate': { maxCallsPerTest: 1, cooldownMs: 5000 }
      }

      // When: AI API 호출 시도
      costSafetyMiddleware.checkApiCall('/api/ai/generate', aiLimits)
      costSafetyMiddleware.checkApiCall('/api/ai/generate', aiLimits) // 차단됨

      // Then: 위험 점수 증가
      const stats = costSafetyMiddleware.getStatistics()
      expect(stats.riskScore).toBeGreaterThan(0)

      const alert = costSafetyMiddleware.generateRiskAlert()
      if (alert) {
        expect(alert).toContain('차단된 호출')
      }
    })

    test('비용 추정 유틸리티', () => {
      // Given: AI 호출 시뮬레이션
      const aiLimits = {
        '/api/ai/generate-story': { maxCallsPerTest: 2, cooldownMs: 1000 },
        '/api/ai/generate-image': { maxCallsPerTest: 1, cooldownMs: 2000 }
      }

      // When: AI 호출 실행
      costSafetyMiddleware.checkApiCall('/api/ai/generate-story', aiLimits)
      costSafetyMiddleware.checkApiCall('/api/ai/generate-image', aiLimits)

      // Then: 비용 추정
      const costEstimate = costSafetyUtils.estimateCost()
      expect(costEstimate.estimatedCost).toBe(0.1) // 2 * $0.05
      expect(costEstimate.aiCallCount).toBe(2)
      expect(costEstimate.safe).toBe(true)
    })

    test('안전 체크 유틸리티', () => {
      // Given: 정상적인 호출 패턴
      const normalLimits = {
        '/api/normal': { maxCallsPerTest: 10, cooldownMs: 100 }
      }

      costSafetyMiddleware.checkApiCall('/api/normal', normalLimits)

      // When: 안전성 체크
      const safetyCheck = costSafetyUtils.checkSafety()

      // Then: 안전한 상태
      expect(safetyCheck.safe).toBe(true)
      expect(safetyCheck.status).toBeDefined()
      expect(safetyCheck.stats).toBeDefined()
    })

    test('비상 정지 기능', () => {
      // Given: 비상 정지 실행
      costSafetyMiddleware.emergencyStop()

      // When: 모든 API 호출 시도
      const result1 = costSafetyMiddleware.checkApiCall('/api/any')
      const result2 = costSafetyMiddleware.checkApiCall('/api/auth/me')

      // Then: 모든 호출이 차단되어야 함
      expect(result1.allowed).toBe(false)
      expect(result2.allowed).toBe(false)
    })
  })

  // ===========================================
  // 3. 통합 워크플로우 시뮬레이션
  // ===========================================

  describe('Integrated Workflow Simulation', () => {
    test('전체 기획 프로세스 시뮬레이션', () => {
      // Given: 사용자와 프로젝트
      const user = deterministicDataFactory.createUser({
        email: 'workflow@test.com',
        name: 'Workflow Test User'
      })

      const project = deterministicDataFactory.createProject({
        userId: user.id,
        title: '워크플로우 테스트 프로젝트',
        inputData: { targetDuration: 240 }
      })

      // When: 전체 프로세스 실행
      const storySteps = deterministicDataFactory.createStorySteps({
        projectId: project.id,
        inputData: project.inputData
      })

      const shotSequences = deterministicDataFactory.createShotSequences({
        projectId: project.id,
        storySteps,
        shotCount: 16
      })

      const insertShots = deterministicDataFactory.createInsertShots({
        shotSequences,
        insertCount: 4
      })

      // Then: 완전한 워크플로우
      expect(user.id).toBeTruthy()
      expect(project.id).toBeTruthy()
      expect(storySteps).toHaveLength(4)
      expect(shotSequences).toHaveLength(16)
      expect(insertShots).toHaveLength(4)

      // 데이터 일관성 검증
      storySteps.forEach(step => {
        expect(step.projectId).toBe(project.id)
      })

      shotSequences.forEach(shot => {
        expect(shot.projectId).toBe(project.id)
        expect(storySteps.some(step => step.id === shot.storyStepId)).toBe(true)
      })

      insertShots.forEach(insert => {
        expect(shotSequences.some(shot => shot.id === insert.shotSequenceId)).toBe(true)
      })
    })

    test('비용 안전을 고려한 워크플로우', () => {
      // Given: 엄격한 비용 제한
      const strictLimits = {
        '/api/ai/generate-story': { maxCallsPerTest: 1, cooldownMs: 30000 },
        '/api/ai/generate-shots': { maxCallsPerTest: 1, cooldownMs: 30000 }
      }

      // When: 안전한 워크플로우 실행
      const storyResult = costSafetyMiddleware.checkApiCall('/api/ai/generate-story', strictLimits)
      expect(storyResult.allowed).toBe(true)

      const shotResult = costSafetyMiddleware.checkApiCall('/api/ai/generate-shots', strictLimits)
      expect(shotResult.allowed).toBe(true)

      // 추가 호출 시도 (차단되어야 함)
      const blockedStory = costSafetyMiddleware.checkApiCall('/api/ai/generate-story', strictLimits)
      expect(blockedStory.allowed).toBe(false)

      // Then: 비용 안전 유지
      const costEstimate = costSafetyUtils.estimateCost()
      expect(costEstimate.safe).toBe(true)
      expect(costEstimate.aiCallCount).toBe(2)
    })

    test('30초 미만 실행 시간 검증', () => {
      // Given: 성능 측정 시작
      const startTime = performance.now()

      // When: 대규모 데이터 생성
      const projects = Array.from({ length: 10 }, (_, i) =>
        deterministicDataFactory.createFullProject(`user-${i}`, `Project ${i}`)
      )

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Then: 30초 미만 실행
      expect(executionTime).toBeLessThan(30000)
      expect(projects).toHaveLength(10)

      // 데이터 품질 검증
      projects.forEach(project => {
        expect(project.project.id).toBeTruthy()
        expect(project.storySteps).toHaveLength(4)
        expect(project.shotSequences).toHaveLength(12)
      })
    })
  })
})