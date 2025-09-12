import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { 
  type CoreWebVital, 
  type APIPerformanceMetric, 
  type PerformanceMetrics,
  type PerformanceBudget,
  DEFAULT_PERFORMANCE_BUDGET,
  checkBudgetViolation
} from './performance-metrics'

export interface PerformanceAlert {
  id: string
  type: 'budget-violation' | 'performance-degradation' | 'error-spike'
  severity: 'info' | 'warning' | 'error'
  message: string
  timestamp: number
  metric?: CoreWebVital | APIPerformanceMetric
  acknowledged: boolean
}

export interface PerformanceStoreState {
  // 현재 세션 데이터
  sessionId: string | null
  userId: string | null
  
  // 메트릭 데이터
  metrics: PerformanceMetrics[]
  coreWebVitals: CoreWebVital[]
  apiMetrics: APIPerformanceMetric[]
  
  // 모니터링 상태
  isMonitoring: boolean
  startTime: number | null
  
  // 성능 예산 및 알림
  budget: PerformanceBudget
  alerts: PerformanceAlert[]
  
  // 통계 및 집계 데이터
  stats: {
    totalPageViews: number
    totalApiCalls: number
    averageLCP: number
    averageINP: number
    averageCLS: number
    averageApiResponseTime: number
  }
}

export interface PerformanceStoreActions {
  // Core Web Vitals 관리
  addCoreWebVital: (metric: CoreWebVital) => void
  getCoreWebVitalsByName: (name: CoreWebVital['name']) => CoreWebVital[]
  
  // API 메트릭 관리
  addApiMetric: (metric: APIPerformanceMetric) => void
  getApiMetricsByUrl: (url: string) => APIPerformanceMetric[]
  getApiMetricsByStatus: (statusCode: number) => APIPerformanceMetric[]
  
  // 세션 관리
  setCurrentSession: (sessionId: string, userId?: string) => void
  getCurrentSessionMetrics: () => PerformanceMetrics
  
  // 모니터링 제어
  startMonitoring: () => void
  stopMonitoring: () => void
  
  // 성능 예산 및 알림
  updateBudget: (budget: PerformanceBudget) => void
  addAlert: (alert: Omit<PerformanceAlert, 'id' | 'timestamp'>) => void
  acknowledgeAlert: (alertId: string) => void
  clearAlerts: () => void
  
  // 데이터 분석
  calculateStats: () => void
  getPerformanceTrends: (timeRange: number) => {
    lcpTrend: number[]
    inpTrend: number[]
    clsTrend: number[]
    apiResponseTrend: number[]
  }
  
  // 유틸리티
  reset: () => void
  exportData: () => string
}

export type PerformanceStore = PerformanceStoreState & PerformanceStoreActions

const initialState: PerformanceStoreState = {
  sessionId: null,
  userId: null,
  metrics: [],
  coreWebVitals: [],
  apiMetrics: [],
  isMonitoring: false,
  startTime: null,
  budget: DEFAULT_PERFORMANCE_BUDGET,
  alerts: [],
  stats: {
    totalPageViews: 0,
    totalApiCalls: 0,
    averageLCP: 0,
    averageINP: 0,
    averageCLS: 0,
    averageApiResponseTime: 0
  }
}

export const usePerformanceStore = create<PerformanceStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Core Web Vitals 관리
      addCoreWebVital: (metric: CoreWebVital) => {
        set((state) => {
          const existingIndex = state.coreWebVitals.findIndex(
            cwv => cwv.id === metric.id
          )
          
          let newCoreWebVitals: CoreWebVital[]
          
          if (existingIndex >= 0) {
            // 기존 메트릭 업데이트
            newCoreWebVitals = [...state.coreWebVitals]
            newCoreWebVitals[existingIndex] = metric
          } else {
            // 새 메트릭 추가
            newCoreWebVitals = [...state.coreWebVitals, metric]
          }
          
          // 예산 위반 검사 및 알림 생성
          const budgetCheck = checkBudgetViolation({
            sessionId: state.sessionId || 'unknown',
            timestamp: Date.now(),
            pathname: metric.pathname,
            userAgent: metric.userAgent,
            coreWebVitals: [metric],
            apiMetrics: []
          }, state.budget)
          
          let newAlerts = state.alerts
          if (budgetCheck.violated && state.budget.enableAlerts) {
            const alertId = `${metric.name}-${metric.id}-${Date.now()}`
            newAlerts = [...state.alerts, {
              id: alertId,
              type: 'budget-violation',
              severity: 'error',
              message: `${metric.name} (${metric.value}) exceeds budget threshold`,
              timestamp: Date.now(),
              metric,
              acknowledged: false
            }]
          }
          
          return {
            coreWebVitals: newCoreWebVitals,
            alerts: newAlerts
          }
        })
        
        get().calculateStats()
      },

      getCoreWebVitalsByName: (name: CoreWebVital['name']) => {
        return get().coreWebVitals.filter(cwv => cwv.name === name)
      },

      // API 메트릭 관리
      addApiMetric: (metric: APIPerformanceMetric) => {
        set((state) => {
          const newApiMetrics = [...state.apiMetrics, metric]
            .sort((a, b) => a.timestamp - b.timestamp)
          
          // 예산 위반 검사
          const budgetCheck = checkBudgetViolation({
            sessionId: state.sessionId || 'unknown',
            timestamp: Date.now(),
            pathname: '/api',
            userAgent: 'api-client',
            coreWebVitals: [],
            apiMetrics: [metric]
          }, state.budget)
          
          let newAlerts = state.alerts
          if (budgetCheck.violated && state.budget.enableAlerts) {
            const alertId = `api-${metric.url}-${Date.now()}`
            newAlerts = [...state.alerts, {
              id: alertId,
              type: 'budget-violation',
              severity: 'error',
              message: `API ${metric.url} response time (${metric.responseTime}ms) exceeds budget`,
              timestamp: Date.now(),
              metric,
              acknowledged: false
            }]
          }
          
          return {
            apiMetrics: newApiMetrics,
            alerts: newAlerts
          }
        })
        
        get().calculateStats()
      },

      getApiMetricsByUrl: (url: string) => {
        return get().apiMetrics.filter(api => api.url === url)
      },

      getApiMetricsByStatus: (statusCode: number) => {
        return get().apiMetrics.filter(api => api.statusCode === statusCode)
      },

      // 세션 관리
      setCurrentSession: (sessionId: string, userId?: string) => {
        set({ sessionId, userId })
      },

      getCurrentSessionMetrics: (): PerformanceMetrics => {
        const state = get()
        return {
          sessionId: state.sessionId || 'unknown',
          userId: state.userId || undefined,
          timestamp: Date.now(),
          pathname: typeof window !== 'undefined' ? window.location.pathname : '/unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          coreWebVitals: state.coreWebVitals,
          apiMetrics: state.apiMetrics
        }
      },

      // 모니터링 제어
      startMonitoring: () => {
        set({ 
          isMonitoring: true, 
          startTime: Date.now() 
        })
      },

      stopMonitoring: () => {
        set({ 
          isMonitoring: false,
          startTime: null
        })
      },

      // 성능 예산 및 알림
      updateBudget: (budget: PerformanceBudget) => {
        set({ budget })
      },

      addAlert: (alert: Omit<PerformanceAlert, 'id' | 'timestamp'>) => {
        const newAlert: PerformanceAlert = {
          ...alert,
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        }
        
        set((state) => ({
          alerts: [...state.alerts, newAlert]
        }))
      },

      acknowledgeAlert: (alertId: string) => {
        set((state) => ({
          alerts: state.alerts.map(alert =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          )
        }))
      },

      clearAlerts: () => {
        set({ alerts: [] })
      },

      // 데이터 분석
      calculateStats: () => {
        const state = get()
        const { coreWebVitals, apiMetrics } = state
        
        const lcpMetrics = coreWebVitals.filter(cwv => cwv.name === 'LCP')
        const inpMetrics = coreWebVitals.filter(cwv => cwv.name === 'INP')
        const clsMetrics = coreWebVitals.filter(cwv => cwv.name === 'CLS')
        
        const averageLCP = lcpMetrics.length > 0 
          ? lcpMetrics.reduce((sum, m) => sum + m.value, 0) / lcpMetrics.length 
          : 0
        
        const averageINP = inpMetrics.length > 0
          ? inpMetrics.reduce((sum, m) => sum + m.value, 0) / inpMetrics.length
          : 0
        
        const averageCLS = clsMetrics.length > 0
          ? clsMetrics.reduce((sum, m) => sum + m.value, 0) / clsMetrics.length
          : 0
        
        const averageApiResponseTime = apiMetrics.length > 0
          ? apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / apiMetrics.length
          : 0
        
        set({
          stats: {
            totalPageViews: new Set(coreWebVitals.map(cwv => cwv.pathname)).size,
            totalApiCalls: apiMetrics.length,
            averageLCP,
            averageINP,
            averageCLS,
            averageApiResponseTime
          }
        })
      },

      getPerformanceTrends: (timeRange: number) => {
        const state = get()
        const cutoffTime = Date.now() - timeRange
        
        const recentMetrics = {
          lcp: state.coreWebVitals.filter(cwv => 
            cwv.name === 'LCP' && cwv.timestamp >= cutoffTime
          ),
          inp: state.coreWebVitals.filter(cwv => 
            cwv.name === 'INP' && cwv.timestamp >= cutoffTime
          ),
          cls: state.coreWebVitals.filter(cwv => 
            cwv.name === 'CLS' && cwv.timestamp >= cutoffTime
          ),
          api: state.apiMetrics.filter(api => 
            api.timestamp >= cutoffTime
          )
        }
        
        return {
          lcpTrend: recentMetrics.lcp.map(m => m.value),
          inpTrend: recentMetrics.inp.map(m => m.value),
          clsTrend: recentMetrics.cls.map(m => m.value),
          apiResponseTrend: recentMetrics.api.map(m => m.responseTime)
        }
      },

      // 유틸리티
      reset: () => {
        set(initialState)
      },

      exportData: () => {
        const state = get()
        return JSON.stringify({
          sessionId: state.sessionId,
          userId: state.userId,
          coreWebVitals: state.coreWebVitals,
          apiMetrics: state.apiMetrics,
          budget: state.budget,
          stats: state.stats,
          exportedAt: new Date().toISOString()
        }, null, 2)
      }
    }),
    {
      name: 'performance-store'
    }
  )
)