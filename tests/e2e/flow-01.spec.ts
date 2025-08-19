import { test, expect } from '@playwright/test';

test('flow-01: 홈→마법사→생성→에디터', async ({ page }) => {
  await page.goto('http://localhost:3001/');
  await page.getByRole('link', { name: '씬 플래너 시작하기' }).click();
  await expect(page).toHaveURL('http://localhost:3001/wizard');

  await page.getByPlaceholder('예: 아이가 부엌에서 쿠키를 만드는 장면').fill('아이가 부엌에서 쿠키를 만드는 장면');
  await page.getByRole('button', { name: 'AI로 장면 생성하기' }).click();

  await page.getByRole('button', { name: '에디터로 열기' }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: '에디터로 열기' }).click();

  await expect(page).toHaveURL(/http:\/\/localhost:3001\/editor\//);
  await expect(page.getByText('타임라인 에디터')).toBeVisible();
});
