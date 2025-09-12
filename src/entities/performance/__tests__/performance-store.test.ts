import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePerformanceStore } from '../performance-store'
import type { CoreWebVital, APIPerformanceMetric, PerformanceMetrics } from '../performance-metrics'

describe('Performance Store', () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    usePerformanceStore.getState().reset()
  })

  describe('초기 상태', () => {
    it('초기 상태가 올바르게 설정되어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      expect(result.current.metrics).toEqual([])
      expect(result.current.coreWebVitals).toEqual([])
      expect(result.current.apiMetrics).toEqual([])
      expect(result.current.isMonitoring).toBe(false)
      expect(result.current.budget).toBeDefined()
      expect(result.current.alerts).toEqual([])
    })
  })

  describe('Core Web Vitals 관리', () => {
    it('Core Web Vital 메트릭을 추가할 수 있어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const lcpMetric: CoreWebVital = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 50,
        navigationType: 'navigate',
        id: 'lcp-test-1',
        timestamp: Date.now(),
        pathname: '/test-page',
        userAgent: 'test-agent'
      }

      act(() => {
        result.current.addCoreWebVital(lcpMetric)
      })

      expect(result.current.coreWebVitals).toHaveLength(1)
      expect(result.current.coreWebVitals[0]).toEqual(lcpMetric)
    })

    it('같은 ID의 메트릭은 업데이트되어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const initialMetric: CoreWebVital = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 50,
        navigationType: 'navigate',
        id: 'lcp-test-1',
        timestamp: Date.now(),
        pathname: '/test-page',
        userAgent: 'test-agent'
      }

      const updatedMetric: CoreWebVital = {
        ...initialMetric,
        value: 1800,
        delta: 30
      }

      act(() => {
        result.current.addCoreWebVital(initialMetric)
        result.current.addCoreWebVital(updatedMetric)
      })

      expect(result.current.coreWebVitals).toHaveLength(1)
      expect(result.current.coreWebVitals[0].value).toBe(1800)
      expect(result.current.coreWebVitals[0].delta).toBe(30)
    })
  })

  describe('API 메트릭 관리', () => {
    it('API 메트릭을 추가할 수 있어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const apiMetric: APIPerformanceMetric = {
        url: '/api/auth/login',
        method: 'POST',
        statusCode: 200,
        responseTime: 85,
        timestamp: Date.now(),
        requestSize: 256,
        responseSize: 512,
        userId: 'user-123',
        sessionId: 'session-456'
      }

      act(() => {
        result.current.addApiMetric(apiMetric)
      })

      expect(result.current.apiMetrics).toHaveLength(1)
      expect(result.current.apiMetrics[0]).toEqual(apiMetric)
    })

    it('API 메트릭을 시간순으로 정렬해야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const olderMetric: APIPerformanceMetric = {
        url: '/api/test1',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        timestamp: Date.now() - 1000,
        requestSize: 100,
        responseSize: 200,
        sessionId: 'session-1'
      }

      const newerMetric: APIPerformanceMetric = {
        url: '/api/test2',
        method: 'GET',
        statusCode: 200,
        responseTime: 120,
        timestamp: Date.now(),
        requestSize: 100,
        responseSize: 200,
        sessionId: 'session-1'
      }

      act(() => {
        result.current.addApiMetric(olderMetric)
        result.current.addApiMetric(newerMetric)
      })

      expect(result.current.apiMetrics).toHaveLength(2)
      expect(result.current.apiMetrics[0].timestamp).toBeLessThan(result.current.apiMetrics[1].timestamp)
    })
  })

  describe('성능 예산 및 알림', () => {
    it('성능 예산을 업데이트할 수 있어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const newBudget = {
        lcp: 2000,
        inp: 150,
        cls: 0.05,
        apiResponseTime: 80,
        bundleSize: 512000,
        enableAlerts: true
      }

      act(() => {
        result.current.updateBudget(newBudget)
      })

      expect(result.current.budget).toEqual(newBudget)
    })

    it('예산 위반 시 알림을 생성해야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      // 예산을 매우 엄격하게 설정
      const strictBudget = {
        lcp: 1000,
        inp: 50,
        cls: 0.05,
        apiResponseTime: 50,
        bundleSize: 100000,
        enableAlerts: true
      }

      act(() => {
        result.current.updateBudget(strictBudget)
      })

      // 예산을 위반하는 메트릭 추가
      const violatingMetric: CoreWebVital = {
        name: 'LCP',
        value: 3000, // 예산 1000ms를 초과
        rating: 'poor',
        delta: 100,
        navigationType: 'navigate',
        id: 'lcp-violation',
        timestamp: Date.now(),
        pathname: '/test',
        userAgent: 'test'
      }

      act(() => {
        result.current.addCoreWebVital(violatingMetric)
      })

      expect(result.current.alerts.length).toBeGreaterThan(0)
      expect(result.current.alerts[0]).toMatchObject({
        type: 'budget-violation',
        severity: 'error'
      })
    })
  })

  describe('모니터링 제어', () => {
    it('모니터링을 시작하고 중지할 수 있어야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      act(() => {
        result.current.startMonitoring()
      })
      
      expect(result.current.isMonitoring).toBe(true)

      act(() => {
        result.current.stopMonitoring()
      })
      
      expect(result.current.isMonitoring).toBe(false)
    })
  })

  describe('데이터 집계', () => {
    it('현재 세션의 통합 메트릭을 반환해야 함', () => {
      const { result } = renderHook(() => usePerformanceStore())
      
      const sessionId = 'test-session-123'
      
      const cwv: CoreWebVital = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 50,
        navigationType: 'navigate',
        id: 'lcp-1',
        timestamp: Date.now(),
        pathname: '/test',
        userAgent: 'test-agent'
      }

      const api: APIPerformanceMetric = {
        url: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        timestamp: Date.now(),
        requestSize: 100,
        responseSize: 200,
        sessionId
      }

      act(() => {
        result.current.addCoreWebVital(cwv)
        result.current.addApiMetric(api)
        result.current.setCurrentSession(sessionId, 'user-123')
      })

      const metrics = result.current.getCurrentSessionMetrics()
      
      expect(metrics).toBeDefined()
      expect(metrics.sessionId).toBe(sessionId)
      expect(metrics.userId).toBe('user-123')
      expect(metrics.coreWebVitals).toHaveLength(1)
      expect(metrics.apiMetrics).toHaveLength(1)
    })
  })
})