/**
 * Storyboard Entity Implementation
 * 스토리보드 도메인 모델 및 비즈니스 로직
 *
 * ByteDance-Seedream-4.0 API 통합 및 일관성 시스템 지원
 */

// 씬 타입 정의 (기승전결) - scenario 엔티티와 동일
export type SceneType = '기' | '승' | '전' | '결';

// 스토리보드 스타일 (ByteDance API 지원)
export type StoryboardStyle = 'pencil' | 'rough' | 'monochrome' | 'colored';

// 이미지 품질 레벨
export type ImageQuality = 'draft' | 'standard' | 'high';

// 화면 비율
export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

// 이미지 생성 상태
export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';

// 일관성 특징 인터페이스
export interface ConsistencyFeatures {
  task_id: string; // ByteDance API 작업 ID
  characters: Array<{
    name: string;
    description: string;
    visualFeatures: string[];
    importance: number;
    confidence: number;
  }>;
  locations: Array<{
    name: string;
    description: string;
    visualElements: string[];
    importance: number;
    confidence: number;
  }>;
  objects: Array<{
    name: string;
    description: string;
    visualProperties: string[];
    importance: number;
    confidence: number;
  }>;
  style: {
    name: string;
    description: string;
    visualCharacteristics: string[];
    colorPalette: string[];
    technique: string;
    importance: number;
    confidence: number;
  };
  composition: {
    frameType: string;
    cameraAngle: string;
    lighting: string;
    rules: string[];
    importance: number;
    confidence: number;
  };
  extractedAt: string;
  overallConfidence: number;
  confidence: number; // 일관성 관리자와의 호환성을 위한 필드
}

// 이미지 메타데이터
export interface ImageMetadata {
  generatedAt: string;
  processingTimeMs: number;
  costUsd: number;
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number;
  model: string;
}

// 일관성 정보
export interface ConsistencyInfo {
  referenceImageId?: string;
  consistencyScore: number;
  appliedFeatures: string[];
}

// 확장된 스토리보드 패널 인터페이스
export interface StoryboardPanel {
  id: string;
  sceneId: string;
  shotNumber: number; // 1-12
  imageUrl?: string;
  thumbnailUrl?: string;
  imagePrompt: string;
  enhancedPrompt?: string; // 일관성 특징이 적용된 프롬프트
  duration: number; // 초 단위
  order: number;
  visualDescription: string;
  cameraAngle: string;
  lighting: string;

  // ByteDance API 관련 필드
  style: StoryboardStyle;
  quality: ImageQuality;
  aspectRatio: AspectRatio;
  status: GenerationStatus;

  // 일관성 시스템 관련
  consistency: ConsistencyInfo;

  // 메타데이터
  metadata: ImageMetadata;

  // 에러 정보
  error?: string;
}

// 스토리보드 상태
export type StoryboardStatus = 'draft' | 'completed' | 'published' | 'archived';

// 배치 처리 상태
export type BatchProcessingStatus = 'idle' | 'initializing' | 'processing' | 'completed' | 'failed' | 'paused';

// 확장된 스토리보드 인터페이스
export interface Storyboard {
  id: string;
  scenarioId: string;
  title: string;
  description: string;
  panels: StoryboardPanel[];
  totalDuration: number; // 초 단위
  createdAt: string;
  updatedAt: string;
  status: StoryboardStatus;

  // ByteDance API 관련 필드
  globalStyle: StoryboardStyle;
  globalQuality: ImageQuality;
  globalAspectRatio: AspectRatio;

  // 일관성 시스템
  consistencyFeatures?: ConsistencyFeatures;
  consistencyEnabled: boolean;

  // 배치 처리 상태
  batchProcessing: {
    status: BatchProcessingStatus;
    progress: number; // 0-100
    currentShot: number;
    totalShots: number;
    estimatedTimeRemaining: number; // seconds
    error?: string;
  };

  // 비용 및 통계
  statistics: {
    totalCost: number;
    averageProcessingTime: number;
    averageConsistencyScore: number;
    successfulPanels: number;
    failedPanels: number;
  };
}

// 검증 결과 인터페이스
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// 씬 정보 (이미지 프롬프트 생성용)
export interface SceneInfo {
  title: string;
  description: string;
  type: SceneType;
  content: string;
}

/**
 * 새로운 스토리보드 생성 (ByteDance API 지원)
 */
export function createStoryboard(
  scenarioId: string,
  title: string,
  description: string,
  options: {
    style?: StoryboardStyle;
    quality?: ImageQuality;
    aspectRatio?: AspectRatio;
    consistencyEnabled?: boolean;
  } = {}
): Storyboard {
  if (!scenarioId.trim()) {
    throw new Error('시나리오 ID는 필수입니다');
  }
  if (!title.trim()) {
    throw new Error('제목은 필수입니다');
  }
  if (!description.trim()) {
    throw new Error('설명은 필수입니다');
  }

  const now = new Date().toISOString();

  return {
    id: `storyboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    scenarioId: scenarioId.trim(),
    title: title.trim(),
    description: description.trim(),
    panels: [],
    totalDuration: 0,
    createdAt: now,
    updatedAt: now,
    status: 'draft',

    // ByteDance API 기본 설정
    globalStyle: options.style || 'pencil',
    globalQuality: options.quality || 'standard',
    globalAspectRatio: options.aspectRatio || '16:9',

    // 일관성 시스템
    consistencyEnabled: options.consistencyEnabled ?? true,

    // 배치 처리 상태 초기화
    batchProcessing: {
      status: 'idle',
      progress: 0,
      currentShot: 0,
      totalShots: 0,
      estimatedTimeRemaining: 0,
    },

    // 통계 초기화
    statistics: {
      totalCost: 0,
      averageProcessingTime: 0,
      averageConsistencyScore: 0,
      successfulPanels: 0,
      failedPanels: 0,
    },
  };
}

/**
 * 스토리보드에 패널 추가
 */
export function addPanel(
  storyboard: Storyboard,
  panelData: Omit<StoryboardPanel, 'id' | 'order'>
): Storyboard {
  const newPanel: StoryboardPanel = {
    ...panelData,
    id: `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    order: storyboard.panels.length + 1,
  };

  const updatedPanels = [...storyboard.panels, newPanel];
  const totalDuration = calculateStoryboardTotalDuration(updatedPanels);

  return {
    ...storyboard,
    panels: updatedPanels,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 패널 업데이트
 */
export function updatePanel(
  storyboard: Storyboard,
  panelId: string,
  updates: Partial<Omit<StoryboardPanel, 'id' | 'order'>>
): Storyboard {
  const panelIndex = storyboard.panels.findIndex(
    (panel) => panel.id === panelId
  );
  if (panelIndex === -1) {
    throw new Error('패널을 찾을 수 없습니다');
  }

  const updatedPanels = storyboard.panels.map((panel, index) =>
    index === panelIndex ? { ...panel, ...updates } : panel
  );

  const totalDuration = calculateStoryboardTotalDuration(updatedPanels);

  return {
    ...storyboard,
    panels: updatedPanels,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 패널 제거
 */
export function removePanel(
  storyboard: Storyboard,
  panelId: string
): Storyboard {
  const updatedPanels = storyboard.panels
    .filter((panel) => panel.id !== panelId)
    .map((panel, index) => ({ ...panel, order: index + 1 }));

  const totalDuration = calculateStoryboardTotalDuration(updatedPanels);

  return {
    ...storyboard,
    panels: updatedPanels,
    totalDuration,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 패널 순서 변경
 */
export function reorderPanels(
  storyboard: Storyboard,
  panelId: string,
  newOrder: number
): Storyboard {
  const panel = storyboard.panels.find((p) => p.id === panelId);
  if (!panel) {
    throw new Error('패널을 찾을 수 없습니다');
  }

  const otherPanels = storyboard.panels.filter((p) => p.id !== panelId);
  const reorderedPanels = [...otherPanels];
  reorderedPanels.splice(newOrder - 1, 0, panel);

  // 순서 재정렬
  const finalPanels = reorderedPanels.map((p, index) => ({
    ...p,
    order: index + 1,
  }));

  return {
    ...storyboard,
    panels: finalPanels,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 스토리보드 검증
 */
export function validateStoryboard(storyboard: Storyboard): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 필수 검증
  if (storyboard.panels.length === 0) {
    errors.push('최소 1개의 패널이 필요합니다');
  }

  if (!storyboard.title.trim()) {
    errors.push('제목은 필수입니다');
  }

  if (!storyboard.description.trim()) {
    errors.push('설명은 필수입니다');
  }

  // 패널 품질 검사
  const panelsWithoutPrompt = storyboard.panels.filter(
    (panel) => !panel.imagePrompt.trim()
  );
  if (panelsWithoutPrompt.length > 0) {
    warnings.push('일부 패널에 이미지 프롬프트가 누락되었습니다');
  }

  const panelsWithoutImage = storyboard.panels.filter(
    (panel) => !panel.imageUrl
  );
  if (panelsWithoutImage.length > 0) {
    warnings.push('일부 패널에 이미지가 누락되었습니다');
  }

  // 지속시간 검증
  if (storyboard.totalDuration > 600) {
    // 10분 초과
    warnings.push('스토리보드가 10분을 초과합니다. 길이를 조정해보세요.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * AI 이미지 생성용 프롬프트 생성
 */
export function generateImagePrompt(
  sceneInfo: SceneInfo,
  cameraAngle: string = '미디엄 샷',
  lighting: string = '자연스러운 조명'
): string {
  const { description, content } = sceneInfo;

  // 기본 프롬프트 구성
  const basePrompt = `${description}, ${content}`;

  // 기술적 요소 추가
  const technicalElements = `${cameraAngle}, ${lighting}`;

  // 품질 향상 키워드
  const qualityKeywords = '고화질, 시네마틱, 프로페셔널';

  return `${basePrompt}, ${technicalElements}, ${qualityKeywords}`;
}

/**
 * 스토리보드 총 지속시간 계산 (헬퍼 함수)
 */
function calculateStoryboardTotalDuration(panels: StoryboardPanel[]): number {
  return panels.reduce((total, panel) => total + panel.duration, 0);
}

/**
 * ByteDance API용 패널 생성
 */
export function createStoryboardPanel(
  sceneId: string,
  shotNumber: number,
  imagePrompt: string,
  options: {
    visualDescription?: string;
    cameraAngle?: string;
    lighting?: string;
    duration?: number;
    style?: StoryboardStyle;
    quality?: ImageQuality;
    aspectRatio?: AspectRatio;
  } = {}
): Omit<StoryboardPanel, 'id' | 'order'> {
  const now = new Date().toISOString();

  return {
    sceneId,
    shotNumber,
    imagePrompt,
    visualDescription: options.visualDescription || imagePrompt,
    cameraAngle: options.cameraAngle || '미디엄 샷',
    lighting: options.lighting || '자연스러운 조명',
    duration: options.duration || 5,
    style: options.style || 'pencil',
    quality: options.quality || 'standard',
    aspectRatio: options.aspectRatio || '16:9',
    status: 'pending',
    consistency: {
      consistencyScore: 0,
      appliedFeatures: [],
    },
    metadata: {
      generatedAt: now,
      processingTimeMs: 0,
      costUsd: 0,
      dimensions: { width: 1920, height: 1080 },
      fileSize: 0,
      model: 'ByteDance-Seedream-4.0',
    },
  };
}

/**
 * 배치 처리 상태 업데이트
 */
export function updateBatchProcessingStatus(
  storyboard: Storyboard,
  updates: Partial<Storyboard['batchProcessing']>
): Storyboard {
  return {
    ...storyboard,
    batchProcessing: {
      ...storyboard.batchProcessing,
      ...updates,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 일관성 특징 설정
 */
export function setConsistencyFeatures(
  storyboard: Storyboard,
  features: ConsistencyFeatures
): Storyboard {
  return {
    ...storyboard,
    consistencyFeatures: features,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 스토리보드 통계 업데이트
 */
export function updateStoryboardStatistics(storyboard: Storyboard): Storyboard {
  const completedPanels = storyboard.panels.filter(panel => panel.status === 'completed');
  const failedPanels = storyboard.panels.filter(panel => panel.status === 'failed');

  const totalCost = storyboard.panels.reduce((sum, panel) => sum + panel.metadata.costUsd, 0);
  const totalProcessingTime = storyboard.panels.reduce((sum, panel) => sum + panel.metadata.processingTimeMs, 0);
  const totalConsistencyScore = completedPanels.reduce((sum, panel) => sum + panel.consistency.consistencyScore, 0);

  return {
    ...storyboard,
    statistics: {
      totalCost,
      averageProcessingTime: completedPanels.length > 0 ? totalProcessingTime / completedPanels.length : 0,
      averageConsistencyScore: completedPanels.length > 0 ? totalConsistencyScore / completedPanels.length : 0,
      successfulPanels: completedPanels.length,
      failedPanels: failedPanels.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 12개 숏트 패널 초기화
 * 시나리오로부터 12개 숏트를 자동 생성
 */
export function initialize12ShotsFromScenario(
  storyboard: Storyboard,
  scenarioShots: Array<{
    shotNumber: number;
    prompt: string;
    visualDescription?: string;
    cameraAngle?: string;
    lighting?: string;
    duration?: number;
  }>
): Storyboard {
  if (scenarioShots.length !== 12) {
    throw new Error('정확히 12개의 숏트가 필요합니다');
  }

  const panels = scenarioShots.map((shot, index) => {
    const panelData = createStoryboardPanel(
      `scene_${Math.floor(index / 3) + 1}`, // 4개 씬에 3개씩 숏트 배치
      shot.shotNumber,
      shot.prompt,
      {
        visualDescription: shot.visualDescription,
        cameraAngle: shot.cameraAngle,
        lighting: shot.lighting,
        duration: shot.duration,
        style: storyboard.globalStyle,
        quality: storyboard.globalQuality,
        aspectRatio: storyboard.globalAspectRatio,
      }
    );

    return {
      ...panelData,
      id: `panel_${shot.shotNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      order: index + 1,
    };
  });

  const totalDuration = calculateStoryboardTotalDuration(panels);

  return {
    ...storyboard,
    panels,
    totalDuration,
    batchProcessing: {
      ...storyboard.batchProcessing,
      totalShots: 12,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 스토리보드 완성도 검사
 */
export function getStoryboardCompletionStatus(storyboard: Storyboard): {
  isComplete: boolean;
  completedPanels: number;
  totalPanels: number;
  completionPercentage: number;
  missingElements: string[];
} {
  const missingElements: string[] = [];

  if (storyboard.panels.length !== 12) {
    missingElements.push(`12개 숏트 필요 (현재: ${storyboard.panels.length}개)`);
  }

  const completedPanels = storyboard.panels.filter(panel => panel.status === 'completed').length;
  const panelsWithoutImages = storyboard.panels.filter(panel => !panel.imageUrl).length;
  const panelsWithErrors = storyboard.panels.filter(panel => panel.error).length;

  if (panelsWithoutImages > 0) {
    missingElements.push(`${panelsWithoutImages}개 패널에 이미지 누락`);
  }

  if (panelsWithErrors > 0) {
    missingElements.push(`${panelsWithErrors}개 패널에 생성 오류`);
  }

  if (!storyboard.consistencyEnabled && storyboard.consistencyFeatures) {
    missingElements.push('일관성 시스템이 비활성화됨');
  }

  const completionPercentage = storyboard.panels.length > 0
    ? Math.round((completedPanels / storyboard.panels.length) * 100)
    : 0;

  return {
    isComplete: missingElements.length === 0 && completedPanels === 12,
    completedPanels,
    totalPanels: storyboard.panels.length,
    completionPercentage,
    missingElements,
  };
}

/**
 * 스토리보드 품질 점수 계산
 */
export function calculateStoryboardQualityScore(storyboard: Storyboard): {
  overallScore: number;
  scores: {
    completion: number;
    consistency: number;
    imageQuality: number;
    timeOptimization: number;
  };
  recommendations: string[];
} {
  const recommendations: string[] = [];

  // 완성도 점수 (0-30)
  const completion = getStoryboardCompletionStatus(storyboard);
  const completionScore = (completion.completedPanels / 12) * 30;

  if (completion.completedPanels < 12) {
    recommendations.push(`${12 - completion.completedPanels}개 패널 생성 필요`);
  }

  // 일관성 점수 (0-30)
  const consistencyScore = storyboard.statistics.averageConsistencyScore * 30;

  if (consistencyScore < 20) {
    recommendations.push('일관성 개선 필요 - 첫 번째 이미지 특징 재추출 권장');
  }

  // 이미지 품질 점수 (0-25)
  const highQualityPanels = storyboard.panels.filter(panel => panel.quality === 'high').length;
  const imageQualityScore = (highQualityPanels / 12) * 25;

  if (imageQualityScore < 15) {
    recommendations.push('이미지 품질 향상 권장 (High 품질 사용)');
  }

  // 시간 최적화 점수 (0-15)
  const averageProcessingTime = storyboard.statistics.averageProcessingTime;
  const timeOptimizationScore = averageProcessingTime > 0
    ? Math.max(0, 15 - (averageProcessingTime / 60000) * 5) // 1분당 5점 감점
    : 0;

  if (timeOptimizationScore < 10) {
    recommendations.push('배치 크기 조정으로 처리 시간 최적화 권장');
  }

  const overallScore = completionScore + consistencyScore + imageQualityScore + timeOptimizationScore;

  return {
    overallScore: Math.round(overallScore),
    scores: {
      completion: Math.round(completionScore),
      consistency: Math.round(consistencyScore),
      imageQuality: Math.round(imageQualityScore),
      timeOptimization: Math.round(timeOptimizationScore),
    },
    recommendations,
  };
}
