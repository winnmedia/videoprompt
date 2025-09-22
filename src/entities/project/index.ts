/**
 * Project Entity Public API
 *
 * 프로젝트 도메인 모델의 진입점입니다.
 * 프로젝트 관련 비즈니스 로직과 타입을 제공합니다.
 */

// Types
export type {
  Project,
  ProjectStatus,
  ProjectPriority,
  ProjectMetadata,
  ProjectSettings,
  ProjectResources,
  ProjectProgress,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectFilter,
  ProjectSortBy,
  ProjectSortOptions,
  ProjectValidationResult,
  ProjectScenarioLink,
} from './types'

// Model
export { ProjectModel } from './model'

// Store
export {
  projectSlice,
  projectActions,
  projectSelectors,
  type ProjectState,
} from './store'

export { default as projectReducer } from './store'
