import { test, expect } from '@playwright/test';

test('editor-01: 버튼으로 구간 조정', async ({ page }) => {
  await page.goto('http://localhost:3001/wizard');
  await expect(page).toHaveURL('http://localhost:3001/wizard');

  await page.getByTestId('scenario-input').fill('버튼 조작 테스트');
  await page.getByTestId('generate-btn').click();

  await page.getByTestId('open-editor-btn').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByTestId('open-editor-btn').click();

  await expect(page).toHaveURL(/http:\/\/localhost:3001\/editor\//);
  await page.getByText('시작 00:00').first().click();
  await page.getByRole('button', { name: '길이 +1s' }).first().click();
  await expect(page.getByText('길이 3s')).toBeVisible();
  await page.getByRole('button', { name: /시작 \+1s/ }).first().click();
  await expect(page.getByText('시작 00:01')).toBeVisible();
});
