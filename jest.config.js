const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Next.js 앱의 경로를 제공합니다. (테스트 환경에서 next.config.js와 .env 파일을 로드하기 위해)
  dir: './',
})

// Jest에 전달할 사용자 정의 설정
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['']
  },
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  moduleNameMapper: {
    // tsconfig.json의 paths와 일치하도록 설정
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/processes/(.*)$': '<rootDir>/src/processes/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/widgets/(.*)$': '<rootDir>/src/widgets/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|until-async|@open-draft|headers-polyfill|strict-event-emitter|outvariant)/)'
  ]
}

// createJestConfig는 next/jest가 비동기적으로 Next.js 설정을 로드할 수 있도록 하는 함수입니다.
module.exports = createJestConfig(customJestConfig)