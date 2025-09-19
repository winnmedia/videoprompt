/**
 * 이중 저장 시스템 데이터 계약 스키마
 *
 * 목적: Prisma ↔ Supabase 간 안전한 데이터 변환 및 동기화
 * 책임: 스키마 매핑, 타입 안전성, 런타임 검증
 */

import { z } from 'zod';

// ============================================================================
// Prisma Project 스키마 (Source)
// ============================================================================

export const PrismaProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.any()).default({}),
  status: z.enum(['draft', 'active', 'completed', 'archived', 'failed']),
  userId: z.string(),
  tags: z.array(z.string()).default([]),
  scenario: z.string().nullable(),
  prompt: z.string().nullable(),
  video: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PrismaProjectData = z.infer<typeof PrismaProjectSchema>;

// ============================================================================
// Supabase 타겟 스키마들 (Target)
// ============================================================================

// Supabase Stories 테이블
export const SupabaseStorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  genre: z.string().optional(),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  structure: z.record(z.string(), z.any()).default({}),
  metadata: z.record(z.string(), z.any()).default({}),
  status: z.enum(['draft', 'active', 'completed', 'archived']),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SupabaseStoryData = z.infer<typeof SupabaseStorySchema>;

// Supabase Scenarios 테이블 (새로 추가 필요)
export const SupabaseScenarioSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  structure: z.record(z.string(), z.any()).default({}),
  metadata: z.record(z.string(), z.any()).default({}),
  status: z.enum(['draft', 'active', 'completed', 'archived']),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SupabaseScenarioData = z.infer<typeof SupabaseScenarioSchema>;

// Supabase Prompts 테이블 (새로 추가 필요)
export const SupabasePromptSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  final_prompt: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  negative_prompt: z.string().optional(),
  visual_style: z.string().optional(),
  mood: z.string().optional(),
  quality: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  scenario_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SupabasePromptData = z.infer<typeof SupabasePromptSchema>;

// Supabase Video Generations 테이블 (새로 추가 필요)
export const SupabaseVideoGenerationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  prompt: z.string().min(1),
  provider: z.enum(['seedance', 'openai', 'runways', 'luma', 'stable_video']),
  duration: z.number().positive().optional(),
  aspect_ratio: z.string().optional(),
  codec: z.string().default('H.264'),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  ref_prompt_title: z.string().optional(),
  job_id: z.string().optional(),
  operation_id: z.string().optional(),
  completed_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SupabaseVideoGenerationData = z.infer<typeof SupabaseVideoGenerationSchema>;

// ============================================================================
// 변환 결과 스키마
// ============================================================================

export const DualStorageResultSchema = z.object({
  success: z.boolean(),
  prismaResult: z.object({
    saved: z.boolean(),
    id: z.string().optional(),
    error: z.string().optional(),
  }),
  supabaseResult: z.object({
    saved: z.boolean(),
    tables: z.object({
      story: z.boolean().default(false),
      scenario: z.boolean().default(false),
      prompt: z.boolean().default(false),
      videoGeneration: z.boolean().default(false),
    }),
    error: z.string().optional(),
  }),
  rollbackExecuted: z.boolean().default(false),
  timestamp: z.string().datetime(),
  latencyMs: z.number().nonnegative(),
});

export type DualStorageResult = z.infer<typeof DualStorageResultSchema>;

// ============================================================================
// 데이터 품질 검증 스키마
// ============================================================================

export const DataQualityReportSchema = z.object({
  isConsistent: z.boolean(),
  score: z.number().min(0).max(100), // 데이터 품질 점수 0-100
  violations: z.array(z.object({
    field: z.string(),
    issue: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    prismaValue: z.any().optional(),
    supabaseValue: z.any().optional(),
  })),
  metrics: z.object({
    consistency: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(100),
    timeliness: z.number().min(0).max(100),
  }),
  timestamp: z.string().datetime(),
});

export type DataQualityReport = z.infer<typeof DataQualityReportSchema>;

// ============================================================================
// 환경별 저장 전략 스키마
// ============================================================================

export const StorageStrategySchema = z.object({
  environment: z.enum(['production', 'staging', 'development', 'test']),
  strategy: z.enum([
    'dual_storage_required',    // 이중 저장 필수 (실패 시 오류)
    'dual_storage_preferred',   // 이중 저장 선호 (실패 시 경고)
    'prisma_only_fallback',     // Prisma만 허용 (Supabase 없어도 OK)
    'mock_supabase',           // Supabase 모킹
  ]),
  fallbackEnabled: z.boolean(),
  retryAttempts: z.number().min(0).max(5),
  timeoutMs: z.number().positive(),
});

export type StorageStrategy = z.infer<typeof StorageStrategySchema>;

// ============================================================================
// 에러 타입 정의
// ============================================================================

export class DualStorageError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string;
      prismaResult?: any;
      supabaseResult?: any;
      violations?: string[];
    }
  ) {
    super(message);
    this.name = 'DualStorageError';
  }
}

export class DataConsistencyError extends Error {
  constructor(
    message: string,
    public readonly violations: string[],
    public readonly qualityScore: number
  ) {
    super(message);
    this.name = 'DataConsistencyError';
  }
}

export class StorageStrategyError extends Error {
  constructor(
    message: string,
    public readonly strategy: string,
    public readonly environment: string
  ) {
    super(message);
    this.name = 'StorageStrategyError';
  }
}

// ============================================================================
// 유틸리티 함수들
// ============================================================================

/**
 * UUID 생성 (Supabase 호환)
 */
export function generateSupabaseId(): string {
  return crypto.randomUUID();
}

/**
 * 현재 타임스탬프 (ISO string)
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Prisma Project 타입 감지
 */
export function detectProjectType(project: PrismaProjectData): 'story' | 'scenario' | 'prompt' | 'video' | 'unknown' {
  const metadata = project.metadata || {};

  // 1. metadata.type이 있으면 우선 사용
  if (metadata.type && typeof metadata.type === 'string') {
    const type = metadata.type.toLowerCase();
    if (['story', 'scenario', 'prompt', 'video'].includes(type)) {
      return type as 'story' | 'scenario' | 'prompt' | 'video';
    }
  }

  // 2. tags 배열에서 감지
  if (project.tags && Array.isArray(project.tags)) {
    if (project.tags.includes('scenario')) return 'scenario';
    if (project.tags.includes('prompt')) return 'prompt';
    if (project.tags.includes('video')) return 'video';
    if (project.tags.includes('story')) return 'story';
  }

  // 3. 필드 내용으로 추론
  if (project.scenario) return 'scenario';
  if (project.prompt) return 'prompt';
  if (project.video) return 'video';

  return 'unknown';
}

/**
 * 데이터 품질 점수 계산
 */
export function calculateQualityScore(violations: Array<{ severity: string }>): number {
  if (violations.length === 0) return 100;

  let deduction = 0;
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'critical': deduction += 30; break;
      case 'warning': deduction += 10; break;
      case 'info': deduction += 2; break;
    }
  });

  return Math.max(0, 100 - deduction);
}