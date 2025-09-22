/**
 * Content Management Entity Types
 *
 * CLAUDE.md 준수: entities 레이어 도메인 타입 정의
 * FRD.md 명세: /planning 경로 4개 탭 (AI Scenarios, Prompts, Images, Videos)
 */

// === Core Content Types ===

/**
 * 콘텐츠 타입 정의 (FRD.md 4개 탭 기준)
 */
export type ContentType = 'scenario' | 'prompt' | 'image' | 'video'

/**
 * 콘텐츠 상태 정의
 */
export type ContentStatus =
  | 'draft'      // 임시저장
  | 'active'     // 사용 중
  | 'archived'   // 보관됨
  | 'processing' // 처리 중 (이미지/비디오 생성)
  | 'failed'     // 실패
  | 'deleted'    // 삭제됨

/**
 * 콘텐츠 사용 용도
 */
export type ContentUsage =
  | 'template'    // 템플릿
  | 'instance'    // 실제 사용된 인스턴스
  | 'variation'   // 변형
  | 'archive'     // 아카이브

// === Core Domain Models ===

/**
 * 콘텐츠 메타데이터
 */
export interface ContentMetadata {
  readonly id: string
  readonly type: ContentType
  readonly status: ContentStatus
  readonly usage: ContentUsage

  // 기본 정보
  readonly title: string
  readonly description?: string
  readonly tags: readonly string[]

  // 관계 정보
  readonly projectId?: string
  readonly userId: string
  readonly parentId?: string // 원본 콘텐츠 ID (변형인 경우)

  // 사용 통계
  readonly usageCount: number
  readonly lastUsedAt?: Date

  // 시간 정보
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly deletedAt?: Date
}

/**
 * 통합 콘텐츠 아이템 (Union Type 패턴)
 */
export interface ContentItem<T = unknown> {
  readonly metadata: ContentMetadata
  readonly content: T
  readonly version: number
  readonly checksum: string // 콘텐츠 변경 감지용
}

/**
 * 시나리오 콘텐츠 특화 타입
 */
export interface ScenarioContent {
  readonly story: string
  readonly scenes: readonly Scene[]
  readonly tone?: string
  readonly genre?: string
  readonly duration?: number
  readonly characterCount?: number
}

/**
 * 프롬프트 콘텐츠 특화 타입
 */
export interface PromptContent {
  readonly template: string
  readonly variables: Record<string, string>
  readonly category: PromptCategory
  readonly instructions?: string
  readonly examples?: readonly string[]
}

/**
 * 이미지 콘텐츠 특화 타입
 */
export interface ImageContent {
  readonly url: string
  readonly thumbnailUrl?: string
  readonly prompt: string
  readonly style?: string
  readonly resolution: Resolution
  readonly fileSize: number
  readonly format: ImageFormat
}

/**
 * 비디오 콘텐츠 특화 타입
 */
export interface VideoContent {
  readonly url: string
  readonly thumbnailUrl?: string
  readonly prompt: string
  readonly duration: number
  readonly resolution: Resolution
  readonly fileSize: number
  readonly format: VideoFormat
  readonly provider: VideoProvider
}

// === Specialized Content Items ===

export type ScenarioContentItem = ContentItem<ScenarioContent>
export type PromptContentItem = ContentItem<PromptContent>
export type ImageContentItem = ContentItem<ImageContent>
export type VideoContentItem = ContentItem<VideoContent>

export type AnyContentItem =
  | ScenarioContentItem
  | PromptContentItem
  | ImageContentItem
  | VideoContentItem

// === Supporting Types ===

export type PromptCategory =
  | 'story-generation'
  | 'image-generation'
  | 'video-generation'
  | 'scene-description'
  | 'character-development'
  | 'custom'

export type ImageFormat = 'jpg' | 'png' | 'webp' | 'gif'
export type VideoFormat = 'mp4' | 'mov' | 'webm' | 'avi'

export interface Resolution {
  readonly width: number
  readonly height: number
}

export type VideoProvider = 'runway' | 'stable-video' | 'custom'

export interface Scene {
  readonly id: string
  readonly description: string
  readonly duration?: number
  readonly characters?: readonly string[]
}

// === Search & Filter Types ===

/**
 * 콘텐츠 필터 옵션
 */
export interface ContentFilter {
  readonly types?: readonly ContentType[]
  readonly statuses?: readonly ContentStatus[]
  readonly usages?: readonly ContentUsage[]
  readonly tags?: readonly string[]
  readonly projectIds?: readonly string[]
  readonly userId?: string
  readonly dateRange?: {
    readonly from: Date
    readonly to: Date
  }
  readonly searchText?: string
}

/**
 * 콘텐츠 정렬 옵션
 */
export interface ContentSort {
  readonly field: ContentSortField
  readonly direction: 'asc' | 'desc'
}

export type ContentSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'lastUsedAt'
  | 'usageCount'
  | 'title'
  | 'type'
  | 'status'

/**
 * 페이지네이션된 콘텐츠 결과
 */
export interface PaginatedContentItems {
  readonly items: readonly AnyContentItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean
}

// === CRUD Operations ===

/**
 * 콘텐츠 생성 입력
 */
export interface ContentCreateInput<T = unknown> {
  readonly type: ContentType
  readonly title: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly projectId?: string
  readonly usage?: ContentUsage
  readonly content: T
}

/**
 * 콘텐츠 업데이트 입력
 */
export interface ContentUpdateInput<T = unknown> {
  readonly title?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly status?: ContentStatus
  readonly usage?: ContentUsage
  readonly content?: Partial<T>
}

// === Validation & Error Types ===

/**
 * 콘텐츠 검증 결과
 */
export interface ContentValidationResult {
  readonly isValid: boolean
  readonly errors: readonly ContentValidationError[]
  readonly warnings: readonly ContentValidationWarning[]
}

export interface ContentValidationError {
  readonly field: string
  readonly code: string
  readonly message: string
}

export interface ContentValidationWarning {
  readonly field: string
  readonly code: string
  readonly message: string
}

/**
 * 콘텐츠 관리 에러
 */
export class ContentManagementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ContentManagementError'
  }
}

// === Business Rules & Constants ===

/**
 * 콘텐츠 관리 비즈니스 규칙
 */
export const CONTENT_BUSINESS_RULES = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_TAGS_COUNT: 10,
  MAX_TAG_LENGTH: 50,
  MAX_CONTENT_SIZE_MB: 100,
  ALLOWED_IMAGE_FORMATS: ['jpg', 'png', 'webp', 'gif'] as const,
  ALLOWED_VIDEO_FORMATS: ['mp4', 'mov', 'webm'] as const,
  MIN_RESOLUTION: { width: 256, height: 256 } as const,
  MAX_RESOLUTION: { width: 4096, height: 4096 } as const,
} as const

/**
 * 콘텐츠 관리 상수
 */
export const CONTENT_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_SORT: { field: 'updatedAt', direction: 'desc' } as const,
  CACHE_TTL_SECONDS: 300, // 5분
  AUTO_ARCHIVE_DAYS: 90,
  HARD_DELETE_DAYS: 365,
} as const

// === Type Guards ===

export const isContentType = (value: string): value is ContentType => {
  return ['scenario', 'prompt', 'image', 'video'].includes(value)
}

export const isContentStatus = (value: string): value is ContentStatus => {
  return ['draft', 'active', 'archived', 'processing', 'failed', 'deleted'].includes(value)
}

export const isContentUsage = (value: string): value is ContentUsage => {
  return ['template', 'instance', 'variation', 'archive'].includes(value)
}

export const isScenarioContentItem = (item: AnyContentItem): item is ScenarioContentItem => {
  return item.metadata.type === 'scenario'
}

export const isPromptContentItem = (item: AnyContentItem): item is PromptContentItem => {
  return item.metadata.type === 'prompt'
}

export const isImageContentItem = (item: AnyContentItem): item is ImageContentItem => {
  return item.metadata.type === 'image'
}

export const isVideoContentItem = (item: AnyContentItem): item is VideoContentItem => {
  return item.metadata.type === 'video'
}