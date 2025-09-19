#!/usr/bin/env node

/**
 * 성능 예산 집행자 (Performance Budget Enforcer)
 * Frontend Platform Lead - 성능 회귀 방지 및 예산 관리
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 성능 예산 정의 (Core Web Vitals + 커스텀 지표)
const PERFORMANCE_BUDGET = {
  // Core Web Vitals
  LCP: {
    budget: 2.5, // seconds
    description: 'Largest Contentful Paint',
    critical: true,
  },
  FID: {
    budget: 100, // milliseconds
    description: 'First Input Delay',
    critical: true,
  },
  CLS: {
    budget: 0.1, // score
    description: 'Cumulative Layout Shift',
    critical: true,
  },

  // 추가 성능 지표
  FCP: {
    budget: 1.8, // seconds
    description: 'First Contentful Paint',
    critical: false,
  },
  TTI: {
    budget: 3.8, // seconds
    description: 'Time to Interactive',
    critical: false,
  },
  TTFB: {
    budget: 0.6, // seconds
    description: 'Time to First Byte',
    critical: false,
  },

  // 번들 크기 예산
  BUNDLE_SIZE: {
    budget: 250, // KB (gzipped)
    description: 'JavaScript Bundle Size',
    critical: true,
  },
  CSS_SIZE: {
    budget: 50, // KB (gzipped)
    description: 'CSS Bundle Size',
    critical: false,
  },

  // 리소스 예산
  TOTAL_REQUESTS: {
    budget: 50,
    description: 'Total HTTP Requests',
    critical: false,
  },
  TOTAL_SIZE: {
    budget: 1024, // KB
    description: 'Total Page Size',
    critical: false,
  },
};

// 로깅 유틸리티
class Logger {
  static info(message) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  }

  static warn(message) {
    console.log(`[WARN] ${new Date().toISOString()} - ${message}`);
  }

  static error(message) {
    console.log(`[ERROR] ${new Date().toISOString()} - ${message}`);
  }

  static success(message) {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`);
  }

  static budget(metric, actual, budget, status) {
    const statusIcon = status === 'pass' ? '✅' : '❌';
    const unit = this.getMetricUnit(metric);
    console.log(`${statusIcon} ${metric}: ${actual}${unit} / ${budget}${unit} (${status})`);
  }

  static getMetricUnit(metric) {
    switch (metric) {
      case 'LCP':
      case 'FCP':
      case 'TTI':
      case 'TTFB':
        return 's';
      case 'FID':
        return 'ms';
      case 'BUNDLE_SIZE':
      case 'CSS_SIZE':
      case 'TOTAL_SIZE':
        return 'KB';
      case 'CLS':
        return '';
      case 'TOTAL_REQUESTS':
        return '';
      default:
        return '';
    }
  }
}

// 번들 크기 분석
function analyzeBundleSize() {
  const buildDir = path.join(__dirname, '..', '.next');
  const staticDir = path.join(buildDir, 'static');

  if (!fs.existsSync(buildDir)) {
    throw new Error('빌드 디렉토리를 찾을 수 없습니다. 먼저 빌드를 실행하세요.');
  }

  Logger.info('📊 번들 크기 분석 중...');

  const results = {
    javascript: 0,
    css: 0,
    totalSize: 0,
    chunks: [],
  };

  // JavaScript 파일 분석
  if (fs.existsSync(path.join(staticDir, 'chunks'))) {
    const chunksDir = path.join(staticDir, 'chunks');
    const jsFiles = fs.readdirSync(chunksDir).filter(file => file.endsWith('.js'));

    jsFiles.forEach(file => {
      const filePath = path.join(chunksDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024 * 100) / 100;

      results.javascript += sizeKB;
      results.totalSize += sizeKB;

      results.chunks.push({
        name: file,
        size: sizeKB,
        type: 'javascript',
      });
    });
  }

  // CSS 파일 분석
  if (fs.existsSync(path.join(staticDir, 'css'))) {
    const cssDir = path.join(staticDir, 'css');
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));

    cssFiles.forEach(file => {
      const filePath = path.join(cssDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024 * 100) / 100;

      results.css += sizeKB;
      results.totalSize += sizeKB;

      results.chunks.push({
        name: file,
        size: sizeKB,
        type: 'css',
      });
    });
  }

  // 큰 파일 순으로 정렬
  results.chunks.sort((a, b) => b.size - a.size);

  Logger.success(`📦 JavaScript 번들: ${results.javascript}KB`);
  Logger.success(`🎨 CSS 번들: ${results.css}KB`);
  Logger.success(`📊 총 번들 크기: ${results.totalSize}KB`);

  // 가장 큰 파일들 표시
  if (results.chunks.length > 0) {
    Logger.info('📋 가장 큰 파일들:');
    results.chunks.slice(0, 5).forEach((chunk, index) => {
      console.log(`  ${index + 1}. ${chunk.name} (${chunk.type}): ${chunk.size}KB`);
    });
  }

  return results;
}

// Next.js 빌드 분석기 실행
function runBuildAnalyzer() {
  Logger.info('🔍 Next.js 빌드 분석기 실행 중...');

  try {
    // 빌드 분석 실행
    const output = execSync('pnpm build 2>&1', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
    });

    // Next.js 빌드 출력에서 성능 정보 추출
    const lines = output.split('\n');
    const buildInfo = {};

    lines.forEach(line => {
      // 번들 크기 정보 파싱
      if (line.includes('First Load JS')) {
        const match = line.match(/(\d+(?:\.\d+)?)\s*kB/);
        if (match) {
          buildInfo.firstLoadJS = parseFloat(match[1]);
        }
      }

      // 페이지별 크기 정보 수집
      if (line.includes('○') || line.includes('●') || line.includes('λ')) {
        const sizeMatch = line.match(/(\d+(?:\.\d+)?)\s*kB/);
        if (sizeMatch) {
          const pagePath = line.split(/\s+/)[1];
          if (pagePath) {
            buildInfo[pagePath] = parseFloat(sizeMatch[1]);
          }
        }
      }
    });

    return buildInfo;

  } catch (error) {
    Logger.warn('⚠️ Next.js 빌드 분석기 실행 실패 - 수동 분석으로 대체');
    return {};
  }
}

// 성능 예산 검증
function validatePerformanceBudget(metrics) {
  Logger.info('💰 성능 예산 검증 중...');

  const results = {
    passed: true,
    violations: [],
    warnings: [],
    summary: {},
  };

  Object.entries(PERFORMANCE_BUDGET).forEach(([metricName, budget]) => {
    const actualValue = metrics[metricName];

    if (actualValue === undefined) {
      Logger.warn(`⚠️ ${metricName} 지표를 찾을 수 없음 - 건너뛰기`);
      return;
    }

    const isWithinBudget = actualValue <= budget.budget;
    const status = isWithinBudget ? 'pass' : 'fail';

    Logger.budget(metricName, actualValue, budget.budget, status);

    results.summary[metricName] = {
      actual: actualValue,
      budget: budget.budget,
      status: status,
      critical: budget.critical,
      description: budget.description,
    };

    if (!isWithinBudget) {
      const violation = {
        metric: metricName,
        actual: actualValue,
        budget: budget.budget,
        critical: budget.critical,
        description: budget.description,
        excess: actualValue - budget.budget,
      };

      if (budget.critical) {
        results.violations.push(violation);
        results.passed = false;
      } else {
        results.warnings.push(violation);
      }
    }
  });

  return results;
}

// 권장사항 생성
function generateRecommendations(violations, warnings, bundleInfo) {
  const recommendations = [];

  // 번들 크기 최적화 권장사항
  if (violations.some(v => v.metric === 'BUNDLE_SIZE') || warnings.some(w => w.metric === 'BUNDLE_SIZE')) {
    recommendations.push({
      priority: 'high',
      category: 'Bundle Size',
      issue: 'JavaScript 번들 크기가 예산을 초과했습니다',
      solutions: [
        '코드 스플리팅 적용: 페이지별 번들 분리',
        '동적 import 사용: 필요할 때만 로드',
        '불필요한 패키지 제거: bundle-analyzer로 분석',
        'Tree shaking 최적화: 사용하지 않는 코드 제거',
        '서버 컴포넌트 활용: 클라이언트 번들 크기 감소',
      ],
    });
  }

  // 렌더링 성능 최적화
  if (violations.some(v => ['LCP', 'FCP'].includes(v.metric))) {
    recommendations.push({
      priority: 'high',
      category: 'Rendering Performance',
      issue: '페이지 렌더링 속도가 느립니다',
      solutions: [
        '이미지 최적화: Next.js Image 컴포넌트 사용',
        '폰트 최적화: font-display: swap 적용',
        'Critical CSS 인라인화',
        '레이지 로딩 적용: 뷰포트 밖 리소스 지연 로드',
        'CDN 활용: 정적 자원 캐싱 개선',
      ],
    });
  }

  // 레이아웃 안정성
  if (violations.some(v => v.metric === 'CLS')) {
    recommendations.push({
      priority: 'high',
      category: 'Layout Stability',
      issue: '레이아웃 이동이 많이 발생합니다',
      solutions: [
        '이미지/동영상 dimensions 명시',
        '동적 콘텐츠 placeholder 제공',
        '폰트 로딩 최적화: font-display 설정',
        '광고/iframe 크기 미리 할당',
        'CSS transform/opacity 사용한 애니메이션',
      ],
    });
  }

  // 번들별 세부 권장사항
  if (bundleInfo.chunks && bundleInfo.chunks.length > 0) {
    const largeChunks = bundleInfo.chunks.filter(chunk => chunk.size > 50);

    if (largeChunks.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'Bundle Optimization',
        issue: `큰 번들 파일이 ${largeChunks.length}개 발견되었습니다`,
        solutions: [
          `큰 파일들: ${largeChunks.map(c => `${c.name} (${c.size}KB)`).join(', ')}`,
          'webpack-bundle-analyzer로 상세 분석',
          '공통 라이브러리 별도 청크로 분리',
          '외부 CDN으로 이동 고려',
        ],
      });
    }
  }

  return recommendations;
}

// 보고서 생성
function generateReport(budgetResults, bundleInfo, recommendations) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: budgetResults.passed,
      totalMetrics: Object.keys(budgetResults.summary).length,
      violations: budgetResults.violations.length,
      warnings: budgetResults.warnings.length,
    },
    budget: budgetResults.summary,
    bundleInfo: bundleInfo,
    violations: budgetResults.violations,
    warnings: budgetResults.warnings,
    recommendations: recommendations,
  };

  // 보고서 파일 저장
  const reportsDir = path.join(__dirname, '..', 'performance-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(reportsDir, `performance-budget-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  Logger.success(`📄 성능 예산 보고서 저장: ${reportFile}`);

  return report;
}

// 결과 출력
function printResults(report) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 성능 예산 검증 결과');
  console.log('='.repeat(60));

  // 요약
  if (report.summary.passed) {
    Logger.success(`✅ 성능 예산 검증 통과!`);
  } else {
    Logger.error(`❌ 성능 예산 검증 실패!`);
  }

  console.log(`📏 검증된 지표: ${report.summary.totalMetrics}개`);
  console.log(`🚨 위반사항: ${report.summary.violations}개`);
  console.log(`⚠️ 경고사항: ${report.summary.warnings}개`);

  // 위반사항 상세
  if (report.violations.length > 0) {
    console.log('\n🚨 심각한 위반사항 (빌드 차단):');
    report.violations.forEach((violation, index) => {
      console.log(`  ${index + 1}. ${violation.description}`);
      console.log(`     실제값: ${violation.actual} / 예산: ${violation.budget}`);
      console.log(`     초과량: +${violation.excess.toFixed(2)}`);
    });
  }

  // 경고사항
  if (report.warnings.length > 0) {
    console.log('\n⚠️ 경고사항:');
    report.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning.description}`);
      console.log(`     실제값: ${warning.actual} / 예산: ${warning.budget}`);
    });
  }

  // 권장사항
  if (report.recommendations.length > 0) {
    console.log('\n💡 개선 권장사항:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}`);
      console.log(`     문제: ${rec.issue}`);
      console.log(`     해결방안:`);
      rec.solutions.forEach(solution => {
        console.log(`       - ${solution}`);
      });
      console.log();
    });
  }

  console.log('='.repeat(60));
}

// 메인 실행 함수
async function main() {
  const command = process.argv[2] || 'check';

  try {
    switch (command) {
      case 'check':
        Logger.info('🚀 성능 예산 검증 시작');

        // 1. 번들 크기 분석
        const bundleInfo = analyzeBundleSize();

        // 2. Next.js 빌드 정보 수집
        const buildInfo = runBuildAnalyzer();

        // 3. 성능 지표 수집 (번들 크기 기반)
        const metrics = {
          BUNDLE_SIZE: bundleInfo.javascript,
          CSS_SIZE: bundleInfo.css,
          TOTAL_SIZE: bundleInfo.totalSize,
          // 실제 웹 성능 지표는 별도 도구 필요 (Lighthouse 등)
          // 여기서는 번들 기반 예산만 검증
        };

        // 4. 성능 예산 검증
        const budgetResults = validatePerformanceBudget(metrics);

        // 5. 권장사항 생성
        const recommendations = generateRecommendations(
          budgetResults.violations,
          budgetResults.warnings,
          bundleInfo
        );

        // 6. 보고서 생성
        const report = generateReport(budgetResults, bundleInfo, recommendations);

        // 7. 결과 출력
        printResults(report);

        // 8. CI에서 실패 처리
        if (!budgetResults.passed && process.env.CI) {
          Logger.error('❌ CI에서 성능 예산 위반으로 빌드 실패');
          process.exit(1);
        }

        break;

      case 'lighthouse':
        Logger.info('🔍 Lighthouse 성능 측정 (구현 예정)');
        // TODO: Lighthouse CI 통합
        break;

      case 'config':
        Logger.info('⚙️ 현재 성능 예산:');
        console.log(JSON.stringify(PERFORMANCE_BUDGET, null, 2));
        break;

      default:
        console.log(`
🎯 성능 예산 집행자 (Performance Budget Enforcer)

Commands:
  check       - 성능 예산 검증 (기본값)
  lighthouse  - Lighthouse 성능 측정 (예정)
  config      - 현재 성능 예산 출력

Examples:
  node performance-budget-enforcer.js check
  node performance-budget-enforcer.js config
        `);
    }

  } catch (error) {
    Logger.error(`❌ 실행 중 오류: ${error.message}`);
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundleSize,
  validatePerformanceBudget,
  generateRecommendations,
  PERFORMANCE_BUDGET,
};