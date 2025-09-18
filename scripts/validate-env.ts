#!/usr/bin/env tsx
/**
 * 환경변수 검증 스크립트 - 실시간 검증 및 CI/CD 통합
 * FSD Architecture - 환경 안전성 보장
 *
 * 사용법:
 * - 개발 환경: pnpm validate-env
 * - CI/CD: pnpm validate-env --strict
 * - 환경별: pnpm validate-env --env production
 */

import {
  getEnv,
  getDegradationMode,
  getEnvironmentCapabilities,
  getSupabaseConfig
} from '../src/shared/config/env';

type Environment = 'development' | 'test' | 'production';

interface ValidationOptions {
  strict?: boolean;
  env?: Environment;
  silent?: boolean;
  ci?: boolean;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  degradationMode: 'full' | 'degraded' | 'disabled';
  capabilities: ReturnType<typeof getEnvironmentCapabilities>;
}

/**
 * 메인 환경변수 검증 함수
 */
function validateEnvironment(options: ValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. 기본 환경변수 검증
    const env = getEnv();
    const capabilities = getEnvironmentCapabilities();
    const degradationMode = getDegradationMode();
    const supabaseConfig = getSupabaseConfig();

    // 2. 환경별 필수 검증
    const targetEnv = options.env || env.NODE_ENV;

    if (targetEnv === 'production') {
      // 프로덕션 환경 엄격 검증
      if (!supabaseConfig.isConfigured) {
        errors.push('❌ SUPABASE_URL과 SUPABASE_ANON_KEY는 프로덕션에서 필수입니다');
      }

      if (!supabaseConfig.hasFullAdmin) {
        warnings.push('⚠️ SUPABASE_SERVICE_ROLE_KEY 미설정 - 관리자 기능 제한됨');
      }

      if (!env.JWT_SECRET) {
        errors.push('❌ JWT_SECRET은 프로덕션에서 필수입니다');
      }

      if (!env.DATABASE_URL) {
        errors.push('❌ DATABASE_URL은 프로덕션에서 필수입니다');
      }

      if (!env.SEEDANCE_API_KEY) {
        warnings.push('⚠️ SEEDANCE_API_KEY 미설정 - 영상 생성 기능 제한됨');
      }
    } else {
      // 개발/테스트 환경 권장사항
      if (!supabaseConfig.isConfigured) {
        warnings.push('⚠️ Supabase 설정 누락 - degraded mode로 동작');
      }

      if (!env.JWT_SECRET) {
        warnings.push('⚠️ JWT_SECRET 미설정 - 레거시 인증 비활성');
      }

      if (!env.DATABASE_URL) {
        warnings.push('⚠️ DATABASE_URL 미설정 - 데이터베이스 기능 제한');
      }
    }

    // 3. Strict 모드에서는 경고도 에러로 처리
    if (options.strict && warnings.length > 0) {
      errors.push(...warnings.map(w => w.replace('⚠️', '❌')));
      warnings.length = 0;
    }

    // 4. CI 환경에서는 degraded mode 허용 안함
    if (options.ci && degradationMode === 'degraded') {
      errors.push('❌ CI 환경에서는 degraded mode가 허용되지 않습니다');
    }

    // 5. disabled mode는 항상 에러
    if (degradationMode === 'disabled') {
      errors.push('❌ 시스템이 disabled mode입니다 - 필수 환경변수를 확인하세요');
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      degradationMode,
      capabilities
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      errors: [`❌ 환경변수 검증 중 예외 발생: ${errorMessage}`],
      warnings: [],
      degradationMode: 'disabled' as const,
      capabilities: getEnvironmentCapabilities()
    };
  }
}

/**
 * 검증 결과 출력
 */
function printValidationResult(result: ValidationResult, options: ValidationOptions = {}) {
  if (options.silent) return;

  const { success, errors, warnings, degradationMode, capabilities } = result;

  console.log('\n🔧 환경변수 검증 결과');
  console.log('═'.repeat(50));

  // 상태 요약
  console.log(`상태: ${success ? '✅ 성공' : '❌ 실패'}`);
  console.log(`모드: ${degradationMode}`);
  console.log(`환경: ${process.env.NODE_ENV || 'unknown'}`);

  // Capabilities 출력
  console.log('\n🔐 시스템 Capabilities:');
  console.log(`  Supabase 인증: ${capabilities.supabaseAuth ? '✅' : '❌'}`);
  console.log(`  레거시 인증: ${capabilities.legacyAuth ? '✅' : '❌'}`);
  console.log(`  데이터베이스: ${capabilities.database ? '✅' : '❌'}`);
  console.log(`  관리자 기능: ${capabilities.fullAdmin ? '✅' : '❌'}`);
  console.log(`  영상 생성: ${capabilities.seedanceVideo ? '✅' : '❌'}`);

  // 에러 출력
  if (errors.length > 0) {
    console.log('\n🚨 에러:');
    errors.forEach(error => console.log(`  ${error}`));
  }

  // 경고 출력
  if (warnings.length > 0) {
    console.log('\n⚠️ 경고:');
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  // 권장사항
  if (!success) {
    console.log('\n💡 해결 방법:');
    if (!capabilities.supabaseAuth) {
      console.log('  • .env.local에 SUPABASE_URL과 SUPABASE_ANON_KEY 설정');
    }
    if (!capabilities.fullAdmin) {
      console.log('  • .env.local에 SUPABASE_SERVICE_ROLE_KEY 설정 (선택사항)');
    }
    if (!capabilities.legacyAuth) {
      console.log('  • .env.local에 JWT_SECRET 설정 (32자 이상)');
    }
    if (!capabilities.database) {
      console.log('  • .env.local에 DATABASE_URL 설정');
    }
  }

  console.log('═'.repeat(50));
}

/**
 * CLI 진입점
 */
function main() {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {
    strict: args.includes('--strict'),
    silent: args.includes('--silent'),
    ci: args.includes('--ci') || !!process.env.CI,
  };

  // 환경 지정
  const envIndex = args.indexOf('--env');
  if (envIndex !== -1 && envIndex + 1 < args.length) {
    const envArg = args[envIndex + 1] as Environment;
    if (['development', 'test', 'production'].includes(envArg)) {
      options.env = envArg;
    }
  }

  const result = validateEnvironment(options);
  printValidationResult(result, options);

  // Exit code 설정
  if (!result.success) {
    process.exit(1);
  }

  if (!options.silent) {
    console.log('✅ 환경변수 검증 완료');
  }
}

// 스크립트로 직접 실행된 경우
if (require.main === module) {
  main();
}

export { validateEnvironment, ValidationOptions, ValidationResult };