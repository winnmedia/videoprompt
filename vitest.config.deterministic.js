const path = require('path');
require('dotenv').config({ path: '.env.test' });

// 결정론적 테스트 환경 설정
module.exports = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/deterministic-setup.ts'],
    testTimeout: 10000, // 안정성을 위한 충분한 타임아웃
    hookTimeout: 5000,
    teardownTimeout: 5000,

    // 결정론적 실행을 위한 설정
    sequence: {
      shuffle: false, // 테스트 순서 고정
      concurrent: false, // 순차 실행으로 안정성 확보
    },

    include: ['src/**/?(*.){test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'tests/e2e/**/*',
      '**/*.e2e.{test,spec}.{js,ts,jsx,tsx}',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],

    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false,
        runScripts: 'dangerously',
        // 결정론적 DOM 환경
        url: 'http://localhost:3000',
        userAgent: 'Mozilla/5.0 (Test Environment) AppleWebKit/537.36',
      },
    },

    // 메모리 격리 및 안정성
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        maxForks: 1,
        isolate: true, // 완전한 프로세스 격리
      },
    },

    // 커버리지 활성화 (품질 게이트용)
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/test{,s}/**',
        '**/*.d.ts',
        'cypress/**',
        'test{,s}/**',
        'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },

    // 플래키 테스트 완화
    retry: 2, // 최대 2회 재시도
    bail: 1, // 첫 번째 실패 시 중단 (Fail-Fast)

    // 병렬 실행 비활성화 (결정론성 우선)
    fileParallelism: false,
    maxConcurrency: 1,

    // MSW 안정화를 위한 설정
    testTransform: {
      '^.+\\.(ts|tsx)$': ['vitest/esbuild', {
        target: 'node14',
        format: 'esm',
      }],
    },

    // 리포터 설정 (CI/CD 최적화)
    reporters: process.env.CI
      ? ['default', 'json', 'junit']
      : ['default', 'verbose'],

    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml',
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/app': path.resolve(__dirname, './src/app'),
      '@/test': path.resolve(__dirname, './src/test'),
    },
  },

  define: {
    'process.env.NODE_ENV': '"test"',
    // 결정론적 환경 변수
    'process.env.VITEST_DETERMINISTIC': '"true"',
    'process.env.TZ': '"UTC"', // 시간대 고정
    'process.env.FORCE_COLOR': '"0"', // 색상 출력 비활성화
    'process.env.OPENAI_API_KEY': `"${process.env.OPENAI_API_KEY || 'test-openai-key-deterministic'}"`,
    'process.env.GOOGLE_GEMINI_API_KEY': `"${process.env.GOOGLE_GEMINI_API_KEY || 'test-gemini-key-deterministic'}"`,
  },

  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};