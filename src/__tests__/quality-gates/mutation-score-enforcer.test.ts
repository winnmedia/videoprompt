/**
 * Grace QA Lead: Mutation Score 80% 최소 품질 게이트
 *
 * 무관용 정책: 80% 미만 시 즉시 배포 차단
 * 테스트의 실제 품질을 검증하는 핵심 시스템
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface MutationResult {
  schemaVersion: string;
  thresholds: {
    high: number;
    low: number;
    break: number;
  };
  mutationScore: number;
  mutantResults: Array<{
    id: string;
    mutatorName: string;
    replacement: string;
    fileName: string;
    location: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    status: 'Killed' | 'Survived' | 'TimedOut' | 'CompileError' | 'RuntimeError';
    killedBy?: string[];
    coveredBy?: string[];
  }>;
  files: Record<string, {
    language: string;
    mutants: Array<{
      id: string;
      location: { start: { line: number; column: number }; end: { line: number; column: number } };
      mutatorName: string;
      replacement: string;
      status: string;
    }>;
    source: string;
  }>;
}

class MutationScoreEnforcer {
  private readonly GRACE_MINIMUM_SCORE = 80;
  private readonly CRITICAL_FILES = [
    'scripts/cost-prevention-detector.ts',
    'src/shared/lib/auth-supabase.ts',
    'src/shared/lib/api-client.ts',
    'src/app/api/auth/me/route.ts'
  ];

  async runMutationTesting(targetFile?: string): Promise<MutationResult> {
    try {
      const configFile = targetFile ? this.createTargetedConfig(targetFile) : 'stryker.conf.mjs';

      const command = `npx stryker run --configFile ${configFile}`;
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 300000 // 5분 타임아웃
      });

      // Stryker 결과 파일 읽기
      const resultPath = path.join(process.cwd(), 'reports/mutation/mutation-report.json');
      const resultData = await fs.readFile(resultPath, 'utf-8');

      return JSON.parse(resultData) as MutationResult;
    } catch (error) {
      throw new Error(`Mutation testing failed: ${error.message}`);
    }
  }

  private createTargetedConfig(targetFile: string): string {
    const configContent = `
export default {
  packageManager: 'pnpm',
  reporters: ['json', 'clear-text'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  mutate: ['${targetFile}'],
  thresholds: {
    high: 95,
    low: 85,
    break: ${this.GRACE_MINIMUM_SCORE}
  },
  timeoutMS: 60000,
  tempDirName: 'stryker-targeted-tmp',
  jsonReporter: {
    fileName: 'mutation-report.json',
    baseDir: 'reports/mutation',
  },
};`;

    const configPath = 'stryker-targeted.conf.mjs';
    require('fs').writeFileSync(configPath, configContent);
    return configPath;
  }

  analyzeQuality(result: MutationResult): {
    passed: boolean;
    score: number;
    criticalIssues: string[];
    recommendations: string[];
    survivedMutants: Array<{
      file: string;
      line: number;
      mutator: string;
      issue: string;
    }>;
  } {
    const score = result.mutationScore;
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    const survivedMutants: Array<{
      file: string;
      line: number;
      mutator: string;
      issue: string;
    }> = [];

    // Grace 기준: 80% 미만은 즉시 차단
    const passed = score >= this.GRACE_MINIMUM_SCORE;

    if (!passed) {
      criticalIssues.push(`Mutation Score ${score}% < ${this.GRACE_MINIMUM_SCORE}% (Grace 최소 기준)`);
    }

    // 생존한 뮤턴트 분석
    result.mutantResults.forEach(mutant => {
      if (mutant.status === 'Survived') {
        const issue = this.classifyMutantIssue(mutant);
        survivedMutants.push({
          file: mutant.fileName,
          line: mutant.location.start.line,
          mutator: mutant.mutatorName,
          issue
        });

        // 크리티컬 파일의 생존 뮤턴트는 특별 처리
        if (this.CRITICAL_FILES.some(file => mutant.fileName.includes(file))) {
          criticalIssues.push(`크리티컬 파일 ${mutant.fileName}:${mutant.location.start.line}에서 뮤턴트 생존`);
        }
      }
    });

    // 추천 사항 생성
    if (survivedMutants.length > 0) {
      recommendations.push('생존한 뮤턴트를 분석하여 누락된 테스트 케이스 추가');
      recommendations.push('엣지 케이스 및 에러 조건 테스트 강화');
      recommendations.push('assertion을 더 구체적으로 작성');
    }

    if (score < 90) {
      recommendations.push('Mutation Score 90% 이상 달성을 위한 추가 테스트 작성');
    }

    return {
      passed,
      score,
      criticalIssues,
      recommendations,
      survivedMutants
    };
  }

  private classifyMutantIssue(mutant: any): string {
    switch (mutant.mutatorName) {
      case 'ConditionalExpression':
        return '조건문 테스트 부족 - true/false 케이스 모두 검증 필요';
      case 'ArithmeticOperator':
        return '산술 연산 테스트 부족 - 경계값 및 연산자 변경 케이스 필요';
      case 'EqualityOperator':
        return '동등성 검사 테스트 부족 - 다양한 값 비교 케이스 필요';
      case 'LogicalOperator':
        return '논리 연산 테스트 부족 - && ↔ || 변경 케이스 검증 필요';
      case 'UnaryOperator':
        return '단항 연산 테스트 부족 - ! 연산자 변경 케이스 필요';
      case 'UpdateExpression':
        return '증감 연산 테스트 부족 - ++/-- 케이스 검증 필요';
      case 'StringLiteral':
        return '문자열 리터럴 테스트 부족 - 빈 문자열 케이스 필요';
      case 'BooleanLiteral':
        return '불린 리터럴 테스트 부족 - true/false 토글 케이스 필요';
      case 'ArrayDeclaration':
        return '배열 선언 테스트 부족 - 빈 배열 케이스 필요';
      case 'ObjectLiteral':
        return '객체 리터럴 테스트 부족 - 빈 객체 케이스 필요';
      default:
        return `${mutant.mutatorName} 뮤테이터 처리 테스트 부족`;
    }
  }

  generateActionPlan(analysis: ReturnType<typeof this.analyzeQuality>): {
    immediateActions: string[];
    testCasesToAdd: string[];
    priorityFiles: string[];
  } {
    const immediateActions: string[] = [];
    const testCasesToAdd: string[] = [];
    const priorityFiles: string[] = [];

    if (!analysis.passed) {
      immediateActions.push('배포 즉시 차단 - Mutation Score 80% 미달');
      immediateActions.push('플래키 테스트 격리 및 수정');
      immediateActions.push('생존 뮤턴트 즉시 분석');
    }

    // 파일별 우선순위 설정
    const fileIssueCount = new Map<string, number>();
    analysis.survivedMutants.forEach(mutant => {
      const count = fileIssueCount.get(mutant.file) || 0;
      fileIssueCount.set(mutant.file, count + 1);
    });

    // 이슈가 많은 파일 우선 처리
    const sortedFiles = Array.from(fileIssueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([file]) => file);

    priorityFiles.push(...sortedFiles.slice(0, 5));

    // 구체적인 테스트 케이스 제안
    analysis.survivedMutants.forEach(mutant => {
      if (mutant.mutator === 'ConditionalExpression') {
        testCasesToAdd.push(`${mutant.file}:${mutant.line} - 조건문 true/false 케이스`);
      } else if (mutant.mutator === 'EqualityOperator') {
        testCasesToAdd.push(`${mutant.file}:${mutant.line} - 동등성 검사 엣지 케이스`);
      } else if (mutant.mutator === 'ArithmeticOperator') {
        testCasesToAdd.push(`${mutant.file}:${mutant.line} - 산술 연산 경계값 테스트`);
      }
    });

    return {
      immediateActions,
      testCasesToAdd,
      priorityFiles
    };
  }
}

describe('Grace QA: Mutation Score 80% 품질 게이트', () => {
  let enforcer: MutationScoreEnforcer;

  beforeEach(() => {
    enforcer = new MutationScoreEnforcer();
    vi.clearAllMocks();
  });

  describe('뮤테이션 스코어 강제', () => {
    it('should enforce 80% minimum mutation score', () => {
      const mockResult: MutationResult = {
        schemaVersion: '1.0',
        thresholds: { high: 95, low: 85, break: 80 },
        mutationScore: 75, // Grace 기준 미달
        mutantResults: [],
        files: {}
      };

      const analysis = enforcer.analyzeQuality(mockResult);

      expect(analysis.passed).toBe(false);
      expect(analysis.score).toBe(75);
      expect(analysis.criticalIssues).toContain('Mutation Score 75% < 80% (Grace 최소 기준)');
    });

    it('should pass tests with 80% or higher score', () => {
      const mockResult: MutationResult = {
        schemaVersion: '1.0',
        thresholds: { high: 95, low: 85, break: 80 },
        mutationScore: 85,
        mutantResults: [],
        files: {}
      };

      const analysis = enforcer.analyzeQuality(mockResult);

      expect(analysis.passed).toBe(true);
      expect(analysis.score).toBe(85);
      expect(analysis.criticalIssues).toHaveLength(0);
    });
  });

  describe('생존 뮤턴트 분석', () => {
    it('should identify critical issues in survived mutants', () => {
      const mockResult: MutationResult = {
        schemaVersion: '1.0',
        thresholds: { high: 95, low: 85, break: 80 },
        mutationScore: 75,
        mutantResults: [
          {
            id: 'mutant1',
            mutatorName: 'ConditionalExpression',
            replacement: 'false',
            fileName: 'src/shared/lib/auth-supabase.ts',
            location: { start: { line: 42, column: 10 }, end: { line: 42, column: 20 } },
            status: 'Survived'
          },
          {
            id: 'mutant2',
            mutatorName: 'EqualityOperator',
            replacement: '!==',
            fileName: 'scripts/cost-prevention-detector.ts',
            location: { start: { line: 15, column: 5 }, end: { line: 15, column: 7 } },
            status: 'Survived'
          }
        ],
        files: {}
      };

      const analysis = enforcer.analyzeQuality(mockResult);

      expect(analysis.survivedMutants).toHaveLength(2);
      expect(analysis.survivedMutants[0].issue).toContain('조건문 테스트 부족');
      expect(analysis.survivedMutants[1].issue).toContain('동등성 검사 테스트 부족');

      // 크리티컬 파일의 뮤턴트 생존은 특별히 마킹
      expect(analysis.criticalIssues).toContain(
        '크리티컬 파일 src/shared/lib/auth-supabase.ts:42에서 뮤턴트 생존'
      );
      expect(analysis.criticalIssues).toContain(
        '크리티컬 파일 scripts/cost-prevention-detector.ts:15에서 뮤턴트 생존'
      );
    });

    it('should provide specific recommendations for each mutator type', () => {
      const enforcer = new MutationScoreEnforcer();

      // 다양한 뮤테이터 타입 테스트
      const mutatorTests = [
        { mutator: 'ConditionalExpression', expectedAdvice: '조건문 테스트 부족' },
        { mutator: 'ArithmeticOperator', expectedAdvice: '산술 연산 테스트 부족' },
        { mutator: 'EqualityOperator', expectedAdvice: '동등성 검사 테스트 부족' },
        { mutator: 'LogicalOperator', expectedAdvice: '논리 연산 테스트 부족' },
        { mutator: 'UnaryOperator', expectedAdvice: '단항 연산 테스트 부족' }
      ];

      mutatorTests.forEach(({ mutator, expectedAdvice }) => {
        const advice = (enforcer as any).classifyMutantIssue({ mutatorName: mutator });
        expect(advice).toContain(expectedAdvice);
      });
    });
  });

  describe('액션 플랜 생성', () => {
    it('should generate immediate actions for failing scores', () => {
      const failingAnalysis = {
        passed: false,
        score: 70,
        criticalIssues: ['Mutation Score 70% < 80%'],
        recommendations: [],
        survivedMutants: []
      };

      const actionPlan = enforcer.generateActionPlan(failingAnalysis);

      expect(actionPlan.immediateActions).toContain('배포 즉시 차단 - Mutation Score 80% 미달');
      expect(actionPlan.immediateActions).toContain('플래키 테스트 격리 및 수정');
      expect(actionPlan.immediateActions).toContain('생존 뮤턴트 즉시 분석');
    });

    it('should prioritize files with most survived mutants', () => {
      const analysisWithSurvivors = {
        passed: false,
        score: 75,
        criticalIssues: [],
        recommendations: [],
        survivedMutants: [
          { file: 'file1.ts', line: 10, mutator: 'Conditional', issue: 'test' },
          { file: 'file1.ts', line: 20, mutator: 'Equality', issue: 'test' },
          { file: 'file2.ts', line: 5, mutator: 'Arithmetic', issue: 'test' },
          { file: 'file1.ts', line: 30, mutator: 'Logical', issue: 'test' }
        ]
      };

      const actionPlan = enforcer.generateActionPlan(analysisWithSurvivors);

      // file1.ts가 3개의 이슈로 최우선
      expect(actionPlan.priorityFiles[0]).toBe('file1.ts');
      expect(actionPlan.priorityFiles[1]).toBe('file2.ts');
    });

    it('should suggest specific test cases for survived mutants', () => {
      const analysisWithSpecificMutants = {
        passed: false,
        score: 75,
        criticalIssues: [],
        recommendations: [],
        survivedMutants: [
          { file: 'auth.ts', line: 42, mutator: 'ConditionalExpression', issue: 'conditional' },
          { file: 'api.ts', line: 15, mutator: 'EqualityOperator', issue: 'equality' },
          { file: 'calc.ts', line: 88, mutator: 'ArithmeticOperator', issue: 'arithmetic' }
        ]
      };

      const actionPlan = enforcer.generateActionPlan(analysisWithSpecificMutants);

      expect(actionPlan.testCasesToAdd).toContain('auth.ts:42 - 조건문 true/false 케이스');
      expect(actionPlan.testCasesToAdd).toContain('api.ts:15 - 동등성 검사 엣지 케이스');
      expect(actionPlan.testCasesToAdd).toContain('calc.ts:88 - 산술 연산 경계값 테스트');
    });
  });

  describe('Grace 품질 정책 강제', () => {
    it('should block deployment for any score below 80%', () => {
      const lowScores = [79, 75, 60, 50];

      lowScores.forEach(score => {
        const mockResult: MutationResult = {
          schemaVersion: '1.0',
          thresholds: { high: 95, low: 85, break: 80 },
          mutationScore: score,
          mutantResults: [],
          files: {}
        };

        const analysis = enforcer.analyzeQuality(mockResult);
        expect(analysis.passed).toBe(false);
        expect(analysis.criticalIssues[0]).toContain(`${score}% < 80%`);
      });
    });

    it('should enforce stricter standards for critical files', () => {
      const criticalFileMutant = {
        id: 'critical1',
        mutatorName: 'ConditionalExpression',
        replacement: 'false',
        fileName: 'scripts/cost-prevention-detector.ts', // 크리티컬 파일
        location: { start: { line: 10, column: 5 }, end: { line: 10, column: 15 } },
        status: 'Survived' as const
      };

      const mockResult: MutationResult = {
        schemaVersion: '1.0',
        thresholds: { high: 95, low: 85, break: 80 },
        mutationScore: 82, // 일반적으로는 통과
        mutantResults: [criticalFileMutant],
        files: {}
      };

      const analysis = enforcer.analyzeQuality(mockResult);

      // 크리티컬 파일의 뮤턴트 생존은 별도 이슈로 표시
      expect(analysis.criticalIssues).toContain(
        '크리티컬 파일 scripts/cost-prevention-detector.ts:10에서 뮤턴트 생존'
      );
    });

    it('should generate comprehensive quality report', () => {
      const mockResult: MutationResult = {
        schemaVersion: '1.0',
        thresholds: { high: 95, low: 85, break: 80 },
        mutationScore: 77,
        mutantResults: [
          {
            id: 'mutant1',
            mutatorName: 'ConditionalExpression',
            replacement: 'false',
            fileName: 'test.ts',
            location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            status: 'Survived'
          }
        ],
        files: {}
      };

      const analysis = enforcer.analyzeQuality(mockResult);
      const actionPlan = enforcer.generateActionPlan(analysis);

      // 완전한 품질 보고서
      expect(analysis).toHaveProperty('passed', false);
      expect(analysis).toHaveProperty('score', 77);
      expect(analysis).toHaveProperty('criticalIssues');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('survivedMutants');

      expect(actionPlan).toHaveProperty('immediateActions');
      expect(actionPlan).toHaveProperty('testCasesToAdd');
      expect(actionPlan).toHaveProperty('priorityFiles');

      // Grace 무관용 정책 확인
      expect(actionPlan.immediateActions[0]).toContain('배포 즉시 차단');
    });
  });
});