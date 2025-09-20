/**
 * $300 사건 방지 자동 검증 시스템
 *
 * GREEN 단계: 테스트를 통과시키는 최소 구현
 * Grace의 무관용 품질 정책에 따른 비용 위험 감지 엔진
 */

export enum CostRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface InfiniteLoopDetection {
  isRisky: boolean;
  riskLevel: CostRiskLevel;
  violations: string[];
  estimatedCost: number;
  details?: {
    pattern: string;
    frequency: string;
    endpoint: string;
  };
}

export interface ApiCallPattern {
  endpoint: string;
  timestamp: number;
  duration: number;
}

export interface CostAnalysis {
  estimatedDailyCost: number;
  riskFactors: string[];
  preventionRequired: boolean;
  actionRequired: string;
}

/**
 * 무한 루프 패턴 감지
 * 실제 $300 사건을 기반으로 한 패턴 매칭
 */
export function detectInfiniteLoops(code: string): InfiniteLoopDetection {
  const result: InfiniteLoopDetection = {
    isRisky: false,
    riskLevel: CostRiskLevel.LOW,
    violations: [],
    estimatedCost: 0
  };

  // useEffect/useLayoutEffect 패턴 분석
  const effectPatterns = [
    /useEffect\s*\(\s*[^,]+,\s*\[([^\]]+)\]/g,
    /useLayoutEffect\s*\(\s*[^,]+,\s*\[([^\]]+)\]/g
  ];

  // 위험한 함수 패턴들
  const dangerousFunctionPatterns = [
    // 원본 $300 사건 패턴
    /\b(checkAuth|authenticate|validateUser|authenticateUser)\b/,
    // 함수 접미사 패턴
    /\w+(Function|Handler|Callback|Method|Provider|Service|Interceptor)\b/,
    // Hook 함수들
    /\buse[A-Z]\w*/,
    // 일반 동사 패턴
    /\b(handle|on|get|set|fetch|load|send|post|put|delete|create|update|remove|check|validate|initialize|init|start|stop|clear|reset|refresh|search|generate|process|execute|run|call|invoke|trigger|measure)[A-Z][a-zA-Z]*\b/
  ];

  for (const effectPattern of effectPatterns) {
    let match;
    while ((match = effectPattern.exec(code)) !== null) {
      const dependencies = match[1];

      // 빈 의존성 배열은 안전
      if (dependencies.trim() === '') {
        continue;
      }

      // 1. 먼저 특수한 중첩 함수 패턴 검사 (우선순위 높음)
      if (/fetch\w*Data/i.test(dependencies)) {
        result.isRisky = true;
        result.riskLevel = CostRiskLevel.CRITICAL;
        result.violations.push('nested-function-dependency');
        result.estimatedCost = 200;
        return result;
      }

      // 2. 일반적인 위험한 함수 패턴 검사
      for (const dangerousPattern of dangerousFunctionPatterns) {
        if (dangerousPattern.test(dependencies)) {
          result.isRisky = true;
          result.riskLevel = CostRiskLevel.CRITICAL;

          // 특정 위반 사항 기록
          if (effectPattern.source.includes('useLayoutEffect')) {
            result.violations.push('layout-effect-function-dependency');
          } else {
            result.violations.push('function-in-dependency');
          }

          // 비용 추정 (매우 보수적)
          result.estimatedCost = 300; // $300 사건 기준

          result.details = {
            pattern: 'useEffect-function-dependency',
            frequency: 'per-render',
            endpoint: '/api/auth/me' // 가장 일반적인 위험 엔드포인트
          };

          return result;
        }
      }
    }
  }

  return result;
}

/**
 * API 호출 패턴 분석
 * 연속 호출, 폴링 패턴 등 위험한 호출 패턴 감지
 */
export function validateApiCallPatterns(patterns: ApiCallPattern[]): InfiniteLoopDetection {
  const result: InfiniteLoopDetection = {
    isRisky: false,
    riskLevel: CostRiskLevel.LOW,
    violations: [],
    estimatedCost: 0
  };

  if (patterns.length === 0) {
    return result;
  }

  // 1. 연속 호출 패턴 감지 (1초 내 5회 이상)
  const rapidCalls = patterns.filter((call, index) => {
    if (index === 0) return false;

    const prevCall = patterns[index - 1];
    const timeDiff = call.timestamp - prevCall.timestamp;
    return timeDiff < 1000 && call.endpoint === prevCall.endpoint;
  });

  if (rapidCalls.length >= 4) { // 5회 연속 호출
    result.isRisky = true;
    result.riskLevel = CostRiskLevel.CRITICAL;
    result.violations.push('rapid-succession');
    result.estimatedCost = 100; // 연속 호출 비용
  }

  // 2. 인증 폴링 패턴 감지 (1분간 10회 이상)
  const authCalls = patterns.filter(call =>
    call.endpoint.includes('/auth/') || call.endpoint.includes('/validate')
  );

  if (authCalls.length >= 10) {
    const timeSpan = authCalls[authCalls.length - 1].timestamp - authCalls[0].timestamp;
    if (timeSpan <= 60000) { // 1분 이내
      result.isRisky = true;
      result.riskLevel = CostRiskLevel.CRITICAL;
      result.violations.push('auth-polling');
      result.estimatedCost = Math.max(result.estimatedCost, 150);
    }
  }

  return result;
}

/**
 * 비용 위험도 분석 및 추정
 */
export function analyzeCostRisk(detection: InfiniteLoopDetection): CostAnalysis {
  const analysis: CostAnalysis = {
    estimatedDailyCost: 0,
    riskFactors: [],
    preventionRequired: false,
    actionRequired: 'MONITOR'
  };

  if (!detection.isRisky) {
    return analysis;
  }

  // 기본 비용 계산
  let dailyCost = detection.estimatedCost;

  // 위험 요소별 비용 증폭
  if (detection.violations.includes('function-in-dependency')) {
    analysis.riskFactors.push('high-frequency-auth-calls');
    dailyCost *= 1.5; // 50% 증가
  }

  if (detection.violations.includes('rapid-succession')) {
    analysis.riskFactors.push('rapid-api-succession');
    dailyCost *= 2; // 100% 증가
  }

  if (detection.violations.includes('auth-polling')) {
    analysis.riskFactors.push('continuous-auth-polling');
    dailyCost *= 1.8; // 80% 증가
  }

  analysis.estimatedDailyCost = Math.round(dailyCost);

  // 액션 결정
  if (analysis.estimatedDailyCost >= 300) {
    analysis.actionRequired = 'IMMEDIATE_BLOCK';
    analysis.preventionRequired = true;
  } else if (analysis.estimatedDailyCost >= 100) {
    analysis.actionRequired = 'URGENT_REVIEW';
    analysis.preventionRequired = true;
  } else {
    analysis.actionRequired = 'MONITOR';
    analysis.preventionRequired = false;
  }

  return analysis;
}

/**
 * 코드베이스 전체 스캔
 */
export function scanCodebase(codeContent: string): InfiniteLoopDetection[] {
  const files = codeContent.split('--- FILE: ');
  const results: InfiniteLoopDetection[] = [];

  for (const file of files) {
    if (file.trim()) {
      const detection = detectInfiniteLoops(file);
      if (detection.isRisky) {
        results.push(detection);
      }
    }
  }

  return results;
}

/**
 * Grace의 품질 게이트 검증
 */
export function runQualityGates(codeContent: string): {
  passed: boolean;
  violations: string[];
  blockers: string[];
  warnings: string[];
} {
  const detection = detectInfiniteLoops(codeContent);
  const costAnalysis = analyzeCostRisk(detection);

  const result = {
    passed: true,
    violations: [] as string[],
    blockers: [] as string[],
    warnings: [] as string[]
  };

  // 크리티컬 위반 사항 검사
  if (detection.isRisky && detection.riskLevel === CostRiskLevel.CRITICAL) {
    result.passed = false;
    result.blockers.push(`Critical: $300 risk pattern detected - ${detection.violations.join(', ')}`);
    result.violations.push(...detection.violations);
  }

  // 비용 임계값 검사
  if (costAnalysis.estimatedDailyCost >= 100) {
    result.passed = false;
    result.blockers.push(`Cost threshold exceeded: $${costAnalysis.estimatedDailyCost}/day estimated`);
  }

  // 예방 조치 필요 검사
  if (costAnalysis.preventionRequired) {
    result.passed = false;
    result.blockers.push(`Prevention required: ${costAnalysis.actionRequired}`);
  }

  return result;
}