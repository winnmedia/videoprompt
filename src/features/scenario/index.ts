/**
 * Scenario feature 통합 export
 * FSD features 레이어 - 시나리오 기능의 공개 인터페이스
 */

// Redux slices
export { default as scenarioReducer } from '@/entities/scenario/store/scenario-slice';
export { default as storyReducer } from '@/entities/scenario/store/story-slice';
export { default as storyboardReducer } from '@/entities/scenario/store/storyboard-slice';

// Slice actions and selectors
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
} from '@/entities/scenario/store/scenario-slice';

export {
  setLoading,
  setError,
  setStorySteps,
  updateStoryStep,
  startEditing,
  saveEditing,
  selectStorySteps,
  selectIsLoading as selectStoryLoading,
  selectError as selectStoryError,
  selectIsEditing,
  selectStoryProgress,
} from '@/entities/scenario/store/story-slice';

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
} from '@/entities/scenario/store/storyboard-slice';

// React Query hooks
export {
  useStoryGeneration,
  useStorySave,
  useStoryLoad,
  useSavedStories,
  useAutoSaveStory,
  useInvalidateStoryCache,
  storyQueryKeys,
} from './hooks/use-story-generation';

export {
  useShotGeneration,
  useStoryboardGeneration,
  useStoryboardSave,
  useStoryboardLoad,
  useSavedStoryboards,
  useFullStoryboardWorkflow,
  useInvalidateStoryboardCache,
  storyboardQueryKeys,
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
  projectQueryKeys,
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

// DTO transformers
export {
  transformStoryInputToApiRequest,
  transformApiResponseToStorySteps,
  transformShotsToApiRequest,
  transformApiResponseToShots,
  transformStoryboardShotsToApiRequest,
  transformApiResponseToStoryboardShots,
  transformProjectToApiRequest,
  transformApiResponseToProject,
} from '@/shared/api/dto-transformers';

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