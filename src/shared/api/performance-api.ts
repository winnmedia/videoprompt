import { z } from 'zod'
import type { PerformanceMetrics } from '@/entities/performance'

// API 응답 스키마
const sendMetricsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  id: z.string().optional()
})

const sendBatchResponseSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
  message: z.string().optional(),
  failed: z.array(z.object({
    index: z.number(),
    error: z.string()
  })).optional()
})

const getMetricsResponseSchema = z.object({
  metrics: z.array(z.any()), // PerformanceMetrics 스키마 재사용
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  hasNext: z.boolean().optional()
})

const aggregatedStatsSchema = z.object({
  averageLCP: z.number(),
  averageINP: z.number(),
  averageCLS: z.number(),
  averageApiResponseTime: z.number(),
  p75LCP: z.number(),
  p75INP: z.number(),
  p75CLS: z.number(),
  p95LCP: z.number().optional(),
  p95INP: z.number().optional(),
  p95CLS: z.number().optional(),
  totalSessions: z.number(),
  totalPageViews: z.number(),
  totalApiCalls: z.number(),
  errorRate: z.number().optional(),
  trends: z.object({
    lcp: z.array(z.number()).optional(),
    inp: z.array(z.number()).optional(),
    cls: z.array(z.number()).optional()
  }).optional()
})

const budgetViolationsSchema = z.object({
  violations: z.array(z.object({
    id: z.string(),
    type: z.enum(['lcp', 'inp', 'cls', 'api']),
    value: z.number(),
    budget: z.number(),
    timestamp: z.number(),
    sessionId: z.string(),
    pathname: z.string().optional(),
    url: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high']).optional()
  })),
  total: z.number().optional(),
  summary: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number()
  }).optional()
})

// 요청 파라미터 타입
export interface GetMetricsParams {
  sessionId?: string
  userId?: string
  pathname?: string
  startDate?: Date
  endDate?: Date
  page?: number
  pageSize?: number
  metrics?: ('lcp' | 'inp' | 'cls' | 'api')[]
}

export interface GetAggregatedStatsParams {
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d'
  groupBy?: 'hour' | 'day' | 'week'
  pathname?: string
  userAgent?: string
  deviceType?: 'mobile' | 'desktop' | 'tablet'
}

export interface GetBudgetViolationsParams {
  severity?: 'low' | 'medium' | 'high'
  type?: 'lcp' | 'inp' | 'cls' | 'api'
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

// 응답 타입
export type SendMetricsResponse = z.infer<typeof sendMetricsResponseSchema>
export type SendBatchResponse = z.infer<typeof sendBatchResponseSchema>
export type GetMetricsResponse = z.infer<typeof getMetricsResponseSchema>
export type AggregatedStats = z.infer<typeof aggregatedStatsSchema>
export type BudgetViolations = z.infer<typeof budgetViolationsSchema>

class PerformanceApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'PerformanceApiError'
  }
}

class PerformanceApiClient {
  private baseUrl: string
  private timeout: number

  constructor(baseUrl = '/api/performance', timeout = 10000) {
    this.baseUrl = baseUrl
    this.timeout = timeout
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new PerformanceApiError(
          errorData.error || errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json()
      
      if (schema) {
        return schema.parse(data)
      }
      
      return data as T
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof PerformanceApiError) {
        throw error
      }
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new PerformanceApiError('Request timeout', 408, 'TIMEOUT')
      }
      
      throw new PerformanceApiError(
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        'NETWORK_ERROR'
      )
    }
  }

  /**
   * 개별 성능 메트릭 전송
   */
  async sendMetrics(metrics: PerformanceMetrics): Promise<SendMetricsResponse> {
    return this.request('/metrics', {
      method: 'POST',
      body: JSON.stringify(metrics)
    }, sendMetricsResponseSchema)
  }

  /**
   * 배치로 성능 메트릭 전송
   */
  async sendBatch(metrics: PerformanceMetrics[]): Promise<SendBatchResponse> {
    if (metrics.length === 0) {
      return {
        success: true,
        processed: 0,
        message: 'No metrics to process'
      }
    }

    return this.request('/batch', {
      method: 'POST',
      body: JSON.stringify({ metrics })
    }, sendBatchResponseSchema)
  }

  /**
   * 성능 메트릭 조회
   */
  async getMetrics(params: GetMetricsParams = {}): Promise<GetMetricsResponse> {
    const searchParams = new URLSearchParams()
    
    if (params.sessionId) searchParams.set('sessionId', params.sessionId)
    if (params.userId) searchParams.set('userId', params.userId)
    if (params.pathname) searchParams.set('pathname', params.pathname)
    if (params.startDate) searchParams.set('startDate', params.startDate.toISOString())
    if (params.endDate) searchParams.set('endDate', params.endDate.toISOString())
    if (params.page) searchParams.set('page', params.page.toString())
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
    if (params.metrics) searchParams.set('metrics', params.metrics.join(','))

    const query = searchParams.toString()
    const endpoint = `/metrics${query ? `?${query}` : ''}`
    
    return this.request(endpoint, { method: 'GET' }, getMetricsResponseSchema)
  }

  /**
   * 집계 통계 조회
   */
  async getAggregatedStats(params: GetAggregatedStatsParams): Promise<AggregatedStats> {
    const searchParams = new URLSearchParams()
    
    searchParams.set('timeRange', params.timeRange)
    if (params.groupBy) searchParams.set('groupBy', params.groupBy)
    if (params.pathname) searchParams.set('pathname', params.pathname)
    if (params.userAgent) searchParams.set('userAgent', params.userAgent)
    if (params.deviceType) searchParams.set('deviceType', params.deviceType)

    const query = searchParams.toString()
    const endpoint = `/stats?${query}`
    
    return this.request(endpoint, { method: 'GET' }, aggregatedStatsSchema)
  }

  /**
   * 성능 예산 위반 내역 조회
   */
  async getBudgetViolations(params: GetBudgetViolationsParams = {}): Promise<BudgetViolations> {
    const searchParams = new URLSearchParams()
    
    if (params.severity) searchParams.set('severity', params.severity)
    if (params.type) searchParams.set('type', params.type)
    if (params.startDate) searchParams.set('startDate', params.startDate.toISOString())
    if (params.endDate) searchParams.set('endDate', params.endDate.toISOString())
    if (params.limit) searchParams.set('limit', params.limit.toString())
    if (params.offset) searchParams.set('offset', params.offset.toString())

    const query = searchParams.toString()
    const endpoint = `/violations${query ? `?${query}` : ''}`
    
    return this.request(endpoint, { method: 'GET' }, budgetViolationsSchema)
  }

  /**
   * 성능 메트릭 삭제
   */
  async deleteMetrics(sessionId: string): Promise<{ success: boolean }> {
    return this.request(`/metrics/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    })
  }

  /**
   * 실시간 성능 모니터링을 위한 WebSocket 연결 (선택적)
   */
  createRealtimeConnection(
    onMetric: (metric: PerformanceMetrics) => void,
    onError: (error: Error) => void
  ): () => void {
    if (typeof WebSocket === 'undefined') {
      onError(new Error('WebSocket is not supported'))
      return () => {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/performance/realtime`
    
    const ws = new WebSocket(wsUrl)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMetric(data)
      } catch (error) {
        onError(new Error('Failed to parse WebSocket message'))
      }
    }
    
    ws.onerror = () => {
      onError(new Error('WebSocket connection error'))
    }
    
    ws.onclose = () => {
      onError(new Error('WebSocket connection closed'))
    }
    
    return () => {
      ws.close()
    }
  }
}

// 싱글톤 인스턴스
export const performanceApi = new PerformanceApiClient()

// 에러 타입 export
export { PerformanceApiError }