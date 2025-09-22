/**
 * MSW API Handlers
 *
 * Mock Service Worker를 위한 API 핸들러들
 * CLAUDE.md 준수: TDD, 결정론적 테스트, MSW 모킹
 */

import { http, HttpResponse } from 'msw'
import type { Scene } from '../../entities/scenario'

/**
 * 시나리오 관련 API 핸들러
 */
export const scenarioHandlers = [
  // AI 스토리 생성
  http.post('/api/ai/generate-story', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      data: {
        storyOutline: `${body.prompt}에 대한 AI 생성 스토리 개요입니다.`,
        scenes: [
          {
            id: '1',
            order: 1,
            type: 'dialogue',
            title: '오프닝',
            description: 'AI가 생성한 오프닝 씬',
            duration: 30,
            location: '스튜디오',
            characters: ['호스트'],
            dialogue: '안녕하세요, 오늘의 주제는...',
            actionDescription: '카메라를 향해 인사',
            notes: 'AI 생성된 연출 노트'
          },
          {
            id: '2',
            order: 2,
            type: 'action',
            title: '메인 컨텐츠',
            description: 'AI가 생성한 메인 컨텐츠',
            duration: 120,
            location: '스튜디오',
            characters: ['호스트'],
            dialogue: '',
            actionDescription: 'AI 생성된 액션 설명',
            notes: 'AI 생성된 연출 노트'
          }
        ] as Scene[],
        suggestedKeywords: ['AI', '생성', '테스트'],
        estimatedDuration: 150
      }
    })
  }),

  // 시나리오 목록 조회
  http.get('/api/planning/scenarios', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: '1',
          title: '테스트 시나리오 1',
          description: '첫 번째 테스트 시나리오',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: 'test-user'
        },
        {
          id: '2',
          title: '테스트 시나리오 2',
          description: '두 번째 테스트 시나리오',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: 'test-user'
        }
      ]
    })
  }),

  // 시나리오 저장
  http.post('/api/planning/scenarios', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      data: {
        id: Date.now().toString(),
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'test-user'
      }
    })
  })
]

/**
 * 스토리보드 관련 API 핸들러
 */
export const storyboardHandlers = [
  // 스토리보드 생성
  http.post('/api/storyboard/generate', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      success: true,
      data: {
        id: Date.now().toString(),
        images: body.scenes?.map((scene: any, index: number) => ({
          id: `img-${index + 1}`,
          sceneId: scene.id,
          url: `https://picsum.photos/512/288?random=${index + 1}`,
          style: body.style || 'pencil',
          prompt: `${scene.title}: ${scene.description}`,
          createdAt: new Date().toISOString()
        })) || []
      }
    })
  }),

  // 스토리보드 상태 조회
  http.get('/api/storyboard/status/:jobId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        jobId: params.jobId,
        status: 'completed',
        progress: 100,
        results: [
          {
            id: 'img-1',
            url: 'https://picsum.photos/512/288?random=1',
            style: 'pencil'
          }
        ]
      }
    })
  })
]

/**
 * 인증 관련 API 핸들러
 */
export const authHandlers = [
  // 게스트 세션 생성
  http.post('/api/auth/guest', () => {
    return HttpResponse.json({
      success: true,
      data: {
        userId: `guest_${Date.now()}`,
        sessionId: `session_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24시간
      }
    })
  }),

  // 현재 사용자 정보
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-user',
        role: 'guest',
        createdAt: new Date().toISOString()
      }
    })
  })
]

/**
 * 에러 핸들러
 */
export const errorHandlers = [
  // 404 에러
  http.get('/api/not-found', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found'
      },
      { status: 404 }
    )
  }),

  // 500 에러
  http.get('/api/server-error', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    )
  })
]

/**
 * 모든 핸들러 통합
 */
export const handlers = [
  ...scenarioHandlers,
  ...storyboardHandlers,
  ...authHandlers,
  ...errorHandlers
]

export default handlers