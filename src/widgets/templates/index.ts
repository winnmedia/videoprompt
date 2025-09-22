/**
 * 템플릿 위젯 Public API
 *
 * CLAUDE.md 준수사항:
 * - FSD widgets 레이어 Public API
 * - Named export 우선 사용
 * - UI 컴포넌트 노출
 * - 타입 재내보내기
 */

// ===========================================
// 메인 컴포넌트 내보내기
// ===========================================

/**
 * 템플릿 갤러리 컴포넌트
 */
export { TemplateGallery } from './TemplateGallery'

/**
 * 템플릿 카드 컴포넌트
 */
export { TemplateCard } from './TemplateCard'

/**
 * 템플릿 검색 컴포넌트
 */
export { TemplateSearch, SimpleTemplateSearch } from './TemplateSearch'

/**
 * 템플릿 필터 컴포넌트
 */
export { TemplateFilters } from './TemplateFilters'

/**
 * 템플릿 페이지네이션 컴포넌트
 */
export { TemplatePagination, SimpleTemplatePagination } from './TemplatePagination'

/**
 * 템플릿 뷰 토글 컴포넌트
 */
export { TemplateViewToggle } from './TemplateViewToggle'

// ===========================================
// 타입 재내보내기
// ===========================================

// Note: ./types file does not exist, removing import

// entities/templates와 features/templates 타입들 재내보내기 (convenience)
export type {
  ProjectTemplate as Template, // Alias ProjectTemplate as Template for widget convenience
  TemplateSearchFilters,
  TemplateSortOption,
  TemplateCategory
} from '../../entities/templates'

export type {
  UseTemplateGalleryReturn
  // Note: UseTemplateSearchReturn does not exist, using UseTemplateGalleryReturn
} from '../../features/templates'

// ===========================================
// 기본 내보내기 (메인 컴포넌트)
// ===========================================

/**
 * 가장 많이 사용될 템플릿 갤러리를 기본 내보내기로 제공
 */
export { TemplateGallery as default } from './TemplateGallery'