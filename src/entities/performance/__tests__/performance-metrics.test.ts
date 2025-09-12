import { describe, it, expect } from 'vitest'
import { 
  PerformanceMetrics, 
  CoreWebVital, 
  APIPerformanceMetric,
  performanceMetricsSchema,
  coreWebVitalSchema,
  apiPerformanceMetricSchema
} from '../performance-metrics'

describe('Performance Metrics Domain', () => {
  describe('CoreWebVital', () => {
    it('should validate valid LCP metric', () => {
      const lcpMetric: CoreWebVital = {
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 50,
        navigationType: 'navigate',
        id: 'test-id-1',
        timestamp: Date.now(),
        pathname: '/test-page',
        userAgent: 'test-agent'
      }

      expect(() => coreWebVitalSchema.parse(lcpMetric)).not.toThrow()
    })

    it('should validate valid INP metric', () => {
      const inpMetric: CoreWebVital = {
        name: 'INP',
        value: 150,
        rating: 'good',
        delta: 10,
        navigationType: 'navigate',
        id: 'test-id-2',
        timestamp: Date.now(),
        pathname: '/test-page',
        userAgent: 'test-agent'
      }

      expect(() => coreWebVitalSchema.parse(inpMetric)).not.toThrow()
    })

    it('should validate valid CLS metric', () => {
      const clsMetric: CoreWebVital = {
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.01,
        navigationType: 'navigate',
        id: 'test-id-3',
        timestamp: Date.now(),
        pathname: '/test-page',
        userAgent: 'test-agent'
      }

      expect(() => coreWebVitalSchema.parse(clsMetric)).not.toThrow()
    })

    it('should reject invalid metric name', () => {
      const invalidMetric = {
        name: 'INVALID' as any,
        value: 1000,
        rating: 'good',
        delta: 10,
        navigationType: 'navigate',
        id: 'test-id',
        timestamp: Date.now(),
        pathname: '/test',
        userAgent: 'test'
      }

      expect(() => coreWebVitalSchema.parse(invalidMetric)).toThrow()
    })

    it('should reject invalid rating', () => {
      const invalidMetric = {
        name: 'LCP',
        value: 1000,
        rating: 'invalid' as any,
        delta: 10,
        navigationType: 'navigate',
        id: 'test-id',
        timestamp: Date.now(),
        pathname: '/test',
        userAgent: 'test'
      }

      expect(() => coreWebVitalSchema.parse(invalidMetric)).toThrow()
    })
  })

  describe('APIPerformanceMetric', () => {
    it('should validate valid API performance metric', () => {
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

      expect(() => apiPerformanceMetricSchema.parse(apiMetric)).not.toThrow()
    })

    it('should validate API metric with error status', () => {
      const apiMetric: APIPerformanceMetric = {
        url: '/api/auth/protected',
        method: 'GET',
        statusCode: 401,
        responseTime: 120,
        timestamp: Date.now(),
        requestSize: 128,
        responseSize: 256,
        errorType: 'UNAUTHORIZED',
        userId: 'user-123',
        sessionId: 'session-456'
      }

      expect(() => apiPerformanceMetricSchema.parse(apiMetric)).not.toThrow()
    })

    it('should reject negative response time', () => {
      const invalidMetric = {
        url: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: -50,
        timestamp: Date.now(),
        requestSize: 100,
        responseSize: 200,
        userId: 'user-123',
        sessionId: 'session-456'
      }

      expect(() => apiPerformanceMetricSchema.parse(invalidMetric)).toThrow()
    })
  })

  describe('PerformanceMetrics', () => {
    it('should validate complete performance metrics', () => {
      const metrics: PerformanceMetrics = {
        sessionId: 'session-789',
        userId: 'user-456',
        timestamp: Date.now(),
        pathname: '/dashboard',
        userAgent: 'Mozilla/5.0 test',
        coreWebVitals: [
          {
            name: 'LCP',
            value: 2000,
            rating: 'good',
            delta: 50,
            navigationType: 'navigate',
            id: 'lcp-1',
            timestamp: Date.now(),
            pathname: '/dashboard',
            userAgent: 'Mozilla/5.0 test'
          }
        ],
        apiMetrics: [
          {
            url: '/api/auth/me',
            method: 'GET',
            statusCode: 200,
            responseTime: 75,
            timestamp: Date.now(),
            requestSize: 64,
            responseSize: 256,
            userId: 'user-456',
            sessionId: 'session-789'
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

      expect(() => performanceMetricsSchema.parse(metrics)).not.toThrow()
    })

    it('should validate metrics without optional fields', () => {
      const metrics: PerformanceMetrics = {
        sessionId: 'session-123',
        timestamp: Date.now(),
        pathname: '/home',
        userAgent: 'test-agent',
        coreWebVitals: [],
        apiMetrics: []
      }

      expect(() => performanceMetricsSchema.parse(metrics)).not.toThrow()
    })
  })
})