/**
 * AI 기획 페이지 디버깅 테스트
 * 기본적인 문제 파악을 위한 간단한 테스트
 */

import { test, expect } from '@playwright/test';

test.describe('AI 기획 페이지 디버깅', () => {
  test('기본 페이지 로드 및 요소 확인', async ({ page }) => {
    // 1. 페이지 접속
    await page.goto('http://localhost:3001/planning/create');

    // 2. 페이지 제목 확인
    await expect(page.locator('h1:has-text("영상 기획")')).toBeVisible({ timeout: 10000 });

    // 3. 스크린샷 촬영
    await page.screenshot({ path: 'planning-page-debug.png', fullPage: true });

    // 4. 모든 select 요소 찾기
    const selects = page.locator('select');
    const selectCount = await selects.count();
    console.log(`Found ${selectCount} select elements`);

    // 5. 각 select 요소의 정보 출력
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const options = select.locator('option');
      const optionCount = await options.count();
      console.log(`Select ${i}: ${optionCount} options`);

      // 첫 번째 옵션의 텍스트 확인
      if (optionCount > 0) {
        const firstOptionText = await options.first().textContent();
        console.log(`  First option: "${firstOptionText}"`);
      }
    }

    // 6. 모든 버튼 찾기
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} button elements`);

    // 7. 프리셋 버튼들 확인
    const presetButtons = page.locator('button[class*="rounded-xl"][class*="border"]');
    const presetCount = await presetButtons.count();
    console.log(`Found ${presetCount} preset buttons`);

    // 8. 입력 필드들 확인
    const inputs = page.locator('input, textarea');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} input elements`);
  });

  test('프리셋 버튼 클릭 테스트', async ({ page }) => {
    await page.goto('http://localhost:3001/planning/create');
    await expect(page.locator('h1:has-text("영상 기획")')).toBeVisible({ timeout: 10000 });

    // 프리셋 버튼 찾기
    const brandButton = page.locator('button:has-text("브랜드 30초")');
    await expect(brandButton).toBeVisible();

    // 클릭 전 상태
    const durationSelect = page.locator('select').nth(2);
    const initialValue = await durationSelect.inputValue();
    console.log(`Duration select initial value: "${initialValue}"`);

    // 프리셋 버튼 클릭
    await brandButton.click();

    // 클릭 후 상태
    await page.waitForTimeout(1000); // 상태 변경 대기
    const afterValue = await durationSelect.inputValue();
    console.log(`Duration select after click: "${afterValue}"`);

    // 스크린샷 촬영
    await page.screenshot({ path: 'after-preset-click.png', fullPage: true });
  });

  test('드롭다운 선택 테스트', async ({ page }) => {
    await page.goto('http://localhost:3001/planning/create');
    await expect(page.locator('h1:has-text("영상 기획")')).toBeVisible({ timeout: 10000 });

    // 톤앤매너 선택 테스트
    const toneSelect = page.locator('select').first();
    console.log('Trying to select tone option...');

    try {
      await toneSelect.selectOption('calm');
      const value = await toneSelect.inputValue();
      console.log(`Tone select value after selection: "${value}"`);
    } catch (error) {
      console.log(`Error selecting tone: ${error}`);
    }

    // 장르 선택 테스트
    const genreSelect = page.locator('select').nth(1);
    console.log('Trying to select genre option...');

    try {
      await genreSelect.selectOption('drama');
      const value = await genreSelect.inputValue();
      console.log(`Genre select value after selection: "${value}"`);
    } catch (error) {
      console.log(`Error selecting genre: ${error}`);
    }

    // 최종 스크린샷
    await page.screenshot({ path: 'after-dropdown-selection.png', fullPage: true });
  });

  test('입력 필드 테스트', async ({ page }) => {
    await page.goto('http://localhost:3001/planning/create');
    await expect(page.locator('h1:has-text("영상 기획")')).toBeVisible({ timeout: 10000 });

    // 제목 입력 테스트
    const titleInput = page.locator('input[placeholder*="영상 제목"]');
    await expect(titleInput).toBeVisible();

    try {
      await titleInput.fill('테스트 제목');
      const value = await titleInput.inputValue();
      console.log(`Title input value: "${value}"`);
    } catch (error) {
      console.log(`Error filling title: ${error}`);
    }

    // 로그라인 입력 테스트
    const loglineTextarea = page.locator('textarea[placeholder*="영상의 핵심 내용"]');
    await expect(loglineTextarea).toBeVisible();

    try {
      await loglineTextarea.fill('테스트 로그라인');
      const value = await loglineTextarea.inputValue();
      console.log(`Logline textarea value: "${value}"`);
    } catch (error) {
      console.log(`Error filling logline: ${error}`);
    }

    // 최종 스크린샷
    await page.screenshot({ path: 'after-input-test.png', fullPage: true });
  });
});