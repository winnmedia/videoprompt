/**
 * Scenario feature 통합 export
 * FSD features 레이어 - 시나리오 기능의 공개 인터페이스
 */

// Redux slices - entities Public API 경유
export {
  scenarioReducer,
  storyReducer,
  storyboardReducer
} from '@/entities/scenario';

// Slice actions and selectors - entities Public API 경유
export {
  setWorkflowStep,
  setCanProceed,
  completeWorkflow,
  resetWorkflow,
  updateStoryInput,
  setStoryInput,
  markSaved,
  markDirty,
  selectWorkflow,
  selectCurrentStep,
  selectStoryInput,
  selectIsValid,
  selectWorkflowProgress,
} from '@/entities/scenario';

// Story actions - entities Public API 경유
export {
  setLoading,
  setError as setStoryError,
  setStorySteps,
  updateStoryStep,
  resetStory as clearStory,
} from '@/entities/scenario';

// Storyboard actions - entities Public API 경유
export {
  setShots,
  setStoryboardShots,
  startGeneration,
  updateGenerationProgress,
  completeGeneration,
  selectShots,
  selectStoryboardShots,
  selectIsGenerating,
  selectGenerationProgress,
  selectStoryboardStats,
} from '@/entities/scenario';

// RTK Query hooks
export {
  useStoryGeneration,
  useStorySave,
  useStoryLoad,
  useSavedStories,
  useAutoSaveStory,
  useInvalidateStoryCache,
} from './hooks/use-story-generation';

export {
  useShotGeneration,
  useStoryboardGeneration,
  useStoryboardSave,
  useStoryboardLoad,
  useSavedStoryboards,
  useAutoSaveStoryboard,
  useInvalidateStoryboardCache,
  useStoryboardWorkflow,
} from './hooks/use-storyboard-generation';

export {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProject,
  useProjects,
  useRecentProjects,
  useAutoSaveProject,
  useDuplicateProject,
  useProjectCacheManager,
  useProjectStats,
} from './hooks/use-project-management';

// Types (re-export from entities)
export type {
  StoryInput,
  StoryStep,
  Shot,
  StoryboardShot,
  InsertShot,
  StoryTemplate,
} from '@/entities/scenario';

export type {
  Project,
  ProjectMetadata,
} from './hooks/use-project-management';

// DTO transformers are available from shared API layer
// Use: import { transformStoryInputToApiRequest, ... } from '@/shared/api/dto-transformers'

// Error handling
export {
  handleQueryError,
  handleMutationError,
  ErrorHandler,
  UserFriendlyErrorMessages,
} from '@/shared/lib/error-handling';

// Performance utilities
export {
  useDebounce,
  useBatchProcessor,
  useMemoizedCalculation,
  useCacheOptimization,
} from '@/shared/lib/performance-optimization';