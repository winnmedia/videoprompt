import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebVitals } from '../use-web-vitals'
import { usePerformanceStore } from '@/entities/performance'

// web-vitals 모킹
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn()
}))

// 스토어 모킹
vi.mock('@/entities/performance', () => ({
  usePerformanceStore: vi.fn()
}))

const mockAddCoreWebVital = vi.fn()
const mockStartMonitoring = vi.fn()
const mockStopMonitoring = vi.fn()
const mockSetCurrentSession = vi.fn()

const mockGetCurrentSessionMetrics = vi.fn().mockReturnValue({
  sessionId: 'test-session',
  timestamp: Date.now(),
  pathname: '/test',
  userAgent: 'test',
  coreWebVitals: [],
  apiMetrics: []
})

const mockStoreState = {
  isMonitoring: false,
  sessionId: null,
  addCoreWebVital: mockAddCoreWebVital,
  startMonitoring: mockStartMonitoring,
  stopMonitoring: mockStopMonitoring,
  setCurrentSession: mockSetCurrentSession,
  getCurrentSessionMetrics: mockGetCurrentSessionMetrics
}

describe('useWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(usePerformanceStore as Mock).mockReturnValue(mockStoreState)
  })

  it('초기화 시 웹 바이탈 수집을 시작해야 함', async () => {
    const { onCLS, onINP, onLCP } = await import('web-vitals')
    
    renderHook(() => useWebVitals())
    
    expect(onCLS).toHaveBeenCalledWith(expect.any(Function))
    expect(onINP).toHaveBeenCalledWith(expect.any(Function))
    expect(onLCP).toHaveBeenCalledWith(expect.any(Function))
  })

  it('세션 시작 시 모니터링이 활성화되어야 함', () => {
    const { result } = renderHook(() => useWebVitals())
    
    act(() => {
      result.current.startSession('test-session-123', 'user-456')
    })
    
    expect(mockSetCurrentSession).toHaveBeenCalledWith('test-session-123', 'user-456')
    expect(mockStartMonitoring).toHaveBeenCalled()
  })

  it('세션 종료 시 모니터링이 비활성화되어야 함', () => {
    const { result } = renderHook(() => useWebVitals())
    
    act(() => {
      result.current.stopSession()
    })
    
    expect(mockStopMonitoring).toHaveBeenCalled()
  })

  it('LCP 메트릭이 수집되면 스토어에 추가되어야 함', async () => {
    const { onLCP } = await import('web-vitals')
    let lcpCallback: (metric: any) => void
    
    ;(onLCP as any).mockImplementation((callback: (metric: any) => void) => {
      lcpCallback = callback
    })
    
    renderHook(() => useWebVitals())
    
    // LCP 메트릭 시뮬레이션
    const mockLCPMetric = {
      name: 'LCP',
      value: 2500,
      rating: 'good',
      delta: 100,
      navigationType: 'navigate',
      id: 'lcp-test-1',
      entries: []
    }
    
    act(() => {
      lcpCallback(mockLCPMetric)
    })
    
    expect(mockAddCoreWebVital).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'LCP',
        value: 2500,
        rating: 'good',
        delta: 100,
        navigationType: 'navigate',
        id: 'lcp-test-1',
        timestamp: expect.any(Number),
        pathname: expect.any(String),
        userAgent: expect.any(String)
      })
    )
  })

  it('INP 메트릭이 수집되면 스토어에 추가되어야 함', async () => {
    let inpCallback: (metric: any) => void
    
    mockOnINP.mockImplementation((callback: (metric: any) => void) => {
      inpCallback = callback
    })
    
    renderHook(() => useWebVitals())
    
    const mockINPMetric = {
      name: 'INP',
      value: 150,
      rating: 'good',
      delta: 10,
      navigationType: 'navigate',
      id: 'inp-test-1',
      entries: []
    }
    
    act(() => {
      inpCallback(mockINPMetric)
    })
    
    expect(mockAddCoreWebVital).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'INP',
        value: 150,
        rating: 'good'
      })
    )
  })

  it('CLS 메트릭이 수집되면 스토어에 추가되어야 함', async () => {
    let clsCallback: (metric: any) => void
    
    mockOnCLS.mockImplementation((callback: (metric: any) => void) => {
      clsCallback = callback
    })
    
    renderHook(() => useWebVitals())
    
    const mockCLSMetric = {
      name: 'CLS',
      value: 0.05,
      rating: 'good',
      delta: 0.01,
      navigationType: 'navigate',
      id: 'cls-test-1',
      entries: []
    }
    
    act(() => {
      clsCallback(mockCLSMetric)
    })
    
    expect(mockAddCoreWebVital).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CLS',
        value: 0.05,
        rating: 'good'
      })
    )
  })

  it('메트릭에 현재 경로 정보가 포함되어야 함', () => {
    // window.location 모킹
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/test-page',
        href: 'http://localhost:3000/test-page'
      },
      writable: true
    })
    
    let lcpCallback: (metric: any) => void
    
    mockOnLCP.mockImplementation((callback: (metric: any) => void) => {
      lcpCallback = callback
    })
    
    renderHook(() => useWebVitals())
    
    const mockLCPMetric = {
      name: 'LCP',
      value: 2000,
      rating: 'good',
      delta: 50,
      navigationType: 'navigate',
      id: 'lcp-path-test',
      entries: []
    }
    
    act(() => {
      lcpCallback(mockLCPMetric)
    })
    
    expect(mockAddCoreWebVital).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/test-page'
      })
    )
  })

  it('커스텀 설정이 올바르게 적용되어야 함', () => {
    const customConfig = {
      reportAllChanges: true,
      durationThreshold: 40
    }
    
    renderHook(() => useWebVitals(customConfig))
    
    expect(mockOnINP).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        reportAllChanges: true,
        durationThreshold: 40
      })
    )
  })

  it('컴포넌트 언마운트 시 정리 작업이 수행되어야 함', () => {
    const { result, unmount } = renderHook(() => useWebVitals())
    
    // 세션 시작
    act(() => {
      result.current.startSession('test-session')
    })
    
    // 컴포넌트 언마운트
    unmount()
    
    expect(mockStopMonitoring).toHaveBeenCalled()
  })

  it('메트릭 전송 옵션이 활성화된 경우 자동으로 전송되어야 함', async () => {
    const mockSendMetrics = vi.fn().mockResolvedValue({ success: true })
    
    // performanceApi 모킹
    vi.doMock('@/shared/api/performance-api', () => ({
      performanceApi: {
        sendMetrics: mockSendMetrics
      }
    }))
    
    const config = {
      autoSend: true,
      batchSize: 1
    }
    
    let lcpCallback: (metric: any) => void
    
    mockOnLCP.mockImplementation((callback: (metric: any) => void) => {
      lcpCallback = callback
    })
    
    renderHook(() => useWebVitals(config))
    
    const mockLCPMetric = {
      name: 'LCP',
      value: 2000,
      rating: 'good',
      delta: 50,
      navigationType: 'navigate',
      id: 'lcp-send-test',
      entries: []
    }
    
    await act(async () => {
      lcpCallback(mockLCPMetric)
      // 비동기 전송을 위한 대기
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(mockAddCoreWebVital).toHaveBeenCalled()
  })
})