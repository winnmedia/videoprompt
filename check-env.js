#!/usr/bin/env node

/**
 * 환경 변수 검증 스크립트
 * Railway 데이터베이스 연결 및 Vercel 환경 설정 확인
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

console.log('🔍 환경 변수 및 데이터베이스 연결 검증 시작...\n');

// 1. 환경 변수 체크
function checkEnvironmentVariables() {
  console.log('📋 필수 환경 변수 확인:');

  const requiredVars = [
    'DATABASE_URL',
    'GOOGLE_GEMINI_API_KEY',
    'JWT_SECRET'
  ];

  const missingVars = [];

  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value === 'your_' + varName.toLowerCase() + '_here') {
      missingVars.push(varName);
      console.log(`❌ ${varName}: 미설정 또는 placeholder 값`);
    } else {
      console.log(`✅ ${varName}: 설정됨`);
    }
  });

  if (missingVars.length > 0) {
    console.log('\n🚨 누락된 환경 변수들:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n💡 해결 방법:');
    console.log('   1. Vercel Dashboard → Project → Settings → Environment Variables');
    console.log('   2. Railway Dashboard → Project → Variables');
  }

  return missingVars.length === 0;
}

// 2. 데이터베이스 연결 테스트
async function testDatabaseConnection() {
  console.log('\n🔌 데이터베이스 연결 테스트:');

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('placeholder')) {
    console.log('❌ DATABASE_URL이 설정되지 않았습니다.');
    return false;
  }

  const prisma = new PrismaClient();

  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    console.log(`✅ 데이터베이스 연결 성공 (${latency}ms)`);

    // 테이블 존재 확인
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

    console.log(`✅ 테이블 개수: ${tables.length}개`);

    return true;
  } catch (error) {
    console.log('❌ 데이터베이스 연결 실패:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// 3. Vercel 배포 상태 확인
function checkVercelDeployment() {
  console.log('\n🚀 Vercel 배포 상태 확인:');

  try {
    const result = execSync('vercel env ls', { encoding: 'utf8' });
    console.log('✅ Vercel CLI 연결됨');

    // DATABASE_URL이 Vercel에 설정되어 있는지 확인
    if (result.includes('DATABASE_URL')) {
      console.log('✅ DATABASE_URL이 Vercel에 설정됨');
    } else {
      console.log('❌ DATABASE_URL이 Vercel에 설정되지 않음');
      console.log('💡 해결: vercel env add DATABASE_URL');
    }

  } catch (error) {
    console.log('❌ Vercel CLI 명령 실패:', error.message);
    console.log('💡 해결: vercel login 후 vercel link 실행');
  }
}

// 4. Railway 연결 확인
function checkRailwayConnection() {
  console.log('\n🚂 Railway 연결 확인:');

  try {
    const result = execSync('railway status', { encoding: 'utf8' });
    console.log('✅ Railway CLI 연결됨');
    console.log(result);
  } catch (error) {
    console.log('❌ Railway CLI 명령 실패:', error.message);
    console.log('💡 해결: railway login 후 railway link 실행');
  }
}

// 메인 실행
async function main() {
  const envOk = checkEnvironmentVariables();
  const dbOk = await testDatabaseConnection();

  checkVercelDeployment();
  checkRailwayConnection();

  console.log('\n📊 종합 결과:');
  console.log(`환경 변수: ${envOk ? '✅' : '❌'}`);
  console.log(`데이터베이스: ${dbOk ? '✅' : '❌'}`);

  if (envOk && dbOk) {
    console.log('\n🎉 모든 검증이 완료되었습니다!');
    process.exit(0);
  } else {
    console.log('\n🚨 문제가 발견되었습니다. 위의 해결 방법을 참고하세요.');
    process.exit(1);
  }
}

main().catch(console.error);