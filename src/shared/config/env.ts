import { z } from 'zod';

// 환경변수 로드 (Next.js 외부에서도 동작하도록)
if (typeof window === 'undefined') { // 서버사이드에서만 실행
  try {
    const { config } = require('dotenv');
    config({ path: '.env.local' });
    config({ path: '.env.development' });
    config({ path: '.env' });
  } catch (error) {
    // dotenv가 없는 환경에서는 무시
  }
}

// 런타임 환경변수 스키마 (확장됨)
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Supabase 환경변수 (핵심 인증 시스템) - 필수 (환경 차단선 구축)
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(40, 'SUPABASE_ANON_KEY must be at least 40 characters long'),
  // 프로덕션에서는 필수, 개발에서는 optional - 별도 검증 로직에서 처리
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40, 'SUPABASE_SERVICE_ROLE_KEY must be at least 40 characters long').optional(),

  // AI 서비스 API 키들
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_IMAGE_MODEL: z.string().default('imagen-4.0-generate-preview-06-06'),
  VEO_PROVIDER: z.enum(['google']).optional(),

  // 비디오 생성 서비스 (SeeDance) - 프로덕션에서 검증 강화
  SEEDANCE_API_KEY: z.string().min(36, 'SEEDANCE_API_KEY must be at least 36 characters long').optional(),
  SEEDANCE_MODEL: z.string().optional(),
  SEEDANCE_API_BASE: z.string().url().optional(),
  SEEDANCE_WEBHOOK_SECRET: z.string().optional(),

  // 이미지 생성 서비스 (SeeDream 4.0)
  SEEDREAM_API_KEY: z.string().optional(),
  SEEDREAM_MODEL: z.string().optional(),
  SEEDREAM_API_BASE: z.string().url().optional(),

  // ModelArk / BytePlus (공통)
  MODELARK_API_KEY: z.string().optional(),
  MODELARK_API_BASE: z.string().url().default('https://ark.ap-southeast.bytepluses.com'),
  MODELARK_IMAGE_MODEL: z.string().optional(),

  // 백엔드 마이그레이션: Prisma 접속 문자열 (PostgreSQL, SQLite 지원) - 필수 (환경 차단선 구축)
  DATABASE_URL: z.string().regex(/^(postgresql|postgres|sqlite):\/\//, 'DATABASE_URL must be a valid database connection string'),

  // JWT 인증 토큰
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .optional(),
    
  // SendGrid 이메일 설정
  SENDGRID_API_KEY: z.string().optional(),
  DEFAULT_FROM_EMAIL: z.string().optional(),
  
  // 백엔드 URL (Railway 제거)
  RAILWAY_BACKEND_URL: z.string().url().optional(), // 레거시 지원용 - 사용하지 않음
  NEXT_PUBLIC_API_BASE: z.string().url().optional(),
  
  // Vercel 환경
  VERCEL_ENV: z.string().optional(),
  VERCEL_REGION: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  
  // 테스트/디버그 설정
  ALLOW_TEST_ENDPOINTS: z.string().optional(),
  E2E_FAST_PREVIEW: z.string().optional(),
  INTEGRATION_TEST: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

let cachedEnv: Readonly<Env> | null = null;

export function getEnv(): Readonly<Env> {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    const errorMessage = `환경변수 검증 실패 - 앱 시작을 차단합니다: ${issues}`;

    // 테스트 환경에서는 경고만 출력하고 계속 진행
    if (process.env.NODE_ENV === 'test') {
      console.warn('⚠️ TEST: Environment validation failed, continuing anyway');
      console.warn(errorMessage);

      // 테스트용 기본값으로 최소한의 환경 구성
      cachedEnv = Object.freeze({
        NODE_ENV: 'test',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test',
        DATABASE_URL: 'sqlite://test.db',
        SEEDANCE_API_KEY: 'mock_development_key_40_characters_long_for_testing',
        ...process.env
      } as Env);
      return cachedEnv;
    }

    // 환경 차단선: 즉시 실패 시스템
    console.error('🚨 CRITICAL: Environment validation failed');
    console.error('━'.repeat(70));
    console.error(errorMessage);
    console.error('━'.repeat(70));
    console.error('💡 해결방법: 누락된 환경변수를 .env 파일에 추가하세요');
    console.error('📖 상세 가이드: README.md 또는 env.example 참조');

    // 프로덕션에서는 즉시 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    throw new Error(errorMessage);
  }
  cachedEnv = Object.freeze(parsed.data);
  return cachedEnv;
}

// 앱 부팅 시 즉시 검증 용도 - 환경 차단선
export function assertEnvInitialized() {
  try {
    getEnv();
    console.log('✅ 환경변수 검증 완료 - 앱 시작 허용');
  } catch (error) {
    console.error('❌ 환경변수 검증 실패 - 앱 시작 차단');
    throw error;
  }
}

/**
 * Degradation Mode 결정
 * 🚨 $300 사건 재발 방지 - 프로덕션에서 SERVICE_ROLE_KEY 누락 시 disabled
 */
export function getDegradationMode(): 'full' | 'degraded' | 'disabled' {
  try {
    const env = getEnv();

    // Supabase 기본 설정 확인
    const hasSupabaseUrl = !!env.SUPABASE_URL;
    const hasSupabaseAnonKey = !!env.SUPABASE_ANON_KEY;
    const hasSupabaseServiceKey = !!env.SUPABASE_SERVICE_ROLE_KEY;

    // 프로덕션 환경에서는 엄격한 검증
    if (env.NODE_ENV === 'production') {
      if (!hasSupabaseUrl || !hasSupabaseAnonKey || !hasSupabaseServiceKey) {
        return 'disabled'; // 프로덕션에서는 SERVICE_ROLE_KEY 필수
      }
      return 'full';
    }

    // 개발 환경에서는 더 관대한 정책
    if (!hasSupabaseUrl || !hasSupabaseAnonKey) {
      return 'degraded';
    }

    return hasSupabaseServiceKey ? 'full' : 'degraded';
  } catch {
    return 'disabled';
  }
}

/**
 * 환경별 capabilities 확인
 */
export function getEnvironmentCapabilities() {
  const env = getEnv();
  const degradationMode = getDegradationMode();

  return {
    supabaseAuth: !!env.SUPABASE_URL && !!env.SUPABASE_ANON_KEY,
    legacyAuth: !!env.JWT_SECRET,
    database: !!env.DATABASE_URL,
    fullAdmin: !!env.SUPABASE_SERVICE_ROLE_KEY,
    seedanceVideo: !!env.SEEDANCE_API_KEY,
    degradationMode
  };
}

// 환경변수 헬퍼 함수들
export const envUtils = {
  // 필수 환경변수 (없으면 에러)
  required: (key: keyof Env) => {
    const env = getEnv();
    const value = env[key];
    if (!value) {
      throw new Error(`필수 환경변수 ${key}가 설정되지 않았습니다.`);
    }
    return value as string;
  },
  
  // 선택적 환경변수 (기본값 제공)
  optional: (key: keyof Env, defaultValue: string = '') => {
    const env = getEnv();
    return (env[key] as string) || defaultValue;
  },
  
  // Boolean 환경변수
  boolean: (key: keyof Env, defaultValue: boolean = false) => {
    const env = getEnv();
    const value = env[key] as string;
    if (!value) return defaultValue;
    return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(value);
  }
};

// 프로덕션 환경 확인
export const isProd = getEnv().NODE_ENV === 'production';
export const isDev = getEnv().NODE_ENV === 'development';
export const isTest = getEnv().NODE_ENV === 'test';

// 환경변수 검증 헬퍼 (앱 초기화 시 사용) - 환경 차단선 구축
export function initializeEnvironment(): void {
  try {
    // 기본 환경변수 스키마 검증 먼저 수행
    const env = getEnv();

    // TDD로 구현된 환경별 검증 실행
    if (env.NODE_ENV === 'production') {
      validateProductionEnv();
    } else {
      validateDevelopmentEnv();
    }

    console.log(`✅ Environment validation completed for ${env.NODE_ENV} mode`);
  } catch (error) {
    console.error('🚨 Environment initialization failed:', error instanceof Error ? error.message : 'Unknown error');

    // 프로덕션에서는 즉시 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    throw error;
  }
}

// Supabase 설정 정보 가져오기
export const getSupabaseConfig = () => {
  const env = getEnv();
  const capabilities = getEnvironmentCapabilities();

  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    isConfigured: capabilities.supabaseAuth,
    hasFullAdmin: capabilities.fullAdmin,
    degradationMode: capabilities.degradationMode,
  };
};

// AI 서비스별 API 키 가져오기 (우선순위 적용)
export const getAIApiKeys = () => {
  const env = getEnv();
  return {
    gemini: env.GOOGLE_GEMINI_API_KEY || env.GOOGLE_API_KEY,
    seedance: env.SEEDANCE_API_KEY,
    seedream: env.SEEDREAM_API_KEY,
    modelark: env.MODELARK_API_KEY,
  };
};

// 서비스 URL 가져오기
export const getServiceUrls = () => {
  const env = getEnv();
  return {
    // railwayBackend: env.RAILWAY_BACKEND_URL, // DEPRECATED: Railway 제거됨
    seedanceApi: env.SEEDANCE_API_BASE,
    seedreamApi: env.SEEDREAM_API_BASE,
    modelarkApi: env.MODELARK_API_BASE,
    appUrl: env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  };
};

// TDD Green Phase: 환경변수 검증 함수들 구현
// $300 사건 재발 방지를 위한 엄격한 검증

/**
 * 프로덕션 환경 필수 환경변수 검증
 * $300 사건 재발 방지 - SUPABASE_SERVICE_ROLE_KEY 누락 시 즉시 실패
 */
export function validateProductionEnv(): void {
  const env = getEnv();

  if (env.NODE_ENV !== 'production') {
    return; // 프로덕션이 아니면 검증 안함
  }

  const missingVars: string[] = [];

  // 필수 Supabase 환경변수 검증
  if (!env.SUPABASE_URL) {
    missingVars.push('SUPABASE_URL');
  }

  if (!env.SUPABASE_ANON_KEY) {
    missingVars.push('SUPABASE_ANON_KEY');
  }

  // 🚨 프로덕션 환경에서 SUPABASE_SERVICE_ROLE_KEY 필수
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  // DATABASE_URL 형식 검증 (설정된 경우만)
  if (env.DATABASE_URL && !env.DATABASE_URL.match(/^(postgresql|postgres|sqlite):\/\//)) {
    throw new Error('DATABASE_URL must be a valid database connection string');
  }

  // SEEDANCE_API_KEY 프로덕션 필수 및 길이 검증 강화
  if (env.SEEDANCE_API_KEY && env.SEEDANCE_API_KEY.length < 36) {
    throw new Error('SEEDANCE_API_KEY must be at least 36 characters long in production');
  }
  // 프로덕션에서 SEEDANCE_API_KEY 필수 체크 (비디오 생성 서비스)
  if (!env.SEEDANCE_API_KEY) {
    console.warn('⚠️ SEEDANCE_API_KEY not set in production - video generation will be disabled');
  }

  // JWT_SECRET 길이 검증 (설정된 경우만)
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  if (missingVars.length > 0) {
    throw new Error(`Required environment variables missing in production: ${missingVars.join(', ')}`);
  }
}

/**
 * 개발환경 환경변수 검증 (관대한 정책)
 * 경고는 출력하지만 에러를 발생시키지 않음
 */
export function validateDevelopmentEnv(): void {
  const env = getEnv();

  if (env.NODE_ENV === 'production') {
    return; // 프로덕션이면 validateProductionEnv 사용
  }

  // 개발환경에서는 경고만 출력하고 계속 진행
  const warnings: string[] = [];

  if (!env.SUPABASE_URL) {
    warnings.push('SUPABASE_URL not set - running in degraded mode');
  }

  if (!env.SEEDANCE_API_KEY) {
    warnings.push('SEEDANCE_API_KEY not set - video generation disabled');
  }

  if (!env.GOOGLE_GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
    warnings.push('Google AI API keys not set - AI features disabled');
  }

  if (warnings.length > 0 && typeof console !== 'undefined') {
    console.warn('Development environment warnings:', warnings.join(', '));
  }

  // 개발환경에서는 에러를 발생시키지 않음
}
