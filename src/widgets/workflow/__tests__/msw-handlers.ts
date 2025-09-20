/**
 * MSW 핸들러 - WorkflowWizard 테스트용
 * 결정론적 테스트를 위한 API 모킹
 */

import { http, HttpResponse, delay } from 'msw';

export const workflowHandlers = [
  // 템플릿 목록 조회 - 성공 케이스
  http.get('/api/templates', async () => {
    await delay(50); // 실제 네트워크 지연 시뮬레이션

    return HttpResponse.json({
      success: true,
      templates: [
        {
          id: 'brand-promo',
          name: '브랜드 홍보',
          description: '제품/서비스를 효과적으로 홍보하는 영상',
          template: {
            title: '브랜드 홍보 영상',
            oneLineStory: '혁신적인 제품으로 고객의 일상을 변화시키는 이야기',
            genre: 'commercial',
            target: 'general',
            toneAndManner: ['professional', 'engaging'],
            duration: '30s'
          }
        },
        {
          id: 'tutorial',
          name: '튜토리얼',
          description: '단계별 가이드를 제공하는 교육 영상',
          template: {
            title: '튜토리얼 영상',
            oneLineStory: '복잡한 과정을 쉽고 재미있게 설명하는 교육 콘텐츠',
            genre: 'educational',
            target: 'students',
            toneAndManner: ['friendly', 'informative'],
            duration: '60s'
          }
        }
      ]
    });
  }),

  // 스토리 저장 - 성공 케이스
  http.post('/api/planning/stories', async ({ request }) => {
    await delay(100);

    const body = await request.json() as {
      title: string;
      oneLineStory: string;
      genre: string;
      tone: string;
      target: string;
    };

    return HttpResponse.json({
      success: true,
      data: {
        id: 'story-123',
        ...body,
        createdAt: new Date().toISOString()
      }
    });
  }),

  // 시나리오 생성 - 성공 케이스
  http.post('/api/planning/scenario', async () => {
    await delay(150);

    return HttpResponse.json({
      success: true,
      data: {
        id: 'scenario-456',
        generated: true,
        structure: ['setup', 'confrontation', 'resolution'],
        scenes: [
          {
            id: 1,
            description: '문제 상황 제시',
            duration: '10s'
          },
          {
            id: 2,
            description: '해결 과정',
            duration: '15s'
          },
          {
            id: 3,
            description: '결과 및 만족',
            duration: '5s'
          }
        ]
      }
    });
  }),

  // AI 프롬프트 생성 - 성공 케이스
  http.post('/api/ai/generate-story', async ({ request }) => {
    await delay(200);

    const body = await request.json() as {
      story: string;
      genre: string;
      tone: string;
      style: string;
      quality: string;
    };

    return HttpResponse.json({
      success: true,
      data: {
        prompt: `${body.style} 스타일의 ${body.genre} 영상: ${body.story}. 톤: ${body.tone}, 품질: ${body.quality}`,
        negativePrompt: 'low quality, blurry, distorted',
        keywords: [body.genre, body.style, body.tone],
        optimized: true
      }
    });
  }),

  // 영상 생성 요청 - 성공 케이스
  http.post('/api/seedance/create', async ({ request }) => {
    await delay(300);

    const body = await request.json() as {
      prompt: string;
      duration_seconds: number;
      aspect_ratio: string;
    };

    return HttpResponse.json({
      success: true,
      data: {
        jobId: `job-${Date.now()}`,
        status: 'queued',
        estimatedTime: body.duration_seconds * 10, // 추정 처리 시간
        message: '영상 생성 요청이 성공적으로 등록되었습니다.'
      }
    });
  }),

  // 영상 생성 상태 조회 - 진행 중
  http.get('/api/seedance/status/:jobId', async ({ params }) => {
    await delay(50);

    return HttpResponse.json({
      success: true,
      data: {
        jobId: params.jobId,
        status: 'processing',
        progress: 45,
        message: '영상을 생성하고 있습니다...'
      }
    });
  }),

  // 템플릿 저장 - 성공 케이스
  http.post('/api/templates', async ({ request }) => {
    await delay(100);

    const body = await request.json() as {
      name: string;
      description: string;
      template: Record<string, unknown>;
    };

    return HttpResponse.json({
      success: true,
      data: {
        id: `template-${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString()
      }
    });
  }),

  // 템플릿 삭제 - 성공 케이스
  http.delete('/api/templates/:id', async ({ params }) => {
    await delay(50);

    return HttpResponse.json({
      success: true,
      message: `템플릿 ${params.id}가 삭제되었습니다.`
    });
  }),
];

// 오류 시나리오 핸들러
export const errorHandlers = [
  // 네트워크 오류 시뮬레이션
  http.post('/api/seedance/create', () => {
    return new HttpResponse(null, {
      status: 500,
      statusText: 'Internal Server Error'
    });
  }),

  // 인증 오류 시뮬레이션
  http.get('/api/templates', () => {
    return new HttpResponse(JSON.stringify({
      error: 'Unauthorized',
      message: '인증이 필요합니다.'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }),

  // 유효성 검사 오류 시뮬레이션
  http.post('/api/planning/stories', () => {
    return new HttpResponse(JSON.stringify({
      error: 'Validation Error',
      message: '스토리 내용이 너무 짧습니다.',
      details: {
        field: 'oneLineStory',
        minLength: 10
      }
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }),

  // 타임아웃 시뮬레이션
  http.post('/api/ai/generate-story', async () => {
    await delay(10000); // 10초 지연으로 타임아웃 시뮬레이션
    return HttpResponse.json({ success: false });
  }),
];

// 성능 테스트용 핸들러 (빠른 응답)
export const performanceHandlers = [
  http.get('/api/templates', async () => {
    await delay(10); // 매우 빠른 응답

    return HttpResponse.json({
      success: true,
      templates: []
    });
  }),

  http.post('/api/seedance/create', async () => {
    await delay(20);

    return HttpResponse.json({
      success: true,
      data: {
        jobId: 'fast-job-123',
        status: 'queued'
      }
    });
  }),
];