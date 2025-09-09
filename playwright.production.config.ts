import { defineConfig, devices } from '@playwright/test';

/**
 * 프로덕션 환경 Playwright 테스트 구성
 * 
 * TDD 원칙:
 * - 실제 프로덕션 서비스 검증
 * - 실패 시나리오 우선 테스트
 * - 사용자 관점에서의 기능 검증
 */
export default defineConfig({
  testDir: './tests/production',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // 프로덕션은 네트워크 이슈로 재시도 증가
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-production' }],
    ['json', { outputFile: 'test-results-production.json' }]
  ],
  use: {
    baseURL: 'https://www.vridge.kr',
    trace: 'on-first-retry',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 프로덕션 테스트 시 더 긴 타임아웃
    navigationTimeout: 30000,
    actionTimeout: 15000,
    // User-Agent 설정으로 실제 브라우저처럼 동작
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  projects: [
    {
      name: 'chromium-production',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'webkit-production',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'firefox-production', 
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  // 프로덕션 테스트에서는 웹서버 실행 없음
  timeout: 60000, // 전체 테스트 타임아웃 증가
});