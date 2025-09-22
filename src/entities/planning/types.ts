/**
 * Planning Entity Types
 *
 * 영상 기획 위저드의 도메인 타입 정의
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성, TypeScript 5.x
 */

import type { ScenarioStatus } from '../scenario/types'
import type { ProjectStatus } from '../project/types'

/**
 * 위저드 단계 정의
 */
export type WizardStep = 'input' | 'story' | 'shots'

/**
 * 위저드 상태
 */
export type WizardStatus = 'draft' | 'generating' | 'completed' | 'error'

/**
 * 톤앤매너 옵션
 */
export type ToneAndManner =
  | 'casual'      // 캐주얼
  | 'professional' // 전문적
  | 'creative'    // 창의적
  | 'educational' // 교육적
  | 'marketing'   // 마케팅

/**
 * 전개 방식 옵션
 */
export type StoryDevelopment =
  | 'linear'      // 선형적
  | 'dramatic'    // 드라마틱
  | 'problem_solution' // 문제-해결
  | 'comparison'  // 비교
  | 'tutorial'    // 튜토리얼

/**
 * 스토리 강도 옵션
 */
export type StoryIntensity = 'low' | 'medium' | 'high'

/**
 * 콘티 스타일 옵션
 */
export type ContiStyle =
  | 'pencil'      // 연필 스케치
  | 'rough'       // 러프 스케치
  | 'monochrome'  // 흑백
  | 'colored'     // 컬러

/**
 * 영상 기획 프로젝트 메타데이터
 */
export interface PlanningProjectMetadata {
  id: string
  title: string
  description?: string
  createdAt: Date
  updatedAt: Date
  userId: string
  projectId?: string // 연결된 프로젝트 ID
  status: WizardStatus
}

/**
 * Step 1: 입력 데이터
 */
export interface PlanningInputData {
  title: string
  logline: string // 한 줄 스토리
  toneAndManner: ToneAndManner
  development: StoryDevelopment
  intensity: StoryIntensity
  targetDuration?: number // 목표 시간 (초)
  additionalNotes?: string
}

/**
 * Step 2: 4단계 스토리 구조
 */
export interface StoryStep {
  id: string
  order: number // 1-4
  title: string
  description: string
  duration?: number // 예상 시간 (초)
  keyPoints: string[] // 핵심 포인트
  thumbnailUrl?: string // 대표 썸네일
}

/**
 * Step 3: 12숏 시퀀스
 */
export interface ShotSequence {
  id: string
  order: number // 1-12
  title: string
  description: string
  duration: number // 예상 시간 (초)

  // 콘티 관련
  contiDescription: string // 콘티 설명
  contiImageUrl?: string // 생성된 콘티 이미지
  contiStyle: ContiStyle

  // 촬영 정보
  shotType?: 'close_up' | 'medium' | 'wide' | 'extreme_wide'
  cameraMovement?: 'static' | 'pan' | 'tilt' | 'zoom' | 'dolly'
  location?: string
  characters?: string[]

  // 편집 정보
  visualElements?: string[]
  audioNotes?: string
  transitionType?: 'cut' | 'fade' | 'dissolve' | 'wipe'

  // 관련 StoryStep
  storyStepId: string
}

/**
 * 인서트 3컷 추천
 */
export interface InsertShot {
  id: string
  shotSequenceId: string
  order: number // 1-3
  description: string
  purpose: 'detail' | 'context' | 'emotion' | 'transition'
  imageUrl?: string
}

/**
 * Marp PDF 메타데이터
 */
export interface MarpExportMetadata {
  theme: 'default' | 'gaia' | 'uncover'
  backgroundColor?: string
  textColor?: string
  accentColor?: string
  includeConti: boolean
  includeInserts: boolean
  includeTiming: boolean
  customTemplate?: string
}

/**
 * PDF 내보내기 설정
 */
export interface ExportSettings {
  format: 'json' | 'pdf' | 'both'
  marpSettings: MarpExportMetadata
  includeMetadata: boolean
  includeVersionInfo: boolean
}

/**
 * 완전한 기획 프로젝트 엔티티
 */
export interface PlanningProject {
  metadata: PlanningProjectMetadata
  inputData: PlanningInputData
  storySteps: StoryStep[]
  shotSequences: ShotSequence[]
  insertShots: InsertShot[]
  exportSettings?: ExportSettings

  // 계산된 값들
  totalDuration?: number
  completionPercentage: number
  currentStep: WizardStep
}

/**
 * 기획 프로젝트 생성 입력
 */
export interface PlanningProjectCreateInput {
  title: string
  description?: string
  projectId?: string
  inputData: PlanningInputData
}

/**
 * 기획 프로젝트 업데이트 입력
 */
export interface PlanningProjectUpdateInput {
  metadata?: Partial<PlanningProjectMetadata>
  inputData?: Partial<PlanningInputData>
  storySteps?: StoryStep[]
  shotSequences?: ShotSequence[]
  insertShots?: InsertShot[]
  exportSettings?: Partial<ExportSettings>
}

/**
 * 스토리 생성 요청
 */
export interface StoryGenerationRequest {
  inputData: PlanningInputData
  existingSteps?: StoryStep[] // 기존 스텝 (수정 시)
}

/**
 * 스토리 생성 응답
 */
export interface StoryGenerationResponse {
  storySteps: Omit<StoryStep, 'id'>[]
  estimatedDuration: number
  suggestedKeywords: string[]
  rationale: string // AI 생성 근거
}

/**
 * 12숏 분해 요청
 */
export interface ShotBreakdownRequest {
  storySteps: StoryStep[]
  inputData: PlanningInputData
  targetShotCount?: number // 기본 12개
}

/**
 * 12숏 분해 응답
 */
export interface ShotBreakdownResponse {
  shotSequences: Omit<ShotSequence, 'id'>[]
  insertShots: Omit<InsertShot, 'id' | 'shotSequenceId'>[]
  totalDuration: number
  distributionRationale: string // 시간 배분 근거
}

/**
 * 콘티 생성 요청
 */
export interface ContiGenerationRequest {
  shotSequence: ShotSequence
  style: ContiStyle
  referenceImageUrl?: string // 일관성을 위한 참조 이미지
  projectContext?: {
    genre?: string
    visualStyle?: string
    colorPalette?: string
  }
}

/**
 * 콘티 생성 응답
 */
export interface ContiGenerationResponse {
  imageUrl: string
  style: ContiStyle
  prompt: string // 생성에 사용된 프롬프트
  seed?: number // 재현 가능성을 위한 시드
  generatedAt: Date
  provider: 'bytedance' | 'stable_diffusion' | 'midjourney'
}

/**
 * Marp PDF 생성 요청
 */
export interface MarpPdfGenerationRequest {
  planningProject: PlanningProject
  exportSettings: ExportSettings
}

/**
 * Marp PDF 생성 응답
 */
export interface MarpPdfGenerationResponse {
  pdfUrl: string
  jsonUrl?: string
  fileSize: number
  pageCount: number
  generatedAt: Date
  expiresAt: Date // 다운로드 링크 만료 시간
}

/**
 * 위저드 진행 상태
 */
export interface WizardProgress {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  isGenerating: boolean
  lastSavedAt?: Date

  // 각 단계별 완료율
  inputCompletion: number // 0-100
  storyCompletion: number // 0-100
  shotsCompletion: number // 0-100
}

/**
 * 세션 복원 데이터
 */
export interface SessionRestoreData {
  planningProjectId: string
  currentStep: WizardStep
  tempData?: Partial<PlanningProject>
  lastActivity: Date
}

/**
 * 자동 저장 설정
 */
export interface AutoSaveSettings {
  enabled: boolean
  interval: number // 초 단위 (기본 30초)
  maxVersions: number // 보관할 버전 수
}

/**
 * 에러 타입 정의
 */
export interface PlanningError {
  code: string
  message: string
  step?: WizardStep
  details?: Record<string, unknown>
}

/**
 * 검증 결과
 */
export interface PlanningValidationResult {
  isValid: boolean
  errors: PlanningError[]
  warnings?: string[]
  suggestions?: string[]
}

/**
 * 기획서 템플릿
 */
export interface PlanningTemplate {
  id: string
  name: string
  description: string
  category: 'marketing' | 'education' | 'entertainment' | 'corporate'
  inputDataTemplate: Partial<PlanningInputData>
  storyStepsTemplate: Partial<StoryStep>[]
  exportSettingsTemplate: Partial<ExportSettings>
  isPublic: boolean
  createdBy: string
  usageCount: number
  rating: number
}

/**
 * 검색 및 필터링
 */
export interface PlanningSearchFilter {
  query?: string
  status?: WizardStatus[]
  toneAndManner?: ToneAndManner[]
  development?: StoryDevelopment[]
  duration?: {
    min?: number
    max?: number
  }
  createdAfter?: Date
  createdBefore?: Date
  userId?: string
  projectId?: string

  // 정렬
  sortBy: 'createdAt' | 'updatedAt' | 'title' | 'duration' | 'status'
  sortOrder: 'asc' | 'desc'

  // 페이지네이션
  limit: number
  offset: number
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedPlanningProjects {
  data: PlanningProject[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 비즈니스 규칙 정의
 */
export const PLANNING_BUSINESS_RULES = {
  MAX_TITLE_LENGTH: 100,
  MAX_LOGLINE_LENGTH: 300,
  MAX_DESCRIPTION_LENGTH: 1000,
  MIN_STORY_STEPS: 4,
  MAX_STORY_STEPS: 4,
  MIN_SHOT_SEQUENCES: 8,
  MAX_SHOT_SEQUENCES: 16,
  DEFAULT_SHOT_COUNT: 12,
  MAX_INSERT_SHOTS_PER_SEQUENCE: 3,
  MIN_SHOT_DURATION: 3, // 3초
  MAX_SHOT_DURATION: 60, // 60초
  DEFAULT_AUTO_SAVE_INTERVAL: 30, // 30초
  SESSION_RESTORE_TIMEOUT: 24 * 60 * 60 * 1000, // 24시간
} as const

/**
 * 상수 정의
 */
export const PLANNING_CONSTANTS = {
  WIZARD_STEPS: ['input', 'story', 'shots'] as const,
  TONE_AND_MANNER_OPTIONS: ['casual', 'professional', 'creative', 'educational', 'marketing'] as const,
  STORY_DEVELOPMENT_OPTIONS: ['linear', 'dramatic', 'problem_solution', 'comparison', 'tutorial'] as const,
  CONTI_STYLE_OPTIONS: ['pencil', 'rough', 'monochrome', 'colored'] as const,
  EXPORT_FORMAT_OPTIONS: ['json', 'pdf', 'both'] as const,
} as const