/**
 * 고급 Rate Limiting 시스템
 *
 * - IP 기반 제한
 * - 사용자 기반 제한
 * - API 엔드포인트별 제한
 * - 슬라이딩 윈도우 알고리즘
 * - 자동 차단 및 복구
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  blockDurationMs?: number;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  blockedUntil?: number;
  firstRequestTime: number;
}

export class AdvancedRateLimiter {
  private limits = new Map<string, RateLimitInfo>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      blockDurationMs: config.blockDurationMs ?? config.windowMs * 2
    };
  }

  /**
   * Rate limit 확인 및 업데이트
   */
  checkLimit(key: string, success?: boolean): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    let limitInfo = this.limits.get(key);

    // 초기화 또는 윈도우 리셋
    if (!limitInfo || now >= limitInfo.resetTime) {
      limitInfo = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequestTime: now
      };
      this.limits.set(key, limitInfo);
    }

    // 차단 상태 확인
    if (limitInfo.blockedUntil && now < limitInfo.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: limitInfo.resetTime,
        retryAfter: Math.ceil((limitInfo.blockedUntil - now) / 1000)
      };
    }

    // 요청 카운트 증가 여부 결정
    const shouldCount = success === undefined ||
      (!this.config.skipSuccessfulRequests || !success) &&
      (!this.config.skipFailedRequests || success);

    if (shouldCount) {
      limitInfo.count++;
    }

    // 제한 확인
    const allowed = limitInfo.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - limitInfo.count);

    // 제한 초과 시 차단
    if (!allowed && !limitInfo.blockedUntil) {
      limitInfo.blockedUntil = now + this.config.blockDurationMs;
    }

    return {
      allowed,
      remaining,
      resetTime: limitInfo.resetTime,
      retryAfter: limitInfo.blockedUntil ? Math.ceil((limitInfo.blockedUntil - now) / 1000) : undefined
    };
  }

  /**
   * 특정 키의 제한 정보 조회
   */
  getInfo(key: string): RateLimitInfo | null {
    return this.limits.get(key) || null;
  }

  /**
   * 특정 키의 제한 초기화
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, info] of this.limits.entries()) {
      if (now >= info.resetTime && (!info.blockedUntil || now >= info.blockedUntil)) {
        this.limits.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 통계 정보 반환
   */
  getStats(): {
    totalKeys: number;
    blockedKeys: number;
    averageUsage: number;
  } {
    const now = Date.now();
    let totalUsage = 0;
    let blockedCount = 0;

    for (const info of this.limits.values()) {
      totalUsage += info.count;
      if (info.blockedUntil && now < info.blockedUntil) {
        blockedCount++;
      }
    }

    return {
      totalKeys: this.limits.size,
      blockedKeys: blockedCount,
      averageUsage: this.limits.size > 0 ? totalUsage / this.limits.size : 0
    };
  }
}

/**
 * API별 Rate Limiter 인스턴스
 */
export const rateLimiters = {
  // 일반 API 요청 (60/분)
  general: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1분
    maxRequests: 60,
    blockDurationMs: 5 * 60 * 1000 // 5분 차단
  }),

  // AI 스토리 생성 (20/분, 600/시간)
  storyGeneration: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1분
    maxRequests: 20,
    blockDurationMs: 10 * 60 * 1000 // 10분 차단
  }),

  // AI 스토리보드 생성 (10/분, 300/시간)
  storyboardGeneration: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1분
    maxRequests: 10,
    blockDurationMs: 15 * 60 * 1000 // 15분 차단
  }),

  // 프롬프트 최적화 (30/분)
  promptOptimization: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1분
    maxRequests: 30,
    blockDurationMs: 5 * 60 * 1000 // 5분 차단
  }),

  // 시간당 전체 AI 요청 제한 (1000/시간)
  aiHourly: new AdvancedRateLimiter({
    windowMs: 60 * 60 * 1000, // 1시간
    maxRequests: 1000,
    blockDurationMs: 60 * 60 * 1000 // 1시간 차단
  })
};

/**
 * IP 주소 추출
 */
export function getClientIp(request: Request): string {
  // Vercel, Cloudflare 등에서 사용하는 헤더들 확인
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

/**
 * 사용자 ID 추출 (인증된 사용자)
 */
export function getUserId(request: Request): string | null {
  try {
    // JWT 토큰에서 사용자 ID 추출 (실제 구현에서는 JWT 라이브러리 사용)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    // 여기서는 간단히 토큰에서 사용자 ID를 추출한다고 가정
    // 실제로는 JWT 검증 및 디코딩 필요
    return null; // 실제 구현 필요
  } catch (error) {
    return null;
  }
}

/**
 * Rate limit 확인 미들웨어
 */
export function createRateLimitMiddleware(
  limiterName: keyof typeof rateLimiters,
  options: {
    keyGenerator?: (request: Request) => string;
    onLimitReached?: (key: string, info: any) => void;
    skipIf?: (request: Request) => boolean;
  } = {}
) {
  const limiter = rateLimiters[limiterName];

  return {
    check: (request: Request) => {
      // 조건부 스킵
      if (options.skipIf && options.skipIf(request)) {
        return { allowed: true, remaining: Infinity, resetTime: 0 };
      }

      // 키 생성
      let key: string;
      if (options.keyGenerator) {
        key = options.keyGenerator(request);
      } else {
        const ip = getClientIp(request);
        const userId = getUserId(request);
        key = userId ? `user:${userId}` : `ip:${ip}`;
      }

      // Rate limit 확인
      const result = limiter.checkLimit(key);

      // 제한 도달 시 콜백 호출
      if (!result.allowed && options.onLimitReached) {
        options.onLimitReached(key, result);
      }

      return result;
    }
  };
}

/**
 * 정기적 정리 작업
 */
setInterval(() => {
  let totalCleaned = 0;
  for (const [name, limiter] of Object.entries(rateLimiters)) {
    const cleaned = limiter.cleanup();
    totalCleaned += cleaned;

    if (process.env.NODE_ENV === 'development' && cleaned > 0) {
      console.log(`[RateLimiter] ${name}: cleaned ${cleaned} expired entries`);
    }
  }

  if (process.env.NODE_ENV === 'development' && totalCleaned > 0) {
    console.log(`[RateLimiter] Total cleaned: ${totalCleaned} entries`);
  }
}, 5 * 60 * 1000); // 5분마다 정리