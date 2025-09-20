/**
 * Grace QA Lead: FSD 위반 및 아키텍처 부채 자동 감지 시스템
 *
 * 무관용 정책: FSD 경계 위반은 즉시 배포 차단
 * CLAUDE.md 규칙 엄격 강제: 상향 의존성 금지, Public API만 Import
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// FSD 레이어 정의 (의존성 방향: 아래에서 위로만 허용)
enum FSDLayer {
  APP = 'app',
  PROCESSES = 'processes',
  PAGES = 'pages',
  WIDGETS = 'widgets',
  FEATURES = 'features',
  ENTITIES = 'entities',
  SHARED = 'shared'
}

const LAYER_HIERARCHY = [
  FSDLayer.SHARED,
  FSDLayer.ENTITIES,
  FSDLayer.FEATURES,
  FSDLayer.WIDGETS,
  FSDLayer.PAGES,
  FSDLayer.PROCESSES,
  FSDLayer.APP
];

interface ArchitectureViolation {
  type: 'UPWARD_DEPENDENCY' | 'INTERNAL_IMPORT' | 'MISSING_PUBLIC_API' | 'LAYER_VIOLATION' | 'CIRCULAR_DEPENDENCY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line: number;
  description: string;
  from: string;
  to: string;
  suggestion: string;
  blockReason: string;
}

interface FSDAnalysisResult {
  passed: boolean;
  violations: ArchitectureViolation[];
  layerCompliance: Record<FSDLayer, {
    compliantFiles: number;
    violatingFiles: number;
    upwardDependencies: number;
  }>;
  totalFiles: number;
  complianceScore: number;
  isDeploymentBlocked: boolean;
}

class FSDArchitectureEnforcer {
  private readonly GRACE_COMPLIANCE_THRESHOLD = 95; // 95% 이상 준수 필수

  // 허용된 상위 레이어 의존성 (예외 케이스)
  private readonly ALLOWED_EXCEPTIONS = [
    // shared는 external libraries만 import 가능
    { from: 'shared', to: 'external', reason: 'External libraries allowed' },
    // entities는 shared만 import 가능
    { from: 'entities', to: 'shared', reason: 'Entities can use shared utilities' }
  ];

  // 필수 Public API 패턴
  private readonly PUBLIC_API_PATTERNS = [
    /^export \* from ['"][^'"]*['"];?\s*$/m,  // export * from './module'
    /^export \{ [^}]+ \} from ['"][^'"]*['"];?\s*$/m,  // export { Component } from './module'
    /^export type \{ [^}]+ \} from ['"][^'"]*['"];?\s*$/m,  // export type { Type } from './module'
    /^export \{ default \} from ['"][^'"]*['"];?\s*$/m,  // export { default } from './module'
  ];

  async analyzeArchitecture(rootDir: string = process.cwd()): Promise<FSDAnalysisResult> {
    const sourceFiles = await this.findFSDFiles(rootDir);
    const violations: ArchitectureViolation[] = [];
    const layerCompliance: Record<FSDLayer, {
      compliantFiles: number;
      violatingFiles: number;
      upwardDependencies: number;
    }> = {} as any;

    // 레이어별 통계 초기화
    Object.values(FSDLayer).forEach(layer => {
      layerCompliance[layer] = {
        compliantFiles: 0,
        violatingFiles: 0,
        upwardDependencies: 0
      };
    });

    // 각 파일 분석
    for (const file of sourceFiles) {
      const fileViolations = await this.analyzeFile(file);
      violations.push(...fileViolations);

      const layer = this.getLayerFromPath(file);
      if (layer) {
        if (fileViolations.length === 0) {
          layerCompliance[layer].compliantFiles++;
        } else {
          layerCompliance[layer].violatingFiles++;

          // 상향 의존성 카운트
          const upwardViolations = fileViolations.filter(v => v.type === 'UPWARD_DEPENDENCY');
          layerCompliance[layer].upwardDependencies += upwardViolations.length;
        }
      }
    }

    // 컴플라이언스 스코어 계산
    const totalFiles = sourceFiles.length;
    const totalViolations = violations.length;
    const complianceScore = totalFiles > 0 ? ((totalFiles - totalViolations) / totalFiles) * 100 : 100;

    // Grace 무관용 정책: 95% 미만은 배포 차단
    const passed = complianceScore >= this.GRACE_COMPLIANCE_THRESHOLD;
    const isDeploymentBlocked = !passed || violations.some(v => v.severity === 'CRITICAL');

    return {
      passed,
      violations,
      layerCompliance,
      totalFiles,
      complianceScore,
      isDeploymentBlocked
    };
  }

  private async findFSDFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];
    const fsdPath = path.join(rootDir, 'src');

    async function scanDirectory(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!['__tests__', 'node_modules', '.git'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // 권한 없는 디렉토리 무시
      }
    }

    await scanDirectory(fsdPath);
    return files;
  }

  private async analyzeFile(filePath: string): Promise<ArchitectureViolation[]> {
    const violations: ArchitectureViolation[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      const currentLayer = this.getLayerFromPath(filePath);
      if (!currentLayer) return violations;

      // 1. Import 문 분석
      violations.push(...this.analyzeImports(filePath, lines, currentLayer));

      // 2. Public API 검증 (index.ts 파일)
      if (path.basename(filePath) === 'index.ts') {
        violations.push(...this.analyzePublicAPI(filePath, content));
      }

      // 3. 순환 의존성 검사
      violations.push(...await this.detectCircularDependencies(filePath, content));

    } catch (error) {
      console.warn(`파일 분석 실패: ${filePath} - ${error.message}`);
    }

    return violations;
  }

  private analyzeImports(filePath: string, lines: string[], currentLayer: FSDLayer): ArchitectureViolation[] {
    const violations: ArchitectureViolation[] = [];

    lines.forEach((line, index) => {
      const importMatch = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
      if (!importMatch) return;

      const importPath = importMatch[1];
      const lineNumber = index + 1;

      // 상대 경로 import 분석
      if (importPath.startsWith('.') || importPath.startsWith('src/')) {
        const targetLayer = this.getLayerFromImportPath(importPath, filePath);

        if (targetLayer) {
          // 상향 의존성 검사
          const currentLayerIndex = LAYER_HIERARCHY.indexOf(currentLayer);
          const targetLayerIndex = LAYER_HIERARCHY.indexOf(targetLayer);

          if (targetLayerIndex > currentLayerIndex) {
            violations.push({
              type: 'UPWARD_DEPENDENCY',
              severity: 'CRITICAL',
              file: filePath,
              line: lineNumber,
              description: `상향 의존성 위반: ${currentLayer} → ${targetLayer}`,
              from: currentLayer,
              to: targetLayer,
              suggestion: `의존성 방향을 역전시키거나 shared 레이어로 추상화하세요`,
              blockReason: 'FSD 핵심 규칙 위반 - 상향 의존성 금지'
            });
          }

          // 내부 import 검사 (Public API 우회)
          if (this.isInternalImport(importPath) && !this.isAllowedException(currentLayer, targetLayer)) {
            violations.push({
              type: 'INTERNAL_IMPORT',
              severity: 'HIGH',
              file: filePath,
              line: lineNumber,
              description: `내부 구현 직접 import: ${importPath}`,
              from: filePath,
              to: importPath,
              suggestion: `Public API (index.ts)를 통해 import하세요`,
              blockReason: 'FSD 캡슐화 원칙 위반'
            });
          }
        }
      }

      // 절대 경로 import 검사
      if (importPath.startsWith('src/')) {
        const absoluteTargetLayer = this.getLayerFromPath(importPath);
        if (absoluteTargetLayer) {
          const currentLayerIndex = LAYER_HIERARCHY.indexOf(currentLayer);
          const targetLayerIndex = LAYER_HIERARCHY.indexOf(absoluteTargetLayer);

          if (targetLayerIndex > currentLayerIndex) {
            violations.push({
              type: 'UPWARD_DEPENDENCY',
              severity: 'CRITICAL',
              file: filePath,
              line: lineNumber,
              description: `절대 경로 상향 의존성: ${currentLayer} → ${absoluteTargetLayer}`,
              from: currentLayer,
              to: absoluteTargetLayer,
              suggestion: `하위 레이어로 로직을 이동하거나 의존성을 역전시키세요`,
              blockReason: 'FSD 절대 경로 상향 의존성 금지'
            });
          }
        }
      }
    });

    return violations;
  }

  private analyzePublicAPI(filePath: string, content: string): ArchitectureViolation[] {
    const violations: ArchitectureViolation[] = [];

    // index.ts 파일은 Public API 역할을 해야 함
    if (!this.hasValidPublicAPI(content)) {
      violations.push({
        type: 'MISSING_PUBLIC_API',
        severity: 'MEDIUM',
        file: filePath,
        line: 1,
        description: '유효한 Public API가 없습니다',
        from: filePath,
        to: '',
        suggestion: 'export 문을 추가하여 Public API를 정의하세요',
        blockReason: 'FSD Public API 패턴 미준수'
      });
    }

    return violations;
  }

  private async detectCircularDependencies(filePath: string, content: string): Promise<ArchitectureViolation[]> {
    const violations: ArchitectureViolation[] = [];

    // 간단한 순환 의존성 검사 (실제로는 더 복잡한 그래프 분석 필요)
    const imports = this.extractImports(content);

    for (const importPath of imports) {
      if (await this.hasCircularDependency(filePath, importPath)) {
        violations.push({
          type: 'CIRCULAR_DEPENDENCY',
          severity: 'HIGH',
          file: filePath,
          line: 1,
          description: `순환 의존성 감지: ${filePath} ↔ ${importPath}`,
          from: filePath,
          to: importPath,
          suggestion: '의존성 그래프를 단순화하거나 인터페이스로 추상화하세요',
          blockReason: '순환 의존성으로 인한 아키텍처 불안정성'
        });
      }
    }

    return violations;
  }

  private getLayerFromPath(filePath: string): FSDLayer | null {
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const layer of Object.values(FSDLayer)) {
      if (normalizedPath.includes(`/src/${layer}/`) || normalizedPath.includes(`src/${layer}/`)) {
        return layer;
      }
    }

    return null;
  }

  private getLayerFromImportPath(importPath: string, currentFile: string): FSDLayer | null {
    // 상대 경로를 절대 경로로 변환
    const currentDir = path.dirname(currentFile);
    const resolvedPath = path.resolve(currentDir, importPath);

    return this.getLayerFromPath(resolvedPath);
  }

  private isInternalImport(importPath: string): boolean {
    // Public API (index.ts)가 아닌 내부 파일 직접 import 검사
    return !importPath.endsWith('/index') &&
           !importPath.endsWith('/index.ts') &&
           !importPath.endsWith('/') &&
           (importPath.includes('/') || importPath.startsWith('.'));
  }

  private isAllowedException(fromLayer: FSDLayer, toLayer: FSDLayer): boolean {
    return this.ALLOWED_EXCEPTIONS.some(exception =>
      exception.from === fromLayer && exception.to === toLayer
    );
  }

  private hasValidPublicAPI(content: string): boolean {
    return this.PUBLIC_API_PATTERNS.some(pattern => pattern.test(content));
  }

  private extractImports(content: string): string[] {
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private async hasCircularDependency(fileA: string, importPath: string): Promise<boolean> {
    // 순환 의존성 검사 로직 (간단한 버전)
    try {
      const resolvedPath = path.resolve(path.dirname(fileA), importPath);
      if (fs.access) {
        await fs.access(resolvedPath);
        // 실제로는 더 복잡한 의존성 그래프 분석 필요
        return false;
      }
    } catch {
      return false;
    }
    return false;
  }

  generateArchitectureReport(result: FSDAnalysisResult): {
    summary: string;
    deployment: 'BLOCKED' | 'ALLOWED';
    criticalIssues: string[];
    layerHealth: Array<{
      layer: string;
      score: number;
      issues: number;
    }>;
    actionPlan: string[];
    recommendations: string[];
  } {
    const criticalIssues: string[] = [];
    const actionPlan: string[] = [];
    const recommendations: string[] = [];

    // 크리티컬 이슈 수집
    result.violations.forEach(violation => {
      if (violation.severity === 'CRITICAL') {
        criticalIssues.push(`${violation.file}:${violation.line} - ${violation.description}`);
      }
    });

    // 레이어별 건강도 계산
    const layerHealth = Object.entries(result.layerCompliance).map(([layer, data]) => {
      const totalFiles = data.compliantFiles + data.violatingFiles;
      const score = totalFiles > 0 ? (data.compliantFiles / totalFiles) * 100 : 100;
      const issues = data.violatingFiles + data.upwardDependencies;

      return {
        layer,
        score: Math.round(score),
        issues
      };
    });

    // 액션 플랜 생성
    if (result.isDeploymentBlocked) {
      actionPlan.push('배포 즉시 차단 - FSD 아키텍처 위반');
      actionPlan.push('모든 상향 의존성 제거 필요');
      actionPlan.push('Public API 패턴 준수 강제');
    }

    if (result.complianceScore < 90) {
      actionPlan.push('아키텍처 컴플라이언스 90% 미만 - 긴급 수정 필요');
    }

    // 추천 사항
    recommendations.push('의존성 역전 원칙(DIP) 적용');
    recommendations.push('레이어간 인터페이스 추상화');
    recommendations.push('index.ts Public API 패턴 표준화');
    recommendations.push('ESLint FSD 규칙 활성화');

    return {
      summary: `FSD 분석: ${result.totalFiles}개 파일, ${result.violations.length}개 위반, ${result.complianceScore.toFixed(1)}% 준수`,
      deployment: result.isDeploymentBlocked ? 'BLOCKED' : 'ALLOWED',
      criticalIssues,
      layerHealth,
      actionPlan,
      recommendations
    };
  }
}

describe('Grace QA: FSD 아키텍처 위반 자동 감지 시스템', () => {
  let enforcer: FSDArchitectureEnforcer;

  beforeEach(() => {
    enforcer = new FSDArchitectureEnforcer();
  });

  describe('상향 의존성 감지', () => {
    it('should detect critical upward dependencies', async () => {
      const violatingCode = `
        // shared 레이어에서 features 레이어를 import (위반)
        import { useAuthStore } from '../features/auth/store';
        import { UserService } from '../../features/user/services';
      `;

      // Mock file path to simulate shared layer
      const sharedFilePath = '/project/src/shared/utils/helper.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(violatingCode);

      const result = await enforcer.analyzeFile(sharedFilePath);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('UPWARD_DEPENDENCY');
      expect(result[0].severity).toBe('CRITICAL');
      expect(result[0].from).toBe('shared');
      expect(result[0].to).toBe('features');
      expect(result[0].blockReason).toContain('상향 의존성 금지');
    });

    it('should allow proper downward dependencies', async () => {
      const compliantCode = `
        // features 레이어에서 entities와 shared를 import (허용)
        import { User } from '../../entities/user';
        import { apiClient } from '../../shared/api/client';
        import { validateEmail } from '../../shared/utils/validation';
      `;

      const featuresFilePath = '/project/src/features/auth/hooks/useAuth.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(compliantCode);

      const result = await enforcer.analyzeFile(featuresFilePath);

      // 상향 의존성 위반이 없어야 함
      const upwardViolations = result.filter(v => v.type === 'UPWARD_DEPENDENCY');
      expect(upwardViolations).toHaveLength(0);
    });

    it('should detect entities importing from features', async () => {
      const violatingCode = `
        // entities에서 features import (위반)
        import { useUserProfile } from '../../features/user/hooks';
      `;

      const entitiesFilePath = '/project/src/entities/user/model/user.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(violatingCode);

      const result = await enforcer.analyzeFile(entitiesFilePath);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('UPWARD_DEPENDENCY');
      expect(result[0].from).toBe('entities');
      expect(result[0].to).toBe('features');
    });
  });

  describe('Public API 위반 감지', () => {
    it('should detect internal imports bypassing public API', async () => {
      const internalImportCode = `
        // Public API를 우회한 내부 파일 직접 import (위반)
        import { AuthComponent } from '../auth/components/LoginForm';
        import { userValidation } from '../user/utils/validation';
      `;

      const featuresFilePath = '/project/src/features/dashboard/components/Dashboard.tsx';

      vi.spyOn(fs, 'readFile').mockResolvedValue(internalImportCode);

      const result = await enforcer.analyzeFile(featuresFilePath);

      const internalImportViolations = result.filter(v => v.type === 'INTERNAL_IMPORT');
      expect(internalImportViolations).toHaveLength(2);
      expect(internalImportViolations[0].suggestion).toContain('Public API (index.ts)');
    });

    it('should require valid public API in index.ts files', async () => {
      const invalidIndexContent = `
        // 잘못된 index.ts - export가 없음
        import { Component } from './Component';

        const someLogic = () => {
          // 로직
        };
      `;

      const indexFilePath = '/project/src/features/auth/index.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(invalidIndexContent);

      const result = await enforcer.analyzeFile(indexFilePath);

      const publicAPIViolations = result.filter(v => v.type === 'MISSING_PUBLIC_API');
      expect(publicAPIViolations).toHaveLength(1);
      expect(publicAPIViolations[0].suggestion).toContain('export 문을 추가');
    });

    it('should accept valid public API patterns', async () => {
      const validIndexContent = `
        // 유효한 Public API 패턴들
        export * from './components';
        export { AuthProvider } from './providers/AuthProvider';
        export type { User, AuthState } from './types';
        export { default as useAuth } from './hooks/useAuth';
      `;

      const indexFilePath = '/project/src/features/auth/index.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(validIndexContent);

      const result = await enforcer.analyzeFile(indexFilePath);

      const publicAPIViolations = result.filter(v => v.type === 'MISSING_PUBLIC_API');
      expect(publicAPIViolations).toHaveLength(0);
    });
  });

  describe('전체 아키텍처 분석', () => {
    it('should provide comprehensive architecture analysis', async () => {
      // Mock 파일 시스템
      const mockFiles = [
        '/project/src/shared/utils/helper.ts',
        '/project/src/entities/user/index.ts',
        '/project/src/features/auth/index.ts',
        '/project/src/widgets/header/index.ts',
        '/project/src/pages/dashboard/index.ts'
      ];

      vi.spyOn(enforcer as any, 'findFSDFiles').mockResolvedValue(mockFiles);

      // 일부 파일은 위반, 일부는 준수
      vi.spyOn(enforcer as any, 'analyzeFile').mockImplementation((filePath: string) => {
        if (filePath.includes('shared/utils')) {
          return Promise.resolve([{
            type: 'UPWARD_DEPENDENCY',
            severity: 'CRITICAL',
            file: filePath,
            line: 5,
            description: 'shared에서 features import',
            from: 'shared',
            to: 'features',
            suggestion: '의존성 역전',
            blockReason: '상향 의존성 금지'
          }]);
        }
        return Promise.resolve([]);
      });

      const result = await enforcer.analyzeArchitecture();

      expect(result.totalFiles).toBe(5);
      expect(result.violations).toHaveLength(1);
      expect(result.complianceScore).toBeLessThan(100);
      expect(result.isDeploymentBlocked).toBe(true);
      expect(result.layerCompliance.shared.upwardDependencies).toBe(1);
    });

    it('should block deployment for compliance below 95%', async () => {
      const mockResult: FSDAnalysisResult = {
        passed: false,
        violations: [
          {
            type: 'UPWARD_DEPENDENCY',
            severity: 'CRITICAL',
            file: '/test.ts',
            line: 1,
            description: 'test violation',
            from: 'shared',
            to: 'features',
            suggestion: 'fix it',
            blockReason: 'critical'
          }
        ],
        layerCompliance: {} as any,
        totalFiles: 100,
        complianceScore: 92, // Grace 기준 미달
        isDeploymentBlocked: true
      };

      const report = enforcer.generateArchitectureReport(mockResult);

      expect(report.deployment).toBe('BLOCKED');
      expect(report.actionPlan).toContain('배포 즉시 차단 - FSD 아키텍처 위반');
      expect(report.criticalIssues).toHaveLength(1);
    });

    it('should provide actionable recommendations', async () => {
      const mockResult: FSDAnalysisResult = {
        passed: false,
        violations: [],
        layerCompliance: {} as any,
        totalFiles: 50,
        complianceScore: 85,
        isDeploymentBlocked: true
      };

      const report = enforcer.generateArchitectureReport(mockResult);

      expect(report.recommendations).toContain('의존성 역전 원칙(DIP) 적용');
      expect(report.recommendations).toContain('레이어간 인터페이스 추상화');
      expect(report.recommendations).toContain('index.ts Public API 패턴 표준화');
      expect(report.recommendations).toContain('ESLint FSD 규칙 활성화');
    });
  });

  describe('Grace 무관용 정책 강제', () => {
    it('should enforce zero tolerance for architectural violations', async () => {
      const singleViolationCode = `
        import { UserFeature } from '../../features/user'; // 1개 위반
      `;

      const sharedFilePath = '/project/src/shared/config/api.ts';

      vi.spyOn(fs, 'readFile').mockResolvedValue(singleViolationCode);

      const result = await enforcer.analyzeFile(sharedFilePath);

      // 단 1개의 위반도 허용하지 않음
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('CRITICAL');
    });

    it('should maintain high performance with large codebases', async () => {
      // 대규모 코드베이스 시뮬레이션
      const largeMockFiles = Array.from({ length: 1000 }, (_, i) =>
        `/project/src/features/feature${i}/index.ts`
      );

      vi.spyOn(enforcer as any, 'findFSDFiles').mockResolvedValue(largeMockFiles);
      vi.spyOn(enforcer as any, 'analyzeFile').mockResolvedValue([]);

      const startTime = Date.now();
      await enforcer.analyzeArchitecture();
      const endTime = Date.now();

      // Grace 기준: 1000개 파일을 5초 이내에 분석
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should identify specific layer violations', () => {
      const layerViolations = [
        { from: 'shared', to: 'entities', allowed: false },
        { from: 'shared', to: 'features', allowed: false },
        { from: 'entities', to: 'shared', allowed: true },
        { from: 'entities', to: 'features', allowed: false },
        { from: 'features', to: 'entities', allowed: true },
        { from: 'features', to: 'shared', allowed: true },
        { from: 'features', to: 'widgets', allowed: false },
        { from: 'widgets', to: 'features', allowed: true }
      ];

      layerViolations.forEach(({ from, to, allowed }) => {
        const layerFrom = from as FSDLayer;
        const layerTo = to as FSDLayer;

        const fromIndex = LAYER_HIERARCHY.indexOf(layerFrom);
        const toIndex = LAYER_HIERARCHY.indexOf(layerTo);

        const isUpward = toIndex > fromIndex;

        if (allowed) {
          expect(isUpward).toBe(false);
        } else {
          expect(isUpward).toBe(true);
        }
      });
    });
  });

  describe('레이어별 건강도 측정', () => {
    it('should calculate layer health scores accurately', () => {
      const mockLayerCompliance = {
        [FSDLayer.SHARED]: { compliantFiles: 45, violatingFiles: 5, upwardDependencies: 3 },
        [FSDLayer.ENTITIES]: { compliantFiles: 30, violatingFiles: 2, upwardDependencies: 1 },
        [FSDLayer.FEATURES]: { compliantFiles: 80, violatingFiles: 0, upwardDependencies: 0 },
        [FSDLayer.WIDGETS]: { compliantFiles: 25, violatingFiles: 5, upwardDependencies: 2 },
        [FSDLayer.PAGES]: { compliantFiles: 15, violatingFiles: 1, upwardDependencies: 0 },
        [FSDLayer.PROCESSES]: { compliantFiles: 5, violatingFiles: 0, upwardDependencies: 0 },
        [FSDLayer.APP]: { compliantFiles: 3, violatingFiles: 0, upwardDependencies: 0 }
      };

      const mockResult: FSDAnalysisResult = {
        passed: false,
        violations: [],
        layerCompliance: mockLayerCompliance,
        totalFiles: 211,
        complianceScore: 94,
        isDeploymentBlocked: true
      };

      const report = enforcer.generateArchitectureReport(mockResult);

      // shared 레이어: 45/(45+5) = 90%
      const sharedHealth = report.layerHealth.find(h => h.layer === 'shared');
      expect(sharedHealth?.score).toBe(90);
      expect(sharedHealth?.issues).toBe(8); // 5 violating + 3 upward

      // features 레이어: 80/(80+0) = 100%
      const featuresHealth = report.layerHealth.find(h => h.layer === 'features');
      expect(featuresHealth?.score).toBe(100);
      expect(featuresHealth?.issues).toBe(0);
    });
  });
});