/**
 * 스토리보드 테스트 데이터 팩토리
 * 결정론적 테스트를 위한 표준화된 테스트 데이터 생성
 *
 * 기능:
 * - 12개 숏트 표준 세트
 * - ByteDance API 응답 모킹 데이터
 * - 일관성 특징 테스트 데이터
 * - 배치 처리 테스트 시나리오
 */

import type { Storyboard, StoryboardPanel, ConsistencyFeatures } from '@/entities/storyboard/model/Storyboard';
import type { StoryboardImage, ConsistencyFeatures as DtoConsistencyFeatures } from '@/shared/api/storyboard-dto-transformers';

// 결정론적 ID 생성
let testIdCounter = 1;
const generateTestId = (prefix: string) => `${prefix}_test_${testIdCounter++}`;

// 기본 12숏트 프롬프트 템플릿
export const DEFAULT_12_SHOTS_PROMPTS = [
  // 기 (도입부) - 3샷
  {
    shotNumber: 1,
    prompt: "A peaceful morning in a small village, establishing shot showing traditional houses and mountains in the background",
    visualDescription: "Wide shot of village landscape",
    cameraAngle: "높은 각도",
    lighting: "자연스러운 아침 햇살",
    duration: 6,
    sceneType: '기' as const,
  },
  {
    shotNumber: 2,
    prompt: "Close-up of a young protagonist waking up, stretching arms with sunlight streaming through window",
    visualDescription: "주인공의 기상 장면",
    cameraAngle: "클로즈업",
    lighting: "부드러운 창문 빛",
    duration: 4,
    sceneType: '기' as const,
  },
  {
    shotNumber: 3,
    prompt: "Medium shot of protagonist getting dressed and preparing for the day, showing determination",
    visualDescription: "하루 준비하는 주인공",
    cameraAngle: "미디엄 샷",
    lighting: "실내 자연광",
    duration: 5,
    sceneType: '기' as const,
  },

  // 승 (전개부) - 3샷
  {
    shotNumber: 4,
    prompt: "Protagonist walking through busy marketplace, medium shot showing crowd and vibrant activity",
    visualDescription: "활기찬 시장 거리 걷기",
    cameraAngle: "미디엄 샷",
    lighting: "밝은 대낮",
    duration: 5,
    sceneType: '승' as const,
  },
  {
    shotNumber: 5,
    prompt: "Over-shoulder shot as protagonist discovers an old mysterious map in an antique shop",
    visualDescription: "신비한 지도 발견",
    cameraAngle: "오버 숄더",
    lighting: "어두운 가게 내부",
    duration: 6,
    sceneType: '승' as const,
  },
  {
    shotNumber: 6,
    prompt: "Close-up of the ancient map showing strange symbols and a marked location in the forest",
    visualDescription: "고대 지도의 상세한 모습",
    cameraAngle: "극 클로즈업",
    lighting: "집중된 조명",
    duration: 4,
    sceneType: '승' as const,
  },

  // 전 (절정부) - 3샷
  {
    shotNumber: 7,
    prompt: "Wide shot of protagonist entering a dark, mysterious forest following the map",
    visualDescription: "어둠의 숲 진입",
    cameraAngle: "와이드 샷",
    lighting: "어둡고 신비로운",
    duration: 5,
    sceneType: '전' as const,
  },
  {
    shotNumber: 8,
    prompt: "Medium shot showing protagonist struggling through thick vegetation and obstacles",
    visualDescription: "숲속 고난 극복",
    cameraAngle: "미디엄 샷",
    lighting: "필터링된 숲 빛",
    duration: 6,
    sceneType: '전' as const,
  },
  {
    shotNumber: 9,
    prompt: "Dramatic close-up of protagonist's face showing fear and determination as strange sounds echo",
    visualDescription: "긴장감 넘치는 주인공",
    cameraAngle: "드라마틱 클로즈업",
    lighting: "대비가 강한 조명",
    duration: 4,
    sceneType: '전' as const,
  },

  // 결 (결말부) - 3샷
  {
    shotNumber: 10,
    prompt: "Wide shot revealing a hidden ancient temple with golden light emanating from within",
    visualDescription: "숨겨진 고대 신전 발견",
    cameraAngle: "와이드 샷",
    lighting: "황금빛 신비로운 빛",
    duration: 7,
    sceneType: '결' as const,
  },
  {
    shotNumber: 11,
    prompt: "Medium shot of protagonist reaching for a glowing artifact inside the temple",
    visualDescription: "빛나는 유물에 손 뻗기",
    cameraAngle: "미디엄 샷",
    lighting: "신비로운 내부 조명",
    duration: 5,
    sceneType: '결' as const,
  },
  {
    shotNumber: 12,
    prompt: "Final wide shot showing protagonist emerging from forest, transformed and triumphant at sunset",
    visualDescription: "변화된 주인공의 귀환",
    cameraAngle: "와이드 샷",
    lighting: "따뜻한 석양",
    duration: 6,
    sceneType: '결' as const,
  },
];

/**
 * 기본 스토리보드 테스트 데이터 생성
 */
export function createTestStoryboard(
  overrides: Partial<Storyboard> = {}
): Storyboard {
  const now = new Date().toISOString();

  return {
    id: generateTestId('storyboard'),
    scenarioId: generateTestId('scenario'),
    title: '모험의 시작',
    description: '작은 마을 청년이 신비한 지도를 발견하고 모험을 떠나는 이야기',
    panels: [],
    totalDuration: 63, // 총 합계
    createdAt: now,
    updatedAt: now,
    status: 'draft',

    // ByteDance API 관련 필드
    globalStyle: 'pencil',
    globalQuality: 'standard',
    globalAspectRatio: '16:9',

    // 일관성 시스템
    consistencyEnabled: true,

    // 배치 처리 상태
    batchProcessing: {
      status: 'idle',
      progress: 0,
      currentShot: 0,
      totalShots: 12,
      estimatedTimeRemaining: 0,
    },

    // 통계
    statistics: {
      totalCost: 0,
      averageProcessingTime: 0,
      averageConsistencyScore: 0,
      successfulPanels: 0,
      failedPanels: 0,
    },

    ...overrides,
  };
}

/**
 * 완성된 12숏트 스토리보드 생성
 */
export function createComplete12ShotStoryboard(): Storyboard {
  const storyboard = createTestStoryboard();
  const panels = DEFAULT_12_SHOTS_PROMPTS.map((shot, index) => {
    return createTestStoryboardPanel({
      shotNumber: shot.shotNumber,
      imagePrompt: shot.prompt,
      visualDescription: shot.visualDescription,
      cameraAngle: shot.cameraAngle,
      lighting: shot.lighting,
      duration: shot.duration,
      order: index + 1,
      status: 'completed',
      imageUrl: `https://mock-seedream-api.com/images/shot_${shot.shotNumber}.png`,
      thumbnailUrl: `https://mock-seedream-api.com/images/shot_${shot.shotNumber}_thumb.png`,
    });
  });

  return {
    ...storyboard,
    panels,
    totalDuration: panels.reduce((sum, panel) => sum + panel.duration, 0),
    statistics: {
      totalCost: panels.length * 0.05,
      averageProcessingTime: 25000,
      averageConsistencyScore: 0.82,
      successfulPanels: panels.length,
      failedPanels: 0,
    },
  };
}

/**
 * 테스트용 스토리보드 패널 생성
 */
export function createTestStoryboardPanel(
  overrides: Partial<StoryboardPanel> = {}
): StoryboardPanel {
  const now = new Date().toISOString();

  return {
    id: generateTestId('panel'),
    sceneId: generateTestId('scene'),
    shotNumber: 1,
    imagePrompt: 'A test image prompt for storyboard panel',
    visualDescription: 'Test visual description',
    cameraAngle: '미디엄 샷',
    lighting: '자연스러운 조명',
    duration: 5,
    order: 1,

    // ByteDance API 관련 필드
    style: 'pencil',
    quality: 'standard',
    aspectRatio: '16:9',
    status: 'pending',

    // 일관성 시스템
    consistency: {
      consistencyScore: 0,
      appliedFeatures: [],
    },

    // 메타데이터
    metadata: {
      generatedAt: now,
      processingTimeMs: 0,
      costUsd: 0,
      dimensions: { width: 1920, height: 1080 },
      fileSize: 0,
      model: 'ByteDance-Seedream-4.0',
    },

    ...overrides,
  };
}

/**
 * 테스트용 일관성 특징 생성
 */
export function createTestConsistencyFeatures(): ConsistencyFeatures {
  return {
    task_id: 'test-consistency-' + Date.now(),
    characters: [
      {
        name: 'protagonist',
        description: '젊은 모험가 주인공',
        visualFeatures: [
          'brown hair',
          'determined expression',
          'blue tunic',
          'leather boots',
        ],
        importance: 0.9,
        confidence: 0.85,
      },
    ],
    locations: [
      {
        name: 'village',
        description: '작은 전통 마을',
        visualElements: [
          'stone houses',
          'mountain backdrop',
          'cobblestone streets',
        ],
        importance: 0.7,
        confidence: 0.8,
      },
    ],
    objects: [
      {
        name: 'ancient_map',
        description: '신비한 고대 지도',
        visualProperties: [
          'aged paper',
          'mystical symbols',
          'forest marking',
        ],
        importance: 0.8,
        confidence: 0.9,
      },
    ],
    style: {
      name: 'pencil sketch',
      description: '연필 스케치 스타일',
      visualCharacteristics: [
        'soft lines',
        'gentle shading',
        'paper texture',
      ],
      colorPalette: ['#2B2B2B', '#4A4A4A', '#6B6B6B'],
      technique: 'traditional pencil drawing with cross-hatching',
      importance: 0.8,
      confidence: 0.9,
    },
    composition: {
      frameType: 'medium shot',
      cameraAngle: 'eye-level',
      lighting: 'natural light',
      rules: ['rule of thirds', 'leading lines'],
      importance: 0.6,
      confidence: 0.7,
    },
    extractedAt: new Date().toISOString(),
    overallConfidence: 0.82,
    confidence: 0.82,
  };
}

/**
 * DTO 변환용 스토리보드 이미지 테스트 데이터
 */
export function createTestStoryboardImage(
  overrides: Partial<StoryboardImage> = {}
): StoryboardImage {
  const now = new Date().toISOString();

  return {
    id: generateTestId('image'),
    shotNumber: 1,
    imageUrl: 'https://mock-seedream-api.com/images/test_image.png',
    thumbnailUrl: 'https://mock-seedream-api.com/images/test_image_thumb.png',
    prompt: 'Test prompt for image generation',
    style: 'pencil',
    quality: 'standard',
    aspectRatio: '16:9',
    status: 'completed',
    consistency: {
      consistencyScore: 0.8,
      appliedFeatures: ['character_consistency', 'style_consistency'],
    },
    metadata: {
      generatedAt: now,
      processingTimeMs: 25000,
      costUsd: 0.05,
      dimensions: { width: 1920, height: 1080 },
      fileSize: 1024000,
      model: 'ByteDance-Seedream-4.0',
    },
    ...overrides,
  };
}

/**
 * 배치 처리 테스트 시나리오 데이터
 */
export const BATCH_PROCESSING_TEST_SCENARIOS = {
  // 성공 시나리오
  allSuccess: {
    totalShots: 12,
    successRate: 1.0,
    expectedCost: 0.6, // 12 * $0.05
    expectedTime: 300000, // 5분
  },

  // 부분 실패 시나리오
  partialFailure: {
    totalShots: 12,
    successRate: 0.75, // 75% 성공률
    expectedCost: 0.45, // 9 * $0.05
    expectedTime: 360000, // 6분 (재시도 포함)
  },

  // 일관성 비활성화 시나리오
  noConsistency: {
    totalShots: 12,
    successRate: 0.9,
    consistencyEnabled: false,
    expectedCost: 0.54,
    expectedTime: 240000, // 4분 (일관성 처리 시간 절약)
  },

  // 높은 품질 시나리오
  highQuality: {
    totalShots: 12,
    successRate: 0.85,
    quality: 'high' as const,
    expectedCost: 0.72, // 높은 품질로 인한 추가 비용
    expectedTime: 420000, // 7분
  },
};

/**
 * 테스트용 ByteDance API 응답 생성
 */
export function createTestBytedanceResponse(
  shotNumber: number,
  isSuccess: boolean = true
) {
  if (isSuccess) {
    return {
      task_id: `task_${shotNumber}_${Date.now()}`,
      status: 'success' as const,
      result: {
        image_url: `https://mock-seedream-api.com/images/shot_${shotNumber}.png`,
        image_id: `img_${shotNumber}`,
        prompt: DEFAULT_12_SHOTS_PROMPTS[shotNumber - 1]?.prompt || 'Test prompt',
        style: 'pencil',
        quality: 'standard',
        created_at: new Date().toISOString(),
        processing_time_ms: 25000,
        cost_usd: 0.05,
        metadata: {
          width: 1920,
          height: 1080,
          format: 'png',
          file_size: 1024000,
        },
      },
    };
  } else {
    return {
      task_id: `task_${shotNumber}_${Date.now()}`,
      status: 'failed' as const,
      error: {
        code: 'GENERATION_FAILED',
        message: `Shot ${shotNumber} generation failed`,
      },
    };
  }
}

/**
 * 테스트 ID 카운터 리셋 (테스트 간 격리)
 */
export function resetTestIdCounter() {
  testIdCounter = 1;
}

/**
 * 특정 스타일별 테스트 데이터 생성
 */
export function createStyleSpecificTestData(style: 'pencil' | 'rough' | 'monochrome' | 'colored') {
  const storyboard = createTestStoryboard({
    globalStyle: style,
    title: `${style} 스타일 스토리보드`,
  });

  const styleSpecificPanels = DEFAULT_12_SHOTS_PROMPTS.map((shot, index) => {
    return createTestStoryboardPanel({
      shotNumber: shot.shotNumber,
      imagePrompt: `${shot.prompt}, ${style} style`,
      style,
      order: index + 1,
      imageUrl: `https://mock-seedream-api.com/images/${style}_shot_${shot.shotNumber}.png`,
    });
  });

  return {
    ...storyboard,
    panels: styleSpecificPanels,
  };
}

export default {
  createTestStoryboard,
  createComplete12ShotStoryboard,
  createTestStoryboardPanel,
  createTestConsistencyFeatures,
  createTestStoryboardImage,
  createTestBytedanceResponse,
  createStyleSpecificTestData,
  resetTestIdCounter,
  DEFAULT_12_SHOTS_PROMPTS,
  BATCH_PROCESSING_TEST_SCENARIOS,
};