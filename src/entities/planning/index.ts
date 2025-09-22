/**
 * Planning Entity Public API
 *
 * CLAUDE.md 준수: FSD Public API 패턴, entities 레이어
 */

// 타입 정의
export type {
  // 핵심 엔티티
  PlanningProject,
  PlanningProjectMetadata,
  PlanningInputData,
  StoryStep,
  ShotSequence,
  InsertShot,

  // 위저드 관련
  WizardStep,
  WizardStatus,
  WizardProgress,

  // 옵션 타입
  ToneAndManner,
  StoryDevelopment,
  StoryIntensity,
  ContiStyle,

  // API 요청/응답
  StoryGenerationRequest,
  StoryGenerationResponse,
  ShotBreakdownRequest,
  ShotBreakdownResponse,
  ContiGenerationRequest,
  ContiGenerationResponse,

  // Marp 및 내보내기
  MarpExportMetadata,
  ExportSettings,
  MarpPdfGenerationRequest,
  MarpPdfGenerationResponse,

  // CRUD 타입
  PlanningProjectCreateInput,
  PlanningProjectUpdateInput,

  // 검색 및 필터링
  PlanningSearchFilter,
  PaginatedPlanningProjects,

  // 검증 및 에러
  PlanningValidationResult,
  PlanningError,

  // 세션 및 설정
  SessionRestoreData,
  AutoSaveSettings,

  // 템플릿
  PlanningTemplate,
} from './types'

// 비즈니스 로직 함수
export {
  validatePlanningInput,
  validateStorySteps,
  validateShotSequences,
  calculateWizardProgress,
  calculateCompletionPercentage,
  calculateTotalDuration,
  canRestoreSession,
  reorderStorySteps,
  reorderShotSequences,
  createDefaultStorySteps,
  createDefaultShotSequences,
  validateDataIntegrity,
} from './model'

// 상수
export {
  PLANNING_BUSINESS_RULES,
  PLANNING_CONSTANTS,
} from './types'

// Redux Store (re-export from features)
export {
  default as planningSlice,
  planningActions,
  planningSelectors,
  createProject,
  loadProject,
  saveProject,
  loadProjects,
  type PlanningState
} from '../../features/planning/store/planning-slice'