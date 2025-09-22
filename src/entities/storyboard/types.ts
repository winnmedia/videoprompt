/**
 * Storyboard Entity Types
 *
 * 스토리보드 도메인의 핵심 타입 정의
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성
 */

/**
 * 스토리보드 프레임 상태 정의
 */
export type StoryboardFrameStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'retry'

/**
 * 이미지 생성 모델 타입
 */
export type ImageGenerationModel = 'dall-e-3' | 'midjourney' | 'stable-diffusion' | 'runway-gen3'

/**
 * 이미지 비율 설정
 */
export type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4'

/**
 * 이미지 품질 설정
 */
export type ImageQuality = 'standard' | 'hd' | '4k'

/**
 * 스타일 프리셋
 */
export type StylePreset =
  | 'cinematic'
  | 'anime'
  | 'photorealistic'
  | 'illustration'
  | 'sketch'
  | 'watercolor'
  | 'oil-painting'
  | 'digital-art'
  | 'cartoon'
  | 'vintage'

/**
 * 이미지 생성 설정
 */
export interface ImageGenerationConfig {
  model: ImageGenerationModel
  aspectRatio: ImageAspectRatio
  quality: ImageQuality
  style?: StylePreset
  seed?: number
  steps?: number // diffusion steps
  guidanceScale?: number // CFG scale
  negativePrompt?: string
  customParams?: Record<string, unknown>
}

/**
 * 일관성 참조 데이터
 */
export interface ConsistencyReference {
  id: string
  type: 'character' | 'location' | 'object' | 'style'
  name: string
  description: string
  referenceImageUrl?: string
  keyFeatures: string[]
  weight: number // 0.0 ~ 1.0, 일관성 적용 강도
  isActive: boolean
}

/**
 * 스토리보드 프레임 메타데이터
 */
export interface StoryboardFrameMetadata {
  id: string
  sceneId: string // scenario Scene과의 연결
  order: number
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
  status: StoryboardFrameStatus
  userId: string
}

/**
 * 프롬프트 엔지니어링 데이터
 */
export interface PromptEngineering {
  basePrompt: string
  enhancedPrompt: string // AI로 향상된 프롬프트
  styleModifiers: string[]
  technicalSpecs: string[]
  negativePrompt?: string
  promptTokens?: number
}

/**
 * 이미지 생성 결과
 */
export interface GenerationResult {
  imageUrl: string
  thumbnailUrl?: string
  generationId: string
  model: ImageGenerationModel
  config: ImageGenerationConfig
  prompt: PromptEngineering
  generatedAt: Date
  processingTime?: number // 초 단위
  cost?: number // 생성 비용
}

/**
 * 스토리보드 프레임 (개별 콘티 프레임)
 */
export interface StoryboardFrame {
  metadata: StoryboardFrameMetadata
  prompt: PromptEngineering
  config: ImageGenerationConfig
  consistencyRefs: ConsistencyReference[]
  result?: GenerationResult
  attempts: GenerationResult[] // 재시도 이력
  userFeedback?: {
    rating: 1 | 2 | 3 | 4 | 5
    comments?: string
    tags?: string[]
  }
}

/**
 * 스토리보드 메타데이터
 */
export interface StoryboardMetadata {
  id: string
  scenarioId: string // scenario와의 연결
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  userId: string
  version: number
}

/**
 * 스토리보드 설정
 */
export interface StoryboardSettings {
  defaultConfig: ImageGenerationConfig
  globalConsistencyRefs: ConsistencyReference[]
  autoGeneration: boolean
  qualityThreshold: number // 0.0 ~ 1.0
  maxRetries: number
  batchSize: number
}

/**
 * 완전한 스토리보드 엔티티
 */
export interface Storyboard {
  metadata: StoryboardMetadata
  frames: StoryboardFrame[]
  settings: StoryboardSettings
  statistics?: {
    totalFrames: number
    completedFrames: number
    failedFrames: number
    totalCost: number
    averageProcessingTime: number
    averageRating: number
  }
}

/**
 * 스토리보드 생성 입력값
 */
export interface StoryboardCreateInput {
  scenarioId: string
  title: string
  description?: string
  config?: Partial<ImageGenerationConfig>
  consistencyRefs?: ConsistencyReference[]
  userId: string
}

/**
 * 스토리보드 업데이트 입력값
 */
export interface StoryboardUpdateInput {
  title?: string
  description?: string
  settings?: Partial<StoryboardSettings>
  frames?: StoryboardFrame[]
}

/**
 * 프레임 생성 요청
 */
export interface FrameGenerationRequest {
  sceneId: string
  sceneDescription: string
  additionalPrompt?: string
  config?: Partial<ImageGenerationConfig>
  consistencyRefs?: string[] // 참조할 consistency ref IDs
  priority?: 'low' | 'normal' | 'high'
}

/**
 * 배치 생성 요청
 */
export interface BatchGenerationRequest {
  frames: FrameGenerationRequest[]
  batchSettings?: {
    maxConcurrent: number
    delayBetweenRequests: number // ms
    stopOnError: boolean
  }
}

/**
 * 스토리보드 에러 타입
 */
export interface StoryboardError {
  code: string
  message: string
  frameId?: string
  details?: Record<string, unknown>
}

/**
 * 생성 진행 상태
 */
export interface GenerationProgress {
  frameId: string
  status: StoryboardFrameStatus
  progress: number // 0.0 ~ 1.0
  estimatedTimeRemaining?: number // 초
  currentStep?: string
}

/**
 * 비즈니스 규칙 검증 결과
 */
export interface StoryboardValidationResult {
  isValid: boolean
  errors: StoryboardError[]
  warnings?: string[]
  statistics?: {
    validFrames: number
    invalidFrames: number
    missingScenes: number
  }
}

/**
 * 스토리보드 내보내기 옵션
 */
export interface ExportOptions {
  format: 'pdf' | 'png' | 'jpg' | 'zip'
  includeMetadata: boolean
  imageQuality?: 'low' | 'medium' | 'high'
  layout?: 'grid' | 'sequence' | 'timeline'
  watermark?: {
    text: string
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    opacity: number
  }
}

/**
 * 스토리보드 분석 결과
 */
export interface StoryboardAnalytics {
  totalGenerations: number
  successRate: number
  averageCost: number
  averageTime: number
  popularStyles: Array<{ style: StylePreset; usage: number }>
  modelPerformance: Array<{ model: ImageGenerationModel; successRate: number; avgTime: number }>
  userSatisfaction: number
}

/**
 * 스토리보드 통계 정보
 */
export interface StoryboardStatistics {
  totalFrames: number
  completedFrames: number
  failedFrames: number
  pendingFrames: number
  totalCost: number
  averageProcessingTime: number
  averageRating: number
  successRate: number
  mostUsedModel: ImageGenerationModel
  totalRetries: number
}