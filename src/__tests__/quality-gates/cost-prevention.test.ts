/**
 * TDD: $300 사건 방지 자동 검증 테스트
 *
 * RED 단계: 실패하는 테스트부터 작성
 * 목표: 무한 루프, API 호출 폭탄, 비용 급증 패턴 완전 차단
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectInfiniteLoops,
  validateApiCallPatterns,
  analyzeCostRisk,
  runQualityGates,
  CostRiskLevel,
  type ApiCallPattern,
  type InfiniteLoopDetection,
  type CostAnalysis
} from '../../../scripts/cost-prevention-detector';

describe('$300 사건 방지 시스템 (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('무한 루프 감지 시스템', () => {
    it('should detect dangerous useEffect dependency patterns', () => {
      const dangerousCode = `
        useEffect(() => {
          checkAuth();
        }, [checkAuth]);
      `;

      const result = detectInfiniteLoops(dangerousCode);

      expect(result.isRisky).toBe(true);
      expect(result.riskLevel).toBe(CostRiskLevel.CRITICAL);
      expect(result.violations).toContain('function-in-dependency');
      expect(result.estimatedCost).toBeGreaterThan(100);
    });

    it('should detect nested function calls in useEffect', () => {
      const nestedCode = `
        useEffect(() => {
          async function fetchUserData() {
            await getUserProfile();
          }
          fetchUserData();
        }, [fetchUserData]);
      `;

      const result = detectInfiniteLoops(nestedCode);

      expect(result.isRisky).toBe(true);
      expect(result.violations).toContain('nested-function-dependency');
    });

    it('should allow safe patterns with primitive dependencies', () => {
      const safeCode = `
        useEffect(() => {
          console.log('User ID:', userId);
        }, [userId]);
      `;

      const result = detectInfiniteLoops(safeCode);

      expect(result.isRisky).toBe(false);
      expect(result.riskLevel).toBe(CostRiskLevel.LOW);
    });

    it('should detect useLayoutEffect patterns', () => {
      const layoutCode = `
        useLayoutEffect(() => {
          measureElement();
        }, [measureElement]);
      `;

      const result = detectInfiniteLoops(layoutCode);

      expect(result.isRisky).toBe(true);
      expect(result.violations).toContain('layout-effect-function-dependency');
    });
  });

  describe('API 호출 패턴 분석', () => {
    it('should detect rapid succession API calls', () => {
      const rapidCalls: ApiCallPattern[] = [
        { endpoint: '/api/auth/me', timestamp: 1000, duration: 50 },
        { endpoint: '/api/auth/me', timestamp: 1050, duration: 45 },
        { endpoint: '/api/auth/me', timestamp: 1100, duration: 48 },
        { endpoint: '/api/auth/me', timestamp: 1150, duration: 52 },
        { endpoint: '/api/auth/me', timestamp: 1200, duration: 46 }
      ];

      const result = validateApiCallPatterns(rapidCalls);

      expect(result.isRisky).toBe(true);
      expect(result.riskLevel).toBe(CostRiskLevel.CRITICAL);
      expect(result.violations).toContain('rapid-succession');
      expect(result.estimatedCost).toBeGreaterThan(50);
    });

    it('should detect auth polling patterns', () => {
      const pollingCalls: ApiCallPattern[] = [];

      // 1분간 5초마다 호출하는 패턴 (12회)
      for (let i = 0; i < 12; i++) {
        pollingCalls.push({
          endpoint: '/api/auth/validate',
          timestamp: i * 5000,
          duration: 100
        });
      }

      const result = validateApiCallPatterns(pollingCalls);

      expect(result.isRisky).toBe(true);
      expect(result.violations).toContain('auth-polling');
    });

    it('should allow reasonable API call patterns', () => {
      const reasonableCalls: ApiCallPattern[] = [
        { endpoint: '/api/user/profile', timestamp: 1000, duration: 150 },
        { endpoint: '/api/stories/list', timestamp: 5000, duration: 200 },
        { endpoint: '/api/auth/refresh', timestamp: 300000, duration: 100 } // 5분 후
      ];

      const result = validateApiCallPatterns(reasonableCalls);

      expect(result.isRisky).toBe(false);
      expect(result.riskLevel).toBe(CostRiskLevel.LOW);
    });
  });

  describe('비용 위험도 분석', () => {
    it('should calculate accurate cost estimates for infinite loops', () => {
      const criticalLoop: InfiniteLoopDetection = {
        isRisky: true,
        riskLevel: CostRiskLevel.CRITICAL,
        violations: ['function-in-dependency'],
        estimatedCost: 300,
        details: {
          pattern: 'useEffect-function-dependency',
          frequency: 'per-render',
          endpoint: '/api/auth/me'
        }
      };

      const costAnalysis = analyzeCostRisk(criticalLoop);

      expect(costAnalysis.estimatedDailyCost).toBeGreaterThan(100);
      expect(costAnalysis.riskFactors).toContain('high-frequency-auth-calls');
      expect(costAnalysis.preventionRequired).toBe(true);
    });

    it('should recommend immediate intervention for high-risk patterns', () => {
      const highRiskPattern: InfiniteLoopDetection = {
        isRisky: true,
        riskLevel: CostRiskLevel.CRITICAL,
        violations: ['rapid-succession', 'auth-polling'],
        estimatedCost: 200,
        details: {
          pattern: 'multiple-violations',
          frequency: 'continuous',
          endpoint: '/api/auth/me'
        }
      };

      const costAnalysis = analyzeCostRisk(highRiskPattern);

      expect(costAnalysis.actionRequired).toBe('IMMEDIATE_BLOCK');
      expect(costAnalysis.estimatedDailyCost).toBeGreaterThan(300);
    });
  });

  describe('통합 품질 게이트', () => {
    it('should fail deployment for any $300 risk patterns', () => {
      const codeWithRisk = `
        useEffect(() => {
          authenticateUser();
        }, [authenticateUser]);
      `;

      const result = runQualityGates(codeWithRisk);

      expect(result.passed).toBe(false);
      expect(result.blockers).toHaveLength(3); // 크리티컬, 비용, 예방 필요
      expect(result.violations).toContain('function-in-dependency');
    });

    it('should pass safe code through quality gates', () => {
      const safeCode = `
        useEffect(() => {
          console.log('Safe operation');
        }, []);
      `;

      const result = runQualityGates(safeCode);

      expect(result.passed).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });
  });
});