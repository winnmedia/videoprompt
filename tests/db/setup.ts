/**
 * DB 테스트 환경 설정
 * 
 * 목적: 테스트 실행 전 환경 변수 및 전역 설정
 */

import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로딩 (루트의 .env 파일)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 테스트 환경 변수 확인
const requiredEnvVars = ['DATABASE_URL'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// 테스트 환경임을 명시
process.env.NODE_ENV = 'test';

// PostgreSQL 연결 풀 설정 (테스트용으로 제한)
process.env.PGPOOL_MIN = '1';
process.env.PGPOOL_MAX = '5';

// 로그 레벨 설정 (테스트 시 조용하게)
process.env.LOG_LEVEL = 'error';

console.log('🧪 DB 테스트 환경 설정 완료');
console.log(`📊 데이터베이스: ${process.env.DATABASE_URL?.split('@')[1] || 'N/A'}`);
console.log(`🌍 환경: ${process.env.NODE_ENV}`);