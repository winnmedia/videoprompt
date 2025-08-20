import { test, expect } from '@playwright/test';

test('editor-01: 위저드에서 에디터 열기', async ({ page }) => {
  await page.goto('/wizard');
  await expect(page).toHaveURL(/\/wizard$/);

  await page.getByTestId('scenario-input').fill('버튼 조작 테스트');
  await page.getByTestId('generate-btn-side').click();

  await page.getByTestId('actionbar-open-editor').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByTestId('actionbar-open-editor').click();

  await expect(page).toHaveURL(/\/editor\//);
  await expect(page.getByText('타임라인 에디터')).toBeVisible();
});
