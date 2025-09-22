/**
 * MSW Planning API 핸들러
 *
 * CLAUDE.md 준수: TDD, MSW 모킹, 결정론적 테스트, 비용 안전
 * Supabase 응답 형식과 일치하는 모킹
 */

import { http, HttpResponse } from 'msw'
import { costSafetyMiddleware } from '../middleware/cost-safety'
import { deterministicDataFactory } from '../factories/deterministic-data-factory'

// 비용 안전을 위한 API 호출 제한
const API_CALL_LIMITS = {
  '/api/planning/projects': { maxCallsPerTest: 10, cooldownMs: 1000 },
  '/api/planning/scenarios': { maxCallsPerTest: 20, cooldownMs: 500 },
  '/api/planning/stories': { maxCallsPerTest: 15, cooldownMs: 1000 },
  '/api/ai/generate-story': { maxCallsPerTest: 3, cooldownMs: 5000 }, // AI 호출은 엄격하게
} as const

/**
 * 기획 데이터 저장소 (테스트용)
 */
class TestPlanningStore {
  private static projects = new Map<string, any>()
  private static scenarios = new Map<string, any>()
  private static stories = new Map<string, any>()
  private static shotSequences = new Map<string, any>()

  // 프로젝트 관리
  static addProject(project: any): void {
    this.projects.set(project.id, project)
  }

  static getProject(id: string): any | null {
    return this.projects.get(id) || null
  }

  static getProjectsByUser(userId: string): any[] {
    return Array.from(this.projects.values()).filter(p => p.userId === userId)
  }

  static updateProject(id: string, updates: any): void {
    const project = this.projects.get(id)
    if (project) {
      this.projects.set(id, { ...project, ...updates, updatedAt: new Date().toISOString() })
    }
  }

  static deleteProject(id: string): void {
    this.projects.delete(id)
    // 관련 데이터도 삭제
    this.scenarios.forEach((scenario, key) => {
      if (scenario.projectId === id) {
        this.scenarios.delete(key)
      }
    })
    this.stories.forEach((story, key) => {
      if (story.projectId === id) {
        this.stories.delete(key)
      }
    })
  }

  // 시나리오 관리
  static addScenario(scenario: any): void {
    this.scenarios.set(scenario.id, scenario)
  }

  static getScenario(id: string): any | null {
    return this.scenarios.get(id) || null
  }

  static getScenariosByProject(projectId: string): any[] {
    return Array.from(this.scenarios.values()).filter(s => s.projectId === projectId)
  }

  // 스토리 관리
  static addStory(story: any): void {
    this.stories.set(story.id, story)
  }

  static getStoriesByProject(projectId: string): any[] {
    return Array.from(this.stories.values()).filter(s => s.projectId === projectId)
  }

  // 샷 시퀀스 관리
  static addShotSequence(shot: any): void {
    this.shotSequences.set(shot.id, shot)
  }

  static getShotSequencesByProject(projectId: string): any[] {
    return Array.from(this.shotSequences.values()).filter(s => s.projectId === projectId)
  }

  static clear(): void {
    this.projects.clear()
    this.scenarios.clear()
    this.stories.clear()
    this.shotSequences.clear()
  }

  static reset(): void {
    this.clear()
    // 기본 테스트 데이터 추가
    const testProject = deterministicDataFactory.createProject({
      userId: 'test-user-001',
      title: '테스트 프로젝트',
      description: '테스트용 기획 프로젝트'
    })
    this.addProject(testProject)
  }
}

TestPlanningStore.reset()

/**
 * 인증 헤더 파싱
 */
function parseAuthHeader(request: Request): { userId: string; isValid: boolean } {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: '', isValid: false }
  }

  // 테스트용 간단한 토큰 파싱
  const token = authHeader.substring(7)
  if (token.startsWith('test_jwt_')) {
    return { userId: 'test-user-001', isValid: true }
  }

  return { userId: '', isValid: false }
}

export const planningHandlers = [
  // GET /api/planning/projects - 프로젝트 목록 조회
  http.get('/api/planning/projects', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/planning/projects', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    const userProjects = TestPlanningStore.getProjectsByUser(userId)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProjects = userProjects.slice(startIndex, endIndex)

    return HttpResponse.json({
      success: true,
      data: paginatedProjects,
      pagination: {
        page,
        limit,
        total: userProjects.length,
        totalPages: Math.ceil(userProjects.length / limit)
      }
    })
  }),

  // POST /api/planning/projects - 새 프로젝트 생성
  http.post('/api/planning/projects', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/planning/projects', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    try {
      const body = await request.json() as any
      const { title, description, inputData } = body

      if (!title) {
        return HttpResponse.json(
          {
            error: 'MISSING_TITLE',
            message: 'Project title is required'
          },
          { status: 400 }
        )
      }

      const project = deterministicDataFactory.createProject({
        userId,
        title,
        description: description || '',
        inputData: inputData || {}
      })

      TestPlanningStore.addProject(project)

      return HttpResponse.json({
        success: true,
        data: {
          metadata: {
            id: project.id,
            title: project.title,
            description: project.description,
            userId: project.userId,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          },
          inputData: project.inputData,
          currentStep: project.currentStep,
          completionPercentage: project.completionPercentage
        }
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Project creation failed'
        },
        { status: 500 }
      )
    }
  }),

  // GET /api/planning/projects/[id] - 프로젝트 상세 조회
  http.get('/api/planning/projects/:id', async ({ request, params }) => {
    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    const projectId = params.id as string
    const project = TestPlanningStore.getProject(projectId)

    if (!project) {
      return HttpResponse.json(
        {
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found'
        },
        { status: 404 }
      )
    }

    if (project.userId !== userId) {
      return HttpResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Access denied'
        },
        { status: 403 }
      )
    }

    const scenarios = TestPlanningStore.getScenariosByProject(projectId)
    const stories = TestPlanningStore.getStoriesByProject(projectId)
    const shotSequences = TestPlanningStore.getShotSequencesByProject(projectId)

    return HttpResponse.json({
      success: true,
      data: {
        metadata: {
          id: project.id,
          title: project.title,
          description: project.description,
          userId: project.userId,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        inputData: project.inputData,
        currentStep: project.currentStep,
        completionPercentage: project.completionPercentage,
        scenarios,
        storySteps: stories,
        shotSequences
      }
    })
  }),

  // GET /api/planning/scenarios - 시나리오 목록 조회
  http.get('/api/planning/scenarios', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/planning/scenarios', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')

    if (!projectId) {
      return HttpResponse.json(
        {
          error: 'MISSING_PROJECT_ID',
          message: 'Project ID is required'
        },
        { status: 400 }
      )
    }

    const project = TestPlanningStore.getProject(projectId)
    if (!project || project.userId !== userId) {
      return HttpResponse.json(
        {
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        },
        { status: 404 }
      )
    }

    const scenarios = TestPlanningStore.getScenariosByProject(projectId)

    return HttpResponse.json({
      success: true,
      data: scenarios
    })
  }),

  // POST /api/planning/scenarios - 새 시나리오 생성
  http.post('/api/planning/scenarios', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/planning/scenarios', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: isSafe.reason,
          retryAfter: isSafe.retryAfter
        },
        { status: 429 }
      )
    }

    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    try {
      const body = await request.json() as any
      const { projectId, title, content } = body

      if (!projectId || !title) {
        return HttpResponse.json(
          {
            error: 'MISSING_REQUIRED_FIELDS',
            message: 'Project ID and title are required'
          },
          { status: 400 }
        )
      }

      const project = TestPlanningStore.getProject(projectId)
      if (!project || project.userId !== userId) {
        return HttpResponse.json(
          {
            error: 'PROJECT_NOT_FOUND',
            message: 'Project not found or access denied'
          },
          { status: 404 }
        )
      }

      const scenario = deterministicDataFactory.createScenario({
        projectId,
        title,
        content: content || ''
      })

      TestPlanningStore.addScenario(scenario)

      return HttpResponse.json({
        success: true,
        data: scenario
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Scenario creation failed'
        },
        { status: 500 }
      )
    }
  }),

  // POST /api/ai/generate-story - AI 스토리 생성 (비용 안전 핵심)
  http.post('/api/ai/generate-story', async ({ request }) => {
    const isSafe = costSafetyMiddleware.checkApiCall('/api/ai/generate-story', API_CALL_LIMITS)
    if (!isSafe.allowed) {
      return HttpResponse.json(
        {
          error: 'API_CALL_LIMIT_EXCEEDED',
          message: `🚨 AI API 호출 제한: ${isSafe.reason}`,
          retryAfter: isSafe.retryAfter,
          costPrevention: true
        },
        { status: 429 }
      )
    }

    const { userId, isValid } = parseAuthHeader(request)
    if (!isValid) {
      return HttpResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication'
        },
        { status: 401 }
      )
    }

    try {
      const body = await request.json() as any
      const { projectId, regenerateFromStep } = body

      if (!projectId) {
        return HttpResponse.json(
          {
            error: 'MISSING_PROJECT_ID',
            message: 'Project ID is required'
          },
          { status: 400 }
        )
      }

      const project = TestPlanningStore.getProject(projectId)
      if (!project || project.userId !== userId) {
        return HttpResponse.json(
          {
            error: 'PROJECT_NOT_FOUND',
            message: 'Project not found or access denied'
        },
          { status: 404 }
        )
      }

      // AI 스토리 생성 시뮬레이션 (결정론적)
      const storySteps = deterministicDataFactory.createStorySteps({
        projectId,
        inputData: project.inputData,
        regenerateFromStep: regenerateFromStep || 1
      })

      // 스토리들을 저장소에 추가
      storySteps.forEach(step => {
        TestPlanningStore.addStory(step)
      })

      // 프로젝트 상태 업데이트
      TestPlanningStore.updateProject(projectId, {
        currentStep: 'story',
        completionPercentage: 40
      })

      return HttpResponse.json({
        success: true,
        data: {
          storySteps,
          totalDuration: storySteps.reduce((sum, step) => sum + step.duration, 0),
          metadata: {
            generatedAt: new Date().toISOString(),
            model: 'gemini-pro-test',
            tokensUsed: 2500,
            cost: 0.05 // 고정 비용 (테스트용)
          }
        }
      })
    } catch (error) {
      return HttpResponse.json(
        {
          error: 'AI_GENERATION_FAILED',
          message: 'Story generation failed'
        },
        { status: 500 }
      )
    }
  })
]

/**
 * 테스트 유틸리티 함수들
 */
export const planningTestUtils = {
  // 테스트 데이터 리셋
  reset: () => {
    TestPlanningStore.reset()
    costSafetyMiddleware.reset()
  },

  // 프로젝트 추가
  addProject: (project: any) => {
    TestPlanningStore.addProject(project)
  },

  // 프로젝트 조회
  getProject: (id: string) => {
    return TestPlanningStore.getProject(id)
  },

  // 시나리오 추가
  addScenario: (scenario: any) => {
    TestPlanningStore.addScenario(scenario)
  },

  // API 호출 이력 조회
  getApiCallHistory: () => {
    return costSafetyMiddleware.getCallHistory()
  },

  // 비용 안전 상태 조회
  getCostSafetyStatus: () => {
    return costSafetyMiddleware.getStatus()
  }
}