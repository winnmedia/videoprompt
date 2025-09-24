/**
 * Shots Feature Public API
 * FSD Public API 규칙 준수
 */

// Hooks
export { useShots } from './hooks/useShots';

// Types
export type {
  ShotGenerationRequest,
  ShotGenerationResponse,
  ShotGenerationError,
  ShotGenerationProgress,
  StoryboardGenerationRequest,
  StoryboardGenerationResponse,
  ShotState,
  ShotEditRequest,
  ShotPlanDownloadRequest,
  ShotPlanDownloadResponse,
  ShotAnalysis
} from './types';

// Store
export {
  shotsActions,
  selectCurrentCollection,
  selectIsGenerating,
  selectGenerationProgress,
  selectGenerationError,
  selectSelectedShotId,
  selectDragEnabled,
  selectPreviewMode,
  selectStoryboardGeneration,
  selectCollectionHistory,
  selectCollectionCompletionPercentage,
  selectShotById,
  selectShotsByAct
} from './store/shots-slice';

export { default as shotsReducer } from './store/shots-slice';

// API Engines
export { ShotGenerationEngine, StoryboardGenerationEngine } from './api';