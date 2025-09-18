"use strict";
/**
 * 환경변수 검증 및 Fail-Fast 모듈
 * FSD Architecture - Shared Layer Library
 *
 * 핵심 원칙:
 * - 환경변수 누락 시 조기 실패 (Fail-Fast)
 * - 타입 안전성 보장
 * - 개발/프로덕션 환경별 분기 전략
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV_STATUS = exports.ENV_VALIDATION = void 0;
exports.validateEnvironment = validateEnvironment;
exports.getEnvConfig = getEnvConfig;
exports.canUseSupabase = canUseSupabase;
const zod_1 = require("zod");
/**
 * 환경변수 스키마 정의 - Zod 런타임 검증
 */
const EnvSchema = zod_1.z.object({
    // Supabase 필수 환경변수
    SUPABASE_URL: zod_1.z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_ANON_KEY: zod_1.z.string().min(1, 'SUPABASE_ANON_KEY is required'),
    // Supabase 선택적 환경변수
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().optional(),
    // Node.js 환경 변수
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    // 다른 필수 환경변수들
    NEXTAUTH_SECRET: zod_1.z.string().optional(),
    NEXTAUTH_URL: zod_1.z.string().url().optional(),
});
/**
 * 환경변수 검증 함수 - Fail-Fast 또는 Graceful Degradation
 */
function validateEnvironment(options = {}) {
    const { failFast = false, logErrors = true } = options;
    try {
        // Zod 스키마로 환경변수 검증
        const config = EnvSchema.parse(process.env);
        // Supabase 키 형식 추가 검증
        const supabaseErrors = [];
        if (!config.SUPABASE_ANON_KEY.startsWith('eyJ')) {
            supabaseErrors.push('SUPABASE_ANON_KEY must be a valid JWT token (starts with "eyJ")');
        }
        if (config.SUPABASE_SERVICE_ROLE_KEY && !config.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
            supabaseErrors.push('SUPABASE_SERVICE_ROLE_KEY must be a valid JWT token (starts with "eyJ")');
        }
        if (supabaseErrors.length > 0) {
            return handleValidationFailure(supabaseErrors, failFast, logErrors);
        }
        // 성공 - Supabase 동작 모드 결정
        const mode = config.SUPABASE_SERVICE_ROLE_KEY ? 'full' : 'degraded';
        if (logErrors && config.NODE_ENV === 'development') {
            console.log(`✅ Environment validation successful (${mode} mode)`, {
                hasSupabaseUrl: !!config.SUPABASE_URL,
                hasAnonKey: !!config.SUPABASE_ANON_KEY,
                hasServiceKey: !!config.SUPABASE_SERVICE_ROLE_KEY,
                mode
            });
        }
        return {
            success: true,
            config,
            errors: [],
            mode,
            canOperateSupabase: true
        };
    }
    catch (error) {
        const errors = error instanceof zod_1.z.ZodError
            ? error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
            : ['Unknown validation error'];
        return handleValidationFailure(errors, failFast, logErrors);
    }
}
/**
 * 검증 실패 처리 - Fail-Fast 또는 Graceful Degradation
 */
function handleValidationFailure(errors, failFast, logErrors) {
    if (logErrors) {
        console.error('❌ Environment validation failed:', errors);
        if (process.env.NODE_ENV === 'development') {
            console.warn('💡 Development mode - check your .env.local file');
            console.warn('📖 Required environment variables:', [
                'SUPABASE_URL',
                'SUPABASE_ANON_KEY',
                'SUPABASE_SERVICE_ROLE_KEY (optional)'
            ]);
        }
        else {
            console.error('🚨 Production environment variables missing');
        }
    }
    // Fail-Fast 모드 - 즉시 프로세스 종료
    if (failFast) {
        console.error('🛑 FAIL-FAST: Environment validation failed, terminating process');
        process.exit(1);
    }
    // Graceful Degradation 모드
    return {
        success: false,
        errors,
        mode: 'disabled',
        canOperateSupabase: false
    };
}
/**
 * 환경변수 검증 및 설정 export
 * - 애플리케이션 시작 시점에 한 번만 실행
 * - 검증 결과를 전역적으로 사용 가능
 */
exports.ENV_VALIDATION = validateEnvironment({
    failFast: process.env.NODE_ENV === 'production', // 프로덕션에서는 Fail-Fast
    logErrors: true
});
/**
 * 타입 안전한 환경변수 접근자
 */
function getEnvConfig() {
    return exports.ENV_VALIDATION.config || null;
}
/**
 * Supabase 동작 가능 여부 체크
 */
function canUseSupabase() {
    return exports.ENV_VALIDATION.canOperateSupabase;
}
/**
 * 환경변수 상태 정보
 */
exports.ENV_STATUS = {
    isValid: exports.ENV_VALIDATION.success,
    mode: exports.ENV_VALIDATION.mode,
    errors: exports.ENV_VALIDATION.errors,
    canOperateSupabase: exports.ENV_VALIDATION.canOperateSupabase
};
/**
 * 개발 환경에서만 환경변수 상태 출력
 */
if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Environment Status:', exports.ENV_STATUS);
}
