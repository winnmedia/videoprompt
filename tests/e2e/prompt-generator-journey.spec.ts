import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Run this journey only on Chromium to avoid host deps for WebKit/Mobile
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Run on Chromium to avoid missing system libs in host',
);

// Utility to create a tiny PNG file for upload during the test
function ensureSamplePng(tempDir: string): string {
  const filePath = path.join(tempDir, 'sample.png');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    // 1x1 transparent PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2k1yQAAAAASUVORK5CYII=';
    fs.writeFileSync(filePath, Buffer.from(pngBase64, 'base64'));
  }
  return filePath;
}

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3000';

test.describe('FRD User Journey - Prompt Generator', () => {
  test('User can complete 4-step flow and generate final JSON', async ({ page }) => {
    const samplePng = ensureSamplePng(path.join(process.cwd(), 'tests', 'assets'));

    // Step 0: Navigate to home and then prompt generator
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    // 헤더 네비게이션에서 이동(안정 셀렉터). 실패 시 직접 이동 폴백
    try {
      await page
        .getByTestId('main-nav')
        .getByRole('link', { name: '프롬프트 생성기', exact: true })
        .click();
      await expect(page).toHaveURL(/.*\/prompt-generator/);
    } catch {
      await page.goto(`${BASE_URL}/prompt-generator`);
      await expect(page).toHaveURL(/.*\/prompt-generator/);
    }

    // Step 1: Metadata
    await page.getByLabel('프로젝트명 *').fill('Rooftop Deal Gone Wrong - Full SFX');

    // Select a few styles by clicking their labels (checkbox is sr-only)
    const selectStyle = async (value: string) => {
      const label = page.locator(`label[for="${value}"]`);
      await label.scrollIntoViewIfNeeded();
      await label.click();
    };

    await selectStyle('Cinematic');
    await selectStyle('Action-Thriller');
    await selectStyle('HDR');

    // Aspect Ratio
    await page.getByLabel('종횡비 (Aspect Ratio)').selectOption('21:9');

    await page
      .getByLabel('장면 설명 * (상세한 공간적 배경)')
      .fill(
        'Dimly lit urban rooftop at night, antennas blink red, foggy skyline, distant lightning.',
      );

    await page
      .getByLabel('카메라 설정 * (카메라 움직임과 앵글)')
      .fill(
        'Start with dolly-in, then switch to handheld during action, end with fast pan to chopper light.',
      );

    await page.getByRole('button', { name: '다음 단계 →' }).click();
    await expect(page.getByRole('heading', { name: '장면 요소 정의' })).toBeVisible();

    // Step 2: Elements
    await page.getByRole('button', { name: '캐릭터 추가' }).click();
    await page.getByLabel('캐릭터 설명 *').fill('Two opposing teams in tactical jackets');

    // Upload image for character
    const charInput = page.getByTestId('input-character-image').first();
    await charInput.scrollIntoViewIfNeeded();
    await charInput.setInputFiles(samplePng);

    await page.getByRole('button', { name: '사물 추가' }).click();
    await page.getByLabel('사물 설명 *').fill('Metal briefcase with glowing lock panel');

    // Upload image for object (second file input)
    const objInput = page.getByTestId('input-object-image').first();
    await objInput.scrollIntoViewIfNeeded();
    await objInput.setInputFiles(samplePng);

    await page.getByRole('button', { name: '다음 단계 →' }).click();
    await expect(page.getByRole('heading', { name: '동적 타임라인 연출' })).toBeVisible();

    // Step 3: Timeline (3 segments case: 3s,2s,3s)
    await page.getByRole('button', { name: '세그먼트 추가' }).click();
    await page.getByRole('button', { name: '세그먼트 추가' }).click();
    await page.getByRole('button', { name: '세그먼트 추가' }).click();
    await expect(page.getByTestId('textarea-action')).toHaveCount(3);

    const actionAreas = page.getByTestId('textarea-action');
    const audioAreas = page.getByTestId('textarea-audio');

    await actionAreas.nth(0).fill('Wide shot: teams approach, briefcase opens.');
    await audioAreas.nth(0).fill('Rain on metal, low thunder, latch click.');

    await actionAreas.nth(1).fill('Sniper dot appears, panic, shot fired.');
    await audioAreas.nth(1).fill('Laser whine, shout DOWN!, sniper crack.');

    await actionAreas.nth(2).fill('Hero grabs case and runs, chopper light.');
    await audioAreas.nth(2).fill('Footsteps, gunshots echo, chopper blades.');

    // Verify timestamps for 3 segments: 00:00-00:03, 00:03-00:05, 00:05-00:08
    await expect(page.getByText('00:00-00:03')).toBeVisible();
    await expect(page.getByText('00:03-00:05')).toBeVisible();
    await expect(page.getByText('00:05-00:08')).toBeVisible();

    await page.getByRole('button', { name: '다음 단계 →' }).click();

    // Step 4: AI Assistant & Finalize
    await page.getByRole('button', { name: '최종 프롬프트 생성' }).click();
    // 구조화된 프리뷰의 헤딩들이 보이는지 역할 기반으로 검증 (엄격 모드 회피)
    await expect(page.getByRole('heading', { name: '최종 프롬프트', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '프로젝트 정보' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /타임라인 \(3개 세그먼트\)/ })).toBeVisible();

    // Toggle to raw JSON and assert prompt name exists
    await page.getByRole('button', { name: '원본 보기' }).click();
    await expect(page.locator('pre').first()).toContainText('Rooftop Deal Gone Wrong - Full SFX');
  });
});
