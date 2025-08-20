import { test, expect } from '@playwright/test';

test('integrations-01: 카테고리/검색/상태 UI', async ({ page }) => {
  await page.goto('/integrations');

  await page.getByTestId('category-select').selectOption('AI Services');
  await page.getByTestId('search-input').fill('OpenAI');

  await expect(page.getByText(/개의 서비스를 찾았습니다/)).toBeVisible();
  await expect(page.getByTestId('integration-title-openai')).toBeVisible();
});
