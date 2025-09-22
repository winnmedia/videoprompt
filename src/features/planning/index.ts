/**
 * Planning Feature Public API
 *
 * 영상 기획 위저드 기능의 진입점입니다.
 * CLAUDE.md 준수: FSD Public API 패턴, features 레이어
 */

// Hooks
export { usePlanningWizard } from './hooks/usePlanningWizard'
export { useStoryGeneration } from './hooks/useStoryGeneration'
export { useShotBreakdown } from './hooks/useShotBreakdown'
export { useContiGeneration } from './hooks/useContiGeneration'
export { useMarpExport } from './hooks/useMarpExport'

// Redux Store
export { default as planningReducer, planningActions, planningSelectors } from './store/planning-slice'
export {
  createProject,
  loadProject,
  saveProject,
  loadProjects,
} from './store/planning-slice'

// Types (re-export from entities)
export type {
  UsePlanningWizardState,
  UsePlanningWizardOptions,
  UseStoryGenerationState,
  StoryGenerationStep,
  UseStoryGenerationOptions,
  UseShotBreakdownState,
  ShotBreakdownStep,
  UseShotBreakdownOptions,
  UseContiGenerationState,
  UseContiGenerationOptions,
  UseMarpExportState,
  ExportStep,
  UseMarpExportOptions,
} from './hooks/usePlanningWizard'
