import { test, expect } from '@playwright/test';

test('notfound-01: 404 페이지', async ({ page }) => {
  await page.goto('/this-should-404');
  await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
});
