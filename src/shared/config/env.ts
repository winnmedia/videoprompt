import { z } from 'zod';

// 런타임 환경변수 스키마
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().min(1, 'GOOGLE_GEMINI_API_KEY is required').optional(),
  VEO_PROVIDER: z.enum(['google']).optional(),
  SEEDANCE_API_KEY: z.string().optional(),
  SEEDANCE_MODEL: z.string().optional(),
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
