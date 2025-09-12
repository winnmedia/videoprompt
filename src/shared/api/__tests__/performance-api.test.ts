import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { performanceApi } from '../performance-api'
import type { PerformanceMetrics, CoreWebVital, APIPerformanceMetric } from '@/entities/performance'

const mockSessionMetrics: PerformanceMetrics = {
  sessionId: 'test-session-123',
  userId: 'user-456',
  timestamp: Date.now(),
  pathname: '/test-page',
  userAgent: 'test-agent',
  coreWebVitals: [
    {
      name: 'LCP',
      value: 2000,
      rating: 'good',
      delta: 50,
      navigationType: 'navigate',
      id: 'lcp-1',
      timestamp: Date.now(),
      pathname: '/test-page',
      userAgent: 'test-agent'
    }
  ],
  apiMetrics: [
    {
      url: '/api/auth/me',
      method: 'GET',
      statusCode: 200,
      responseTime: 85,
      timestamp: Date.now(),
      requestSize: 64,
      responseSize: 256,
      userId: 'user-456',
      sessionId: 'test-session-123'
    }
  ],
  deviceInfo: {
    type: 'desktop',
    memory: 8,
    cores: 4,
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50
    }
  }
}

// 독립적인 테스트 서버 설정
const server = setupServer()

describe('Performance API', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  describe('sendMetrics', () => {
    it('성능 메트릭을 성공적으로 전송해야 함', async () => {
      server.use(
        http.post('/api/performance/metrics', () => {
          return HttpResponse.json({ 
            success: true, 
            message: 'Metrics received successfully' 
          })
        })
      )

      const result = await performanceApi.sendMetrics(mockSessionMetrics)
      
      expect(result).toEqual({
        success: true,
        message: 'Metrics received successfully'
      })
    })

    it('잘못된 데이터에 대해 400 에러를 반환해야 함', async () => {
      server.use(
        http.post('/api/performance/metrics', () => {
          return HttpResponse.json(
            { 
              success: false, 
              error: 'Invalid metrics data' 
            },
            { status: 400 }
          )
        })
      )

      await expect(performanceApi.sendMetrics({} as PerformanceMetrics))
        .rejects
        .toThrow('Invalid metrics data')
    })

    it('네트워크 에러를 적절히 처리해야 함', async () => {
      server.use(
        http.post('/api/performance/metrics', () => {
          return HttpResponse.error()
        })
      )

      await expect(performanceApi.sendMetrics(mockSessionMetrics))
        .rejects
        .toThrow()
    })
  })

  describe('sendBatch', () => {
    it('배치 메트릭을 성공적으로 전송해야 함', async () => {
      server.use(
        http.post('/api/performance/batch', () => {
          return HttpResponse.json({ 
            success: true, 
            processed: 2,
            message: 'Batch processed successfully' 
          })
        })
      )

      const batchMetrics = [mockSessionMetrics, { ...mockSessionMetrics, sessionId: 'session-2' }]
      const result = await performanceApi.sendBatch(batchMetrics)
      
      expect(result).toEqual({
        success: true,
        processed: 2,
        message: 'Batch processed successfully'
      })
    })

    it('빈 배치에 대해 적절히 처리해야 함', async () => {
      const result = await performanceApi.sendBatch([])
      
      expect(result).toEqual({
        success: true,
        processed: 0,
        message: 'No metrics to process'
      })
    })
  })

  describe('getMetrics', () => {
    it('세션 메트릭을 성공적으로 조회해야 함', async () => {
      const mockResponse = {
        metrics: [mockSessionMetrics],
        total: 1,
        page: 1,
        pageSize: 10
      }

      server.use(
        http.get('/api/performance/metrics', () => {
          return HttpResponse.json(mockResponse)
        })
      )

      const result = await performanceApi.getMetrics({ sessionId: 'test-session-123' })
      
      expect(result).toEqual(mockResponse)
    })

    it('날짜 범위 필터를 올바르게 적용해야 함', async () => {
      server.use(
        http.get('/api/performance/metrics', ({ request }) => {
          const url = new URL(request.url)
          expect(url.searchParams.get('startDate')).toBeDefined()
          expect(url.searchParams.get('endDate')).toBeDefined()
          
          return HttpResponse.json({
            metrics: [],
            total: 0,
            page: 1,
            pageSize: 10
          })
        })
      )

      await performanceApi.getMetrics({
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      })
    })
  })

  describe('getAggregatedStats', () => {
    it('집계 통계를 성공적으로 조회해야 함', async () => {
      const mockStats = {
        averageLCP: 2100,
        averageINP: 150,
        averageCLS: 0.05,
        averageApiResponseTime: 95,
        p75LCP: 2400,
        p75INP: 180,
        p75CLS: 0.08,
        totalSessions: 1250,
        totalPageViews: 5000,
        totalApiCalls: 15000
      }

      server.use(
        http.get('/api/performance/stats', () => {
          return HttpResponse.json(mockStats)
        })
      )

      const result = await performanceApi.getAggregatedStats({
        timeRange: '7d',
        groupBy: 'day'
      })
      
      expect(result).toEqual(mockStats)
    })
  })

  describe('getBudgetViolations', () => {
    it('예산 위반 내역을 조회해야 함', async () => {
      const mockViolations = [
        {
          id: 'violation-1',
          type: 'lcp',
          value: 4500,
          budget: 2500,
          timestamp: Date.now(),
          sessionId: 'test-session',
          pathname: '/heavy-page'
        }
      ]

      server.use(
        http.get('/api/performance/violations', () => {
          return HttpResponse.json({ violations: mockViolations })
        })
      )

      const result = await performanceApi.getBudgetViolations({
        severity: 'high',
        limit: 50
      })
      
      expect(result.violations).toEqual(mockViolations)
    })
  })

  describe('데이터 변환 및 검증', () => {
    it('Core Web Vital 메트릭이 올바르게 직렬화되어야 함', async () => {
      let capturedBody: any = null
      
      server.use(
        http.post('/api/performance/metrics', async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ success: true })
        })
      )

      await performanceApi.sendMetrics(mockSessionMetrics)
      
      expect(capturedBody).toBeDefined()
      expect(capturedBody.coreWebVitals).toHaveLength(1)
      expect(capturedBody.coreWebVitals[0]).toMatchObject({
        name: 'LCP',
        value: 2000,
        rating: 'good'
      })
    })

    it('API 메트릭이 올바르게 직렬화되어야 함', async () => {
      let capturedBody: any = null
      
      server.use(
        http.post('/api/performance/metrics', async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({ success: true })
        })
      )

      await performanceApi.sendMetrics(mockSessionMetrics)
      
      expect(capturedBody.apiMetrics).toHaveLength(1)
      expect(capturedBody.apiMetrics[0]).toMatchObject({
        url: '/api/auth/me',
        method: 'GET',
        statusCode: 200,
        responseTime: 85
      })
    })
  })

  describe('에러 처리', () => {
    it('401 인증 에러를 적절히 처리해야 함', async () => {
      server.use(
        http.post('/api/performance/metrics', () => {
          return HttpResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      await expect(performanceApi.sendMetrics(mockSessionMetrics))
        .rejects
        .toThrow('Unauthorized')
    })

    it('서버 에러(5xx)를 적절히 처리해야 함', async () => {
      server.use(
        http.post('/api/performance/metrics', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          )
        })
      )

      await expect(performanceApi.sendMetrics(mockSessionMetrics))
        .rejects
        .toThrow('Internal Server Error')
    })
  })
})