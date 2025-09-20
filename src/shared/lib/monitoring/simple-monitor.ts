/**
 * 단순화된 모니터링 시스템
 * CLAUDE.md 원칙 준수: YAGNI, 단순성, 통합성
 *
 * 핵심 목표:
 * - $300 사건 재발 방지 (API 호출 추적)
 * - 핵심 성능 지표만 추적 (Core Web Vitals)
 * - 개발 환경에서만 동작
 */

interface SimpleMetric {
  name: string;
  value: number;
  timestamp: number;
  critical: boolean; // $300 사건 방지용 critical flag
}

interface ApiCallRecord {
  endpoint: string;
  count: number;
  lastCall: number;
  cost: number; // $300 사건 방지용
}

/**
 * 단순한 모니터링 시스템
 * 개발 환경에서만 동작하는 최소한의 모니터링
 */
class SimpleMonitor {
  private static instance: SimpleMonitor;
  private apiCalls = new Map<string, ApiCallRecord>();
  private metrics: SimpleMetric[] = [];
  private maxRecords = 100; // 메모리 사용량 제한

  static getInstance(): SimpleMonitor {
    if (!SimpleMonitor.instance) {
      SimpleMonitor.instance = new SimpleMonitor();
    }
    return SimpleMonitor.instance;
  }

  /**
   * API 호출 추적 ($300 사건 방지)
   */
  trackApiCall(endpoint: string, cost = 0.001): void {
    if (process.env.NODE_ENV !== 'development') return;

    const existing = this.apiCalls.get(endpoint);
    const record: ApiCallRecord = {
      endpoint,
      count: (existing?.count || 0) + 1,
      lastCall: Date.now(),
      cost: (existing?.cost || 0) + cost
    };

    // 🚨 $300 사건 방지: 임계값 체크
    if (record.count > 10 && Date.now() - record.lastCall < 60000) {
      console.error(`🚨 API 호출 급증 감지: ${endpoint} (${record.count}회/분)`);
    }

    if (record.cost > 1.0) {
      console.error(`🚨 API 비용 임계값 초과: ${endpoint} ($${record.cost.toFixed(3)})`);
    }

    this.apiCalls.set(endpoint, record);
  }

  /**
   * 성능 메트릭 추가
   */
  addMetric(name: string, value: number, critical = false): void {
    if (process.env.NODE_ENV !== 'development') return;

    const metric: SimpleMetric = {
      name,
      value,
      timestamp: Date.now(),
      critical
    };

    this.metrics.push(metric);

    // 메모리 사용량 제한
    if (this.metrics.length > this.maxRecords) {
      this.metrics = this.metrics.slice(-this.maxRecords);
    }

    // Critical 메트릭 즉시 로깅
    if (critical) {
      console.warn(`⚠️ Critical 메트릭: ${name} = ${value}`);
    }
  }

  /**
   * 간단한 리포트 생성
   */
  getReport(): {
    apiCalls: ApiCallRecord[];
    criticalMetrics: SimpleMetric[];
    totalCost: number;
  } {
    const apiCalls = Array.from(this.apiCalls.values());
    const criticalMetrics = this.metrics.filter(m => m.critical);
    const totalCost = apiCalls.reduce((sum, call) => sum + call.cost, 0);

    return {
      apiCalls,
      criticalMetrics,
      totalCost
    };
  }

  /**
   * 디버그 정보 출력
   */
  logReport(): void {
    if (process.env.NODE_ENV !== 'development') return;

    const report = this.getReport();

    console.group('📊 Simple Monitor Report');
    console.log('API Calls:', report.apiCalls);
    console.log('Critical Metrics:', report.criticalMetrics);
    console.log('Total Cost:', `$${report.totalCost.toFixed(3)}`);
    console.groupEnd();
  }

  /**
   * 모니터링 데이터 초기화
   */
  reset(): void {
    this.apiCalls.clear();
    this.metrics = [];
  }
}

/**
 * 간편한 함수 인터페이스
 */
export const simpleMonitor = SimpleMonitor.getInstance();

export const trackApi = (endpoint: string, cost?: number) =>
  simpleMonitor.trackApiCall(endpoint, cost);

export const trackMetric = (name: string, value: number, critical = false) =>
  simpleMonitor.addMetric(name, value, critical);

export const getMonitorReport = () => simpleMonitor.getReport();

export const logMonitorReport = () => simpleMonitor.logReport();

/**
 * 개발 환경에서 전역 접근 가능하도록 설정
 */
if (process.env.NODE_ENV === 'development') {
  (globalThis as any).__SIMPLE_MONITOR__ = simpleMonitor;
}