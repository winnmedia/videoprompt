import { logger } from './logger';

/**
 * 프로덕션 모니터링 클라이언트 - $300 사건 재발 방지
 * 자동 에러 추적 및 실시간 모니터링
 */

interface ErrorReport {
  endpoint: string;
  statusCode: number;
  errorType: string;
  message: string;
  context?: Record<string, any>;
}

interface MonitoringConfig {
  enabled: boolean;
  apiEndpoint: string;
  criticalPatterns: string[];
  maxRetries: number;
}

class ProductionMonitor {
  private static instance: ProductionMonitor;
  private config: MonitoringConfig;
  private errorQueue: ErrorReport[] = [];
  private isReporting = false;

  private constructor() {
    this.config = {
      enabled: typeof window !== 'undefined' && process.env.NODE_ENV === 'production',
      apiEndpoint: '/api/debug/production-monitor',
      criticalPatterns: [
        'INFINITE_LOOP_DETECTED',
        'AUTH_RETRY_STORM',
        'EXCESSIVE_API_CALLS',
        'MISSING_REFRESH_TOKEN',
        'useEffect',
        'checkAuth',
        'auth/me'
      ],
      maxRetries: 3
    };

    // 페이지 언로드 시 대기 중인 에러 보고
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushErrorQueue();
      });
    }
  }

  static getInstance(): ProductionMonitor {
    if (!ProductionMonitor.instance) {
      ProductionMonitor.instance = new ProductionMonitor();
    }
    return ProductionMonitor.instance;
  }

  /**
   * 에러 보고
   */
  async reportError(report: ErrorReport): Promise<void> {
    if (!this.config.enabled) {
      logger.info('🔍 [DEV] Error would be reported:', report);
      return;
    }

    // 중요한 패턴 감지
    const isCritical = this.config.criticalPatterns.some(pattern =>
      report.errorType.toLowerCase().includes(pattern.toLowerCase()) ||
      report.message.toLowerCase().includes(pattern.toLowerCase()) ||
      report.endpoint.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isCritical) {
      console.error('🚨 CRITICAL ERROR DETECTED - Immediate reporting:', report);
      await this.sendErrorReport(report);
    } else {
      // 일반 에러는 큐에 추가 후 배치 처리
      this.errorQueue.push(report);
      this.scheduleErrorReporting();
    }
  }

  /**
   * API 호출 성공 추적
   */
  async trackApiCall(endpoint: string, statusCode: number, responseTime?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await fetch(this.config.apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, statusCode, responseTime })
      });
    } catch (error) {
      // 모니터링 자체의 에러는 조용히 처리
      console.warn('Monitoring tracking failed:', error);
    }
  }

  /**
   * API 클라이언트 통합을 위한 에러 인터셉터
   */
  interceptApiError(url: string, response: Response, error?: Error): void {
    const report: ErrorReport = {
      endpoint: url,
      statusCode: response.status,
      errorType: this.getErrorType(response.status, error),
      message: error?.message || `HTTP ${response.status}: ${response.statusText}`,
      context: {
        url,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      }
    };

    this.reportError(report);
  }

  /**
   * 인증 관련 에러 특별 처리
   */
  reportAuthError(errorType: string, message: string, context?: Record<string, any>): void {
    const report: ErrorReport = {
      endpoint: '/api/auth/me', // 일반적으로 인증 에러가 발생하는 엔드포인트
      statusCode: 401,
      errorType: `AUTH_${errorType}`,
      message,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        authRelated: true
      }
    };

    this.reportError(report);
  }

  /**
   * $300 사건 패턴 감지 및 보고
   */
  detectInfiniteLoop(functionName: string, callCount: number): void {
    if (callCount > 10) { // 10회 이상 호출 시 경고
      const report: ErrorReport = {
        endpoint: '/api/auth/me',
        statusCode: 401,
        errorType: 'INFINITE_LOOP_DETECTED',
        message: `Potential infinite loop detected: ${functionName} called ${callCount} times`,
        context: {
          functionName,
          callCount,
          timestamp: new Date().toISOString(),
          critical: true
        }
      };

      console.error('🚨 INFINITE LOOP DETECTED:', report);
      this.reportError(report);
    }
  }

  /**
   * 시스템 상태 조회
   */
  async getSystemStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}?action=status`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return null;
    }
  }

  /**
   * 최근 에러 목록 조회
   */
  async getRecentErrors(): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}?action=errors`);
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch recent errors:', error);
      return null;
    }
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });

        if (response.ok) {
          return; // 성공적으로 전송됨
        }

        if (attempt === this.config.maxRetries - 1) {
          console.error('Failed to report error after all retries:', report);
        }
      } catch (error) {
        if (attempt === this.config.maxRetries - 1) {
          console.error('Error reporting completely failed:', error);
        }
      }

      // 재시도 전 대기 (백오프)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  private scheduleErrorReporting(): void {
    if (this.isReporting || this.errorQueue.length === 0) {
      return;
    }

    // 5초마다 또는 큐가 가득 찰 때 배치 전송
    setTimeout(() => {
      this.flushErrorQueue();
    }, 5000);
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0 || this.isReporting) {
      return;
    }

    this.isReporting = true;
    const errors = [...this.errorQueue];
    this.errorQueue = [];

    // 배치로 에러들을 전송
    for (const error of errors) {
      await this.sendErrorReport(error);
    }

    this.isReporting = false;
  }

  private getErrorType(statusCode: number, error?: Error): string {
    if (error) {
      if (error.message.includes('fetch')) return 'NETWORK_ERROR';
      if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (error.message.includes('abort')) return 'ABORTED_ERROR';
    }

    switch (statusCode) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 429: return 'RATE_LIMITED';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 503: return 'SERVICE_UNAVAILABLE';
      default: return `HTTP_${statusCode}`;
    }
  }
}

// 싱글턴 인스턴스 export
export const productionMonitor = ProductionMonitor.getInstance();

/**
 * API 클라이언트와의 통합을 위한 헬퍼 함수들
 */
export const monitoringHelpers = {
  /**
   * Fetch 래퍼 - 자동 모니터링 포함
   */
  async monitoredFetch(
    url: string,
    options?: RequestInit,
    context?: Record<string, any>
  ): Promise<Response> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        productionMonitor.trackApiCall(url, response.status, responseTime);
      } else {
        productionMonitor.interceptApiError(url, response);
      }

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 네트워크 에러를 모의 Response로 처리
      const mockResponse = new Response(null, {
        status: 0,
        statusText: 'Network Error'
      });

      productionMonitor.interceptApiError(url, mockResponse, error as Error);
      throw error;
    }
  },

  /**
   * useEffect 무한 루프 감지기
   */
  createLoopDetector(functionName: string) {
    let callCount = 0;
    let lastReset = Date.now();

    return () => {
      const now = Date.now();

      // 1분마다 카운터 리셋
      if (now - lastReset > 60000) {
        callCount = 0;
        lastReset = now;
      }

      callCount++;

      if (callCount > 5) {
        productionMonitor.detectInfiniteLoop(functionName, callCount);
      }
    };
  }
};