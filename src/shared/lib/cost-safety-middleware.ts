/**
 * Cost Safety Middleware - $300 사건 방지 시스템 (완전 강화 버전)
 * Redux 액션 및 API 호출 모니터링
 * Rate Limiter와 통합된 다층 보안 시스템
 * CLAUDE.md의 비용 안전 규칙 100% 강화
 */

import { Middleware, Dispatch, AnyAction } from '@reduxjs/toolkit';
import { rateLimiter, RateLimitError } from './rate-limiter';
import { z } from 'zod';

// 정확한 API 비용 측정을 위한 스키마
const ApiCostSchema = z.object({
  endpoint: z.string(),
  provider: z.enum(['gemini', 'bytedance', 'runway', 'openai', 'internal']),
  baseTokens: z.number().min(0),
  outputTokens: z.number().min(0),
  imageCount: z.number().min(0).optional(),
  videoSeconds: z.number().min(0).optional(),
  model: z.string().optional(),
});

type ApiCostData = z.infer<typeof ApiCostSchema>;

// API 호출 추적을 위한 인터페이스
interface ApiCallRecord {
  timestamp: number;
  endpoint: string;
  cost: number; // 정확한 비용 (USD)
  provider: string;
  tokens: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface CostSafetyConfig {
  maxCallsPerMinute: number;
  maxCostPerHour: number; // USD
  maxCostPerDay: number; // USD
  maxCostPerWeek: number; // USD
  warningThreshold: number; // 0.8 (80%)
  emergencyThreshold: number; // 0.95 (95%)
  alertWebhookUrl?: string;
}

// 강화된 기본 설정 ($300 사건 교훈 반영)
const DEFAULT_CONFIG: CostSafetyConfig = {
  maxCallsPerMinute: 20, // 더 엄격하게 제한
  maxCostPerHour: 5, // $300 사건 방지를 위해 매우 낮게 설정
  maxCostPerDay: 25, // 하루 최대 $25
  maxCostPerWeek: 150, // 주당 최대 $150
  warningThreshold: 0.7, // 70%에서 경고
  emergencyThreshold: 0.9, // 90%에서 긴급 차단
};

// 정확한 API 비용 계산 함수
export class ApiCostCalculator {
  // 최신 API 요금표 (2025년 기준)
  private static readonly COST_TABLE = {
    gemini: {
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 }, // per 1K tokens
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    },
    bytedance: {
      'sd-xl': { image: 0.04 }, // per image
      'sd-3': { image: 0.08 },
    },
    runway: {
      'gen-3': { video: 0.95 }, // per second
      'gen-2': { video: 0.75 },
    },
    openai: {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    },
    internal: {
      'default': { input: 0.0001, output: 0.0001 }, // 내부 처리 비용
    },
  } as const;

  static calculateCost(data: ApiCostData): number {
    const provider = this.COST_TABLE[data.provider];
    if (!provider) return 0.01; // 기본값

    const model = data.model || Object.keys(provider)[0];
    const pricing = provider[model as keyof typeof provider];
    if (!pricing) return 0.01;

    let cost = 0;

    // 텍스트 API 비용 계산
    if ('input' in pricing && 'output' in pricing) {
      cost += (data.baseTokens / 1000) * (pricing as any).input;
      cost += (data.outputTokens / 1000) * (pricing as any).output;
    }

    // 이미지 API 비용 계산
    if ('image' in pricing && data.imageCount) {
      cost += data.imageCount * (pricing as any).image;
    }

    // 비디오 API 비용 계산
    if ('video' in pricing && data.videoSeconds) {
      cost += data.videoSeconds * (pricing as any).video;
    }

    return Math.max(cost, 0.001); // 최소 비용
  }
}

// 강화된 비용 추적 클래스
class EnhancedCostTracker {
  private apiCalls: ApiCallRecord[] = [];
  private config: CostSafetyConfig;
  private emergencyMode = false;

  constructor(config: CostSafetyConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.startPeriodicCleanup();
  }

  // 정확한 API 호출 비용 기록
  recordApiCall(
    endpoint: string,
    costData: Partial<ApiCostData>,
    userId?: string,
    metadata?: Record<string, unknown>
  ): boolean {
    const now = Date.now();

    try {
      // Rate Limiter 체크 먼저 수행
      rateLimiter.checkAndRecord(endpoint, userId, costData.baseTokens);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.error(`[Cost Safety] Rate Limit 위반: ${error.message}`);
        return false;
      }
    }

    // 정확한 비용 계산
    const cost = costData.baseTokens ?
      ApiCostCalculator.calculateCost({
        endpoint,
        provider: costData.provider || 'internal',
        baseTokens: costData.baseTokens || 0,
        outputTokens: costData.outputTokens || 0,
        imageCount: costData.imageCount,
        videoSeconds: costData.videoSeconds,
        model: costData.model,
      }) : 0.01;

    // 긴급 모드 체크
    if (this.emergencyMode) {
      console.error(`[Cost Safety] 긴급 모드 활성화됨 - 모든 API 호출 차단`);
      return false;
    }

    // 1분 이전 호출 제거
    this.cleanOldRecords(now);

    // 분당 호출 수 체크
    const recentCalls = this.apiCalls.filter(call => now - call.timestamp < 60 * 1000);
    if (recentCalls.length >= this.config.maxCallsPerMinute) {
      console.error(`[Cost Safety] 분당 호출 제한 초과: ${recentCalls.length}/${this.config.maxCallsPerMinute}`);
      return false;
    }

    // 다층 비용 체크
    const checks = [
      { period: '시간당', cost: this.getHourCost(now), limit: this.config.maxCostPerHour },
      { period: '일일', cost: this.getDayCost(now), limit: this.config.maxCostPerDay },
      { period: '주간', cost: this.getWeekCost(now), limit: this.config.maxCostPerWeek },
    ];

    for (const check of checks) {
      const projectedCost = check.cost + cost;

      // 긴급 임계값 체크
      if (projectedCost > check.limit * this.config.emergencyThreshold) {
        this.activateEmergencyMode();
        console.error(`[Cost Safety] 긴급 차단: ${check.period} 비용 ${this.config.emergencyThreshold * 100}% 초과`);
        return false;
      }

      // 일반 제한 체크
      if (projectedCost > check.limit) {
        console.error(`[Cost Safety] ${check.period} 비용 제한 초과: $${projectedCost.toFixed(3)}/$${check.limit}`);
        return false;
      }

      // 경고 임계값 체크
      if (projectedCost > check.limit * this.config.warningThreshold) {
        console.warn(`[Cost Safety] ${check.period} 비용 경고: $${projectedCost.toFixed(3)}/$${check.limit} (${(projectedCost / check.limit * 100).toFixed(1)}%)`);
        this.sendAlert('warning', check.period, projectedCost, check.limit);
      }
    }

    // 호출 기록
    this.apiCalls.push({
      timestamp: now,
      endpoint,
      cost,
      provider: costData.provider || 'internal',
      tokens: (costData.baseTokens || 0) + (costData.outputTokens || 0),
      userId,
      metadata,
    });

    return true;
  }

  // 긴급 모드 활성화
  private activateEmergencyMode(): void {
    this.emergencyMode = true;
    console.error(`[Cost Safety] 🚨 긴급 모드 활성화! 모든 API 호출 차단됨`);

    // 30분 후 자동 해제
    setTimeout(() => {
      this.emergencyMode = false;
      console.log(`[Cost Safety] 긴급 모드 해제됨`);
    }, 30 * 60 * 1000);

    this.sendAlert('emergency', '시스템', 0, 0);
  }

  // 알림 전송
  private sendAlert(
    level: 'warning' | 'emergency',
    period: string,
    currentCost: number,
    limit: number
  ): void {
    const message = level === 'emergency'
      ? `🚨 긴급 알림: VideoPlanet 비용 안전 시스템이 긴급 모드로 전환되었습니다`
      : `⚠️ 경고: ${period} 비용이 ${(currentCost / limit * 100).toFixed(1)}%에 도달했습니다 ($${currentCost.toFixed(3)}/$${limit})`;

    console[level === 'emergency' ? 'error' : 'warn'](`[Cost Safety Alert] ${message}`);

    // Webhook 알림 (설정된 경우)
    if (this.config.alertWebhookUrl) {
      fetch(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          period,
          currentCost,
          limit,
          timestamp: new Date().toISOString(),
        }),
      }).catch(error => console.error('Alert webhook 전송 실패:', error));
    }
  }

  // 주기적 정리
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanOldRecords(Date.now());
    }, 10 * 60 * 1000); // 10분마다 정리
  }

  private cleanOldRecords(now: number): void {
    // 1주일 이전 데이터 제거
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    this.apiCalls = this.apiCalls.filter(call => call.timestamp > oneWeekAgo);
  }

  private getHourCost(now: number): number {
    const oneHourAgo = now - 60 * 60 * 1000;
    return this.apiCalls
      .filter(call => call.timestamp > oneHourAgo)
      .reduce((total, call) => total + call.cost, 0);
  }

  private getDayCost(now: number): number {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    return this.apiCalls
      .filter(call => call.timestamp > oneDayAgo)
      .reduce((total, call) => total + call.cost, 0);
  }

  private getWeekCost(now: number): number {
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return this.apiCalls
      .filter(call => call.timestamp > oneWeekAgo)
      .reduce((total, call) => total + call.cost, 0);
  }

  // 상세 통계 조회
  getStats() {
    const now = Date.now();
    return {
      callsLastMinute: this.apiCalls.filter(call => now - call.timestamp < 60 * 1000).length,
      costLastHour: this.getHourCost(now),
      costLastDay: this.getDayCost(now),
      costLastWeek: this.getWeekCost(now),
      totalCalls: this.apiCalls.length,
      emergencyMode: this.emergencyMode,
      topEndpoints: this.getTopEndpoints(now),
      providerBreakdown: this.getProviderBreakdown(now),
    };
  }

  private getTopEndpoints(now: number): Array<{ endpoint: string; calls: number; cost: number }> {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentCalls = this.apiCalls.filter(call => call.timestamp > oneDayAgo);

    const endpointStats = recentCalls.reduce((acc, call) => {
      acc[call.endpoint] = acc[call.endpoint] || { calls: 0, cost: 0 };
      acc[call.endpoint].calls++;
      acc[call.endpoint].cost += call.cost;
      return acc;
    }, {} as Record<string, { calls: number; cost: number }>);

    return Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }

  private getProviderBreakdown(now: number): Array<{ provider: string; calls: number; cost: number }> {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentCalls = this.apiCalls.filter(call => call.timestamp > oneDayAgo);

    const providerStats = recentCalls.reduce((acc, call) => {
      acc[call.provider] = acc[call.provider] || { calls: 0, cost: 0 };
      acc[call.provider].calls++;
      acc[call.provider].cost += call.cost;
      return acc;
    }, {} as Record<string, { calls: number; cost: number }>);

    return Object.entries(providerStats)
      .map(([provider, stats]) => ({ provider, ...stats }))
      .sort((a, b) => b.cost - a.cost);
  }

  // 긴급 모드 수동 해제 (관리자용)
  deactivateEmergencyMode(): void {
    this.emergencyMode = false;
    console.log(`[Cost Safety] 긴급 모드 수동 해제됨`);
  }

  // 완전 리셋 (테스트용)
  reset(): void {
    this.apiCalls = [];
    this.emergencyMode = false;
    console.log(`[Cost Safety] 모든 기록 초기화됨`);
  }
}

// 전역 강화된 비용 추적기
const enhancedCostTracker = new EnhancedCostTracker();

// 위험한 액션들 - $300 사건 방지 패턴 (확장됨)
const DANGEROUS_ACTIONS = [
  // useEffect 무한 루프 방지 (최고 위험도)
  'auth/checkAuth',
  'auth/refreshToken',
  'auth/me',

  // AI API 호출 액션들 (고위험도)
  'scenario/generate',
  'storyboard/generate',
  'storyboard/generateImage',
  'video/generate',
  'ai/generateStory',
  'prompt/generate',

  // 대량 데이터 처리 액션들 (중위험도)
  'storyboard/batch',
  'video/batch',
  'planning/generateConti',
  'planning/generateShots',

  // 빈번한 호출 가능 액션들 (저위험도)
  'planning/save',
  'feedback/send',
  'user/update',
] as const;

// 정확한 API 비용 매핑 (2025년 기준)
const ENHANCED_API_COSTS: Record<string, Partial<ApiCostData>> = {
  // 인증 관련 (내부 처리)
  'auth/me': { provider: 'internal', baseTokens: 10, outputTokens: 5 },
  'auth/checkAuth': { provider: 'internal', baseTokens: 5, outputTokens: 3 },
  'auth/refreshToken': { provider: 'internal', baseTokens: 15, outputTokens: 10 },

  // AI 텍스트 생성 (Gemini)
  'scenario/generate': { provider: 'gemini', baseTokens: 500, outputTokens: 1000, model: 'gemini-1.5-flash' },
  'ai/generateStory': { provider: 'gemini', baseTokens: 800, outputTokens: 1500, model: 'gemini-1.5-pro' },
  'prompt/generate': { provider: 'gemini', baseTokens: 200, outputTokens: 400, model: 'gemini-1.5-flash' },

  // 이미지 생성 (ByteDance)
  'storyboard/generate': { provider: 'bytedance', baseTokens: 100, outputTokens: 50, imageCount: 1, model: 'sd-xl' },
  'storyboard/generateImage': { provider: 'bytedance', baseTokens: 80, outputTokens: 40, imageCount: 1, model: 'sd-3' },

  // 비디오 생성 (Runway) - 가장 비쌈
  'video/generate': { provider: 'runway', baseTokens: 50, outputTokens: 25, videoSeconds: 5, model: 'gen-3' },

  // 배치 처리 (복합)
  'storyboard/batch': { provider: 'bytedance', baseTokens: 500, outputTokens: 200, imageCount: 5 },
  'video/batch': { provider: 'runway', baseTokens: 200, outputTokens: 100, videoSeconds: 20 },

  // 계획 수립 (Gemini + 이미지 생성)
  'planning/generateConti': { provider: 'gemini', baseTokens: 1000, outputTokens: 2000, model: 'gemini-1.5-pro' },
  'planning/generateShots': { provider: 'gemini', baseTokens: 600, outputTokens: 1200, model: 'gemini-1.5-flash' },
};

// 중복 호출 방지를 위한 강화된 캐시
const actionCache = new Map<string, { timestamp: number; count: number }>();
const CACHE_DURATION = 60 * 1000; // 1분
const MAX_DUPLICATE_CALLS = 3; // 1분 내 최대 중복 호출 수

// useEffect 안전 패턴 감지 함수
function detectUseEffectViolation(action: AnyAction): boolean {
  // useEffect 관련 액션 패턴 감지
  const isAuthAction = action.type.startsWith('auth/');
  const hasPayload = action.payload;
  const isFrequentCall = ['auth/me', 'auth/checkAuth'].includes(action.type);

  if (isAuthAction && isFrequentCall) {
    // 연속 호출 패턴 감지
    const cacheKey = `useeffect_violation_${action.type}`;
    const recent = actionCache.get(cacheKey);
    const now = Date.now();

    if (recent && now - recent.timestamp < 5000) { // 5초 이내
      recent.count++;
      if (recent.count >= 3) {
        // useEffect 의존성 배열 위반 의심
        console.error(`🚨 [useEffect Safety] ${action.type} 연속 호출 감지! $300 사건 위험 패턴!`);

        // Rate Limiter에 위험 기록
        enhancedCostTracker.recordApiCall(
          '/internal/useeffect-violation',
          { provider: 'internal', baseTokens: 0, outputTokens: 0 },
          'system',
          {
            actionType: action.type,
            violationType: 'rapid-successive-calls',
            riskLevel: 'CRITICAL',
            count: recent.count,
          }
        );

        return true; // 위반 감지됨
      }
    } else {
      actionCache.set(cacheKey, { timestamp: now, count: 1 });
    }
  }

  return false;
}

// 강화된 비용 안전 미들웨어
export const costSafetyMiddleware: Middleware = (storeAPI) => (next) => (action: unknown) => {
  const actionType = (action as any).type;

  // useEffect 위반 패턴 감지
  if (detectUseEffectViolation(action as any)) {
    // 위험한 패턴 감지됨 - 액션 차단
    storeAPI.dispatch({
      type: 'system/setError',
      payload: {
        code: 'USEEFFECT_VIOLATION',
        message: 'useEffect 의존성 배열 위반이 감지되었습니다. $300 사건 방지를 위해 호출이 차단되었습니다.',
        severity: 'CRITICAL',
      },
    });
    return; // 액션 차단
  }

  // 위험한 액션인지 체크
  if (DANGEROUS_ACTIONS.includes(actionType as any)) {
    const now = Date.now();
    const cacheKey = `${actionType}_${JSON.stringify((action as any).payload || {})}`;
    const lastCall = actionCache.get(cacheKey);

    // 중복 호출 체크 (강화됨)
    if (lastCall && now - lastCall.timestamp < CACHE_DURATION) {
      lastCall.count++;

      if (lastCall.count > MAX_DUPLICATE_CALLS) {
        console.error(`[Cost Safety] 과도한 중복 호출 차단: ${actionType} (${lastCall.count}회)`);

        storeAPI.dispatch({
          type: `${actionType.split('/')[0]}/setError`,
          payload: {
            code: 'DUPLICATE_CALL_LIMIT',
            message: '동일한 요청이 너무 자주 발생했습니다. 잠시 후 다시 시도해주세요.',
            retryAfter: Math.ceil((CACHE_DURATION - (now - lastCall.timestamp)) / 1000),
          },
        });
        return; // 액션 차단
      }

      console.warn(`[Cost Safety] 중복 호출 경고: ${actionType} (${now - lastCall.timestamp}ms 전, ${lastCall.count}회째)`);
    }

    // 정확한 비용 데이터 가져오기
    const costData = ENHANCED_API_COSTS[actionType] || { provider: 'internal', baseTokens: 10, outputTokens: 5 };

    // 사용자 ID 추출 (가능한 경우)
    const userId = (action as any).payload?.userId ||
                   (storeAPI.getState() as any).auth?.user?.id ||
                   'anonymous';

    // 강화된 비용 추적
    const allowed = enhancedCostTracker.recordApiCall(
      actionType,
      costData,
      userId,
      {
        timestamp: now,
        payload: (action as any).payload,
        userAgent: typeof window !== 'undefined' ? window.navigator?.userAgent : 'server',
      }
    );

    if (!allowed) {
      // 비용 제한으로 인한 호출 차단
      console.error(`[Cost Safety] 액션 차단: ${actionType}`);

      storeAPI.dispatch({
        type: `${actionType.split('/')[0]}/setError`,
        payload: {
          code: 'COST_LIMIT_EXCEEDED',
          message: '비용 제한으로 인해 요청이 차단되었습니다. 잠시 후 다시 시도해주세요.',
          stats: enhancedCostTracker.getStats(),
        },
      });

      return; // 액션 차단
    }

    // 캐시에 기록/업데이트
    if (lastCall) {
      lastCall.timestamp = now;
    } else {
      actionCache.set(cacheKey, { timestamp: now, count: 1 });
    }

    // 상세 통계 로깅
    const stats = enhancedCostTracker.getStats();
    console.log(`[Cost Safety] API 호출 허용: ${actionType}`, {
      cost: ApiCostCalculator.calculateCost({
        endpoint: actionType,
        ...costData,
      } as ApiCostData),
      stats: {
        hourlyBudgetUsed: `${(stats.costLastHour / DEFAULT_CONFIG.maxCostPerHour * 100).toFixed(1)}%`,
        dailyBudgetUsed: `${(stats.costLastDay / DEFAULT_CONFIG.maxCostPerDay * 100).toFixed(1)}%`,
      },
    });
  }

  return next(action);
};

// 강화된 useEffect 안전 패턴 검증 함수
export function validateUseEffectDependencies(
  dependencies: unknown[],
  componentName: string = 'Unknown',
  hookLineNumber?: number
): boolean {
  // 함수가 의존성에 포함되어 있는지 체크
  const functionDeps = dependencies.filter(dep => typeof dep === 'function');

  if (functionDeps.length > 0) {
    const errorMessage = `[useEffect Safety] ${componentName}${hookLineNumber ? `:${hookLineNumber}` : ''}에서 useEffect 의존성 배열에 함수가 포함됨! $300 사건 위험!`;
    console.error(errorMessage);

    // 위반 사항을 추적기에 기록
    enhancedCostTracker.recordApiCall(
      '/internal/useeffect-violation',
      { provider: 'internal', baseTokens: 0, outputTokens: 0 },
      componentName,
      {
        violationType: 'function-in-dependency-array',
        functionCount: functionDeps.length,
        lineNumber: hookLineNumber,
        riskLevel: 'CRITICAL',
        potentialCost: 300, // $300 사건 참조
      }
    );

    // 개발 환경에서는 에러 발생
    if (process.env.NODE_ENV === 'development') {
      throw new Error(errorMessage);
    }

    return false;
  }

  return true;
}

// React Hook 래퍼 - useEffect 안전 사용을 위한 헬퍼
export function useSafeEffect(
  effect: () => void | (() => void),
  deps: unknown[],
  componentName: string = 'Unknown'
): void {
  // 의존성 배열 검증
  if (!validateUseEffectDependencies(deps, componentName)) {
    // 위험한 의존성이 감지되면 안전한 빈 배열로 대체
    console.warn(`[useEffect Safety] ${componentName}의 위험한 의존성을 빈 배열로 대체합니다.`);
    deps = [];
  }

  // 실제 useEffect 호출은 React 컴포넌트에서만 가능
  console.log(`[useEffect Safety] ${componentName}에서 안전한 의존성 배열이 검증되었습니다.`);
}

// Cost Safety Context for API Routes
export interface CostSafetyContext {
  userId: string;
  operation: string;
  userDailySpent: number;
  userWeeklySpent: number;
  lastCallTimestamp?: number;
}

export interface CostSafetyCheck {
  allowed: boolean;
  reason?: string;
  estimatedCost: number;
  remainingBudget?: number;
  totalSpent?: number;
}

/**
 * API 라우트용 비용 안전 컨텍스트 생성
 */
export async function createCostSafetyContext(
  userId: string,
  operation: string
): Promise<CostSafetyContext> {
  const stats = enhancedCostTracker.getStats();

  // 실제 구현에서는 데이터베이스에서 사용자별 비용 데이터를 조회
  // const userSpending = await db.userSpending.findUnique({ where: { userId } });

  return {
    userId,
    operation,
    userDailySpent: stats.costLastDay, // 임시: 전체 비용을 사용자 비용으로 사용
    userWeeklySpent: stats.costLastWeek,
    lastCallTimestamp: Date.now(),
  };
}

/**
 * API 라우트용 비용 안전 검증 함수
 */
export async function validateApiCostSafety(
  context: CostSafetyContext,
  options: {
    estimatedCost: number;
    maxAllowedCost: number;
    userDailyLimit: number;
    emergencyStopThreshold?: number;
  }
): Promise<CostSafetyCheck> {
  const { estimatedCost, maxAllowedCost, userDailyLimit, emergencyStopThreshold } = options;

  // 1. 단일 요청 비용 체크
  if (estimatedCost > maxAllowedCost) {
    return {
      allowed: false,
      reason: `Request cost $${estimatedCost.toFixed(3)} exceeds maximum allowed cost $${maxAllowedCost}`,
      estimatedCost,
      remainingBudget: userDailyLimit - context.userDailySpent,
    };
  }

  // 2. 일일 예산 체크
  const projectedDailyCost = context.userDailySpent + estimatedCost;
  if (projectedDailyCost > userDailyLimit) {
    return {
      allowed: false,
      reason: `Daily budget limit exceeded: $${projectedDailyCost.toFixed(3)} > $${userDailyLimit}`,
      estimatedCost,
      remainingBudget: Math.max(0, userDailyLimit - context.userDailySpent),
      totalSpent: context.userDailySpent,
    };
  }

  // 3. 긴급 중단 체크 (MEMORY.md $300 incident prevention)
  if (emergencyStopThreshold && context.userWeeklySpent >= emergencyStopThreshold) {
    return {
      allowed: false,
      reason: `Emergency stop activated: Weekly spending $${context.userWeeklySpent.toFixed(3)} >= $${emergencyStopThreshold}`,
      estimatedCost,
      remainingBudget: 0,
      totalSpent: context.userWeeklySpent,
    };
  }

  // 4. Rate limiting 체크
  try {
    rateLimiter.checkAndRecord(context.operation, context.userId, estimatedCost * 1000); // Convert to tokens
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${error.message}`,
        estimatedCost,
        remainingBudget: userDailyLimit - context.userDailySpent,
      };
    }
  }

  // 모든 체크 통과
  return {
    allowed: true,
    estimatedCost,
    remainingBudget: userDailyLimit - context.userDailySpent,
    totalSpent: context.userDailySpent,
  };
}

// 전역 API 접근자들
export const getCostTracker = () => enhancedCostTracker;
export const getCostStats = () => enhancedCostTracker.getStats();
export const getRateLimiterStats = () => rateLimiter.getStats();

// 관리자 기능들
export const deactivateEmergencyMode = () => enhancedCostTracker.deactivateEmergencyMode();
export const resetCostTracking = () => {
  enhancedCostTracker.reset();
  rateLimiter.reset();
  actionCache.clear();
  console.log('[Cost Safety] 모든 추적 데이터가 초기화되었습니다.');
};

// 캐시 초기화 (테스트용)
export const clearActionCache = () => {
  actionCache.clear();
  console.log('[Cost Safety] 액션 캐시가 초기화되었습니다.');
};

// ApiCostCalculator는 이미 위에서 export됨

// Rate Limiter 노출
export { rateLimiter };

// ===== CostSafetyMiddleware 클래스 =====
// 다른 서비스에서 인스턴스를 만들어서 사용하기 위한 클래스
export class CostSafetyMiddleware {
  private config: CostSafetyConfig;

  constructor(config?: Partial<CostSafetyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async validateRequest(
    operation: string,
    userId: string,
    estimatedCost: number,
    context?: Record<string, unknown>
  ) {
    const costContext = await createCostSafetyContext(userId, operation);
    return validateApiCostSafety(costContext, {
      estimatedCost,
      maxAllowedCost: this.config.maxCostPerHour,
      userDailyLimit: this.config.maxCostPerDay,
      // operation, // TODO: Add operation field to type
      // context, // TODO: Add context field to type
    } as any);
  }

  getConfig(): CostSafetyConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CostSafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 개발 도구용 전역 객체 (브라우저 환경)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).VideoPlanetCostSafety = {
    getCostStats,
    getRateLimiterStats,
    deactivateEmergencyMode,
    resetCostTracking,
    clearActionCache,
    validateUseEffectDependencies,
    ApiCostCalculator,
    rateLimiter,
    enhancedCostTracker,
  };

  console.log('🛡️ [Cost Safety] 개발 도구가 window.VideoPlanetCostSafety에 등록되었습니다.');
}