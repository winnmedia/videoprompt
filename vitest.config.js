const path = require('path');
require('dotenv').config({ path: '.env.test' });

module.exports = {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
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
    'process.env.OPENAI_API_KEY': `"${process.env.OPENAI_API_KEY || 'test-openai-key'}"`,
    'process.env.GOOGLE_GEMINI_API_KEY': `"${process.env.GOOGLE_GEMINI_API_KEY || 'test-gemini-key'}"`,
    'process.env.NEXT_PUBLIC_SUPABASE_URL': `"${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'}"`,
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': `"${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'}"`,
  },
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
