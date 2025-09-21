import type { PerformanceMetrics, PerformanceBudget, CoreWebVital, APIPerformanceMetric } from '@/entities/performance'
import { logger } from '@/shared/lib/logger';
import { checkBudgetViolation } from '@/entities/performance'

export type AlertLevel = 'info' | 'warning' | 'critical'

export interface AlertPayload {
  level: AlertLevel
  timestamp: number
  sessionId: string
  pathname: string
  violations: string[]
  consecutiveViolations: number
  metrics: PerformanceMetrics
  suggestions?: string[]
}

export interface AlertHandler {
  (payload: AlertPayload): Promise<void>
}

export interface AlertHandlers {
  webhook?: AlertHandler
  slack?: AlertHandler
  email?: AlertHandler
}

export interface AlertThresholds {
  criticalViolationCount: number
  warningViolationCount: number
  cooldownPeriod: number // milliseconds
  consecutiveViolationLimit: number
}

export interface PerformanceAlertsConfig {
  budget: PerformanceBudget
  handlers: AlertHandlers
  thresholds: AlertThresholds
}

export interface ViolationStats {
  totalViolations: number
  violationsByMetric: Record<string, number>
  consecutiveViolations: number
  lastViolationTime: number | null
}

/**
 * 성능 모니터링 실시간 알림 시스템
 *
 * 성능 예산 위반을 감지하고 설정된 핸들러를 통해 알림을 발송합니다.
 * 쿨다운 기간, 연속 위반 추적, 최적화 제안 생성 등의 기능을 제공합니다.
 */
export class PerformanceAlertsSystem {
  private config: PerformanceAlertsConfig
  private violationHistory: Map<string, number> = new Map() // pathname -> lastAlertTime
  private consecutiveViolations = 0
  private stats: ViolationStats = {
    totalViolations: 0,
    violationsByMetric: {},
    consecutiveViolations: 0,
    lastViolationTime: null
  }

  constructor(config: PerformanceAlertsConfig) {
    this.config = config
  }

  /**
   * 성능 메트릭의 예산 위반을 확인합니다.
   */
  checkBudgetViolations(metrics: PerformanceMetrics): { violated: boolean; violations: string[] } {
    return checkBudgetViolation(metrics, this.config.budget)
  }

  /**
   * 성능 메트릭을 처리하고 필요시 알림을 발송합니다.
   */
  async processMetrics(metrics: PerformanceMetrics): Promise<void> {
    if (!this.config.budget.enableAlerts) {
      return
    }

    const violationResult = this.checkBudgetViolations(metrics)

    if (!violationResult.violated) {
      // 위반이 없으면 연속 위반 카운터 리셋
      this.consecutiveViolations = 0
      return
    }

    // 통계 업데이트
    this.updateStats(violationResult.violations)

    // 쿨다운 기간 확인
    if (this.isInCooldownPeriod(metrics.pathname)) {
      return
    }

    // 연속 위반 카운트 증가
    this.consecutiveViolations++
    this.stats.consecutiveViolations = this.consecutiveViolations

    // 알림 레벨 결정
    const alertLevel = this.determineAlertLevel(violationResult.violations.length)

    // 알림 페이로드 생성
    const alertPayload: AlertPayload = {
      level: alertLevel,
      timestamp: Date.now(),
      sessionId: metrics.sessionId,
      pathname: metrics.pathname,
      violations: violationResult.violations,
      consecutiveViolations: this.consecutiveViolations,
      metrics,
      suggestions: this.generateOptimizationSuggestions(metrics)
    }

    // 알림 발송
    await this.sendAlerts(alertPayload)

    // 쿨다운 기간 시작
    this.violationHistory.set(metrics.pathname, Date.now())
  }

  /**
   * 쿨다운 기간 내인지 확인합니다.
   */
  private isInCooldownPeriod(pathname: string): boolean {
    const lastAlertTime = this.violationHistory.get(pathname)
    if (!lastAlertTime) {
      return false
    }

    const timeSinceLastAlert = Date.now() - lastAlertTime
    return timeSinceLastAlert < this.config.thresholds.cooldownPeriod
  }

  /**
   * 위반 횟수에 따라 알림 레벨을 결정합니다.
   */
  private determineAlertLevel(violationCount: number): AlertLevel {
    if (this.consecutiveViolations >= this.config.thresholds.consecutiveViolationLimit ||
        violationCount >= this.config.thresholds.criticalViolationCount) {
      return 'critical'
    }

    if (violationCount >= this.config.thresholds.warningViolationCount) {
      return 'warning'
    }

    return 'info'
  }

  /**
   * 통계 정보를 업데이트합니다.
   */
  private updateStats(violations: string[]): void {
    this.stats.totalViolations += violations.length
    this.stats.lastViolationTime = Date.now()

    violations.forEach(violation => {
      let metricType: string

      if (violation.includes('LCP')) metricType = 'LCP'
      else if (violation.includes('INP')) metricType = 'INP'
      else if (violation.includes('CLS')) metricType = 'CLS'
      else if (violation.includes('API')) metricType = 'API'
      else metricType = 'UNKNOWN'

      this.stats.violationsByMetric[metricType] = (this.stats.violationsByMetric[metricType] || 0) + 1
    })
  }

  /**
   * 설정된 모든 핸들러로 알림을 발송합니다.
   */
  private async sendAlerts(payload: AlertPayload): Promise<void> {
    const { handlers } = this.config
    const alertPromises: Promise<void>[] = []

    // 각 핸들러를 비동기로 호출
    if (handlers.webhook) {
      alertPromises.push(
        handlers.webhook(payload).catch(error => {
          logger.error('[PerformanceAlerts] Webhook handler failed:', error instanceof Error ? error : new Error(String(error)))
        })
      )
    }

    if (handlers.slack) {
      alertPromises.push(
        handlers.slack(payload).catch(error => {
          logger.error('[PerformanceAlerts] Slack handler failed:', error instanceof Error ? error : new Error(String(error)))
        })
      )
    }

    if (handlers.email) {
      alertPromises.push(
        handlers.email(payload).catch(error => {
          logger.error('[PerformanceAlerts] Email handler failed:', error instanceof Error ? error : new Error(String(error)))
        })
      )
    }

    // 모든 핸들러의 완료를 기다림 (실패는 무시)
    await Promise.allSettled(alertPromises)
  }

  /**
   * 성능 최적화 제안을 생성합니다.
   */
  generateOptimizationSuggestions(metrics?: PerformanceMetrics): string[] {
    const suggestions: string[] = []

    if (metrics) {
      // Core Web Vitals별 제안
      metrics.coreWebVitals.forEach(cwv => {
        const budgetKey = cwv.name.toLowerCase() as keyof PerformanceBudget;
        const budgetValue = this.config.budget[budgetKey];
        if (typeof budgetValue === 'number' && cwv.value > budgetValue) {
          suggestions.push(...this.getWebVitalSuggestions(cwv))
        }
      })

      // API 성능별 제안
      metrics.apiMetrics.forEach(api => {
        if (api.responseTime > this.config.budget.apiResponseTime) {
          suggestions.push(...this.getApiSuggestions(api))
        }
      })
    } else {
      // 통계 기반 일반적인 제안
      Object.keys(this.stats.violationsByMetric).forEach(metric => {
        if (this.stats.violationsByMetric[metric] > 0) {
          suggestions.push(...this.getGeneralSuggestions(metric))
        }
      })
    }

    return [...new Set(suggestions)] // 중복 제거
  }

  /**
   * Core Web Vital별 최적화 제안을 반환합니다.
   */
  private getWebVitalSuggestions(cwv: CoreWebVital): string[] {
    switch (cwv.name) {
      case 'LCP':
        return [
          'LCP optimization: 이미지 최적화 및 압축',
          'LCP optimization: CDN 사용으로 리소스 전달 속도 향상',
          'LCP optimization: 중요한 리소스 preload 적용',
          'LCP optimization: 서버 응답 시간 개선'
        ]

      case 'INP':
        return [
          'INP optimization: JavaScript 번들 크기 최소화',
          'INP optimization: 긴 작업(Long Tasks) 분할',
          'INP optimization: 이벤트 핸들러 최적화',
          'INP optimization: 불필요한 렌더링 방지 (React.memo, useMemo 활용)'
        ]

      case 'CLS':
        return [
          'CLS optimization: 이미지와 동영상에 명시적 크기 지정',
          'CLS optimization: 동적 콘텐츠 위한 공간 예약',
          'CLS optimization: 웹 폰트 로딩 최적화 (font-display: swap)',
          'CLS optimization: 광고와 임베드 콘텐츠 크기 안정화'
        ]

      default:
        return []
    }
  }

  /**
   * API 성능별 최적화 제안을 반환합니다.
   */
  private getApiSuggestions(api: APIPerformanceMetric): string[] {
    const suggestions = [
      'API performance: 응답 캐싱 구현',
      'API performance: 데이터베이스 쿼리 최적화',
      'API performance: 페이지네이션 구현',
      'API performance: 병렬 요청 처리 개선'
    ]

    if (api.responseTime > 2000) {
      suggestions.push(
        'API performance: 서버 인프라 스케일링 검토',
        'API performance: CDN을 통한 엣지 캐싱 적용'
      )
    }

    return suggestions
  }

  /**
   * 메트릭 유형별 일반적인 제안을 반환합니다.
   */
  private getGeneralSuggestions(metricType: string): string[] {
    switch (metricType) {
      case 'LCP':
        return ['LCP optimization: 페이지 로딩 성능 전반적 검토 필요']
      case 'INP':
        return ['INP optimization: 사용자 상호작용 응답성 개선 필요']
      case 'CLS':
        return ['CLS optimization: 레이아웃 안정성 검토 필요']
      case 'API':
        return ['API performance: 백엔드 성능 최적화 검토 필요']
      default:
        return ['Performance: 전반적인 성능 점검 필요']
    }
  }

  /**
   * 현재 위반 통계를 반환합니다.
   */
  getViolationStats(): ViolationStats {
    return { ...this.stats }
  }

  /**
   * 통계를 초기화합니다.
   */
  resetStats(): void {
    this.stats = {
      totalViolations: 0,
      violationsByMetric: {},
      consecutiveViolations: 0,
      lastViolationTime: null
    }
    this.consecutiveViolations = 0
    this.violationHistory.clear()
  }
}