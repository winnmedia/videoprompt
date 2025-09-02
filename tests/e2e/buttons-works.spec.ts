import { test, expect } from '@playwright/test';

async function assertNoConsoleErrors(page: any) {
  const errors: string[] = [];
  const ignored = [/auto imagen preview failed/i, /Failed to fetch/i, /Failed to load resource:.*404/i];
  page.on('pageerror', (e: any) => {
    const text = e?.message ? String(e.message) : String(e);
    if (!ignored.some((re) => re.test(text))) errors.push(text);
  });
  page.on('console', (msg: any) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!ignored.some((re) => re.test(text))) errors.push(text);
  });
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

async function safeClickEnabled(locator: any) {
  const isDisabled = await locator.isDisabled().catch(() => false);
  if (!isDisabled) {
    await locator.click();
  } else {
    await expect(locator).toBeDisabled();
  }
}

test('buttons-works: 홈/위저드/에디터/통합 주요 버튼 클릭 무에러', async ({ page }) => {
  // Stub clipboard & auto-dismiss dialogs
  page.on('dialog', async (d: any) => {
    try {
      await d.dismiss();
    } catch {}
  });
  await page.addInitScript(() => {
    try {
      // @ts-ignore
      const stub = { writeText: async (_t: string) => void 0 };
      // @ts-ignore
      if (navigator && !navigator.clipboard) {
        // @ts-ignore
        Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
      } else {
        // @ts-ignore
        Object.defineProperty(navigator, 'clipboard', { value: stub, configurable: true });
      }
    } catch {}
  });

  const assertClean = await assertNoConsoleErrors(page);

  // 홈
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /AI로 만드는 영상 시나리오/ })).toBeVisible();

  // 위저드 이동
  await page.getByRole('link', { name: 'AI 영상 생성' }).first().click();
  await expect(page).toHaveURL(/\/workflow/);

  // 위저드 주요 버튼 (위저드 페이지에서 수행)
  await page.goto('/wizard');
  await page.waitForLoadState('networkidle');
  await safeClickEnabled(page.getByTestId('generate-btn-side').first()); // 빈 시나리오면 disabled 확인
  await page.getByTestId('sample-fill-btn').first().click();
  await page.getByTestId('generate-btn-side').first().click();
  await page.getByTestId('copy-veo3-btn').click();

  // 에디터로 열기
  await page.getByRole('main').getByTestId('actionbar-open-editor').click();
  await expect(page.getByRole('heading', { name: /에디터|Editor/i })).toBeVisible({
    timeout: 5000,
  });

  // 뒤로 이동 후 통합 페이지 체크
  await page.goBack();
  await page.goto('/integrations');
  await expect(page.getByTestId('category-select')).toBeVisible();
  await page.getByTestId('category-select').selectOption({ index: 1 });
  await page.getByTestId('search-input').fill('a');

  // 최근 항목 영역 버튼
  await page.goto('/wizard');
  await page.getByTestId('sample-fill-btn').first().click();
  await page.getByTestId('generate-btn-side').first().click();
  await page.getByTestId('sample-fill-btn').first().click();
  await page.getByTestId('generate-btn-side').first().click();
  await page.getByTestId('copy-veo3-btn').click();
  await page.reload();
  const list = page.locator('ul >> li >> [data-testid="recent-item-toggle"]');
  if (await list.count()) {
    await list.first().click();
  }

  await assertClean();
});
