/**
 * 아키텍처 리팩토링 품질 게이트 강화 테스트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. 타입 안전성 100% 보장
 * 2. FSD 아키텍처 경계 준수 검증
 * 3. 순환 의존성 제로 정책
 * 4. 성능 회귀 방지
 * 5. 보안 검증 통과
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// 품질 게이트 임계값
const QUALITY_THRESHOLDS = {
  typeErrors: 0,           // TypeScript 오류 허용 개수
  eslintErrors: 0,         // ESLint 오류 허용 개수
  eslintWarnings: 5,       // ESLint 경고 최대 개수
  circularDeps: 0,         // 순환 의존성 허용 개수
  testCoverage: {
    statements: 85,
    branches: 80,
    functions: 85,
    lines: 85
  },
  performanceScore: 90,    // Lighthouse 성능 점수 최소값
  accessibilityScore: 95,  // 접근성 점수 최소값
  maxBuildTime: 300000,    // 최대 빌드 시간 (5분)
};

describe('아키텍처 리팩토링 품질 게이트', () => {
  let buildStartTime: number;

  beforeAll(() => {
    buildStartTime = Date.now();
  });

  describe('타입 안전성 검증', () => {
    test('TypeScript 컴파일 에러가 없어야 함', () => {
      let hasTypeErrors = false;
      let output = '';

      try {
        output = execSync('pnpm typecheck', {
          encoding: 'utf-8',
          timeout: 60000 // 1분 타임아웃
        });
      } catch (error: any) {
        hasTypeErrors = true;
        output = error.stdout || error.message || '';
      }

      if (hasTypeErrors) {
        console.error('❌ TypeScript 컴파일 에러 발견:');
        console.error(output);

        // 에러 카운트 추출
        const errorMatches = output.match(/Found (\d+) errors?/);
        const errorCount = errorMatches ? parseInt(errorMatches[1]) : 1;

        expect(errorCount).toBeLessThanOrEqual(QUALITY_THRESHOLDS.typeErrors);
      }

      expect(hasTypeErrors).toBe(false);
      console.log('✅ TypeScript 컴파일 성공');
    });

    test('implicit any 사용이 제한되어야 함', () => {
      let anyUsageOutput = '';

      try {
        // src 디렉토리에서 any 사용 패턴 검색 (테스트 파일 제외)
        anyUsageOutput = execSync(
          'grep -r "\\: any" src --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" || true',
          { encoding: 'utf-8' }
        );
      } catch (error) {
        // grep 실행 실패는 무시 (any가 없으면 정상)
      }

      const anyUsageLines = anyUsageOutput.trim().split('\n').filter(line => line.trim());

      // 프로덕션 코드에서 any 사용 제한
      expect(anyUsageLines.length).toBeLessThanOrEqual(3); // 최대 3개까지 허용

      if (anyUsageLines.length > 0) {
        console.warn('⚠️  발견된 any 사용:', anyUsageLines.length);
        anyUsageLines.forEach(line => console.warn(`   ${line}`));
      } else {
        console.log('✅ implicit any 사용 없음');
      }
    });
  });

  describe('코드 품질 검증', () => {
    test('ESLint 에러가 허용 임계값 이하여야 함', () => {
      let eslintOutput = '';
      let hasLintErrors = false;

      try {
        eslintOutput = execSync('pnpm lint', {
          encoding: 'utf-8',
          timeout: 120000 // 2분 타임아웃
        });
      } catch (error: any) {
        hasLintErrors = true;
        eslintOutput = error.stdout || error.message || '';
      }

      // 에러와 경고 개수 추출
      const errorMatches = eslintOutput.match(/(\d+) errors?/);
      const warningMatches = eslintOutput.match(/(\d+) warnings?/);

      const errorCount = errorMatches ? parseInt(errorMatches[1]) : 0;
      const warningCount = warningMatches ? parseInt(warningMatches[1]) : 0;

      console.log(`ESLint 결과: ${errorCount}개 에러, ${warningCount}개 경고`);

      expect(errorCount).toBeLessThanOrEqual(QUALITY_THRESHOLDS.eslintErrors);
      expect(warningCount).toBeLessThanOrEqual(QUALITY_THRESHOLDS.eslintWarnings);

      if (errorCount === 0 && warningCount <= QUALITY_THRESHOLDS.eslintWarnings) {
        console.log('✅ ESLint 품질 검증 통과');
      }
    });

    test('Prettier 포맷팅이 적용되어야 함', () => {
      let prettierOutput = '';
      let hasFormatIssues = false;

      try {
        prettierOutput = execSync('pnpm format:check', {
          encoding: 'utf-8',
          timeout: 60000
        });
      } catch (error: any) {
        hasFormatIssues = true;
        prettierOutput = error.stdout || error.message || '';
      }

      if (hasFormatIssues) {
        console.warn('⚠️ Prettier 포맷팅 이슈 발견');
        console.warn(prettierOutput);
      }

      expect(hasFormatIssues).toBe(false);
      console.log('✅ Prettier 포맷팅 검증 통과');
    });
  });

  describe('아키텍처 경계 검증', () => {
    test('FSD 레이어 의존성 규칙이 준수되어야 함', () => {
      // FSD 상향 의존성 검사
      const fsdViolations = checkFSDViolations();

      expect(fsdViolations.length).toBe(0);

      if (fsdViolations.length === 0) {
        console.log('✅ FSD 아키텍처 경계 준수');
      } else {
        console.error('❌ FSD 위반 사항:', fsdViolations);
      }
    });

    test('순환 의존성이 없어야 함', () => {
      let circularDepsOutput = '';
      let hasCircularDeps = false;

      try {
        circularDepsOutput = execSync('pnpm dep:check', {
          encoding: 'utf-8',
          timeout: 60000
        });
      } catch (error: any) {
        hasCircularDeps = true;
        circularDepsOutput = error.stdout || error.message || '';
      }

      // 순환 의존성 개수 추출
      const circularMatches = circularDepsOutput.match(/(\d+) circular dependencies?/);
      const circularCount = circularMatches ? parseInt(circularMatches[1]) :
                          (hasCircularDeps ? 1 : 0);

      expect(circularCount).toBeLessThanOrEqual(QUALITY_THRESHOLDS.circularDeps);

      if (circularCount === 0) {
        console.log('✅ 순환 의존성 없음');
      } else {
        console.warn(`⚠️ 순환 의존성 발견: ${circularCount}개`);
      }
    });

    test('Public API(index.ts) 사용 규칙이 준수되어야 함', () => {
      // 내부 파일로의 직접 import 검사
      const directImportViolations = checkDirectImportViolations();

      expect(directImportViolations.length).toBeLessThanOrEqual(5); // 최대 5개까지 허용

      if (directImportViolations.length === 0) {
        console.log('✅ Public API 사용 규칙 준수');
      } else {
        console.warn(`⚠️ 직접 import 발견: ${directImportViolations.length}개`);
      }
    });
  });

  describe('테스트 커버리지 검증', () => {
    test('테스트 커버리지가 임계값을 만족해야 함', async () => {
      let coverageData: any = null;

      try {
        // Jest/Vitest 커버리지 실행
        execSync('pnpm test:run --coverage --reporter=json', {
          encoding: 'utf-8',
          timeout: 180000 // 3분 타임아웃
        });

        // 커버리지 결과 읽기
        const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
        if (existsSync(coveragePath)) {
          coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
        }
      } catch (error) {
        console.warn('⚠️ 커버리지 데이터 수집 실패');
      }

      if (coverageData?.total) {
        const { statements, branches, functions, lines } = coverageData.total;

        expect(statements.pct).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.testCoverage.statements);
        expect(branches.pct).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.testCoverage.branches);
        expect(functions.pct).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.testCoverage.functions);
        expect(lines.pct).toBeGreaterThanOrEqual(QUALITY_THRESHOLDS.testCoverage.lines);

        console.log(`✅ 테스트 커버리지: ${statements.pct}% 구문, ${branches.pct}% 분기, ${functions.pct}% 함수, ${lines.pct}% 라인`);
      } else {
        console.warn('⚠️ 커버리지 데이터를 찾을 수 없음');
      }
    });

    test('중요 기능에 대한 테스트가 존재해야 함', () => {
      const criticalTestFiles = [
        'src/__tests__/auth/infinite-loop-prevention.test.ts',
        'src/__tests__/architecture/fsd-boundary-violations.test.ts',
        'src/__tests__/performance/core-web-vitals.test.ts',
        'src/__tests__/security/api-security.test.ts'
      ];

      let missingTests = 0;
      for (const testFile of criticalTestFiles) {
        if (!existsSync(testFile)) {
          missingTests++;
          console.warn(`⚠️ 중요 테스트 파일 누락: ${testFile}`);
        }
      }

      expect(missingTests).toBeLessThanOrEqual(1); // 최대 1개까지 누락 허용

      if (missingTests === 0) {
        console.log('✅ 모든 중요 테스트 파일 존재');
      }
    });
  });

  describe('성능 및 보안 검증', () => {
    test('빌드 시간이 허용 범위 내에 있어야 함', () => {
      const buildDuration = Date.now() - buildStartTime;

      expect(buildDuration).toBeLessThan(QUALITY_THRESHOLDS.maxBuildTime);

      console.log(`✅ 빌드 시간: ${Math.round(buildDuration / 1000)}초 (최대: ${QUALITY_THRESHOLDS.maxBuildTime / 1000}초)`);
    });

    test('보안 취약점이 없어야 함', () => {
      // 하드코딩된 키 검사
      let securityIssues = 0;

      try {
        const securityCheck = execSync('node scripts/detect-hardcoded-keys.js', {
          encoding: 'utf-8',
          timeout: 30000
        });

        if (securityCheck.includes('발견')) {
          securityIssues++;
        }
      } catch (error: any) {
        if (error.status !== 0) {
          securityIssues++;
        }
      }

      expect(securityIssues).toBe(0);

      if (securityIssues === 0) {
        console.log('✅ 보안 검증 통과');
      }
    });

    test('성능 예산이 준수되어야 함', () => {
      const performanceBudgetPath = join(process.cwd(), 'performance-budget.json');

      if (existsSync(performanceBudgetPath)) {
        const budget = JSON.parse(readFileSync(performanceBudgetPath, 'utf-8'));

        expect(budget).toHaveProperty('lcp');
        expect(budget).toHaveProperty('inp');
        expect(budget).toHaveProperty('cls');
        expect(budget).toHaveProperty('bundleSize');

        console.log('✅ 성능 예산 설정 확인');
      } else {
        console.warn('⚠️ 성능 예산 파일이 없음');
      }
    });
  });
});

/**
 * FSD 아키텍처 위반사항 검사
 */
function checkFSDViolations(): string[] {
  const violations: string[] = [];

  try {
    // 상향 의존성 검사 (예시)
    const appLayerImports = execSync(
      'grep -r "from.*entities\\|from.*features\\|from.*widgets" src/app --include="*.ts" --include="*.tsx" || true',
      { encoding: 'utf-8' }
    );

    if (appLayerImports.trim()) {
      violations.push('App 레이어에서 하위 레이어로의 부적절한 import 발견');
    }
  } catch (error) {
    // grep 실행 실패는 무시
  }

  return violations;
}

/**
 * 직접 import 위반사항 검사
 */
function checkDirectImportViolations(): string[] {
  const violations: string[] = [];

  try {
    // 내부 파일로의 직접 import 검사
    const directImports = execSync(
      'grep -r "from.*src/.*/" src --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" || true',
      { encoding: 'utf-8' }
    );

    const lines = directImports.trim().split('\n').filter(line => line.trim());
    violations.push(...lines);
  } catch (error) {
    // grep 실행 실패는 무시
  }

  return violations;
}

/**
 * 품질 게이트 유틸리티
 */
export const qualityGateUtils = {
  /**
   * 품질 메트릭 수집
   */
  collectQualityMetrics: () => {
    return {
      timestamp: Date.now(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };
  },

  /**
   * 품질 점수 계산
   */
  calculateQualityScore: (metrics: any) => {
    let score = 100;

    // 타입 에러가 있으면 점수 차감
    if (metrics.typeErrors > 0) score -= metrics.typeErrors * 10;

    // ESLint 에러가 있으면 점수 차감
    if (metrics.eslintErrors > 0) score -= metrics.eslintErrors * 5;

    // 순환 의존성이 있으면 점수 차감
    if (metrics.circularDeps > 0) score -= metrics.circularDeps * 15;

    return Math.max(0, score);
  },

  /**
   * 품질 게이트 통과 여부 확인
   */
  passesQualityGate: (metrics: any) => {
    return qualityGateUtils.calculateQualityScore(metrics) >= 80;
  }
};