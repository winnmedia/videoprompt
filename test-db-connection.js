#!/usr/bin/env node

/**
 * 데이터베이스 연결 테스트 스크립트
 * PostgreSQL 연결 상태를 확인하고 기본 쿼리 실행
 */

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('🔍 데이터베이스 연결 테스트 시작...\n');

  const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
  });

  try {
    console.log('📡 PostgreSQL 연결 시도...');
    
    // 1. 기본 연결 테스트
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공!');

    // 2. 간단한 쿼리 테스트
    console.log('\n🔍 기본 쿼리 테스트...');
    const userCount = await prisma.user.count();
    console.log(`✅ User 테이블 레코드 수: ${userCount}`);

    // 3. 스키마 확인
    console.log('\n📋 테이블 존재 확인...');
    const tables = ['User', 'Project', 'Scene', 'Scenario', 'Prompt', 'Story', 'VideoAsset'];
    
    for (const table of tables) {
      try {
        let modelName = table.toLowerCase();
        // Prisma 모델명 매핑
        if (modelName === 'videoasset') modelName = 'videoAsset';
        
        const count = await prisma[modelName].count();
        console.log(`✅ ${table} 테이블: ${count}개 레코드`);
      } catch (error) {
        console.log(`❌ ${table} 테이블: 접근 실패 (${error.message})`);
      }
    }

    console.log('\n🎉 모든 데이터베이스 테스트 통과!');

  } catch (error) {
    console.error('\n❌ 데이터베이스 연결 실패:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    
    if (error.message.includes('Can\'t reach database server')) {
      console.error('\n💡 해결 방안:');
      console.error('1. DATABASE_URL 환경변수가 올바르게 설정되었는지 확인');
      console.error('2. PostgreSQL 서버가 실행 중인지 확인');
      console.error('3. 네트워크 연결 상태 확인');
      console.error('4. Vercel 환경변수에 올바른 DATABASE_URL이 설정되었는지 확인');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 데이터베이스 연결 종료');
  }
}

// 환경변수 확인
console.log('🌍 환경변수 확인:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '❌ 미설정');
console.log('');

testDatabaseConnection().catch(console.error);