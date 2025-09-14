/**
 * 간단한 메모리 기반 Rate Limiter
 * 복잡성을 최소화하고 효과적인 API 남용 방지에 집중
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class SimpleRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 5분마다 만료된 엔트리 정리
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Rate limit 체크
   * @param key 식별자 (IP, 사용자 ID 등)
   * @param limit 허용 요청 수
   * @param windowMs 시간 윈도우 (밀리초)
   * @returns 허용 여부와 메타데이터
   */
  check(key: string, limit: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  } {
    const now = Date.now();
    const resetAt = now + windowMs;
    const entry = this.store.get(key);

    // 새 엔트리이거나 윈도우가 만료된 경우
    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt
      };
    }

    // 제한 초과 확인
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      };
    }

    // 카운트 증가
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt
    };
  }

  /**
   * 특정 키의 제한 상태 초기화
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * 만료된 엔트리 정리
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 현재 저장된 엔트리 수 (모니터링용)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * 정리 작업 중지
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// 싱글톤 인스턴스
export const rateLimiter = new SimpleRateLimiter();

// Rate limit 설정
export const RATE_LIMITS = {
  // 가장 엄격한 제한 - 회원가입
  register: {
    perMinute: 2,
    perHour: 10,
    perDay: 20
  },

  // 엄격한 제한 - 로그인
  login: {
    perMinute: 5,
    perHour: 30,
    perDay: 100
  },

  // 중간 제한 - 인증 확인
  authMe: {
    perMinute: 30,
    perHour: 500,
    perDay: 2000
  },

  // 토큰 갱신 제한 - 적당한 수준 (로그인보다 관대)
  refresh: {
    perMinute: 10,
    perHour: 60,
    perDay: 300
  },

  // 기본 제한
  default: {
    perMinute: 20,
    perHour: 200,
    perDay: 1000
  }
} as const;

/**
 * 시간 윈도우 상수
 */
export const TIME_WINDOWS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;

/**
 * IP 주소 추출 헬퍼
 */
export function getClientIP(request: Request): string {
  // Next.js에서 IP 추출
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return realIp || remoteAddr || '127.0.0.1';
}

/**
 * Rate limit 체크 및 응답 헤더 생성
 */
export function checkRateLimit(
  request: Request,
  endpoint: string,
  limits: { perMinute: number; perHour: number; perDay: number }
): {
  allowed: boolean;
  headers: Record<string, string>;
  retryAfter?: number;
} {
  const ip = getClientIP(request);
  const baseKey = `${endpoint}:${ip}`;

  // 분당 제한 체크
  const minuteResult = rateLimiter.check(
    `${baseKey}:minute`,
    limits.perMinute,
    TIME_WINDOWS.MINUTE
  );

  if (!minuteResult.allowed) {
    return {
      allowed: false,
      headers: {
        'X-RateLimit-Limit': limits.perMinute.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': minuteResult.resetAt.toString(),
        'Retry-After': minuteResult.retryAfter?.toString() || '60'
      },
      retryAfter: minuteResult.retryAfter
    };
  }

  // 시간당 제한 체크
  const hourResult = rateLimiter.check(
    `${baseKey}:hour`,
    limits.perHour,
    TIME_WINDOWS.HOUR
  );

  if (!hourResult.allowed) {
    return {
      allowed: false,
      headers: {
        'X-RateLimit-Limit': limits.perHour.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': hourResult.resetAt.toString(),
        'Retry-After': hourResult.retryAfter?.toString() || '3600'
      },
      retryAfter: hourResult.retryAfter
    };
  }

  // 성공 시 헤더
  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': limits.perMinute.toString(),
      'X-RateLimit-Remaining': minuteResult.remaining.toString(),
      'X-RateLimit-Reset': minuteResult.resetAt.toString()
    }
  };
}