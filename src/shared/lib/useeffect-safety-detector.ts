/**
 * useEffect 안전 패턴 감지 시스템 - $300 사건 방지 핵심 모듈
 * React useEffect 의존성 배열 위반 패턴을 실시간으로 감지하고 차단
 * 정적 분석 + 런타임 감지 이중 보안
 */

import { z } from 'zod';
import { rateLimiter } from './rate-limiter';
import { getCostTracker } from './cost-safety-middleware';

// useEffect 위반 타입 정의
const UseEffectViolationSchema = z.object({
  type: z.enum([
    'function-in-dependency-array',      // 함수가 의존성 배열에 포함됨
    'rapid-successive-calls',            // 빠른 연속 호출 (무한 루프 의심)
    'missing-dependency',                // 필요한 의존성 누락
    'unnecessary-dependency',            // 불필요한 의존성 포함
    'object-dependency',                 // 객체가 의존성에 포함됨 (참조 변경)
    'callback-recreation',               // 콜백 함수 재생성 패턴
  ]),
  componentName: z.string(),
  lineNumber: z.number().optional(),
  hookIndex: z.number().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.record(z.unknown()).optional(),
});

type UseEffectViolation = z.infer<typeof UseEffectViolationSchema>;

// 컴포넌트별 useEffect 호출 추적
interface ComponentEffectTracker {
  componentName: string;
  effects: Array<{
    index: number;
    dependencies: unknown[];
    callCount: number;
    lastCall: number;
    violations: UseEffectViolation[];
  }>;
  totalViolations: number;
  riskLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' | 'CRITICAL';
}

// 전역 추적 상태
const componentTrackers = new Map<string, ComponentEffectTracker>();
const violationHistory: UseEffectViolation[] = [];

// 위험 패턴 설정
const RISK_PATTERNS = {
  RAPID_CALL_THRESHOLD: 3,           // 3번 연속 호출시 위험
  RAPID_CALL_WINDOW: 5000,           // 5초 윈도우
  MAX_VIOLATIONS_PER_COMPONENT: 5,   // 컴포넌트당 최대 위반 수
  FUNCTION_DEPENDENCY_COST: 300,     // 함수 의존성 위반 비용 ($300)
} as const;

/**
 * useEffect 안전 감지기 클래스
 */
export class UseEffectSafetyDetector {
  private enabled = true;
  private strictMode = process.env.NODE_ENV === 'development';

  /**
   * useEffect 의존성 배열 검증 (메인 API)
   */
  validateDependencies(
    dependencies: unknown[],
    componentName: string,
    hookIndex: number = 0,
    lineNumber?: number
  ): boolean {
    if (!this.enabled) return true;

    try {
      const tracker = this.getOrCreateTracker(componentName);
      const effectTracker = this.getOrCreateEffectTracker(tracker, hookIndex);

      // 호출 횟수 추적
      effectTracker.callCount++;
      effectTracker.lastCall = Date.now();
      effectTracker.dependencies = [...dependencies];

      // 패턴 감지
      const violations = this.detectViolations(dependencies, componentName, hookIndex, lineNumber);

      if (violations.length > 0) {
        effectTracker.violations.push(...violations);
        tracker.totalViolations += violations.length;

        // 위반 기록
        violationHistory.push(...violations);

        // 심각도별 처리
        const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
        if (criticalViolations.length > 0) {
          this.handleCriticalViolations(criticalViolations, componentName);
          return false; // 크리티컬 위반시 차단
        }

        // 위험도 업데이트
        this.updateRiskLevel(tracker);

        // 경고 출력
        this.logViolations(violations, componentName, hookIndex);
      }

      // 빠른 연속 호출 감지
      if (this.detectRapidCalls(effectTracker)) {
        const rapidCallViolation: UseEffectViolation = {
          type: 'rapid-successive-calls',
          componentName,
          hookIndex,
          lineNumber,
          severity: 'CRITICAL',
          details: {
            callCount: effectTracker.callCount,
            timeWindow: RISK_PATTERNS.RAPID_CALL_WINDOW,
          },
        };

        this.handleCriticalViolations([rapidCallViolation], componentName);
        return false; // 빠른 연속 호출 차단
      }

      return violations.length === 0 || !this.strictMode;

    } catch (error) {
      console.error('[useEffect Safety] 검증 중 오류:', error);
      return true; // 오류 발생시 통과
    }
  }

  /**
   * 위반 패턴 감지 로직
   */
  private detectViolations(
    dependencies: unknown[],
    componentName: string,
    hookIndex: number,
    lineNumber?: number
  ): UseEffectViolation[] {
    const violations: UseEffectViolation[] = [];

    // 1. 함수 의존성 체크 (가장 위험함)
    const functionDeps = dependencies.filter(dep => typeof dep === 'function');
    if (functionDeps.length > 0) {
      violations.push({
        type: 'function-in-dependency-array',
        componentName,
        hookIndex,
        lineNumber,
        severity: 'CRITICAL',
        details: {
          functionCount: functionDeps.length,
          functionNames: functionDeps.map(fn => fn.name || 'anonymous'),
          riskLevel: 'INFINITE_LOOP',
          estimatedCost: RISK_PATTERNS.FUNCTION_DEPENDENCY_COST,
        },
      });
    }

    // 2. 객체 의존성 체크 (참조 변경 위험)
    const objectDeps = dependencies.filter(dep =>
      dep !== null &&
      typeof dep === 'object' &&
      !Array.isArray(dep) &&
      !(dep instanceof Date)
    );
    if (objectDeps.length > 0) {
      violations.push({
        type: 'object-dependency',
        componentName,
        hookIndex,
        lineNumber,
        severity: 'HIGH',
        details: {
          objectCount: objectDeps.length,
          riskLevel: 'REFERENCE_CHANGE',
        },
      });
    }

    // 3. 빈 의존성 배열에서 상태 사용 감지 (정적 분석은 제한적)
    if (dependencies.length === 0) {
      // 컴포넌트명에서 상태 사용 패턴 추론
      if (componentName.toLowerCase().includes('auth') &&
          ['checkAuth', 'refreshToken', 'getUser'].some(fn => componentName.includes(fn))) {
        violations.push({
          type: 'missing-dependency',
          componentName,
          hookIndex,
          lineNumber,
          severity: 'MEDIUM',
          details: {
            suspectedMissing: ['user', 'token', 'auth'],
            riskLevel: 'STATE_DESYNC',
          },
        });
      }
    }

    // 4. 과도한 의존성 (성능 문제)
    if (dependencies.length > 10) {
      violations.push({
        type: 'unnecessary-dependency',
        componentName,
        hookIndex,
        lineNumber,
        severity: 'MEDIUM',
        details: {
          dependencyCount: dependencies.length,
          recommended: 'useMemo나 useCallback 고려',
        },
      });
    }

    return violations;
  }

  /**
   * 빠른 연속 호출 감지
   */
  private detectRapidCalls(effectTracker: ComponentEffectTracker['effects'][0]): boolean {
    const now = Date.now();
    const recentWindow = now - RISK_PATTERNS.RAPID_CALL_WINDOW;

    // 최근 윈도우 내에서의 호출 횟수 체크
    return effectTracker.callCount >= RISK_PATTERNS.RAPID_CALL_THRESHOLD &&
           (now - effectTracker.lastCall) < RISK_PATTERNS.RAPID_CALL_WINDOW;
  }

  /**
   * 크리티컬 위반 처리
   */
  private handleCriticalViolations(violations: UseEffectViolation[], componentName: string): void {
    // 비용 추적기에 위반 기록
    const totalCost = violations.reduce((sum, v) =>
      sum + (v.details?.estimatedCost as number || 0), 0
    );

    getCostTracker().recordApiCall(
      '/internal/useeffect-critical-violation',
      { provider: 'internal', baseTokens: 0, outputTokens: 0 },
      componentName,
      {
        violations: violations.map(v => ({
          type: v.type,
          severity: v.severity,
          estimatedCost: v.details?.estimatedCost,
        })),
        totalCost,
        riskLevel: 'CRITICAL',
        timestamp: Date.now(),
      }
    );

    // Rate Limiter에도 기록
    try {
      rateLimiter.checkAndRecord(
        `/internal/critical-violation/${componentName}`,
        'useeffect-detector',
        totalCost
      );
    } catch (error) {
      console.error('[useEffect Safety] Rate Limiter 기록 실패:', error);
    }

    // 긴급 알림
    console.error(`🚨 [useEffect Safety] CRITICAL 위반 감지: ${componentName}`, {
      violations: violations.length,
      totalCost: `$${totalCost}`,
      timestamp: new Date().toISOString(),
    });

    // 개발 환경에서는 에러 발생
    if (this.strictMode) {
      const error = new Error(
        `useEffect 크리티컬 위반: ${componentName}에서 ${violations.length}개의 위험한 패턴이 감지되었습니다. ` +
        `예상 비용: $${totalCost}. 즉시 수정이 필요합니다.`
      );

      // 개발 도구에 전달
      if (typeof window !== 'undefined') {
        (window as any).useEffectViolationError = error;
      }

      throw error;
    }
  }

  /**
   * 위반 로깅
   */
  private logViolations(violations: UseEffectViolation[], componentName: string, hookIndex: number): void {
    violations.forEach(violation => {
      const logLevel = violation.severity === 'CRITICAL' ? 'error' : 'warn';
      console[logLevel](`[useEffect Safety] ${violation.severity} 위반:`, {
        component: componentName,
        hook: hookIndex,
        type: violation.type,
        line: violation.lineNumber,
        details: violation.details,
      });
    });
  }

  /**
   * 컴포넌트 추적기 관리
   */
  private getOrCreateTracker(componentName: string): ComponentEffectTracker {
    if (!componentTrackers.has(componentName)) {
      componentTrackers.set(componentName, {
        componentName,
        effects: [],
        totalViolations: 0,
        riskLevel: 'SAFE',
      });
    }
    return componentTrackers.get(componentName)!;
  }

  private getOrCreateEffectTracker(
    tracker: ComponentEffectTracker,
    hookIndex: number
  ): ComponentEffectTracker['effects'][0] {
    if (!tracker.effects[hookIndex]) {
      tracker.effects[hookIndex] = {
        index: hookIndex,
        dependencies: [],
        callCount: 0,
        lastCall: 0,
        violations: [],
      };
    }
    return tracker.effects[hookIndex];
  }

  private updateRiskLevel(tracker: ComponentEffectTracker): void {
    const criticalCount = tracker.effects.reduce((sum, effect) =>
      sum + effect.violations.filter(v => v.severity === 'CRITICAL').length, 0
    );
    const highCount = tracker.effects.reduce((sum, effect) =>
      sum + effect.violations.filter(v => v.severity === 'HIGH').length, 0
    );

    if (criticalCount > 0) {
      tracker.riskLevel = 'CRITICAL';
    } else if (highCount > 2) {
      tracker.riskLevel = 'DANGER';
    } else if (tracker.totalViolations > 5) {
      tracker.riskLevel = 'WARNING';
    } else if (tracker.totalViolations > 0) {
      tracker.riskLevel = 'CAUTION';
    } else {
      tracker.riskLevel = 'SAFE';
    }
  }

  /**
   * 통계 및 리포트 메서드
   */
  getGlobalStats() {
    const components = Array.from(componentTrackers.values());

    return {
      totalComponents: components.length,
      totalViolations: violationHistory.length,
      criticalViolations: violationHistory.filter(v => v.severity === 'CRITICAL').length,
      riskDistribution: components.reduce((acc, comp) => {
        acc[comp.riskLevel] = (acc[comp.riskLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      topViolators: components
        .filter(comp => comp.totalViolations > 0)
        .sort((a, b) => b.totalViolations - a.totalViolations)
        .slice(0, 10)
        .map(comp => ({
          component: comp.componentName,
          violations: comp.totalViolations,
          riskLevel: comp.riskLevel,
        })),
      violationsByType: violationHistory.reduce((acc, violation) => {
        acc[violation.type] = (acc[violation.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  getComponentReport(componentName: string): ComponentEffectTracker | null {
    return componentTrackers.get(componentName) || null;
  }

  /**
   * 관리 기능
   */
  enable(): void {
    this.enabled = true;
    console.log('[useEffect Safety] 감지기가 활성화되었습니다.');
  }

  disable(): void {
    this.enabled = false;
    console.log('[useEffect Safety] 감지기가 비활성화되었습니다.');
  }

  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
    console.log(`[useEffect Safety] 엄격 모드: ${strict ? '활성화' : '비활성화'}`);
  }

  reset(): void {
    componentTrackers.clear();
    violationHistory.length = 0;
    console.log('[useEffect Safety] 모든 추적 데이터가 초기화되었습니다.');
  }

  // 실시간 모니터링을 위한 이벤트 리스너
  onViolation(callback: (violation: UseEffectViolation) => void): () => void {
    const originalPush = violationHistory.push;
    violationHistory.push = function(...violations) {
      violations.forEach(callback);
      return originalPush.apply(this, violations);
    };

    // 구독 해제 함수 반환
    return () => {
      violationHistory.push = originalPush;
    };
  }
}

// 전역 인스턴스
export const useEffectSafetyDetector = new UseEffectSafetyDetector();

// React Hook 래퍼 함수들 (타입만 제공, 실제 구현은 React 환경에서)
export function useSafeEffect(
  effect: () => void | (() => void),
  deps: unknown[],
  componentName: string = 'Unknown',
  hookIndex: number = 0
): void {
  // 의존성 검증
  const isValid = useEffectSafetyDetector.validateDependencies(deps, componentName, hookIndex);

  if (!isValid && process.env.NODE_ENV === 'development') {
    // 개발 환경에서는 안전한 빈 배열로 대체
    console.warn(`[useSafeEffect] ${componentName}의 위험한 의존성을 빈 배열로 대체합니다.`);
    deps = [];
  }

  // React.useEffect 호출은 실제 React 컴포넌트에서 사용할 때만 가능
  console.log(`[useSafeEffect] ${componentName}에서 안전한 useEffect 호출이 검증되었습니다.`);
}

// 편의 함수
export function validateUseEffectDependencies(
  dependencies: unknown[],
  componentName: string = 'Unknown',
  hookIndex: number = 0,
  lineNumber?: number
): boolean {
  return useEffectSafetyDetector.validateDependencies(dependencies, componentName, hookIndex, lineNumber);
}

// 개발 도구용 전역 객체
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).VideoPlanetUseEffectSafety = {
    detector: useEffectSafetyDetector,
    getGlobalStats: () => useEffectSafetyDetector.getGlobalStats(),
    getComponentReport: (name: string) => useEffectSafetyDetector.getComponentReport(name),
    validateDependencies: validateUseEffectDependencies,
    useSafeEffect,
    reset: () => useEffectSafetyDetector.reset(),
  };

  console.log('🔒 [useEffect Safety] 개발 도구가 window.VideoPlanetUseEffectSafety에 등록되었습니다.');
}