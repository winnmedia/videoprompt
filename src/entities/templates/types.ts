/**
 * 템플릿 엔티티 타입 정의
 *
 * CLAUDE.md 준수사항:
 * - FSD entities 레이어 (순수한 도메인 모델)
 * - 외부 기술 의존성 없는 비즈니스 로직
 * - 템플릿 시스템 도메인 모델
 */

/**
 * 템플릿 카테고리
 */
export type TemplateCategory =
  | 'advertising'      // 광고/마케팅
  | 'education'        // 교육/튜토리얼
  | 'entertainment'    // 엔터테인먼트
  | 'business'         // 비즈니스/프레젠테이션
  | 'social'           // 소셜미디어
  | 'product'          // 제품 소개
  | 'storytelling'     // 스토리텔링
  | 'tutorial'         // 튜토리얼/가이드

/**
 * 템플릿 난이도
 */
export type TemplateDifficulty =
  | 'beginner'         // 초급
  | 'intermediate'     // 중급
  | 'advanced'         // 고급

/**
 * 템플릿 길이 유형
 */
export type TemplateDuration =
  | 'short'            // 15초 이하
  | 'medium'           // 15-60초
  | 'long'             // 60초 이상

/**
 * 템플릿 상태
 */
export type TemplateStatus =
  | 'draft'            // 초안
  | 'published'        // 공개
  | 'featured'         // 추천
  | 'deprecated'       // 사용 중단

/**
 * 템플릿 태그
 */
export interface TemplateTag {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly description?: string
}

/**
 * 템플릿 미디어 에셋
 */
export interface TemplateAsset {
  readonly id: string
  readonly type: 'image' | 'video' | 'audio' | 'document'
  readonly url: string
  readonly thumbnailUrl?: string
  readonly filename: string
  readonly size: number
  readonly mimeType: string
  readonly description?: string
}

/**
 * 템플릿 메타데이터
 */
export interface TemplateMetadata {
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly version: string
  readonly author: {
    readonly id: string
    readonly name: string
    readonly avatar?: string
  }
  readonly usage: {
    readonly downloadCount: number
    readonly likeCount: number
    readonly viewCount: number
    readonly forkCount: number
  }
  readonly seo: {
    readonly title: string
    readonly description: string
    readonly keywords: readonly string[]
    readonly ogImage?: string
  }
}

/**
 * 템플릿 구성 요소 (4단계 스토리)
 */
export interface TemplateStoryStep {
  readonly order: number
  readonly title: string
  readonly content: string
  readonly duration: number           // 예상 지속시간 (초)
  readonly imagePrompt?: string      // 콘티 생성용 프롬프트
  readonly voiceoverText?: string    // 나레이션 텍스트
  readonly musicMood?: string        // 음악 분위기
}

/**
 * 템플릿 12숏 구성
 */
export interface TemplateShotSequence {
  readonly stepId: string            // 연결된 4단계 스토리 ID
  readonly order: number             // 숏 순서 (1-12)
  readonly title: string
  readonly description: string
  readonly duration: number          // 예상 지속시간 (초)
  readonly cameraAngle: string       // 카메라 앵글
  readonly lighting: string          // 조명 설정
  readonly movement: string          // 카메라 움직임
  readonly visualPrompt: string      // 비주얼 프롬프트
  readonly audioNotes?: string       // 오디오 노트
}

/**
 * 템플릿 프롬프트 설정
 */
export interface TemplatePromptConfig {
  readonly basePrompt: string        // 기본 프롬프트
  readonly styleModifiers: readonly string[]  // 스타일 수정자
  readonly qualitySettings: {
    readonly resolution: string
    readonly aspectRatio: string
    readonly frameRate: number
    readonly quality: 'low' | 'medium' | 'high' | 'ultra'
  }
  readonly brandingElements?: {
    readonly logoPlacement?: string
    readonly colorScheme?: readonly string[]
    readonly fontFamily?: string
  }
}

/**
 * 메인 템플릿 엔티티
 */
export interface ProjectTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly shortDescription: string   // 카드 표시용 짧은 설명
  readonly thumbnailUrl: string
  readonly previewVideoUrl?: string   // 미리보기 영상
  readonly category: TemplateCategory
  readonly tags: readonly TemplateTag[]
  readonly difficulty: TemplateDifficulty
  readonly duration: TemplateDuration
  readonly estimatedCompletionTime: number  // 완성까지 예상 시간 (분)
  readonly status: TemplateStatus
  readonly metadata: TemplateMetadata

  // 템플릿 구성 요소
  readonly storySteps: readonly TemplateStoryStep[]
  readonly shotSequences: readonly TemplateShotSequence[]
  readonly promptConfig: TemplatePromptConfig
  readonly assets: readonly TemplateAsset[]

  // 커스터마이징 옵션
  readonly customizableFields: readonly string[]  // 사용자가 변경 가능한 필드들
  readonly variationSuggestions: readonly string[]  // 변형 제안
  readonly industrySpecific?: readonly string[]  // 특정 업계용
}

/**
 * 템플릿 컬렉션 (연관된 템플릿들의 그룹)
 */
export interface TemplateCollection {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly thumbnailUrl: string
  readonly category: TemplateCategory
  readonly templateIds: readonly string[]
  readonly order: number
  readonly isPromoted: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * 템플릿 사용 이력
 */
export interface TemplateUsageHistory {
  readonly id: string
  readonly templateId: string
  readonly userId: string
  readonly projectId: string          // 생성된 프로젝트 ID
  readonly usedAt: Date
  readonly customizations: Record<string, unknown>  // 사용자가 적용한 커스터마이징
  readonly completion: {
    readonly completed: boolean
    readonly stepsCompleted: number
    readonly totalSteps: number
    readonly completedAt?: Date
  }
}

/**
 * 템플릿 리뷰/피드백
 */
export interface TemplateReview {
  readonly id: string
  readonly templateId: string
  readonly userId: string
  readonly rating: number             // 1-5 별점
  readonly comment?: string
  readonly helpfulVotes: number       // 도움이 된다고 투표한 수
  readonly createdAt: Date
  readonly isVerifiedUser: boolean    // 검증된 사용자 여부
}

/**
 * 템플릿 검색/필터 옵션
 */
export interface TemplateSearchFilters {
  readonly category?: TemplateCategory
  readonly difficulty?: TemplateDifficulty
  readonly duration?: TemplateDuration
  readonly tags?: readonly string[]
  readonly minRating?: number
  readonly isPopular?: boolean        // 인기 템플릿만
  readonly isFeatured?: boolean       // 추천 템플릿만
  readonly hasPreview?: boolean       // 미리보기 영상 있는 것만
  readonly sortBy?: TemplateSortOption
  readonly sortOrder?: 'asc' | 'desc'
}

export type TemplateSortOption =
  | 'name'
  | 'createdAt'
  | 'updatedAt'
  | 'downloadCount'
  | 'rating'
  | 'popularity'
  | 'difficulty'

/**
 * 템플릿 생성/업데이트 요청
 */
export interface CreateTemplateRequest {
  readonly name: string
  readonly description: string
  readonly shortDescription: string
  readonly category: TemplateCategory
  readonly difficulty: TemplateDifficulty
  readonly duration: TemplateDuration
  readonly estimatedCompletionTime: number
  readonly storySteps: readonly Omit<TemplateStoryStep, 'order'>[]
  readonly shotSequences: readonly Omit<TemplateShotSequence, 'stepId' | 'order'>[]
  readonly promptConfig: TemplatePromptConfig
  readonly tags?: readonly string[]
  readonly customizableFields?: readonly string[]
  readonly variationSuggestions?: readonly string[]
}

export interface UpdateTemplateRequest {
  readonly name?: string
  readonly description?: string
  readonly shortDescription?: string
  readonly category?: TemplateCategory
  readonly difficulty?: TemplateDifficulty
  readonly status?: TemplateStatus
  readonly storySteps?: readonly TemplateStoryStep[]
  readonly shotSequences?: readonly TemplateShotSequence[]
  readonly promptConfig?: TemplatePromptConfig
  readonly tags?: readonly TemplateTag[]
}

/**
 * 템플릿으로부터 프로젝트 생성 요청
 */
export interface CreateProjectFromTemplateRequest {
  readonly templateId: string
  readonly projectName: string
  readonly customizations?: Record<string, unknown>
  readonly selectedVariation?: string
}