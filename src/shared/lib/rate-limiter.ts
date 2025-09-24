/**
 * Rate Limiting Engine - $300 사건 방지 핵심 시스템
 * 분당/시간당/일별 API 호출 제한 및 추적
 * CLAUDE.md의 비용 안전 규칙 강화
 */

import { z } from 'zod';

// Rate Limit 규칙 스키마
const RateLimitRuleSchema = z.object({
  identifier: z.string(), // API 엔드포인트 또는 사용자 ID
  maxCalls: z.number().positive(),
  windowMs: z.number().positive(), // 시간 윈도우 (밀리초)
  blockDurationMs: z.number().positive().optional(), // 차단 시간 (기본값: windowMs)
});

type RateLimitRule = z.infer<typeof RateLimitRuleSchema>;

// 호출 기록 인터페이스
interface CallRecord {
  timestamp: number;
  endpoint: string;
  userId?: string;
  cost: number;
  metadata?: Record<string, unknown>;
}

// Rate Limit 상태 인터페이스
interface RateLimitStatus {
  identifier: string;
  isBlocked: boolean;
  remainingCalls: number;
  resetTime: number;
  callsInWindow: number;
  nextAllowedTime: number;
}

// 에러 타입
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly status: RateLimitStatus,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Rate Limiter 클래스
export class RateLimiter {
  private callRecords = new Map<string, CallRecord[]>();
  private blockList = new Map<string, number>(); // identifier -> unblock timestamp
  private rules = new Map<string, RateLimitRule>();

  constructor() {
    this.setupDefaultRules();
    this.startCleanupTimer();
  }

  /**
   * 기본 Rate Limit 규칙 설정
   * $300 사건을 방지하기 위한 엄격한 규칙
   */
  private setupDefaultRules(): void {
    // API별 Rate Limit 규칙 (밀리초 단위)
    const apiRules: Array<[string, number, number]> = [
      // [endpoint, maxCalls, windowMs]
      ['/api/auth/me', 1, 60 * 1000], // 1분에 1회 (가장 중요!)
      ['/api/auth/checkAuth', 2, 60 * 1000], // 1분에 2회
      ['/api/auth/refreshToken', 1, 5 * 60 * 1000], // 5분에 1회

      // AI API 호출 제한
      ['/api/storyboard/generate', 5, 60 * 1000], // 1분에 5회
      ['/api/video/generate', 2, 60 * 1000], // 1분에 2회 (고비용)
      ['/api/ai/generate-story', 10, 60 * 1000], // 1분에 10회
      ['/api/scenario/generate', 8, 60 * 1000], // 1분에 8회
      ['/api/prompt/generate', 15, 60 * 1000], // 1분에 15회

      // 일반 API
      ['/api/planning/*', 30, 60 * 1000], // 1분에 30회
      ['/api/feedback/*', 50, 60 * 1000], // 1분에 50회
    ];

    apiRules.forEach(([endpoint, maxCalls, windowMs]) => {
      this.addRule({
        identifier: endpoint,
        maxCalls,
        windowMs,
        blockDurationMs: windowMs * 2, // 위반 시 윈도우의 2배 시간 차단
      });
    });

    // 사용자별 전역 제한
    this.addRule({
      identifier: 'global:user',
      maxCalls: 100, // 1분에 100회
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000, // 5분 차단
    });

    // 시간당 제한
    this.addRule({
      identifier: 'global:hourly',
      maxCalls: 1000, // 1시간에 1000회
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000, // 30분 차단
    });

    // 일일 제한
    this.addRule({
      identifier: 'global:daily',
      maxCalls: 10000, // 하루에 10000회
      windowMs: 24 * 60 * 60 * 1000,
      blockDurationMs: 2 * 60 * 60 * 1000, // 2시간 차단
    });
  }

  /**
   * Rate Limit 규칙 추가
   */
  addRule(rule: RateLimitRule): void {
    const validatedRule = RateLimitRuleSchema.parse(rule);
    this.rules.set(validatedRule.identifier, validatedRule);
  }

  /**
   * Rate Limit 규칙 제거
   */
  removeRule(identifier: string): void {
    this.rules.delete(identifier);
    this.callRecords.delete(identifier);
    this.blockList.delete(identifier);
  }

  /**
   * API 호출 허용 여부 확인
   */
  isAllowed(
    endpoint: string,
    userId: string = 'anonymous',
    cost: number = 0.01
  ): boolean {
    const now = Date.now();

    // 차단 목록 확인
    if (this.isBlocked(endpoint, now) || this.isBlocked(`user:${userId}`, now)) {
      return false;
    }

    // 매칭되는 규칙들 찾기
    const matchingRules = this.getMatchingRules(endpoint, userId);

    // 모든 규칙을 확인
    for (const rule of matchingRules) {
      const status = this.getStatus(rule.identifier, now);
      if (status.remainingCalls <= 0) {
        // 차단 목록에 추가
        const blockDuration = rule.blockDurationMs || rule.windowMs;
        this.blockList.set(rule.identifier, now + blockDuration);
        return false;
      }
    }

    return true;
  }

  /**
   * API 호출 기록
   */
  recordCall(
    endpoint: string,
    userId: string = 'anonymous',
    cost: number = 0.01,
    metadata?: Record<string, unknown>
  ): void {
    const now = Date.now();
    const record: CallRecord = {
      timestamp: now,
      endpoint,
      userId,
      cost,
      metadata,
    };

    // 매칭되는 규칙들에 대해 기록
    const matchingRules = this.getMatchingRules(endpoint, userId);

    for (const rule of matchingRules) {
      const identifier = rule.identifier;
      const records = this.callRecords.get(identifier) || [];

      // 윈도우 밖의 오래된 기록 제거
      const validRecords = records.filter(
        r => now - r.timestamp < rule.windowMs
      );

      validRecords.push(record);
      this.callRecords.set(identifier, validRecords);
    }
  }

  /**
   * Rate Limit 체크 및 기록 (통합 메서드)
   */
  checkAndRecord(
    endpoint: string,
    userId: string = 'anonymous',
    cost: number = 0.01,
    metadata?: Record<string, unknown>
  ): RateLimitStatus {
    const now = Date.now();

    // 차단 상태 확인
    const blocked = this.isBlocked(endpoint, now) || this.isBlocked(`user:${userId}`, now);
    if (blocked) {
      const blockTime = Math.max(
        this.blockList.get(endpoint) || 0,
        this.blockList.get(`user:${userId}`) || 0
      );

      throw new RateLimitError(
        `Rate limit exceeded for ${endpoint}`,
        {
          identifier: endpoint,
          isBlocked: true,
          remainingCalls: 0,
          resetTime: blockTime,
          callsInWindow: 0,
          nextAllowedTime: blockTime,
        },
        Math.ceil((blockTime - now) / 1000)
      );
    }

    // 허용 여부 확인
    if (!this.isAllowed(endpoint, userId, cost)) {
      const status = this.getStatus(endpoint, now);
      const retryAfter = Math.ceil((status.resetTime - now) / 1000);

      throw new RateLimitError(
        `Rate limit exceeded for ${endpoint}. Try again in ${retryAfter} seconds.`,
        status,
        retryAfter
      );
    }

    // 호출 기록
    this.recordCall(endpoint, userId, cost, metadata);

    // 현재 상태 반환
    return this.getStatus(endpoint, now);
  }

  /**
   * Rate Limit 상태 조회
   */
  getStatus(identifier: string, now: number = Date.now()): RateLimitStatus {
    const rule = this.rules.get(identifier);
    if (!rule) {
      // 기본 상태 반환
      return {
        identifier,
        isBlocked: false,
        remainingCalls: Infinity,
        resetTime: now,
        callsInWindow: 0,
        nextAllowedTime: now,
      };
    }

    const records = this.callRecords.get(identifier) || [];
    const validRecords = records.filter(
      r => now - r.timestamp < rule.windowMs
    );

    const isBlocked = this.isBlocked(identifier, now);
    const callsInWindow = validRecords.length;
    const remainingCalls = Math.max(0, rule.maxCalls - callsInWindow);

    // 리셋 시간 계산 (가장 오래된 호출 + 윈도우)
    const oldestCall = validRecords[0];
    const resetTime = oldestCall
      ? oldestCall.timestamp + rule.windowMs
      : now;

    const nextAllowedTime = isBlocked
      ? this.blockList.get(identifier) || now
      : (remainingCalls > 0 ? now : resetTime);

    return {
      identifier,
      isBlocked,
      remainingCalls,
      resetTime,
      callsInWindow,
      nextAllowedTime,
    };
  }

  /**
   * 모든 규칙의 상태 조회
   */
  getAllStatuses(now: number = Date.now()): RateLimitStatus[] {
    return Array.from(this.rules.keys()).map(identifier =>
      this.getStatus(identifier, now)
    );
  }

  /**
   * 차단 여부 확인
   */
  private isBlocked(identifier: string, now: number): boolean {
    const blockUntil = this.blockList.get(identifier);
    if (!blockUntil || now >= blockUntil) {
      this.blockList.delete(identifier);
      return false;
    }
    return true;
  }

  /**
   * 엔드포인트와 사용자에 매칭되는 규칙들 찾기
   */
  private getMatchingRules(endpoint: string, userId: string): RateLimitRule[] {
    const rules: RateLimitRule[] = [];

    for (const [identifier, rule] of this.rules) {
      // 정확한 매치
      if (identifier === endpoint) {
        rules.push(rule);
        continue;
      }

      // 와일드카드 매치
      if (identifier.endsWith('*')) {
        const prefix = identifier.slice(0, -1);
        if (endpoint.startsWith(prefix)) {
          rules.push(rule);
          continue;
        }
      }

      // 사용자별 규칙
      if (identifier.startsWith('user:') && identifier === `user:${userId}`) {
        rules.push(rule);
        continue;
      }

      // 전역 규칙
      if (identifier.startsWith('global:')) {
        rules.push(rule);
        continue;
      }
    }

    return rules;
  }

  /**
   * 오래된 기록 정리 타이머
   */
  private startCleanupTimer(): void {
    const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5분마다 정리

    setInterval(() => {
      const now = Date.now();

      // 오래된 호출 기록 정리
      for (const [identifier, records] of this.callRecords) {
        const rule = this.rules.get(identifier);
        if (!rule) continue;

        const validRecords = records.filter(
          r => now - r.timestamp < rule.windowMs * 2 // 여유분 두고 정리
        );

        if (validRecords.length === 0) {
          this.callRecords.delete(identifier);
        } else {
          this.callRecords.set(identifier, validRecords);
        }
      }

      // 만료된 차단 제거
      for (const [identifier, blockUntil] of this.blockList) {
        if (now >= blockUntil) {
          this.blockList.delete(identifier);
        }
      }
    }, CLEANUP_INTERVAL);
  }

  /**
   * 통계 조회 (개발/모니터링 용도)
   */
  getStats() {
    return {
      rulesCount: this.rules.size,
      recordsCount: Array.from(this.callRecords.values()).reduce(
        (sum, records) => sum + records.length, 0
      ),
      blockedCount: this.blockList.size,
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * 캐시 초기화 (테스트 용도)
   */
  reset(): void {
    this.callRecords.clear();
    this.blockList.clear();
    this.setupDefaultRules();
  }
}

// 전역 Rate Limiter 인스턴스
export const rateLimiter = new RateLimiter();

// localStorage를 활용한 영구 저장 (브라우저 환경)
if (typeof window !== 'undefined') {
  // 페이지 로드 시 저장된 데이터 복원
  try {
    const savedData = localStorage.getItem('videoprompt_rate_limit_data');
    if (savedData) {
      const { callRecords, blockList } = JSON.parse(savedData);
      // 여기서는 간단히 로그만 남김 (실제 복원은 보안상 신중하게 처리)
      console.log('[Rate Limiter] 저장된 데이터 발견:', { callRecords: Object.keys(callRecords).length, blockList: Object.keys(blockList).length });
    }
  } catch (error) {
    console.warn('[Rate Limiter] 저장된 데이터 복원 실패:', error);
  }

  // 주기적으로 localStorage에 저장
  setInterval(() => {
    try {
      const data = {
        callRecords: Object.fromEntries(rateLimiter['callRecords']),
        blockList: Object.fromEntries(rateLimiter['blockList']),
        timestamp: Date.now(),
      };
      localStorage.setItem('videoprompt_rate_limit_data', JSON.stringify(data));
    } catch (error) {
      console.warn('[Rate Limiter] 데이터 저장 실패:', error);
    }
  }, 60 * 1000); // 1분마다 저장
}

// useEffect 안전 패턴 검증 (React Hook용)
export function useEffectSafetyCheck(
  dependencies: unknown[],
  componentName: string = 'Unknown'
): boolean {
  // 함수 의존성 검사
  const functionDeps = dependencies.filter(dep => typeof dep === 'function');

  if (functionDeps.length > 0) {
    const error = new Error(
      `[useEffect Safety] ${componentName}에서 useEffect 의존성 배열에 함수가 포함됨! $300 사건 위험!`
    );

    // Rate Limiter에 위반 기록
    rateLimiter.recordCall(
      '/internal/useeffect-violation',
      componentName,
      300, // $300 비용으로 기록
      {
        functionDeps: functionDeps.length,
        violationType: 'function-in-dependency-array',
        riskLevel: 'CRITICAL'
      }
    );

    console.error(error.message);

    // 개발 환경에서는 에러 발생
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }

    return false;
  }

  return true;
}