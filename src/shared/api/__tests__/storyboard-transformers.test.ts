/**
 * 스토리보드 DTO 변환기 및 검증 시스템 테스트
 *
 * CLAUDE.md 준수:
 * - TDD 원칙 (Red → Green → Refactor)
 * - MSW를 통한 의존성 절단
 * - 결정론적 테스트 (플래키 불허)
 * - 엣지 케이스 및 에러 시나리오 포함
 */

import {
  storyboardTransformers,
  ByteDanceImageResponseSchema,
  StoryboardCreateRequestSchema,
  FrameGenerationRequestSchema,
  StoryboardDataQualityResult,
  PromptQualityAnalysis,
  UrlValidationResult,
} from '../dto-transformers/storyboard-transformers';
import {
  ImageGenerationConfig,
  GenerationResult,
  PromptEngineering,
  Storyboard,
  StoryboardFrame,
  STORYBOARD_CONSTANTS,
} from '../../../entities/storyboard';
import { ValidationError } from '../types';

// ===========================================
// 테스트 픽스처 (고정된 테스트 데이터)
// ===========================================

/**
 * 유효한 ByteDance API 응답 픽스처
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
 * 유효한 스토리보드 생성 요청 픽스처
 */
const validStoryboardCreateRequest = {
  scenarioId: '123e4567-e89b-12d3-a456-426614174000',
  title: '테스트 스토리보드',
  description: '단위 테스트용 스토리보드입니다',
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
 * 프롬프트 엔지니어링 픽스처
 */
const validPromptEngineering: PromptEngineering = {
  basePrompt: '아름다운 일몰이 보이는 바닷가 풍경',
  enhancedPrompt: '아름다운 일몰이 보이는 바닷가 풍경, 시네마틱 스타일, 드라마틱한 조명',
  styleModifiers: ['cinematic', 'dramatic lighting'],
  technicalSpecs: ['16:9 aspect ratio', 'high definition'],
  negativePrompt: 'blurry, low quality',
  promptTokens: 25,
};

/**
 * 이미지 생성 설정 픽스처
 */
const validImageConfig: ImageGenerationConfig = {
  model: 'dall-e-3',
  aspectRatio: '16:9',
  quality: 'hd',
  style: 'cinematic',
  seed: 42,
  steps: 30,
  guidanceScale: 7.5,
};

/**
 * 테스트용 스토리보드 픽스처
 */
const createTestStoryboard = (): Storyboard => ({
  metadata: {
    id: 'sb_test_123',
    scenarioId: validStoryboardCreateRequest.scenarioId,
    title: validStoryboardCreateRequest.title,
    description: validStoryboardCreateRequest.description,
    createdAt: new Date('2024-01-15T10:00:00.000Z'),
    updatedAt: new Date('2024-01-15T10:00:00.000Z'),
    status: 'draft',
    userId: validStoryboardCreateRequest.userId,
    version: 1,
  },
  frames: [
    {
      metadata: {
        id: 'frame_test_123',
        sceneId: validStoryboardCreateRequest.frames[0].sceneId,
        order: 1,
        title: '프레임 1',
        description: validStoryboardCreateRequest.frames[0].sceneDescription,
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        updatedAt: new Date('2024-01-15T10:00:00.000Z'),
        status: 'pending',
        userId: validStoryboardCreateRequest.userId,
      },
      prompt: validPromptEngineering,
      config: validImageConfig,
      consistencyRefs: [],
      attempts: [],
    },
  ],
  settings: {
    defaultConfig: validImageConfig,
    globalConsistencyRefs: [],
    autoGeneration: false,
    qualityThreshold: 0.7,
    maxRetries: 3,
    batchSize: 5,
  },
});

// ===========================================
// ByteDance API 응답 변환 테스트
// ===========================================

describe('ByteDance API 응답 변환', () => {
  beforeEach(() => {
    // 시간 고정 (결정론적 테스트)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('성공적인 응답 변환', () => {
    it('유효한 ByteDance 응답을 GenerationResult로 변환해야 함', () => {
      // Given
      const frameId = 'frame_test_123';
      const originalPrompt = validPromptEngineering;
      const config = validImageConfig;

      // When
      const result = storyboardTransformers.generationResultFromByteDance(
        validByteDanceResponse,
        frameId,
        originalPrompt,
        config
      );

      // Then
      expect(result).toEqual({
        imageUrl: 'https://example.com/generated-image.png',
        thumbnailUrl: 'https://example.com/generated-image_thumb.png',
        generationId: 'img_987654321',
        model: 'stable-diffusion',
        config: expect.objectContaining({
          model: 'dall-e-3',
          aspectRatio: '16:9',
          quality: 'hd',
          style: 'cinematic',
          seed: 42,
          steps: 30,
          guidanceScale: 7.5,
        }),
        prompt: expect.objectContaining({
          enhancedPrompt: '아름다운 일몰이 보이는 바닷가 풍경, 시네마틱 스타일',
        }),
        generatedAt: new Date('2024-01-15T10:30:00.000Z'),
        processingTime: 15,
        cost: 0.04,
      });
    });

    it('썸네일 URL을 올바르게 생성해야 함', () => {
      // Given
      const imageUrl = 'https://example.com/image.png';

      // When
      const result = storyboardTransformers.generationResultFromByteDance(
        validByteDanceResponse,
        'frame_123',
        validPromptEngineering,
        validImageConfig
      );

      // Then
      expect(result.thumbnailUrl).toBe('https://example.com/generated-image_thumb.png');
    });
  });

  describe('에러 처리', () => {
    it('실패한 ByteDance 응답에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const failedResponse = {
        ...validByteDanceResponse,
        status: 'failed',
        data: undefined,
        error: {
          code: 'GENERATION_FAILED',
          message: '이미지 생성에 실패했습니다',
        },
      };

      // When & Then
      expect(() => {
        storyboardTransformers.generationResultFromByteDance(
          failedResponse,
          'frame_123',
          validPromptEngineering,
          validImageConfig
        );
      }).toThrow(ValidationError);
    });

    it('이미지가 없는 응답에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const noImageResponse = {
        ...validByteDanceResponse,
        data: {
          ...validByteDanceResponse.data,
          images: [],
        },
      };

      // When & Then
      expect(() => {
        storyboardTransformers.generationResultFromByteDance(
          noImageResponse,
          'frame_123',
          validPromptEngineering,
          validImageConfig
        );
      }).toThrow(ValidationError);
    });

    it('잘못된 스키마 데이터에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const invalidResponse = {
        invalid: 'data',
      };

      // When & Then
      expect(() => {
        storyboardTransformers.generationResultFromByteDance(
          invalidResponse,
          'frame_123',
          validPromptEngineering,
          validImageConfig
        );
      }).toThrow(ValidationError);
    });
  });
});

// ===========================================
// 스토리보드 생성 요청 검증 테스트
// ===========================================

describe('스토리보드 생성 요청 검증', () => {
  describe('유효한 요청 검증', () => {
    it('유효한 스토리보드 생성 요청을 검증하고 변환해야 함', () => {
      // When
      const result = storyboardTransformers.validateStoryboardCreateRequest(
        validStoryboardCreateRequest
      );

      // Then
      expect(result).toEqual({
        scenarioId: validStoryboardCreateRequest.scenarioId,
        title: validStoryboardCreateRequest.title,
        description: validStoryboardCreateRequest.description,
        config: undefined,
        consistencyRefs: undefined,
        userId: validStoryboardCreateRequest.userId,
      });
    });

    it('선택적 필드가 있는 요청을 올바르게 처리해야 함', () => {
      // Given
      const requestWithOptional = {
        ...validStoryboardCreateRequest,
        config: {
          model: 'midjourney' as const,
          quality: '4k' as const,
        },
        consistencyRefs: [
          {
            id: 'ref_123',
            type: 'character' as const,
            name: '주인공',
            description: '젊은 남성 캐릭터',
            keyFeatures: ['dark hair', 'casual clothes'],
            weight: 0.8,
            isActive: true,
          },
        ],
      };

      // When
      const result = storyboardTransformers.validateStoryboardCreateRequest(requestWithOptional);

      // Then
      expect(result.config).toBeDefined();
      expect(result.consistencyRefs).toBeDefined();
      expect(result.consistencyRefs).toHaveLength(1);
    });
  });

  describe('잘못된 요청 검증', () => {
    it('필수 필드가 누락된 요청에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const invalidRequest = {
        title: '제목만 있는 요청',
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(invalidRequest);
      }).toThrow(ValidationError);
    });

    it('잘못된 UUID 형식에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const invalidUuidRequest = {
        ...validStoryboardCreateRequest,
        scenarioId: 'invalid-uuid',
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(invalidUuidRequest);
      }).toThrow(ValidationError);
    });

    it('프레임이 없는 요청에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const noFramesRequest = {
        ...validStoryboardCreateRequest,
        frames: [],
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(noFramesRequest);
      }).toThrow(ValidationError);
    });

    it('너무 많은 프레임이 있는 요청에 대해 ValidationError를 발생시켜야 함', () => {
      // Given
      const tooManyFramesRequest = {
        ...validStoryboardCreateRequest,
        frames: Array(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT + 1).fill(
          validStoryboardCreateRequest.frames[0]
        ),
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(tooManyFramesRequest);
      }).toThrow(ValidationError);
    });
  });
});

// ===========================================
// 데이터 품질 검증 테스트
// ===========================================

describe('데이터 품질 검증', () => {
  let testStoryboard: Storyboard;

  beforeEach(() => {
    testStoryboard = createTestStoryboard();
  });

  describe('기본 품질 검증', () => {
    it('유효한 스토리보드에 대해 높은 품질 점수를 반환해야 함', () => {
      // When
      const result = storyboardTransformers.performDataQualityCheck(testStoryboard);

      // Then
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.errors).toHaveLength(0);
    });

    it('품질 메트릭을 올바르게 계산해야 함', () => {
      // When
      const result = storyboardTransformers.performDataQualityCheck(testStoryboard);

      // Then
      expect(result.metrics).toEqual({
        promptQualityScore: expect.any(Number),
        consistencyScore: expect.any(Number),
        technicalValidityScore: expect.any(Number),
        urlValidityScore: expect.any(Number),
        duplicateFramesCount: expect.any(Number),
        missingPromptsCount: expect.any(Number),
      });
    });
  });

  describe('문제가 있는 스토리보드 검증', () => {
    it('제목이 없는 스토리보드에 대해 에러를 반환해야 함', () => {
      // Given
      testStoryboard.metadata.title = '';

      // When
      const result = storyboardTransformers.performDataQualityCheck(testStoryboard);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.code === 'TITLE_REQUIRED')).toBe(true);
    });

    it('프레임이 없는 스토리보드에 대해 에러를 반환해야 함', () => {
      // Given
      testStoryboard.frames = [];

      // When
      const result = storyboardTransformers.performDataQualityCheck(testStoryboard);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.code === 'NO_FRAMES')).toBe(true);
    });

    it('너무 많은 프레임이 있는 스토리보드에 대해 경고를 반환해야 함', () => {
      // Given
      const manyFrames = Array(STORYBOARD_CONSTANTS.MAX_FRAMES_COUNT + 10)
        .fill(null)
        .map((_, index) => ({
          ...testStoryboard.frames[0],
          metadata: {
            ...testStoryboard.frames[0].metadata,
            id: `frame_${index}`,
            order: index + 1,
          },
        }));
      testStoryboard.frames = manyFrames;

      // When
      const result = storyboardTransformers.performDataQualityCheck(testStoryboard);

      // Then
      expect(result.warnings.some(warning => warning.code === 'TOO_MANY_FRAMES')).toBe(true);
    });
  });
});

// ===========================================
// URL 검증 테스트
// ===========================================

describe('URL 검증', () => {
  // Mock fetch for testing
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('유효한 URL 검증', () => {
    it('유효한 이미지 URL에 대해 성공 결과를 반환해야 함', async () => {
      // Given
      const validUrl = 'https://example.com/image.png';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/png';
            if (name === 'content-length') return '1024000';
            return null;
          },
        },
      });

      // When
      const result = await storyboardTransformers.validateImageUrl(validUrl);

      // Then
      expect(result.isValid).toBe(true);
      expect(result.isReachable).toBe(true);
      expect(result.contentType).toBe('image/png');
      expect(result.fileSize).toBe(1024000);
    });

    it('큰 파일에 대해 에러를 반환해야 함', async () => {
      // Given
      const largeFileUrl = 'https://example.com/large-image.png';
      const maxSizeMB = STORYBOARD_CONSTANTS.MAX_FILE_SIZE_MB;
      const largeFileSize = (maxSizeMB + 1) * 1024 * 1024;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'image/png';
            if (name === 'content-length') return largeFileSize.toString();
            return null;
          },
        },
      });

      // When
      const result = await storyboardTransformers.validateImageUrl(largeFileUrl);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('파일 크기가 너무 큽니다');
    });
  });

  describe('잘못된 URL 검증', () => {
    it('잘못된 URL 형식에 대해 에러를 반환해야 함', async () => {
      // Given
      const invalidUrl = 'not-a-valid-url';

      // When
      const result = await storyboardTransformers.validateImageUrl(invalidUrl);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.isReachable).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('접근할 수 없는 URL에 대해 에러를 반환해야 함', async () => {
      // Given
      const unreachableUrl = 'https://example.com/nonexistent.png';
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // When
      const result = await storyboardTransformers.validateImageUrl(unreachableUrl);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.isReachable).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });

    it('이미지가 아닌 콘텐츠에 대해 에러를 반환해야 함', async () => {
      // Given
      const nonImageUrl = 'https://example.com/document.pdf';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'application/pdf';
            return null;
          },
        },
      });

      // When
      const result = await storyboardTransformers.validateImageUrl(nonImageUrl);

      // Then
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('이미지 형식이 아닙니다');
    });
  });
});

// ===========================================
// 프롬프트 품질 분석 테스트
// ===========================================

describe('프롬프트 품질 분석', () => {
  describe('고품질 프롬프트 분석', () => {
    it('상세하고 기술적인 프롬프트에 대해 높은 점수를 반환해야 함', () => {
      // Given
      const highQualityPrompt =
        '아름다운 일몰이 보이는 바닷가 풍경, 황금빛 햇살이 파도에 반사되는 모습, ' +
        '시네마틱 조명, 와이드 샷, 드라마틱한 분위기, 높은 해상도, 선명한 디테일';

      // When
      const result = storyboardTransformers.analyzePromptQuality(highQualityPrompt);

      // Then
      expect(result.score).toBeGreaterThan(70);
      expect(result.descriptiveRichness).toBeGreaterThan(0.2);
      expect(result.technicalClarity).toBeGreaterThan(0.1);
      expect(result.issues).toHaveLength(0);
    });

    it('프롬프트 메트릭을 올바르게 계산해야 함', () => {
      // Given
      const prompt = '빨간 자동차가 도로를 달리는 모습';

      // When
      const result = storyboardTransformers.analyzePromptQuality(prompt);

      // Then
      expect(result.wordCount).toBe(5);
      expect(result.sentenceCount).toBe(1);
      expect(result.descriptiveRichness).toBeGreaterThanOrEqual(0);
      expect(result.technicalClarity).toBeGreaterThanOrEqual(0);
      expect(result.styleConsistency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('문제가 있는 프롬프트 분석', () => {
    it('너무 짧은 프롬프트에 대해 이슈를 반환해야 함', () => {
      // Given
      const shortPrompt = '자동차';

      // When
      const result = storyboardTransformers.analyzePromptQuality(shortPrompt);

      // Then
      expect(result.issues).toContain('프롬프트가 너무 짧습니다');
      expect(result.suggestions).toContain('더 구체적인 설명을 추가하세요');
    });

    it('너무 긴 프롬프트에 대해 이슈를 반환해야 함', () => {
      // Given
      const longPrompt = 'A '.repeat(100) + 'very long prompt';

      // When
      const result = storyboardTransformers.analyzePromptQuality(longPrompt);

      // Then
      expect(result.issues).toContain('프롬프트가 너무 깁니다');
      expect(result.suggestions).toContain('핵심 요소만 간결하게 표현하세요');
    });

    it('설명이 부족한 프롬프트에 대해 이슈를 반환해야 함', () => {
      // Given
      const vaguPrompt = '사람이 걷는다';

      // When
      const result = storyboardTransformers.analyzePromptQuality(vaguPrompt);

      // Then
      expect(result.issues).toContain('시각적 설명이 부족합니다');
      expect(result.suggestions).toContain('색상, 질감, 분위기 등을 추가하세요');
    });
  });
});

// ===========================================
// 에지 케이스 및 경계값 테스트
// ===========================================

describe('에지 케이스 및 경계값 테스트', () => {
  describe('경계값 테스트', () => {
    it('최대 제목 길이에서 유효성을 확인해야 함', () => {
      // Given
      const maxLengthTitle = 'A'.repeat(STORYBOARD_CONSTANTS.MAX_TITLE_LENGTH);
      const overLengthTitle = 'A'.repeat(STORYBOARD_CONSTANTS.MAX_TITLE_LENGTH + 1);

      const validRequest = {
        ...validStoryboardCreateRequest,
        title: maxLengthTitle,
      };

      const invalidRequest = {
        ...validStoryboardCreateRequest,
        title: overLengthTitle,
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(validRequest);
      }).not.toThrow();

      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(invalidRequest);
      }).toThrow(ValidationError);
    });

    it('최대 프롬프트 길이에서 유효성을 확인해야 함', () => {
      // Given
      const maxLengthPrompt = 'A'.repeat(STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH);
      const overLengthPrompt = 'A'.repeat(STORYBOARD_CONSTANTS.MAX_PROMPT_LENGTH + 1);

      // When & Then
      expect(() => {
        PromptEngineeringSchema.parse({
          basePrompt: maxLengthPrompt,
          enhancedPrompt: maxLengthPrompt,
          styleModifiers: [],
          technicalSpecs: [],
        });
      }).not.toThrow();

      expect(() => {
        PromptEngineeringSchema.parse({
          basePrompt: overLengthPrompt,
          enhancedPrompt: overLengthPrompt,
          styleModifiers: [],
          technicalSpecs: [],
        });
      }).toThrow();
    });
  });

  describe('null 및 undefined 처리', () => {
    it('null 데이터에 대해 적절한 에러를 반환해야 함', () => {
      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(null);
      }).toThrow(ValidationError);
    });

    it('undefined 데이터에 대해 적절한 에러를 반환해야 함', () => {
      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(undefined);
      }).toThrow(ValidationError);
    });

    it('빈 객체에 대해 적절한 에러를 반환해야 함', () => {
      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest({});
      }).toThrow(ValidationError);
    });
  });

  describe('타입 안전성 테스트', () => {
    it('잘못된 타입의 데이터에 대해 에러를 반환해야 함', () => {
      // Given
      const wrongTypeRequest = {
        ...validStoryboardCreateRequest,
        frames: 'not-an-array', // 배열이어야 하는데 문자열
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(wrongTypeRequest);
      }).toThrow(ValidationError);
    });

    it('잘못된 enum 값에 대해 에러를 반환해야 함', () => {
      // Given
      const wrongEnumRequest = {
        ...validStoryboardCreateRequest,
        frames: [
          {
            ...validStoryboardCreateRequest.frames[0],
            priority: 'invalid-priority', // 유효하지 않은 우선순위
          },
        ],
      };

      // When & Then
      expect(() => {
        storyboardTransformers.validateStoryboardCreateRequest(wrongEnumRequest);
      }).toThrow(ValidationError);
    });
  });
});

// ===========================================
// 성능 테스트
// ===========================================

describe('성능 테스트', () => {
  it('대량의 프레임이 있는 스토리보드의 품질 검증이 합리적인 시간 내에 완료되어야 함', () => {
    // Given
    const largeStoryboard = createTestStoryboard();
    const manyFrames = Array(50).fill(null).map((_, index) => ({
      ...largeStoryboard.frames[0],
      metadata: {
        ...largeStoryboard.frames[0].metadata,
        id: `frame_${index}`,
        order: index + 1,
      },
    }));
    largeStoryboard.frames = manyFrames;

    // When
    const startTime = performance.now();
    const result = storyboardTransformers.performDataQualityCheck(largeStoryboard);
    const endTime = performance.now();

    // Then
    expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
    expect(result).toBeDefined();
  });

  it('복잡한 프롬프트 분석이 합리적인 시간 내에 완료되어야 함', () => {
    // Given
    const complexPrompt = 'A '.repeat(1000) + 'complex prompt with many words and technical terms like cinematic lighting, wide-shot, depth-of-field, bokeh, 4k resolution, photorealistic rendering';

    // When
    const startTime = performance.now();
    const result = storyboardTransformers.analyzePromptQuality(complexPrompt);
    const endTime = performance.now();

    // Then
    expect(endTime - startTime).toBeLessThan(100); // 100ms 이내
    expect(result).toBeDefined();
  });
});

// ===========================================
// 통합 테스트 시나리오
// ===========================================

describe('통합 테스트 시나리오', () => {
  it('전체 스토리보드 생성 및 검증 플로우가 정상 작동해야 함', () => {
    // Given - 스토리보드 생성 요청
    const createRequest = validStoryboardCreateRequest;

    // When - 요청 검증
    const validatedInput = storyboardTransformers.validateStoryboardCreateRequest(createRequest);

    // Then - 검증된 입력이 올바른지 확인
    expect(validatedInput.scenarioId).toBe(createRequest.scenarioId);
    expect(validatedInput.title).toBe(createRequest.title);

    // Given - 스토리보드 생성 (실제로는 StoryboardModel.create를 호출)
    const storyboard = createTestStoryboard();

    // When - 품질 검증
    const qualityResult = storyboardTransformers.performDataQualityCheck(storyboard);

    // Then - 품질 검증 결과 확인
    expect(qualityResult.isValid).toBe(true);
    expect(qualityResult.score).toBeGreaterThan(0);

    // Given - ByteDance API 응답 시뮬레이션
    const apiResponse = validByteDanceResponse;

    // When - API 응답 변환
    const generationResult = storyboardTransformers.generationResultFromByteDance(
      apiResponse,
      storyboard.frames[0].metadata.id,
      storyboard.frames[0].prompt,
      storyboard.frames[0].config
    );

    // Then - 변환 결과 확인
    expect(generationResult.imageUrl).toBeDefined();
    expect(generationResult.generationId).toBeDefined();
    expect(generationResult.cost).toBeGreaterThan(0);
  });
});