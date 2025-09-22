/**
 * Storyboard Feature Public API
 *
 * 스토리보드 기능 레이어의 단일 진입점
 * CLAUDE.md 준수: FSD features 레이어 Public API, 캡슐화
 */

// 이미지 생성 엔진
export {
  ImageGenerationEngine,
  type ImageGenerationRequest,
  type GenerationProgressCallback,
  type ImageGenerationAPIClient
} from './model/image-generator'

// 일관성 관리자
export {
  ConsistencyManager,
  type ColorPaletteAnalysis,
  type StyleAnalysis,
  type ConsistencyScore,
  type ConsistencyExtractor
} from './model/consistency-manager'

// React 훅
export {
  useStoryboardGeneration,
  type UseStoryboardGenerationOptions,
  type UseStoryboardGenerationReturn
} from './hooks/use-storyboard-generation'

// 에러 처리 및 재시도
export {
  StoryboardErrorHandler,
  storyboardErrorHandler,
  DEFAULT_RETRY_POLICY,
  COST_SAFE_RETRY_POLICY,
  type DetailedError,
  type RetryPolicy,
  type RetryState,
  type ErrorType,
  type ErrorSeverity
} from './model/error-handler'