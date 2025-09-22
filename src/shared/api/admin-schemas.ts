/**
 * Admin API Schemas
 *
 * 관리자 API 요청/응답 스키마 정의
 * CLAUDE.md 준수: Zod 런타임 검증, 타입 안전성
 */

import { z } from 'zod';

// ===========================================
// 공통 스키마
// ===========================================

const DateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).optional();

const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const SortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc'),
}).optional();

// ===========================================
// 메트릭 API 스키마
// ===========================================

export const AdminMetricsQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  includeDetails: z.boolean().default(false),
});

export type AdminMetricsQuery = z.infer<typeof AdminMetricsQuerySchema>;

// ===========================================
// Health Check API 스키마
// ===========================================

export const HealthCheckQuerySchema = z.object({
  providers: z.array(z.enum(['seedance', 'veo', 'imagen', 'runway'])).optional(),
  includeMetrics: z.boolean().default(true),
  timeout: z.number().int().min(1000).max(10000).default(5000),
});

export type HealthCheckQuery = z.infer<typeof HealthCheckQuerySchema>;

// ===========================================
// 사용자 관리 API 스키마
// ===========================================

export const UserSearchQuerySchema = z.object({
  ...PaginationSchema.shape,
  keyword: z.string().optional(),
  status: z.array(z.enum(['active', 'suspended', 'pending'])).optional(),
  role: z.array(z.enum(['user', 'admin', 'super_admin'])).optional(),
  dateRange: DateRangeSchema,
  sort: SortSchema,
  includeMetrics: z.boolean().default(false),
});

export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;

export const UserUpdateRequestSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  notes: z.string().max(500).optional(),
});

export type UserUpdateRequest = z.infer<typeof UserUpdateRequestSchema>;

// ===========================================
// 프로젝트 관리 API 스키마
// ===========================================

export const ProjectSearchQuerySchema = z.object({
  ...PaginationSchema.shape,
  keyword: z.string().optional(),
  status: z.array(z.enum(['active', 'archived', 'deleted'])).optional(),
  owner: z.string().optional(), // user ID
  dateRange: DateRangeSchema,
  sort: SortSchema,
  includeMetrics: z.boolean().default(false),
});

export type ProjectSearchQuery = z.infer<typeof ProjectSearchQuerySchema>;

// ===========================================
// 비디오 에셋 관리 API 스키마
// ===========================================

export const VideoAssetSearchQuerySchema = z.object({
  ...PaginationSchema.shape,
  keyword: z.string().optional(),
  status: z.array(z.enum(['queued', 'processing', 'completed', 'failed'])).optional(),
  provider: z.array(z.enum(['seedance', 'veo', 'imagen', 'runway'])).optional(),
  owner: z.string().optional(), // user ID
  project: z.string().optional(), // project ID
  dateRange: DateRangeSchema,
  sort: SortSchema,
  includeErrorDetails: z.boolean().default(false),
});

export type VideoAssetSearchQuery = z.infer<typeof VideoAssetSearchQuerySchema>;

// ===========================================
// 관리자 액션 API 스키마
// ===========================================

export const AdminActionRequestSchema = z.object({
  action: z.enum(['video_retry', 'token_expire', 'comment_delete', 'user_suspend', 'project_archive']),
  targetId: z.string(),
  targetType: z.enum(['user', 'project', 'video', 'comment', 'token']),
  reason: z.string().max(500).optional(),
});

export type AdminActionRequest = z.infer<typeof AdminActionRequestSchema>;

export const VideoRetryRequestSchema = z.object({
  videoId: z.string(),
  provider: z.enum(['seedance', 'veo', 'imagen', 'runway']).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  reason: z.string().max(500).optional(),
});

export type VideoRetryRequest = z.infer<typeof VideoRetryRequestSchema>;

export const TokenExpireRequestSchema = z.object({
  tokenId: z.string(),
  reason: z.string().max(500).optional(),
});

export type TokenExpireRequest = z.infer<typeof TokenExpireRequestSchema>;

export const CommentDeleteRequestSchema = z.object({
  commentId: z.string(),
  reason: z.string().max(500),
  deleteReplies: z.boolean().default(false),
});

export type CommentDeleteRequest = z.infer<typeof CommentDeleteRequestSchema>;

export const UserSuspendRequestSchema = z.object({
  userId: z.string(),
  duration: z.enum(['1d', '7d', '30d', 'permanent']),
  reason: z.string().max(500),
  notifyUser: z.boolean().default(true),
});

export type UserSuspendRequest = z.infer<typeof UserSuspendRequestSchema>;

export const ProjectArchiveRequestSchema = z.object({
  projectId: z.string(),
  reason: z.string().max(500).optional(),
  notifyOwner: z.boolean().default(true),
});

export type ProjectArchiveRequest = z.infer<typeof ProjectArchiveRequestSchema>;

// ===========================================
// 에러 로그 API 스키마
// ===========================================

export const ErrorLogQuerySchema = z.object({
  ...PaginationSchema.shape,
  level: z.array(z.enum(['error', 'warn', 'info'])).optional(),
  component: z.string().optional(),
  dateRange: DateRangeSchema,
  sort: SortSchema,
  aggregateBy: z.enum(['none', 'component', 'code', 'hour']).default('none'),
});

export type ErrorLogQuery = z.infer<typeof ErrorLogQuerySchema>;

// ===========================================
// 감사 로그 API 스키마
// ===========================================

export const AuditLogQuerySchema = z.object({
  ...PaginationSchema.shape,
  eventType: z.array(z.enum(['admin_action', 'login', 'data_access', 'security_event'])).optional(),
  actor: z.string().optional(), // admin user ID
  resource: z.string().optional(), // resource ID
  dateRange: DateRangeSchema,
  sort: SortSchema,
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

// ===========================================
// 시스템 통계 API 스키마
// ===========================================

export const SystemStatsQuerySchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  granularity: z.enum(['minute', 'hour', 'day']).default('hour'),
  metrics: z.array(z.enum([
    'api_calls',
    'error_rate',
    'response_time',
    'active_users',
    'video_generation',
    'storage_usage',
    'cost_tracking'
  ])).optional(),
});

export type SystemStatsQuery = z.infer<typeof SystemStatsQuerySchema>;

// ===========================================
// 캐시 관리 API 스키마
// ===========================================

export const CacheOperationRequestSchema = z.object({
  operation: z.enum(['clear', 'refresh', 'get_info']),
  pattern: z.string().optional(), // Redis 패턴 매칭용
  keys: z.array(z.string()).optional(), // 특정 키들
});

export type CacheOperationRequest = z.infer<typeof CacheOperationRequestSchema>;

// ===========================================
// 백업 관리 API 스키마
// ===========================================

export const BackupRequestSchema = z.object({
  type: z.enum(['full', 'incremental', 'schema_only']),
  tables: z.array(z.string()).optional(), // 특정 테이블만 백업
  compression: z.boolean().default(true),
  encryptionKey: z.string().optional(),
});

export type BackupRequest = z.infer<typeof BackupRequestSchema>;

// ===========================================
// 알림 관리 API 스키마
// ===========================================

export const NotificationRequestSchema = z.object({
  type: z.enum(['system', 'maintenance', 'security']),
  title: z.string().max(100),
  message: z.string().max(500),
  targets: z.object({
    userIds: z.array(z.string()).optional(),
    roles: z.array(z.enum(['user', 'admin', 'super_admin'])).optional(),
    all: z.boolean().default(false),
  }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scheduledAt: z.string().datetime().optional(),
});

export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;

// ===========================================
// 설정 관리 API 스키마
// ===========================================

export const SystemConfigUpdateSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.object({})]),
  category: z.enum(['api', 'security', 'performance', 'feature_flags', 'integrations']),
  description: z.string().max(200).optional(),
  requiresRestart: z.boolean().default(false),
});

export type SystemConfigUpdate = z.infer<typeof SystemConfigUpdateSchema>;

// ===========================================
// 응답 유효성 검증 스키마
// ===========================================

export const AdminResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }).optional(),
  message: z.string().optional(),
  timestamp: z.date(),
});

export type AdminResponse = z.infer<typeof AdminResponseSchema>;