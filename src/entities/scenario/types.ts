/**
 * Scenario Entity Types
 *
 * 시나리오 도메인의 핵심 타입 정의
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성
 */

/**
 * 시나리오 상태 정의
 */
export type ScenarioStatus = 'draft' | 'in_progress' | 'completed' | 'archived'

/**
 * 씬 타입 정의
 */
export type SceneType = 'dialogue' | 'action' | 'transition' | 'montage' | 'voiceover'

/**
 * 시나리오 기본 메타데이터
 */
export interface ScenarioMetadata {
  id: string
  title: string
  description?: string
  genre?: string
  targetDuration?: number // 초 단위
  createdAt: Date
  updatedAt: Date
  status: ScenarioStatus
  userId: string
}

/**
 * 개별 씬 데이터
 */
export interface Scene {
  id: string
  order: number
  type: SceneType
  title: string
  description: string
  duration?: number // 초 단위
  location?: string
  characters?: string[]
  dialogue?: string
  actionDescription?: string
  notes?: string
  visualElements?: VisualElement[]
  storyboardImageUrl?: string // 스토리보드와의 연동 필드
}

/**
 * 비주얼 요소 (이미지, 비디오 등)
 */
export interface VisualElement {
  id: string
  type: 'image' | 'video' | 'animation' | 'graphic'
  url?: string
  description: string
  timing?: {
    start: number // 초 단위
    end: number
  }
}

/**
 * 완전한 시나리오 엔티티
 */
export interface Scenario {
  metadata: ScenarioMetadata
  scenes: Scene[]
  totalDuration?: number // 계산된 전체 길이
  storyOutline?: string // AI 생성된 스토리 개요
  keywords?: string[] // SEO/검색용 키워드
}

/**
 * 시나리오 생성 입력값
 */
export interface ScenarioCreateInput {
  title: string
  description?: string
  genre?: string
  targetDuration?: number
  storyPrompt: string // AI 생성용 프롬프트
  userId: string
}

/**
 * 시나리오 업데이트 입력값
 */
export interface ScenarioUpdateInput {
  title?: string
  description?: string
  genre?: string
  targetDuration?: number
  status?: ScenarioStatus
  scenes?: Scene[]
  storyOutline?: string
  keywords?: string[]
}

/**
 * AI 스토리 생성 요청
 */
export interface StoryGenerationRequest {
  prompt: string
  genre?: string
  targetDuration?: number
  style?: 'casual' | 'professional' | 'creative' | 'educational'
  tone?: 'serious' | 'humorous' | 'dramatic' | 'informative'
}

/**
 * AI 스토리 생성 응답
 */
export interface StoryGenerationResponse {
  storyOutline: string
  scenes: Omit<Scene, 'id'>[]
  suggestedKeywords: string[]
  estimatedDuration: number
}

/**
 * 씬 분할 요청
 */
export interface SceneSplitRequest {
  storyText: string
  targetSceneCount?: number
  maxSceneDuration?: number // 초 단위
}

/**
 * 에러 타입 정의
 */
export interface ScenarioError {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * 비즈니스 규칙 검증 결과
 */
export interface ValidationResult {
  isValid: boolean
  errors: ScenarioError[]
  warnings?: string[]
}

/**
 * 이미지 생성 스타일 옵션
 */
export type ImageGenerationStyle = 'pencil' | 'rough' | 'monochrome' | 'colored'

/**
 * 이미지 생성 요청
 */
export interface ImageGenerationRequest {
  prompt: string
  style: ImageGenerationStyle
  referenceImageUrl?: string // 일관성 유지를 위한 참조 이미지
  aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16'
  seed?: number // 재현 가능한 결과를 위한 시드
}

/**
 * 이미지 생성 응답
 */
export interface ImageGenerationResponse {
  imageUrl: string
  seed: number // 생성에 사용된 시드
  style: ImageGenerationStyle
  prompt: string
  referenceImageUrl?: string
  generatedAt: Date
}

/**
 * 씬 편집 모드
 */
export type SceneEditMode = 'view' | 'edit' | 'split' | 'merge' | 'delete'
