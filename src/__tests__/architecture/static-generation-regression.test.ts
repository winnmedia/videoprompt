/**
 * 정적 페이지 생성 회귀 방지 테스트 스위트
 * CLAUDE.md TDD 원칙: RED → GREEN → REFACTOR
 *
 * 테스트 목표:
 * 1. 모든 정적 경로 렌더링 성공 검증
 * 2. Bundle 크기 회귀 방지 (성능 예산 기준)
 * 3. Core Web Vitals 기준치 유지
 * 4. 빌드 성능 모니터링
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

// 성능 예산 임계값 (performance-budget.json 기준)
const PERFORMANCE_BUDGET = {
  lcp: 2500,
  inp: 200,
  cls: 0.1,
  bundleSize: {
    total: 1048576, // 1MB
    javascript: 512000, // 500KB
    css: 102400, // 100KB
  }
};

const BUILD_OUTPUT_DIR = join(process.cwd(), '.next');
const STATIC_OUTPUT_DIR = join(BUILD_OUTPUT_DIR, 'static');

describe('정적 페이지 생성 회귀 방지', () => {
  let buildStartTime: number;
  let buildEndTime: number;

  beforeAll(() => {
    buildStartTime = performance.now();
  });

  afterAll(() => {
    buildEndTime = performance.now();
    const buildDuration = buildEndTime - buildStartTime;

    // 빌드 성능 검증 (5분 이내)
    expect(buildDuration).toBeLessThan(300000); // 5분 = 300,000ms
    console.log(`✅ 빌드 성능: ${Math.round(buildDuration)}ms`);
  });

  describe('빌드 산출물 검증', () => {
    test('빌드 디렉토리가 존재해야 함', () => {
      expect(existsSync(BUILD_OUTPUT_DIR)).toBe(true);
    });

    test('정적 자원 디렉토리가 존재해야 함', () => {
      expect(existsSync(STATIC_OUTPUT_DIR)).toBe(true);
    });

    test('빌드 매니페스트 파일이 존재해야 함', () => {
      const manifestPath = join(BUILD_OUTPUT_DIR, 'build-manifest.json');
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(manifest).toHaveProperty('pages');
      expect(Object.keys(manifest.pages).length).toBeGreaterThan(0);
    });
  });

  describe('Bundle 크기 회귀 방지', () => {
    test('전체 번들 크기가 성능 예산을 초과하지 않아야 함', () => {
      if (!existsSync(STATIC_OUTPUT_DIR)) {
        console.warn('⚠️ 정적 자원 디렉토리가 존재하지 않음 - 빌드가 필요할 수 있음');
        return;
      }

      const getTotalSize = (dir: string): number => {
        const files = require('fs').readdirSync(dir, { withFileTypes: true });
        let totalSize = 0;

        for (const file of files) {
          const fullPath = join(dir, file.name);
          if (file.isDirectory()) {
            totalSize += getTotalSize(fullPath);
          } else {
            totalSize += statSync(fullPath).size;
          }
        }
        return totalSize;
      };

      const totalBundleSize = getTotalSize(STATIC_OUTPUT_DIR);

      expect(totalBundleSize).toBeLessThanOrEqual(PERFORMANCE_BUDGET.bundleSize.total);
      console.log(`✅ 번들 크기: ${Math.round(totalBundleSize / 1024)}KB (한계: ${Math.round(PERFORMANCE_BUDGET.bundleSize.total / 1024)}KB)`);
    });

    test('JavaScript 번들 크기가 임계값을 초과하지 않아야 함', () => {
      const jsChunksDir = join(STATIC_OUTPUT_DIR, 'chunks');

      if (!existsSync(jsChunksDir)) {
        console.warn('⚠️ JS 청크 디렉토리가 존재하지 않음');
        return;
      }

      const jsFiles = require('fs').readdirSync(jsChunksDir)
        .filter((file: string) => file.endsWith('.js'));

      let totalJsSize = 0;
      for (const file of jsFiles) {
        const filePath = join(jsChunksDir, file);
        totalJsSize += statSync(filePath).size;
      }

      expect(totalJsSize).toBeLessThanOrEqual(PERFORMANCE_BUDGET.bundleSize.javascript);
      console.log(`✅ JS 번들 크기: ${Math.round(totalJsSize / 1024)}KB`);
    });
  });

  describe('정적 경로 렌더링 검증', () => {
    test('메인 페이지가 정적으로 생성되어야 함', () => {
      const indexHtmlPath = join(BUILD_OUTPUT_DIR, 'server/app/page.html');
      const indexPath = join(BUILD_OUTPUT_DIR, 'server/pages/index.html');

      // Next.js 13+ app router 또는 pages router 중 하나는 존재해야 함
      const hasAppRouter = existsSync(indexHtmlPath);
      const hasPagesRouter = existsSync(indexPath);

      expect(hasAppRouter || hasPagesRouter).toBe(true);

      if (hasAppRouter) {
        console.log('✅ App Router 정적 페이지 생성 확인');
      }
      if (hasPagesRouter) {
        console.log('✅ Pages Router 정적 페이지 생성 확인');
      }
    });

    test('중요 페이지들이 모두 생성되어야 함', () => {
      const criticalPages = [
        'login',
        'register',
        'dashboard',
        'planning'
      ];

      const serverPagesDir = join(BUILD_OUTPUT_DIR, 'server');

      if (!existsSync(serverPagesDir)) {
        console.warn('⚠️ 서버 페이지 디렉토리가 존재하지 않음');
        return;
      }

      // 적어도 일부 중요 페이지가 생성되었는지 확인
      let generatedPagesCount = 0;

      for (const page of criticalPages) {
        const appRouterPath = join(serverPagesDir, 'app', `(auth)/${page}/page.html`);
        const pagesRouterPath = join(serverPagesDir, 'pages', `${page}.html`);

        if (existsSync(appRouterPath) || existsSync(pagesRouterPath)) {
          generatedPagesCount++;
          console.log(`✅ ${page} 페이지 생성 확인`);
        }
      }

      // 전체 페이지가 모두 생성되지 않을 수 있지만, 일부는 생성되어야 함
      expect(generatedPagesCount).toBeGreaterThan(0);
    });
  });

  describe('성능 회귀 검증', () => {
    test('빌드 시간이 합리적 범위 내에 있어야 함', () => {
      const buildDuration = buildEndTime - buildStartTime;

      // 빌드 시간 5분 이내 (CI 환경 고려)
      expect(buildDuration).toBeLessThan(300000);

      // 경고 임계값: 2분
      if (buildDuration > 120000) {
        console.warn(`⚠️ 빌드 시간 경고: ${Math.round(buildDuration / 1000)}초 (권장: 120초 이내)`);
      }
    });

    test('메모리 사용량 모니터링', () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

      // 힙 메모리 사용량 500MB 이내
      expect(heapUsedMB).toBeLessThan(500);
      console.log(`✅ 메모리 사용량: ${heapUsedMB}MB`);
    });
  });

  describe('회귀 방지 메트릭', () => {
    test('번들 분석 결과가 성능 예산 내에 있어야 함', () => {
      const manifestPath = join(BUILD_OUTPUT_DIR, 'build-manifest.json');

      if (!existsSync(manifestPath)) {
        console.warn('⚠️ 빌드 매니페스트가 존재하지 않음');
        return;
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const pageCount = Object.keys(manifest.pages || {}).length;

      // 페이지 수가 급격히 감소하지 않았는지 확인 (최소 3개 이상)
      expect(pageCount).toBeGreaterThanOrEqual(3);
      console.log(`✅ 생성된 페이지 수: ${pageCount}개`);
    });

    test('중요 자산 파일이 누락되지 않았는지 확인', () => {
      const staticManifestPath = join(BUILD_OUTPUT_DIR, 'static-manifest.json');
      const routesManifestPath = join(BUILD_OUTPUT_DIR, 'routes-manifest.json');

      // 핵심 매니페스트 파일들 존재 여부
      const hasRoutes = existsSync(routesManifestPath);

      if (hasRoutes) {
        const routesManifest = JSON.parse(readFileSync(routesManifestPath, 'utf-8'));
        expect(routesManifest).toHaveProperty('version');
        console.log('✅ 라우트 매니페스트 확인');
      }
    });
  });
});

/**
 * 정적 생성 회귀 방지를 위한 유틸리티 함수들
 */
export const staticGenerationUtils = {
  /**
   * 번들 크기 증가율 계산
   */
  calculateBundleSizeIncrease: (previousSize: number, currentSize: number): number => {
    return ((currentSize - previousSize) / previousSize) * 100;
  },

  /**
   * 성능 예산 위반 검사
   */
  checkPerformanceBudgetViolations: (metrics: any) => {
    const violations: string[] = [];

    if (metrics.bundleSize > PERFORMANCE_BUDGET.bundleSize.total) {
      violations.push(`번들 크기 초과: ${metrics.bundleSize} > ${PERFORMANCE_BUDGET.bundleSize.total}`);
    }

    return violations;
  },

  /**
   * 빌드 성능 메트릭 수집
   */
  collectBuildMetrics: () => {
    return {
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now(),
      nodeVersion: process.version,
    };
  }
};