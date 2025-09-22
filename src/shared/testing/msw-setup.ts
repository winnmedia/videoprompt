/**
 * MSW Setup for Testing
 *
 * Mock Service Worker 설정 및 결정론적 테스트 지원
 * CLAUDE.md 준수: TDD, 결정론성, 비용 안전
 */

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { supabaseHandlers, supabaseTestUtils } from './supabase-handlers'

// 비용 안전 모니터링 모킹
let mockCostCount = 0
let mockDailyCost = 0

// 테스트용 모킹 데이터
const mockShotSequences = Array.from({ length: 12 }, (_, index) => ({
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
  status: 'draft',
  metadata: {
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'test-user',
    version: 1
  }
}))

const mockVideoJob = {
  jobId: 'test-job-001',
  status: 'processing',
  progress: 0,
  message: 'Starting video generation...',
  videoUrl: null
}

// MSW 핸들러들
export const handlers = [
  // Supabase API 핸들러들 (우선순위 높음)
  ...supabaseHandlers,
  // 비용 안전 체크 API
  http.post('/api/admin/cost-safety-check', () => {
    mockCostCount++

    // 5회 이상 호출 시 제한
    if (mockCostCount > 5) {
      return HttpResponse.json(
        {
          safe: false,
          error: 'COST_SAFETY_VIOLATION',
          message: '분당 요청 한도(5회) 초과',
          retryAfter: 60
        },
        { status: 429 }
      )
    }

    return HttpResponse.json({
      safe: true,
      message: '비용 안전 체크 통과',
      remainingRequests: 5 - mockCostCount,
      status: {
        dailyCost: mockDailyCost,
        dailyCostLimit: 50,
        remainingDailyBudget: 50 - mockDailyCost,
        minuteRequests: mockCostCount,
        minuteLimit: 5,
        remainingMinuteRequests: 5 - mockCostCount
      }
    })
  }),

  // 영상 생성 API
  http.post('/api/video/generate', async ({ request }) => {
    const body = await request.json() as any

    // 비용 검증 시뮬레이션
    if (mockCostCount > 5) {
      return HttpResponse.json(
        { error: 'Rate limited' },
        { status: 429 }
      )
    }

    mockDailyCost += 1 // $1 추가

    return HttpResponse.json({
      success: true,
      jobId: mockVideoJob.jobId,
      message: '영상 생성이 시작되었습니다',
      estimatedTime: 300
    })
  }),

  // 12숏 생성 API
  http.post('/api/planning/shots', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      data: mockShotSequences,
      message: '12개 숏트 시퀀스가 성공적으로 생성되었습니다'
    })
  }),

  // 12숏 조회 API
  http.get('/api/planning/shots', ({ request }) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')

    if (!projectId) {
      return HttpResponse.json(
        { error: 'projectId는 필수입니다' },
        { status: 400 }
      )
    }

    return HttpResponse.json({
      success: true,
      data: mockShotSequences,
      count: mockShotSequences.length
    })
  }),

  // 12숏 업데이트 API
  http.put('/api/planning/shots', async ({ request }) => {
    const body = await request.json() as any
    const { shotId, ...updates } = body

    const updatedShot = {
      ...mockShotSequences.find(s => s.id === shotId),
      ...updates,
      metadata: {
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
        version: 2
      }
    }

    return HttpResponse.json({
      success: true,
      data: updatedShot,
      message: '숏트 시퀀스가 성공적으로 업데이트되었습니다'
    })
  }),

  // 콘티 이미지 생성 API
  http.post('/api/planning/conti/generate', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      imageUrl: `https://picsum.photos/400/225?random=${body.shotId}`,
      message: '콘티 이미지가 성공적으로 생성되었습니다'
    })
  }),

  // 스토리 생성 API (Gemini)
  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      data: {
        storySteps: [
          {
            id: 'step-1',
            title: '시작',
            content: `${body.prompt}에 대한 이야기가 시작됩니다.`
          },
          {
            id: 'step-2',
            title: '전개',
            content: '갈등이 시작되고 상황이 복잡해집니다.'
          },
          {
            id: 'step-3',
            title: '절정',
            content: '모든 갈등이 절정에 달합니다.'
          },
          {
            id: 'step-4',
            title: '결말',
            content: '모든 것이 해결되고 이야기가 마무리됩니다.'
          }
        ]
      },
      message: '4단계 스토리가 성공적으로 생성되었습니다'
    })
  }),

  // 인증 API 모킹
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any

    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        success: true,
        user: {
          id: 'test-user-001',
          email: 'test@example.com',
          role: 'user'
        },
        token: 'mock-jwt-token'
      })
    }

    return HttpResponse.json(
      { error: '잘못된 인증 정보' },
      { status: 401 }
    )
  }),

  // 기본 에러 핸들러
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  })
]

// 테스트 서버 설정
export const server = setupServer(...handlers)

// 테스트 유틸리티
export const testUtils = {
  // Supabase 관련 유틸리티
  supabase: supabaseTestUtils,

  // 비용 카운터 리셋
  resetCostCounter() {
    mockCostCount = 0
    mockDailyCost = 0
  },

  // 비용 한도 설정
  setCostLimit(count: number) {
    mockCostCount = count
  },

  // 더미 데이터 조작
  updateMockData(data: Partial<typeof mockShotSequences[0]>[]) {
    data.forEach((update, index) => {
      if (mockShotSequences[index]) {
        Object.assign(mockShotSequences[index], update)
      }
    })
  },

  // 영상 생성 진행 상황 시뮬레이션
  simulateVideoProgress(jobId: string, callback: (progress: any) => void) {
    const steps = [
      { progress: 20, message: '프롬프트 분석 중...' },
      { progress: 50, message: 'AI 영상 생성 중...' },
      { progress: 80, message: '후처리 진행 중...' },
      { progress: 100, message: '완료!' }
    ]

    let currentStep = 0
    const interval = setInterval(() => {
      if (currentStep >= steps.length) {
        clearInterval(interval)
        callback({
          type: 'completed',
          videoUrl: `https://example.com/video/${jobId}.mp4`
        })
        return
      }

      callback({
        type: 'progress',
        ...steps[currentStep]
      })
      currentStep++
    }, 1000)

    return interval
  }
}

// Jest 설정
export function setupMSW() {
  // 테스트 시작 전
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  // 각 테스트 후
  afterEach(() => {
    server.resetHandlers()
    testUtils.resetCostCounter()
    testUtils.supabase.reset()
  })

  // 테스트 종료 후
  afterAll(() => {
    server.close()
  })
}