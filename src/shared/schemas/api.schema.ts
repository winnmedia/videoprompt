import { z } from 'zod';

// ===============================================
// BASE API RESPONSE SCHEMAS
// ===============================================

/**
 * 기본 API 응답 스키마
 * 모든 API 응답에 공통으로 적용되는 구조
 */
export const BaseApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

/**
 * 데이터가 있는 API 응답 스키마
 * 제네릭 함수로 데이터 타입을 동적으로 받음
 */
export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return BaseApiResponseSchema.extend({
    data: dataSchema,
  });
}

/**
 * 페이지네이션 메타데이터 스키마
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

/**
 * 페이지네이션된 응답 스키마
 */
export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return BaseApiResponseSchema.extend({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

// ===============================================
// ERROR SCHEMAS
// ===============================================

/**
 * API 에러 스키마
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
});

/**
 * 검증 에러 스키마
 */
export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  received: z.any().optional(),
});

/**
 * 검증 에러 응답 스키마
 */
export const ValidationErrorResponseSchema = BaseApiResponseSchema.extend({
  success: z.literal(false),
  error: z.literal('VALIDATION_ERROR'),
  validationErrors: z.array(ValidationErrorSchema),
});

// ===============================================
// COMMON ENTITY SCHEMAS
// ===============================================

/**
 * 사용자 기본 정보 스키마
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  avatar: z.string().url().optional(),
  role: z.enum(['user', 'admin', 'moderator']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * 사용자 환경 설정 스키마
 */
export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.enum(['ko', 'en']),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean(),
  }),
  aiSettings: z.object({
    model: z.string(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().min(1).max(8000),
  }),
});

/**
 * 확장된 사용자 정보 스키마
 */
export const UserWithPreferencesSchema = UserSchema.extend({
  preferences: UserPreferencesSchema,
});

// ===============================================
// AUTHENTICATION SCHEMAS
// ===============================================

/**
 * 로그인 요청 스키마
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
});

/**
 * 회원가입 요청 스키마
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  username: z.string()
    .min(3, '사용자명은 최소 3자 이상이어야 합니다')
    .max(50, '사용자명은 최대 50자까지 입니다')
    .regex(/^[a-zA-Z0-9_-]+$/, '사용자명은 영문, 숫자, _, - 만 사용할 수 있습니다'),
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '비밀번호는 소문자, 대문자, 숫자를 포함해야 합니다'),
});

/**
 * 인증 응답 스키마
 */
export const AuthResponseSchema = z.object({
  user: UserWithPreferencesSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

// ===============================================
// FILE UPLOAD SCHEMAS
// ===============================================

/**
 * 파일 업로드 메타데이터 스키마
 */
export const FileUploadMetadataSchema = z.object({
  originalName: z.string(),
  filename: z.string(),
  size: z.number().int().min(0),
  mimeType: z.string(),
  width: z.number().int().min(0).optional(),
  height: z.number().int().min(0).optional(),
  duration: z.number().min(0).optional(),
});

/**
 * 파일 업로드 응답 스키마
 */
export const FileUploadResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  metadata: FileUploadMetadataSchema,
  createdAt: z.string().datetime(),
});

/**
 * 비디오 업로드 요청 검증 스키마
 */
export const VideoUploadValidationSchema = z.object({
  file: z.object({
    name: z.string().min(1, '파일명이 필요합니다'),
    size: z.number()
      .int()
      .min(1, '파일 크기가 0보다 커야 합니다')
      .max(600 * 1024 * 1024, '파일 크기가 600MB를 초과할 수 없습니다'),
    type: z.string().refine(
      (type) => [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/avi',
        'video/x-msvideo',
        'video/3gpp',
        'video/x-ms-wmv'
      ].includes(type),
      '지원되지 않는 비디오 형식입니다'
    ),
  }),
});

/**
 * 비디오 업로드 응답 스키마
 */
export const VideoUploadResponseSchema = z.object({
  ok: z.boolean(),
  uploadId: z.string().uuid(),
  uploadUrl: z.string().url(),
  videoUrl: z.string().url(),
  fileName: z.string(),
  originalFileName: z.string(),
  fileSize: z.number().int().min(0),
  fileType: z.string(),
  uploadSession: z.object({
    uploadId: z.string().uuid(),
    originalFileName: z.string(),
    sanitizedFileName: z.string(),
    fileSize: z.number().int().min(0),
    fileType: z.string(),
    status: z.enum(['pending', 'uploading', 'completed', 'failed']),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  }),
  instructions: z.object({
    message: z.string(),
    maxRetries: z.number().int().min(1),
    chunkSize: z.string(),
    timeout: z.number().int().min(1),
  }),
});

// ===============================================
// QUERY PARAMETER SCHEMAS
// ===============================================

/**
 * 페이지네이션 쿼리 파라미터 스키마
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * 검색 쿼리 파라미터 스키마
 */
export const SearchQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * 필터 쿼리 파라미터 스키마
 */
export const FilterQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * 통합 쿼리 파라미터 스키마
 */
export const CombinedQuerySchema = PaginationQuerySchema
  .merge(SearchQuerySchema)
  .merge(FilterQuerySchema);

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

/**
 * Zod 검증 결과를 Next.js 응답으로 변환하는 유틸리티
 */
export function createValidationErrorResponse(error: z.ZodError) {
  const validationErrors = error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: (err as any).received,
  }));

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: '요청 데이터가 유효하지 않습니다',
      validationErrors
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 성공 응답을 생성하는 유틸리티
 */
export function createSuccessResponse<T>(
  data: T, 
  message?: string,
  additionalFields?: Record<string, any>
) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    ...additionalFields,
  };
}

/**
 * 에러 응답을 생성하는 유틸리티
 */
export function createErrorResponse(
  errorCode: string,
  message?: string,
  details?: Record<string, any>
) {
  return {
    success: false,
    error: {
      code: errorCode,
      message: message || errorCode,
      details
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * 페이지네이션된 성공 응답을 생성하는 유틸리티
 */
export function createPaginatedSuccessResponse<T>(
  data: T[],
  pagination: z.infer<typeof PaginationSchema>,
  message?: string
) {
  return {
    success: true,
    data,
    pagination,
    message,
    timestamp: new Date().toISOString(),
  };
}

// ===============================================
// PLANNING/CONTENT REGISTRATION SCHEMAS
// ===============================================

/**
 * Planning 등록 요청 스키마
 */
export const PlanningRegistrationRequestSchema = z.object({
  type: z.enum(['scenario', 'prompt', 'video']),
  projectId: z.string().min(1, 'Project ID가 필요합니다'),
  source: z.string(),
  createdAt: z.string().datetime(),
  
  // Scenario fields
  title: z.string().optional(),
  story: z.string().optional(),
  genre: z.string().optional(),
  tone: z.string().optional(),
  target: z.string().optional(),
  format: z.string().optional(),
  tempo: z.string().optional(),
  developmentMethod: z.string().optional(),
  developmentIntensity: z.string().optional(),
  durationSec: z.number().int().min(1).optional(),
  
  // Prompt fields
  scenarioTitle: z.string().optional(),
  finalPrompt: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  negativePrompt: z.string().optional(),
  visualStyle: z.string().optional(),
  mood: z.string().optional(),
  quality: z.string().optional(),
  directorStyle: z.string().optional(),
  
  // Video fields
  provider: z.string().optional(),
  jobId: z.string().optional(),
  operationId: z.string().optional(),
  videoUrl: z.string().url().optional(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
  refPromptTitle: z.string().optional(),
});

/**
 * Planning 등록 응답 스키마
 */
export const PlanningRegistrationResponseSchema = z.object({
  success: z.boolean(),
  id: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.any()),
});

// ===============================================
// TYPE EXPORTS
// ===============================================

export type ApiResponse<T = any> = z.infer<ReturnType<typeof createApiResponseSchema<z.ZodType<T>>>>;
export type PaginatedResponse<T = any> = z.infer<ReturnType<typeof createPaginatedResponseSchema<z.ZodType<T>>>>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;
export type VideoUploadResponse = z.infer<typeof VideoUploadResponseSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type FilterQuery = z.infer<typeof FilterQuerySchema>;
export type CombinedQuery = z.infer<typeof CombinedQuerySchema>;
export type PlanningRegistrationRequest = z.infer<typeof PlanningRegistrationRequestSchema>;
export type PlanningRegistrationResponse = z.infer<typeof PlanningRegistrationResponseSchema>;