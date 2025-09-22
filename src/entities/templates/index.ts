/**
 * 템플릿 엔티티 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD Public API 패턴 (index.ts를 통한 단일 진입점)
 * - Named export 우선 사용
 * - 타입과 구현체 분리하여 export
 */

// ===========================================
// 타입 재내보내기
// ===========================================

export type {
  // 핵심 도메인 타입
  ProjectTemplate,
  TemplateStoryStep,
  TemplateShotSequence,
  TemplatePromptConfig,
  TemplateMetadata,
  TemplateAsset,
  TemplateTag,
  TemplateCollection,
  TemplateUsageHistory,
  TemplateReview,

  // 유틸리티 타입
  TemplateCategory,
  TemplateDifficulty,
  TemplateDuration,
  TemplateStatus,
  TemplateSortOption,
  TemplateSearchFilters,

  // 요청/응답 타입
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateProjectFromTemplateRequest
} from './types'

// ===========================================
// 도메인 서비스 내보내기
// ===========================================

export { TemplateDomain } from './model/domain'

// ===========================================
// 미리 정의된 템플릿 데이터 내보내기
// ===========================================

export {
  PREDEFINED_TEMPLATES,
  TEMPLATE_TAGS,
  TEMPLATES_BY_CATEGORY,
  POPULAR_TEMPLATES,
  RECOMMENDED_FOR_BEGINNERS,
  LATEST_TEMPLATES
} from './model/template-data'

// ===========================================
// 유틸리티 함수 (도메인 서비스의 편의 메서드들)
// ===========================================

/**
 * 템플릿 관련 유틸리티 함수들
 */
export const TemplateUtils = {
  /**
   * 템플릿 생성 헬퍼
   */
  createTemplate: TemplateDomain.createTemplate.bind(TemplateDomain),

  /**
   * 템플릿 업데이트 헬퍼
   */
  updateTemplate: TemplateDomain.updateTemplate.bind(TemplateDomain),

  /**
   * 템플릿 사용량 업데이트 헬퍼
   */
  updateUsage: TemplateDomain.updateTemplateUsage.bind(TemplateDomain),

  /**
   * 템플릿 필터링 헬퍼
   */
  filterTemplates: TemplateDomain.filterTemplates.bind(TemplateDomain),

  /**
   * 템플릿 정렬 헬퍼
   */
  sortTemplates: TemplateDomain.sortTemplates.bind(TemplateDomain),

  /**
   * 템플릿 검색 헬퍼
   */
  searchTemplates: TemplateDomain.searchTemplates.bind(TemplateDomain),

  /**
   * 추천 템플릿 조회 헬퍼
   */
  getRecommended: TemplateDomain.getRecommendedTemplates.bind(TemplateDomain),

  /**
   * 인기 템플릿 조회 헬퍼
   */
  getPopular: TemplateDomain.getPopularTemplates.bind(TemplateDomain),

  /**
   * 템플릿 검증 헬퍼
   */
  validateTemplate: TemplateDomain.validateTemplate.bind(TemplateDomain),

  /**
   * 카테고리별 템플릿 조회
   */
  getByCategory: (category: TemplateCategory) => {
    return PREDEFINED_TEMPLATES.filter(t => t.category === category)
  },

  /**
   * 난이도별 템플릿 조회
   */
  getByDifficulty: (difficulty: TemplateDifficulty) => {
    return PREDEFINED_TEMPLATES.filter(t => t.difficulty === difficulty)
  },

  /**
   * 태그별 템플릿 조회
   */
  getByTag: (tagName: string) => {
    return PREDEFINED_TEMPLATES.filter(t =>
      t.tags.some(tag => tag.name.toLowerCase() === tagName.toLowerCase())
    )
  },

  /**
   * 템플릿 ID로 조회
   */
  getById: (templateId: string) => {
    return PREDEFINED_TEMPLATES.find(t => t.id === templateId) || null
  },

  /**
   * 랜덤 템플릿 조회
   */
  getRandom: (count: number = 1) => {
    const shuffled = [...PREDEFINED_TEMPLATES].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }
} as const

// ===========================================
// 상수 내보내기
// ===========================================

/**
 * 템플릿 관련 상수
 */
export const TEMPLATE_CONSTANTS = {
  /**
   * 카테고리 목록
   */
  CATEGORIES: [
    'advertising',
    'education',
    'entertainment',
    'business',
    'social',
    'product',
    'storytelling',
    'tutorial'
  ] as const,

  /**
   * 난이도 목록
   */
  DIFFICULTIES: ['beginner', 'intermediate', 'advanced'] as const,

  /**
   * 길이 목록
   */
  DURATIONS: ['short', 'medium', 'long'] as const,

  /**
   * 상태 목록
   */
  STATUSES: ['draft', 'published', 'featured', 'deprecated'] as const,

  /**
   * 정렬 옵션 목록
   */
  SORT_OPTIONS: [
    'name',
    'createdAt',
    'updatedAt',
    'downloadCount',
    'rating',
    'popularity',
    'difficulty'
  ] as const,

  /**
   * 기본 설정값
   */
  DEFAULTS: {
    SEARCH_LIMIT: 20,
    POPULAR_LIMIT: 6,
    RECOMMENDED_LIMIT: 4,
    MIN_RATING: 1,
    MAX_RATING: 5,
    DEFAULT_SORT: 'popularity' as TemplateSortOption,
    DEFAULT_ORDER: 'desc' as const
  },

  /**
   * 템플릿 구조 제약
   */
  CONSTRAINTS: {
    STORY_STEPS: 4,
    SHOT_SEQUENCES: 12,
    SHOTS_PER_STEP: 3,
    MAX_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
    MAX_SHORT_DESCRIPTION_LENGTH: 150,
    MAX_TAGS: 10,
    MAX_CUSTOMIZABLE_FIELDS: 20
  },

  /**
   * 썸네일 설정
   */
  THUMBNAIL: {
    DEFAULT_WIDTH: 400,
    DEFAULT_HEIGHT: 225,
    ASPECT_RATIO: '16:9',
    QUALITY: 85,
    FORMAT: 'jpg'
  }
} as const

// ===========================================
// 템플릿 카테고리 메타데이터
// ===========================================

/**
 * 카테고리별 메타데이터
 */
export const CATEGORY_METADATA = {
  advertising: {
    name: '광고/마케팅',
    description: '제품 홍보 및 브랜드 마케팅을 위한 템플릿',
    icon: '📢',
    color: '#10b981',
    keywords: ['광고', '마케팅', '프로모션', '브랜딩']
  },
  education: {
    name: '교육/튜토리얼',
    description: '학습 및 교육 콘텐츠를 위한 템플릿',
    icon: '📚',
    color: '#f59e0b',
    keywords: ['교육', '튜토리얼', '강의', '설명']
  },
  entertainment: {
    name: '엔터테인먼트',
    description: '재미있는 콘텐츠 제작을 위한 템플릿',
    icon: '🎭',
    color: '#ec4899',
    keywords: ['엔터테인먼트', '재미', '코미디', '버라이어티']
  },
  business: {
    name: '비즈니스',
    description: '기업 및 비즈니스 프레젠테이션용 템플릿',
    icon: '💼',
    color: '#3b82f6',
    keywords: ['비즈니스', '프레젠테이션', '기업', '회사']
  },
  social: {
    name: '소셜미디어',
    description: 'SNS 공유를 위한 최적화된 템플릿',
    icon: '📱',
    color: '#8b5cf6',
    keywords: ['소셜미디어', 'SNS', '인스타그램', '틱톡']
  },
  product: {
    name: '제품 소개',
    description: '제품 기능 및 특징 소개용 템플릿',
    icon: '📦',
    color: '#ef4444',
    keywords: ['제품', '소개', '기능', '데모']
  },
  storytelling: {
    name: '스토리텔링',
    description: '감동적인 이야기 전달을 위한 템플릿',
    icon: '📖',
    color: '#06b6d4',
    keywords: ['스토리', '이야기', '감동', '내러티브']
  },
  tutorial: {
    name: '가이드/매뉴얼',
    description: '사용법 및 매뉴얼 제작용 템플릿',
    icon: '🛠️',
    color: '#84cc16',
    keywords: ['가이드', '매뉴얼', '사용법', '설명서']
  }
} as const

// ===========================================
// 기본 내보내기 (선택사항)
// ===========================================

/**
 * 가장 많이 사용될 도메인 서비스를 기본 내보내기로 제공
 */
export default TemplateDomain