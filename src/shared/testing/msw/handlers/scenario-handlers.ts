/**
 * MSW Handlers for Scenario API
 *
 * CLAUDE.md 준수: TDD, MSW 기반 모킹, 결정론적 테스트
 * $300 사건 방지: API 호출 제한 및 캐싱 구현
 */

import { http, HttpResponse } from 'msw'
import type { Scenario, Scene, ScenarioCreateInput, StoryGenerationRequest } from '../../../../entities/scenario'

/**
 * 비용 안전: API 호출 제한
 */
class ApiCallLimiter {
  private static calls: Map<string, number> = new Map()
  private static readonly MAX_CALLS_PER_MINUTE = 5

  static checkLimit(endpoint: string): boolean {
    const now = Date.now()
    const key = `${endpoint}_${Math.floor(now / 60000)}` // 분 단위
    const current = this.calls.get(key) || 0

    if (current >= this.MAX_CALLS_PER_MINUTE) {
      return false
    }

    this.calls.set(key, current + 1)
    return true
  }

  static reset() {
    this.calls.clear()
  }
}

/**
 * 테스트용 시나리오 데이터
 */
const mockScenarios: Scenario[] = [
  {
    metadata: {
      id: 'scenario-test-001',
      title: '테스트 시나리오 1',
      description: 'MSW 테스트용 시나리오',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      version: '1.0.0',
      tags: ['test', 'demo'],
      author: 'test-user',
    },
    content: {
      genre: 'drama',
      mood: 'serious',
      targetAudience: 'adult',
      duration: 120,
      language: 'ko',
      themes: ['friendship', 'growth'],
    },
    scenes: [
      {
        id: 'scene-001',
        order: 1,
        title: '오프닝 씬',
        description: '주인공 소개',
        duration: 30,
        location: '커피숍',
        characters: ['주인공'],
        dialogue: '안녕하세요, 반갑습니다.',
        visualDescription: '따뜻한 조명의 아늑한 커피숍',
        cameraDirection: '미디움샷으로 주인공 소개',
        props: ['커피컵', '노트북'],
        mood: 'warm',
        tags: ['intro', 'character-introduction'],
      },
    ],
    totalDuration: 30,
    structure: {
      acts: [
        {
          name: '1막',
          sceneIds: ['scene-001'],
          duration: 30,
          purpose: '캐릭터 소개 및 배경 설정',
        },
      ],
    },
  },
]

/**
 * MSW 핸들러 정의
 */
export const scenarioHandlers = [
  // Gemini API 모킹 (스토리 생성)
  http.post('*/v1beta/models/gemini-pro:generateContent', async ({ request }) => {
    // 비용 안전: 호출 제한 체크
    if (!ApiCallLimiter.checkLimit('gemini-generate')) {
      return HttpResponse.json(
        {
          error: {
            code: 429,
            message: 'API 호출 한도 초과. 1분 후 다시 시도하세요.',
          },
        },
        { status: 429 }
      )
    }

    const requestBody = await request.json()
    const prompt = requestBody?.contents?.[0]?.parts?.[0]?.text || ''

    // 시뮬레이션 지연 (실제 API 응답 시간 모방)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 프롬프트 기반 응답 생성
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: '생성된 시나리오',
                  description: `${prompt.slice(0, 50)}...에 기반한 스토리`,
                  genre: 'drama',
                  scenes: [
                    {
                      title: '오프닝',
                      description: 'AI가 생성한 오프닝 씬',
                      duration: 30,
                      location: '카페',
                      characters: ['주인공'],
                      dialogue: '새로운 이야기가 시작됩니다.',
                      visualDescription: 'AI가 생성한 비주얼',
                      cameraDirection: 'AI가 생성한 카메라 지시',
                      props: ['커피', '책'],
                      mood: 'hopeful',
                    },
                  ],
                }),
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    }

    return HttpResponse.json(response)
  }),

  // 시나리오 목록 조회
  http.get('/api/scenarios', () => {
    return HttpResponse.json({
      success: true,
      data: mockScenarios,
      pagination: {
        total: mockScenarios.length,
        page: 1,
        limit: 10,
      },
    })
  }),

  // 시나리오 상세 조회
  http.get('/api/scenarios/:id', ({ params }) => {
    const { id } = params
    const scenario = mockScenarios.find((s) => s.metadata.id === id)

    if (!scenario) {
      return HttpResponse.json(
        { error: '시나리오를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      success: true,
      data: scenario,
    })
  }),

  // 시나리오 생성
  http.post('/api/scenarios', async ({ request }) => {
    const body = (await request.json()) as ScenarioCreateInput & {
      storyRequest: StoryGenerationRequest
    }

    // 비용 안전: 호출 제한 체크
    if (!ApiCallLimiter.checkLimit('create-scenario')) {
      return HttpResponse.json(
        { error: 'API 호출 한도 초과' },
        { status: 429 }
      )
    }

    // 시뮬레이션 지연
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const newScenario: Scenario = {
      metadata: {
        id: `scenario-${Date.now()}`,
        title: body.title,
        description: body.description || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: body.tags || [],
        author: body.author || 'anonymous',
      },
      content: {
        genre: body.genre || 'drama',
        mood: body.mood || 'neutral',
        targetAudience: body.targetAudience || 'general',
        duration: body.estimatedDuration || 60,
        language: 'ko',
        themes: body.themes || [],
      },
      scenes: [
        {
          id: 'scene-generated-001',
          order: 1,
          title: '생성된 씬 1',
          description: `${body.storyRequest.prompt}에 기반한 씬`,
          duration: 30,
          location: '미정',
          characters: ['주인공'],
          dialogue: 'AI가 생성한 대화',
          visualDescription: 'AI가 생성한 비주얼 설명',
          cameraDirection: 'AI가 생성한 카메라 방향',
          props: [],
          mood: 'neutral',
          tags: [],
        },
      ],
      totalDuration: 30,
      structure: {
        acts: [
          {
            name: '1막',
            sceneIds: ['scene-generated-001'],
            duration: 30,
            purpose: '시작',
          },
        ],
      },
    }

    // 모킹 데이터에 추가
    mockScenarios.unshift(newScenario)

    return HttpResponse.json({
      success: true,
      data: newScenario,
    })
  }),

  // 시나리오 업데이트
  http.put('/api/scenarios/:id', async ({ params, request }) => {
    const { id } = params
    const updates = await request.json()

    const index = mockScenarios.findIndex((s) => s.metadata.id === id)
    if (index === -1) {
      return HttpResponse.json(
        { error: '시나리오를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 업데이트 적용
    mockScenarios[index] = {
      ...mockScenarios[index],
      ...updates,
      metadata: {
        ...mockScenarios[index].metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    }

    return HttpResponse.json({
      success: true,
      data: mockScenarios[index],
    })
  }),

  // 시나리오 삭제
  http.delete('/api/scenarios/:id', ({ params }) => {
    const { id } = params
    const index = mockScenarios.findIndex((s) => s.metadata.id === id)

    if (index === -1) {
      return HttpResponse.json(
        { error: '시나리오를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    mockScenarios.splice(index, 1)

    return HttpResponse.json({
      success: true,
      message: '시나리오가 삭제되었습니다.',
    })
  }),
]

/**
 * 테스트 유틸리티
 */
export const scenarioTestUtils = {
  resetApiLimiter: () => ApiCallLimiter.reset(),
  getMockScenarios: () => [...mockScenarios],
  addMockScenario: (scenario: Scenario) => mockScenarios.unshift(scenario),
  clearMockScenarios: () => (mockScenarios.length = 0),
}