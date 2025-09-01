const path = require('path');
require('dotenv').config({ path: '.env.test' });

module.exports = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 5000, // 10초 → 5초로 단축
    hookTimeout: 5000, // 10초 → 5초로 단축
    teardownTimeout: 5000, // 10초 → 5초로 단축
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
      },
    },
    // 메모리 최적화 옵션 추가
    pool: 'forks', // 'threads' → 'forks'로 변경하여 메모리 격리
    poolOptions: {
      forks: {
        singleFork: true, // 단일 포크 사용
        maxForks: 1, // 최대 포크 수 제한
      },
    },
    // 불필요한 기능 비활성화
    coverage: {
      enabled: false, // 커버리지 비활성화
    },
    reporters: ['default'], // 기본 리포터만 사용
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
