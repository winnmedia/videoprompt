/**
 * Seedance 통합 설정 관리자
 * FSD Architecture - Shared Layer
 *
 * 목적: 중앙화된 환경 시스템과 Seedance 서비스 통합
 * 패턴: Configuration Provider + Strategy Pattern
 */

import {
  getAIApiKeys,
  getEnvironmentCapabilities,
  getDegradationMode,
  getServiceUrls
} from '@/shared/config/env';
import {
  isValidSeedanceApiKey,
  getApiKeyFromEnv,
  shouldUseMockProvider,
  getApiKeyStatus
} from './seedance-validators';

export interface SeedanceConfig {
  // API 키 정보
  apiKey: string | null;
  isValidKey: boolean;
  keySource: 'SEEDANCE_API_KEY' | 'MODELARK_API_KEY' | 'none';

  // 서비스 URL
  baseUrl: string;
  endpoints: {
    create: string;
    status: string;
    health: string;
  };

  // 운영 모드
  mode: 'real' | 'mock' | 'disabled';
  degradationMode: 'full' | 'degraded' | 'disabled';

  // 기능 활성화 상태
  capabilities: {
    canCreateVideo: boolean;
    canCheckStatus: boolean;
    canFallbackToMock: boolean;
    hasHealthCheck: boolean;
  };

  // 신뢰성 및 안전성
  reliability: {
    score: number; // 0-1
    fallbackAvailable: boolean;
    circuitBreakerEnabled: boolean;
  };

  // 디버깅 정보
  debug: {
    environment: string;
    mockExplicitlyEnabled: boolean;
    configSource: 'centralized' | 'legacy';
    lastValidated: string;
  };
}

/**
 * Seedance 설정 생성기
 */
export class SeedanceConfigManager {
  private static instance: SeedanceConfigManager;
  private cachedConfig: SeedanceConfig | null = null;
  private lastValidation: number = 0;
  private readonly CACHE_DURATION = 60000; // 1분 캐시

  private constructor() {}

  static getInstance(): SeedanceConfigManager {
    if (!SeedanceConfigManager.instance) {
      SeedanceConfigManager.instance = new SeedanceConfigManager();
    }
    return SeedanceConfigManager.instance;
  }

  /**
   * 현재 Seedance 설정 가져오기 (캐시 적용)
   */
  getConfig(): SeedanceConfig {
    const now = Date.now();

    // 캐시 유효성 확인
    if (this.cachedConfig && (now - this.lastValidation) < this.CACHE_DURATION) {
      return this.cachedConfig;
    }

    // 새로운 설정 생성
    this.cachedConfig = this.createConfig();
    this.lastValidation = now;

    console.log('🔧 Seedance 설정 생성/갱신:', {
      mode: this.cachedConfig.mode,
      degradationMode: this.cachedConfig.degradationMode,
      reliability: this.cachedConfig.reliability.score,
      keySource: this.cachedConfig.keySource
    });

    return this.cachedConfig;
  }

  /**
   * 설정 강제 새로고침
   */
  refreshConfig(): SeedanceConfig {
    this.cachedConfig = null;
    this.lastValidation = 0;
    return this.getConfig();
  }

  /**
   * 설정 생성 로직
   */
  private createConfig(): SeedanceConfig {
    const apiKey = getApiKeyFromEnv();
    const apiKeys = getAIApiKeys();
    const capabilities = getEnvironmentCapabilities();
    const degradationMode = getDegradationMode();
    const serviceUrls = getServiceUrls();
    const apiKeyStatus = getApiKeyStatus();

    const isValidKey = apiKey ? isValidSeedanceApiKey(apiKey) : false;
    const shouldUseMock = shouldUseMockProvider();

    // 운영 모드 결정
    let mode: 'real' | 'mock' | 'disabled';
    if (shouldUseMock) {
      mode = 'mock';
    } else if (isValidKey) {
      mode = 'real';
    } else {
      mode = 'disabled';
    }

    // 기본 URL 결정
    const baseUrl = serviceUrls.seedanceApi || 'https://api.seedance.ai';

    return {
      // API 키 정보
      apiKey,
      isValidKey,
      keySource: apiKeys.seedance ? 'SEEDANCE_API_KEY' :
                 apiKeys.modelark ? 'MODELARK_API_KEY' : 'none',

      // 서비스 URL
      baseUrl,
      endpoints: {
        create: `${baseUrl}/v1/video/create`,
        status: `${baseUrl}/v1/video/status`,
        health: `${baseUrl}/v1/health`
      },

      // 운영 모드
      mode,
      degradationMode,

      // 기능 활성화 상태
      capabilities: {
        canCreateVideo: mode !== 'disabled',
        canCheckStatus: mode !== 'disabled',
        canFallbackToMock: true, // 항상 Mock 폴백 가능
        hasHealthCheck: isValidKey || shouldUseMock
      },

      // 신뢰성 및 안전성
      reliability: {
        score: this.calculateReliabilityScore(mode, degradationMode, isValidKey),
        fallbackAvailable: true,
        circuitBreakerEnabled: true
      },

      // 디버깅 정보
      debug: {
        environment: process.env.NODE_ENV || 'development',
        mockExplicitlyEnabled: process.env.NEXT_PUBLIC_ENABLE_MOCK_API === 'true',
        configSource: 'centralized',
        lastValidated: new Date().toISOString()
      }
    };
  }

  /**
   * 신뢰성 점수 계산
   */
  private calculateReliabilityScore(
    mode: string,
    degradationMode: string,
    isValidKey: boolean
  ): number {
    if (mode === 'real' && isValidKey && degradationMode === 'full') {
      return 1.0; // 완전한 실제 API
    }

    if (mode === 'real' && isValidKey && degradationMode === 'degraded') {
      return 0.9; // 제한된 실제 API
    }

    if (mode === 'mock') {
      return 0.8; // Mock 서비스
    }

    return 0.0; // 비활성화
  }

  /**
   * 설정 검증
   */
  validateConfig(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const config = this.getConfig();
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 검증
    if (config.mode === 'disabled') {
      errors.push('Seedance 서비스가 비활성화되었습니다');
    }

    if (!config.capabilities.canCreateVideo) {
      errors.push('영상 생성 기능을 사용할 수 없습니다');
    }

    // 권장사항
    if (config.mode === 'mock') {
      warnings.push('Mock 모드로 동작 중입니다 - 실제 영상이 생성되지 않습니다');
    }

    if (config.degradationMode === 'degraded') {
      warnings.push('제한된 모드로 동작 중입니다');
    }

    if (config.reliability.score < 0.9) {
      warnings.push(`서비스 신뢰성이 낮습니다: ${Math.round(config.reliability.score * 100)}%`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 헬스 체크 실행
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    mode: string;
    latency?: number;
    error?: string;
  }> {
    const config = this.getConfig();

    if (config.mode === 'disabled') {
      return {
        healthy: false,
        mode: 'disabled',
        error: 'Service is disabled'
      };
    }

    if (config.mode === 'mock') {
      return {
        healthy: true,
        mode: 'mock',
        latency: 50 // Mock 응답 시간
      };
    }

    // 실제 API 헬스 체크
    try {
      const startTime = Date.now();
      const response = await fetch(config.endpoints.health, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5초 타임아웃
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          mode: 'real',
          latency
        };
      } else {
        return {
          healthy: false,
          mode: 'real',
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        healthy: false,
        mode: 'real',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * 전역 설정 관리자 인스턴스
 */
export const seedanceConfigManager = SeedanceConfigManager.getInstance();

/**
 * 간편한 설정 접근 헬퍼
 */
export function getSeedanceConfig(): SeedanceConfig {
  return seedanceConfigManager.getConfig();
}

/**
 * 설정 검증 헬퍼
 */
export function validateSeedanceConfig() {
  return seedanceConfigManager.validateConfig();
}

/**
 * 헬스 체크 헬퍼
 */
export function checkSeedanceHealth() {
  return seedanceConfigManager.performHealthCheck();
}