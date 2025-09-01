import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3000';

test.describe('Global nav routing', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Run only on Chromium here');

  test('header nav links route to core pages', async ({ page }) => {
    // Home
    let resp = await page.goto(`${BASE_URL}/`);
    expect(resp?.ok()).toBeTruthy();
    await expect(page.getByRole('navigation')).toBeVisible();

    const nav = page.getByRole('navigation');

    // Scenario
    await nav.getByRole('link', { name: 'AI 영상 기획', exact: true }).click();
    await expect(page).toHaveURL(/\/scenario/);
    await page.waitForSelector('h1:has-text("AI 영상 기획")', { timeout: 15000 });

    // Prompt Generator
    await nav.getByRole('link', { name: '프롬프트 생성기', exact: true }).click();
    await expect(page).toHaveURL(/\/prompt-generator/);
    await page.waitForLoadState('networkidle');

    // Workflow (Video Generation)
    await nav.getByRole('link', { name: '영상 생성', exact: true }).click();
    await expect(page).toHaveURL(/\/workflow/);
    await page.waitForLoadState('networkidle');

    // Feedback
    await nav.getByRole('link', { name: '영상 피드백', exact: true }).click();
    await expect(page).toHaveURL(/\/feedback/);
    await page.waitForSelector('text=영상 공유');

    // Planning
    await nav.getByRole('link', { name: '콘텐츠 관리', exact: true }).click();
    await expect(page).toHaveURL(/\/planning/);
    await page.waitForSelector('text=기획안 관리');
  });
});
