/**
 * 클라이언트 측 무한 루프 감지기 - $300 사건 재발 방지
 * 브라우저 개발자 도구에서 실시간 API 호출 패턴 모니터링
 */

interface ApiCallRecord {
  url: string;
  timestamp: number;
  status: number;
  method: string;
  callStack?: string;
}

interface LoopDetectionResult {
  isInfiniteLoop: boolean;
  callCount: number;
  frequency: number; // calls per second
  pattern: 'burst' | 'continuous' | 'normal';
  recommendations: string[];
}

class ClientSideLoopDetector {
  private static instance: ClientSideLoopDetector;
  private apiCalls: ApiCallRecord[] = [];
  private warningThresholds = {
    burst: 10, // 10초 내 10회 이상
    continuous: 50, // 1분 내 50회 이상
    frequency: 5, // 초당 5회 이상
  };

  private constructor() {
    this.initializeInterception();
  }

  static getInstance(): ClientSideLoopDetector {
    if (!ClientSideLoopDetector.instance) {
      ClientSideLoopDetector.instance = new ClientSideLoopDetector();
    }
    return ClientSideLoopDetector.instance;
  }

  /**
   * Fetch API 인터셉트 설정
   */
  private initializeInterception(): void {
    if (typeof window === 'undefined') return;

    // 원본 fetch 저장
    const originalFetch = window.fetch;

    // fetch 인터셉트
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      const startTime = Date.now();

      try {
        const response = await originalFetch(input, init);

        // API 호출 기록
        this.recordApiCall({
          url,
          timestamp: startTime,
          status: response.status,
          method,
          callStack: this.getCurrentCallStack()
        });

        // 무한 루프 검사
        this.checkForInfiniteLoop(url);

        return response;
      } catch (error) {
        // 에러 발생 시에도 기록
        this.recordApiCall({
          url,
          timestamp: startTime,
          status: 0,
          method,
          callStack: this.getCurrentCallStack()
        });

        throw error;
      }
    };

    console.log('🔍 Client-side loop detector initialized');
  }

  /**
   * API 호출 기록
   */
  private recordApiCall(record: ApiCallRecord): void {
    this.apiCalls.push(record);

    // 5분 이상 된 기록 정리
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.apiCalls = this.apiCalls.filter(call => call.timestamp > fiveMinutesAgo);
  }

  /**
   * 현재 호출 스택 가져오기
   */
  private getCurrentCallStack(): string {
    try {
      throw new Error();
    } catch (e) {
      return (e as Error).stack?.split('\n').slice(2, 6).join('\n') || '';
    }
  }

  /**
   * 무한 루프 검사
   */
  private checkForInfiniteLoop(url: string): void {
    const result = this.analyzeApiCallPattern(url);

    if (result.isInfiniteLoop) {
      console.error('🚨 INFINITE LOOP DETECTED!', {
        url,
        pattern: result.pattern,
        callCount: result.callCount,
        frequency: result.frequency,
        recommendations: result.recommendations
      });

      // 시각적 경고 표시
      this.showVisualWarning(url, result);
    }
  }

  /**
   * API 호출 패턴 분석
   */
  analyzeApiCallPattern(targetUrl: string): LoopDetectionResult {
    const now = Date.now();
    const tenSecondsAgo = now - 10 * 1000;
    const oneMinuteAgo = now - 60 * 1000;

    // 대상 URL 필터링
    const relevantCalls = this.apiCalls.filter(call =>
      call.url.includes(targetUrl) || targetUrl.includes(call.url)
    );

    const recentCalls = relevantCalls.filter(call => call.timestamp > tenSecondsAgo);
    const minuteCalls = relevantCalls.filter(call => call.timestamp > oneMinuteAgo);

    const burstCount = recentCalls.length;
    const continuousCount = minuteCalls.length;
    const frequency = minuteCalls.length / 60; // per second

    let isInfiniteLoop = false;
    let pattern: 'burst' | 'continuous' | 'normal' = 'normal';
    const recommendations: string[] = [];

    // 버스트 패턴 검사 (10초 내 대량 호출)
    if (burstCount >= this.warningThresholds.burst) {
      isInfiniteLoop = true;
      pattern = 'burst';
      recommendations.push('useEffect 의존성 배열 확인');
      recommendations.push('중복 요청 방지 로직 추가');
    }

    // 지속적 패턴 검사 (1분 내 지속적 호출)
    if (continuousCount >= this.warningThresholds.continuous) {
      isInfiniteLoop = true;
      pattern = 'continuous';
      recommendations.push('캐싱 메커니즘 구현');
      recommendations.push('API 호출 간격 제한');
    }

    // 빈도 검사 (초당 호출 수)
    if (frequency >= this.warningThresholds.frequency) {
      isInfiniteLoop = true;
      recommendations.push('API 호출 빈도 제한');
      recommendations.push('디바운싱/스로틀링 적용');
    }

    return {
      isInfiniteLoop,
      callCount: continuousCount,
      frequency,
      pattern,
      recommendations
    };
  }

  /**
   * 시각적 경고 표시
   */
  private showVisualWarning(url: string, result: LoopDetectionResult): void {
    if (typeof document === 'undefined') return;

    // 기존 경고 제거
    const existingWarning = document.getElementById('infinite-loop-warning');
    if (existingWarning) {
      existingWarning.remove();
    }

    // 경고 요소 생성
    const warning = document.createElement('div');
    warning.id = 'infinite-loop-warning';
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      font-family: monospace;
      font-size: 14px;
      border: 2px solid #fca5a5;
    `;

    warning.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">
        🚨 INFINITE LOOP DETECTED!
      </div>
      <div style="margin-bottom: 4px;">URL: ${url}</div>
      <div style="margin-bottom: 4px;">Pattern: ${result.pattern}</div>
      <div style="margin-bottom: 4px;">Calls: ${result.callCount}</div>
      <div style="margin-bottom: 8px;">Frequency: ${result.frequency.toFixed(2)}/sec</div>
      <div style="font-size: 12px; opacity: 0.9;">
        ${result.recommendations.join(' • ')}
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: white;
        color: #dc2626;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 8px;
        cursor: pointer;
      ">
        닫기
      </button>
    `;

    document.body.appendChild(warning);

    // 10초 후 자동 제거
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
      }
    }, 10000);
  }

  /**
   * 실시간 모니터링 시작
   */
  startRealTimeMonitoring(): void {
    console.log('🔍 Starting real-time API monitoring...');

    setInterval(() => {
      this.generateMonitoringReport();
    }, 30000); // 30초마다 리포트
  }

  /**
   * 모니터링 리포트 생성
   */
  generateMonitoringReport(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentCalls = this.apiCalls.filter(call => call.timestamp > oneMinuteAgo);

    if (recentCalls.length === 0) return;

    // URL별 호출 횟수 집계
    const urlCounts = recentCalls.reduce((acc, call) => {
      acc[call.url] = (acc[call.url] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 높은 빈도 API 필터링
    const highFrequencyApis = Object.entries(urlCounts)
      .filter(([_, count]) => count > 5)
      .sort(([, a], [, b]) => b - a);

    if (highFrequencyApis.length > 0) {
      console.warn('📊 High frequency API calls in last minute:', {
        totalCalls: recentCalls.length,
        highFrequencyApis: Object.fromEntries(highFrequencyApis),
        authMeCalls: urlCounts['/api/auth/me'] || 0
      });
    }
  }

  /**
   * 현재 상태 조회
   */
  getStatus(): {
    totalCalls: number;
    recentCalls: number;
    authMeCalls: number;
    topApis: Array<{ url: string; count: number }>;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentCalls = this.apiCalls.filter(call => call.timestamp > oneMinuteAgo);

    const urlCounts = this.apiCalls.reduce((acc, call) => {
      acc[call.url] = (acc[call.url] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topApis = Object.entries(urlCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([url, count]) => ({ url, count }));

    return {
      totalCalls: this.apiCalls.length,
      recentCalls: recentCalls.length,
      authMeCalls: urlCounts['/api/auth/me'] || 0,
      topApis
    };
  }
}

// 전역 인스턴스 생성 및 export
export const clientLoopDetector = ClientSideLoopDetector.getInstance();

// 브라우저 콘솔에서 사용할 수 있는 전역 함수
if (typeof window !== 'undefined') {
  (window as any).detectLoops = () => {
    const detector = ClientSideLoopDetector.getInstance();
    const status = detector.getStatus();

    console.log('🔍 Loop Detection Status:', status);

    if (status.authMeCalls > 10) {
      console.warn('⚠️ High /api/auth/me call frequency detected:', status.authMeCalls);
    }

    return status;
  };

  (window as any).startLoopMonitoring = () => {
    const detector = ClientSideLoopDetector.getInstance();
    detector.startRealTimeMonitoring();
    console.log('✅ Real-time loop monitoring started');
  };
}

/**
 * React Hook으로 사용하기 위한 헬퍼
 */
export function useInfiniteLoopDetection(enabled: boolean = true) {
  if (typeof window === 'undefined' || !enabled) return null;

  const detector = ClientSideLoopDetector.getInstance();
  return {
    getStatus: () => detector.getStatus(),
    analyzePattern: (url: string) => detector.analyzeApiCallPattern(url),
    startMonitoring: () => detector.startRealTimeMonitoring()
  };
}