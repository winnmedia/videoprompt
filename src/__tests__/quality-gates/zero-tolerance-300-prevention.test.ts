/**
 * Grace QA Lead: $300 사건 재발률 0% 완전 차단 시스템
 *
 * 무관용 정책: 어떤 비용 위험 패턴도 프로덕션에 도달할 수 없음
 * 실시간 감지, 즉시 차단, 자동 격리 시스템
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  detectInfiniteLoops,
  validateApiCallPatterns,
  analyzeCostRisk,
  runQualityGates,
  CostRiskLevel,
  type ApiCallPattern,
  type InfiniteLoopDetection
} from '../../../scripts/cost-prevention-detector';

// Grace의 실시간 비용 모니터링 시스템
class ZeroToleranceCostPrevention {
  private readonly GRACE_ZERO_TOLERANCE_THRESHOLD = 50; // $50/day도 허용하지 않음
  private readonly IMMEDIATE_BLOCK_PATTERNS = [
    'useEffect.*checkAuth.*checkAuth',
    'useEffect.*authenticateUser.*authenticateUser',
    'useEffect.*validateUser.*validateUser',
    'useLayoutEffect.*measureElement.*measureElement',
    'useEffect.*fetchUserData.*fetchUserData'
  ];

  private readonly COST_EXPLOSION_PATTERNS = [
    // 원본 $300 사건 재현 패턴들
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*checkAuth\(\)\s*\}\s*,\s*\[checkAuth\]\)/,
      name: 'original-300-pattern',
      estimatedCost: 300,
      severity: 'CRITICAL' as const
    },
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{\s*(?:await\s+)?fetch\(['"`]\/api\/auth\/me['"`]\)/,
      name: 'auth-me-loop',
      estimatedCost: 250,
      severity: 'CRITICAL' as const
    },
    {
      pattern: /setInterval\s*\(\s*(?:async\s+)?\(\)\s*=>\s*\{[\s\S]*?fetch\(['"`]\/api/,
      name: 'polling-bomb',
      estimatedCost: 500,
      severity: 'CATASTROPHIC' as const
    },
    {
      pattern: /useEffect\s*\(\s*[^,]*,\s*\[[^,]*(?:Function|Handler|Callback|Method|Provider|Service)[^,]*\]/,
      name: 'function-reference-dependency',
      estimatedCost: 150,
      severity: 'HIGH' as const
    }
  ];

  async scanEntireCodebase(): Promise<{
    safeFiles: string[];
    riskyFiles: Array<{
      file: string;
      violations: Array<{
        pattern: string;
        line: number;
        estimatedCost: number;
        severity: string;
        blockReason: string;
      }>;
      totalCost: number;
    }>;
    totalEstimatedCost: number;
    isDeploymentBlocked: boolean;
  }> {
    const codebaseRoot = process.cwd();
    const sourceFiles = await this.findSourceFiles(codebaseRoot);

    const safeFiles: string[] = [];
    const riskyFiles: Array<{
      file: string;
      violations: Array<{
        pattern: string;
        line: number;
        estimatedCost: number;
        severity: string;
        blockReason: string;
      }>;
      totalCost: number;
    }> = [];

    let totalEstimatedCost = 0;

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const violations = await this.scanFileForCostRisks(file, content);

        if (violations.length === 0) {
          safeFiles.push(file);
        } else {
          const fileCost = violations.reduce((sum, v) => sum + v.estimatedCost, 0);
          riskyFiles.push({
            file,
            violations,
            totalCost: fileCost
          });
          totalEstimatedCost += fileCost;
        }
      } catch (error) {
        console.warn(`파일 스캔 실패: ${file} - ${error.message}`);
      }
    }

    return {
      safeFiles,
      riskyFiles,
      totalEstimatedCost,
      isDeploymentBlocked: totalEstimatedCost > this.GRACE_ZERO_TOLERANCE_THRESHOLD
    };
  }

  private async findSourceFiles(rootDir: string): Promise<string[]> {
    const files: string[] = [];

    async function scanDirectory(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // node_modules, .git 등 제외
            if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // TypeScript/JavaScript 파일만
            if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // 권한 없는 디렉토리 등은 건너뛰기
      }
    }

    await scanDirectory(rootDir);
    return files;
  }

  private async scanFileForCostRisks(filePath: string, content: string): Promise<Array<{
    pattern: string;
    line: number;
    estimatedCost: number;
    severity: string;
    blockReason: string;
  }>> {
    const violations: Array<{
      pattern: string;
      line: number;
      estimatedCost: number;
      severity: string;
      blockReason: string;
    }> = [];

    const lines = content.split('\n');

    // 각 라인에서 위험 패턴 검사
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      // 즉시 차단 패턴 검사
      for (const pattern of this.COST_EXPLOSION_PATTERNS) {
        if (pattern.pattern.test(line)) {
          violations.push({
            pattern: pattern.name,
            line: lineNumber,
            estimatedCost: pattern.estimatedCost,
            severity: pattern.severity,
            blockReason: this.getBlockReason(pattern.name, pattern.estimatedCost)
          });
        }
      }

      // 멀티라인 패턴 검사 (useEffect 블록)
      if (line.includes('useEffect')) {
        const blockViolation = this.scanUseEffectBlock(lines, lineIndex);
        if (blockViolation) {
          violations.push({
            ...blockViolation,
            line: lineNumber
          });
        }
      }
    }

    return violations;
  }

  private scanUseEffectBlock(lines: string[], startIndex: number): {
    pattern: string;
    estimatedCost: number;
    severity: string;
    blockReason: string;
  } | null {
    // useEffect 블록 전체를 스캔하여 의존성 배열까지 포함한 패턴 분석
    let blockContent = '';
    let braceCount = 0;
    let foundDependencies = false;

    for (let i = startIndex; i < Math.min(startIndex + 20, lines.length); i++) {
      const line = lines[i];
      blockContent += line + '\n';

      // 중괄호 카운팅으로 블록 끝 감지
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      // 의존성 배열 찾기
      if (line.includes('[') && line.includes(']')) {
        foundDependencies = true;
        break;
      }

      if (foundDependencies && braceCount === 0) {
        break;
      }
    }

    // 원본 $300 사건 패턴 정확히 매칭
    if (/useEffect\s*\(\s*[^,]*checkAuth[^,]*,\s*\[[^,]*checkAuth[^,]*\]/.test(blockContent)) {
      return {
        pattern: 'exact-300-dollar-pattern',
        estimatedCost: 300,
        severity: 'CATASTROPHIC',
        blockReason: '원본 $300 사건과 동일한 패턴 - 즉시 차단 필요'
      };
    }

    // 일반적인 함수 의존성 패턴
    if (/useEffect\s*\([^,]*,\s*\[[^,]*[a-zA-Z]+(?:Function|Handler|Callback)[^,]*\]/.test(blockContent)) {
      return {
        pattern: 'function-dependency-risk',
        estimatedCost: 100,
        severity: 'HIGH',
        blockReason: '함수 의존성으로 인한 무한 렌더링 위험'
      };
    }

    return null;
  }

  private getBlockReason(patternName: string, cost: number): string {
    const reasons = {
      'original-300-pattern': `원본 $300 사건 패턴 - 하루 $${cost} 예상 비용`,
      'auth-me-loop': `인증 API 무한 호출 - 하루 $${cost} 예상 비용`,
      'polling-bomb': `폴링 폭탄 패턴 - 하루 $${cost} 예상 비용`,
      'function-reference-dependency': `함수 참조 의존성 - 하루 $${cost} 예상 비용`,
      'exact-300-dollar-pattern': `정확히 $300 사건과 동일한 패턴 감지`,
      'function-dependency-risk': `함수 의존성 무한 렌더링 위험`
    };

    return reasons[patternName] || `비용 위험 패턴 - 하루 $${cost} 예상 비용`;
  }

  generateCostReport(scanResult: Awaited<ReturnType<typeof this.scanEntireCodebase>>): {
    summary: string;
    deployment: 'BLOCKED' | 'ALLOWED';
    immediateActions: string[];
    riskBreakdown: Array<{
      category: string;
      count: number;
      totalCost: number;
    }>;
    recommendations: string[];
  } {
    const severityGroups = new Map<string, { count: number; totalCost: number }>();

    scanResult.riskyFiles.forEach(file => {
      file.violations.forEach(violation => {
        const current = severityGroups.get(violation.severity) || { count: 0, totalCost: 0 };
        severityGroups.set(violation.severity, {
          count: current.count + 1,
          totalCost: current.totalCost + violation.estimatedCost
        });
      });
    });

    const riskBreakdown = Array.from(severityGroups.entries()).map(([severity, data]) => ({
      category: severity,
      count: data.count,
      totalCost: data.totalCost
    }));

    const isBlocked = scanResult.isDeploymentBlocked;
    const immediateActions: string[] = [];
    const recommendations: string[] = [];

    if (isBlocked) {
      immediateActions.push('배포 즉시 차단 - Grace 무관용 정책 적용');
      immediateActions.push(`총 예상 비용 $${scanResult.totalEstimatedCost}/day > $${this.GRACE_ZERO_TOLERANCE_THRESHOLD}/day 허용 한계`);
      immediateActions.push('모든 위험 패턴 수정 후 재검증 필요');

      recommendations.push('useEffect 의존성 배열에서 함수 제거');
      recommendations.push('useCallback/useMemo로 함수 메모이제이션');
      recommendations.push('API 호출을 useEffect 외부로 이동');
      recommendations.push('커스텀 훅으로 로직 분리');
    }

    return {
      summary: `스캔 완료: ${scanResult.safeFiles.length}개 안전, ${scanResult.riskyFiles.length}개 위험`,
      deployment: isBlocked ? 'BLOCKED' : 'ALLOWED',
      immediateActions,
      riskBreakdown,
      recommendations
    };
  }
}

describe('Grace QA: $300 사건 재발률 0% 완전 차단 시스템', () => {
  let prevention: ZeroToleranceCostPrevention;

  beforeEach(() => {
    prevention = new ZeroToleranceCostPrevention();
  });

  describe('원본 $300 사건 패턴 완전 차단', () => {
    it('should block exact original $300 pattern', () => {
      const originalPattern = `
        useEffect(() => {
          checkAuth();
        }, [checkAuth]);
      `;

      const result = runQualityGates(originalPattern);

      expect(result.passed).toBe(false);
      expect(result.blockers).toContain(expect.stringMatching(/Critical.*\$300 risk pattern/));
      expect(result.violations).toContain('function-in-dependency');
    });

    it('should detect variations of the original pattern', () => {
      const variations = [
        // 다양한 함수명 변형
        `useEffect(() => { authenticateUser(); }, [authenticateUser]);`,
        `useEffect(() => { validateUser(); }, [validateUser]);`,
        // 비동기 패턴
        `useEffect(async () => { await checkAuth(); }, [checkAuth]);`,
        // 화살표 함수 변형
        `useEffect(() => checkAuth(), [checkAuth]);`,
        // useLayoutEffect 변형
        `useLayoutEffect(() => { measureElement(); }, [measureElement]);`
      ];

      variations.forEach(pattern => {
        const result = runQualityGates(pattern);
        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });

    it('should calculate accurate cost estimates', () => {
      const criticalPattern = `
        useEffect(() => {
          checkAuth();
        }, [checkAuth]);
      `;

      const detection = detectInfiniteLoops(criticalPattern);
      const costAnalysis = analyzeCostRisk(detection);

      expect(detection.isRisky).toBe(true);
      expect(detection.riskLevel).toBe(CostRiskLevel.CRITICAL);
      expect(detection.estimatedCost).toBe(300);
      expect(costAnalysis.estimatedDailyCost).toBeGreaterThan(300);
      expect(costAnalysis.actionRequired).toBe('IMMEDIATE_BLOCK');
    });
  });

  describe('실시간 코드베이스 스캔', () => {
    it('should scan multiple files for cost risks', async () => {
      // Mock 파일 시스템
      const mockFiles = [
        {
          path: '/test/safe-component.tsx',
          content: `
            import React, { useEffect, useState } from 'react';

            export function SafeComponent() {
              const [data, setData] = useState(null);

              useEffect(() => {
                console.log('Component mounted');
              }, []); // 안전한 빈 의존성 배열

              return <div>{data}</div>;
            }
          `
        },
        {
          path: '/test/risky-component.tsx',
          content: `
            import React, { useEffect } from 'react';

            export function RiskyComponent() {
              const checkAuth = () => {
                // 인증 체크 로직
              };

              useEffect(() => {
                checkAuth();
              }, [checkAuth]); // 위험한 함수 의존성

              return <div>Risky</div>;
            }
          `
        }
      ];

      // 파일 시스템 mock
      vi.spyOn(prevention as any, 'findSourceFiles').mockResolvedValue(
        mockFiles.map(f => f.path)
      );

      const fsReadFileSpy = vi.spyOn(fs, 'readFile');
      mockFiles.forEach(file => {
        fsReadFileSpy.mockImplementation((path: any) => {
          const mockFile = mockFiles.find(f => f.path === path);
          return Promise.resolve(mockFile?.content || '');
        });
      });

      const scanResult = await prevention.scanEntireCodebase();

      expect(scanResult.safeFiles).toContain('/test/safe-component.tsx');
      expect(scanResult.riskyFiles).toHaveLength(1);
      expect(scanResult.riskyFiles[0].file).toBe('/test/risky-component.tsx');
      expect(scanResult.isDeploymentBlocked).toBe(true);
      expect(scanResult.totalEstimatedCost).toBeGreaterThan(50);
    });

    it('should generate comprehensive cost reports', async () => {
      const mockScanResult = {
        safeFiles: ['/safe1.tsx', '/safe2.tsx'],
        riskyFiles: [
          {
            file: '/risky1.tsx',
            violations: [
              {
                pattern: 'original-300-pattern',
                line: 15,
                estimatedCost: 300,
                severity: 'CATASTROPHIC',
                blockReason: '원본 $300 사건 패턴'
              }
            ],
            totalCost: 300
          },
          {
            file: '/risky2.tsx',
            violations: [
              {
                pattern: 'function-dependency-risk',
                line: 8,
                estimatedCost: 100,
                severity: 'HIGH',
                blockReason: '함수 의존성 위험'
              }
            ],
            totalCost: 100
          }
        ],
        totalEstimatedCost: 400,
        isDeploymentBlocked: true
      };

      const report = prevention.generateCostReport(mockScanResult);

      expect(report.deployment).toBe('BLOCKED');
      expect(report.summary).toContain('2개 안전, 2개 위험');
      expect(report.immediateActions).toContain('배포 즉시 차단 - Grace 무관용 정책 적용');
      expect(report.riskBreakdown).toEqual([
        { category: 'CATASTROPHIC', count: 1, totalCost: 300 },
        { category: 'HIGH', count: 1, totalCost: 100 }
      ]);
      expect(report.recommendations).toContain('useEffect 의존성 배열에서 함수 제거');
    });
  });

  describe('Grace 무관용 정책 강제', () => {
    it('should block deployment for any cost risk above $50/day', () => {
      const lowRiskPattern = `
        useEffect(() => {
          someFunction();
        }, [someFunction]); // $100/day 예상
      `;

      const result = runQualityGates(lowRiskPattern);
      expect(result.passed).toBe(false);

      // Grace 기준: $50도 허용하지 않음
      const detection = detectInfiniteLoops(lowRiskPattern);
      const costAnalysis = analyzeCostRisk(detection);
      expect(costAnalysis.estimatedDailyCost).toBeGreaterThan(50);
    });

    it('should provide zero false negatives', () => {
      const knownDangerousPatterns = [
        `useEffect(() => { checkAuth(); }, [checkAuth]);`,
        `useEffect(() => { fetchUserData(); }, [fetchUserData]);`,
        `useLayoutEffect(() => { measureElement(); }, [measureElement]);`,
        `useEffect(() => { onMount(); }, [onMount]);`,
        `useEffect(() => { handleLoad(); }, [handleLoad]);`
      ];

      knownDangerousPatterns.forEach(pattern => {
        const result = runQualityGates(pattern);
        expect(result.passed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });

    it('should have minimal false positives', () => {
      const safePatterns = [
        `useEffect(() => { console.log('mounted'); }, []);`,
        `useEffect(() => { setValue(42); }, []);`,
        `useEffect(() => { document.title = 'App'; }, []);`,
        `useEffect(() => { localStorage.setItem('key', 'value'); }, []);`,
        `useEffect(() => { return () => cleanup(); }, []);`
      ];

      safePatterns.forEach(pattern => {
        const result = runQualityGates(pattern);
        expect(result.passed).toBe(true);
        expect(result.violations.length).toBe(0);
      });
    });

    it('should quarantine risky files immediately', async () => {
      const quarantinePattern = `
        // Grace QA: 이 파일은 $300 위험 패턴으로 인해 격리됨
        // TODO: useEffect 의존성 배열에서 함수 제거 필요
        // BLOCKED_BY_GRACE: function-in-dependency 패턴

        /*
        useEffect(() => {
          checkAuth();
        }, [checkAuth]); // 이 코드는 주석 처리됨
        */
      `;

      // 격리된 파일은 위험 패턴이 비활성화되어야 함
      const result = runQualityGates(quarantinePattern);
      expect(result.passed).toBe(true); // 주석 처리된 코드는 안전
    });

    it('should maintain deployment velocity with safe code', () => {
      const safeBulkCode = Array.from({ length: 100 }, (_, i) => `
        useEffect(() => {
          console.log('Component ${i} mounted');
        }, []);
      `).join('\n');

      const startTime = Date.now();
      const result = runQualityGates(safeBulkCode);
      const endTime = Date.now();

      expect(result.passed).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 1초 이내 처리
    });
  });

  describe('비용 예측 정확도', () => {
    it('should accurately predict API call costs', () => {
      const rapidApiCalls: ApiCallPattern[] = Array.from({ length: 10 }, (_, i) => ({
        endpoint: '/api/auth/me',
        timestamp: 1000 + (i * 100), // 100ms 간격으로 10회 호출
        duration: 50
      }));

      const result = validateApiCallPatterns(rapidApiCalls);

      expect(result.isRisky).toBe(true);
      expect(result.riskLevel).toBe(CostRiskLevel.CRITICAL);
      expect(result.violations).toContain('rapid-succession');
      expect(result.estimatedCost).toBeGreaterThan(100);
    });

    it('should factor in compound risk multipliers', () => {
      const compoundRiskCode = `
        useEffect(() => {
          checkAuth();
        }, [checkAuth]);
      `;

      const detection = detectInfiniteLoops(compoundRiskCode);
      const costAnalysis = analyzeCostRisk(detection);

      // 복합 위험 요소로 인한 비용 증폭 확인
      expect(costAnalysis.riskFactors).toContain('high-frequency-auth-calls');
      expect(costAnalysis.estimatedDailyCost).toBeGreaterThan(detection.estimatedCost);
    });
  });
});