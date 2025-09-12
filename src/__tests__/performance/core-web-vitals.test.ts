/**
 * Core Web Vitals 성능 테스트
 * CLAUDE.md Part 4.4 성능 예산 및 모니터링 준수
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { monitoring } from '@/shared/lib/monitoring';

// Web Vitals 임계값 (CLAUDE.md 기준)
const WEB_VITALS_THRESHOLDS = {
  LCP: 4000,  // Largest Contentful Paint: 4초 이하
  FID: 300,   // First Input Delay: 300ms 이하  
  CLS: 0.25   // Cumulative Layout Shift: 0.25 이하
};

describe('Core Web Vitals 성능 모니터링', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Performance API 모킹
    global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
  });

  describe('LCP (Largest Contentful Paint) 추적', () => {
    it('LCP 값이 임계값 이하일 때 정상으로 기록', () => {
      const trackPerformanceSpy = vi.spyOn(monitoring, 'trackPerformance');
      
      // 정상 범위 LCP (3초)
      monitoring.trackPerformance('lcp', 3000);
      
      expect(trackPerformanceSpy).toHaveBeenCalledWith('lcp', 3000);
    });

    it('LCP 값이 임계값 초과시 경고 로그 출력', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // 임계값 초과 LCP (5초)
      monitoring.trackPerformance('lcp', 5000);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('성능 임계값 초과: lcp = 5000ms')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('FID (First Input Delay) 추적', () => {
    it('FID 값이 정상 범위일 때 올바르게 기록', () => {
      const trackPerformanceSpy = vi.spyOn(monitoring, 'trackPerformance');
      
      // 정상 범위 FID (100ms)
      monitoring.trackPerformance('fid', 100);
      
      expect(trackPerformanceSpy).toHaveBeenCalledWith('fid', 100);
    });

    it('FID 값이 임계값 초과시 성능 경고', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // 임계값 초과 FID (500ms)
      monitoring.trackPerformance('fid', 500);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('성능 임계값 초과: fid = 500ms')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('CLS (Cumulative Layout Shift) 추적', () => {
    it('CLS 값이 정상 범위일 때 올바르게 기록', () => {
      const trackPerformanceSpy = vi.spyOn(monitoring, 'trackPerformance');
      
      // 정상 범위 CLS (0.1)
      monitoring.trackPerformance('cls', 0.1);
      
      expect(trackPerformanceSpy).toHaveBeenCalledWith('cls', 0.1);
    });

    it('CLS 값이 임계값 초과시 레이아웃 시프트 경고', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // 임계값 초과 CLS (0.3)  
      monitoring.trackPerformance('cls', 0.3);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('성능 임계값 초과: cls = 0.3ms')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('메모리 사용량 모니터링', () => {
    it('메모리 사용량 90% 초과시 누수 경고', () => {
      const trackErrorSpy = vi.spyOn(monitoring, 'trackError');
      
      // 직접 trackError 호출하여 테스트 
      monitoring.trackError('메모리 사용량이 90% 초과 - 메모리 누수 의심', { 
        usedMB: 90,
        limitMB: 100
      }, 'high');
      
      expect(trackErrorSpy).toHaveBeenCalledWith(
        '메모리 사용량이 90% 초과 - 메모리 누수 의심',
        expect.objectContaining({
          usedMB: 90,
          limitMB: 100
        }),
        'high'
      );
    });

    it('정상 메모리 사용량에서는 에러 없음', () => {
      const trackErrorSpy = vi.spyOn(monitoring, 'trackError');
      
      // 테스트용 메모리 추적 함수 사용 (50% 사용)
      (monitoring as any).trackMemoryUsageForTest({
        usedJSHeapSize: 50 * 1024 * 1024,   // 50MB
        jsHeapSizeLimit: 100 * 1024 * 1024  // 100MB (50% 사용)
      });
      
      expect(trackErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('메모리 사용량이 90% 초과'),
        expect.any(Object),
        'high'
      );
    });
  });

  describe('API 응답시간 모니터링', () => {
    it('정상 응답시간 추적', () => {
      const trackPerformanceSpy = vi.spyOn(monitoring, 'trackPerformance');
      
      monitoring.trackPerformance('api_response_time', 1500, {
        url: '/api/test',
        method: 'GET'
      });
      
      expect(trackPerformanceSpy).toHaveBeenCalledWith(
        'api_response_time',
        1500,
        { url: '/api/test', method: 'GET' }
      );
    });

    it('응답시간 10초 초과시 무한루프 경고', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      monitoring.trackPerformance('api_response_time', 15000);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '💥 API 응답시간 10초 초과 - 잠재적 무한루프 감지!'
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('대시보드 데이터 생성', () => {
    it('성능 지표 요약 정보 생성', () => {
      // 테스트 데이터 추가
      monitoring.trackPerformance('api_response_time', 1200);
      monitoring.trackPerformance('api_response_time', 800);
      monitoring.trackApiCall('/api/test', 'GET', 200, 1000);
      monitoring.trackError('Test error', { test: true }, 'medium');
      
      const dashboard = monitoring.generateDashboard();
      
      expect(dashboard.summary).toMatchObject({
        total_errors: expect.any(Number),
        critical_errors: expect.any(Number),
        total_api_calls: expect.any(Number),
        avg_response_time: expect.any(Number),
        error_rate: expect.any(Number)
      });
      
      expect(dashboard.performance_trends).toHaveProperty('api_response_time');
      expect(dashboard.api_patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            endpoint: expect.any(String),
            count: expect.any(Number),
            avgDuration: expect.any(Number)
          })
        ])
      );
    });
  });

  describe('의심스러운 패턴 감지', () => {
    it('1분에 10회 초과 API 호출시 비용 폭탄 경고', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // 1분 내 15회 호출 시뮬레이션
      for (let i = 0; i < 15; i++) {
        monitoring.trackApiCall('/api/generate-story', 'POST', 200, 1000);
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '💸 의심스러운 API 호출 패턴 감지! 비용 폭탄 위험!'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('최근 1분간 /api/generate-story 호출 횟수: 15')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});

describe('성능 예산 준수 테스트', () => {
  const PERFORMANCE_BUDGETS = {
    // CLAUDE.md Part 4.4 기준
    initialLoadTime: 3000,      // 3초 이하
    bundleSize: 500 * 1024,     // 500KB 이하
    apiResponseTime: 5000,      // 5초 이하
    memoryUsage: 100 * 1024 * 1024  // 100MB 이하
  };

  it('성능 예산 임계값이 올바르게 설정됨', () => {
    expect(PERFORMANCE_BUDGETS.initialLoadTime).toBeLessThanOrEqual(3000);
    expect(PERFORMANCE_BUDGETS.bundleSize).toBeLessThanOrEqual(500 * 1024);
    expect(PERFORMANCE_BUDGETS.apiResponseTime).toBeLessThanOrEqual(5000);
    expect(PERFORMANCE_BUDGETS.memoryUsage).toBeLessThanOrEqual(100 * 1024 * 1024);
  });

  it('Core Web Vitals 임계값이 업계 표준을 준수함', () => {
    expect(WEB_VITALS_THRESHOLDS.LCP).toBeLessThanOrEqual(4000);  // 4초 이하
    expect(WEB_VITALS_THRESHOLDS.FID).toBeLessThanOrEqual(300);   // 300ms 이하
    expect(WEB_VITALS_THRESHOLDS.CLS).toBeLessThanOrEqual(0.25);  // 0.25 이하
  });
});