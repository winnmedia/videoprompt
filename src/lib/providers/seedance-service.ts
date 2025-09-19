/**
 * Seedance 서비스 - Graceful Degradation 구현
 * Circuit Breaker 패턴과 자동 폴백 시스템
 */

import {
  createSeedanceVideo,
  getSeedanceStatus,
  type SeedanceCreatePayload,
  type SeedanceCreateResult,
  type SeedanceStatusResult,
} from './seedance';
import { createMockVideo, getMockStatus } from './mock-seedance';
import { shouldUseMockProvider, getApiKeyStatus } from './seedance-validators';
import { validateSeedanceConfig, ServiceConfigError } from '@/shared/lib/service-config-error';

/**
 * 확장된 결과 타입 (폴백 정보 포함)
 */
export interface SeedanceResultWithFallback extends SeedanceCreateResult {
  source: 'real' | 'mock';
  fallbackReason?: string;
  circuitBreakerTriggered?: boolean;
}

export interface SeedanceStatusWithFallback extends SeedanceStatusResult {
  source: 'real' | 'mock';
  fallbackReason?: string;
}

/**
 * 서비스 상태 정보
 */
export interface ServiceHealthStatus {
  isHealthy: boolean;
  lastCheck: string | null;
  consecutiveFailures: number;
  mode: 'real' | 'mock' | 'unknown';
  capabilities: {
    canCreateVideo: boolean;
    canCheckStatus: boolean;
    estimatedReliability: number; // 0-1 (성공률)
  };
}

/**
 * Graceful Degradation이 적용된 비디오 생성
 */
export async function createSeedanceVideoWithFallback(
  payload: SeedanceCreatePayload,
): Promise<SeedanceResultWithFallback> {
  // 1. 처음부터 Mock 모드인 경우
  if (shouldUseMockProvider()) {
    console.log('🎭 Mock 모드로 비디오 생성');
    const result = await createMockVideo(payload);
    return {
      ...result,
      source: 'mock',
    };
  }

  // 2. 실제 API 시도
  try {
    console.log('🔧 실제 API로 비디오 생성 시도');
    const realResult = await createSeedanceVideo(payload);

    if (realResult.ok) {
      return {
        ...realResult,
        source: 'real',
      };
    }

    // 실제 API가 실패한 경우 Mock으로 폴백
    console.warn('⚠️ 실제 API 실패, Mock으로 폴백:', realResult.error);
    const mockResult = await createMockVideo(payload);

    if (mockResult.ok) {
      return {
        ...mockResult,
        source: 'mock',
        fallbackReason: realResult.error,
      };
    }

    // 둘 다 실패한 경우
    return {
      ok: false,
      error: '모든 영상 생성 서비스가 사용 불가능합니다',
      source: 'mock',
    };
  } catch (error) {
    // 네트워크 에러 등 예외 상황
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ 실제 API 호출 중 예외 발생, Mock으로 폴백:', errorMessage);

    try {
      const mockResult = await createMockVideo(payload);
      return {
        ...mockResult,
        source: 'mock',
        fallbackReason: errorMessage,
      };
    } catch (mockError) {
      return {
        ok: false,
        error: '모든 영상 생성 서비스가 사용 불가능합니다',
        source: 'mock',
      };
    }
  }
}

/**
 * Graceful Degradation이 적용된 상태 확인
 */
export async function getSeedanceStatusWithFallback(
  jobId: string,
): Promise<SeedanceStatusWithFallback> {
  // Mock 작업 ID 패턴 감지
  if (jobId.startsWith('mock-')) {
    console.log('🎭 Mock 작업 ID 감지, Mock 상태 확인');
    const result = await getMockStatus(jobId);
    return {
      ...result,
      source: 'mock',
    };
  }

  // 처음부터 Mock 모드인 경우
  if (shouldUseMockProvider()) {
    console.log('🎭 Mock 모드로 상태 확인');
    const result = await getMockStatus(jobId);
    return {
      ...result,
      source: 'mock',
    };
  }

  // 실제 API 시도
  try {
    console.log('🔧 실제 API로 상태 확인 시도');
    const realResult = await getSeedanceStatus(jobId);

    if (realResult.ok) {
      return {
        ...realResult,
        source: 'real',
      };
    }

    // 실제 API가 실패한 경우 Mock으로 폴백
    console.warn('⚠️ 실제 API 상태 확인 실패, Mock으로 폴백:', realResult.error);
    const mockResult = await getMockStatus(jobId);

    return {
      ...mockResult,
      source: 'mock',
      fallbackReason: realResult.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ 실제 API 상태 확인 중 예외 발생, Mock으로 폴백:', errorMessage);

    const mockResult = await getMockStatus(jobId);
    return {
      ...mockResult,
      source: 'mock',
      fallbackReason: errorMessage,
    };
  }
}

/**
 * Circuit Breaker 패턴을 적용한 Seedance 서비스
 */
export class SeedanceService {
  private consecutiveFailures = 0;
  private lastCheck: string | null = null;
  private readonly failureThreshold = 3; // 3번 연속 실패 시 Circuit Breaker 작동
  private readonly recoveryTimeout = 30000; // 30초 후 복구 시도
  private circuitBreakerOpen = false;
  private lastFailureTime: number | null = null;

  /**
   * 비디오 생성 (Circuit Breaker 적용)
   */
  async createVideo(payload: SeedanceCreatePayload): Promise<SeedanceResultWithFallback> {
    // Circuit Breaker 상태 확인
    if (this.shouldSkipRealApi()) {
      console.log('🔌 Circuit Breaker 작동 - Mock 모드로 직접 전환');
      const result = await createMockVideo(payload);
      return {
        ...result,
        source: 'mock',
        circuitBreakerTriggered: true,
        fallbackReason: 'Circuit Breaker 작동 (연속 실패 감지)',
      };
    }

    const result = await createSeedanceVideoWithFallback(payload);

    // Circuit Breaker 상태 업데이트
    this.updateCircuitBreakerState(result.ok);

    return result;
  }

  /**
   * 상태 확인 (Circuit Breaker 적용)
   */
  async getStatus(jobId: string): Promise<SeedanceStatusWithFallback> {
    return getSeedanceStatusWithFallback(jobId);
  }

  /**
   * 강화된 헬스체크 실행 - 계약 기반 검증 적용
   */
  async runHealthCheck(): Promise<ServiceHealthStatus> {
    try {
      console.log('🔍 Seedance 서비스 헬스체크 실행 (강화된 검증)');

      // 1. 새로운 계약 기반 검증 시도
      let configValidation;
      let validationError: ServiceConfigError | null = null;

      try {
        configValidation = validateSeedanceConfig();
        console.log('✅ Seedance 설정 검증 성공:', {
          provider: configValidation.provider,
          environment: configValidation.environment
        });
      } catch (error) {
        if (error instanceof ServiceConfigError) {
          validationError = error;
          console.warn('⚠️ Seedance 설정 검증 실패:', {
            code: error.errorCode,
            message: error.message
          });
        } else {
          throw error; // 예상치 못한 에러는 다시 던지기
        }
      }

      // 2. 폴백으로 기존 검증 시스템 사용
      const apiKeyStatus = getApiKeyStatus();
      const isMockMode = shouldUseMockProvider();

      // 3. 헬스 상태 결정
      const isHealthy = configValidation?.ready || isMockMode || apiKeyStatus.isValid;
      const mode = configValidation?.provider || (isMockMode ? 'mock' : apiKeyStatus.isValid ? 'real' : 'unknown');

      const healthStatus: ServiceHealthStatus = {
        isHealthy,
        lastCheck: new Date().toISOString(),
        consecutiveFailures: this.consecutiveFailures,
        mode: mode as 'real' | 'mock' | 'unknown',
        capabilities: {
          canCreateVideo: isHealthy,
          canCheckStatus: isHealthy,
          estimatedReliability: this.calculateReliability(),
        },
      };

      this.lastCheck = healthStatus.lastCheck;

      // 4. Circuit Breaker 복구 확인
      if (this.circuitBreakerOpen && this.canAttemptRecovery()) {
        console.log('🔄 Circuit Breaker 복구 시도');
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
      }

      // 5. 설정 에러가 있으면 로깅 (하지만 서비스는 계속 동작)
      if (validationError) {
        console.warn('⚠️ 설정 문제 감지됨 (Graceful Degradation 적용):', {
          errorCode: validationError.errorCode,
          fallbackMode: mode,
          setupGuideAvailable: !!validationError.setupGuide
        });
      }

      return healthStatus;
    } catch (error) {
      console.error('❌ 헬스체크 실패:', error);
      return {
        isHealthy: false,
        lastCheck: new Date().toISOString(),
        consecutiveFailures: this.consecutiveFailures,
        mode: 'unknown',
        capabilities: {
          canCreateVideo: false,
          canCheckStatus: false,
          estimatedReliability: 0,
        },
      };
    }
  }

  /**
   * 서비스 상태 반환
   */
  getHealthStatus(): ServiceHealthStatus {
    return {
      isHealthy: !this.circuitBreakerOpen,
      lastCheck: this.lastCheck,
      consecutiveFailures: this.consecutiveFailures,
      mode: shouldUseMockProvider() ? 'mock' : 'real',
      capabilities: {
        canCreateVideo: true,
        canCheckStatus: true,
        estimatedReliability: this.calculateReliability(),
      },
    };
  }

  /**
   * 실제 API를 건너뛸지 결정
   */
  private shouldSkipRealApi(): boolean {
    if (!this.circuitBreakerOpen) {
      return false;
    }

    // 복구 시도 가능한지 확인
    return !this.canAttemptRecovery();
  }

  /**
   * Circuit Breaker 상태 업데이트
   */
  private updateCircuitBreakerState(success: boolean): void {
    if (success) {
      // 성공 시 실패 카운터 리셋
      this.consecutiveFailures = 0;
      this.circuitBreakerOpen = false;
      this.lastFailureTime = null;
    } else {
      // 실패 시 카운터 증가
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();

      // 임계값 도달 시 Circuit Breaker 열기
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.circuitBreakerOpen = true;
        console.warn(
          `⚠️ Circuit Breaker 작동: ${this.consecutiveFailures}번 연속 실패 (임계값: ${this.failureThreshold})`
        );
      }
    }
  }

  /**
   * 복구 시도 가능한지 확인
   */
  private canAttemptRecovery(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    return Date.now() - this.lastFailureTime > this.recoveryTimeout;
  }

  /**
   * 서비스 신뢰도 계산
   */
  private calculateReliability(): number {
    if (this.consecutiveFailures === 0) {
      return 1.0;
    }

    // 연속 실패 수에 따른 신뢰도 계산 (지수적 감소)
    return Math.max(0, 1 - (this.consecutiveFailures / 10));
  }

  /**
   * Circuit Breaker 상태 리셋 (관리자용)
   */
  resetCircuitBreaker(): void {
    console.log('🔄 Circuit Breaker 수동 리셋');
    this.consecutiveFailures = 0;
    this.circuitBreakerOpen = false;
    this.lastFailureTime = null;
  }
}

// 싱글톤 서비스 인스턴스
export const seedanceService = new SeedanceService();