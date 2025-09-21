/**
 * 글로벌 MSW 핸들러 - 모든 테스트에서 공통으로 사용
 * 누락된 API 엔드포인트들에 대한 표준화된 모킹 제공
 */

import { http, HttpResponse } from 'msw';

// 건강 체크 API 핸들러
export const healthHandlers = [
  // 로컬 개발 서버 헬스 체크
  http.get('http://localhost:3001/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'test',
      services: {
        database: 'healthy',
        auth: 'healthy',
        storage: 'healthy'
      }
    });
  }),

  // 프로덕션 헬스 체크
  http.get('https://www.vridge.kr/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production',
      services: {
        database: 'healthy',
        auth: 'healthy',
        storage: 'healthy'
      }
    });
  }),

  // 일반적인 헬스 체크 패턴
  http.get('*/api/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }),
];

// 인증 API 핸들러
export const authHandlers = [
  // 사용자 정보 조회
  http.get('*/api/auth/me', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        name: 'Test User',
        verified: true
      }
    });
  }),

  // 토큰 갱신
  http.post('*/api/auth/refresh', () => {
    return HttpResponse.json({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600
    });
  }),

  // 로그인
  http.post('*/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;

    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User'
        },
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token'
      });
    }

    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // 회원가입
  http.post('*/api/auth/register', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      user: {
        id: 'new-user-123',
        email: body.email,
        name: body.name,
        verified: false
      },
      message: 'Registration successful. Please verify your email.'
    });
  }),
];

// 프로젝트 API 핸들러
export const projectHandlers = [
  // 프로젝트 목록 조회
  http.get('*/api/projects', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    return HttpResponse.json({
      projects: [
        {
          id: 'project-1',
          name: 'Test Project 1',
          description: 'Test project description',
          userId: userId || 'test-user-123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });
  }),

  // 프로젝트 생성
  http.post('*/api/projects', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: 'new-project-123',
      name: body.name,
      description: body.description,
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { status: 201 });
  }),

  // 프로젝트 상세 조회
  http.get('*/api/projects/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Project',
      description: 'Test project description',
      userId: 'test-user-123',
      scenes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }),
];

// Planning API 핸들러
export const planningHandlers = [
  // 스토리 목록 조회
  http.get('*/api/planning/stories', () => {
    return HttpResponse.json({
      stories: [
        {
          id: 'story-1',
          title: 'Test Story',
          content: 'Test story content',
          scenes: [],
          createdAt: new Date().toISOString()
        }
      ]
    });
  }),

  // 시나리오 목록 조회
  http.get('*/api/planning/scenarios', () => {
    return HttpResponse.json({
      scenarios: [
        {
          id: 'scenario-1',
          title: 'Test Scenario',
          description: 'Test scenario description',
          scenes: [],
          createdAt: new Date().toISOString()
        }
      ]
    });
  }),

  // 대시보드 데이터
  http.get('*/api/planning/dashboard', () => {
    return HttpResponse.json({
      totalProjects: 5,
      totalScenes: 25,
      recentActivity: [],
      analytics: {
        projectsThisMonth: 2,
        scenesThisMonth: 10,
        averageCompletionTime: 120
      }
    });
  }),

  // 프롬프트 생성
  http.post('*/api/planning/prompt', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      enhancedPrompt: `Enhanced: ${body.prompt}`,
      suggestions: ['suggestion1', 'suggestion2', 'suggestion3'],
      metadata: {
        confidence: 0.95,
        processingTime: 1200
      }
    });
  }),
];

// AI 서비스 핸들러
export const aiHandlers = [
  // OpenAI 스토리 생성
  http.post('*/api/ai/generate-story-openai', async ({ request }) => {
    const body = await request.json() as any;

    // 요청 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 100));

    return HttpResponse.json({
      story: {
        title: 'AI Generated Story',
        content: `Generated story based on: ${body.prompt}`,
        scenes: [
          {
            id: 'scene-1',
            description: 'Opening scene',
            duration: 30
          }
        ]
      },
      metadata: {
        model: 'gpt-4',
        tokens: 150,
        cost: 0.003
      }
    });
  }),

  // Gemini 대체 서비스
  http.post('*/api/ai/generate-story-gemini', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      story: {
        title: 'Gemini Generated Story',
        content: `Gemini story: ${body.prompt}`,
        scenes: []
      },
      metadata: {
        model: 'gemini-pro',
        tokens: 120,
        cost: 0.002
      }
    });
  }),
];

// 외부 서비스 핸들러 (Seedance, MCP 등)
export const externalHandlers = [
  // Seedance API
  http.post('https://api.seedance.com/v1/generate', () => {
    return HttpResponse.json({
      id: 'seedance-job-123',
      status: 'completed',
      result: {
        videoUrl: 'https://example.com/video.mp4',
        thumbnail: 'https://example.com/thumb.jpg'
      }
    });
  }),

  // MCP 서버들
  http.get('http://localhost:3001/mcp/*', () => {
    return HttpResponse.json({
      status: 'success',
      data: {}
    });
  }),

  // 일반적인 외부 API 차단
  http.get('https://*', ({ request }) => {
    const url = new URL(request.url);

    // 테스트에서 허용된 도메인들
    const allowedDomains = [
      'api.openai.com',
      'api.anthropic.com',
      'api.gemini.google.com'
    ];

    if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
      console.warn(`[MSW] 🚨 차단된 외부 요청: ${request.method} ${request.url}`);
      console.warn('테스트에서는 MSW 핸들러를 사용하여 모킹해야 합니다.');

      return HttpResponse.json(
        { error: 'External request blocked in tests' },
        { status: 404 }
      );
    }

    // 허용된 도메인은 통과 (실제 요청)
    return undefined;
  }),
];

// 에러 시뮬레이션 핸들러
export const errorHandlers = [
  // 500 에러 시뮬레이션
  http.get('*/api/error/500', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  // 404 에러 시뮬레이션
  http.get('*/api/error/404', () => {
    return HttpResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    );
  }),

  // 401 에러 시뮬레이션
  http.get('*/api/error/401', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // 네트워크 타임아웃 시뮬레이션
  http.get('*/api/error/timeout', () => {
    return new Promise(() => {
      // 영원히 응답하지 않음 (타임아웃 테스트용)
    });
  }),
];

// 모든 핸들러 결합
export const globalHandlers = [
  ...healthHandlers,
  ...authHandlers,
  ...projectHandlers,
  ...planningHandlers,
  ...aiHandlers,
  ...externalHandlers,
  ...errorHandlers,
];

// 핸들러 그룹별 익스포트는 위에서 이미 정의됨