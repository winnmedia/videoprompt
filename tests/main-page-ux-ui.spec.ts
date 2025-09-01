import { test, expect } from '@playwright/test';

test.describe('메인 페이지 UX/UI 점검', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('히어로 섹션 UI 요소 점검', async ({ page }) => {
    // 메인 제목 확인
    await expect(page.locator('h1')).toContainText('AI로 만드는');
    await expect(page.locator('h1')).toContainText('전문적인 영상 콘텐츠');

    // 서브 설명 확인
    await expect(page.locator('p')).toContainText('시나리오부터 영상 제작까지');

    // CTA 버튼들 확인
    await expect(page.locator('button:has-text("시나리오 시작하기")')).toBeVisible();
    await expect(page.locator('button:has-text("영상 생성하기")')).toBeVisible();

    // 버튼 스타일 확인
    const primaryButton = page.locator('button:has-text("시나리오 시작하기")');
    const secondaryButton = page.locator('button:has-text("영상 생성하기")');

    await expect(primaryButton).toHaveClass(/btn-primary/);
    await expect(secondaryButton).toHaveClass(/btn-secondary/);
  });

  test('빠른 시작 섹션 UI 점검', async ({ page }) => {
    // 섹션 제목 확인
    await expect(page.locator('h2:has-text("빠른 시작")')).toBeVisible();

    // 4개 퀵 액션 버튼 확인
    const quickActionButtons = page.locator(
      '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4 button',
    );
    await expect(quickActionButtons).toHaveCount(4);

    // 각 버튼의 아이콘과 텍스트 확인
    await expect(page.locator('button:has-text("AI 이미지 생성")')).toBeVisible();
    await expect(page.locator('button:has-text("AI 동영상 생성")')).toBeVisible();
    await expect(page.locator('button:has-text("AI 시나리오 생성")')).toBeVisible();
    await expect(page.locator('button:has-text("기획안 관리")')).toBeVisible();

    // 버튼 스타일 확인
    await expect(page.locator('button:has-text("AI 이미지 생성")')).toHaveClass(/btn-secondary/);
    await expect(page.locator('button:has-text("AI 동영상 생성")')).toHaveClass(/btn-secondary/);
    await expect(page.locator('button:has-text("AI 시나리오 생성")')).toHaveClass(/btn-secondary/);
    await expect(page.locator('button:has-text("기획안 관리")')).toHaveClass(/btn-secondary/);
  });

  test('핵심 기능 소개 섹션 점검', async ({ page }) => {
    // 3개 기능 카드 확인
    const featureCards = page.locator('.grid.grid-cols-1.md\\:grid-cols-3 > div');
    await expect(featureCards).toHaveCount(3);

    // 각 기능의 제목과 설명 확인
    await expect(page.locator('h3:has-text("AI 시나리오 개발")')).toBeVisible();
    await expect(page.locator('h3:has-text("AI 영상 생성")')).toBeVisible();
    await expect(page.locator('h3:has-text("통합 관리")')).toBeVisible();

    // 아이콘 확인
    await expect(page.locator('.w-16.h-16.bg-primary\\/10')).toHaveCount(3);
  });

  test('사용법 가이드 섹션 점검', async ({ page }) => {
    // 가이드 제목 확인
    await expect(page.locator('h2:has-text("사용법 가이드")')).toBeVisible();

    // 2단계 가이드 확인
    await expect(page.locator('h3:has-text("1단계: 시나리오 작성")')).toBeVisible();
    await expect(page.locator('h3:has-text("2단계: 영상 제작")')).toBeVisible();

    // 단계별 번호 확인
    const stepNumbers = page.locator('.w-5.h-5.bg-primary\\/10');
    await expect(stepNumbers).toHaveCount(6);

    // 카드 스타일 확인
    await expect(page.locator('.card')).toBeVisible();
  });

  test('브랜드 색상 및 디자인 일관성 점검', async ({ page }) => {
    // 브랜드 색상 확인
    const primaryElements = page.locator('.bg-primary\\/10');
    await expect(primaryElements).toHaveCount(6); // 3개 기능 + 6개 단계 번호

    // 그라데이션 배경 확인
    await expect(page.locator('.gradient-hero')).toBeVisible();

    // 카드 스타일 확인
    await expect(page.locator('.card')).toBeVisible();

    // 버튼 스타일 일관성 확인
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const className = await button.getAttribute('class');
      expect(className).toMatch(/btn-primary|btn-secondary/);
    }
  });

  test('반응형 디자인 점검', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });

    // 모바일에서 1열 레이아웃 확인
    await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')).toBeVisible();

    // 모바일에서 1열 기능 카드 확인
    await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-3')).toBeVisible();

    // 태블릿 뷰포트로 변경
    await page.setViewportSize({ width: 768, height: 1024 });

    // 태블릿에서 2열 레이아웃 확인
    await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')).toBeVisible();

    // 데스크톱 뷰포트로 복원
    await page.setViewportSize({ width: 1280, height: 720 });

    // 데스크톱에서 4열 레이아웃 확인
    await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4')).toBeVisible();
  });

  test('버튼 클릭 및 네비게이션 점검', async ({ page }) => {
    // 시나리오 시작하기 버튼 클릭
    await page.locator('button:has-text("시나리오 시작하기")').click();
    await expect(page).toHaveURL('/scenario');

    // 메인 페이지로 돌아가기
    await page.goto('/');

    // 영상 생성하기 버튼 클릭
    await page.locator('button:has-text("영상 생성하기")').click();
    await expect(page).toHaveURL('/wizard');

    // 메인 페이지로 돌아가기
    await page.goto('/');

    // AI 시나리오 생성 버튼 클릭
    await page.locator('button:has-text("AI 시나리오 생성")').click();
    await expect(page).toHaveURL('/scenario');
  });

  test('접근성 및 사용성 점검', async ({ page }) => {
    // 모든 버튼에 적절한 텍스트가 있는지 확인
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const buttonText = await button.textContent();
      expect(buttonText?.trim()).toBeTruthy();
    }

    // 모든 링크가 적절한 텍스트를 가지고 있는지 확인
    const links = page.locator('a');
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const linkText = await link.textContent();
      expect(linkText?.trim()).toBeTruthy();
    }

    // 포커스 표시 확인
    await page.locator('button:has-text("시나리오 시작하기")').focus();
    await expect(page.locator('button:has-text("시나리오 시작하기")')).toHaveCSS('outline', /none/);
    await expect(page.locator('button:has-text("시나리오 시작하기")')).toHaveCSS('ring', /2px/);
  });

  test('성능 및 로딩 점검', async ({ page }) => {
    // 페이지 로딩 시간 측정
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // 로딩 시간이 5초 이내인지 확인
    expect(loadTime).toBeLessThan(5000);

    // 이미지 로딩 확인
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      await expect(image).toBeVisible();
    }

    // 폰트 로딩 확인
    await expect(page.locator('h1')).toHaveCSS('font-family', /geist-sans/);
  });
});
