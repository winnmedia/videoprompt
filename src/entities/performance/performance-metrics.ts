import { z } from 'zod'

// Core Web Vitals 메트릭 스키마
export const coreWebVitalSchema = z.object({
  name: z.enum(['LCP', 'INP', 'CLS']),
  value: z.number().min(0),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  delta: z.number(),
  navigationType: z.enum(['navigate', 'reload', 'back-forward', 'prerender']),
  id: z.string(),
  timestamp: z.number(),
  pathname: z.string(),
  userAgent: z.string(),
  entries: z.array(z.any()).optional(),
  attribution: z.record(z.string(), z.any()).optional()
})

// API 성능 메트릭 스키마
export const apiPerformanceMetricSchema = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  statusCode: z.number().min(100).max(599),
  responseTime: z.number().min(0),
  timestamp: z.number(),
  requestSize: z.number().min(0),
  responseSize: z.number().min(0),
  errorType: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  retryCount: z.number().min(0).optional().default(0),
  cacheHit: z.boolean().optional()
})

// 디바이스 정보 스키마
export const deviceInfoSchema = z.object({
  type: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  memory: z.number().min(0).optional(),
  cores: z.number().min(1).optional(),
  connection: z.object({
    effectiveType: z.enum(['slow-2g', '2g', '3g', '4g']).optional(),
    downlink: z.number().min(0).optional(),
    rtt: z.number().min(0).optional()
  }).optional()
})

// 성능 메트릭 전체 스키마
export const performanceMetricsSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  timestamp: z.number(),
  pathname: z.string(),
  userAgent: z.string(),
  coreWebVitals: z.array(coreWebVitalSchema),
  apiMetrics: z.array(apiPerformanceMetricSchema),
  deviceInfo: deviceInfoSchema.optional(),
  buildId: z.string().optional(),
  version: z.string().optional()
})

// TypeScript 타입 추출
export type CoreWebVital = z.infer<typeof coreWebVitalSchema>
export type APIPerformanceMetric = z.infer<typeof apiPerformanceMetricSchema>
export type DeviceInfo = z.infer<typeof deviceInfoSchema>
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>

// 성능 예산 스키마
export const performanceBudgetSchema = z.object({
  lcp: z.number().min(0).max(10000), // ms
  inp: z.number().min(0).max(1000),  // ms
  cls: z.number().min(0).max(1),     // score
  apiResponseTime: z.number().min(0).max(5000), // ms
  bundleSize: z.number().min(0),     // bytes
  enableAlerts: z.boolean().default(true)
})

export type PerformanceBudget = z.infer<typeof performanceBudgetSchema>

// 기본 성능 예산 설정
export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  lcp: 2500,      // 2.5초
  inp: 200,       // 200ms
  cls: 0.1,       // 0.1 점수
  apiResponseTime: 100,  // 100ms
  bundleSize: 1048576,   // 1MB
  enableAlerts: true
}

// 성능 평가 함수들
export const evaluateWebVitalRating = (metric: CoreWebVital): 'good' | 'needs-improvement' | 'poor' => {
  const { name, value } = metric
  
  switch (name) {
    case 'LCP':
      if (value <= 2500) return 'good'
      if (value <= 4000) return 'needs-improvement'
      return 'poor'
    
    case 'INP':
      if (value <= 200) return 'good'
      if (value <= 500) return 'needs-improvement'
      return 'poor'
    
    case 'CLS':
      if (value <= 0.1) return 'good'
      if (value <= 0.25) return 'needs-improvement'
      return 'poor'
    
    default:
      return 'poor'
  }
}

export const evaluateApiPerformance = (
  responseTime: number, 
  budget: PerformanceBudget
): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = budget.apiResponseTime
  
  if (responseTime <= threshold) return 'good'
  if (responseTime <= threshold * 2) return 'needs-improvement'
  return 'poor'
}

export const checkBudgetViolation = (
  metrics: PerformanceMetrics,
  budget: PerformanceBudget
): { violated: boolean; violations: string[] } => {
  const violations: string[] = []
  
  // Core Web Vitals 예산 검사
  metrics.coreWebVitals.forEach(cwv => {
    let exceedsBudget = false
    
    switch (cwv.name) {
      case 'LCP':
        exceedsBudget = cwv.value > budget.lcp
        break
      case 'INP':
        exceedsBudget = cwv.value > budget.inp
        break
      case 'CLS':
        exceedsBudget = cwv.value > budget.cls
        break
    }
    
    if (exceedsBudget) {
      violations.push(`${cwv.name} (${cwv.value}) exceeds budget threshold (${budget[cwv.name.toLowerCase() as keyof PerformanceBudget]})`)
    }
  })
  
  // API 응답 시간 예산 검사
  metrics.apiMetrics.forEach(api => {
    if (api.responseTime > budget.apiResponseTime) {
      violations.push(`API ${api.url} response time (${api.responseTime}ms) exceeds budget (${budget.apiResponseTime}ms)`)
    }
  })
  
  return {
    violated: violations.length > 0,
    violations
  }
}