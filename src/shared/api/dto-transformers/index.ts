/**
 * DTO 변환 계층 통합 Export
 * API 응답과 도메인 모델 간의 안전한 데이터 변환을 위한 중앙 집중 인터페이스
 * FSD shared 레이어 - Anti-Corruption Layer 역할
 */

// Story 관련 변환 함수들
export {
  transformStoryInputToApiRequest,
  transformApiResponseToStorySteps,
  transformStoryStepsToApiRequest,
  transformApiError,
  validateStoryData,
  normalizeStorySteps,
} from './story-transformers';

// Storyboard 관련 변환 함수들
export {
  transformShotsToApiRequest,
  transformApiResponseToShots,
  transformStoryboardShotsToApiRequest,
  transformApiResponseToStoryboardShots,
  normalizeShotType,
  normalizeCameraMovement,
  normalizeShots,
  normalizeStoryboardShots,
  validateAndAdjustShotDurations,
  transformStoryboardApiError,
  validateStoryboardData,
} from './storyboard-transformers';

// Project 관련 변환 함수들
export {
  transformProjectToApiRequest,
  transformApiResponseToProject,
  transformApiResponseToProjectMetadata,
  transformProjectUpdateToApiRequest,
  calculateProjectProgress,
  calculateProjectStats,
  filterProjects,
  sortProjects,
  transformProjectApiError,
} from './project-transformers';

// 공통 타입들
export type {
  ApiStoryInput,
  ApiStoryStep,
  ApiStoryResponse,
} from './story-transformers';

export type {
  ApiShotRequest,
  ApiShotResponse,
  ApiStoryboardShotRequest,
  ApiStoryboardShotResponse,
  ApiShotsGenerationResponse,
  ApiStoryboardGenerationResponse,
} from './storyboard-transformers';

export type {
  ApiProjectRequest,
  ApiProjectResponse,
  ApiProjectListResponse,
} from './project-transformers';