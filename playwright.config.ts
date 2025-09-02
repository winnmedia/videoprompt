import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT || 3100);
const BASE = process.env.PW_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bash -lc "pnpm prisma:generate && pnpm build && pnpm start -p ${PORT}"`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
