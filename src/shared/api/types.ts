/**
 * API Types & Interfaces
 *
 * Supabase와 외부 API의 타입 정의
 * DTO와 도메인 모델 분리를 위한 인터페이스
 */

import { z } from 'zod';

// ===========================================
// 기본 타입 정의
// ===========================================

export type UserRole = 'admin' | 'user' | 'guest';
export type ProjectStatus = 'draft' | 'planning' | 'in_progress' | 'completed' | 'archived';
export type VideoGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type StoryType = 'advertisement' | 'education' | 'entertainment' | 'corporate' | 'social_media';
export type AssetType = 'image' | 'video' | 'audio' | 'template' | 'font';

// ===========================================
// DTO 스키마 (Zod를 통한 런타임 검증)
// ===========================================

// User DTO
export const UserDTOSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().optional(),
  role: z.enum(['admin', 'user', 'guest']),
  display_name: z.string().optional(),
  avatar_url: z.string().optional(),
  bio: z.string().optional(),
  api_calls_today: z.number().default(0),
  api_calls_this_month: z.number().default(0),
  storage_usage_bytes: z.number().default(0),
  preferences: z.record(z.any()).default({}),
  notification_settings: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(false),
  }).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_login_at: z.string().datetime().optional(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Project DTO
export const ProjectDTOSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'planning', 'in_progress', 'completed', 'archived']),
  thumbnail_url: z.string().optional(),
  settings: z.record(z.any()).default({}),
  brand_guidelines: z.record(z.any()).default({}),
  target_audience: z.string().optional(),
  duration_seconds: z.number().optional(),
  collaborators: z.array(z.string().uuid()).default([]),
  is_public: z.boolean().default(false),
  share_token: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Story DTO
export const StoryDTOSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  story_type: z.enum(['advertisement', 'education', 'entertainment', 'corporate', 'social_media']),
  tone_and_manner: z.string().optional(),
  target_audience: z.string().optional(),
  ai_model_used: z.string().optional(),
  prompt_used: z.string().optional(),
  generation_metadata: z.record(z.any()).default({}),
  structured_content: z.record(z.any()).default({}),
  keywords: z.array(z.string()).default([]),
  estimated_duration: z.number().optional(),
  version: z.number().default(1),
  parent_story_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Scenario DTO
export const ScenarioDTOSchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  scene_order: z.number(),
  duration_seconds: z.number().default(30),
  visual_description: z.string().optional(),
  audio_description: z.string().optional(),
  transition_type: z.string().default('fade'),
  transition_duration: z.number().default(1.0),
  image_prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  style_keywords: z.array(z.string()).default([]),
  technical_specs: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Video Generation DTO
export const VideoGenerationDTOSchema = z.object({
  id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  external_job_id: z.string().optional(),
  input_prompt: z.string(),
  input_image_url: z.string().optional(),
  generation_settings: z.record(z.any()).default({}),
  output_video_url: z.string().optional(),
  output_thumbnail_url: z.string().optional(),
  output_metadata: z.record(z.any()).default({}),
  progress_percentage: z.number().default(0),
  queue_position: z.number().optional(),
  estimated_completion_at: z.string().datetime().optional(),
  retry_count: z.number().default(0),
  max_retries: z.number().default(3),
  last_error_message: z.string().optional(),
  estimated_cost: z.number().optional(),
  actual_cost: z.number().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  failed_at: z.string().datetime().optional(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Prompt DTO
export const PromptDTOSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  title: z.string(),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()).default([]),
  is_template: z.boolean().default(false),
  is_public: z.boolean().default(false),
  usage_count: z.number().default(0),
  rating: z.number().default(0),
  variables: z.record(z.any()).default({}),
  style_presets: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// Asset DTO
export const AssetDTOSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  filename: z.string(),
  original_filename: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  asset_type: z.enum(['image', 'video', 'audio', 'template', 'font']),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  alt_text: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  duration_seconds: z.number().optional(),
  thumbnail_url: z.string().optional(),
  usage_count: z.number().default(0),
  last_used_at: z.string().datetime().optional(),
  cdn_url: z.string().optional(),
  optimized_urls: z.record(z.string()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

// ===========================================
// 타입 추론
// ===========================================

export type UserDTO = z.infer<typeof UserDTOSchema>;
export type ProjectDTO = z.infer<typeof ProjectDTOSchema>;
export type StoryDTO = z.infer<typeof StoryDTOSchema>;
export type ScenarioDTO = z.infer<typeof ScenarioDTOSchema>;
export type VideoGenerationDTO = z.infer<typeof VideoGenerationDTOSchema>;
export type PromptDTO = z.infer<typeof PromptDTOSchema>;
export type AssetDTO = z.infer<typeof AssetDTOSchema>;

// ===========================================
// API 응답 타입
// ===========================================

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  count?: number;
  status?: number;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===========================================
// 요청 타입
// ===========================================

export interface CreateProjectRequest {
  title: string;
  description?: string;
  target_audience?: string;
  duration_seconds?: number;
  settings?: Record<string, any>;
  brand_guidelines?: Record<string, any>;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  status?: ProjectStatus;
  thumbnail_url?: string;
  collaborators?: string[];
  is_public?: boolean;
}

export interface CreateStoryRequest {
  project_id: string;
  title: string;
  content: string;
  story_type: StoryType;
  tone_and_manner?: string;
  target_audience?: string;
  keywords?: string[];
}

export interface CreateScenarioRequest {
  story_id: string;
  project_id: string;
  title: string;
  description?: string;
  scene_order: number;
  duration_seconds?: number;
  visual_description?: string;
  image_prompt?: string;
  negative_prompt?: string;
  style_keywords?: string[];
}

export interface CreateVideoGenerationRequest {
  scenario_id: string;
  project_id: string;
  input_prompt: string;
  input_image_url?: string;
  generation_settings?: Record<string, any>;
}

// ===========================================
// 검색 및 필터 타입
// ===========================================

export interface SearchFilter {
  query?: string;
  category?: string;
  tags?: string[];
  user_id?: string;
  project_id?: string;
  status?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ===========================================
// 에러 타입
// ===========================================

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: any;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Permission denied') {
    super(message, 'PERMISSION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}