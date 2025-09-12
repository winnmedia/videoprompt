/**
 * Jest 전역 설정 및 헬퍼
 * 
 * 목적: 모든 DB 테스트에서 공통으로 사용할 설정
 */

import { jest } from '@jest/globals';

// 전역 타임아웃 설정 (DB 연결 시간 고려)
jest.setTimeout(30000);

// 전역 테스트 헬퍼 함수들
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDatabaseField(): R;
      toHaveValidConstraints(): R;
      toBeOptimizedIndex(): R;
    }
  }
}

// 커스텀 매처: 유효한 데이터베이스 필드인지 확인
expect.extend({
  toBeValidDatabaseField(received: any) {
    const pass = received && 
                 typeof received.column_name === 'string' &&
                 typeof received.data_type === 'string' &&
                 typeof received.is_nullable === 'string';
    
    return {
      message: () => 
        pass
          ? `Expected ${received} not to be a valid database field`
          : `Expected ${received} to be a valid database field with column_name, data_type, and is_nullable properties`,
      pass,
    };
  },

  toHaveValidConstraints(received: any[]) {
    const pass = Array.isArray(received) &&
                 received.every(constraint => 
                   constraint.constraint_name && 
                   constraint.constraint_type
                 );
    
    return {
      message: () =>
        pass
          ? `Expected constraints not to be valid`
          : `Expected all constraints to have constraint_name and constraint_type`,
      pass,
    };
  },

  toBeOptimizedIndex(received: any) {
    const pass = received &&
                 received.indexname &&
                 received.indexdef &&
                 !received.indexdef.includes('UNIQUE') || 
                 received.indexname.includes('unique');
    
    return {
      message: () =>
        pass
          ? `Expected index ${received?.indexname} not to be optimized`
          : `Expected index to be properly optimized with clear naming convention`,
      pass,
    };
  }
});

// 테스트 전역 변수
global.testStartTime = Date.now();

// 각 테스트 전 실행
beforeEach(() => {
  // 테스트별 타임스탬프
  global.currentTestStart = Date.now();
});

// 각 테스트 후 실행
afterEach(() => {
  const duration = Date.now() - global.currentTestStart;
  if (duration > 5000) {
    console.warn(`⚠️  느린 테스트 감지: ${duration}ms`);
  }
});

// 모든 테스트 완료 후 실행
afterAll(() => {
  const totalDuration = Date.now() - global.testStartTime;
  console.log(`✅ DB 계약 테스트 완료 (총 ${totalDuration}ms)`);
});

// 예상치 못한 오류 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});