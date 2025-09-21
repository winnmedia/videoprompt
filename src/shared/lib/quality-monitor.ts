import { logger } from './logger';

/**
 * 실시간 품질 모니터링 시스템
 * - 테스트 실행 모니터링
 * - 성능 지표 추적
 * - 이상 상황 감지 및 알림
 */

export interface QualityMetric {
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  context?: Record<string, any>;
}

export interface TestExecutionEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'pass' | 'fail' | 'skip' | 'complete';
  testName: string;
  duration?: number;
  error?: string;
  category: 'unit' | 'integration' | 'e2e' | 'mutation';
}

export interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // minutes
  channels: ('slack' | 'email' | 'webhook')[];
}

class QualityMonitor {
  private metrics: QualityMetric[] = [];
  private testEvents: TestExecutionEvent[] = [];
  private alerts: AlertConfig[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private subscribers: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeDefaultAlerts();
    this.startMetricsCollection();
  }

  /**
   * 기본 알림 규칙 설정
   */
  private initializeDefaultAlerts(): void {
    this.alerts = [
      {
        id: 'test-failure-rate',
        name: 'Test Failure Rate Alert',
        metric: 'test_failure_rate',
        threshold: 10, // 10% 이상 실패 시
        operator: 'gte',
        severity: 'high',
        cooldown: 5,
        channels: ['slack', 'email']
      },
      {
        id: 'flaky-test-detection',
        name: 'Flaky Test Detection',
        metric: 'flaky_test_rate',
        threshold: 5, // 5% 이상 플래키 테스트
        operator: 'gte',
        severity: 'medium',
        cooldown: 30,
        channels: ['slack']
      },
      {
        id: 'coverage-regression',
        name: 'Coverage Regression Alert',
        metric: 'coverage_percentage',
        threshold: 85, // 85% 미만
        operator: 'lt',
        severity: 'medium',
        cooldown: 60,
        channels: ['slack']
      },
      {
        id: 'infinite-loop-pattern',
        name: '$300 Incident Prevention',
        metric: 'api_call_frequency',
        threshold: 100, // 분당 100회 이상
        operator: 'gte',
        severity: 'critical',
        cooldown: 1,
        channels: ['slack', 'email', 'webhook']
      },
      {
        id: 'mutation-score-drop',
        name: 'Mutation Score Drop',
        metric: 'mutation_score',
        threshold: 75, // 75% 미만
        operator: 'lt',
        severity: 'medium',
        cooldown: 120,
        channels: ['slack']
      },
      {
        id: 'performance-regression',
        name: 'Performance Regression',
        metric: 'test_execution_time',
        threshold: 300, // 5분 이상
        operator: 'gte',
        severity: 'low',
        cooldown: 30,
        channels: ['slack']
      }
    ];
  }

  /**
   * 메트릭 수집 시작
   */
  private startMetricsCollection(): void {
    // 1분마다 메트릭 수집
    setInterval(() => {
      this.collectTestMetrics();
      this.collectPerformanceMetrics();
      this.checkAlerts();
    }, 60000);

    // 실시간 이벤트 처리
    this.subscribeToTestEvents();
  }

  /**
   * 테스트 메트릭 수집
   */
  private collectTestMetrics(): void {
    const now = Date.now();
    const recentEvents = this.testEvents.filter(
      event => now - event.timestamp < 3600000 // 최근 1시간
    );

    if (recentEvents.length === 0) return;

    // 실패율 계산
    const failedTests = recentEvents.filter(e => e.type === 'fail').length;
    const totalTests = recentEvents.filter(e => e.type === 'complete').length;
    const failureRate = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;

    this.recordMetric({
      timestamp: now,
      metric: 'test_failure_rate',
      value: failureRate,
      threshold: 10,
      status: failureRate >= 10 ? 'critical' : failureRate >= 5 ? 'warning' : 'normal',
      context: { failedTests, totalTests }
    });

    // 플래키 테스트 감지
    const flakyTests = this.detectFlakyTests(recentEvents);
    const flakyRate = totalTests > 0 ? (flakyTests.length / totalTests) * 100 : 0;

    this.recordMetric({
      timestamp: now,
      metric: 'flaky_test_rate',
      value: flakyRate,
      threshold: 5,
      status: flakyRate >= 5 ? 'warning' : 'normal',
      context: { flakyTests: flakyTests.map(t => t.testName) }
    });

    // 테스트 실행 시간
    const avgDuration = recentEvents
      .filter(e => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0) / recentEvents.length;

    this.recordMetric({
      timestamp: now,
      metric: 'test_execution_time',
      value: avgDuration,
      threshold: 300000, // 5분
      status: avgDuration >= 300000 ? 'warning' : 'normal',
      context: { avgDuration, eventCount: recentEvents.length }
    });
  }

  /**
   * 성능 메트릭 수집
   */
  private collectPerformanceMetrics(): void {
    const now = Date.now();

    // 메모리 사용량
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.recordMetric({
        timestamp: now,
        metric: 'memory_usage_mb',
        value: memUsage.heapUsed / 1024 / 1024,
        threshold: 512, // 512MB
        status: memUsage.heapUsed > 512 * 1024 * 1024 ? 'warning' : 'normal',
        context: memUsage
      });
    }

    // CPU 사용량 (가상 메트릭)
    const cpuUsage = Math.random() * 100; // 실제 구현에서는 실제 CPU 모니터링
    this.recordMetric({
      timestamp: now,
      metric: 'cpu_usage_percent',
      value: cpuUsage,
      threshold: 80,
      status: cpuUsage >= 80 ? 'critical' : cpuUsage >= 60 ? 'warning' : 'normal'
    });
  }

  /**
   * 플래키 테스트 감지
   */
  private detectFlakyTests(events: TestExecutionEvent[]): TestExecutionEvent[] {
    const testResults = new Map<string, { passes: number; fails: number }>();

    events.forEach(event => {
      if (event.type === 'pass' || event.type === 'fail') {
        const current = testResults.get(event.testName) || { passes: 0, fails: 0 };
        if (event.type === 'pass') current.passes++;
        if (event.type === 'fail') current.fails++;
        testResults.set(event.testName, current);
      }
    });

    const flakyTests: TestExecutionEvent[] = [];
    testResults.forEach((result, testName) => {
      const total = result.passes + result.fails;
      if (total >= 3 && result.fails > 0 && result.passes > 0) {
        // 최소 3번 실행되고, 성공과 실패가 모두 있으면 플래키
        flakyTests.push({
          id: `flaky-${Date.now()}`,
          timestamp: Date.now(),
          type: 'fail',
          testName,
          category: 'unit',
          error: `Flaky test detected: ${result.passes}/${total} success rate`
        });
      }
    });

    return flakyTests;
  }

  /**
   * 메트릭 기록
   */
  public recordMetric(metric: QualityMetric): void {
    this.metrics.push(metric);

    // 메트릭 히스토리 제한 (최근 24시간)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp > dayAgo);

    // 실시간 알림 체크
    this.checkMetricAlert(metric);

    // 구독자들에게 알림
    this.notifySubscribers('metric', metric);
  }

  /**
   * 테스트 이벤트 기록
   */
  public recordTestEvent(event: TestExecutionEvent): void {
    this.testEvents.push(event);

    // 이벤트 히스토리 제한 (최근 24시간)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.testEvents = this.testEvents.filter(e => e.timestamp > dayAgo);

    // 즉시 이상 패턴 감지
    this.detectAnomalousPatterns(event);

    // 구독자들에게 알림
    this.notifySubscribers('test-event', event);
  }

  /**
   * 이상 패턴 감지
   */
  private detectAnomalousPatterns(event: TestExecutionEvent): void {
    const now = Date.now();
    const recentEvents = this.testEvents.filter(
      e => now - e.timestamp < 60000 && e.testName.includes('auth')
    );

    // $300 사건 패턴: 1분 내 auth 관련 테스트 과다 실행
    if (recentEvents.length > 50) {
      this.recordMetric({
        timestamp: now,
        metric: 'api_call_frequency',
        value: recentEvents.length,
        threshold: 100,
        status: 'critical',
        context: {
          pattern: 'auth_over_activity',
          recentEvents: recentEvents.length,
          testName: event.testName
        }
      });
    }
  }

  /**
   * 알림 규칙 체크
   */
  private checkAlerts(): void {
    this.alerts.forEach(alert => {
      const recentMetrics = this.metrics.filter(
        m => m.metric === alert.metric && Date.now() - m.timestamp < 300000 // 최근 5분
      );

      if (recentMetrics.length === 0) return;

      const latestMetric = recentMetrics[recentMetrics.length - 1];
      this.checkMetricAlert(latestMetric, alert);
    });
  }

  /**
   * 특정 메트릭 알림 체크
   */
  private checkMetricAlert(metric: QualityMetric, alertConfig?: AlertConfig): void {
    const alerts = alertConfig ? [alertConfig] : this.alerts.filter(a => a.metric === metric.metric);

    alerts.forEach(alert => {
      const shouldAlert = this.evaluateCondition(metric.value, alert.threshold, alert.operator);

      if (shouldAlert && this.canSendAlert(alert.id, alert.cooldown)) {
        this.sendAlert(alert, metric);
        this.lastAlertTimes.set(alert.id, Date.now());
      }
    });
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * 알림 쿨다운 체크
   */
  private canSendAlert(alertId: string, cooldownMinutes: number): boolean {
    const lastAlert = this.lastAlertTimes.get(alertId);
    if (!lastAlert) return true;

    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert > cooldownMs;
  }

  /**
   * 알림 발송
   */
  private async sendAlert(alert: AlertConfig, metric: QualityMetric): Promise<void> {
    const alertData = {
      alert,
      metric,
      timestamp: Date.now(),
      context: metric.context
    };

    // 각 채널로 알림 발송
    for (const channel of alert.channels) {
      try {
        await this.sendToChannel(channel, alertData);
      } catch (error) {
        logger.error(`Failed to send alert to ${channel}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    logger.debug(`🚨 Quality Alert [${alert.severity.toUpperCase()}]: ${alert.name}`);
    logger.debug(`Metric: ${metric.metric} = ${metric.value} (threshold: ${alert.threshold})`);
  }

  /**
   * 채널별 알림 발송
   */
  private async sendToChannel(channel: string, alertData: any): Promise<void> {
    switch (channel) {
      case 'slack':
        await this.sendSlackAlert(alertData);
        break;
      case 'email':
        await this.sendEmailAlert(alertData);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alertData);
        break;
    }
  }

  /**
   * Slack 알림
   */
  private async sendSlackAlert(alertData: any): Promise<void> {
    const { alert, metric } = alertData;
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const message = {
      channel: '#quality-alerts',
      username: 'Quality Monitor',
      icon_emoji: ':warning:',
      attachments: [{
        color,
        title: `${emoji} ${alert.name}`,
        fields: [
          { title: 'Metric', value: metric.metric, short: true },
          { title: 'Value', value: metric.value.toString(), short: true },
          { title: 'Threshold', value: alert.threshold.toString(), short: true },
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true }
        ],
        footer: 'VideoPlanet Quality Monitor',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // 실제 구현에서는 Slack Webhook URL 사용
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    }
  }

  /**
   * 이메일 알림
   */
  private async sendEmailAlert(alertData: any): Promise<void> {
    // 실제 구현에서는 이메일 서비스 사용
    logger.info('📧 Email alert would be sent:', alertData);
  }

  /**
   * 웹훅 알림
   */
  private async sendWebhookAlert(alertData: any): Promise<void> {
    if (process.env.QUALITY_WEBHOOK_URL) {
      await fetch(process.env.QUALITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
    }
  }

  /**
   * 심각도별 색상
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#ffcc00';
      case 'low': return 'good';
      default: return '#cccccc';
    }
  }

  /**
   * 심각도별 이모지
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📊';
      case 'low': return 'ℹ️';
      default: return '🔍';
    }
  }

  /**
   * 테스트 이벤트 구독
   */
  private subscribeToTestEvents(): void {
    // Vitest 이벤트 리스너 (실제 구현에서는 Vitest API 사용)
    if (typeof process !== 'undefined' && process.on) {
      process.on('test:start', (testName: string) => {
        this.recordTestEvent({
          id: `test-${Date.now()}`,
          timestamp: Date.now(),
          type: 'start',
          testName,
          category: 'unit'
        });
      });

      process.on('test:pass', (testName: string, duration: number) => {
        this.recordTestEvent({
          id: `test-${Date.now()}`,
          timestamp: Date.now(),
          type: 'pass',
          testName,
          duration,
          category: 'unit'
        });
      });

      process.on('test:fail', (testName: string, error: string) => {
        this.recordTestEvent({
          id: `test-${Date.now()}`,
          timestamp: Date.now(),
          type: 'fail',
          testName,
          error,
          category: 'unit'
        });
      });
    }
  }

  /**
   * 이벤트 구독자 추가
   */
  public subscribe(event: string, callback: Function): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(callback);
  }

  /**
   * 구독자들에게 알림
   */
  private notifySubscribers(event: string, data: any): void {
    const callbacks = this.subscribers.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in subscriber callback for ${event}:`, error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * 대시보드 데이터 생성
   */
  public getDashboardData(): any {
    const now = Date.now();
    const hourAgo = now - 3600000;

    const recentMetrics = this.metrics.filter(m => m.timestamp > hourAgo);
    const recentEvents = this.testEvents.filter(e => e.timestamp > hourAgo);

    return {
      summary: {
        totalTests: recentEvents.filter(e => e.type === 'complete').length,
        failedTests: recentEvents.filter(e => e.type === 'fail').length,
        avgExecutionTime: this.calculateAverageExecutionTime(recentEvents),
        alertsTriggered: this.lastAlertTimes.size
      },
      metrics: recentMetrics,
      events: recentEvents.slice(-50), // 최근 50개 이벤트
      alerts: this.alerts,
      trends: this.calculateTrends(recentMetrics)
    };
  }

  /**
   * 평균 실행 시간 계산
   */
  private calculateAverageExecutionTime(events: TestExecutionEvent[]): number {
    const durationsEvents = events.filter(e => e.duration);
    if (durationsEvents.length === 0) return 0;

    const total = durationsEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    return total / durationsEvents.length;
  }

  /**
   * 트렌드 계산
   */
  private calculateTrends(metrics: QualityMetric[]): Record<string, any> {
    const trends: Record<string, any> = {};

    const metricTypes = [...new Set(metrics.map(m => m.metric))];
    metricTypes.forEach(metricType => {
      const metricData = metrics
        .filter(m => m.metric === metricType)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (metricData.length >= 2) {
        const first = metricData[0].value;
        const last = metricData[metricData.length - 1].value;
        const change = ((last - first) / first) * 100;

        trends[metricType] = {
          change: change.toFixed(2),
          direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
          current: last,
          previous: first
        };
      }
    });

    return trends;
  }
}

// 싱글톤 인스턴스
export const qualityMonitor = new QualityMonitor();

// 개발 환경에서만 콘솔 출력
if (process.env.NODE_ENV === 'development') {
  qualityMonitor.subscribe('metric', (metric: QualityMetric) => {
    if (metric.status !== 'normal') {
      logger.debug(`📊 Quality Metric Alert: ${metric.metric} = ${metric.value}`);
    }
  });

  qualityMonitor.subscribe('test-event', (event: TestExecutionEvent) => {
    if (event.type === 'fail') {
      logger.debug(`❌ Test Failed: ${event.testName}`);
    }
  });
}