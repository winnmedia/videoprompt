import { test, expect } from '@playwright/test';

const BASE = process.env.PW_BASE_URL || 'http://localhost:3100';

test('피드백: 토큰 유효성 검증 및 댓글 작성', async ({ page }) => {
  // 토큰 검증, 댓글 목록/작성 모킹
  await page.route('**/api/shares/*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          token: 'tok-123',
          role: 'commenter',
          nickname: 'guest',
          targetType: 'video',
          targetId: 'video-asset-1',
        },
      }),
    });
  });
  await page.route('**/api/comments?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] }),
    });
  });
  await page.route('**/api/comments', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { id: 'c1', createdAt: new Date().toISOString() } }),
    });
  });

  await page.goto(`${BASE}/feedback?videoId=video-asset-1&token=tok-123`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('feedback-comments-title')).toBeVisible();
  await page.getByTestId('feedback-textarea').fill('테스트 댓글 @TC0000');

  // 등록(알럿 사용 안함: POST 200으로 완료)
  await page.getByRole('button', { name: '등록' }).click();
  await expect(page.getByText(/우측 탭 컨텐츠는 추후 연동합니다/)).toBeVisible();
});
