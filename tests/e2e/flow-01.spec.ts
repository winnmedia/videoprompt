import { test, expect } from '@playwright/test';

test('flow-01: 홈→마법사 기본 흐름', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('main-nav').getByRole('link', { name: 'AI 영상 생성', exact: true }).click();
  // 메인 내비의 "AI 영상 생성"은 /workflow로 이동
  await expect(page).toHaveURL(/\/workflow/);
  // 마법사 페이지로 이동하여 흐름 계속
  await page.goto('/wizard');

  await page.getByTestId('scenario-input').first().fill('아이가 부엌에서 쿠키를 만드는 장면');
  await page.getByTestId('generate-btn-side').first().click();

  await expect(page.getByTestId('copy-veo3-btn')).toBeVisible({ timeout: 20000 });
});
