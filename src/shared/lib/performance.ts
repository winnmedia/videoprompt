/**
 * Performance Monitoring Utilities
 * Core Web Vitals 측정 및 성능 최적화
 * CLAUDE.md 성능 예산 준수
 */

import React from 'react';

// Web Vitals 측정을 위한 타입
interface WebVitalsMetric {
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: PerformanceEntry[];
}

// 성능 예산 임계값 (CLAUDE.md 기준)
export const PERFORMANCE_BUDGETS = {
  LCP: { good: 2500, poor: 4000 }, // ms
  FID: { good: 100, poor: 300 },   // ms
  INP: { good: 200, poor: 500 },   // ms
  CLS: { good: 0.1, poor: 0.25 },  // score
  FCP: { good: 1800, poor: 3000 }, // ms
  TTFB: { good: 800, poor: 1800 }  // ms
};

// Web Vitals 측정 클래스
export class WebVitalsMonitor {
  private metrics: Map<string, WebVitalsMetric> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor(private onMetric?: (metric: WebVitalsMetric) => void) {
    this.setupObservers();
  }

  private setupObservers() {
    // LCP (Largest Contentful Paint) 측정
    this.observeMetric('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1] as PerformanceEventTiming;
      this.reportMetric('LCP', lastEntry.startTime, entries);
    });

    // FID (First Input Delay) / INP (Interaction to Next Paint) 측정
    this.observeMetric('first-input', (entries) => {
      const firstEntry = entries[0] as PerformanceEventTiming;
      const delay = firstEntry.processingStart - firstEntry.startTime;
      this.reportMetric('FID', delay, entries);
    });

    // CLS (Cumulative Layout Shift) 측정
    this.observeMetric('layout-shift', (entries) => {
      let clsValue = 0;
      for (const entry of entries as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      this.reportMetric('CLS', clsValue, entries);
    });

    // Navigation Timing으로 FCP, TTFB 측정
    this.observeMetric('navigation', (entries) => {
      const entry = entries[0] as PerformanceNavigationTiming;
      const ttfb = entry.responseStart - entry.requestStart;
      this.reportMetric('TTFB', ttfb, entries);
    });

    this.observeMetric('paint', (entries) => {
      for (const entry of entries as PerformancePaintTiming[]) {
        if (entry.name === 'first-contentful-paint') {
          this.reportMetric('FCP', entry.startTime, [entry]);
        }
      }
    });
  }

  private observeMetric(
    entryType: string,
    callback: (entries: PerformanceEntry[]) => void
  ) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ entryTypes: [entryType] });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Performance observer for ${entryType} not supported:`, error);
    }
  }

  private reportMetric(
    name: WebVitalsMetric['name'],
    value: number,
    entries: PerformanceEntry[]
  ) {
    const rating = this.getRating(name, value);
    const existingMetric = this.metrics.get(name);
    const delta = existingMetric ? value - existingMetric.value : value;

    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      delta,
      entries
    };

    this.metrics.set(name, metric);

    if (this.onMetric) {
      this.onMetric(metric);
    }

    // 개발 환경에서 콘솔 로그
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${value.toFixed(2)} (${rating})`);
    }
  }

  private getRating(name: string, value: number): WebVitalsMetric['rating'] {
    const budget = PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS];
    if (!budget) return 'good';

    if (value <= budget.good) return 'good';
    if (value <= budget.poor) return 'needs-improvement';
    return 'poor';
  }

  getMetrics(): WebVitalsMetric[] {
    return Array.from(this.metrics.values());
  }

  getMetric(name: string): WebVitalsMetric | undefined {
    return this.metrics.get(name);
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// 리소스 로딩 성능 측정
export function measureResourcePerformance() {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const analysis = {
    totalSize: 0,
    totalDuration: 0,
    scripts: { count: 0, size: 0, duration: 0 },
    stylesheets: { count: 0, size: 0, duration: 0 },
    images: { count: 0, size: 0, duration: 0 },
    fonts: { count: 0, size: 0, duration: 0 },
    slowResources: [] as Array<{ name: string; duration: number; size: number }>
  };

  resources.forEach(resource => {
    const duration = resource.responseEnd - resource.startTime;
    const size = resource.transferSize || 0;

    analysis.totalDuration += duration;
    analysis.totalSize += size;

    // 리소스 타입별 분류
    if (resource.name.includes('.js')) {
      analysis.scripts.count++;
      analysis.scripts.size += size;
      analysis.scripts.duration += duration;
    } else if (resource.name.includes('.css')) {
      analysis.stylesheets.count++;
      analysis.stylesheets.size += size;
      analysis.stylesheets.duration += duration;
    } else if (/\.(jpg|jpeg|png|gif|webp|svg|ico)/.test(resource.name)) {
      analysis.images.count++;
      analysis.images.size += size;
      analysis.images.duration += duration;
    } else if (/\.(woff|woff2|ttf|otf)/.test(resource.name)) {
      analysis.fonts.count++;
      analysis.fonts.size += size;
      analysis.fonts.duration += duration;
    }

    // 느린 리소스 감지 (1초 이상)
    if (duration > 1000) {
      analysis.slowResources.push({
        name: resource.name,
        duration,
        size
      });
    }
  });

  return analysis;
}

// 메모리 사용량 측정
export function measureMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }
  return null;
}

// 렌더링 성능 측정
export function measureRenderPerformance(componentName: string) {
  const startTime = performance.now();

  return {
    end: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Render] ${componentName}: ${duration.toFixed(2)}ms`);
      }

      // 느린 렌더링 경고 (16ms 초과 시 60fps 깨짐)
      if (duration > 16) {
        console.warn(`[Performance Warning] ${componentName} rendered slowly: ${duration.toFixed(2)}ms`);
      }

      return duration;
    }
  };
}

// 네트워크 성능 측정
export function measureNetworkPerformance() {
  const connection = (navigator as any).connection;
  if (!connection) return null;

  return {
    effectiveType: connection.effectiveType, // '4g', '3g', etc.
    downlink: connection.downlink, // Mbps
    rtt: connection.rtt, // ms
    saveData: connection.saveData // boolean
  };
}

// React Hook: 컴포넌트 성능 측정
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = React.useRef(0);
  const mountTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    mountTimeRef.current = performance.now();
    return () => {
      if (mountTimeRef.current) {
        const mountDuration = performance.now() - mountTimeRef.current;
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Component Lifecycle] ${componentName}: mounted for ${mountDuration.toFixed(2)}ms, rendered ${renderCountRef.current} times`);
        }
      }
    };
  }, [componentName]);

  React.useEffect(() => {
    renderCountRef.current++;
  });

  const measureRender = React.useCallback(() => {
    return measureRenderPerformance(componentName);
  }, [componentName]);

  return { measureRender, renderCount: renderCountRef.current };
}

// 성능 데이터 수집 및 리포팅
export class PerformanceReporter {
  private metrics: any[] = [];

  addMetric(metric: WebVitalsMetric) {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
      url: window.location.href
    });

    // 성능 예산 위반 감지
    this.checkBudgetViolation(metric);
  }

  private checkBudgetViolation(metric: WebVitalsMetric) {
    if (metric.rating === 'poor') {
      console.error(`[Performance Budget Violation] ${metric.name}: ${metric.value} exceeds budget`);

      // 실제 환경에서는 모니터링 서비스로 전송
      if (process.env.NODE_ENV === 'production') {
        this.sendToMonitoring(metric);
      }
    }
  }

  private sendToMonitoring(metric: WebVitalsMetric) {
    // 실제 모니터링 서비스 (예: Google Analytics, Sentry)로 전송
    // 여기서는 콘솔 로그로 시뮬레이션
    console.log('Sending to monitoring service:', metric);
  }

  getReport() {
    return {
      metrics: this.metrics,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };
  }

  private generateSummary() {
    const summary: Record<string, any> = {};

    for (const metricName of Object.keys(PERFORMANCE_BUDGETS)) {
      const metric = this.metrics.find(m => m.name === metricName);
      if (metric) {
        summary[metricName] = {
          value: metric.value,
          rating: metric.rating,
          budget: PERFORMANCE_BUDGETS[metricName as keyof typeof PERFORMANCE_BUDGETS]
        };
      }
    }

    return summary;
  }

  private generateRecommendations() {
    const recommendations: string[] = [];
    const summary = this.generateSummary();

    if (summary.LCP?.rating === 'poor') {
      recommendations.push('LCP 개선: 이미지 최적화, 중요 리소스 우선 로딩 검토');
    }

    if (summary.CLS?.rating === 'poor') {
      recommendations.push('CLS 개선: 이미지 크기 명시, 폰트 로딩 최적화');
    }

    if (summary.FID?.rating === 'poor' || summary.INP?.rating === 'poor') {
      recommendations.push('상호작용 개선: JavaScript 번들 크기 최적화, 메인 스레드 차단 최소화');
    }

    return recommendations;
  }
}

// 전역 성능 모니터 인스턴스
export const performanceReporter = new PerformanceReporter();

// 페이지 로드 시 자동으로 Web Vitals 측정 시작
if (typeof window !== 'undefined') {
  const webVitalsMonitor = new WebVitalsMonitor(metric => {
    performanceReporter.addMetric(metric);
  });

  // 페이지 언로드 시 정리
  window.addEventListener('beforeunload', () => {
    webVitalsMonitor.destroy();
  });
}