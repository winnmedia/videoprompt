import { z } from 'zod';

// 런타임 환경변수 스키마 (확장됨)
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // AI 서비스 API 키들
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_IMAGE_MODEL: z.string().default('imagen-4.0-generate-preview-06-06'),
  VEO_PROVIDER: z.enum(['google']).optional(),
  
  // 비디오 생성 서비스
  SEEDANCE_API_KEY: z.string().optional(),
  SEEDANCE_MODEL: z.string().optional(),
  SEEDANCE_API_BASE: z.string().url().optional(),
  SEEDANCE_WEBHOOK_SECRET: z.string().optional(),
  
  // ModelArk / BytePlus
  MODELARK_API_KEY: z.string().optional(),
  MODELARK_API_BASE: z.string().url().default('https://api.byteplusapi.com'),
  
  // 백엔드 마이그레이션: Prisma 접속 문자열 (PostgreSQL, SQLite 지원)
  // 빌드 타임에는 optional, 런타임에 체크
  DATABASE_URL: z.string().optional(),
  
  // JWT 인증 토큰
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .optional(),
    
  // SendGrid 이메일 설정
  SENDGRID_API_KEY: z.string().optional(),
  DEFAULT_FROM_EMAIL: z.string().optional(),
  
  // Railway 백엔드 URL
  RAILWAY_BACKEND_URL: z.string().url().default('https://videoprompt-production.up.railway.app'),
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
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  cachedEnv = Object.freeze(parsed.data);
  return cachedEnv;
}

// 앱 부팅 시 즉시 검증 용도
export function assertEnvInitialized() {
  getEnv();
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

// AI 서비스별 API 키 가져오기 (우선순위 적용)
export const getAIApiKeys = () => {
  const env = getEnv();
  return {
    gemini: env.GOOGLE_GEMINI_API_KEY || env.GOOGLE_API_KEY,
    seedance: env.SEEDANCE_API_KEY,
    modelark: env.MODELARK_API_KEY,
  };
};

// 서비스 URL 가져오기
export const getServiceUrls = () => {
  const env = getEnv();
  return {
    railwayBackend: env.RAILWAY_BACKEND_URL,
    seedanceApi: env.SEEDANCE_API_BASE,
    modelarkApi: env.MODELARK_API_BASE,
    appUrl: env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  };
};
