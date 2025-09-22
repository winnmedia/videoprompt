/**
 * Supabase API Handlers for MSW v2
 *
 * FSD shared 레이어 - Supabase REST API 및 실시간 구독 모킹
 * CLAUDE.md 준수: TDD, 결정론성, 비용 안전
 */

import { http, HttpResponse } from 'msw'
import type { UserJourneyStep } from '../../processes/user-journey/types'

// Mock 데이터 타입 정의
interface MockUser {
  id: string
  email: string
  user_metadata: {
    name?: string
    avatar_url?: string
  }
  app_metadata: {
    provider?: string
    providers?: string[]
  }
  aud: string
  created_at: string
  updated_at: string
  email_confirmed_at: string
}

interface MockSession {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
  token_type: string
  user: MockUser
}

interface MockScenario {
  id: string
  user_id: string
  title: string
  content: string
  status: 'draft' | 'completed' | 'processing'
  story_steps: any[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface MockProject {
  id: string
  user_id: string
  title: string
  description: string
  scenario_id: string
  shot_sequences: any[]
  status: 'draft' | 'planning' | 'production' | 'completed'
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface MockUserJourney {
  id: string
  user_id: string
  session_id: string
  current_step: UserJourneyStep
  completed_steps: UserJourneyStep[]
  persisted_data: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Mock 데이터 스토어
class MockSupabaseStore {
  private users: Map<string, MockUser> = new Map()
  private sessions: Map<string, MockSession> = new Map()
  private scenarios: Map<string, MockScenario> = new Map()
  private projects: Map<string, MockProject> = new Map()
  private userJourneys: Map<string, MockUserJourney> = new Map()

  // 초기 데이터 설정
  constructor() {
    this.seedInitialData()
  }

  private seedInitialData() {
    // 테스트 사용자
    const testUser: MockUser = {
      id: 'test-user-001',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
        avatar_url: 'https://picsum.photos/100/100?random=1'
      },
      app_metadata: {
        provider: 'email',
        providers: ['email']
      },
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      email_confirmed_at: '2024-01-01T00:00:00Z'
    }

    this.users.set(testUser.id, testUser)

    // 테스트 세션
    const testSession: MockSession = {
      access_token: 'mock-jwt-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'bearer',
      user: testUser
    }

    this.sessions.set('test-session-001', testSession)

    // 테스트 시나리오
    const testScenario: MockScenario = {
      id: 'scenario-001',
      user_id: testUser.id,
      title: '테스트 시나리오',
      content: 'AI가 인간을 대체하는 미래 사회에서 벌어지는 이야기',
      status: 'completed',
      story_steps: [
        {
          id: 'step-1',
          title: '시작',
          content: '미래 도시에서 AI 로봇들이 인간의 일자리를 대체하기 시작한다.'
        },
        {
          id: 'step-2',
          title: '전개',
          content: '주인공은 마지막 인간 일자리를 지키기 위해 투쟁한다.'
        },
        {
          id: 'step-3',
          title: '절정',
          content: 'AI와 인간이 대결하는 결정적 순간이 온다.'
        },
        {
          id: 'step-4',
          title: '결말',
          content: '공존의 길을 찾아 새로운 시대가 열린다.'
        }
      ],
      metadata: {
        genre: 'SF',
        mood: 'serious',
        estimatedDuration: 600
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    this.scenarios.set(testScenario.id, testScenario)

    // 테스트 프로젝트
    const testProject: MockProject = {
      id: 'project-001',
      user_id: testUser.id,
      title: 'AI 미래 사회 영상',
      description: 'AI와 인간의 공존을 다룬 단편 영상',
      scenario_id: testScenario.id,
      shot_sequences: Array.from({ length: 12 }, (_, index) => ({
        id: `shot-${index + 1}`,
        order: index + 1,
        title: `숏 ${index + 1}`,
        description: `테스트용 숏 ${index + 1} 설명`,
        duration: 5 + (index % 3) * 2,
        cameraAngle: ['wide', 'medium', 'close-up'][index % 3],
        movement: ['static', 'pan', 'dolly'][index % 3],
        lighting: 'natural',
        mood: 'neutral',
        visualPrompt: `Visual prompt for shot ${index + 1}`,
        audioNotes: `Audio notes for shot ${index + 1}`,
        status: 'draft'
      })),
      status: 'planning',
      metadata: {
        totalDuration: 90,
        shotCount: 12,
        generatedAt: '2024-01-01T00:00:00Z'
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    this.projects.set(testProject.id, testProject)

    // 테스트 UserJourney
    const testUserJourney: MockUserJourney = {
      id: 'journey-001',
      user_id: testUser.id,
      session_id: 'test-session-001',
      current_step: 'planning-initialization',
      completed_steps: ['auth-login', 'scenario-input', 'scenario-story-generation', 'scenario-completion'],
      persisted_data: {
        auth: { userId: testUser.id },
        scenario: { scenarioId: testScenario.id },
        planning: { projectId: testProject.id },
        video: {},
        feedback: {},
        project: {}
      },
      metadata: {
        version: '1.0.0',
        startedAt: '2024-01-01T00:00:00Z',
        lastActivityAt: '2024-01-01T00:00:00Z',
        progressPercentage: 35
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    this.userJourneys.set(testUserJourney.id, testUserJourney)
  }

  // CRUD 메서드들
  getUser(id: string): MockUser | undefined {
    return this.users.get(id)
  }

  getUserByEmail(email: string): MockUser | undefined {
    return Array.from(this.users.values()).find(user => user.email === email)
  }

  getSession(token: string): MockSession | undefined {
    return Array.from(this.sessions.values()).find(session =>
      session.access_token === token || session.refresh_token === token
    )
  }

  getScenario(id: string): MockScenario | undefined {
    return this.scenarios.get(id)
  }

  getScenariosByUserId(userId: string): MockScenario[] {
    return Array.from(this.scenarios.values()).filter(scenario => scenario.user_id === userId)
  }

  createScenario(data: Partial<MockScenario> & { user_id: string }): MockScenario {
    const id = `scenario-${Date.now()}`
    const scenario: MockScenario = {
      id,
      title: 'New Scenario',
      content: '',
      status: 'draft',
      story_steps: [],
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data
    }
    this.scenarios.set(id, scenario)
    return scenario
  }

  updateScenario(id: string, updates: Partial<MockScenario>): MockScenario | null {
    const scenario = this.scenarios.get(id)
    if (!scenario) return null

    const updated = {
      ...scenario,
      ...updates,
      updated_at: new Date().toISOString()
    }
    this.scenarios.set(id, updated)
    return updated
  }

  getProject(id: string): MockProject | undefined {
    return this.projects.get(id)
  }

  getProjectsByUserId(userId: string): MockProject[] {
    return Array.from(this.projects.values()).filter(project => project.user_id === userId)
  }

  createProject(data: Partial<MockProject> & { user_id: string }): MockProject {
    const id = `project-${Date.now()}`
    const project: MockProject = {
      id,
      title: 'New Project',
      description: '',
      scenario_id: '',
      shot_sequences: [],
      status: 'draft',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data
    }
    this.projects.set(id, project)
    return project
  }

  updateProject(id: string, updates: Partial<MockProject>): MockProject | null {
    const project = this.projects.get(id)
    if (!project) return null

    const updated = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString()
    }
    this.projects.set(id, updated)
    return updated
  }

  getUserJourney(userId: string): MockUserJourney | undefined {
    return Array.from(this.userJourneys.values()).find(journey => journey.user_id === userId)
  }

  createUserJourney(data: Partial<MockUserJourney> & { user_id: string }): MockUserJourney {
    const id = `journey-${Date.now()}`
    const journey: MockUserJourney = {
      id,
      session_id: `session-${Date.now()}`,
      current_step: 'auth-login',
      completed_steps: [],
      persisted_data: {
        auth: {},
        scenario: {},
        planning: {},
        video: {},
        feedback: {},
        project: {}
      },
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data
    }
    this.userJourneys.set(id, journey)
    return journey
  }

  updateUserJourney(userId: string, updates: Partial<MockUserJourney>): MockUserJourney | null {
    const journey = this.getUserJourney(userId)
    if (!journey) return null

    const updated = {
      ...journey,
      ...updates,
      updated_at: new Date().toISOString()
    }
    this.userJourneys.set(journey.id, updated)
    return updated
  }

  // 전체 리셋
  reset() {
    this.users.clear()
    this.sessions.clear()
    this.scenarios.clear()
    this.projects.clear()
    this.userJourneys.clear()
    this.seedInitialData()
  }
}

// 글로벌 mock store 인스턴스
export const mockStore = new MockSupabaseStore()

// 인증 헬퍼
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

function validateAuth(request: Request): MockSession | null {
  const authHeader = request.headers.get('Authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return null
  }

  return mockStore.getSession(token) || null
}

// Supabase REST API 핸들러들
export const supabaseHandlers = [
  // 인증 - 로그인
  http.post('https://*/auth/v1/token', async ({ request }) => {
    const body = await request.json() as any

    if (body.grant_type === 'password') {
      const user = mockStore.getUserByEmail(body.email)

      if (user && body.password === 'password') {
        const session = mockStore.getSession('test-session-001')!

        return HttpResponse.json({
          access_token: session.access_token,
          token_type: session.token_type,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token,
          user: session.user
        })
      }
    }

    return HttpResponse.json(
      { message: 'Invalid login credentials' },
      { status: 400 }
    )
  }),

  // 인증 - 사용자 정보 조회
  http.get('https://*/auth/v1/user', ({ request }) => {
    const session = validateAuth(request)

    if (!session) {
      return HttpResponse.json(
        { message: 'Invalid JWT' },
        { status: 401 }
      )
    }

    return HttpResponse.json(session.user)
  }),

  // 인증 - 로그아웃
  http.post('https://*/auth/v1/logout', ({ request }) => {
    const session = validateAuth(request)

    if (!session) {
      return HttpResponse.json(
        { message: 'Invalid JWT' },
        { status: 401 }
      )
    }

    return HttpResponse.json({}, { status: 204 })
  }),

  // Rest API - Scenarios 테이블
  http.get('https://*/rest/v1/scenarios', ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const select = url.searchParams.get('select') || '*'
    const userId = url.searchParams.get('user_id')

    let scenarios: MockScenario[]

    if (userId) {
      scenarios = mockStore.getScenariosByUserId(userId)
    } else {
      scenarios = mockStore.getScenariosByUserId(session.user.id)
    }

    return HttpResponse.json(scenarios)
  }),

  http.post('https://*/rest/v1/scenarios', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<MockScenario>
    const scenario = mockStore.createScenario({
      ...body,
      user_id: session.user.id
    })

    return HttpResponse.json(scenario, { status: 201 })
  }),

  http.patch('https://*/rest/v1/scenarios', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return HttpResponse.json({ message: 'ID required' }, { status: 400 })
    }

    const body = await request.json() as Partial<MockScenario>
    const updated = mockStore.updateScenario(id, body)

    if (!updated) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    }

    return HttpResponse.json(updated)
  }),

  // Rest API - Projects 테이블
  http.get('https://*/rest/v1/projects', ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const projects = mockStore.getProjectsByUserId(session.user.id)
    return HttpResponse.json(projects)
  }),

  http.post('https://*/rest/v1/projects', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<MockProject>
    const project = mockStore.createProject({
      ...body,
      user_id: session.user.id
    })

    return HttpResponse.json(project, { status: 201 })
  }),

  http.patch('https://*/rest/v1/projects', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return HttpResponse.json({ message: 'ID required' }, { status: 400 })
    }

    const body = await request.json() as Partial<MockProject>
    const updated = mockStore.updateProject(id, body)

    if (!updated) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    }

    return HttpResponse.json(updated)
  }),

  // Rest API - UserJourneys 테이블
  http.get('https://*/rest/v1/user_journeys', ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const journey = mockStore.getUserJourney(session.user.id)
    return HttpResponse.json(journey ? [journey] : [])
  }),

  http.post('https://*/rest/v1/user_journeys', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<MockUserJourney>
    const journey = mockStore.createUserJourney({
      ...body,
      user_id: session.user.id
    })

    return HttpResponse.json(journey, { status: 201 })
  }),

  http.patch('https://*/rest/v1/user_journeys', async ({ request }) => {
    const session = validateAuth(request)
    if (!session) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<MockUserJourney>
    const updated = mockStore.updateUserJourney(session.user.id, body)

    if (!updated) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    }

    return HttpResponse.json(updated)
  })
]

// 테스트 유틸리티
export const supabaseTestUtils = {
  // Mock store 조작
  store: mockStore,

  // 사용자 생성
  createUser(userData: Partial<MockUser> = {}): MockUser {
    const user: MockUser = {
      id: `user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      user_metadata: {},
      app_metadata: { provider: 'email', providers: ['email'] },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
      ...userData
    }

    mockStore['users'].set(user.id, user)
    return user
  },

  // 세션 생성
  createSession(userId: string): MockSession {
    const user = mockStore.getUser(userId)
    if (!user) throw new Error('User not found')

    const session: MockSession = {
      access_token: `token-${Date.now()}`,
      refresh_token: `refresh-${Date.now()}`,
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      token_type: 'bearer',
      user
    }

    mockStore['sessions'].set(session.access_token, session)
    return session
  },

  // 데이터 리셋
  reset() {
    mockStore.reset()
  }
}