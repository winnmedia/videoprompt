import { test, expect } from '@playwright/test';

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000';

test('홈 페이지 로드', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveTitle(/VLANET|Video|AI/i);
});

test('워크플로우 페이지 접근', async ({ page }) => {
  await page.goto(`${BASE}/workflow`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('workflow-title')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('workflow-story-input')).toBeVisible({ timeout: 15000 });
});

test('피드백 페이지 기본 요소', async ({ page }) => {
  await page.goto(`${BASE}/feedback`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('feedback-comments-title')).toBeVisible({ timeout: 15000 });
});
