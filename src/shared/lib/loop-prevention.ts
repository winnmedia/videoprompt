'use client';

/**
 * 🚨 무한 루프 방지 시스템 - $300 사건 재발 차단
 * VideoPlanet 프로젝트 전용 비용 안전 장치
 *
 * 목적: useEffect 의존성 배열, API 호출, 컴포넌트 리렌더링 무한 루프 감지 및 차단
 */

import React, { useEffect, type DependencyList, type EffectCallback } from 'react';
import { logger } from './logger';


interface LoopDetectionConfig {
  maxCallsPerSecond: number;
  costThresholds: {
    warning: number;    // $5
    critical: number;   // $50
    emergency: number;  // $100
  };
  patternDetection: {
    timeWindow: number;      // 10초
    maxCallsInWindow: number; // 20회
  };
}

interface CallRecord {
  timestamp: number;
  endpoint: string;
  source: string;
  cost: number;
}

interface LoopDetectionResult {
  allowed: boolean;
  reason?: string;
  currentCost: number;
  callsInWindow: number;
  recommendation?: string;
}

/**
 * 무한 루프 감지 및 차단 클래스
 */
export class InfiniteLoopDetector {
  private config: LoopDetectionConfig;
  private callHistory: CallRecord[] = [];
  private totalCost: number = 0;
  private emergencyMode: boolean = false;

  constructor(config?: Partial<LoopDetectionConfig>) {
    this.config = {
      maxCallsPerSecond: 10,
      costThresholds: {
        warning: 5,      // $5
        critical: 50,    // $50
        emergency: 100   // $100
      },
      patternDetection: {
        timeWindow: 10000,    // 10초
        maxCallsInWindow: 20  // 20회
      },
      ...config
    };
  }

  /**
   * API 호출 전 무한 루프 패턴 체크
   */
  checkApiCall(endpoint: string, source: string = 'unknown'): LoopDetectionResult {
    const now = Date.now();
    const estimatedCost = this.estimateApiCost(endpoint);

    // 긴급 모드: $100 도달 시 모든 호출 차단
    if (this.emergencyMode) {
      return {
        allowed: false,
        reason: 'EMERGENCY_MODE_ACTIVE',
        currentCost: this.totalCost,
        callsInWindow: 0,
        recommendation: '비용이 $100에 도달했습니다. 시스템 관리자에게 문의하세요.'
      };
    }

    // 1. 초당 호출 수 체크
    const recentCalls = this.getRecentCalls(1000); // 1초 내
    if (recentCalls.length >= this.config.maxCallsPerSecond) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        currentCost: this.totalCost,
        callsInWindow: recentCalls.length,
        recommendation: `1초에 ${this.config.maxCallsPerSecond}회 이상 호출이 감지되었습니다. useEffect 의존성 배열을 확인하세요.`
      };
    }

    // 2. 패턴 감지: 시간 윈도우 내 동일 엔드포인트 반복 호출
    const windowCalls = this.getRecentCalls(this.config.patternDetection.timeWindow);
    const sameEndpointCalls = windowCalls.filter(call => call.endpoint === endpoint);

    if (sameEndpointCalls.length >= this.config.patternDetection.maxCallsInWindow) {
      return {
        allowed: false,
        reason: 'INFINITE_LOOP_PATTERN_DETECTED',
        currentCost: this.totalCost,
        callsInWindow: sameEndpointCalls.length,
        recommendation: `${endpoint}가 ${this.config.patternDetection.timeWindow/1000}초 내 ${sameEndpointCalls.length}회 호출되었습니다. 무한 루프가 의심됩니다.`
      };
    }

    // 3. 비용 임계값 체크
    const projectedCost = this.totalCost + estimatedCost;

    if (projectedCost >= this.config.costThresholds.emergency) {
      this.emergencyMode = true;
      return {
        allowed: false,
        reason: 'COST_EMERGENCY_THRESHOLD',
        currentCost: this.totalCost,
        callsInWindow: windowCalls.length,
        recommendation: `예상 비용이 $${this.config.costThresholds.emergency}에 도달했습니다. 모든 API 호출이 차단됩니다.`
      };
    }

    if (projectedCost >= this.config.costThresholds.critical) {
      return {
        allowed: false,
        reason: 'COST_CRITICAL_THRESHOLD',
        currentCost: this.totalCost,
        callsInWindow: windowCalls.length,
        recommendation: `예상 비용이 $${this.config.costThresholds.critical}에 도달했습니다. API 호출을 중단하세요.`
      };
    }

    // 경고 레벨
    if (projectedCost >= this.config.costThresholds.warning) {
      console.warn(`⚠️ 비용 경고: 현재 $${this.totalCost.toFixed(2)}, 예상 $${projectedCost.toFixed(2)}`);
    }

    return {
      allowed: true,
      currentCost: this.totalCost,
      callsInWindow: windowCalls.length
    };
  }

  /**
   * API 호출 기록
   */
  recordApiCall(endpoint: string, source: string = 'unknown'): void {
    const cost = this.estimateApiCost(endpoint);
    const record: CallRecord = {
      timestamp: Date.now(),
      endpoint,
      source,
      cost
    };

    this.callHistory.push(record);
    this.totalCost += cost;

    // 오래된 기록 정리 (1시간 이상)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.callHistory = this.callHistory.filter(call => call.timestamp > oneHourAgo);
  }

  /**
   * useEffect 패턴 체크 (클라이언트 사이드)
   */
  checkUseEffectPattern(dependencies: any[], functionName: string): boolean {
    // 의존성 배열에 함수가 포함되어 있는지 확인
    const hasFunctionDep = dependencies.some(dep => typeof dep === 'function');

    if (hasFunctionDep) {
      console.error(`🚨 CRITICAL: useEffect에 함수 의존성 감지! (${functionName})`);
      console.error('이 패턴은 $300 비용 폭탄을 야기할 수 있습니다.');
      console.error('해결책: 의존성 배열을 빈 배열 []로 변경하거나 useCallback을 사용하세요.');

      // 개발 환경에서는 에러 발생
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`useEffect 함수 의존성 금지: ${functionName}`);
      }

      return false;
    }

    return true;
  }

  /**
   * 최근 호출 기록 조회
   */
  private getRecentCalls(timeWindow: number): CallRecord[] {
    const cutoff = Date.now() - timeWindow;
    return this.callHistory.filter(call => call.timestamp > cutoff);
  }

  /**
   * API 비용 추정
   */
  private estimateApiCost(endpoint: string): number {
    const costMap: Record<string, number> = {
      '/api/auth/me': 0.001,           // $0.001
      '/api/auth/refresh': 0.001,      // $0.001
      '/api/ai/generate-story': 0.05,  // $0.05 (AI API)
      '/api/seedance/create': 0.10,    // $0.10 (Video API)
      '/api/planning/stories': 0.002,  // $0.002
      'default': 0.001                 // 기본값
    };

    return costMap[endpoint] || costMap['default'];
  }

  /**
   * 통계 정보 조회
   */
  getStats() {
    const now = Date.now();
    const last24Hours = this.getRecentCalls(24 * 60 * 60 * 1000);
    const lastHour = this.getRecentCalls(60 * 60 * 1000);
    const lastMinute = this.getRecentCalls(60 * 1000);

    return {
      totalCost: this.totalCost,
      emergencyMode: this.emergencyMode,
      callCounts: {
        last24Hours: last24Hours.length,
        lastHour: lastHour.length,
        lastMinute: lastMinute.length
      },
      topEndpoints: this.getTopEndpoints(last24Hours),
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 최다 호출 엔드포인트 분석
   */
  private getTopEndpoints(calls: CallRecord[]) {
    const endpointCounts = calls.reduce((acc, call) => {
      acc[call.endpoint] = (acc[call.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(endpointCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  /**
   * 최적화 권장사항 생성
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const recentCalls = this.getRecentCalls(60 * 60 * 1000); // 1시간

    if (recentCalls.length > 1000) {
      recommendations.push('시간당 API 호출이 1000회를 초과했습니다. 캐싱을 구현하세요.');
    }

    if (this.totalCost > this.config.costThresholds.warning) {
      recommendations.push('비용이 경고 수준에 도달했습니다. API 호출 패턴을 검토하세요.');
    }

    if (this.emergencyMode) {
      recommendations.push('긴급 모드가 활성화되었습니다. 시스템 관리자에게 즉시 연락하세요.');
    }

    return recommendations;
  }

  /**
   * 리셋 (관리자만 사용)
   */
  reset(adminKey: string): boolean {
    if (adminKey !== process.env.LOOP_DETECTOR_ADMIN_KEY) {
      return false;
    }

    this.callHistory = [];
    this.totalCost = 0;
    this.emergencyMode = false;

    logger.info('🔄 InfiniteLoopDetector 리셋 완료');
    return true;
  }
}

// 전역 인스턴스 (싱글톤)
export const loopDetector = new InfiniteLoopDetector();

/**
 * withLoopPrevention - API 라우트 래퍼
 */
export function withLoopPrevention<T extends (...args: any[]) => any>(
  handler: T,
  endpoint?: string
): T {
  return (async (...args: any[]) => {
    const req = args[0]; // NextRequest
    const actualEndpoint = endpoint || req?.url || 'unknown';
    const source = req?.headers?.get('user-agent') || 'unknown';

    // 무한 루프 체크
    const checkResult = loopDetector.checkApiCall(actualEndpoint, source);

    if (!checkResult.allowed) {
      console.error(`🚨 API 호출 차단: ${checkResult.reason}`);
      console.error(`📊 현재 비용: $${checkResult.currentCost.toFixed(3)}`);
      console.error(`💡 권장사항: ${checkResult.recommendation}`);

      return Response.json({
        error: checkResult.reason,
        message: checkResult.recommendation,
        currentCost: checkResult.currentCost,
        callsInWindow: checkResult.callsInWindow
      }, {
        status: 429, // Too Many Requests
        headers: {
          'Retry-After': '60',
          'X-Cost-Current': checkResult.currentCost.toString(),
          'X-Calls-Window': checkResult.callsInWindow.toString()
        }
      });
    }

    try {
      // 실제 핸들러 실행
      const result = await handler(...args);

      // 성공적인 호출 기록
      loopDetector.recordApiCall(actualEndpoint, source);

      return result;
    } catch (error) {
      // 에러 발생 시에도 호출 기록 (비용은 발생했으므로)
      loopDetector.recordApiCall(actualEndpoint, source);
      throw error;
    }
  }) as T;
}

/**
 * useEffect 안전성 체크 훅
 */
export function useSafeEffect(
  effect: EffectCallback,
  deps: DependencyList,
  functionName: string = 'unknown'
) {
  if (typeof window === 'undefined') {
    return;
  }

  const isValid = loopDetector.checkUseEffectPattern(Array.from(deps), functionName);

  if (!isValid) {
    console.error(`🚨 useEffect 실행 차단: ${functionName}`);
    return;
  }

  return useEffect(effect, deps);
}

// 타입 export
export type { LoopDetectionConfig, CallRecord, LoopDetectionResult };
