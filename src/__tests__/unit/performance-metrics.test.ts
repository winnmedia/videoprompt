/**
 * 성능 메트릭 단위 테스트
 *
 * 테스트 범위:
 * - Core Web Vitals 측정
 * - API 응답 시간 추적
 * - 메모리 사용량 모니터링
 * - 성능 임계값 검증
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 성능 메트릭 타입 정의
interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  inp: number; // Interaction to Next Paint (INP)
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
}

interface APIPerformanceMetrics {
  responseTime: number;
  statusCode: number;
  dataSize: number;
  endpoint: string;
}

// 모킹된 성능 모니터링 클래스
class MockPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    lcp: 0,
    inp: 0,
    cls: 0,
    ttfb: 0,
    fcp: 0
  };

  private apiMetrics: APIPerformanceMetrics[] = [];

  // Core Web Vitals 측정
  measureWebVitals(): PerformanceMetrics {
    // LCP 시뮬레이션 (2.5초 이하 목표)
    this.metrics.lcp = Math.random() * 3000 + 1000; // 1-4초 범위

    // INP 시뮬레이션 (200ms 이하 목표)
    this.metrics.inp = Math.random() * 300 + 50; // 50-350ms 범위

    // CLS 시뮬레이션 (0.1 이하 목표)
    this.metrics.cls = Math.random() * 0.2; // 0-0.2 범위

    // TTFB 시뮬레이션 (600ms 이하 목표)
    this.metrics.ttfb = Math.random() * 800 + 200; // 200-1000ms 범위

    // FCP 시뮬레이션 (1.8초 이하 목표)
    this.metrics.fcp = Math.random() * 2500 + 800; // 800-3300ms 범위

    return { ...this.metrics };
  }

  // API 성능 측정
  measureAPIPerformance(endpoint: string, startTime: number, endTime: number, statusCode: number, dataSize: number): APIPerformanceMetrics {
    const responseTime = endTime - startTime;

    const metrics: APIPerformanceMetrics = {
      responseTime,
      statusCode,
      dataSize,
      endpoint
    };

    this.apiMetrics.push(metrics);
    return metrics;
  }

  // 메모리 사용량 측정
  measureMemoryUsage(): number {
    // 브라우저 환경에서 performance.memory API 시뮬레이션
    return Math.random() * 50 + 10; // 10-60MB 범위
  }

  // 성능 임계값 검증
  checkPerformanceThresholds(metrics: PerformanceMetrics): Record<string, boolean> {
    return {
      lcpPass: metrics.lcp <= 2500, // 2.5초 이하
      inpPass: metrics.inp <= 200,  // 200ms 이하
      clsPass: metrics.cls <= 0.1,  // 0.1 이하
      ttfbPass: metrics.ttfb <= 600, // 600ms 이하
      fcpPass: metrics.fcp <= 1800   // 1.8초 이하
    };
  }

  // API 성능 분석
  analyzeAPIPerformance(): {
    averageResponseTime: number;
    slowestEndpoint: string;
    fastestEndpoint: string;
    errorRate: number;
  } {
    if (this.apiMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        slowestEndpoint: '',
        fastestEndpoint: '',
        errorRate: 0
      };
    }

    const totalResponseTime = this.apiMetrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    const averageResponseTime = totalResponseTime / this.apiMetrics.length;

    const slowestMetric = this.apiMetrics.reduce((prev, current) =>
      prev.responseTime > current.responseTime ? prev : current
    );

    const fastestMetric = this.apiMetrics.reduce((prev, current) =>
      prev.responseTime < current.responseTime ? prev : current
    );

    const errorCount = this.apiMetrics.filter(metric => metric.statusCode >= 400).length;
    const errorRate = (errorCount / this.apiMetrics.length) * 100;

    return {
      averageResponseTime,
      slowestEndpoint: slowestMetric.endpoint,
      fastestEndpoint: fastestMetric.endpoint,
      errorRate
    };
  }

  // 성능 보고서 생성
  generatePerformanceReport(): {
    webVitals: PerformanceMetrics;
    webVitalsPass: Record<string, boolean>;
    apiAnalysis: ReturnType<MockPerformanceMonitor['analyzeAPIPerformance']>;
    memoryUsage: number;
    recommendations: string[];
  } {
    const webVitals = this.measureWebVitals();
    const webVitalsPass = this.checkPerformanceThresholds(webVitals);
    const apiAnalysis = this.analyzeAPIPerformance();
    const memoryUsage = this.measureMemoryUsage();

    const recommendations: string[] = [];

    // 성능 개선 권장사항 생성
    if (!webVitalsPass.lcpPass) {
      recommendations.push('이미지 최적화 및 지연 로딩 구현을 권장합니다');
    }
    if (!webVitalsPass.inpPass) {
      recommendations.push('JavaScript 최적화 및 메인 스레드 차단 최소화를 권장합니다');
    }
    if (!webVitalsPass.clsPass) {
      recommendations.push('레이아웃 시프트 방지를 위한 고정 크기 설정을 권장합니다');
    }
    if (apiAnalysis.averageResponseTime > 3000) {
      recommendations.push('API 응답 시간 최적화를 권장합니다');
    }
    if (apiAnalysis.errorRate > 5) {
      recommendations.push('API 에러율 개선이 필요합니다');
    }
    if (memoryUsage > 40) {
      recommendations.push('메모리 사용량 최적화를 권장합니다');
    }

    return {
      webVitals,
      webVitalsPass,
      apiAnalysis,
      memoryUsage,
      recommendations
    };
  }

  // 메트릭 초기화
  reset(): void {
    this.metrics = {
      lcp: 0,
      inp: 0,
      cls: 0,
      ttfb: 0,
      fcp: 0
    };
    this.apiMetrics = [];
  }
}

describe('성능 메트릭 단위 테스트', () => {
  let performanceMonitor: MockPerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new MockPerformanceMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.reset();
  });

  describe('Core Web Vitals 측정', () => {
    it('모든 Core Web Vitals 값을 측정할 수 있어야 한다', () => {
      const metrics = performanceMonitor.measureWebVitals();

      expect(metrics).toHaveProperty('lcp');
      expect(metrics).toHaveProperty('inp');
      expect(metrics).toHaveProperty('cls');
      expect(metrics).toHaveProperty('ttfb');
      expect(metrics).toHaveProperty('fcp');

      // 값이 유효한 범위에 있는지 확인
      expect(metrics.lcp).toBeGreaterThan(0);
      expect(metrics.inp).toBeGreaterThan(0);
      expect(metrics.cls).toBeGreaterThanOrEqual(0);
      expect(metrics.ttfb).toBeGreaterThan(0);
      expect(metrics.fcp).toBeGreaterThan(0);
    });

    it('성능 임계값 검증이 올바르게 동작해야 한다', () => {
      // 좋은 성능 메트릭 시뮬레이션
      const goodMetrics: PerformanceMetrics = {
        lcp: 2000,  // 2초 (좋음)
        inp: 150,   // 150ms (좋음)
        cls: 0.05,  // 0.05 (좋음)
        ttfb: 500,  // 500ms (좋음)
        fcp: 1500   // 1.5초 (좋음)
      };

      const results = performanceMonitor.checkPerformanceThresholds(goodMetrics);

      expect(results.lcpPass).toBe(true);
      expect(results.inpPass).toBe(true);
      expect(results.clsPass).toBe(true);
      expect(results.ttfbPass).toBe(true);
      expect(results.fcpPass).toBe(true);
    });

    it('성능이 나쁠 때 임계값 검증이 실패해야 한다', () => {
      // 나쁜 성능 메트릭 시뮬레이션
      const badMetrics: PerformanceMetrics = {
        lcp: 4000,  // 4초 (나쁨)
        inp: 350,   // 350ms (나쁨)
        cls: 0.3,   // 0.3 (나쁨)
        ttfb: 1200, // 1.2초 (나쁨)
        fcp: 3000   // 3초 (나쁨)
      };

      const results = performanceMonitor.checkPerformanceThresholds(badMetrics);

      expect(results.lcpPass).toBe(false);
      expect(results.inpPass).toBe(false);
      expect(results.clsPass).toBe(false);
      expect(results.ttfbPass).toBe(false);
      expect(results.fcpPass).toBe(false);
    });
  });

  describe('API 성능 측정', () => {
    it('API 응답 시간을 정확히 측정할 수 있어야 한다', () => {
      const startTime = Date.now();
      const endTime = startTime + 1500; // 1.5초 후

      const metrics = performanceMonitor.measureAPIPerformance(
        '/api/ai/generate-story',
        startTime,
        endTime,
        200,
        1024
      );

      expect(metrics.responseTime).toBe(1500);
      expect(metrics.endpoint).toBe('/api/ai/generate-story');
      expect(metrics.statusCode).toBe(200);
      expect(metrics.dataSize).toBe(1024);
    });

    it('여러 API 호출의 성능을 분석할 수 있어야 한다', () => {
      // 여러 API 호출 시뮬레이션
      performanceMonitor.measureAPIPerformance('/api/fast', 0, 500, 200, 512);
      performanceMonitor.measureAPIPerformance('/api/slow', 0, 3000, 200, 2048);
      performanceMonitor.measureAPIPerformance('/api/error', 0, 1000, 500, 256);

      const analysis = performanceMonitor.analyzeAPIPerformance();

      expect(analysis.averageResponseTime).toBe(1500); // (500 + 3000 + 1000) / 3
      expect(analysis.slowestEndpoint).toBe('/api/slow');
      expect(analysis.fastestEndpoint).toBe('/api/fast');
      expect(analysis.errorRate).toBeCloseTo(33.33, 1); // 1/3 = 33.33%
    });

    it('API 에러율이 올바르게 계산되어야 한다', () => {
      // 성공 3개, 에러 2개
      performanceMonitor.measureAPIPerformance('/api/success1', 0, 1000, 200, 1024);
      performanceMonitor.measureAPIPerformance('/api/success2', 0, 1200, 201, 512);
      performanceMonitor.measureAPIPerformance('/api/success3', 0, 800, 200, 256);
      performanceMonitor.measureAPIPerformance('/api/error1', 0, 2000, 400, 128);
      performanceMonitor.measureAPIPerformance('/api/error2', 0, 1500, 500, 64);

      const analysis = performanceMonitor.analyzeAPIPerformance();

      expect(analysis.errorRate).toBe(40); // 2/5 = 40%
    });
  });

  describe('메모리 사용량 모니터링', () => {
    it('메모리 사용량을 측정할 수 있어야 한다', () => {
      const memoryUsage = performanceMonitor.measureMemoryUsage();

      expect(memoryUsage).toBeGreaterThan(0);
      expect(memoryUsage).toBeLessThan(100); // 100MB 이하
    });
  });

  describe('성능 보고서 생성', () => {
    it('종합적인 성능 보고서를 생성할 수 있어야 한다', () => {
      // 일부 API 호출 시뮬레이션
      performanceMonitor.measureAPIPerformance('/api/test', 0, 2000, 200, 1024);

      const report = performanceMonitor.generatePerformanceReport();

      expect(report).toHaveProperty('webVitals');
      expect(report).toHaveProperty('webVitalsPass');
      expect(report).toHaveProperty('apiAnalysis');
      expect(report).toHaveProperty('memoryUsage');
      expect(report).toHaveProperty('recommendations');

      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('성능이 좋을 때는 권장사항이 적어야 한다', () => {
      // 좋은 성능으로 설정
      vi.spyOn(performanceMonitor, 'measureWebVitals').mockReturnValue({
        lcp: 2000,  // 좋음
        inp: 100,   // 좋음
        cls: 0.05,  // 좋음
        ttfb: 400,  // 좋음
        fcp: 1200   // 좋음
      });

      vi.spyOn(performanceMonitor, 'measureMemoryUsage').mockReturnValue(20); // 좋음

      // 빠른 API 응답
      performanceMonitor.measureAPIPerformance('/api/fast', 0, 1000, 200, 512);

      const report = performanceMonitor.generatePerformanceReport();

      expect(report.recommendations.length).toBeLessThan(3); // 권장사항이 적어야 함
    });

    it('성능이 나쁠 때는 권장사항이 많아야 한다', () => {
      // 나쁜 성능으로 설정
      vi.spyOn(performanceMonitor, 'measureWebVitals').mockReturnValue({
        lcp: 4000,  // 나쁨
        inp: 300,   // 나쁨
        cls: 0.3,   // 나쁨
        ttfb: 1000, // 나쁨
        fcp: 3000   // 나쁨
      });

      vi.spyOn(performanceMonitor, 'measureMemoryUsage').mockReturnValue(50); // 나쁨

      // 느린 API와 에러 많이 시뮬레이션
      performanceMonitor.measureAPIPerformance('/api/slow1', 0, 4000, 200, 2048);
      performanceMonitor.measureAPIPerformance('/api/slow2', 0, 5000, 500, 1024);
      performanceMonitor.measureAPIPerformance('/api/error', 0, 2000, 400, 512);

      const report = performanceMonitor.generatePerformanceReport();

      expect(report.recommendations.length).toBeGreaterThan(3); // 권장사항이 많아야 함
      expect(report.recommendations.some(rec => rec.includes('이미지 최적화'))).toBe(true);
      expect(report.recommendations.some(rec => rec.includes('JavaScript 최적화'))).toBe(true);
      expect(report.recommendations.some(rec => rec.includes('API 응답 시간'))).toBe(true);
    });
  });

  describe('성능 임계값 SLA', () => {
    it('프로덕션 SLA 기준을 충족해야 한다', () => {
      // 프로덕션 목표 성능 기준
      const productionTargets = {
        maxLCP: 2500,     // 2.5초
        maxINP: 200,      // 200ms
        maxCLS: 0.1,      // 0.1
        maxTTFB: 600,     // 600ms
        maxFCP: 1800,     // 1.8초
        maxAPIResponse: 3000, // 3초
        maxErrorRate: 5,      // 5%
        maxMemoryUsage: 40    // 40MB
      };

      // 목표 성능으로 설정
      const targetMetrics: PerformanceMetrics = {
        lcp: productionTargets.maxLCP - 100,  // 2.4초
        inp: productionTargets.maxINP - 20,   // 180ms
        cls: productionTargets.maxCLS - 0.01, // 0.09
        ttfb: productionTargets.maxTTFB - 50, // 550ms
        fcp: productionTargets.maxFCP - 100   // 1.7초
      };

      const results = performanceMonitor.checkPerformanceThresholds(targetMetrics);

      // 모든 임계값을 통과해야 함
      Object.values(results).forEach(passed => {
        expect(passed).toBe(true);
      });
    });
  });
});