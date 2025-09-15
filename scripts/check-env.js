#!/usr/bin/env node
/**
 * 환경변수 체크 스크립트
 */

const requiredEnvVars = [
  'GOOGLE_API_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEEDANCE_API_KEY',
  'SEEDANCE_MODEL',
  'SEEDANCE_API_BASE'
];

console.log('🔍 환경변수 검증 시작...\n');

let missingVars = [];
let warnings = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];

  if (!value) {
    missingVars.push(varName);
    console.log(`❌ ${varName}: 설정되지 않음`);
  } else if (value.includes('your-') || value.includes('sk-...')) {
    warnings.push(varName);
    console.log(`⚠️  ${varName}: 기본값 또는 플레이스홀더 값`);
  } else {
    console.log(`✅ ${varName}: 설정됨 (${value.substring(0, 20)}...)`);
  }
});

console.log('\n📊 검증 결과:');
console.log(`✅ 정상: ${requiredEnvVars.length - missingVars.length - warnings.length}`);
console.log(`⚠️  경고: ${warnings.length}`);
console.log(`❌ 누락: ${missingVars.length}`);

if (missingVars.length > 0) {
  console.log('\n❌ 누락된 환경변수:');
  missingVars.forEach(varName => {
    console.log(`  - ${varName}`);
  });
  console.log('\n해결방법: .env.local 파일에 위 변수들을 추가하세요.');
}

if (warnings.length > 0) {
  console.log('\n⚠️  확인 필요한 환경변수:');
  warnings.forEach(varName => {
    console.log(`  - ${varName}: 실제 API 키로 교체 필요`);
  });
}

process.exit(missingVars.length > 0 ? 1 : 0);
