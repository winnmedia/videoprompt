#!/usr/bin/env tsx

/**
 * 실시간 환경변수 검증 스크립트 - $300 사건 재발 방지
 * 환경 차단선 구축: 환경변수 누락 시 즉시 process.exit(1)
 *
 * 핵심 기능:
 * 1. .env.local 파일 명시적 로드
 * 2. getEnv()만 호출하여 환경변수 스키마 검증
 * 3. 실패시 즉시 exit 1로 앱 시작 차단
 * 4. 성공시 환경변수 요약 정보 출력
 */

// .env 파일들 명시적 로드 (Next.js 외부 스크립트에서 필요)
// Next.js 로딩 순서 모방: .env.local > .env.development > .env
import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.development' });
config({ path: '.env.local' });

import { getEnv, getEnvironmentCapabilities, getSupabaseConfig, getDegradationMode } from '../src/shared/config/env';

/**
 * 메인 검증 함수
 */
async function validateEnvironment() {
  console.log('🔍 환경변수 검증 시작...');
  console.log('━'.repeat(70));

  try {
    // 핵심: getEnv() 호출로 모든 환경변수 검증
    console.log('🔍 Debug - process.env.SEEDANCE_API_KEY before getEnv():', process.env.SEEDANCE_API_KEY?.length || 0);
    const env = getEnv();
    console.log('🔍 Debug - env.SEEDANCE_API_KEY after getEnv():', env.SEEDANCE_API_KEY?.length || 0);
    const capabilities = getEnvironmentCapabilities();
    const supabaseConfig = getSupabaseConfig();
    const degradationMode = getDegradationMode();

    console.log('✅ 환경변수 스키마 검증 성공');
    console.log('━'.repeat(70));

    // 환경변수 요약 정보 출력
    console.log('📊 환경변수 요약:');
    console.log(`   🏷️  환경: ${env.NODE_ENV}`);
    console.log(`   🔧 모드: ${degradationMode}`);
    console.log(`   🔌 Supabase: ${capabilities.supabaseAuth ? '✅' : '❌'}`);
    console.log(`   💾 Database: ${capabilities.database ? '✅' : '❌'}`);
    console.log(`   🎬 SeeDance: ${capabilities.seedanceVideo ? '✅' : '❌'}`);
    console.log(`   🔑 Admin권한: ${capabilities.fullAdmin ? '✅' : '❌'}`);

    // 디버깅: SEEDANCE_API_KEY 값 확인
    console.log(`   🔍 Debug - env.SEEDANCE_API_KEY: ${env.SEEDANCE_API_KEY ? 'EXISTS' : 'MISSING'}`);
    console.log(`   🔍 Debug - process.env.SEEDANCE_API_KEY: ${process.env.SEEDANCE_API_KEY ? 'EXISTS' : 'MISSING'}`);
    console.log(`   🔍 Debug - env key length: ${env.SEEDANCE_API_KEY?.length || 0}`);
    console.log(`   🔍 Debug - process.env key length: ${process.env.SEEDANCE_API_KEY?.length || 0}`);

    if (env.NODE_ENV === 'production') {
      console.log('');
      console.log('🚨 프로덕션 환경 필수 체크:');
      console.log(`   SUPABASE_URL: ${env.SUPABASE_URL ? '✅' : '❌'}`);
      console.log(`   SUPABASE_ANON_KEY: ${env.SUPABASE_ANON_KEY ? '✅' : '❌'}`);
      console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);
      console.log(`   DATABASE_URL: ${env.DATABASE_URL ? '✅' : '❌'}`);
    }

    console.log('━'.repeat(70));
    console.log('✅ 환경변수 검증 완료 - 앱 시작 허용');

    return true;

  } catch (error) {
    console.error('❌ 환경변수 검증 실패');
    console.error('━'.repeat(70));

    if (error instanceof Error) {
      console.error(`🚨 오류: ${error.message}`);
    } else {
      console.error('🚨 알 수 없는 오류가 발생했습니다.');
    }

    console.error('━'.repeat(70));
    console.error('💡 해결방법:');
    console.error('   1. .env 파일에 누락된 환경변수를 추가하세요');
    console.error('   2. env.example 파일을 참조하세요');
    console.error('   3. 프로덕션에서는 모든 필수 환경변수가 설정되어야 합니다');

    return false;
  }
}

/**
 * CLI에서 직접 실행
 */
async function main() {
  const success = await validateEnvironment();

  // 실패시 즉시 exit 1
  process.exit(success ? 0 : 1);
}

// CLI에서 직접 실행 시
if (require.main === module) {
  main().catch((error) => {
    console.error('🚨 검증 스크립트 실행 중 오류:', error);
    process.exit(1);
  });
}

export { validateEnvironment };