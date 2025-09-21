import { logger } from './logger';

/**
 * API 호출 모니터링 및 플래키 테스트 방지 유틸리티
 *
 * 목표:
 * 1. 테스트 중 API 호출 패턴 분석
 * 2. 플래키 테스트 원인 감지
 * 3. 성능 회귀 감지
 * 4. $300 사건 같은 비용 폭탄 방지
 * 5. 결정론적 테스트 환경 보장
 */

// API 호출 추적 데이터
interface APICall {
  method: string;
  url: string;
  timestamp: number;
  duration: number;
  status: number;
  headers: Record<string, string>;
  testName?: string;
  stackTrace?: string;
}

// 플래키 테스트 패턴
interface FlakinessPatter {
  pattern: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detector: (calls: APICall[]) => boolean;
  solution: string;
}

// 모니터링 통계
interface MonitoringStats {
  totalCalls: number;
  uniqueEndpoints: number;
  averageResponseTime: number;
  errorRate: number;
  flakyPatterns: string[];
  costRisk: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

class APIMonitor {
  private calls: APICall[] = [];
  private isEnabled: boolean = true;
  private testName: string = 'unknown';
  private startTime: number = Date.now();

  // 플래키 테스트 패턴 정의
  private flakinessPatterns: FlakinessPatter[] = [
    {
      pattern: 'rapid_succession',
      description: '$300 사건 패턴: 1초 내 동일 엔드포인트 10회 이상 호출',
      severity: 'critical',
      detector: (calls) => {
        const groups = this.groupCallsByEndpoint(calls);
        return Object.values(groups).some(group => {
          const recentCalls = group.filter(call =>
            Date.now() - call.timestamp < 1000
          );
          return recentCalls.length > 10;
        });
      },
      solution: 'useEffect 의존성 배열 점검, API 호출 캐싱 구현'
    },
    {
      pattern: 'auth_polling',
      description: '인증 상태 폴링: auth/me 연속 호출',
      severity: 'high',
      detector: (calls) => {
        const authCalls = calls.filter(call =>
          call.url.includes('/auth/me')
        );
        return authCalls.length > 5;
      },
      solution: '인증 상태를 전역 상태로 관리, 불필요한 재호출 방지'
    },
    {
      pattern: 'retry_storm',
      description: '실패한 요청의 과도한 재시도',
      severity: 'high',
      detector: (calls) => {
        const failedCalls = calls.filter(call => call.status >= 400);
        const totalCalls = calls.length;
        return failedCalls.length > 0 && (failedCalls.length / totalCalls) > 0.5;
      },
      solution: '지수 백오프 구현, 최대 재시도 횟수 제한'
    },
    {
      pattern: 'parallel_redundancy',
      description: '동일한 데이터에 대한 중복 병렬 요청',
      severity: 'medium',
      detector: (calls) => {
        const parallelGroups = this.groupParallelCalls(calls);
        return parallelGroups.some(group =>
          group.length > 3 && this.hasSimilarUrls(group)
        );
      },
      solution: '요청 중복 제거, 캐싱 레이어 구현'
    },
    {
      pattern: 'response_timeout',
      description: '응답 시간 초과로 인한 불안정성',
      severity: 'medium',
      detector: (calls) => {
        const slowCalls = calls.filter(call => call.duration > 5000);
        return slowCalls.length > calls.length * 0.1; // 10% 이상이 5초 초과
      },
      solution: '타임아웃 설정 최적화, MSW 응답 시간 조정'
    }
  ];

  // API 호출 추적 시작
  startTracking(testName: string): void {
    this.testName = testName;
    this.calls = [];
    this.startTime = Date.now();
    this.isEnabled = true;

    // fetch 함수 모킹하여 호출 추적
    const originalFetch = global.fetch;
    const monitorFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!this.isEnabled) return originalFetch(input, init);

      const startTime = Date.now();
      const url = input.toString();
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(input, init);

        this.recordCall({
          method,
          url,
          timestamp: startTime,
          duration: Date.now() - startTime,
          status: response.status,
          headers: this.extractHeaders(init?.headers),
          testName: this.testName,
          stackTrace: this.getStackTrace()
        });

        return response;
      } catch (error) {
        this.recordCall({
          method,
          url,
          timestamp: startTime,
          duration: Date.now() - startTime,
          status: 0, // 네트워크 에러
          headers: this.extractHeaders(init?.headers),
          testName: this.testName,
          stackTrace: this.getStackTrace()
        });
        throw error;
      }
    };

    global.fetch = monitorFetch as typeof global.fetch;
  }

  // API 호출 추적 중지
  stopTracking(): MonitoringStats {
    this.isEnabled = false;
    return this.generateStats();
  }

  // 호출 기록
  private recordCall(call: APICall): void {
    if (!this.isEnabled) return;

    this.calls.push(call);

    // 실시간 위험 감지
    if (this.detectImmediateRisk(call)) {
      logger.debug(`🚨 API Risk Detected in ${this.testName}:`, {
        pattern: 'immediate_risk',
        call,
        recommendation: 'Check for infinite loops or rapid API calls'
      });
    }
  }

  // 즉시 위험 감지 (실시간)
  private detectImmediateRisk(call: APICall): boolean {
    const recentCalls = this.calls.filter(c =>
      c.url === call.url &&
      call.timestamp - c.timestamp < 1000
    );

    // 1초 내 동일 엔드포인트 5회 이상 호출
    return recentCalls.length >= 5;
  }

  // 헤더 추출
  private extractHeaders(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) return {};

    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    if (Array.isArray(headers)) {
      const result: Record<string, string> = {};
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
      return result;
    }

    return headers as Record<string, string>;
  }

  // 스택 트레이스 추출
  private getStackTrace(): string {
    try {
      throw new Error();
    } catch (e) {
      return (e as Error).stack?.split('\n').slice(3, 8).join('\n') || '';
    }
  }

  // 엔드포인트별 호출 그룹화
  private groupCallsByEndpoint(calls: APICall[]): Record<string, APICall[]> {
    return calls.reduce((groups, call) => {
      const endpoint = this.normalizeEndpoint(call.url);
      if (!groups[endpoint]) groups[endpoint] = [];
      groups[endpoint].push(call);
      return groups;
    }, {} as Record<string, APICall[]>);
  }

  // 병렬 호출 그룹화 (50ms 내 호출)
  private groupParallelCalls(calls: APICall[]): APICall[][] {
    const groups: APICall[][] = [];
    const sortedCalls = [...calls].sort((a, b) => a.timestamp - b.timestamp);

    let currentGroup: APICall[] = [];
    let groupStartTime = 0;

    sortedCalls.forEach(call => {
      if (currentGroup.length === 0 || call.timestamp - groupStartTime < 50) {
        if (currentGroup.length === 0) groupStartTime = call.timestamp;
        currentGroup.push(call);
      } else {
        groups.push(currentGroup);
        currentGroup = [call];
        groupStartTime = call.timestamp;
      }
    });

    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups.filter(group => group.length > 1);
  }

  // 유사한 URL 감지
  private hasSimilarUrls(calls: APICall[]): boolean {
    const normalizedUrls = calls.map(call => this.normalizeEndpoint(call.url));
    const uniqueUrls = new Set(normalizedUrls);
    return uniqueUrls.size < calls.length * 0.8; // 80% 이상이 동일한 엔드포인트
  }

  // 엔드포인트 정규화 (파라미터 제거)
  private normalizeEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url.split('?')[0];
    }
  }

  // 통계 생성
  private generateStats(): MonitoringStats {
    const totalCalls = this.calls.length;
    const uniqueEndpoints = new Set(
      this.calls.map(call => this.normalizeEndpoint(call.url))
    ).size;

    const totalDuration = this.calls.reduce((sum, call) => sum + call.duration, 0);
    const averageResponseTime = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const errorCalls = this.calls.filter(call => call.status >= 400).length;
    const errorRate = totalCalls > 0 ? errorCalls / totalCalls : 0;

    const detectedPatterns = this.flakinessPatterns
      .filter(pattern => pattern.detector(this.calls))
      .map(pattern => pattern.pattern);

    const costRisk = this.calculateCostRisk(totalCalls, detectedPatterns);
    const recommendations = this.generateRecommendations(detectedPatterns);

    return {
      totalCalls,
      uniqueEndpoints,
      averageResponseTime,
      errorRate,
      flakyPatterns: detectedPatterns,
      costRisk,
      recommendations
    };
  }

  // 비용 위험도 계산
  private calculateCostRisk(totalCalls: number, patterns: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (patterns.includes('rapid_succession') || totalCalls > 100) {
      return 'critical';
    }
    if (patterns.includes('auth_polling') || patterns.includes('retry_storm') || totalCalls > 50) {
      return 'high';
    }
    if (patterns.length > 1 || totalCalls > 20) {
      return 'medium';
    }
    return 'low';
  }

  // 권장사항 생성
  private generateRecommendations(patterns: string[]): string[] {
    const recommendations = new Set<string>();

    patterns.forEach(pattern => {
      const patternDef = this.flakinessPatterns.find(p => p.pattern === pattern);
      if (patternDef) {
        recommendations.add(patternDef.solution);
      }
    });

    // 기본 권장사항
    if (recommendations.size === 0) {
      recommendations.add('API 호출 패턴이 양호합니다. 현재 구조를 유지하세요.');
    }

    return Array.from(recommendations);
  }

  // 상세 리포트 생성
  generateDetailedReport(): string {
    const stats = this.generateStats();
    const testDuration = Date.now() - this.startTime;

    let report = `
🔍 API 모니터링 리포트 - ${this.testName}
===============================================

📊 기본 통계:
- 총 API 호출: ${stats.totalCalls}회
- 고유 엔드포인트: ${stats.uniqueEndpoints}개
- 평균 응답시간: ${stats.averageResponseTime.toFixed(2)}ms
- 에러율: ${(stats.errorRate * 100).toFixed(1)}%
- 테스트 소요시간: ${testDuration}ms

🚨 비용 위험도: ${stats.costRisk.toUpperCase()}

`;

    if (stats.flakyPatterns.length > 0) {
      report += `⚠️ 감지된 플래키 패턴:\n`;
      stats.flakyPatterns.forEach(pattern => {
        const patternDef = this.flakinessPatterns.find(p => p.pattern === pattern);
        if (patternDef) {
          report += `- ${pattern}: ${patternDef.description}\n`;
        }
      });
      report += '\n';
    }

    report += `💡 권장사항:\n`;
    stats.recommendations.forEach(rec => {
      report += `- ${rec}\n`;
    });

    // 엔드포인트별 상세 분석
    const endpointGroups = this.groupCallsByEndpoint(this.calls);
    if (Object.keys(endpointGroups).length > 0) {
      report += `\n📋 엔드포인트별 상세:\n`;
      Object.entries(endpointGroups).forEach(([endpoint, calls]) => {
        const avgTime = calls.reduce((sum, call) => sum + call.duration, 0) / calls.length;
        const errorCount = calls.filter(call => call.status >= 400).length;
        report += `- ${endpoint}: ${calls.length}회 호출, 평균 ${avgTime.toFixed(2)}ms, 에러 ${errorCount}회\n`;
      });
    }

    return report;
  }

  // 현재 통계 조회
  getCurrentStats(): MonitoringStats {
    return this.generateStats();
  }

  // 모든 호출 기록 조회
  getAllCalls(): APICall[] {
    return [...this.calls];
  }

  // 특정 패턴의 호출만 필터링
  getCallsByPattern(pattern: (call: APICall) => boolean): APICall[] {
    return this.calls.filter(pattern);
  }
}

// 전역 모니터 인스턴스
const globalAPIMonitor = new APIMonitor();

// 테스트 유틸리티 함수들
export const apiMonitoring = {
  // 테스트 시작 시 호출
  startTest: (testName: string) => {
    globalAPIMonitor.startTracking(testName);
  },

  // 테스트 종료 시 호출
  endTest: (): MonitoringStats => {
    return globalAPIMonitor.stopTracking();
  },

  // 현재 통계 조회
  getStats: (): MonitoringStats => {
    return globalAPIMonitor.getCurrentStats();
  },

  // 상세 리포트 생성
  generateReport: (): string => {
    return globalAPIMonitor.generateDetailedReport();
  },

  // 특정 조건의 호출 조회
  findCalls: (predicate: (call: APICall) => boolean): APICall[] => {
    return globalAPIMonitor.getCallsByPattern(predicate);
  },

  // $300 사건 위험도 체크
  checkCostRisk: (): boolean => {
    const stats = globalAPIMonitor.getCurrentStats();
    return stats.costRisk === 'critical' || stats.flakyPatterns.includes('rapid_succession');
  },

  // 플래키 테스트 감지
  detectFlakiness: (): string[] => {
    const stats = globalAPIMonitor.getCurrentStats();
    return stats.flakyPatterns;
  }
};

// Vitest 플러그인으로 자동 모니터링
export const createAPIMonitoringPlugin = () => {
  return {
    name: 'api-monitoring',
    setup(api: any) {
      api.onTestBegin?.((test: any) => {
        apiMonitoring.startTest(test.name);
      });

      api.onTestEnd?.((test: any, result: any) => {
        const stats = apiMonitoring.endTest();

        // 위험한 패턴 감지 시 경고
        if (stats.costRisk === 'critical') {
          logger.debug(`🚨 CRITICAL: Test "${test.name}" has high API cost risk!`);
          logger.debug(apiMonitoring.generateReport());
        }

        // 테스트 실패 시 API 패턴 분석
        if (result.state === 'fail' && stats.flakyPatterns.length > 0) {
          logger.info(`🔍 Test failure analysis for "${test.name}":`);
          logger.info(apiMonitoring.generateReport());
        }
      });
    }
  };
};

export type { APICall, MonitoringStats, FlakinessPatter };
export { APIMonitor };
