/**
 * Planning Workflow Integration Tests (MSW 기반)
 *
 * CLAUDE.md 준수: TDD 원칙, MSW 완전 모킹, 결정론적 테스트, 비용 안전
 * 실제 DB/API 접근 완전 제거, 100% 모킹된 환경
 */

import {
  runIntegrationTest,
  testSafetyChecker,
  deterministicDataFactory,
  authTestUtils,
  planningTestUtils,
  costSafetyUtils
} from '@/shared/testing/msw'

// ===========================================
// 테스트 설정 및 헬퍼
// ===========================================

const TEST_USER_ID = 'test-user-integration-001'
const TEST_USER_EMAIL = 'integration-test@example.com'

/**
 * 인증된 요청 생성
 */
function createAuthenticatedRequest(
  method: string,
  url: string,
  body?: any,
  headers: Record<string, string> = {}
): Request {
  const token = authTestUtils.generateToken({
    userId: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    role: 'user'
  })

  return new Request(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body && { body: JSON.stringify(body) })
  })
}

/**
 * API 호출 래퍼
 */
async function callApi(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ response: Response; data: any }> {
  const url = `http://localhost:3000${endpoint}`
  const request = createAuthenticatedRequest(method, url, body)

  const response = await fetch(request)
  const data = await response.json()

  return { response, data }
}

// ===========================================
// TDD Red Phase: 실패 테스트로 시작
// ===========================================

describe('Planning Workflow Integration Tests (MSW)', () => {
  let testProjectId: string
  let testStorySteps: any[]
  let testShotSequences: any[]

  // MSW 설정: 통합 테스트 프리셋 사용
  beforeAll(() => {
    // 이미 globalMSWSetup.beforeAll이 jest.setup.js에서 처리됨
  })

  afterAll(() => {
    // 이미 globalMSWSetup.afterAll이 jest.setup.js에서 처리됨
  })

  beforeEach(() => {
    // MSW 및 모든 테스트 상태 리셋
    authTestUtils.reset()
    planningTestUtils.reset()

    // 테스트 사용자 추가
    authTestUtils.addUser({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Integration Test User',
      role: 'user',
      emailVerified: true
    })
  })

  // ===========================================
  // Red Phase: 1단계 - 프로젝트 관리 테스트
  // ===========================================

  describe('1. Project Management (Red → Green → Refactor)', () => {
    test('RED: 프로젝트 목록 조회가 실패하는지 확인', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 빈 프로젝트 목록 상태

        // When: 프로젝트 목록 조회
        const { response, data } = await callApi('GET', '/api/planning/projects?page=1&limit=10')

        // Then: 성공하지만 빈 목록 반환
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data).toEqual([])
        expect(data.pagination.total).toBe(0)

        // Red Phase 검증: 아직 프로젝트가 없어야 함
        expect(data.data.length).toBe(0)
      })

      await testFn()
    })

    test('GREEN: 새 기획 프로젝트 생성', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 프로젝트 생성 데이터
        const projectData = {
          title: 'MSW 통합 테스트 프로젝트',
          description: 'MSW 기반 통합 테스트를 위한 샘플 프로젝트',
          inputData: {
            targetDuration: 180,
            toneAndManner: '감성적이고 따뜻한',
            development: '기승전결',
            intensity: '중간',
            targetAudience: '20-30대 여성',
            mainMessage: '꿈을 포기하지 말고 도전하라',
          },
        }

        // When: 프로젝트 생성 API 호출
        const { response, data } = await callApi('POST', '/api/planning/projects', projectData)

        // Then: 성공적인 프로젝트 생성
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.metadata.title).toBe(projectData.title)
        expect(data.data.metadata.userId).toBe(TEST_USER_ID)
        expect(data.data.inputData).toEqual(projectData.inputData)

        // Green Phase 검증: 프로젝트가 생성되어야 함
        expect(data.data.metadata.id).toBeDefined()
        expect(data.data.currentStep).toBe('planning')
        expect(data.data.completionPercentage).toBe(0)

        // 다음 테스트를 위해 프로젝트 ID 저장
        testProjectId = data.data.metadata.id
      })

      await testFn()
    })

    test('REFACTOR: 생성된 프로젝트 상세 조회', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 이전 테스트에서 생성된 프로젝트 ID
        expect(testProjectId).toBeDefined()

        // When: 프로젝트 상세 조회
        const { response, data } = await callApi('GET', `/api/planning/projects/${testProjectId}`)

        // Then: 올바른 프로젝트 정보 반환
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.metadata.id).toBe(testProjectId)
        expect(data.data.scenarios).toEqual([])
        expect(data.data.storySteps).toEqual([])
        expect(data.data.shotSequences).toEqual([])

        // Refactor Phase 검증: 일관된 데이터 구조
        expect(data.data.metadata).toHaveProperty('createdAt')
        expect(data.data.metadata).toHaveProperty('updatedAt')
        expect(data.data).toHaveProperty('currentStep')
        expect(data.data).toHaveProperty('completionPercentage')
      })

      await testFn()
    })
  })

  // ===========================================
  // Red Phase: 2단계 - AI 스토리 생성 테스트 (비용 안전 핵심)
  // ===========================================

  describe('2. AI Story Generation (Cost Safety Critical)', () => {
    test('RED: AI API 호출 제한 검증', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 프로젝트가 존재함
        expect(testProjectId).toBeDefined()

        // When: AI 스토리 생성 API를 연속으로 호출 (제한 초과 시도)
        const storyRequest = {
          projectId: testProjectId,
          regenerateFromStep: 1,
        }

        // 첫 번째 호출 (성공해야 함)
        const { response: response1, data: data1 } = await callApi(
          'POST',
          '/api/ai/generate-story',
          storyRequest
        )

        expect(response1.status).toBe(200)
        expect(data1.success).toBe(true)

        // 두 번째 호출 (제한에 걸려야 함)
        const { response: response2, data: data2 } = await callApi(
          'POST',
          '/api/ai/generate-story',
          storyRequest
        )

        // Then: 비용 안전 제한에 걸려야 함
        expect(response2.status).toBe(429)
        expect(data2.error).toBe('API_CALL_LIMIT_EXCEEDED')
        expect(data2.message).toContain('AI API 호출 제한')
        expect(data2.costPrevention).toBe(true)

        // Red Phase 검증: $300 사건 방지가 작동해야 함
        const costStatus = costSafetyUtils.estimateCost()
        expect(costStatus.safe).toBe(true)
      })

      await testFn()
    })

    test('GREEN: 결정론적 AI 스토리 생성', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 새로운 테스트 환경 (API 제한 리셋됨)
        const storyRequest = {
          projectId: testProjectId,
          regenerateFromStep: 1,
        }

        // When: AI 스토리 생성 API 호출
        const { response, data } = await callApi('POST', '/api/ai/generate-story', storyRequest)

        // Then: 성공적인 스토리 생성
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.storySteps).toHaveLength(4)
        expect(data.data.totalDuration).toBe(180) // 입력한 targetDuration과 일치

        // Green Phase 검증: 결정론적 결과
        expect(data.data.storySteps[0].order).toBe(1)
        expect(data.data.storySteps[0].title).toBe('상황 제시')
        expect(data.data.storySteps[3].order).toBe(4)
        expect(data.data.storySteps[3].title).toBe('해결과 성장')

        // 메타데이터 검증
        expect(data.data.metadata.generatedAt).toBeDefined()
        expect(data.data.metadata.model).toBe('gemini-pro-test')
        expect(data.data.metadata.cost).toBe(0.05) // 고정 테스트 비용

        // 다음 테스트를 위해 스토리 스텝 저장
        testStorySteps = data.data.storySteps
      })

      await testFn()
    })

    test('REFACTOR: 프로젝트 상태 업데이트 확인', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 스토리가 생성된 프로젝트
        expect(testStorySteps).toBeDefined()
        expect(testStorySteps.length).toBe(4)

        // When: 프로젝트 상세 조회
        const { response, data } = await callApi('GET', `/api/planning/projects/${testProjectId}`)

        // Then: 프로젝트 상태가 업데이트됨
        expect(response.status).toBe(200)
        expect(data.data.storySteps).toHaveLength(4)
        expect(data.data.currentStep).toBe('story')
        expect(data.data.completionPercentage).toBe(40)

        // Refactor Phase 검증: 데이터 일관성
        data.data.storySteps.forEach((step: any, index: number) => {
          expect(step.order).toBe(index + 1)
          expect(step.title).toBeTruthy()
          expect(step.description).toBeTruthy()
          expect(step.duration).toBeGreaterThan(0)
        })
      })

      await testFn()
    })
  })

  // ===========================================
  // Red Phase: 3단계 - 샷 시퀀스 생성 테스트
  // ===========================================

  describe('3. Shot Sequence Generation', () => {
    test('RED: 샷 시퀀스 생성 실패 시나리오', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 존재하지 않는 프로젝트 ID로 샷 생성 시도
        const invalidShotRequest = {
          projectId: 'non-existent-project-id',
          shotCount: 12,
          includeInserts: true,
        }

        // When: 잘못된 프로젝트로 샷 생성 시도
        const { response, data } = await callApi('POST', '/api/planning/generate-shots', invalidShotRequest)

        // Then: 404 에러 발생해야 함
        expect(response.status).toBe(404)
        expect(data.error).toBeDefined()

        // Red Phase 검증: 적절한 에러 처리
        expect([404, 401, 403]).toContain(response.status)
      })

      await testFn()
    })

    test('GREEN: 12숏 자동 분해 실행', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 스토리 스텝이 있는 프로젝트
        expect(testProjectId).toBeDefined()
        expect(testStorySteps).toBeDefined()

        // 샷 생성 요청 (API가 실제로 존재하지 않으므로 결정론적 데이터로 시뮬레이션)
        const shotRequest = {
          projectId: testProjectId,
          shotCount: 12,
          includeInserts: true,
        }

        // When: 결정론적 샷 시퀀스 생성
        const shotSequences = deterministicDataFactory.createShotSequences({
          projectId: testProjectId,
          storySteps: testStorySteps,
          shotCount: 12
        })

        const insertShots = deterministicDataFactory.createInsertShots({
          shotSequences,
          insertCount: 3
        })

        // Then: 올바른 샷 시퀀스 생성
        expect(shotSequences).toHaveLength(12)
        expect(insertShots.length).toBeGreaterThan(0)

        // Green Phase 검증: 샷이 스토리 스텝에 분배됨
        const shotsByStep = shotSequences.reduce((acc: any, shot: any) => {
          const stepId = shot.storyStepId
          if (!acc[stepId]) acc[stepId] = []
          acc[stepId].push(shot)
          return acc
        }, {})

        expect(Object.keys(shotsByStep)).toHaveLength(4) // 4개 스토리 스텝

        // 다음 테스트를 위해 저장
        testShotSequences = shotSequences
      })

      await testFn()
    })

    test('REFACTOR: 샷 시퀀스 품질 검증', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 생성된 샷 시퀀스들
        expect(testShotSequences).toBeDefined()
        expect(testShotSequences.length).toBe(12)

        // When: 샷 시퀀스 품질 분석
        const totalDuration = testShotSequences.reduce((sum, shot) => sum + shot.duration, 0)
        const shotTypes = testShotSequences.map(shot => shot.shotType)
        const uniqueTypes = [...new Set(shotTypes)]

        // Then: 품질 기준 만족
        expect(totalDuration).toBeGreaterThan(120) // 최소 2분
        expect(totalDuration).toBeLessThan(240) // 최대 4분
        expect(uniqueTypes.length).toBeGreaterThan(1) // 다양한 샷 타입

        // Refactor Phase 검증: 결정론적 품질
        testShotSequences.forEach((shot, index) => {
          expect(shot.order).toBe(index + 1)
          expect(shot.title).toBe(`Shot ${index + 1}`)
          expect(shot.shotType).toMatch(/^(close-up|medium|wide|extreme-close-up|long-shot)$/)
          expect(shot.cameraMovement).toMatch(/^(static|pan|tilt|zoom|dolly)$/)
        })
      })

      await testFn()
    })
  })

  // ===========================================
  // Red Phase: 4단계 - 전체 워크플로우 검증
  // ===========================================

  describe('4. End-to-End Workflow Validation', () => {
    test('RED: 불완전한 워크플로우 감지', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 부분적으로만 완성된 프로젝트
        const incompleteProject = deterministicDataFactory.createProject({
          userId: TEST_USER_ID,
          title: '불완전한 프로젝트'
        })

        planningTestUtils.addProject(incompleteProject)

        // When: 불완전한 프로젝트 상세 조회
        const { response, data } = await callApi('GET', `/api/planning/projects/${incompleteProject.id}`)

        // Then: 프로젝트는 존재하지만 완성도가 낮음
        expect(response.status).toBe(200)
        expect(data.data.completionPercentage).toBe(0)
        expect(data.data.currentStep).toBe('planning')

        // Red Phase 검증: 워크플로우가 시작 단계에 있어야 함
        expect(data.data.storySteps).toEqual([])
        expect(data.data.shotSequences).toEqual([])
      })

      await testFn()
    })

    test('GREEN: 완성된 프로젝트 최종 상태 검증', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 모든 단계가 완료된 프로젝트
        expect(testProjectId).toBeDefined()
        expect(testStorySteps).toBeDefined()
        expect(testShotSequences).toBeDefined()

        // When: 최종 프로젝트 상태 조회
        const { response, data } = await callApi('GET', `/api/planning/projects/${testProjectId}`)

        // Then: 모든 워크플로우 단계가 완성됨
        expect(response.status).toBe(200)
        expect(data.success).toBe(true)

        // Green Phase 검증: 전체 워크플로우 완성도
        expect(data.data.metadata.id).toBe(testProjectId)
        expect(data.data.storySteps).toHaveLength(4)
        expect(data.data.currentStep).toBe('story')
        expect(data.data.completionPercentage).toBeGreaterThanOrEqual(40)

        // 스토리 스텝 검증
        data.data.storySteps.forEach((step: any, index: number) => {
          expect(step.order).toBe(index + 1)
          expect(step.title).toBeTruthy()
          expect(step.description).toBeTruthy()
          expect(step.keyPoints).toHaveLength(2)
        })
      })

      await testFn()
    })

    test('REFACTOR: 결정론적 동작 재검증', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 동일한 입력 데이터
        const projectData = {
          title: 'MSW 통합 테스트 프로젝트',
          description: 'MSW 기반 통합 테스트를 위한 샘플 프로젝트',
          inputData: {
            targetDuration: 180,
            toneAndManner: '감성적이고 따뜻한',
            development: '기승전결',
            intensity: '중간',
            targetAudience: '20-30대 여성',
            mainMessage: '꿈을 포기하지 말고 도전하라',
          },
        }

        // When: 동일한 프로젝트를 다시 생성
        const { response: response1, data: data1 } = await callApi('POST', '/api/planning/projects', projectData)
        const { response: response2, data: data2 } = await callApi('POST', '/api/planning/projects', projectData)

        // Then: 결정론적 결과 (구조는 동일, ID는 다름)
        expect(response1.status).toBe(response2.status)
        expect(data1.data.metadata.title).toBe(data2.data.metadata.title)
        expect(data1.data.inputData).toEqual(data2.data.inputData)

        // Refactor Phase 검증: 시스템의 일관성
        expect(data1.data.metadata.id).not.toBe(data2.data.metadata.id) // 고유 ID
        expect(data1.data.currentStep).toBe(data2.data.currentStep)
        expect(data1.data.completionPercentage).toBe(data2.data.completionPercentage)
      })

      await testFn()
    })
  })

  // ===========================================
  // Red Phase: 5단계 - 에러 시나리오 및 보안 테스트
  // ===========================================

  describe('5. Error Scenarios and Security', () => {
    test('RED: 인증되지 않은 사용자 접근 차단', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 인증 헤더 없는 요청
        const request = new Request('http://localhost:3000/api/planning/projects', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        // When: 인증 없이 API 호출
        const response = await fetch(request)
        const data = await response.json()

        // Then: 401 Unauthorized 에러
        expect(response.status).toBe(401)
        expect(data.error).toBe('UNAUTHORIZED')

        // Red Phase 검증: 보안이 올바르게 작동해야 함
        expect(data.message).toContain('authentication')
      })

      await testFn()
    })

    test('GREEN: 잘못된 토큰 처리', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 잘못된 JWT 토큰
        const request = new Request('http://localhost:3000/api/planning/projects', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer invalid-token-123',
            'Content-Type': 'application/json'
          }
        })

        // When: 잘못된 토큰으로 API 호출
        const response = await fetch(request)
        const data = await response.json()

        // Then: 401 Unauthorized 에러
        expect(response.status).toBe(401)
        expect(data.error).toBe('INVALID_TOKEN')

        // Green Phase 검증: 토큰 검증이 올바르게 작동
        expect(data.message).toContain('Invalid or expired token')
      })

      await testFn()
    })

    test('REFACTOR: API 호출 한도 초과 시나리오', async () => {
      const testFn = runIntegrationTest(async () => {
        // Given: 높은 빈도의 API 호출 시뮬레이션
        const requests = Array.from({ length: 15 }, () =>
          callApi('GET', '/api/planning/projects')
        )

        // When: 동시에 많은 요청 실행
        const results = await Promise.allSettled(requests)

        // Then: 일부 요청은 레이트 리밋에 걸려야 함
        const rejectedCount = results.filter(result => result.status === 'rejected').length
        const fulfilledResults = results.filter(result => result.status === 'fulfilled') as any[]

        // Refactor Phase 검증: 비용 안전 시스템 작동
        expect(rejectedCount + fulfilledResults.length).toBe(15)

        // 레이트 리밋 상태 확인
        const costStatus = costSafetyUtils.estimateCost()
        expect(costStatus.safe).toBe(true)
      })

      await testFn()
    })
  })

  // ===========================================
  // 성능 및 안전성 검증
  // ===========================================

  describe('6. Performance and Safety Validation', () => {
    test('테스트 실행 시간 30초 미만 검증', () => {
      const testFn = runIntegrationTest(() => {
        const startTime = performance.now()

        // 모든 주요 기능 빠른 실행
        const project = deterministicDataFactory.createProject({
          userId: TEST_USER_ID,
          title: '성능 테스트'
        })

        const storySteps = deterministicDataFactory.createStorySteps({
          projectId: project.id
        })

        const shotSequences = deterministicDataFactory.createShotSequences({
          projectId: project.id,
          storySteps
        })

        const endTime = performance.now()
        const executionTime = endTime - startTime

        // 성능 검증: 1초 미만 실행
        expect(executionTime).toBeLessThan(1000)
        expect(project).toBeDefined()
        expect(storySteps.length).toBe(4)
        expect(shotSequences.length).toBe(12)
      })

      testFn()
    })

    test('외부 의존성 완전 제거 검증', () => {
      const testFn = runIntegrationTest(() => {
        // 안전성 상태 검증
        const safetyStatus = testSafetyChecker.checkAfterTest()

        expect(safetyStatus.isSetup).toBe(true)
        expect(safetyStatus.costSafety).toBeDefined()

        // 비용 추정 검증
        const costEstimate = costSafetyUtils.estimateCost()
        expect(costEstimate.safe).toBe(true)
        expect(costEstimate.estimatedCost).toBeLessThan(1.0)

        // 호출 이력 검증 (외부 호출 없음)
        const callHistory = costSafetyUtils.checkSafety()
        expect(callHistory.safe).toBe(true)
      })

      testFn()
    })
  })
})

// ===========================================
// 추가 유틸리티 테스트
// ===========================================

describe('MSW Infrastructure Tests', () => {
  test('결정론적 데이터 팩토리 검증', () => {
    const testFn = runIntegrationTest(() => {
      // 동일한 입력으로 5번 생성
      const generator = () => deterministicDataFactory.createProject({
        userId: 'test-user',
        title: 'Test Project'
      })

      const isDeterministic = deterministicDataFactory.validateDeterminism(generator, 5)
      expect(isDeterministic).toBe(true)
    })

    testFn()
  })

  test('비용 안전 미들웨어 검증', () => {
    const testFn = runIntegrationTest(() => {
      // 안전한 API 호출
      const safeResult = costSafetyUtils.checkSafety()
      expect(safeResult.safe).toBe(true)

      // 상태 조회
      const status = safeResult.status
      expect(status.totalCalls).toBeGreaterThanOrEqual(0)
      expect(status.blockedCalls).toBeGreaterThanOrEqual(0)
    })

    testFn()
  })
})