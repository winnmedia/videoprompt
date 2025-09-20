/**
 * 실시간 품질 모니터링 시스템
 * QA Lead Grace - 회귀 방지 및 품질 메트릭 추적
 *
 * 목적:
 * - 런타임 품질 위반 감지
 * - 성능 회귀 모니터링
 * - $300 사건 재발 방지
 */

import { useCallback } from 'react';

interface QualityMetric {
  name: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

interface QualityAlert {
  id: string;
  type: 'performance' | 'api_cost' | 'memory_leak' | 'infinite_loop' | 'type_safety';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
  timestamp: number;
}

interface ComponentRenderInfo {
  name: string;
  renderCount: number;
  lastRender: number;
  props: Record<string, any>;
}

interface ApiCallInfo {
  endpoint: string;
  count: number;
  cost: number;
  lastCall: number;
  errors: number;
}

/**
 * 품질 모니터링 메인 클래스
 */
export class QualityMonitor {
  private static instance: QualityMonitor;
  private metrics: Map<string, QualityMetric> = new Map();
  private alerts: QualityAlert[] = [];
  private componentRenders: Map<string, ComponentRenderInfo> = new Map();
  private apiCalls: Map<string, ApiCallInfo> = new Map();
  private alertCallbacks: ((alert: QualityAlert) => void)[] = [];

  // 임계값 설정
  private readonly thresholds = {
    maxRenderCount: 50, // 컴포넌트 최대 렌더링 횟수
    maxApiCost: 10.0, // 시간당 최대 API 비용 ($10)
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxResponseTime: 2000, // 2초
    maxErrorRate: 0.05 // 5%
  };

  private constructor() {
    this.initializeMonitoring();
  }

  public static getInstance(): QualityMonitor {
    if (!QualityMonitor.instance) {
      QualityMonitor.instance = new QualityMonitor();
    }
    return QualityMonitor.instance;
  }

  /**
   * 모니터링 초기화
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return; // 서버사이드에서는 실행하지 않음

    // 성능 관찰자 설정
    this.setupPerformanceObserver();

    // 메모리 사용량 모니터링
    this.setupMemoryMonitoring();

    // API 호출 인터셉터 설정
    this.setupApiInterceptor();

    // 주기적 검사 설정
    this.setupPeriodicChecks();

    console.log('🛡️ Quality Monitor initialized');
  }

  /**
   * 성능 관찰자 설정
   */
  private setupPerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackPerformanceMetric(entry);
        }
      });

      observer.observe({
        entryTypes: ['navigation', 'resource', 'measure', 'paint']
      });
    } catch (error) {
      console.warn('Performance Observer setup failed:', error);
    }
  }

  /**
   * 메모리 모니터링 설정
   */
  private setupMemoryMonitoring(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        this.recordMetric('memory_used', memory.usedJSHeapSize, this.thresholds.maxMemoryUsage, 'high');

        // 메모리 누수 감지
        if (memory.usedJSHeapSize > this.thresholds.maxMemoryUsage) {
          this.triggerAlert({
            id: `memory_leak_${Date.now()}`,
            type: 'memory_leak',
            message: `Memory usage exceeded threshold: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
            severity: 'critical',
            data: { memoryUsage: memory.usedJSHeapSize },
            timestamp: Date.now()
          });
        }
      }
    }, 30000); // 30초마다 검사
  }

  /**
   * API 호출 인터셉터 설정
   */
  private setupApiInterceptor(): void {
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const startTime = performance.now();
      const [url] = args;
      const endpoint = typeof url === 'string' ? url : url.toString();

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - startTime;

        this.trackApiCall(endpoint, duration, !response.ok);
        this.recordMetric(`api_response_time_${endpoint}`, duration, this.thresholds.maxResponseTime, 'medium');

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.trackApiCall(endpoint, duration, true);
        throw error;
      }
    };
  }

  /**
   * 주기적 검사 설정
   */
  private setupPeriodicChecks(): void {
    // 1분마다 품질 메트릭 검사
    setInterval(() => {
      this.checkApiCostThresholds();
      this.checkComponentRenderThresholds();
      this.cleanupOldData();
    }, 60000);
  }

  /**
   * 성능 메트릭 추적
   */
  private trackPerformanceMetric(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'navigation': {
        const navEntry = entry as PerformanceNavigationTiming;
        this.recordMetric('page_load_time', navEntry.duration, 5000, 'high');
        break;
      }

      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('first_contentful_paint', entry.startTime, 2000, 'medium');
        }
        break;

      case 'measure':
        this.recordMetric(`custom_measure_${entry.name}`, entry.duration, 1000, 'low');
        break;
    }
  }

  /**
   * 컴포넌트 렌더링 추적
   */
  public trackComponentRender(componentName: string, props: Record<string, any> = {}): void {
    const existing = this.componentRenders.get(componentName);
    const now = Date.now();

    if (existing) {
      existing.renderCount++;
      existing.lastRender = now;
      existing.props = props;
    } else {
      this.componentRenders.set(componentName, {
        name: componentName,
        renderCount: 1,
        lastRender: now,
        props
      });
    }

    // 과도한 렌더링 감지
    const renderInfo = this.componentRenders.get(componentName)!;
    if (renderInfo.renderCount > this.thresholds.maxRenderCount) {
      this.triggerAlert({
        id: `excessive_renders_${componentName}_${now}`,
        type: 'performance',
        message: `Component ${componentName} has excessive renders: ${renderInfo.renderCount}`,
        severity: 'critical',
        data: { componentName, renderCount: renderInfo.renderCount, props },
        timestamp: now
      });
    }
  }

  /**
   * API 호출 추적
   */
  private trackApiCall(endpoint: string, duration: number, isError: boolean): void {
    const existing = this.apiCalls.get(endpoint);
    const costPerCall = this.estimateApiCost(endpoint);

    if (existing) {
      existing.count++;
      existing.cost += costPerCall;
      existing.lastCall = Date.now();
      if (isError) existing.errors++;
    } else {
      this.apiCalls.set(endpoint, {
        endpoint,
        count: 1,
        cost: costPerCall,
        lastCall: Date.now(),
        errors: isError ? 1 : 0
      });
    }

    // 응답 시간 검사
    if (duration > this.thresholds.maxResponseTime) {
      this.triggerAlert({
        id: `slow_api_${endpoint}_${Date.now()}`,
        type: 'performance',
        message: `Slow API response: ${endpoint} took ${Math.round(duration)}ms`,
        severity: 'medium',
        data: { endpoint, duration },
        timestamp: Date.now()
      });
    }
  }

  /**
   * API 비용 추정
   */
  private estimateApiCost(endpoint: string): number {
    // 실제 비용은 API 제공업체에 따라 다름
    if (endpoint.includes('/api/auth/me')) return 0.001; // $0.001
    if (endpoint.includes('/api/planning/')) return 0.002; // $0.002
    if (endpoint.includes('/api/video/')) return 0.01; // $0.01
    return 0.001; // 기본값
  }

  /**
   * API 비용 임계값 검사
   */
  private checkApiCostThresholds(): void {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    let totalCost = 0;
    let hourlyCallCount = 0;

    for (const [endpoint, info] of this.apiCalls) {
      if (info.lastCall > hourAgo) {
        totalCost += info.cost;
        hourlyCallCount += info.count;
      }
    }

    this.recordMetric('hourly_api_cost', totalCost, this.thresholds.maxApiCost, 'critical');

    if (totalCost > this.thresholds.maxApiCost) {
      this.triggerAlert({
        id: `api_cost_exceeded_${now}`,
        type: 'api_cost',
        message: `API cost exceeded threshold: $${totalCost.toFixed(2)} in the last hour`,
        severity: 'critical',
        data: { totalCost, hourlyCallCount, threshold: this.thresholds.maxApiCost },
        timestamp: now
      });
    }

    // $300 사건 특별 감시 - checkAuth 과도한 호출
    const authEndpoint = Array.from(this.apiCalls.keys()).find(ep => ep.includes('/api/auth/me'));
    if (authEndpoint) {
      const authInfo = this.apiCalls.get(authEndpoint)!;
      if (authInfo.count > 100) { // 시간당 100회 초과
        this.triggerAlert({
          id: `auth_excessive_calls_${now}`,
          type: 'api_cost',
          message: `🚨 $300 INCIDENT PATTERN DETECTED: /api/auth/me called ${authInfo.count} times`,
          severity: 'critical',
          data: { endpoint: authEndpoint, calls: authInfo.count },
          timestamp: now
        });
      }
    }
  }

  /**
   * 컴포넌트 렌더링 임계값 검사
   */
  private checkComponentRenderThresholds(): void {
    for (const [componentName, info] of this.componentRenders) {
      if (info.renderCount > this.thresholds.maxRenderCount) {
        this.recordMetric(`component_renders_${componentName}`, info.renderCount, this.thresholds.maxRenderCount, 'high');
      }
    }
  }

  /**
   * 메트릭 기록
   */
  private recordMetric(name: string, value: number, threshold: number, severity: QualityMetric['severity']): void {
    this.metrics.set(name, {
      name,
      value,
      threshold,
      severity,
      timestamp: Date.now()
    });

    if (value > threshold) {
      this.triggerAlert({
        id: `metric_threshold_${name}_${Date.now()}`,
        type: 'performance',
        message: `Metric '${name}' exceeded threshold: ${value} > ${threshold}`,
        severity,
        data: { metric: name, value, threshold },
        timestamp: Date.now()
      });
    }
  }

  /**
   * 알림 트리거
   */
  private triggerAlert(alert: QualityAlert): void {
    this.alerts.push(alert);

    // 콘솔 출력
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : 'ℹ️';
    console.warn(`${emoji} Quality Alert [${alert.severity.toUpperCase()}]:`, alert.message, alert.data);

    // 등록된 콜백 실행
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });

    // 중요 알림은 즉시 전송
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }

  /**
   * 중요 알림 전송
   */
  private sendCriticalAlert(alert: QualityAlert): void {
    // 실제로는 Slack, 이메일, 모니터링 서비스로 전송
    if (typeof window !== 'undefined' && 'navigator' in window && 'serviceWorker' in navigator) {
      // Service Worker를 통한 푸시 알림 (실제 구현 시)
      console.error('🚨 CRITICAL QUALITY ALERT:', alert.message);
    }
  }

  /**
   * 알림 콜백 등록
   */
  public onAlert(callback: (alert: QualityAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 품질 리포트 생성
   */
  public generateQualityReport(): {
    metrics: QualityMetric[];
    alerts: QualityAlert[];
    summary: {
      totalAlerts: number;
      criticalAlerts: number;
      avgApiCost: number;
      topRenderingComponents: Array<{ name: string; count: number }>;
    };
  } {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    const recentAlerts = this.alerts.filter(alert => alert.timestamp > hourAgo);
    const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'critical');

    const totalApiCost = Array.from(this.apiCalls.values())
      .reduce((sum, info) => sum + info.cost, 0);

    const topRenderingComponents = Array.from(this.componentRenders.values())
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 5)
      .map(info => ({ name: info.name, count: info.renderCount }));

    return {
      metrics: Array.from(this.metrics.values()),
      alerts: recentAlerts,
      summary: {
        totalAlerts: recentAlerts.length,
        criticalAlerts: criticalAlerts.length,
        avgApiCost: totalApiCost,
        topRenderingComponents
      }
    };
  }

  /**
   * 오래된 데이터 정리
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    // 오래된 알림 제거
    this.alerts = this.alerts.filter(alert => alert.timestamp > dayAgo);

    // 렌더링 카운트 리셋 (24시간마다)
    for (const [name, info] of this.componentRenders) {
      if (info.lastRender < dayAgo) {
        this.componentRenders.delete(name);
      }
    }
  }

  /**
   * 수동 메트릭 추가
   */
  public trackCustomMetric(name: string, value: number, threshold?: number, severity?: QualityMetric['severity']): void {
    this.recordMetric(name, value, threshold || 100, severity || 'medium');
  }

  /**
   * 현재 상태 조회
   */
  public getStatus(): {
    isHealthy: boolean;
    criticalIssues: number;
    lastAlert?: QualityAlert;
  } {
    const recentCriticalAlerts = this.alerts
      .filter(alert => alert.severity === 'critical' && alert.timestamp > Date.now() - 60000);

    return {
      isHealthy: recentCriticalAlerts.length === 0,
      criticalIssues: recentCriticalAlerts.length,
      lastAlert: this.alerts[this.alerts.length - 1]
    };
  }
}

// React Hook 형태로 제공
export function useQualityMonitor() {
  const monitor = QualityMonitor.getInstance();

  const trackRender = useCallback((componentName: string, props?: Record<string, any>) => {
    monitor.trackComponentRender(componentName, props);
  }, [monitor]);

  const trackMetric = useCallback((name: string, value: number, threshold?: number) => {
    monitor.trackCustomMetric(name, value, threshold);
  }, [monitor]);

  const getStatus = useCallback(() => {
    return monitor.getStatus();
  }, [monitor]);

  return {
    trackRender,
    trackMetric,
    getStatus
  };
}

// 전역 인스턴스 내보내기
export const qualityMonitor = QualityMonitor.getInstance();
