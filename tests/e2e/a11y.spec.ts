import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000';

test('홈 페이지 기본 a11y 속성 확인', async ({ page }) => {
  await page.goto(BASE);
  // landmark 존재 여부
  await expect(page.locator('header')).toHaveCount(1);
  await expect(page.locator('main').first()).toBeVisible();
  const a11yScanResults = await new AxeBuilder({ page }).analyze();
  expect(a11yScanResults.violations, JSON.stringify(a11yScanResults.violations, null, 2)).toEqual(
    [],
  );
});

test('워크플로우 주요 컨트롤 접근 가능', async ({ page }) => {
  await page.goto(`${BASE}/workflow`);
  await expect(page.getByTestId('workflow-title')).toBeVisible();
  await expect(page.getByTestId('workflow-story-input')).toBeVisible();
  const a11yScanResults2 = await new AxeBuilder({ page }).analyze();
  expect(a11yScanResults2.violations, JSON.stringify(a11yScanResults2.violations, null, 2)).toEqual(
    [],
  );
});
