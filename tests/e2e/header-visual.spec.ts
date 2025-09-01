import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3000';

test.describe('Header visual regression (smoke)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Run only on Chromium here');

  test('header has vlanet logo and nav items', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const header = page.locator('header');
    await expect(header).toBeVisible();
    // accept both VLANET/vlanet to handle case changes
    const logo = header.locator('img[alt="VLANET"], img[alt="vlanet"]');
    await expect(logo).toBeVisible();

    // quick smoke: ensure key nav links exist
    const nav = header.getByTestId('main-nav');
    await expect(nav.getByRole('link', { name: 'AI 영상 기획', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '프롬프트 생성기', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '영상 생성', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '영상 피드백', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: '콘텐츠 관리', exact: true })).toBeVisible();
  });
});
