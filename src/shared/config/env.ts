import { z } from 'zod';

// 런타임 환경변수 스키마
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().min(1, 'GOOGLE_GEMINI_API_KEY is required').optional(),
  VEO_PROVIDER: z.enum(['google']).optional(),
  SEEDANCE_API_KEY: z.string().optional(),
  SEEDANCE_MODEL: z.string().optional(),
  // 백엔드 마이그레이션: Prisma 접속 문자열 (PostgreSQL, SQLite 지원)
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required for database operations')
    .refine(
      (v) => v.startsWith('postgresql://') || v.startsWith('postgres://') || v.startsWith('file:'),
      'DATABASE_URL must start with postgresql://, postgres://, or file:',
    ),
  
  // JWT 인증 토큰
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .optional(),
    
  // SendGrid 이메일 설정
  SENDGRID_API_KEY: z.string().optional(),
  DEFAULT_FROM_EMAIL: z.string().email().optional(),
  
  // Railway 백엔드 URL
  RAILWAY_BACKEND_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_BASE: z.string().url().optional(),
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
