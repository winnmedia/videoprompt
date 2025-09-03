import { test, expect } from '@playwright/test';

test.describe('관리자 대시보드', () => {
  test('대시보드 핵심 요소 렌더링', async ({ page }) => {
    await page.goto('/admin?token=test-token');
    await expect(page.locator('h1')).toHaveText(/관리자 대시보드/);
    await expect(page.getByRole('heading', { name: '사용자', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '프로젝트', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '시나리오', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '프롬프트', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '영상 자산', exact: true })).toBeVisible();
  });

  test('최근 테이블들 표시', async ({ page }) => {
    await page.goto('/admin?token=test-token');
    await expect(page.getByText('최근 프로젝트')).toBeVisible();
    await expect(page.getByText('최근 시나리오')).toBeVisible();
    await expect(page.getByText('최근 영상 자산')).toBeVisible();
  });

  test('필터/제공자 상태/재시도 UI 노출', async ({ page }) => {
    await page.goto('/admin?token=test-token');
    await expect(page.getByRole('heading', { name: '필터' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '외부 제공자 상태' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '실패 영상 재시도(데모)' })).toBeVisible();
  });

  test('필터 검색 작동 및 결과 섹션 표시', async ({ page }) => {
    await page.goto('/admin?token=test-token');
    await page.getByRole('button', { name: '검색' }).click();
    await expect(page.getByRole('heading', { name: '검색 결과' })).toBeVisible();
  });
});


