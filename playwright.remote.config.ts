import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  use: {
    baseURL: process.env.PW_BASE_URL || process.env.RAILWAY_URL || 'http://localhost:3000',
    headless: true,
  },
  // NOTE: remote 환경 대상으로 테스트할 때는 로컬 webServer를 띄우지 않습니다
});
