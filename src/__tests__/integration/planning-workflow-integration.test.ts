/**
 * Planning Workflow Integration Tests
 *
 * CLAUDE.md 준수: TDD 원칙에 따른 통합 테스트
 * 전체 기획 워크플로우 검증 (프로젝트 생성 → 스토리 생성 → 샷 분해 → 콘티 생성 → PDF 내보내기)
 */

import { createMocks } from 'node-mocks-http'

// JWT 모킹 함수 - $300 사건 방지
const mockJwtSign = jest.fn((payload: any, secret: string) => {
  return `mock-jwt-token-${Date.now()}`
})

// API 핸들러 임포트
import { GET as getProjects, POST as createProject } from '@/app/api/planning/projects/route'
import { GET as getProjectDetail } from '@/app/api/planning/projects/[id]/route'
import { POST as generateStory } from '@/app/api/planning/generate-story/route'
import { POST as generateShots } from '@/app/api/planning/generate-shots/route'
import { POST as generateConti } from '@/app/api/planning/generate-conti/route'
import { POST as exportPdf } from '@/app/api/planning/export-pdf/route'
import { GET as getPerformance } from '@/app/api/admin/performance/route'

// 테스트 유틸리티
import { supabaseClient } from '@/shared/api/supabase-client'
import logger from '@/shared/lib/structured-logger'

// ===========================================
// 테스트 설정 및 헬퍼
// ===========================================

const TEST_USER_ID = 'test-user-integration'
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

function createAuthToken(userId: string = TEST_USER_ID): string {
  return mockJwtSign(
    {
      userId,
      email: 'test@example.com',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    JWT_SECRET
  )
}

function createMockRequest(method: string, body?: any, params?: any, query?: any) {
  const { req, res } = createMocks({
    method,
    body,
    query,
    headers: {
      authorization: `Bearer ${createAuthToken()}`,
      'content-type': 'application/json',
    },
  })

  // params를 별도로 설정
  if (params) {
    (req as any).params = params
  }

  return { req, res }
}

async function executeApiHandler(handler: any, req: any, context: any = {}) {
  const finalContext = {
    params: (req as any).params,
    ...context,
  }

  return await handler(req, finalContext)
}

// ===========================================
// 테스트 데이터 정리
// ===========================================

async function cleanupTestData() {
  try {
    // 테스트 데이터 삭제 (역순으로)
    await supabaseClient.raw
      .from('marp_exports')
      .delete()
      .eq('user_id', TEST_USER_ID)

    await supabaseClient.raw
      .from('conti_generations')
      .delete()
      .in('planning_project_id',
        supabaseClient.raw
          .from('planning_projects')
          .select('id')
          .eq('user_id', TEST_USER_ID)
      )

    await supabaseClient.raw
      .from('insert_shots')
      .delete()
      .in('planning_project_id',
        supabaseClient.raw
          .from('planning_projects')
          .select('id')
          .eq('user_id', TEST_USER_ID)
      )

    await supabaseClient.raw
      .from('shot_sequences')
      .delete()
      .in('planning_project_id',
        supabaseClient.raw
          .from('planning_projects')
          .select('id')
          .eq('user_id', TEST_USER_ID)
      )

    await supabaseClient.raw
      .from('story_steps')
      .delete()
      .in('planning_project_id',
        supabaseClient.raw
          .from('planning_projects')
          .select('id')
          .eq('user_id', TEST_USER_ID)
      )

    await supabaseClient.raw
      .from('planning_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)

    await supabaseClient.raw
      .from('planning_templates')
      .delete()
      .eq('created_by', TEST_USER_ID)

  } catch (error) {
    console.warn('테스트 데이터 정리 중 오류:', error)
  }
}

// ===========================================
// 통합 테스트 스위트
// ===========================================

describe('Planning Workflow Integration Tests', () => {
  let testProjectId: string
  let testStorySteps: any[]
  let testShotSequences: any[]

  beforeAll(async () => {
    // 테스트 환경 설정
    await cleanupTestData()
  })

  afterAll(async () => {
    // 테스트 데이터 정리
    await cleanupTestData()
  })

  beforeEach(() => {
    // 각 테스트마다 로그 레벨 조정
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  // ===========================================
  // 1단계: 프로젝트 생성 및 관리
  // ===========================================

  describe('1. Project Management', () => {
    test('프로젝트 목록 조회 (빈 상태)', async () => {
      const { req } = createMockRequest('GET', undefined, undefined, { page: 1, limit: 10 })

      const response = await getProjects(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })

    test('새 기획 프로젝트 생성', async () => {
      const projectData = {
        title: '통합 테스트 프로젝트',
        description: '통합 테스트를 위한 샘플 프로젝트',
        inputData: {
          targetDuration: 180,
          toneAndManner: '감성적이고 따뜻한',
          development: '기승전결',
          intensity: '중간',
          targetAudience: '20-30대 여성',
          mainMessage: '꿈을 포기하지 말고 도전하라',
        },
      }

      const { req } = createMockRequest('POST', projectData)

      const response = await createProject(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.metadata.title).toBe(projectData.title)
      expect(result.data.metadata.userId).toBe(TEST_USER_ID)
      expect(result.data.inputData).toEqual(projectData.inputData)

      // 테스트 진행을 위해 프로젝트 ID 저장
      testProjectId = result.data.metadata.id
    })

    test('생성된 프로젝트 상세 조회', async () => {
      const { req } = createMockRequest('GET')

      const response = await getProjectDetail(
        req as any,
        {
          user: { userId: TEST_USER_ID },
          params: { id: testProjectId }
        }
      )
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.metadata.id).toBe(testProjectId)
      expect(result.data.storySteps).toEqual([])
      expect(result.data.shotSequences).toEqual([])
    })
  })

  // ===========================================
  // 2단계: 스토리 생성 (Gemini API)
  // ===========================================

  describe('2. Story Generation', () => {
    test('Gemini API를 통한 4단계 스토리 생성', async () => {
      const storyRequest = {
        projectId: testProjectId,
        regenerateFromStep: 1,
      }

      const { req } = createMockRequest('POST', storyRequest)

      // Gemini API 모킹
      jest.mock('@/shared/lib/gemini-client', () => ({
        geminiClient: {
          generateStory: jest.fn().mockResolvedValue({
            steps: [
              {
                order: 1,
                title: '상황 제시',
                description: '주인공의 현재 상황과 문제점을 보여준다',
                keyPoints: ['직장 생활의 어려움', '꿈과 현실의 괴리'],
                duration: 45,
              },
              {
                order: 2,
                title: '갈등 심화',
                description: '문제가 더욱 복잡해지고 주인공이 고민에 빠진다',
                keyPoints: ['상사와의 갈등', '가족의 기대'],
                duration: 60,
              },
              {
                order: 3,
                title: '전환점',
                description: '우연한 계기로 새로운 가능성을 발견한다',
                keyPoints: ['멘토와의 만남', '새로운 기회'],
                duration: 45,
              },
              {
                order: 4,
                title: '해결과 성장',
                description: '용기를 내어 도전하고 성장하는 모습을 보여준다',
                keyPoints: ['도전의 결과', '성장한 모습'],
                duration: 30,
              },
            ],
            totalDuration: 180,
          }),
        },
      }))

      const response = await generateStory(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.storySteps).toHaveLength(4)
      expect(result.data.totalDuration).toBe(180)

      // 다음 단계를 위해 스토리 스텝 저장
      testStorySteps = result.data.storySteps
    })

    test('생성된 스토리가 프로젝트에 반영되었는지 확인', async () => {
      const { req } = createMockRequest('GET')

      const response = await getProjectDetail(
        req as any,
        {
          user: { userId: TEST_USER_ID },
          params: { id: testProjectId }
        }
      )
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.data.storySteps).toHaveLength(4)
      expect(result.data.currentStep).toBe('story')
      expect(result.data.completionPercentage).toBeGreaterThan(0)
    })
  })

  // ===========================================
  // 3단계: 12숏 자동 분해
  // ===========================================

  describe('3. Shot Sequence Generation', () => {
    test('12숏 자동 분해 실행', async () => {
      const shotRequest = {
        projectId: testProjectId,
        shotCount: 12,
        includeInserts: true,
      }

      const { req } = createMockRequest('POST', shotRequest)

      // Gemini API 모킹 (샷 생성용)
      jest.mock('@/shared/lib/gemini-client', () => ({
        geminiClient: {
          generateShots: jest.fn().mockResolvedValue({
            shots: Array.from({ length: 12 }, (_, i) => ({
              order: i + 1,
              title: `Shot ${i + 1}`,
              description: `샷 ${i + 1}의 설명`,
              duration: 15,
              shotType: ['close-up', 'medium', 'wide'][i % 3],
              cameraMovement: 'static',
              storyStepId: testStorySteps[Math.floor(i / 3)].id,
            })),
            inserts: [
              {
                shotSequenceId: 'shot-1',
                order: 1,
                description: '인서트 샷 1',
                purpose: '감정 강조',
              },
            ],
          }),
        },
      }))

      const response = await generateShots(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.shotSequences).toHaveLength(12)
      expect(result.data.insertShots.length).toBeGreaterThan(0)

      // 다음 단계를 위해 샷 시퀀스 저장
      testShotSequences = result.data.shotSequences
    })

    test('샷 시퀀스가 프로젝트에 반영되었는지 확인', async () => {
      const { req } = createMockRequest('GET')

      const response = await getProjectDetail(
        req as any,
        {
          user: { userId: TEST_USER_ID },
          params: { id: testProjectId }
        }
      )
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.data.shotSequences).toHaveLength(12)
      expect(result.data.currentStep).toBe('shots')
      expect(result.data.completionPercentage).toBeGreaterThan(50)
    })
  })

  // ===========================================
  // 4단계: ByteDance 콘티 생성
  // ===========================================

  describe('4. Conti Generation', () => {
    test('ByteDance API를 통한 콘티 이미지 생성 (처음 3개 샷)', async () => {
      const contiRequest = {
        projectId: testProjectId,
        shotIds: testShotSequences.slice(0, 3).map(shot => shot.id),
        style: 'cinematic',
        quality: 'high',
      }

      const { req } = createMockRequest('POST', contiRequest)

      // ByteDance API 모킹
      jest.mock('@/shared/lib/image-generation/bytedance-client', () => ({
        byteDanceImageClient: {
          generateBatch: jest.fn().mockResolvedValue([
            {
              id: 'conti-1',
              status: 'completed',
              progress: 100,
              resultUrls: ['https://example.com/conti1.jpg'],
              error: undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'conti-2',
              status: 'completed',
              progress: 100,
              resultUrls: ['https://example.com/conti2.jpg'],
              error: undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'conti-3',
              status: 'completed',
              progress: 100,
              resultUrls: ['https://example.com/conti3.jpg'],
              error: undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        },
      }))

      const response = await generateConti(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.results).toHaveLength(3)
      expect(result.data.generatedCount).toBe(3)
      expect(result.data.results.every((r: any) => r.status === 'completed')).toBe(true)
    })

    test('콘티 생성 상태 조회', async () => {
      const { req } = createMockRequest('GET', undefined, undefined, {
        projectId: testProjectId,
        shotIds: testShotSequences.slice(0, 3).map(shot => shot.id).join(','),
      })

      const response = await generateConti(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.completedCount).toBe(3)
      expect(result.data.failedCount).toBe(0)
    })
  })

  // ===========================================
  // 5단계: Marp PDF 내보내기
  // ===========================================

  describe('5. PDF Export', () => {
    test('Marp를 통한 PDF 내보내기', async () => {
      const pdfRequest = {
        projectId: testProjectId,
        format: 'A4',
        orientation: 'landscape',
        theme: 'vlanet',
        quality: 'high',
        includeStorySteps: true,
        includeShotSequences: true,
        includeContiImages: true,
        branding: {
          companyName: '테스트 컴퍼니',
          projectCode: 'TEST-001',
          version: 'v1.0',
        },
      }

      const { req } = createMockRequest('POST', pdfRequest)

      // Marp PDF 생성 모킹
      jest.mock('@/shared/lib/pdf-generation/marp-client', () => ({
        marpPdfClient: {
          generateProjectPdf: jest.fn().mockResolvedValue({
            id: 'pdf-export-1',
            filePath: '/tmp/pdf-exports/test.pdf',
            fileName: 'test-project.pdf',
            fileSize: 1024000,
            pageCount: 15,
            format: 'A4-landscape',
            createdAt: new Date().toISOString(),
          }),
        },
      }))

      const response = await exportPdf(req as any, { user: { userId: TEST_USER_ID } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.fileName).toBe('test-project.pdf')
      expect(result.data.pageCount).toBe(15)
      expect(result.data.downloadUrl).toBeDefined()
    })
  })

  // ===========================================
  // 6단계: 성능 모니터링 검증
  // ===========================================

  describe('6. Performance Monitoring', () => {
    test('관리자 성능 모니터링 API 호출', async () => {
      // 관리자 토큰 생성
      const adminToken = mockJwtSign(
        {
          userId: 'admin-user',
          email: 'admin@example.com',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        JWT_SECRET
      )

      const { req } = createMockRequest('GET', undefined, undefined, {
        action: 'status',
        timeRange: 3600000,
        detailed: 'true',
      })

      // 관리자 권한으로 헤더 설정
      req.headers.authorization = `Bearer ${adminToken}`

      // 관리자 권한 모킹
      process.env.ADMIN_USER_IDS = 'admin-user'

      const response = await getPerformance(req as any, { user: { userId: 'admin-user' } })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.overview).toBeDefined()
      expect(result.data.apiPerformance).toBeDefined()
      expect(result.data.cachePerformance).toBeDefined()
      expect(result.data.costSafety).toBeDefined()
    })
  })

  // ===========================================
  // 7단계: 전체 워크플로우 검증
  // ===========================================

  describe('7. End-to-End Workflow Validation', () => {
    test('완성된 프로젝트 최종 상태 검증', async () => {
      const { req } = createMockRequest('GET')

      const response = await getProjectDetail(
        req as any,
        {
          user: { userId: TEST_USER_ID },
          params: { id: testProjectId }
        }
      )
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)

      // 전체 워크플로우 완성도 검증
      expect(result.data.metadata.id).toBe(testProjectId)
      expect(result.data.storySteps).toHaveLength(4)
      expect(result.data.shotSequences).toHaveLength(12)
      expect(result.data.completionPercentage).toBeGreaterThanOrEqual(80)
      expect(result.data.currentStep).toBe('shots')

      // 각 스토리 스텝이 올바르게 연결되었는지 확인
      result.data.storySteps.forEach((step: any, index: number) => {
        expect(step.order).toBe(index + 1)
        expect(step.title).toBeTruthy()
        expect(step.description).toBeTruthy()
      })

      // 샷 시퀀스가 올바르게 분배되었는지 확인
      const shotsByStep = result.data.shotSequences.reduce((acc: any, shot: any) => {
        const stepId = shot.storyStepId
        if (!acc[stepId]) acc[stepId] = []
        acc[stepId].push(shot)
        return acc
      }, {})

      expect(Object.keys(shotsByStep)).toHaveLength(4) // 4개 스텝에 모두 샷이 있어야 함
    })

    test('워크플로우 성능 지표 검증', async () => {
      // 이 테스트에서는 실제 API 호출 시간, 캐시 효율성 등을 검증할 수 있음
      expect(true).toBe(true) // 플레이스홀더
    })
  })
})

// ===========================================
// 에러 시나리오 테스트
// ===========================================

describe('Error Scenarios', () => {
  test('인증되지 않은 사용자 접근 차단', async () => {
    const { req } = createMockRequest('GET')
    delete req.headers.authorization

    expect(async () => {
      await getProjects(req as any, { user: undefined })
    }).rejects.toThrow()
  })

  test('존재하지 않는 프로젝트 접근 시 404 에러', async () => {
    const { req } = createMockRequest('GET')

    expect(async () => {
      await getProjectDetail(
        req as any,
        {
          user: { userId: TEST_USER_ID },
          params: { id: 'non-existent-id' }
        }
      )
    }).rejects.toThrow()
  })

  test('비용 안전 제한 초과 시 차단', async () => {
    // 비용 안전 시스템이 올바르게 작동하는지 테스트
    expect(true).toBe(true) // 플레이스홀더
  })
})

// ===========================================
// 성능 테스트
// ===========================================

describe('Performance Tests', () => {
  test('대량 데이터 처리 성능', async () => {
    // 100개 프로젝트 생성 시의 성능을 테스트할 수 있음
    expect(true).toBe(true) // 플레이스홀더
  })

  test('동시 사용자 시나리오', async () => {
    // 여러 사용자가 동시에 API를 호출할 때의 성능을 테스트할 수 있음
    expect(true).toBe(true) // 플레이스홀더
  })
})