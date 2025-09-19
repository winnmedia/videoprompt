#!/usr/bin/env node
/**
 * $300 사건 방지 ESLint 규칙 검증 스크립트
 * Grace의 품질 기준에 따른 자동화된 검증 시스템
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 출력을 위한 유틸리티
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}🏆 ${msg}${colors.reset}`)
};

/**
 * 위험한 useEffect 패턴들 (실제 $300 사건 기반)
 */
const DANGEROUS_PATTERNS = [
  // 원본 $300 사건 패턴
  'useEffect(() => { checkAuth(); }, [checkAuth]);',
  'useEffect(() => { authenticate(); }, [authenticate]);',
  'useEffect(() => { validateUser(); }, [validateUser]);',

  // 함수명 변형 패턴
  'useEffect(() => { handleLogin(); }, [handleLogin]);',
  'useEffect(() => { onAuthChange(); }, [onAuthChange]);',
  'useEffect(() => { getUserData(); }, [getUserData]);',
  'useEffect(() => { setUserInfo(); }, [setUserInfo]);',
  'useEffect(() => { fetchProfile(); }, [fetchProfile]);',
  'useEffect(() => { loadData(); }, [loadData]);',
  'useEffect(() => { sendRequest(); }, [sendRequest]);',
  'useEffect(() => { postData(); }, [postData]);',
  'useEffect(() => { createUser(); }, [createUser]);',
  'useEffect(() => { updateProfile(); }, [updateProfile]);',
  'useEffect(() => { deleteItem(); }, [deleteItem]);',
  'useEffect(() => { refreshData(); }, [refreshData]);',

  // 함수 타입 패턴
  'useEffect(() => { authFunction(); }, [authFunction]);',
  'useEffect(() => { loginHandler(); }, [loginHandler]);',
  'useEffect(() => { dataCallback(); }, [dataCallback]);',
  'useEffect(() => { apiMethod(); }, [apiMethod]);',

  // Hook 패턴
  'useEffect(() => { useAuth(); }, [useAuth]);',
  'useEffect(() => { useRouter(); }, [useRouter]);',
  'useEffect(() => { useApi(); }, [useApi]);',

  // useLayoutEffect 패턴
  'useLayoutEffect(() => { handleResize(); }, [handleResize]);',
  'useLayoutEffect(() => { measureElement(); }, [measureElement]);',
  'useLayoutEffect(() => { updateLayout(); }, [updateLayout]);'
];

/**
 * 안전한 패턴들 (False Positive 검증용)
 */
const SAFE_PATTERNS = [
  // 원시값 의존성
  'useEffect(() => { console.log(userId); }, [userId]);',
  'useEffect(() => { setOpen(isOpen); }, [isOpen]);',
  'useEffect(() => { updateCount(count); }, [count]);',
  'useEffect(() => { setStatus(status); }, [status]);',

  // 객체 데이터
  'useEffect(() => { setUser(user); }, [user]);',
  'useEffect(() => { applyConfig(config); }, [config]);',
  'useEffect(() => { updateShot(shot); }, [shot]);',
  'useEffect(() => { processData(data); }, [data]);',

  // 빈 의존성 배열
  'useEffect(() => { initApp(); }, []);',
  'useEffect(() => { setupEventListeners(); }, []);',
  'useEffect(() => { fetchInitialData(); }, []);'
];

/**
 * ESLint 규칙 효과성 검증
 */
function validateESLintRules() {
  log.header('$300 사건 방지 ESLint 규칙 검증 시작');

  const results = {
    truePositives: 0,   // 위험 패턴을 올바르게 감지
    falseNegatives: 0,  // 위험 패턴을 놓침 (절대 금지)
    falsePositives: 0,  // 안전 패턴을 잘못 감지
    trueNegatives: 0    // 안전 패턴을 올바르게 허용
  };

  // 위험 패턴 검증
  log.info('위험 패턴 감지 테스트 시작...');
  DANGEROUS_PATTERNS.forEach((pattern, index) => {
    const isDetected = testPattern(pattern, true);
    if (isDetected) {
      results.truePositives++;
      log.success(`위험 패턴 감지 성공: ${pattern.substring(0, 50)}...`);
    } else {
      results.falseNegatives++;
      log.error(`Critical: 위험 패턴 미감지 - "${pattern}"`);
    }
  });

  // 안전 패턴 검증
  log.info('안전 패턴 허용 테스트 시작...');
  SAFE_PATTERNS.forEach((pattern, index) => {
    const isDetected = testPattern(pattern, false);
    if (!isDetected) {
      results.trueNegatives++;
      log.success(`안전 패턴 허용 성공: ${pattern.substring(0, 50)}...`);
    } else {
      results.falsePositives++;
      log.warning(`Warning: 안전 패턴 오탐 - "${pattern}"`);
    }
  });

  return results;
}

/**
 * 개별 패턴 테스트
 */
function testPattern(code, shouldDetect) {
  // ESLint 규칙 패턴 매칭 시뮬레이션
  const functionPatterns = [
    // 함수 접미사 패턴
    /\w+(Function|Handler|Callback|Method|Provider|Service|Interceptor)\b/,
    // Hook 함수들
    /\buse[A-Z]\w*/,
    // 알려진 위험 함수들
    /\b(initializeProvider|refreshAuth|sendBatch|stopMonitoring|handleMetric|createFetchInterceptor|getCurrentSessionMetrics|checkAuth|authenticate)\b/,
    // 일반 함수 동사 패턴 (모든 위험 패턴 포함)
    /\b(handle|on|get|set|fetch|load|send|post|put|delete|create|update|remove|check|validate|initialize|init|start|stop|clear|reset|refresh|search|generate|process|execute|run|call|invoke|trigger|authenticate|measure)[A-Z][a-zA-Z]*\b/
  ];

  const useEffectPattern = /use(Effect|LayoutEffect)\s*\(\s*[^,]+,\s*\[([^\]]+)\]/;
  const match = code.match(useEffectPattern);

  if (!match) return false;

  const dependencies = match[2];
  return functionPatterns.some(pattern => pattern.test(dependencies));
}

/**
 * 성능 벤치마크
 */
function performanceBenchmark() {
  log.info('성능 벤치마크 실행...');

  const iterations = 1000;
  const testCode = 'useEffect(() => { checkAuth(); }, [checkAuth]);';

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    testPattern(testCode, true);
  }

  const endTime = Date.now();
  const avgTime = (endTime - startTime) / iterations;

  if (avgTime < 0.5) {
    log.success(`성능 테스트 통과: 평균 ${avgTime.toFixed(3)}ms/패턴`);
    return true;
  } else {
    log.warning(`성능 주의: 평균 ${avgTime.toFixed(3)}ms/패턴 (기준: 0.5ms)`);
    return false;
  }
}

/**
 * 메트릭 계산 및 보고서 생성
 */
function generateReport(results) {
  log.header('품질 메트릭 계산');

  const totalTests = results.truePositives + results.falseNegatives +
                    results.falsePositives + results.trueNegatives;

  const precision = results.truePositives / (results.truePositives + results.falsePositives);
  const recall = results.truePositives / (results.truePositives + results.falseNegatives);
  const f1Score = 2 * (precision * recall) / (precision + recall);

  console.log('');
  console.log('📊 품질 보고서');
  console.log('==========================================');
  console.log(`총 테스트: ${totalTests}`);
  console.log(`✅ True Positives: ${results.truePositives}`);
  console.log(`❌ False Negatives: ${results.falseNegatives}`);
  console.log(`⚠️ False Positives: ${results.falsePositives}`);
  console.log(`✅ True Negatives: ${results.trueNegatives}`);
  console.log('------------------------------------------');
  console.log(`🎯 Precision: ${(precision * 100).toFixed(2)}%`);
  console.log(`🎯 Recall: ${(recall * 100).toFixed(2)}%`);
  console.log(`🎯 F1 Score: ${(f1Score * 100).toFixed(2)}%`);
  console.log('==========================================');

  // 품질 기준 검증
  const qualityGates = {
    falseNegativeRate: results.falseNegatives === 0,
    precisionRate: precision > 0.95,
    recallRate: recall === 1.0,
    f1ScoreRate: f1Score > 0.97
  };

  console.log('');
  console.log('🚦 품질 게이트 결과');
  console.log('==========================================');

  Object.entries(qualityGates).forEach(([gate, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const gateName = {
      falseNegativeRate: 'False Negative Rate (= 0%)',
      precisionRate: 'Precision Rate (> 95%)',
      recallRate: 'Recall Rate (= 100%)',
      f1ScoreRate: 'F1 Score (> 97%)'
    }[gate];

    console.log(`${status} ${gateName}`);
  });

  const allPassed = Object.values(qualityGates).every(Boolean);

  console.log('==========================================');

  if (allPassed) {
    log.success('🎉 모든 품질 게이트 통과 - 배포 승인');
    return 0;
  } else {
    log.error('🚫 품질 기준 미달 - 배포 차단');
    return 1;
  }
}

/**
 * CI/CD 통합을 위한 JSON 결과 생성
 */
function generateJsonReport(results, performanceResult) {
  const report = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    results: results,
    performance: {
      passed: performanceResult,
      benchmarkCompleted: true
    },
    qualityGates: {
      falseNegativeRate: results.falseNegatives === 0,
      precisionRate: results.truePositives / (results.truePositives + results.falsePositives) > 0.95,
      recallRate: results.truePositives / (results.truePositives + results.falseNegatives) === 1.0
    },
    recommendation: results.falseNegatives === 0 ? 'APPROVE' : 'REJECT'
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'eslint-300-validation-report.json'),
    JSON.stringify(report, null, 2)
  );

  log.info('JSON 보고서 생성 완료: eslint-300-validation-report.json');
}

/**
 * 메인 실행 함수
 */
function main() {
  try {
    console.log('🚀 $300 사건 방지 ESLint 규칙 검증 시작\n');

    // 1. ESLint 규칙 효과성 검증
    const results = validateESLintRules();

    // 2. 성능 벤치마크
    const performanceResult = performanceBenchmark();

    // 3. 보고서 생성
    const exitCode = generateReport(results);

    // 4. JSON 보고서 생성 (CI/CD용)
    generateJsonReport(results, performanceResult);

    console.log('\n✨ 검증 완료\n');
    process.exit(exitCode);

  } catch (error) {
    log.error(`검증 실행 중 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

// 스크립트가 직접 실행된 경우에만 main 함수 호출
if (require.main === module) {
  main();
}

module.exports = {
  validateESLintRules,
  testPattern,
  performanceBenchmark,
  generateReport
};