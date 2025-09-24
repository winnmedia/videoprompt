/**
 * Shared API Clients Public API
 * API 클라이언트 및 통신 관련 모듈 export
 * + Cost Safety 통합 API 시스템
 */

// Cost-Aware API 클라이언트 - $300 사건 방지 시스템
export {
  costAwareApiClient,
  CostAwareApiError,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  useApiRequest,
} from './cost-aware-client';

// DTO 검증 및 변환 시스템
export {
  DTOValidator,
  ValidationError,
  TransformationError,
  validateUser,
  validateProject,
  validateScenario,
  validateStoryboard,
  validateVideoJob,
  validateUsers,
  validateProjects,
  validateScenarios,
  validateStoryboards,
  validateVideoJobs,
  // 스키마들
  UserDTOSchema,
  UserDomainSchema,
  ProjectDTOSchema,
  ProjectDomainSchema,
  ScenarioDTOSchema,
  ScenarioDomainSchema,
  StoryboardDTOSchema,
  StoryboardDomainSchema,
  VideoJobDTOSchema,
  VideoJobDomainSchema,
} from './dto-validation-system';

// Supabase 클라이언트
export {
  createSupabaseClient,
  getSupabaseClient,
  getCurrentUser,
  signOut,
  signInWithEmail,
  signUpWithEmail,
  checkSupabaseConnection,
} from './supabase-client';

// 범용 API 클라이언트
export { getApiClient, createApiClient, api } from './api-client';

// 타입 정의
export type { ApiResponse, ApiError, RequestConfig } from './api-client';
export type {
  UserDTO,
  UserDomain,
  ProjectDTO,
  ProjectDomain,
  ScenarioDTO,
  ScenarioDomain,
  StoryboardDTO,
  StoryboardDomain,
  VideoJobDTO,
  VideoJobDomain,
} from './dto-validation-system';
