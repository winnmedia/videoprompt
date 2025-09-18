/**
 * Circuit Breaker 패턴 구현
 * 데이터베이스 연결 실패 시 자동으로 회로를 차단하여 시스템 보호
 */

export interface CircuitBreakerConfig {
  failureThreshold: number; // 실패 임계값
  resetTimeout: number; // 회로 차단 후 재시도까지의 시간 (ms)
  monitoringWindow: number; // 모니터링 윈도우 (ms)
}

export enum CircuitState {
  CLOSED = 'CLOSED', // 정상 상태
  OPEN = 'OPEN', // 차단 상태
  HALF_OPEN = 'HALF_OPEN' // 반개방 상태 (테스트 중)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number;
  totalAttempts: number;
  uptime: number; // 가동률 (%)
}

/**
 * 회로 차단기 클래스
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;
  private totalAttempts = 0;
  private readonly startTime = Date.now();

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * 함수 실행을 회로 차단기로 감싸기
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log('🔄 Circuit Breaker: HALF_OPEN 상태로 전환 (재시도 테스트)');
      } else {
        throw new Error('Circuit breaker is OPEN. Service temporarily unavailable.');
      }
    }

    this.totalAttempts++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 성공 시 처리
   */
  private onSuccess(): void {
    this.successCount++;
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log('✅ Circuit Breaker: CLOSED 상태로 복구됨');
    }
  }

  /**
   * 실패 시 처리
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error('🚨 Circuit Breaker: OPEN 상태로 전환됨', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  /**
   * 재시도 시도 여부 판단
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return (Date.now() - this.lastFailureTime) >= this.config.resetTimeout;
  }

  /**
   * 현재 통계 반환
   */
  getStats(): CircuitBreakerStats {
    const runtime = Date.now() - this.startTime;
    const uptime = this.totalAttempts > 0
      ? (this.successCount / this.totalAttempts) * 100
      : 100;

    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
      totalAttempts: this.totalAttempts,
      uptime: Math.round(uptime * 100) / 100
    };
  }

  /**
   * 회로 차단기 강제 리셋
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    console.log('🔧 Circuit Breaker: 수동으로 리셋됨');
  }
}

/**
 * Supabase용 회로 차단기 인스턴스
 */
export const supabaseCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // 5번 연속 실패 시 차단
  resetTimeout: 30000, // 30초 후 재시도
  monitoringWindow: 60000 // 1분 모니터링 윈도우
});

/**
 * Prisma용 회로 차단기 인스턴스
 */
export const prismaCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3, // 3번 연속 실패 시 차단
  resetTimeout: 20000, // 20초 후 재시도
  monitoringWindow: 60000 // 1분 모니터링 윈도우
});