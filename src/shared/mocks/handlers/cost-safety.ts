/**
 * 비용 안전 규칙 및 Rate Limiting 모킹
 * $300 사건 방지를 위한 핵심 안전장치
 */

import { http, HttpResponse } from 'msw';

// API 호출 추적을 위한 메모리 저장소
const apiCallTracker = new Map<string, {
  count: number;
  lastCall: number;
  totalCost: number;
}>();

// 비용 계산 규칙
const COST_RULES = {
  '/api/storyboard/generate': 2.5,
  '/api/video/generate': 5.0,
  '/api/ai/generate-story': 1.0,
  '/api/auth/me': 0.01, // $300 사건의 원인
} as const;

// Rate Limiting 규칙 (밀리초)
const RATE_LIMITS = {
  '/api/storyboard/generate': 5000, // 5초
  '/api/video/generate': 10000, // 10초
  '/api/ai/generate-story': 2000, // 2초
  '/api/auth/me': 60000, // 1분 (가장 중요!)
} as const;

// 최대 일일 비용 (USD)
const DAILY_COST_LIMIT = 50;

/**
 * 비용 안전 검증 미들웨어
 */
const checkCostSafety = (endpoint: string, userId: string = 'test-user'): boolean => {
  const now = Date.now();
  const key = `${userId}:${endpoint}`;
  const tracker = apiCallTracker.get(key) || { count: 0, lastCall: 0, totalCost: 0 };

  // Rate Limiting 검증
  const rateLimit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS];
  if (rateLimit && (now - tracker.lastCall) < rateLimit) {
    throw new Error(`Rate limit exceeded for ${endpoint}. Please wait ${Math.ceil((rateLimit - (now - tracker.lastCall)) / 1000)} seconds.`);
  }

  // 비용 계산
  const cost = COST_RULES[endpoint as keyof typeof COST_RULES] || 0;
  const newTotalCost = tracker.totalCost + cost;

  // 일일 비용 한도 검증
  if (newTotalCost > DAILY_COST_LIMIT) {
    throw new Error(`Daily cost limit exceeded. Current: $${tracker.totalCost.toFixed(2)}, Attempted: $${cost}, Limit: $${DAILY_COST_LIMIT}`);
  }

  // 추적 정보 업데이트
  apiCallTracker.set(key, {
    count: tracker.count + 1,
    lastCall: now,
    totalCost: newTotalCost,
  });

  return true;
};

/**
 * 비용 안전 핸들러들
 */
export const costSafetyHandlers = [
  // 비용 추적 조회
  http.get('/api/admin/cost-tracking', () => {
    const totalCost = Array.from(apiCallTracker.values())
      .reduce((sum, tracker) => sum + tracker.totalCost, 0);

    return HttpResponse.json({
      totalCost: totalCost.toFixed(2),
      dailyLimit: DAILY_COST_LIMIT,
      remaining: (DAILY_COST_LIMIT - totalCost).toFixed(2),
      calls: Object.fromEntries(apiCallTracker),
    });
  }),

  // 비용 안전 검사
  http.post('/api/admin/cost-safety-check', async ({ request }) => {
    try {
      const { endpoint, userId } = await request.json() as any;
      checkCostSafety(endpoint, userId);

      return HttpResponse.json({
        safe: true,
        message: 'API call is within safety limits',
      });
    } catch (error) {
      return HttpResponse.json({
        safe: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 429 });
    }
  }),

  // Rate Limit 상태 조회
  http.get('/api/admin/rate-limits', () => {
    const now = Date.now();
    const status = Object.entries(RATE_LIMITS).map(([endpoint, limit]) => {
      const trackers = Array.from(apiCallTracker.entries())
        .filter(([key]) => key.includes(endpoint))
        .map(([, tracker]) => tracker);

      const lastCall = Math.max(...trackers.map(t => t.lastCall), 0);
      const remainingMs = Math.max(0, limit - (now - lastCall));

      return {
        endpoint,
        limit: limit / 1000, // 초 단위로 변환
        remaining: Math.ceil(remainingMs / 1000),
        available: remainingMs === 0,
      };
    });

    return HttpResponse.json({ rateLimits: status });
  }),

  // 추적 정보 초기화 (테스트용)
  http.delete('/api/admin/cost-tracking', () => {
    apiCallTracker.clear();
    return HttpResponse.json({ message: 'Cost tracking reset' });
  }),
];

/**
 * 비용 안전 검증을 포함한 API 핸들러 래퍼
 */
export const withCostSafety = (endpoint: string, handler: Function) => {
  return async (info: any) => {
    try {
      // 비용 안전 검증
      checkCostSafety(endpoint);

      // 원래 핸들러 실행
      return await handler(info);
    } catch (error) {
      return HttpResponse.json({
        error: {
          message: error instanceof Error ? error.message : 'Cost safety violation',
          code: 'COST_SAFETY_VIOLATION',
          type: 'rate_limit_exceeded',
        },
      }, { status: 429 });
    }
  };
};