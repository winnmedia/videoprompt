import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.PW_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  // 개발 서버와의 충돌 방지
  workers: 1,
  retries: 0,
  // 테스트 실행 시에만 활성화
  globalSetup: undefined,
  globalTeardown: undefined,
});
