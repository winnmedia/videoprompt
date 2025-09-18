/**
 * 🔄 사용자 동기화 데이터 계약 및 스키마
 * VideoPlanet 프로젝트 - Prisma User ↔ Supabase Auth 동기화
 *
 * 목적:
 * - 런타임 데이터 계약 준수 확인
 * - 안전한 DTO 변환
 * - 데이터 품질 보증
 */

import { z } from 'zod';

/**
 * Supabase User DTO 스키마
 */
const SupabaseUserDTOSchema = z.object({
  id: z.string().uuid('유효한 UUID 형식이어야 합니다'),
  email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
  phone: z.string().optional(),
  email_confirmed_at: z.string().datetime().optional(),
  phone_confirmed_at: z.string().datetime().optional(),
  created_at: z.string().datetime('유효한 ISO 날짜 형식이어야 합니다'),
  updated_at: z.string().datetime().optional(),
  last_sign_in_at: z.string().datetime().optional(),
  user_metadata: z.object({
    username: z.string().optional(),
    full_name: z.string().optional(),
    avatar_url: z.string().url().optional(),
    role: z.enum(['admin', 'user', 'guest']).optional(),
    preferences: z.record(z.any()).optional()
  }).optional(),
  app_metadata: z.object({
    provider: z.string().optional(),
    providers: z.array(z.string()).optional(),
    role: z.string().optional()
  }).optional()
});

/**
 * Prisma User DTO 스키마
 */
const PrismaUserDTOSchema = z.object({
  id: z.string().uuid('유효한 UUID 형식이어야 합니다'),
  email: z.string().email('유효한 이메일 형식이어야 합니다').optional(),
  username: z.string().min(1, '사용자명은 필수입니다').optional(),
  fullName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  isEmailVerified: z.boolean().default(false),
  preferences: z.record(z.any()).optional(),
  lastSignInAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * 사용자 동기화 상태 스키마
 */
const UserSyncStatusSchema = z.object({
  userId: z.string().uuid(),
  supabaseExists: z.boolean(),
  prismaExists: z.boolean(),
  isInSync: z.boolean(),
  lastSyncAt: z.date().optional(),
  syncErrors: z.array(z.string()).default([]),
  dataQualityScore: z.number().min(0).max(100), // 0-100점
  recommendations: z.array(z.string()).default([])
});

/**
 * 동기화 결과 스키마
 */
const SyncResultSchema = z.object({
  success: z.boolean(),
  operation: z.enum(['create', 'update', 'skip', 'error']),
  userId: z.string().uuid(),
  changes: z.record(z.any()).optional(),
  errors: z.array(z.string()).default([]),
  qualityScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()).default([]),
  executionTime: z.number().positive(),
  timestamp: z.date()
});

/**
 * 마이그레이션 옵션 스키마
 */
const MigrationOptionsSchema = z.object({
  dryRun: z.boolean().default(false),
  batchSize: z.number().int().min(1).max(1000).default(100),
  createBackup: z.boolean().default(true),
  skipErrors: z.boolean().default(false),
  forceOverwrite: z.boolean().default(false),
  qualityThreshold: z.number().min(0).max(100).default(80),
  validateOnly: z.boolean().default(false)
});

/**
 * 사용자 데이터 품질 검증 스키마
 */
const UserDataQualitySchema = z.object({
  hasValidId: z.boolean(),
  hasValidEmail: z.boolean(),
  hasUsername: z.boolean(),
  isEmailVerified: z.boolean(),
  hasValidTimestamps: z.boolean(),
  hasConsistentData: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  recommendations: z.array(z.string())
});

/**
 * 사용자 데이터 품질 규칙 상수
 */
export const UserDataQualityRules = {
  requiredFields: ['id', 'email', 'username'] as const,
  uniqueConstraints: ['email', 'username'] as const,
  syncQualityThresholds: {
    healthy: 95,
    warning: 80,
    critical: 60
  } as const,
  validationRules: {
    emailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    usernameFormat: /^[a-zA-Z0-9_-]{3,30}$/,
    minScore: 60
  } as const
} as const;

/**
 * DTO 변환 함수들
 */

/**
 * Supabase User → Prisma User 변환
 */
export function transformSupabaseUserToPrisma(supabaseUser: z.infer<typeof SupabaseUserDTOSchema>): z.infer<typeof PrismaUserDTOSchema> {
  // Supabase DTO 검증
  const validatedSupabaseUser = SupabaseUserDTOSchema.parse(supabaseUser);

  const prismaUser = {
    id: validatedSupabaseUser.id,
    email: validatedSupabaseUser.email,
    username: validatedSupabaseUser.user_metadata?.username ||
              validatedSupabaseUser.email?.split('@')[0] ||
              `user_${validatedSupabaseUser.id.slice(0, 8)}`,
    fullName: validatedSupabaseUser.user_metadata?.full_name,
    avatarUrl: validatedSupabaseUser.user_metadata?.avatar_url,
    role: (validatedSupabaseUser.user_metadata?.role || validatedSupabaseUser.app_metadata?.role || 'user') as 'admin' | 'user' | 'guest',
    isEmailVerified: !!validatedSupabaseUser.email_confirmed_at,
    preferences: validatedSupabaseUser.user_metadata?.preferences,
    lastSignInAt: validatedSupabaseUser.last_sign_in_at ? new Date(validatedSupabaseUser.last_sign_in_at) : undefined,
    createdAt: new Date(validatedSupabaseUser.created_at),
    updatedAt: validatedSupabaseUser.updated_at ? new Date(validatedSupabaseUser.updated_at) : new Date()
  };

  // Prisma DTO 검증
  return PrismaUserDTOSchema.parse(prismaUser);
}

/**
 * Prisma User → Supabase User 변환 (제한적)
 */
export function transformPrismaUserToSupabase(prismaUser: z.infer<typeof PrismaUserDTOSchema>): Partial<z.infer<typeof SupabaseUserDTOSchema>> {
  // Prisma DTO 검증
  const validatedPrismaUser = PrismaUserDTOSchema.parse(prismaUser);

  return {
    id: validatedPrismaUser.id,
    email: validatedPrismaUser.email,
    user_metadata: {
      username: validatedPrismaUser.username,
      full_name: validatedPrismaUser.fullName,
      avatar_url: validatedPrismaUser.avatarUrl,
      role: validatedPrismaUser.role,
      preferences: validatedPrismaUser.preferences
    },
    created_at: validatedPrismaUser.createdAt.toISOString(),
    updated_at: validatedPrismaUser.updatedAt.toISOString(),
    last_sign_in_at: validatedPrismaUser.lastSignInAt?.toISOString()
  };
}

/**
 * 사용자 데이터 품질 평가
 */
export function validateUserDataQuality(userData: any): z.infer<typeof UserDataQualitySchema> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // 필수 필드 검증
  const hasValidId = userData.id && z.string().uuid().safeParse(userData.id).success;
  if (!hasValidId) {
    issues.push('유효하지 않은 사용자 ID');
    recommendations.push('UUID 형식의 사용자 ID가 필요합니다');
    score -= 30;
  }

  const hasValidEmail = userData.email && z.string().email().safeParse(userData.email).success;
  if (!hasValidEmail) {
    issues.push('유효하지 않은 이메일');
    recommendations.push('유효한 이메일 주소가 필요합니다');
    score -= 25;
  }

  const hasUsername = userData.username && userData.username.trim().length > 0;
  if (!hasUsername) {
    issues.push('사용자명 누락');
    recommendations.push('사용자명을 설정하세요');
    score -= 15;
  }

  const isEmailVerified = userData.isEmailVerified || userData.email_confirmed_at;
  if (!isEmailVerified) {
    issues.push('이메일 미인증');
    recommendations.push('이메일 인증을 완료하세요');
    score -= 10;
  }

  // 타임스탬프 검증
  const hasValidTimestamps = userData.createdAt || userData.created_at;
  if (!hasValidTimestamps) {
    issues.push('생성 시간 누락');
    recommendations.push('데이터 생성 시간이 필요합니다');
    score -= 10;
  }

  // 데이터 일관성 검증
  const hasConsistentData = !issues.some(issue =>
    issue.includes('불일치') || issue.includes('충돌')
  );

  if (score < 0) score = 0;

  const quality = {
    hasValidId,
    hasValidEmail,
    hasUsername,
    isEmailVerified,
    hasValidTimestamps,
    hasConsistentData,
    score,
    issues,
    recommendations
  };

  return UserDataQualitySchema.parse(quality);
}

/**
 * 데이터 계약 검증 함수
 */
export function validateUserSyncContract(
  operation: 'supabase-to-prisma' | 'prisma-to-supabase',
  sourceData: any,
  targetData: any
): { isValid: boolean; violations: string[]; score: number } {
  const violations: string[] = [];
  let score = 100;

  try {
    if (operation === 'supabase-to-prisma') {
      // Supabase → Prisma 계약 검증
      const validatedSource = SupabaseUserDTOSchema.parse(sourceData);
      const validatedTarget = PrismaUserDTOSchema.parse(targetData);

      // ID 일관성 확인
      if (validatedSource.id !== validatedTarget.id) {
        violations.push('사용자 ID 불일치');
        score -= 30;
      }

      // 이메일 일관성 확인
      if (validatedSource.email !== validatedTarget.email) {
        violations.push('이메일 불일치');
        score -= 20;
      }

      // 권한 일관성 확인
      const supabaseRole = validatedSource.user_metadata?.role || validatedSource.app_metadata?.role;
      if (supabaseRole && supabaseRole !== validatedTarget.role) {
        violations.push('권한 정보 불일치');
        score -= 15;
      }

    } else {
      // Prisma → Supabase 계약 검증
      const validatedSource = PrismaUserDTOSchema.parse(sourceData);
      const validatedTarget = SupabaseUserDTOSchema.partial().parse(targetData);

      // 기본 일관성 확인
      if (validatedSource.id !== validatedTarget.id) {
        violations.push('사용자 ID 불일치');
        score -= 30;
      }
    }

  } catch (error) {
    violations.push(`스키마 검증 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    score = 0;
  }

  return {
    isValid: violations.length === 0,
    violations,
    score: Math.max(0, score)
  };
}

// 타입 export - FSD 도메인 명명 규칙 적용
export type SupabaseUserDTO = z.infer<typeof SupabaseUserDTOSchema>;
export type PrismaUserDTO = z.infer<typeof PrismaUserDTOSchema>;
export type PrismaUserDomain = z.infer<typeof PrismaUserDTOSchema>; // 도메인 레이어 호환성
export type UserSyncStatus = z.infer<typeof UserSyncStatusSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type MigrationOptions = z.infer<typeof MigrationOptionsSchema>;
export type UserDataQuality = z.infer<typeof UserDataQualitySchema>;

// 스키마 export
export {
  SupabaseUserDTOSchema,
  PrismaUserDTOSchema,
  PrismaUserDTOSchema as PrismaUserDomainSchema, // 도메인 레이어 호환성 별명
  UserSyncStatusSchema,
  SyncResultSchema,
  MigrationOptionsSchema,
  UserDataQualitySchema
};