import { test, expect } from '@playwright/test';

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000';

test('워크플로우: 스토리→시나리오→프롬프트→영상→공유', async ({ page }) => {
  // API 모킹 상태 공유
  await page.route('**/api/ai/generate-story', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        structure: ['도입', '전개', '위기', '해결'],
        camera_setting: { primary_lens: ['50mm'] },
      }),
    });
  });

  await page.route('**/api/ai/generate-prompt', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        final_prompt: 'final prompt',
        negative_prompt: 'blur',
        keywords: ['city', 'night'],
        base_style: { style: ['Cinematic'] },
        timeline: [{ t: 0, k: 'start' }],
      }),
    });
  });

  await page.route('**/api/planning/prompt', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { id: 'prompt-1', version: 1 } }),
    });
  });

  await page.route('**/api/video/create', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        provider: 'mock',
        videoUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
        status: 'completed',
      }),
    });
  });

  await page.route('**/api/planning/videos', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          id: 'video-asset-1',
          status: 'completed',
          url: 'data:image/svg+xml;base64,PHN2Zy8+',
        },
      }),
    });
  });

  await page.route('**/api/shares', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: { token: 'tok-123', role: 'commenter', expiresAt: new Date().toISOString() },
      }),
    });
  });

  // 페이지 방문
  await page.goto(`${BASE}/workflow`);
  await page.waitForLoadState('networkidle');
  // 라우팅 실패/SSR 지연 시 폴백
  const titleLocator = page.getByTestId('workflow-title');
  try {
    await titleLocator.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    await page.goto(`${BASE}/workflow`);
    await page.waitForLoadState('networkidle');
    await titleLocator.waitFor({ state: 'visible', timeout: 10000 });
  }
  await expect(page.getByTestId('workflow-story-input')).toBeVisible();

  // Step1 입력
  await page.getByTestId('workflow-story-input').fill('테스트 스토리');
  await page.locator('select').nth(0).selectOption('Action-Thriller');
  await page.locator('select').nth(1).selectOption('serious');
  await page.getByRole('button', { name: '다음 단계: 시나리오 개발' }).click();

  // Step2 확인 및 다음
  await expect(page.getByText('AI가 4단계 시나리오를 생성했습니다')).toBeVisible();
  await page.getByRole('button', { name: '다음 단계: 프롬프트 생성' }).click();

  // Step3 프롬프트 생성
  await expect(page.getByText('INSTRUCTION.md 기반 체계적 프롬프트 생성')).toBeVisible();
  const generateBtn = page.getByRole('button', { name: /AI 프롬프트 생성하기/ });
  await generateBtn.click();

  // Step4 영상 생성
  await page.getByRole('button', { name: /영상 생성 시작/ }).click();
  await expect(page.getByText('영상 생성 완료')).toBeVisible({ timeout: 15000 });

  // 공유 링크 발급(알럿 캡처)
  const dialogPromise = new Promise<void>((resolve) => {
    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
      resolve();
    });
  });
  await page.getByRole('button', { name: '피드백 공유 링크 복사' }).click();
  await dialogPromise;
});
