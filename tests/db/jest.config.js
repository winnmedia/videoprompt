/**
 * Jest 설정 파일 - DB 계약 테스트 전용
 * 
 * 목적: 데이터베이스 테스트를 위한 특별한 설정 제공
 * - 실제 PostgreSQL 연결
 * - 병렬 실행 제어 (DB 충돌 방지)
 * - 환경 변수 로딩
 * - 타임아웃 증가 (DB 작업 시간 고려)
 */

module.exports = {
  // 테스트 환경 설정
  testEnvironment: 'node',
  
  // 테스트 파일 패턴
  testMatch: [
    '<rootDir>/**/*.test.ts'
  ],
  
  // TypeScript 지원
  preset: 'ts-jest',
  
  // 환경 변수 파일 로딩
  setupFiles: ['<rootDir>/setup.ts'],
  
  // 테스트 전후 설정
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // 병렬 실행 비활성화 (DB 테스트 안전성)
  maxWorkers: 1,
  
  // 타임아웃 증가 (DB 연결 및 쿼리 시간 고려)
  testTimeout: 30000,
  
  // 커버리지 설정
  collectCoverageFrom: [
    'src/app/api/**/*.ts',
    'src/lib/db/**/*.ts',
    'prisma/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  
  // 커버리지 제외 패턴
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/build/',
    '/dist/'
  ],
  
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 모듈 해상도 설정
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1'
  },
  
  // 테스트 결과 리포터
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results/db',
        outputName: 'db-contract-tests.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results/db',
        filename: 'db-contract-tests.html',
        openReport: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],
  
  // 글로벌 설정
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs'
      }
    }
  },
  
  // 모듈 파일 확장자
  moduleFileExtensions: [
    'ts',
    'tsx', 
    'js',
    'jsx',
    'json'
  ],
  
  // 변환 설정
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // 테스트 실행 전 정리 작업
  clearMocks: true,
  restoreMocks: true,
  
  // 오류 발생 시 즉시 중단
  bail: 1,
  
  // 상세한 오류 정보 출력
  verbose: true,
  
  // 캐시 비활성화 (DB 테스트의 일관성 보장)
  cache: false,
  
  // 테스트 순서 강제 (의존성 있는 테스트용)
  testSequencer: '<rootDir>/test-sequencer.js'
};