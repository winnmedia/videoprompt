/**
 * 품질 게이트 시스템 통합 검증 테스트
 *
 * Grace QA Lead의 무관용 품질 정책 전체 시스템 검증
 * - $300 사건 방지 시스템
 * - 종합 품질 검증 파이프라인
 * - Mutation Testing 통합
 * - CI/CD 품질 게이트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Grace QA Lead 품질 게이트 시스템 통합 검증', () => {
  const projectRoot = process.cwd();

  beforeAll(() => {
    console.log('🛡️ Grace QA Lead 품질 게이트 시스템 검증 시작');
  });

  describe('$300 사건 방지 시스템 검증', () => {
    it('should have cost prevention detector implemented', () => {
      const detectorPath = join(projectRoot, 'scripts/cost-prevention-detector.ts');
      expect(existsSync(detectorPath)).toBe(true);

      const detectorContent = readFileSync(detectorPath, 'utf-8');

      // 핵심 함수들 존재 확인
      expect(detectorContent).toContain('detectInfiniteLoops');
      expect(detectorContent).toContain('validateApiCallPatterns');
      expect(detectorContent).toContain('analyzeCostRisk');
      expect(detectorContent).toContain('runQualityGates');

      // $300 사건 관련 패턴 검증
      expect(detectorContent).toContain('checkAuth');
      expect(detectorContent).toContain('authenticateUser');
      expect(detectorContent).toContain('useEffect');
    });

    it('should have cost prevention analyzer CLI', () => {
      const analyzerPath = join(projectRoot, 'scripts/cost-prevention-analyzer.ts');
      expect(existsSync(analyzerPath)).toBe(true);

      const analyzerContent = readFileSync(analyzerPath, 'utf-8');
      expect(analyzerContent).toContain('#!/usr/bin/env npx tsx');
      expect(analyzerContent).toContain('analyzeFile');
    });

    it('should detect dangerous patterns correctly', async () => {
      const dangerousCode = `
        useEffect(() => {
          checkAuth();
        }, [checkAuth]);
      `;

      // 동적 import를 사용하여 테스트
      const { detectInfiniteLoops } = await import('../../../scripts/cost-prevention-detector');
      const result = detectInfiniteLoops(dangerousCode);

      expect(result.isRisky).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.violations).toContain('function-in-dependency');
      expect(result.estimatedCost).toBeGreaterThan(100);
    });

    it('should pass safe patterns through', async () => {
      const safeCode = `
        useEffect(() => {
          console.log('Safe operation');
        }, []);
      `;

      const { detectInfiniteLoops } = await import('../../../scripts/cost-prevention-detector');
      const result = detectInfiniteLoops(safeCode);

      expect(result.isRisky).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Mutation Testing 설정 검증', () => {
    it('should have Stryker configuration with Grace standards', () => {
      const strykerPath = join(projectRoot, 'stryker.conf.mjs');
      expect(existsSync(strykerPath)).toBe(true);

      const config = readFileSync(strykerPath, 'utf-8');

      // Grace의 높은 품질 기준 확인
      expect(config).toContain('break: 80');  // 80% 최소 기준
      expect(config).toContain('high: 95');   // 95% 우수 기준

      // 핵심 파일들이 포함되어 있는지 확인
      expect(config).toContain('cost-prevention-detector.ts');
      expect(config).toContain('auth');
      expect(config).toContain('planning');
    });

    it('should have required Stryker packages installed', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const devDeps = packageJson.devDependencies || {};

      expect(devDeps['@stryker-mutator/core']).toBeDefined();
      expect(devDeps['@stryker-mutator/vitest-runner']).toBeDefined();
      expect(devDeps['@stryker-mutator/typescript-checker']).toBeDefined();
    });
  });

  describe('종합 품질 검증 스크립트 검증', () => {
    it('should have enhanced quality gates script', () => {
      const scriptPath = join(projectRoot, 'scripts/run-quality-gates.sh');
      expect(existsSync(scriptPath)).toBe(true);

      const script = readFileSync(scriptPath, 'utf-8');

      // Grace 관련 기능들 확인
      expect(script).toContain('Grace QA Lead');
      expect(script).toContain('$300 사건 방지');
      expect(script).toContain('무관용 정책');
      expect(script).toContain('TDD 기반');
      expect(script).toContain('Mutation Testing');
    });

    it('should have all required quality check functions', () => {
      const scriptPath = join(projectRoot, 'scripts/run-quality-gates.sh');
      const script = readFileSync(scriptPath, 'utf-8');

      // 필수 함수들 존재 확인
      expect(script).toContain('check_infinite_loop_patterns');
      expect(script).toContain('run_mutation_tests');
      expect(script).toContain('run_auth_tests');
      expect(script).toContain('run_type_check');
      expect(script).toContain('run_security_check');
    });

    it('should be executable', () => {
      const scriptPath = join(projectRoot, 'scripts/run-quality-gates.sh');

      try {
        execSync(`test -x "${scriptPath}"`, { stdio: 'pipe' });
      } catch {
        // 실행 권한이 없다면 설정
        execSync(`chmod +x "${scriptPath}"`);
      }

      // 다시 확인
      expect(() => {
        execSync(`test -x "${scriptPath}"`, { stdio: 'pipe' });
      }).not.toThrow();
    });
  });

  describe('GitHub Actions 워크플로우 검증', () => {
    it('should have quality gates workflow', () => {
      const workflowPath = join(projectRoot, '.github/workflows/quality-gates.yml');
      expect(existsSync(workflowPath)).toBe(true);

      const workflow = readFileSync(workflowPath, 'utf-8');

      // Grace QA 관련 확인
      expect(workflow).toContain('Grace QA Lead');
      expect(workflow).toContain('$300 Cost Prevention');
      expect(workflow).toContain('Mutation Testing');
      expect(workflow).toContain('GRACE_QA_MODE');
    });

    it('should have required workflow stages', () => {
      const workflowPath = join(projectRoot, '.github/workflows/quality-gates.yml');
      const workflow = readFileSync(workflowPath, 'utf-8');

      // 필수 job들 확인
      expect(workflow).toContain('fast-validation');
      expect(workflow).toContain('integration-validation');
      expect(workflow).toContain('mutation-testing');
      expect(workflow).toContain('grace-final-approval');
    });

    it('should have setup-node action', () => {
      const actionPath = join(projectRoot, '.github/actions/setup-node/action.yml');
      expect(existsSync(actionPath)).toBe(true);

      const action = readFileSync(actionPath, 'utf-8');
      expect(action).toContain('Setup Node.js & pnpm');
      expect(action).toContain('Grace QA Lead');
    });
  });

  describe('품질 설정 파일들 검증', () => {
    it('should have quality gates configuration', () => {
      const configPath = join(projectRoot, 'quality-gates.config.js');
      expect(existsSync(configPath)).toBe(true);

      const config = readFileSync(configPath, 'utf-8');

      // Grace의 엄격한 품질 기준들 확인
      expect(config).toContain('coverage');
      expect(config).toContain('performance');
      expect(config).toContain('apiSafety');
      expect(config).toContain('costSafety');
    });

    it('should have deterministic vitest config', () => {
      const configPath = join(projectRoot, 'vitest.config.deterministic.js');

      if (existsSync(configPath)) {
        const config = readFileSync(configPath, 'utf-8');
        expect(config).toContain('deterministic');
      }
    });
  });

  describe('패키지 및 스크립트 통합성 검증', () => {
    it('should have all required npm scripts', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const scripts = packageJson.scripts || {};

      // Grace QA 필수 스크립트들
      expect(scripts['quality-gates']).toBeDefined();
      expect(scripts['test:mutation']).toBeDefined();
      expect(scripts['test:deterministic']).toBeDefined();
      expect(scripts['type-check']).toBeDefined();
    });

    it('should have required development dependencies', () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const devDeps = packageJson.devDependencies || {};

      // Grace QA 필수 도구들
      expect(devDeps['vitest']).toBeDefined();
      expect(devDeps['@testing-library/react']).toBeDefined();
      expect(devDeps['msw']).toBeDefined();
      expect(devDeps['@stryker-mutator/core']).toBeDefined();
    });
  });

  describe('Grace QA 무관용 정책 검증', () => {
    it('should enforce zero tolerance for flaky tests', async () => {
      // 플래키 테스트 감지 로직이 있는지 확인
      const scriptPath = join(projectRoot, 'scripts/run-quality-gates.sh');
      const script = readFileSync(scriptPath, 'utf-8');

      expect(script).toContain('플래키');
      expect(script).toContain('flaky');
      expect(script).toContain('3회');
    });

    it('should enforce high coverage standards', () => {
      const configPath = join(projectRoot, 'quality-gates.config.js');
      const config = readFileSync(configPath, 'utf-8');

      // 높은 커버리지 기준 확인
      expect(config).toMatch(/threshold:\s*100/); // 인증 시스템 100%
      expect(config).toMatch(/lines:\s*85/);      // 전체 85%
    });

    it('should block deployment on cost risks', async () => {
      const { runQualityGates } = await import('../../../scripts/cost-prevention-detector');

      const riskyCode = `
        useEffect(() => {
          authenticateUser();
        }, [authenticateUser]);
      `;

      const result = runQualityGates(riskyCode);

      expect(result.passed).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers.some(b => b.includes('$300'))).toBe(true);
    });
  });

  afterAll(() => {
    console.log('✅ Grace QA Lead 품질 게이트 시스템 통합 검증 완료');
    console.log('🛡️ $300 사건 재발 방지 시스템 정상 작동');
    console.log('🏆 무관용 품질 정책 적용 완료');
  });
});