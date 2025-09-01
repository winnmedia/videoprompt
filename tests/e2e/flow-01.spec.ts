import { test, expect } from '@playwright/test';

test('flow-01: 홈→마법사 기본 흐름', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /AI 영상 생성/ }).click();
  await expect(page).toHaveURL(/\/wizard$/);

  await page.getByTestId('scenario-input').first().fill('아이가 부엌에서 쿠키를 만드는 장면');
  await page.getByTestId('generate-btn-side').first().click();

  await expect(page.getByTestId('copy-veo3-btn')).toBeVisible({ timeout: 20000 });
});
