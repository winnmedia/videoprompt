const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/app$': '<rootDir>/app',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/app/store$': '<rootDir>/src/app/store',
    '^@/processes$': '<rootDir>/src/processes',
    '^@/processes/(.*)$': '<rootDir>/src/processes/$1',
    '^@/pages$': '<rootDir>/src/pages',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/widgets$': '<rootDir>/src/widgets',
    '^@/widgets/(.*)$': '<rootDir>/src/widgets/$1',
    '^@/features$': '<rootDir>/src/features',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/entities$': '<rootDir>/src/entities',
    '^@/entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@/shared$': '<rootDir>/src/shared',
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.tsx',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/coverage/',
    '/public/',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|until-async)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
