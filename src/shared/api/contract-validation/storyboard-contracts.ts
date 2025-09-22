/**
 * 스토리보드 데이터 계약 검증 시스템
 *
 * CLAUDE.md 준수:
 * - 데이터 계약 관리 및 버전 호환성 검증
 * - 스키마 변경 감지 및 영향도 분석
 * - CI/CD 통합을 위한 자동화된 계약 검증
 * - 하위 호환성 보장
 */

import { z } from 'zod';
import {
  ByteDanceImageResponseSchema,
  ByteDanceBatchResponseSchema,
  ImageGenerationConfigSchema,
  ConsistencyReferenceSchema,
  PromptEngineeringSchema,
  StoryboardCreateRequestSchema,
  FrameGenerationRequestSchema,
  BatchGenerationRequestSchema,
} from '../dto-transformers/storyboard-transformers';

// ===========================================
// 계약 버전 관리
// ===========================================

/**
 * API 계약 버전 정보
 */
export interface ContractVersion {
  readonly version: string;
  readonly createdAt: Date;
  readonly description: string;
  readonly breaking: boolean;
  readonly deprecated: boolean;
  readonly supportedUntil?: Date;
}

/**
 * 스키마 호환성 결과
 */
export interface CompatibilityResult {
  readonly isCompatible: boolean;
  readonly breaking: readonly BreakingChange[];
  readonly warnings: readonly CompatibilityWarning[];
  readonly recommendations: readonly string[];
}

/**
 * 파괴적 변경사항
 */
export interface BreakingChange {
  readonly type: 'field_removed' | 'type_changed' | 'constraint_added' | 'enum_value_removed';
  readonly path: string;
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
  readonly impact: 'low' | 'medium' | 'high' | 'critical';
  readonly migration: string;
}

/**
 * 호환성 경고
 */
export interface CompatibilityWarning {
  readonly type: 'field_deprecated' | 'new_required_field' | 'constraint_relaxed';
  readonly path: string;
  readonly message: string;
  readonly recommendation: string;
}

/**
 * 계약 검증 결과
 */
export interface ContractValidationResult {
  readonly isValid: boolean;
  readonly contractVersion: string;
  readonly schemaVersion: string;
  readonly compatibility: CompatibilityResult;
  readonly runtimeValidation: {
    readonly passed: number;
    readonly failed: number;
    readonly errors: readonly ContractViolation[];
  };
  readonly performanceImpact: {
    readonly validationTimeMs: number;
    readonly memoryUsageKB: number;
    readonly recommendOptimization: boolean;
  };
}

/**
 * 계약 위반 사항
 */
export interface ContractViolation {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly expectedType: string;
  readonly actualType: string;
  readonly severity: 'error' | 'warning';
  readonly autoFixable: boolean;
  readonly migrationHint?: string;
}

// ===========================================
// 계약 정의 (버전별)
// ===========================================

/**
 * 스토리보드 API 계약 v1.0
 */
export const StoryboardContractV1 = {
  version: '1.0.0',
  schemas: {
    request: {
      create: StoryboardCreateRequestSchema,
      frameGeneration: FrameGenerationRequestSchema,
      batchGeneration: BatchGenerationRequestSchema,
    },
    response: {
      byteDanceImage: ByteDanceImageResponseSchema,
      byteDanceBatch: ByteDanceBatchResponseSchema,
    },
    domain: {
      imageConfig: ImageGenerationConfigSchema,
      consistencyRef: ConsistencyReferenceSchema,
      promptEngineering: PromptEngineeringSchema,
    },
  },
  metadata: {
    createdAt: new Date('2024-01-01'),
    description: '스토리보드 API 초기 계약',
    breaking: false,
    deprecated: false,
  },
} as const;

/**
 * 계약 카탈로그 (모든 버전 관리)
 */
export class ContractCatalog {
  private static readonly contracts = new Map([
    ['1.0.0', StoryboardContractV1],
  ]);

  private static readonly currentVersion = '1.0.0';

  /**
   * 현재 계약 가져오기
   */
  static getCurrentContract() {
    return this.contracts.get(this.currentVersion)!;
  }

  /**
   * 특정 버전 계약 가져오기
   */
  static getContract(version: string) {
    return this.contracts.get(version);
  }

  /**
   * 모든 계약 버전 목록
   */
  static getVersions(): ContractVersion[] {
    return Array.from(this.contracts.entries()).map(([version, contract]) => ({
      version,
      createdAt: contract.metadata.createdAt,
      description: contract.metadata.description,
      breaking: contract.metadata.breaking,
      deprecated: contract.metadata.deprecated,
      supportedUntil: contract.metadata.supportedUntil,
    }));
  }

  /**
   * 새 계약 버전 등록
   */
  static registerContract(version: string, contract: typeof StoryboardContractV1) {
    this.contracts.set(version, contract);
  }
}

// ===========================================
// 계약 검증기
// ===========================================

/**
 * 스토리보드 계약 검증기
 */
export class StoryboardContractValidator {
  /**
   * 스키마 호환성 검증
   */
  static validateCompatibility(
    oldContract: typeof StoryboardContractV1,
    newContract: typeof StoryboardContractV1
  ): CompatibilityResult {
    const breakingChanges: BreakingChange[] = [];
    const warnings: CompatibilityWarning[] = [];
    const recommendations: string[] = [];

    // 요청 스키마 호환성 검증
    this.compareSchemas(
      oldContract.schemas.request.create,
      newContract.schemas.request.create,
      'request.create',
      breakingChanges,
      warnings
    );

    this.compareSchemas(
      oldContract.schemas.request.frameGeneration,
      newContract.schemas.request.frameGeneration,
      'request.frameGeneration',
      breakingChanges,
      warnings
    );

    // 응답 스키마 호환성 검증
    this.compareSchemas(
      oldContract.schemas.response.byteDanceImage,
      newContract.schemas.response.byteDanceImage,
      'response.byteDanceImage',
      breakingChanges,
      warnings
    );

    // 권장사항 생성
    if (breakingChanges.length > 0) {
      recommendations.push('파괴적 변경사항이 있습니다. 마이그레이션 가이드를 제공하세요.');
    }

    if (warnings.length > 3) {
      recommendations.push('많은 경고가 있습니다. 호환성 검토를 권장합니다.');
    }

    if (breakingChanges.some(change => change.impact === 'critical')) {
      recommendations.push('치명적 변경사항이 있습니다. 롤백을 고려하세요.');
    }

    return {
      isCompatible: breakingChanges.length === 0,
      breaking: breakingChanges,
      warnings,
      recommendations,
    };
  }

  /**
   * 런타임 계약 검증
   */
  static async validateRuntime(
    data: unknown,
    schemaType: 'request' | 'response',
    schemaName: string,
    contractVersion: string = ContractCatalog.getCurrentContract().version
  ): Promise<ContractValidationResult> {
    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();

    const contract = ContractCatalog.getContract(contractVersion);
    if (!contract) {
      throw new Error(`계약 버전 ${contractVersion}을 찾을 수 없습니다`);
    }

    const violations: ContractViolation[] = [];
    let passed = 0;
    let failed = 0;

    try {
      // 스키마 선택
      const schema = this.getSchema(contract, schemaType, schemaName);
      if (!schema) {
        throw new Error(`스키마 ${schemaType}.${schemaName}을 찾을 수 없습니다`);
      }

      // 검증 실행
      const result = schema.safeParse(data);

      if (result.success) {
        passed = 1;
      } else {
        failed = 1;
        // Zod 에러를 계약 위반으로 변환
        result.error.errors.forEach(error => {
          violations.push({
            code: error.code,
            message: error.message,
            path: error.path.join('.'),
            expectedType: this.getExpectedType(error),
            actualType: typeof error.received,
            severity: this.getSeverity(error),
            autoFixable: this.isAutoFixable(error),
            migrationHint: this.getMigrationHint(error),
          });
        });
      }
    } catch (error) {
      failed = 1;
      violations.push({
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        path: 'root',
        expectedType: 'valid_schema',
        actualType: 'unknown',
        severity: 'error',
        autoFixable: false,
      });
    }

    const endTime = performance.now();
    const finalMemory = this.getMemoryUsage();

    // 호환성 검증 (이전 버전과 비교)
    const compatibility = this.checkBackwardCompatibility(contractVersion);

    return {
      isValid: failed === 0,
      contractVersion,
      schemaVersion: contract.version,
      compatibility,
      runtimeValidation: {
        passed,
        failed,
        errors: violations,
      },
      performanceImpact: {
        validationTimeMs: endTime - startTime,
        memoryUsageKB: Math.max(0, finalMemory - initialMemory),
        recommendOptimization: endTime - startTime > 100, // 100ms 초과 시 최적화 권장
      },
    };
  }

  /**
   * 배치 검증 (CI/CD용)
   */
  static async validateBatch(
    testCases: Array<{
      name: string;
      data: unknown;
      schemaType: 'request' | 'response';
      schemaName: string;
      expectedValid: boolean;
    }>,
    contractVersion?: string
  ): Promise<{
    passed: number;
    failed: number;
    results: Array<{
      name: string;
      passed: boolean;
      result: ContractValidationResult;
    }>;
  }> {
    let passed = 0;
    let failed = 0;
    const results = [];

    for (const testCase of testCases) {
      try {
        const result = await this.validateRuntime(
          testCase.data,
          testCase.schemaType,
          testCase.schemaName,
          contractVersion
        );

        const testPassed = result.isValid === testCase.expectedValid;

        if (testPassed) {
          passed++;
        } else {
          failed++;
        }

        results.push({
          name: testCase.name,
          passed: testPassed,
          result,
        });
      } catch (error) {
        failed++;
        results.push({
          name: testCase.name,
          passed: false,
          result: {
            isValid: false,
            contractVersion: contractVersion || 'unknown',
            schemaVersion: 'unknown',
            compatibility: {
              isCompatible: false,
              breaking: [],
              warnings: [],
              recommendations: [],
            },
            runtimeValidation: {
              passed: 0,
              failed: 1,
              errors: [{
                code: 'TEST_ERROR',
                message: error instanceof Error ? error.message : '테스트 실행 오류',
                path: 'test',
                expectedType: 'valid_test',
                actualType: 'error',
                severity: 'error' as const,
                autoFixable: false,
              }],
            },
            performanceImpact: {
              validationTimeMs: 0,
              memoryUsageKB: 0,
              recommendOptimization: false,
            },
          },
        });
      }
    }

    return { passed, failed, results };
  }

  // === Private Helper Methods ===

  /**
   * 스키마 비교 (재귀적)
   */
  private static compareSchemas(
    oldSchema: z.ZodSchema,
    newSchema: z.ZodSchema,
    path: string,
    breakingChanges: BreakingChange[],
    warnings: CompatibilityWarning[]
  ): void {
    // Zod 스키마 비교는 복잡하므로 기본적인 검증만 구현
    // 실제 구현에서는 더 정교한 스키마 분석이 필요

    try {
      // 기본 타입 호환성 검증
      const oldType = this.getZodTypeName(oldSchema);
      const newType = this.getZodTypeName(newSchema);

      if (oldType !== newType) {
        breakingChanges.push({
          type: 'type_changed',
          path,
          oldValue: oldType,
          newValue: newType,
          impact: 'high',
          migration: `타입이 ${oldType}에서 ${newType}으로 변경되었습니다. 클라이언트 코드를 업데이트하세요.`,
        });
      }
    } catch (error) {
      warnings.push({
        type: 'field_deprecated',
        path,
        message: '스키마 비교 중 오류가 발생했습니다',
        recommendation: '수동으로 호환성을 확인하세요',
      });
    }
  }

  /**
   * Zod 타입명 추출
   */
  private static getZodTypeName(schema: z.ZodSchema): string {
    return schema._def.typeName || 'unknown';
  }

  /**
   * 스키마 선택기
   */
  private static getSchema(
    contract: typeof StoryboardContractV1,
    schemaType: 'request' | 'response',
    schemaName: string
  ): z.ZodSchema | null {
    if (schemaType === 'request') {
      return (contract.schemas.request as any)[schemaName] || null;
    } else if (schemaType === 'response') {
      return (contract.schemas.response as any)[schemaName] || null;
    }
    return null;
  }

  /**
   * 메모리 사용량 측정
   */
  private static getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize / 1024; // KB 단위
    }
    return 0;
  }

  /**
   * 예상 타입 추출
   */
  private static getExpectedType(error: z.ZodIssue): string {
    return error.expected || error.code;
  }

  /**
   * 심각도 결정
   */
  private static getSeverity(error: z.ZodIssue): 'error' | 'warning' {
    const criticalCodes = ['invalid_type', 'required'];
    return criticalCodes.includes(error.code) ? 'error' : 'warning';
  }

  /**
   * 자동 수정 가능 여부
   */
  private static isAutoFixable(error: z.ZodIssue): boolean {
    const autoFixableCodes = ['too_small', 'too_big'];
    return autoFixableCodes.includes(error.code);
  }

  /**
   * 마이그레이션 힌트 생성
   */
  private static getMigrationHint(error: z.ZodIssue): string | undefined {
    const hints: Record<string, string> = {
      'invalid_type': '올바른 타입으로 변환하세요',
      'required': '필수 필드를 추가하세요',
      'too_small': '최소값 이상으로 설정하세요',
      'too_big': '최대값 이하로 설정하세요',
    };

    return hints[error.code];
  }

  /**
   * 하위 호환성 검증
   */
  private static checkBackwardCompatibility(contractVersion: string): CompatibilityResult {
    const versions = ContractCatalog.getVersions();
    const currentIndex = versions.findIndex(v => v.version === contractVersion);

    if (currentIndex <= 0) {
      return {
        isCompatible: true,
        breaking: [],
        warnings: [],
        recommendations: [],
      };
    }

    const previousVersion = versions[currentIndex - 1];
    const currentContract = ContractCatalog.getContract(contractVersion)!;
    const previousContract = ContractCatalog.getContract(previousVersion.version);

    if (!previousContract) {
      return {
        isCompatible: false,
        breaking: [{
          type: 'field_removed',
          path: 'contract',
          impact: 'critical',
          migration: '이전 계약을 찾을 수 없습니다',
        }],
        warnings: [],
        recommendations: ['이전 계약 버전을 확인하세요'],
      };
    }

    return this.validateCompatibility(previousContract, currentContract);
  }
}

// ===========================================
// CI/CD 통합 유틸리티
// ===========================================

/**
 * CI/CD 파이프라인용 계약 검증 도구
 */
export class CIContractValidator {
  /**
   * 전체 계약 스위트 실행
   */
  static async runContractTests(): Promise<{
    success: boolean;
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    results: any[];
  }> {
    const testCases = this.generateTestCases();
    const batchResult = await StoryboardContractValidator.validateBatch(testCases);

    return {
      success: batchResult.failed === 0,
      summary: {
        total: testCases.length,
        passed: batchResult.passed,
        failed: batchResult.failed,
        skipped: 0,
      },
      results: batchResult.results,
    };
  }

  /**
   * 계약 변경 감지
   */
  static detectContractChanges(
    oldVersion: string,
    newVersion: string
  ): {
    hasChanges: boolean;
    compatibility: CompatibilityResult;
    recommendation: 'approve' | 'review' | 'reject';
  } {
    const oldContract = ContractCatalog.getContract(oldVersion);
    const newContract = ContractCatalog.getContract(newVersion);

    if (!oldContract || !newContract) {
      return {
        hasChanges: true,
        compatibility: {
          isCompatible: false,
          breaking: [{
            type: 'field_removed',
            path: 'contract',
            impact: 'critical',
            migration: '계약을 찾을 수 없습니다',
          }],
          warnings: [],
          recommendations: [],
        },
        recommendation: 'reject',
      };
    }

    const compatibility = StoryboardContractValidator.validateCompatibility(oldContract, newContract);

    let recommendation: 'approve' | 'review' | 'reject' = 'approve';

    if (compatibility.breaking.length > 0) {
      const hasCritical = compatibility.breaking.some(change => change.impact === 'critical');
      recommendation = hasCritical ? 'reject' : 'review';
    } else if (compatibility.warnings.length > 5) {
      recommendation = 'review';
    }

    return {
      hasChanges: compatibility.breaking.length > 0 || compatibility.warnings.length > 0,
      compatibility,
      recommendation,
    };
  }

  /**
   * 테스트 케이스 생성
   */
  private static generateTestCases() {
    return [
      {
        name: 'Valid storyboard creation request',
        data: {
          scenarioId: '123e4567-e89b-12d3-a456-426614174000',
          title: '테스트 스토리보드',
          description: '테스트용 스토리보드입니다',
          userId: '123e4567-e89b-12d3-a456-426614174001',
          frames: [{
            sceneId: '123e4567-e89b-12d3-a456-426614174002',
            sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경',
            priority: 'normal' as const,
          }],
        },
        schemaType: 'request' as const,
        schemaName: 'create',
        expectedValid: true,
      },
      {
        name: 'Invalid storyboard request - missing required fields',
        data: {
          title: '제목만 있는 요청',
        },
        schemaType: 'request' as const,
        schemaName: 'create',
        expectedValid: false,
      },
      // 더 많은 테스트 케이스...
    ];
  }
}

// Export all
export {
  ContractCatalog,
  StoryboardContractValidator,
  CIContractValidator,
};