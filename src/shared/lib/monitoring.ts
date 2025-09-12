/**
 * 운영 모니터링 및 성능 추적 시스템
 * CLAUDE.md Part 4.5 옵저버빌리티 원칙 준수
 * $300 사건 재발방지를 위한 실시간 모니터링
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: Record<string, any>;
}

interface ErrorMetric {
  error: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ApiMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  retryCount?: number;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorMetric[] = [];
  private apiCalls: ApiMetric[] = [];
  private maxStorageSize = 1000;
  
  // 성능 메트릭 추적
  trackPerformance(name: string, value: number, context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      context
    };
    
    this.metrics.push(metric);
    this.enforceStorageLimit(this.metrics, this.maxStorageSize);
    
    // 임계값 초과 시 경고
    if (this.isPerformanceCritical(name, value)) {
      console.warn(`🚨 성능 임계값 초과: ${name} = ${value}ms`);
      
      if (name === 'api_response_time' && value > 10000) {
        console.error('💥 API 응답시간 10초 초과 - 잠재적 무한루프 감지!');
      }
    }
  }
  
  // 에러 추적 (민감정보 제외)
  trackError(error: Error | string, context: Record<string, any>, severity: ErrorMetric['severity'] = 'medium') {
    const errorMetric: ErrorMetric = {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? this.sanitizeStack(error.stack) : undefined,
      context: this.sanitizeContext(context),
      timestamp: Date.now(),
      severity
    };
    
    this.errors.push(errorMetric);
    this.enforceStorageLimit(this.errors, this.maxStorageSize);
    
    // 심각도별 로깅
    if (severity === 'critical') {
      console.error('🔥 CRITICAL ERROR:', errorMetric);
    } else if (severity === 'high') {
      console.error('⚠️ HIGH SEVERITY:', errorMetric);
    }
  }
  
  // API 호출 추적
  trackApiCall(endpoint: string, method: string, statusCode: number, duration: number, retryCount?: number) {
    const apiMetric: ApiMetric = {
      endpoint: this.sanitizeEndpoint(endpoint),
      method,
      statusCode,
      duration,
      timestamp: Date.now(),
      retryCount
    };
    
    this.apiCalls.push(apiMetric);
    this.enforceStorageLimit(this.apiCalls, this.maxStorageSize);
    
    // $300 사건 방지: 동일 API 연속 호출 감지
    if (this.detectSuspiciousApiPattern(endpoint)) {
      console.error('💸 의심스러운 API 호출 패턴 감지! 비용 폭탄 위험!');
      console.error(`📊 최근 1분간 ${endpoint} 호출 횟수: ${this.getRecentApiCallCount(endpoint, 60000)}`);
    }
  }
  
  // 메모리 사용량 추적
  trackMemoryUsage() {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory;
      this.trackPerformance('memory_used_mb', Math.round(memory.usedJSHeapSize / 1024 / 1024));
      this.trackPerformance('memory_total_mb', Math.round(memory.totalJSHeapSize / 1024 / 1024));
      this.trackPerformance('memory_limit_mb', Math.round(memory.jsHeapSizeLimit / 1024 / 1024));
      
      // 메모리 누수 감지
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
        this.trackError('메모리 사용량이 90% 초과 - 메모리 누수 의심', { 
          usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
        }, 'high');
      }
    }
  }
  
  // 테스트용 메모리 추적 (환경 체크 우회)
  trackMemoryUsageForTest(memoryInfo: { usedJSHeapSize: number; jsHeapSizeLimit: number }) {
    this.trackPerformance('memory_used_mb', Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024));
    this.trackPerformance('memory_limit_mb', Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024));
    
    // 메모리 누수 감지
    if (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit > 0.9) {
      this.trackError('메모리 사용량이 90% 초과 - 메모리 누수 의심', { 
        usedMB: Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024),
        limitMB: Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)
      }, 'high');
    }
  }
  
  // Core Web Vitals 추적
  trackWebVitals() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          this.trackPerformance('lcp', Math.round(lastEntry.startTime));
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.trackPerformance('cls', Math.round(clsValue * 1000) / 1000);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      
      // INP (Interaction to Next Paint) 대용 - FID
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          this.trackPerformance('fid', Math.round(entry.processingStart - entry.startTime));
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    }
  }
  
  // 대시보드 데이터 생성
  generateDashboard() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    return {
      summary: {
        total_errors: this.errors.length,
        critical_errors: this.errors.filter(e => e.severity === 'critical').length,
        total_api_calls: this.apiCalls.length,
        avg_response_time: this.getAverageResponseTime(oneHourAgo),
        error_rate: this.getErrorRate(oneHourAgo)
      },
      recent_errors: this.errors
        .filter(e => e.timestamp > oneHourAgo)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10),
      performance_trends: this.getPerformanceTrends(['api_response_time', 'memory_used_mb', 'lcp'], oneHourAgo),
      api_patterns: this.analyzeApiPatterns(oneHourAgo)
    };
  }
  
  // 민감정보 제거
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'jwt'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // 민감한 경로나 정보 제거
    return stack
      .split('\n')
      .map(line => line.replace(/\/home\/[^\/]+/g, '/home/[USER]'))
      .join('\n');
  }
  
  private sanitizeEndpoint(endpoint: string): string {
    // 쿼리 파라미터나 민감한 정보 제거
    return endpoint.split('?')[0].replace(/\/[0-9a-f-]{36}/g, '/[UUID]');
  }
  
  private isPerformanceCritical(name: string, value: number): boolean {
    const thresholds: Record<string, number> = {
      'api_response_time': 5000,  // 5초
      'memory_used_mb': 500,      // 500MB
      'lcp': 4000,               // 4초
      'fid': 300,                // 300ms
      'cls': 0.25                // CLS 임계값
    };
    
    return thresholds[name] ? value > thresholds[name] : false;
  }
  
  private detectSuspiciousApiPattern(endpoint: string): boolean {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentCalls = this.getRecentApiCallCount(endpoint, 60000);
    
    // 1분에 10회 이상 호출 시 의심
    return recentCalls > 10;
  }
  
  private getRecentApiCallCount(endpoint: string, timeWindow: number): number {
    const cutoff = Date.now() - timeWindow;
    return this.apiCalls.filter(call => 
      call.endpoint === this.sanitizeEndpoint(endpoint) && call.timestamp > cutoff
    ).length;
  }
  
  private getAverageResponseTime(since: number): number {
    const recentCalls = this.apiCalls.filter(call => call.timestamp > since);
    if (recentCalls.length === 0) return 0;
    
    const totalTime = recentCalls.reduce((sum, call) => sum + call.duration, 0);
    return Math.round(totalTime / recentCalls.length);
  }
  
  private getErrorRate(since: number): number {
    const recentCalls = this.apiCalls.filter(call => call.timestamp > since);
    const errorCalls = recentCalls.filter(call => call.statusCode >= 400);
    
    return recentCalls.length > 0 ? Math.round((errorCalls.length / recentCalls.length) * 100) : 0;
  }
  
  private getPerformanceTrends(metrics: string[], since: number): Record<string, number[]> {
    const trends: Record<string, number[]> = {};
    
    for (const metric of metrics) {
      const recentMetrics = this.metrics
        .filter(m => m.name === metric && m.timestamp > since)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(m => m.value);
      
      trends[metric] = recentMetrics.slice(-20); // 최근 20개 데이터포인트
    }
    
    return trends;
  }
  
  private analyzeApiPatterns(since: number): { endpoint: string; count: number; avgDuration: number }[] {
    const recentCalls = this.apiCalls.filter(call => call.timestamp > since);
    const patterns = new Map<string, { count: number; totalDuration: number }>();
    
    for (const call of recentCalls) {
      const existing = patterns.get(call.endpoint) || { count: 0, totalDuration: 0 };
      patterns.set(call.endpoint, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + call.duration
      });
    }
    
    return Array.from(patterns.entries()).map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      avgDuration: Math.round(data.totalDuration / data.count)
    }));
  }
  
  private enforceStorageLimit<T>(array: T[], limit: number): void {
    if (array.length > limit) {
      array.splice(0, array.length - limit);
    }
  }
}

// 전역 모니터링 인스턴스
export const monitoring = new MonitoringService();

// 자동 메모리 추적 (5초마다)
if (typeof window !== 'undefined') {
  let memoryTrackingInterval: NodeJS.Timeout;
  
  const startMemoryTracking = () => {
    memoryTrackingInterval = setInterval(() => {
      monitoring.trackMemoryUsage();
    }, 5000);
  };
  
  const stopMemoryTracking = () => {
    if (memoryTrackingInterval) {
      clearInterval(memoryTrackingInterval);
    }
  };
  
  // 페이지 로드 시 자동 시작
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startMemoryTracking();
      monitoring.trackWebVitals();
    });
  } else {
    startMemoryTracking();
    monitoring.trackWebVitals();
  }
  
  // 페이지 언로드 시 정리
  window.addEventListener('beforeunload', stopMemoryTracking);
}

// React 컴포넌트에서 사용할 모니터링 훅
export function useMonitoring() {
  return {
    trackPerformance: monitoring.trackPerformance.bind(monitoring),
    trackError: monitoring.trackError.bind(monitoring),
    trackApiCall: monitoring.trackApiCall.bind(monitoring),
    generateDashboard: monitoring.generateDashboard.bind(monitoring)
  };
}