/**
 * Storyboard Entity Public API
 *
 * 스토리보드 도메인 모델의 진입점입니다.
 * 스토리보드 관련 비즈니스 로직과 타입을 제공합니다.
 *
 * CLAUDE.md 준수: FSD Public API 원칙, 단일 진입점
 */

// === Core Types ===
export type {
  Storyboard,
  StoryboardFrame,
  StoryboardMetadata,
  StoryboardFrameMetadata,
  StoryboardSettings,
  StoryboardFrameStatus,
  ImageGenerationModel,
  ImageAspectRatio,
  ImageQuality,
  StylePreset,
  ImageGenerationConfig,
  ConsistencyReference,
  PromptEngineering,
  GenerationResult,
  GenerationProgress,
  StoryboardCreateInput,
  StoryboardUpdateInput,
  FrameGenerationRequest,
  BatchGenerationRequest,
  StoryboardValidationResult,
  StoryboardError,
  ExportOptions,
  StoryboardAnalytics,
  StoryboardStatistics
} from './types'

// === Domain Model ===
export { StoryboardModel, STORYBOARD_CONSTANTS } from './model'

// === Store (Redux Toolkit Slices) ===
export {
  storyboardSlice,
  storyboardActions,
  storyboardSelectors,
  type StoryboardState
} from './store'