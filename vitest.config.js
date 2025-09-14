const path = require('path');
require('dotenv').config({ path: '.env.test' });

module.exports = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 5000, // 통합 테스트용 적절한 타임아웃
    hookTimeout: 3000, // setup/teardown 타임아웃 단축
    teardownTimeout: 3000, // teardown 타임아웃 단축
    include: ['src/**/?(*.){test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'tests/e2e/**/*',
      '**/*.e2e.{test,spec}.{js,ts,jsx,tsx}',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // 기존 목업 테스트 비활성화 (새로운 통합 테스트로 대체)
      'src/__tests__/auth-api.test.ts',
    ],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false, // 성능 향상
        runScripts: 'dangerously', // MSW 작동을 위해 필요
      },
    },
    // 메모리 최적화 및 안정성 향상
    pool: 'forks', // 메모리 격리
    poolOptions: {
      forks: {
        singleFork: true, // 단일 포크로 안정성 향상
        maxForks: 1, // 최대 포크 수 제한
      },
    },
    // 불필요한 기능 비활성화
    coverage: {
      enabled: false, // 커버리지 비활성화로 성능 향상
    },
    reporters: ['default'], // 기본 리포터만 사용
    // 테스트 재시도 설정 (플래키 테스트 완화)
    retry: 1, // 실패 시 1회 재시도
    // 병렬 실행 비활성화 (통합 테스트 안정성)
    fileParallelism: false,
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
