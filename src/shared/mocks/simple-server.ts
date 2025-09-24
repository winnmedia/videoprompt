/**
 * 간단한 MSW 대체 서버 (Jest 환경용)
 * MSW 로딩 문제 해결을 위한 임시 솔루션
 * $300 사건 방지를 위한 결정론적 응답 제공
 */

import { createMockStoryboard, createMockScenario, createMockUser } from './data/factories';

// API 호출 추적기
const apiCallTracker = new Map<string, { count: number; lastCall: number; totalCost: number }>();

// 비용 규칙
const COST_RULES = {
  '/api/storyboard/generate': 2.5,
  '/api/video/generate': 5.0,
  '/api/ai/generate-story': 1.0,
  '/api/auth/me': 0.01,
} as const;

// Rate Limiting 규칙 (밀리초)
const RATE_LIMITS = {
  '/api/storyboard/generate': 5000,
  '/api/video/generate': 10000,
  '/api/ai/generate-story': 2000,
  '/api/auth/me': 60000,
} as const;

// 최대 일일 비용
const DAILY_COST_LIMIT = 50;

/**
 * 간단한 fetch 모킹 함수
 */
export function setupSimpleMSW() {
  const originalFetch = global.fetch;

  global.fetch = jest.fn(async (url: string | URL | Request, options?: any) => {
    const urlString = typeof url === 'string' ? url : url.toString();
    const method = options?.method || 'GET';

    // $300 사건 방지: 비용 안전 검사
    const endpoint = new URL(urlString).pathname;
    const key = `test-user:${endpoint}`;
    const tracker = apiCallTracker.get(key) || { count: 0, lastCall: 0, totalCost: 0 };
    const now = Date.now();

    // Rate Limiting 검사
    const rateLimit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS];
    if (rateLimit && (now - tracker.lastCall) < rateLimit) {
      return Promise.resolve(new Response(JSON.stringify({
        error: {
          message: `Rate limit exceeded for ${endpoint}. Please wait ${Math.ceil((rateLimit - (now - tracker.lastCall)) / 1000)} seconds.`,
          code: 'RATE_LIMIT_EXCEEDED',
        },
      }), { status: 429, headers: { 'Content-Type': 'application/json' } }));
    }

    // 비용 계산 및 한도 검사
    const cost = COST_RULES[endpoint as keyof typeof COST_RULES] || 0;
    if (cost > 0) {
      const newTotalCost = tracker.totalCost + cost;
      if (newTotalCost > DAILY_COST_LIMIT) {
        return Promise.resolve(new Response(JSON.stringify({
          error: {
            message: `Daily cost limit exceeded. Current: $${tracker.totalCost.toFixed(2)}, Attempted: $${cost}, Limit: $${DAILY_COST_LIMIT}`,
            code: 'DAILY_COST_LIMIT_EXCEEDED',
          },
        }), { status: 429, headers: { 'Content-Type': 'application/json' } }));
      }

      // 추적 정보 업데이트
      apiCallTracker.set(key, {
        count: tracker.count + 1,
        lastCall: now,
        totalCost: newTotalCost,
      });
    }

    // 결정론적 응답 생성
    return handleMockRequest(urlString, method, options?.body);
  }) as any;

  return {
    listen: () => {},
    resetHandlers: () => {},
    close: () => {
      global.fetch = originalFetch;
    },
    use: () => {},
  };
}

/**
 * 모킹된 요청 처리
 */
async function handleMockRequest(url: string, method: string, body?: any): Promise<Response> {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // POST 요청 body 파싱
  let requestData: any = {};
  if (body && method === 'POST') {
    try {
      requestData = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      // body 파싱 실패 무시
    }
  }

  // 스토리보드 생성
  if (pathname === '/api/storyboard/generate' && method === 'POST') {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 지연

    const storyboard = createMockStoryboard(requestData.scenarioId || 'generated');
    storyboard.scenarioId = requestData.scenarioId;
    storyboard.title = requestData.title || '생성된 스토리보드';
    storyboard.description = requestData.description || 'AI가 생성한 스토리보드';

    if (requestData.scenes) {
      storyboard.panels = requestData.scenes.map((scene: any, index: number) => ({
        id: `panel-${storyboard.id}-${index + 1}`,
        sceneId: scene.id,
        imagePrompt: `${scene.title}: ${scene.description}`,
        imageUrl: `https://example.com/generated/${storyboard.id}-${index + 1}.jpg`,
        duration: scene.duration || 30,
        order: index + 1,
        visualDescription: scene.description,
        cameraAngle: '미디엄 샷',
        lighting: '자연광',
      }));
      storyboard.totalDuration = storyboard.panels.reduce((sum, panel) => sum + panel.duration, 0);
    }

    return new Response(JSON.stringify({
      storyboard,
      cost: {
        amount: 2.5,
        currency: 'USD',
        breakdown: [
          { service: 'scene-analysis', amount: 0.5 },
          { service: 'prompt-generation', amount: 1.0 },
          { service: 'image-planning', amount: 1.0 },
        ],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 이미지 생성
  if (pathname === '/api/storyboard/generate-image' && method === 'POST') {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 지연

    const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return new Response(JSON.stringify({
      imageUrl: `https://example.com/generated/${imageId}.jpg`,
      prompt: requestData.prompt,
      style: requestData.style || 'realistic',
      aspectRatio: requestData.aspectRatio || '16:9',
      metadata: {
        width: 1920,
        height: 1080,
        format: 'jpg',
        size: '2.5MB',
      },
      cost: {
        amount: 0.25,
        currency: 'USD',
        service: 'image-generation',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 스토리보드 조회
  if (pathname.startsWith('/api/storyboard/') && method === 'GET') {
    const id = pathname.split('/').pop();
    if (id && id !== 'user') {
      const storyboard = createMockStoryboard(id);
      return new Response(JSON.stringify({ storyboard }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 사용자별 스토리보드 목록
  if (pathname.startsWith('/api/storyboard/user/') && method === 'GET') {
    const storyboards = [
      createMockStoryboard('travel-jeju'),
      createMockStoryboard('cooking-show'),
      createMockStoryboard('tech-review'),
    ];
    return new Response(JSON.stringify(storyboards), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 스토리보드 저장
  if (pathname === '/api/storyboard' && method === 'POST') {
    const storyboard = requestData;
    return new Response(JSON.stringify({ storyboard }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 비용 추적 조회
  if (pathname === '/api/admin/cost-tracking' && method === 'GET') {
    const totalCost = Array.from(apiCallTracker.values())
      .reduce((sum, tracker) => sum + tracker.totalCost, 0);

    const responseData = {
      totalCost: totalCost.toFixed(2),
      dailyLimit: DAILY_COST_LIMIT,
      remaining: (DAILY_COST_LIMIT - totalCost).toFixed(2),
      calls: Object.fromEntries(apiCallTracker),
    };

    console.log('[Simple MSW] Cost tracking response:', responseData);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 비용 추적 초기화
  if (pathname === '/api/admin/cost-tracking' && method === 'DELETE') {
    apiCallTracker.clear();
    return new Response(JSON.stringify({ message: 'Cost tracking reset' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Rate Limits 조회
  if (pathname === '/api/admin/rate-limits' && method === 'GET') {
    const now = Date.now();
    const status = Object.entries(RATE_LIMITS).map(([endpoint, limit]) => {
      const trackers = Array.from(apiCallTracker.entries())
        .filter(([key]) => key.includes(endpoint))
        .map(([, tracker]) => tracker);

      const lastCall = Math.max(...trackers.map(t => t.lastCall), 0);
      const remainingMs = Math.max(0, limit - (now - lastCall));

      return {
        endpoint,
        limit: limit / 1000,
        remaining: Math.ceil(remainingMs / 1000),
        available: remainingMs === 0,
      };
    });

    return new Response(JSON.stringify({ rateLimits: status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // useEffect 위반 감지
  if (pathname === '/api/admin/useeffect-violation' && method === 'POST') {
    if (requestData.violation === 'function-in-dependency-array') {
      return new Response(JSON.stringify({
        error: {
          message: '$300 사건 방지: useEffect 의존성 배열에 함수가 포함되어 있습니다',
          code: 'USEEFFECT_VIOLATION',
          prevention: true,
        },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 기본 응답 (404)
  return new Response(JSON.stringify({
    error: {
      message: `엔드포인트를 찾을 수 없습니다: ${method} ${pathname}`,
      status: 404,
    },
  }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}