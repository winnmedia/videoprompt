/**
 * 환경변수 검증 시스템
 *
 * 기능:
 * - Zod를 통한 런타임 스키마 검증
 * - 필수 환경변수 검증
 * - 보안 기본값 제공
 * - 환경별 검증 규칙
 * - 프로덕션 보안 검증
 */

import { z } from 'zod';

const envSchema = z.object({
  // Node.js 환경
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // 데이터베이스 (개발 환경에서는 선택적)
  DATABASE_URL: z
    .string()
    .optional()
    .default('postgresql://dev:dev@localhost:5432/videoprompter_dev')
    .refine(
      (url) => !url || url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL은 PostgreSQL 연결 문자열이어야 합니다'
    ),

  // NextAuth.js (개발 환경에서는 기본값 제공)
  NEXTAUTH_SECRET: z
    .string()
    .optional()
    .default('dev-secret-32chars-min-length123456')
    .refine((secret) => secret.length >= 32, 'NEXTAUTH_SECRET은 최소 32자 이상이어야 합니다')
    .superRefine((secret, ctx) => {
      const env = process.env.NODE_ENV || 'development';
      if (env === 'production' && secret === 'dev-secret-32chars-min-length123456') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '프로덕션 환경에서는 개발용 기본 시크릿을 사용할 수 없습니다',
        });
      }
      if (env === 'production') {
        // 프로덕션에서는 더 강한 시크릿 요구
        const hasNumbers = /\d/.test(secret);
        const hasLowercase = /[a-z]/.test(secret);
        const hasUppercase = /[A-Z]/.test(secret);
        const hasSpecialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(secret);
        const isStrong = hasNumbers && hasLowercase && hasUppercase && hasSpecialChars;

        if (!isStrong) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '프로덕션 환경에서는 숫자, 대소문자, 특수문자를 포함한 강력한 시크릿이 필요합니다',
          });
        }
      }
    }),

  NEXTAUTH_URL: z
    .string()
    .optional()
    .default('http://localhost:3000')
    .refine((url) => !url || /^https?:\/\/.+/.test(url), 'NEXTAUTH_URL은 유효한 URL이어야 합니다')
    .superRefine((url, ctx) => {
      const env = process.env.NODE_ENV || 'development';
      if (env === 'production' && url === 'http://localhost:3000') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '프로덕션 환경에서는 개발용 기본 URL을 사용할 수 없습니다',
        });
      }
      if (env === 'production' && !url.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '프로덕션 환경에서는 HTTPS URL이 필수입니다',
        });
      }
    }),

  // Supabase
  SUPABASE_URL: z
    .string()
    .url('SUPABASE_URL은 유효한 URL이어야 합니다')
    .refine(
      (url) => url.includes('supabase.co') || url.includes('localhost'),
      'SUPABASE_URL은 유효한 Supabase URL이어야 합니다'
    ),

  SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'SUPABASE_ANON_KEY는 필수입니다'),

  // API 제한 설정 (비용 안전)
  API_RATE_LIMIT: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 30)
    .pipe(
      z.number()
        .int('API_RATE_LIMIT은 정수여야 합니다')
        .min(1, 'API_RATE_LIMIT은 1 이상이어야 합니다')
        .max(100, 'API_RATE_LIMIT은 100 이하여야 합니다')
    ),

  API_HOURLY_LIMIT: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 300)
    .pipe(
      z.number()
        .int('API_HOURLY_LIMIT은 정수여야 합니다')
        .min(1, 'API_HOURLY_LIMIT은 1 이상이어야 합니다')
        .max(1000, 'API_HOURLY_LIMIT은 1000 이하여야 합니다')
    ),

  API_COST_THRESHOLD: z
    .string()
    .optional()
    .transform((val) => val ? parseFloat(val) : 50)
    .pipe(
      z.number()
        .min(1, 'API_COST_THRESHOLD는 1 이상이어야 합니다')
        .max(1000, 'API_COST_THRESHOLD는 1000 이하여야 합니다')
    ),

  // 디버그 설정
  DEBUG: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .pipe(z.boolean()),

  // 로그 레벨
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info'),

  // 외부 서비스 (선택사항)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z
    .string()
    .optional()
    .refine(
      (key) => !key || key.startsWith('AIza'),
      'GEMINI_API_KEY는 유효한 Google AI 키 형식이어야 합니다 (AIza로 시작)'
    ),

  // ByteDance Seedream API
  SEEDREAM_API_KEY: z
    .string()
    .optional()
    .refine(
      (key) => !key || key.length >= 32,
      'SEEDREAM_API_KEY는 최소 32자 이상이어야 합니다'
    ),

  SEEDREAM_API_URL: z
    .string()
    .optional()
    .default('https://api.seedream.bytedance.com/v1')
    .refine(
      (url) => !url || url.startsWith('https://'),
      'SEEDREAM_API_URL은 HTTPS URL이어야 합니다'
    ),

  // 시나리오 기획 관련 설정
  SCENARIO_GENERATION_TIMEOUT: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 60000)
    .pipe(
      z.number()
        .int('SCENARIO_GENERATION_TIMEOUT은 정수여야 합니다')
        .min(5000, 'SCENARIO_GENERATION_TIMEOUT은 5초 이상이어야 합니다')
        .max(300000, 'SCENARIO_GENERATION_TIMEOUT은 5분 이하여야 합니다')
    ),

  STORY_CACHE_TTL: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 3600)
    .pipe(
      z.number()
        .int('STORY_CACHE_TTL은 정수여야 합니다')
        .min(60, 'STORY_CACHE_TTL은 1분 이상이어야 합니다')
        .max(86400, 'STORY_CACHE_TTL은 24시간 이하여야 합니다')
    ),

  MAX_STORY_LENGTH: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 5000)
    .pipe(
      z.number()
        .int('MAX_STORY_LENGTH는 정수여야 합니다')
        .min(100, 'MAX_STORY_LENGTH는 100자 이상이어야 합니다')
        .max(50000, 'MAX_STORY_LENGTH는 50000자 이하여야 합니다')
    ),

  MAX_SCENES_PER_STORY: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 20)
    .pipe(
      z.number()
        .int('MAX_SCENES_PER_STORY는 정수여야 합니다')
        .min(1, 'MAX_SCENES_PER_STORY는 1 이상이어야 합니다')
        .max(100, 'MAX_SCENES_PER_STORY는 100 이하여야 합니다')
    ),
});

type EnvConfig = z.infer<typeof envSchema>;

export class EnvValidator {
  private static validated: EnvConfig | null = null;

  /**
   * 환경변수 검증 실행
   */
  static validate(): { success: true; data: EnvConfig } | { success: false; error: z.ZodError } {
    if (this.validated) {
      return { success: true, data: this.validated };
    }

    try {
      const result = envSchema.safeParse(process.env);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // 보안 경고 출력
      this.performSecurityChecks(result.data);

      this.validated = result.data;
      return { success: true, data: result.data };
    } catch (error) {
      throw new Error(`환경변수 검증 중 예기치 못한 오류: ${error}`);
    }
  }

  /**
   * 검증된 환경변수 반환 (자동으로 validate 호출)
   */
  static getValidatedEnv(): EnvConfig {
    if (!this.validated) {
      const result = this.validate();
      if (!result.success) {
        // 개발 환경에서는 기본값으로 진행, 프로덕션에서는 에러
        if (process.env.NODE_ENV === 'production') {
          throw new Error('환경변수 검증에 실패했습니다.');
        }
        // 개발 환경에서는 기본값 반환
        console.warn('⚠️ 환경변수 검증 실패 - 개발 기본값 사용');
        this.validated = this.getDefaultConfig();
      } else {
        this.validated = result.data;
      }
    }
    return this.validated!;
  }

  /**
   * 개발 환경 기본 설정 반환
   */
  private static getDefaultConfig(): EnvConfig {
    return {
      NODE_ENV: 'development' as const,
      DATABASE_URL: 'postgresql://dev:dev@localhost:5432/videoprompter_dev',
      NEXTAUTH_SECRET: 'dev-secret-32chars-min-length123456',
      NEXTAUTH_URL: 'http://localhost:3000',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dev-key',
      API_RATE_LIMIT: 30,
      API_HOURLY_LIMIT: 300,
      API_COST_THRESHOLD: 50,
      DEBUG: false,
      LOG_LEVEL: 'info' as const,
      SCENARIO_GENERATION_TIMEOUT: 60000,
      STORY_CACHE_TTL: 3600,
      MAX_STORY_LENGTH: 5000,
      MAX_SCENES_PER_STORY: 20
    };
  }

  /**
   * 보안 검사 수행
   */
  private static performSecurityChecks(config: EnvConfig): void {
    // 프로덕션에서 DEBUG 활성화 경고
    if (config.NODE_ENV === 'production' && config.DEBUG) {
      console.warn(
        '⚠️  보안 경고: 프로덕션 환경에서 DEBUG가 활성화되어 있습니다. ' +
        '민감한 정보가 로그에 노출될 수 있습니다.'
      );
    }

    // 개발 환경에서 프로덕션 데이터베이스 사용 경고
    if (config.NODE_ENV === 'development' && config.DATABASE_URL.includes('prod')) {
      console.warn(
        '⚠️  경고: 개발 환경에서 프로덕션 데이터베이스를 사용하는 것 같습니다.'
      );
    }

    // API 키 설정 상태 확인
    const apiKeys = {
      OpenAI: config.OPENAI_API_KEY,
      Anthropic: config.ANTHROPIC_API_KEY,
      Runway: config.RUNWAY_API_KEY,
      Gemini: config.GEMINI_API_KEY,
      Seedream: config.SEEDREAM_API_KEY,
    };

    const missingKeys = Object.entries(apiKeys)
      .filter(([, key]) => !key)
      .map(([name]) => name);

    if (missingKeys.length > 0) {
      console.info(
        `ℹ️  선택적 API 키가 설정되지 않음: ${missingKeys.join(', ')}`
      );
    }
  }

  /**
   * 환경변수 검증 요약 출력
   */
  static printValidationSummary(): void {
    const config = this.getValidatedEnv();

    console.log('\n📋 환경변수 검증 결과:');
    console.log(`   환경: ${config.NODE_ENV}`);
    console.log(`   데이터베이스: ${config.DATABASE_URL.split('@')[1] || '설정됨'}`);
    console.log(`   인증 URL: ${config.NEXTAUTH_URL}`);
    console.log(`   API 제한: ${config.API_RATE_LIMIT}/분, ${config.API_HOURLY_LIMIT}/시간`);
    console.log(`   비용 임계값: $${config.API_COST_THRESHOLD}`);
    console.log(`   로그 레벨: ${config.LOG_LEVEL}`);
    console.log(`   디버그: ${config.DEBUG ? '활성화' : '비활성화'}`);
    console.log(`   시나리오 생성 타임아웃: ${config.SCENARIO_GENERATION_TIMEOUT}ms`);
    console.log(`   스토리 캐시 TTL: ${config.STORY_CACHE_TTL}초`);
    console.log(`   최대 스토리 길이: ${config.MAX_STORY_LENGTH}자`);
    console.log(`   최대 씬 수: ${config.MAX_SCENES_PER_STORY}개`);
  }

  /**
   * 환경변수 초기화 (테스트용)
   */
  static reset(): void {
    this.validated = null;
  }
}

// 타입 export
export type { EnvConfig };