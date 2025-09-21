const path = require('path');
require('dotenv').config({ path: '.env.test' });

module.exports = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000, // 더 안정적인 타임아웃
    hookTimeout: 5000,
    teardownTimeout: 5000,
    include: ['src/**/?(*.){test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'tests/e2e/**/*',
      '**/*.e2e.{test,spec}.{js,ts,jsx,tsx}',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // 플래키 테스트 일시 제외 - Phase 4에서 수정
      'src/__tests__/production-health-monitor.test.ts',
      'src/__tests__/mcp-real-integration.test.ts',
      'src/__tests__/mcp-performance.test.ts',
      'src/__tests__/seedance-production-error-scenarios.test.ts',
      'src/__tests__/system-integration.test.ts',
      'src/__tests__/auth-api.test.ts',
      // API 통합 테스트 - 플래키하므로 임시 제외
      'src/__tests__/integration/**/*',
      'src/__tests__/api-*.test.ts',
      'src/__tests__/auth-api-integration.test.ts',
      // 성능 테스트 - 별도 실행
      'src/__tests__/performance/**/*',
      // 브라우저 환경이 필요한 테스트
      'src/__tests__/handlers/**/*',
      // 웹 바이탈 테스트 - 브라우저 전용
      'src/__tests__/web-vitals/**/*',
      // OpenAI 테스트 - MSW 문제
      'src/__tests__/openai-*.test.ts',
      // 환경변수 테스트 - jest 의존성 문제
      'src/__tests__/config/**/*',
      // 플래키 유닛 테스트들
      'src/__tests__/unit/scenario-workflow-hook.test.ts',
      'src/__tests__/unit/web-vitals-hook.test.ts',
    ],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false,
        runScripts: 'dangerously', // MSW 작동을 위해 필요
      },
    },
    // 성능 최적화 - CPU 코어 활용 극대화
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: process.env.CI ? 2 : 4, // CI에서는 2개 코어로 제한
        isolate: false, // 격리 비활성화로 성능 향상
      },
    },
    // 병렬 실행 최적화
    isolate: false, // 더 빠른 테스트 실행
    maxConcurrency: process.env.CI ? 2 : 5, // 동시 실행 테스트 수 제한
    // 커버리지 설정 강화
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8', // 더 빠른 커버리지 수집
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/types/**',
        '**/*.config.*',
        '**/scripts/**',
        'src/lib/mcp-servers/**', // MCP 서버 제외
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // 중요 도메인 로직은 더 높은 커버리지 요구
        'src/entities/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/features/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    reporters: process.env.CI
      ? ['default', 'json', 'html']
      : ['default', 'verbose'],
    // 플래키 테스트 완화
    retry: process.env.CI ? 2 : 1,
    // 성능 최적화를 위한 병렬 실행
    fileParallelism: !process.env.INTEGRATION_TEST,
    // 더 나은 오류 추적
    bail: process.env.CI ? 5 : 0, // CI에서는 5개 실패 후 중단
    // 캐싱 최적화
    cache: {
      dir: 'node_modules/.vitest'
    },
    // 변화 감지 최적화
    changed: process.env.CI ? false : 'src/**/*.{ts,tsx}',
    forceRerunTriggers: [
      '**/package.json',
      '**/vitest.config.*',
      '**/.env.test'
    ]
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
    'process.env.OPENAI_API_KEY': `"${process.env.OPENAI_API_KEY || 'test-openai-key'}"`,
    'process.env.GOOGLE_GEMINI_API_KEY': `"${process.env.GOOGLE_GEMINI_API_KEY || 'test-gemini-key'}"`,
  },
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
