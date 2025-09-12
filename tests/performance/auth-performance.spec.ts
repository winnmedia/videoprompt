import { test, expect, type Page } from '@playwright/test'

/**
 * 인증 API 성능 E2E 테스트
 * 
 * 401 오류 상황에서의 성능 회귀를 방지하고
 * 인증 플로우의 성능 메트릭을 검증합니다.
 */

interface PerformanceMetrics {
  lcp?: number
  inp?: number
  cls?: number
  apiResponseTimes: Array<{
    url: string
    method: string
    responseTime: number
    statusCode: number
  }>
}

// 성능 메트릭 수집 함수
async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  const metrics = await page.evaluate(() => {
    return new Promise<PerformanceMetrics>((resolve) => {
      const result: PerformanceMetrics = {
        apiResponseTimes: []
      }

      // Web Vitals 수집
      if ('web-vitals' in window) {
        const webVitals = (window as any)['web-vitals']
        
        webVitals.onLCP((metric: any) => {
          result.lcp = metric.value
        })
        
        webVitals.onINP((metric: any) => {
          result.inp = metric.value
        })
        
        webVitals.onCLS((metric: any) => {
          result.cls = metric.value
        })
      }

      // API 성능 메트릭 수집 (PerformanceObserver 사용)
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              // 페이지 로딩 성능
              const navEntry = entry as PerformanceNavigationTiming
              if (navEntry.loadEventEnd > 0) {
                result.apiResponseTimes.push({
                  url: navEntry.name,
                  method: 'GET',
                  responseTime: navEntry.loadEventEnd - navEntry.loadEventStart,
                  statusCode: 200
                })
              }
            }
          }
        })
        
        observer.observe({ entryTypes: ['navigation', 'resource'] })
      }

      // 잠시 기다린 후 결과 반환
      setTimeout(() => resolve(result), 1000)
    })
  })

  return metrics
}

// API 응답 시간 측정
async function measureApiResponse(
  page: Page, 
  urlPattern: string, 
  action: () => Promise<void>
): Promise<{ responseTime: number; statusCode: number }> {
  let responseTime = 0
  let statusCode = 0

  const responsePromise = page.waitForResponse(response => {
    if (response.url().includes(urlPattern)) {
      responseTime = Date.now() - startTime
      statusCode = response.status()
      return true
    }
    return false
  })

  const startTime = Date.now()
  await action()
  
  try {
    await responsePromise
  } catch (error) {
    // 타임아웃 등의 경우
    responseTime = Date.now() - startTime
    statusCode = 0
  }

  return { responseTime, statusCode }
}

test.describe('Authentication Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 성능 모니터링 활성화
    await page.addInitScript(() => {
      // Performance Observer 폴리필
      if (!window.PerformanceObserver) {
        console.warn('PerformanceObserver not supported')
      }
    })
  })

  test('로그인 페이지 로딩 성능 검증', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    
    // 페이지 로딩 완료 대기
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // LCP 측정
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        if ('web-vitals' in window) {
          const { onLCP } = (window as any)['web-vitals']
          onLCP((metric: any) => resolve(metric.value))
        } else {
          // Fallback: largest-contentful-paint 직접 측정
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            if (entries.length > 0) {
              const lcpEntry = entries[entries.length - 1]
              resolve(lcpEntry.startTime)
            }
          })
          observer.observe({ entryTypes: ['largest-contentful-paint'] })
          
          // 타임아웃
          setTimeout(() => resolve(0), 5000)
        }
      })
    })

    // 성능 기준 검증
    expect(loadTime).toBeLessThan(3000) // 3초 이내 로딩
    expect(lcp).toBeLessThan(2500) // LCP 2.5초 이내
    
    // 콘솔에 메트릭 출력
    console.log(`Page Load Time: ${loadTime}ms`)
    console.log(`LCP: ${lcp}ms`)
  })

  test('인증 API 응답 시간 검증 - 성공 케이스', async ({ page }) => {
    await page.goto('/')
    
    // 로그인 폼 작성
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    
    // API 응답 측정
    const { responseTime, statusCode } = await measureApiResponse(
      page,
      '/api/auth/login',
      async () => {
        await page.click('button[type="submit"]')
      }
    )
    
    // 성능 검증
    expect(responseTime).toBeLessThan(1000) // 1초 이내 응답
    expect(statusCode).toBe(200)
    
    console.log(`Login API Response Time: ${responseTime}ms (Status: ${statusCode})`)
  })

  test('인증 API 응답 시간 검증 - 401 오류 케이스', async ({ page }) => {
    await page.goto('/')
    
    // 잘못된 인증 정보로 로그인
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    
    const { responseTime, statusCode } = await measureApiResponse(
      page,
      '/api/auth/login',
      async () => {
        await page.click('button[type="submit"]')
      }
    )
    
    // 401 오류여도 빠른 응답이어야 함
    expect(responseTime).toBeLessThan(500) // 500ms 이내 응답
    expect(statusCode).toBe(401)
    
    console.log(`401 Error Response Time: ${responseTime}ms`)
  })

  test('보호된 리소스 접근 시 401 처리 성능', async ({ page }) => {
    await page.goto('/dashboard') // 보호된 페이지
    
    // 401 리다이렉트 측정
    const redirectStart = Date.now()
    
    // 로그인 페이지로 리다이렉트 대기
    await page.waitForURL('/', { timeout: 5000 })
    
    const redirectTime = Date.now() - redirectStart
    
    // 리다이렉트가 빠르게 이루어져야 함
    expect(redirectTime).toBeLessThan(1000)
    
    console.log(`401 Redirect Time: ${redirectTime}ms`)
  })

  test('연속 API 호출 성능 (토큰 갱신 포함)', async ({ page }) => {
    await page.goto('/')
    
    // 로그인
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    
    // 연속 API 호출 측정
    const apiCalls = [
      '/api/auth/me',
      '/api/user/profile',
      '/api/user/settings'
    ]
    
    const metrics = []
    
    for (const apiUrl of apiCalls) {
      const startTime = Date.now()
      
      try {
        const response = await page.evaluate(async (url) => {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
          return {
            status: res.status,
            time: Date.now()
          }
        }, apiUrl)
        
        const responseTime = Date.now() - startTime
        
        metrics.push({
          url: apiUrl,
          responseTime,
          statusCode: response.status
        })
        
      } catch (error) {
        metrics.push({
          url: apiUrl,
          responseTime: Date.now() - startTime,
          statusCode: 0
        })
      }
    }
    
    // 각 API 호출이 100ms 이내여야 함
    for (const metric of metrics) {
      expect(metric.responseTime).toBeLessThan(100)
      console.log(`${metric.url}: ${metric.responseTime}ms (Status: ${metric.statusCode})`)
    }
    
    // 평균 응답 시간 검증
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length
    expect(avgResponseTime).toBeLessThan(75) // 평균 75ms 이내
    
    console.log(`Average API Response Time: ${avgResponseTime}ms`)
  })

  test('페이지 네비게이션 성능 (SPA 라우팅)', async ({ page }) => {
    await page.goto('/')
    
    // 로그인
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    
    // 페이지 간 네비게이션 성능 측정
    const routes = [
      '/scenario',
      '/profile',
      '/settings',
      '/dashboard'
    ]
    
    const navigationMetrics = []
    
    for (const route of routes) {
      const startTime = Date.now()
      
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      
      const navigationTime = Date.now() - startTime
      
      navigationMetrics.push({
        route,
        navigationTime
      })
      
      // 각 페이지 로딩이 2초 이내여야 함
      expect(navigationTime).toBeLessThan(2000)
      
      console.log(`${route}: ${navigationTime}ms`)
    }
    
    // 평균 네비게이션 시간
    const avgNavigationTime = navigationMetrics.reduce((sum, m) => sum + m.navigationTime, 0) / navigationMetrics.length
    expect(avgNavigationTime).toBeLessThan(1500)
    
    console.log(`Average Navigation Time: ${avgNavigationTime}ms`)
  })

  test('성능 메트릭 자동 수집 및 전송 검증', async ({ page }) => {
    // 성능 모니터링 스크립트 주입
    await page.addInitScript(() => {
      (window as any).performanceMetrics = []
      
      // 성능 메트릭 수집기 모킹
      const originalFetch = window.fetch
      window.fetch = async function(input, init) {
        const startTime = performance.now()
        const response = await originalFetch(input, init)
        const endTime = performance.now()
        
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/api/')) {
          (window as any).performanceMetrics.push({
            url,
            method: init?.method || 'GET',
            responseTime: Math.round(endTime - startTime),
            statusCode: response.status,
            timestamp: Date.now()
          })
        }
        
        return response
      }
    })
    
    await page.goto('/')
    
    // 여러 API 호출 수행
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForTimeout(2000) // 메트릭 수집 대기
    
    // 수집된 메트릭 검증
    const collectedMetrics = await page.evaluate(() => {
      return (window as any).performanceMetrics
    })
    
    expect(collectedMetrics).toBeInstanceOf(Array)
    expect(collectedMetrics.length).toBeGreaterThan(0)
    
    // 각 메트릭이 올바른 형식인지 검증
    for (const metric of collectedMetrics) {
      expect(metric).toHaveProperty('url')
      expect(metric).toHaveProperty('method')
      expect(metric).toHaveProperty('responseTime')
      expect(metric).toHaveProperty('statusCode')
      expect(metric).toHaveProperty('timestamp')
      
      expect(typeof metric.responseTime).toBe('number')
      expect(metric.responseTime).toBeGreaterThan(0)
    }
    
    console.log('Collected Performance Metrics:', JSON.stringify(collectedMetrics, null, 2))
  })
})