/**
 * 🔧 환경변수 검증 및 초기화 시스템
 * FSD 경계 준수 및 Runtime Safety 보장
 *
 * 핵심 원칙:
 * - Fail Fast: 환경 문제 조기 감지
 * - Graceful Degradation: 부분 기능 제한으로 서비스 유지
 * - Type Safety: 환경변수 타입 검증
 * - Security: 민감 정보 마스킹
 */

import { z } from 'zod';
import { logger } from './logger';


// ============================================================================
// Environment Schema Definition
// ============================================================================

/**
 * 환경변수 스키마 정의 (Runtime 검증)
 */
const EnvironmentSchema = z.object({
  // Node.js 환경
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase 환경변수 (핵심)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL').optional(),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required').optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for full functionality').optional(),

  // JWT 시크릿 (레거시 지원)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),

  // 데이터베이스
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL').optional(),

  // 서비스 토글
  E2E_DEBUG: z.enum(['0', '1']).optional(),
  DISABLE_AUTH: z.enum(['0', '1']).optional(),

  // API 키들
  OPENAI_API_KEY: z.string().optional(),

  // 배포 환경
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL_URL: z.string().optional(),

  // 포트 설정
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').optional()
});

/**
 * 환경변수 타입 정의
 */
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * 환경 검증 결과
 */
export interface EnvironmentValidationResult {
  isValid: boolean;
  environment: Environment | null;
  errors: string[];
  warnings: string[];
  degradationMode: 'full' | 'degraded' | 'disabled';
  capabilities: {
    supabaseAuth: boolean;
    legacyAuth: boolean;
    database: boolean;
    fullAdmin: boolean;
  };
}

// ============================================================================
// Environment Validation Logic
// ============================================================================

/**
 * 환경변수 검증 및 capabilities 결정
 */
export function validateEnvironment(): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. 기본 환경변수 파싱
    const parseResult = EnvironmentSchema.safeParse(process.env);

    if (!parseResult.success) {
      const zodErrors = parseResult.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      errors.push(...zodErrors);
    }

    const env = parseResult.success ? parseResult.data : ({} as Environment);

    // 2. 환경별 필수 검증
    const isProduction = env.NODE_ENV === 'production';
    const isTest = env.NODE_ENV === 'test';

    // 3. Supabase 환경 검증
    const hasSupabaseUrl = !!env.SUPABASE_URL;
    const hasSupabaseAnonKey = !!env.SUPABASE_ANON_KEY;
    const hasSupabaseServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;

    // 4. 인증 시스템 검증
    const hasJwtSecret = !!env.JWT_SECRET;

    // 5. 프로덕션 환경 엄격 검증
    if (isProduction) {
      if (!hasSupabaseUrl) {
        errors.push('SUPABASE_URL is required in production');
      }
      if (!hasSupabaseAnonKey) {
        errors.push('SUPABASE_ANON_KEY is required in production');
      }
      if (!hasJwtSecret) {
        errors.push('JWT_SECRET is required in production');
      }
      if (!hasSupabaseServiceKey) {
        warnings.push('SUPABASE_SERVICE_ROLE_KEY missing - admin features will be limited');
      }
    }

    // 6. 개발 환경 권장사항
    if (!isProduction && !isTest) {
      if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
        warnings.push('Supabase configuration missing - using degraded mode');
      }
      if (!hasJwtSecret) {
        warnings.push('JWT_SECRET missing - legacy authentication disabled');
      }
    }

    // 7. Capabilities 결정
    const capabilities = {
      supabaseAuth: hasSupabaseUrl && hasSupabaseAnonKey,
      legacyAuth: hasJwtSecret,
      database: !!env.DATABASE_URL,
      fullAdmin: hasSupabaseServiceKey
    };

    // 8. Degradation Mode 결정
    let degradationMode: 'full' | 'degraded' | 'disabled';

    if (errors.length > 0) {
      degradationMode = 'disabled';
    } else if (!capabilities.supabaseAuth && !capabilities.legacyAuth) {
      degradationMode = 'disabled';
    } else if (capabilities.supabaseAuth && capabilities.fullAdmin) {
      degradationMode = 'full';
    } else {
      degradationMode = 'degraded';
    }

    // 9. 추가 경고사항
    if (degradationMode === 'degraded') {
      warnings.push(`System running in degraded mode - some features may be limited`);
    }

    if (degradationMode === 'disabled') {
      errors.push('Critical environment variables missing - authentication system disabled');
    }

    return {
      isValid: errors.length === 0,
      environment: parseResult.success ? env : null,
      errors,
      warnings,
      degradationMode,
      capabilities
    };

  } catch (error) {
    errors.push(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      isValid: false,
      environment: null,
      errors,
      warnings,
      degradationMode: 'disabled',
      capabilities: {
        supabaseAuth: false,
        legacyAuth: false,
        database: false,
        fullAdmin: false
      }
    };
  }
}

// ============================================================================
// Initialization and Startup Validation
// ============================================================================

/**
 * 시스템 시작 시 환경 검증 및 설정
 */
export function initializeEnvironment(): EnvironmentValidationResult {
  const result = validateEnvironment();

  // 로그 출력 (민감 정보 마스킹)
  logger.info('🔧 Environment Validation Result:');
  logger.info(`  Mode: ${result.environment?.NODE_ENV || 'unknown'}`);
  logger.info(`  Degradation: ${result.degradationMode}`);
  logger.info(`  Valid: ${result.isValid}`);

  // Capabilities 로그
  logger.info('🔐 Authentication Capabilities:');
  logger.info(`  Supabase Auth: ${result.capabilities.supabaseAuth ? '✅' : '❌'}`);
  logger.info(`  Legacy Auth: ${result.capabilities.legacyAuth ? '✅' : '❌'}`);
  logger.info(`  Database: ${result.capabilities.database ? '✅' : '❌'}`);
  logger.info(`  Full Admin: ${result.capabilities.fullAdmin ? '✅' : '❌'}`);

  // 경고사항 출력
  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // 에러 출력
  if (result.errors.length > 0) {
    console.error('🚨 Environment Errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  // 환경변수 디버그 정보 (개발환경에서만)
  if (result.environment?.NODE_ENV === 'development') {
    logger.info('🔍 Environment Debug Info:');
    logger.info(`  SUPABASE_URL: ${maskUrl(result.environment.SUPABASE_URL)}`);
    logger.info(`  SUPABASE_ANON_KEY: ${maskKey(result.environment.SUPABASE_ANON_KEY)}`);
    logger.info(`  SUPABASE_SERVICE_ROLE_KEY: ${maskKey(result.environment.SUPABASE_SERVICE_ROLE_KEY)}`);
    logger.info(`  JWT_SECRET: ${maskKey(result.environment.JWT_SECRET)}`);
    logger.info(`  DATABASE_URL: ${maskUrl(result.environment.DATABASE_URL)}`);
  }

  return result;
}

// ============================================================================
// Runtime Environment Access (Singleton Pattern)
// ============================================================================

let _cachedEnvironment: EnvironmentValidationResult | null = null;

/**
 * 캐시된 환경 정보 조회 (성능 최적화)
 */
export function getEnvironment(): EnvironmentValidationResult {
  if (!_cachedEnvironment) {
    _cachedEnvironment = initializeEnvironment();
  }
  return _cachedEnvironment;
}

/**
 * 환경 정보 강제 새로고침
 */
export function refreshEnvironment(): EnvironmentValidationResult {
  _cachedEnvironment = null;
  return getEnvironment();
}

/**
 * 특정 기능 사용 가능 여부 확인
 */
export function isCapabilityAvailable(capability: keyof EnvironmentValidationResult['capabilities']): boolean {
  const env = getEnvironment();
  return env.capabilities[capability];
}

/**
 * 환경 안전성 검사
 */
export function assertEnvironmentSafety(requiredCapabilities: Array<keyof EnvironmentValidationResult['capabilities']> = []): void {
  const env = getEnvironment();

  if (!env.isValid) {
    throw new Error(`Environment validation failed: ${env.errors.join(', ')}`);
  }

  for (const capability of requiredCapabilities) {
    if (!env.capabilities[capability]) {
      throw new Error(`Required capability '${capability}' is not available`);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * URL 마스킹 (보안)
 */
function maskUrl(url?: string): string {
  if (!url) return 'not set';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '443'}/*****`;
  } catch {
    return 'invalid URL';
  }
}

/**
 * API 키 마스킹 (보안)
 */
function maskKey(key?: string): string {
  if (!key) return 'not set';
  if (key.length < 8) return '*****';
  return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}

/**
 * 환경별 설정 조회
 */
export function getEnvironmentConfig() {
  const env = getEnvironment();

  return {
    isProduction: env.environment?.NODE_ENV === 'production',
    isDevelopment: env.environment?.NODE_ENV === 'development',
    isTest: env.environment?.NODE_ENV === 'test',
    degradationMode: env.degradationMode,
    capabilities: env.capabilities,
    hasValidSupabase: env.capabilities.supabaseAuth,
    hasValidJWT: env.capabilities.legacyAuth,
    hasDatabase: env.capabilities.database,
    hasFullAdmin: env.capabilities.fullAdmin
  };
}

// (타입은 상단에서 이미 export됨)
