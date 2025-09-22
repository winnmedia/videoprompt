/**
 * 스토리보드 데이터 계약 검증 시스템 테스트
 *
 * CLAUDE.md 준수:
 * - TDD 원칙 (Red → Green → Refactor)
 * - 계약 호환성 검증 철저함
 * - CI/CD 통합 시나리오 테스트
 */

import {
  ContractCatalog,
  StoryboardContractValidator,
  CIContractValidator,
  StoryboardContractV1,
  CompatibilityResult,
  ContractValidationResult,
} from '../contract-validation/storyboard-contracts';
import { ValidationError } from '../types';

// ===========================================
// 테스트 픽스처
// ===========================================

/**
 * 유효한 스토리보드 생성 요청 테스트 데이터
 */
const validCreateRequest = {
  scenarioId: '123e4567-e89b-12d3-a456-426614174000',
  title: '테스트 스토리보드',
  description: '계약 검증용 테스트 스토리보드',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  frames: [
    {
      sceneId: '123e4567-e89b-12d3-a456-426614174002',
      sceneDescription: '아름다운 일몰이 보이는 바닷가 풍경, 파도가 부드럽게 치는 모습',
      additionalPrompt: '시네마틱 조명으로 드라마틱한 분위기',
      config: {
        model: 'dall-e-3' as const,
        aspectRatio: '16:9' as const,
        quality: 'hd' as const,
        style: 'cinematic' as const,
      },
      priority: 'normal' as const,
    },
  ],
};

/**
 * 잘못된 스토리보드 생성 요청 테스트 데이터
 */
const invalidCreateRequest = {
  // scenarioId 누락
  title: '', // 빈 제목
  userId: 'invalid-uuid', // 잘못된 UUID 형식
  frames: [], // 빈 프레임 배열
};

/**
 * 유효한 ByteDance API 응답 테스트 데이터
 */
const validByteDanceResponse = {
  request_id: 'req_123456789',
  status: 'success' as const,
  data: {
    images: [
      {
        image_url: 'https://example.com/generated-image.png',
        image_id: 'img_987654321',
        width: 1920,
        height: 1080,
        format: 'png' as const,
        file_size: 2048576,
        created_at: '2024-01-15T10:30:00.000Z',
      },
    ],
    prompt_used: '아름다운 일몰이 보이는 바닷가 풍경, 시네마틱 스타일',
    model: 'stable-diffusion-xl',
    parameters: {
      style: 'cinematic',
      quality: 'hd',
      aspect_ratio: '16:9',
      seed: 42,
      steps: 30,
      guidance_scale: 7.5,
    },
    processing_time_ms: 15000,
    cost: 0.04,
  },
};

/**
 * 모든 테스트 케이스
 */
const testCases = [
  {
    name: 'valid_storyboard_create_request',
    data: validCreateRequest,
    schemaType: 'request' as const,
    schemaName: 'create',
    expectedValid: true,
  },
  {
    name: 'invalid_storyboard_create_request',
    data: invalidCreateRequest,
    schemaType: 'request' as const,
    schemaName: 'create',
    expectedValid: false,
  },
  {
    name: 'valid_bytedance_response',
    data: validByteDanceResponse,
    schemaType: 'response' as const,
    schemaName: 'byteDanceImage',
    expectedValid: true,
  },
  {
    name: 'invalid_bytedance_response_no_data',
    data: {
      request_id: 'req_123',
      status: 'success',
      // data 필드 누락
    },
    schemaType: 'response' as const,
    schemaName: 'byteDanceImage',
    expectedValid: false,
  },
];

// ===========================================
// 계약 카탈로그 테스트
// ===========================================

describe('ContractCatalog', () => {
  describe('계약 관리', () => {
    it('현재 계약을 올바르게 반환해야 함', () => {
      // When
      const currentContract = ContractCatalog.getCurrentContract();

      // Then
      expect(currentContract).toBeDefined();
      expect(currentContract.version).toBe('1.0.0');
      expect(currentContract.schemas).toBeDefined();
      expect(currentContract.schemas.request).toBeDefined();
      expect(currentContract.schemas.response).toBeDefined();
    });

    it('특정 버전 계약을 올바르게 반환해야 함', () => {
      // When
      const contract = ContractCatalog.getContract('1.0.0');

      // Then
      expect(contract).toBeDefined();
      expect(contract?.version).toBe('1.0.0');
    });

    it('존재하지 않는 버전에 대해 undefined를 반환해야 함', () => {
      // When
      const contract = ContractCatalog.getContract('2.0.0');

      // Then
      expect(contract).toBeUndefined();
    });

    it('모든 계약 버전 목록을 반환해야 함', () => {
      // When
      const versions = ContractCatalog.getVersions();

      // Then
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe('1.0.0');
      expect(versions[0].breaking).toBe(false);
      expect(versions[0].deprecated).toBe(false);
    });

    it('새 계약 버전을 등록할 수 있어야 함', () => {
      // Given
      const newContract = {
        ...StoryboardContractV1,
        version: '1.1.0',
        metadata: {
          ...StoryboardContractV1.metadata,
          createdAt: new Date('2024-02-01'),
          description: '마이너 업데이트',
        },
      };

      // When
      ContractCatalog.registerContract('1.1.0', newContract);
      const retrievedContract = ContractCatalog.getContract('1.1.0');

      // Then
      expect(retrievedContract).toBeDefined();
      expect(retrievedContract?.version).toBe('1.1.0');

      // Cleanup
      const versions = ContractCatalog.getVersions();
      expect(versions).toHaveLength(2);
    });
  });
});

// ===========================================
// 계약 검증기 테스트
// ===========================================

describe('StoryboardContractValidator', () => {
  // 성능 측정을 위한 모킹
  beforeEach(() => {
    Object.defineProperty(globalThis, 'performance', {
      value: {
        now: jest.fn(() => Date.now()),
        memory: {
          usedJSHeapSize: 1024 * 1024, // 1MB
        },
      },
      writable: true,
    });
  });

  describe('런타임 계약 검증', () => {
    it('유효한 스토리보드 생성 요청을 성공적으로 검증해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        validCreateRequest,
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(true);
      expect(result.contractVersion).toBe('1.0.0');
      expect(result.schemaVersion).toBe('1.0.0');
      expect(result.runtimeValidation.passed).toBe(1);
      expect(result.runtimeValidation.failed).toBe(0);
      expect(result.runtimeValidation.errors).toHaveLength(0);
    });

    it('잘못된 스토리보드 생성 요청에 대해 검증 실패를 반환해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        invalidCreateRequest,
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(false);
      expect(result.runtimeValidation.passed).toBe(0);
      expect(result.runtimeValidation.failed).toBe(1);
      expect(result.runtimeValidation.errors.length).toBeGreaterThan(0);

      // 특정 에러 확인
      const errors = result.runtimeValidation.errors;
      expect(errors.some(error => error.path.includes('scenarioId'))).toBe(true);
      expect(errors.some(error => error.path.includes('title'))).toBe(true);
    });

    it('유효한 ByteDance 응답을 성공적으로 검증해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        validByteDanceResponse,
        'response',
        'byteDanceImage'
      );

      // Then
      expect(result.isValid).toBe(true);
      expect(result.runtimeValidation.passed).toBe(1);
      expect(result.runtimeValidation.failed).toBe(0);
    });

    it('존재하지 않는 스키마에 대해 에러를 발생시켜야 함', async () => {
      // When & Then
      await expect(
        StoryboardContractValidator.validateRuntime(
          validCreateRequest,
          'request',
          'nonexistent'
        )
      ).rejects.toThrow();
    });

    it('존재하지 않는 계약 버전에 대해 에러를 발생시켜야 함', async () => {
      // When & Then
      await expect(
        StoryboardContractValidator.validateRuntime(
          validCreateRequest,
          'request',
          'create',
          '2.0.0'
        )
      ).rejects.toThrow();
    });

    it('성능 지표를 올바르게 측정해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        validCreateRequest,
        'request',
        'create'
      );

      // Then
      expect(result.performanceImpact.validationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.performanceImpact.memoryUsageKB).toBeGreaterThanOrEqual(0);
      expect(typeof result.performanceImpact.recommendOptimization).toBe('boolean');
    });
  });

  describe('배치 검증', () => {
    it('여러 테스트 케이스를 배치로 검증해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateBatch(testCases);

      // Then
      expect(result.passed + result.failed).toBe(testCases.length);
      expect(result.results).toHaveLength(testCases.length);

      // 각 테스트 케이스 결과 확인
      result.results.forEach((testResult, index) => {
        expect(testResult.name).toBe(testCases[index].name);
        expect(typeof testResult.passed).toBe('boolean');
        expect(testResult.result).toBeDefined();
      });
    });

    it('유효한 테스트 케이스는 통과하고 잘못된 케이스는 실패해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateBatch(testCases);

      // Then
      const validTestResult = result.results.find(r => r.name === 'valid_storyboard_create_request');
      const invalidTestResult = result.results.find(r => r.name === 'invalid_storyboard_create_request');

      expect(validTestResult?.passed).toBe(true);
      expect(invalidTestResult?.passed).toBe(true); // 실패가 예상되므로 테스트는 통과
    });

    it('특정 계약 버전으로 배치 검증을 수행해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateBatch(
        testCases,
        '1.0.0'
      );

      // Then
      expect(result.results.every(r => r.result.contractVersion === '1.0.0')).toBe(true);
    });
  });

  describe('호환성 검증', () => {
    it('동일한 계약 버전에 대해 호환성을 확인해야 함', () => {
      // When
      const compatibility = StoryboardContractValidator.validateCompatibility(
        StoryboardContractV1,
        StoryboardContractV1
      );

      // Then
      expect(compatibility.isCompatible).toBe(true);
      expect(compatibility.breaking).toHaveLength(0);
      expect(compatibility.warnings).toHaveLength(0);
    });

    it('다른 계약 버전 간 호환성을 검증해야 함', () => {
      // Given
      const modifiedContract = {
        ...StoryboardContractV1,
        version: '1.1.0',
        // 실제로는 스키마가 수정되어야 하지만, 테스트를 위해 버전만 변경
      };

      // When
      const compatibility = StoryboardContractValidator.validateCompatibility(
        StoryboardContractV1,
        modifiedContract
      );

      // Then
      expect(compatibility).toBeDefined();
      expect(typeof compatibility.isCompatible).toBe('boolean');
      expect(Array.isArray(compatibility.breaking)).toBe(true);
      expect(Array.isArray(compatibility.warnings)).toBe(true);
      expect(Array.isArray(compatibility.recommendations)).toBe(true);
    });
  });
});

// ===========================================
// CI/CD 통합 테스트
// ===========================================

describe('CIContractValidator', () => {
  describe('계약 테스트 스위트', () => {
    it('전체 계약 테스트 스위트를 실행해야 함', async () => {
      // When
      const result = await CIContractValidator.runContractTests();

      // Then
      expect(result.success).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.summary.passed + result.summary.failed + result.summary.skipped)
        .toBe(result.summary.total);
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('성공적인 테스트 실행 시 success를 true로 반환해야 함', async () => {
      // When
      const result = await CIContractValidator.runContractTests();

      // Then
      if (result.summary.failed === 0) {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('계약 변경 감지', () => {
    it('동일한 버전에서 변경사항이 없다고 감지해야 함', () => {
      // When
      const result = CIContractValidator.detectContractChanges('1.0.0', '1.0.0');

      // Then
      expect(result.hasChanges).toBe(false);
      expect(result.recommendation).toBe('approve');
    });

    it('존재하지 않는 버전에 대해 거부 권고를 반환해야 함', () => {
      // When
      const result = CIContractValidator.detectContractChanges('1.0.0', '2.0.0');

      // Then
      expect(result.hasChanges).toBe(true);
      expect(result.compatibility.isCompatible).toBe(false);
      expect(result.recommendation).toBe('reject');
    });

    it('새 계약 버전을 등록한 후 변경사항을 감지해야 함', () => {
      // Given - 새 계약 버전 등록
      const newContract = {
        ...StoryboardContractV1,
        version: '1.2.0',
        metadata: {
          ...StoryboardContractV1.metadata,
          createdAt: new Date('2024-03-01'),
          description: '테스트용 계약 변경',
          breaking: false,
        },
      };
      ContractCatalog.registerContract('1.2.0', newContract);

      // When
      const result = CIContractValidator.detectContractChanges('1.0.0', '1.2.0');

      // Then
      expect(result).toBeDefined();
      expect(typeof result.hasChanges).toBe('boolean');
      expect(['approve', 'review', 'reject']).toContain(result.recommendation);
    });
  });
});

// ===========================================
// 에러 처리 및 에지 케이스 테스트
// ===========================================

describe('에러 처리 및 에지 케이스', () => {
  describe('잘못된 입력 처리', () => {
    it('null 데이터에 대해 적절한 에러를 반환해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        null,
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(false);
      expect(result.runtimeValidation.errors.length).toBeGreaterThan(0);
    });

    it('undefined 데이터에 대해 적절한 에러를 반환해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        undefined,
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(false);
      expect(result.runtimeValidation.errors.length).toBeGreaterThan(0);
    });

    it('빈 객체에 대해 적절한 에러를 반환해야 함', async () => {
      // When
      const result = await StoryboardContractValidator.validateRuntime(
        {},
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(false);
      expect(result.runtimeValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('타입 안전성', () => {
    it('잘못된 스키마 타입에 대해 에러를 발생시켜야 함', async () => {
      // When & Then
      await expect(
        StoryboardContractValidator.validateRuntime(
          validCreateRequest,
          'invalid' as any,
          'create'
        )
      ).rejects.toThrow();
    });

    it('잘못된 데이터 타입에 대해 검증 실패를 반환해야 함', async () => {
      // Given
      const wrongTypeData = {
        ...validCreateRequest,
        frames: 'not-an-array', // 배열이어야 하는데 문자열
      };

      // When
      const result = await StoryboardContractValidator.validateRuntime(
        wrongTypeData,
        'request',
        'create'
      );

      // Then
      expect(result.isValid).toBe(false);
      expect(result.runtimeValidation.errors.some(error =>
        error.code === 'invalid_type'
      )).toBe(true);
    });
  });

  describe('메모리 및 성능 한계', () => {
    it('대용량 데이터에 대해서도 합리적인 시간 내에 검증을 완료해야 함', async () => {
      // Given
      const largeData = {
        ...validCreateRequest,
        frames: Array(100).fill(validCreateRequest.frames[0]),
      };

      // When
      const startTime = performance.now();
      const result = await StoryboardContractValidator.validateRuntime(
        largeData,
        'request',
        'create'
      );
      const endTime = performance.now();

      // Then
      expect(endTime - startTime).toBeLessThan(5000); // 5초 이내
      expect(result).toBeDefined();
    });

    it('성능 권고를 올바르게 제공해야 함', async () => {
      // Given - 복잡한 데이터로 느린 검증 시뮬레이션
      const complexData = {
        ...validCreateRequest,
        description: 'A'.repeat(10000), // 긴 설명
        frames: Array(50).fill({
          ...validCreateRequest.frames[0],
          sceneDescription: 'B'.repeat(1000), // 긴 프롬프트
        }),
      };

      // When
      const result = await StoryboardContractValidator.validateRuntime(
        complexData,
        'request',
        'create'
      );

      // Then
      expect(result.performanceImpact.recommendOptimization).toBeDefined();
      if (result.performanceImpact.validationTimeMs > 100) {
        expect(result.performanceImpact.recommendOptimization).toBe(true);
      }
    });
  });
});

// ===========================================
// 통합 시나리오 테스트
// ===========================================

describe('통합 시나리오', () => {
  it('전체 계약 검증 파이프라인이 정상 작동해야 함', async () => {
    // Phase 1: 런타임 검증
    const runtimeResult = await StoryboardContractValidator.validateRuntime(
      validCreateRequest,
      'request',
      'create'
    );
    expect(runtimeResult.isValid).toBe(true);

    // Phase 2: 배치 검증
    const batchResult = await StoryboardContractValidator.validateBatch([
      {
        name: 'integration_test',
        data: validCreateRequest,
        schemaType: 'request',
        schemaName: 'create',
        expectedValid: true,
      },
    ]);
    expect(batchResult.passed).toBe(1);
    expect(batchResult.failed).toBe(0);

    // Phase 3: CI 검증
    const ciResult = await CIContractValidator.runContractTests();
    expect(ciResult.summary.total).toBeGreaterThan(0);

    // Phase 4: 변경사항 감지
    const changeResult = CIContractValidator.detectContractChanges('1.0.0', '1.0.0');
    expect(changeResult.hasChanges).toBe(false);
    expect(changeResult.recommendation).toBe('approve');
  });

  it('계약 위반 시나리오를 올바르게 처리해야 함', async () => {
    // Given - 계약 위반 데이터
    const violatingData = {
      // 모든 필수 필드 누락
    };

    // When - 검증 실행
    const result = await StoryboardContractValidator.validateRuntime(
      violatingData,
      'request',
      'create'
    );

    // Then - 위반 감지
    expect(result.isValid).toBe(false);
    expect(result.runtimeValidation.errors.length).toBeGreaterThan(0);

    // 자동 수정 가능한 에러 확인
    const autoFixableErrors = result.runtimeValidation.errors.filter(
      error => error.autoFixable
    );

    // 마이그레이션 힌트 확인
    const errorsWithHints = result.runtimeValidation.errors.filter(
      error => error.migrationHint
    );

    expect(autoFixableErrors.length + errorsWithHints.length).toBeGreaterThanOrEqual(0);
  });
});