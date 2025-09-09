import { test, expect } from '@playwright/test';

/**
 * 간단한 프롬프트 생성기 E2E 테스트
 * - 기본적인 페이지 로딩과 UI 요소 확인에 중점
 * - 실제 API 호출이나 복잡한 상호작용 없이 UI 검증
 */

test.describe('프롬프트 생성기 기본 UI 테스트', () => {

  test('페이지 기본 로딩 및 UI 요소 확인', async ({ page }) => {
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');

    // 페이지가 정상 로딩되었는지 확인 (타이틀 또는 헤더 요소)
    await expect(page.locator('body')).toBeVisible();
    
    // 스토리 관련 섹션이나 건너뛰기 버튼이 있는지 확인
    const hasStorySection = await page.locator('text=스토리').count() > 0;
    const hasSkipButton = await page.locator('button:has-text("건너뛰기")').count() > 0;
    const hasNewStoryButton = await page.locator('button:has-text("새 스토리")').count() > 0;
    
    console.log('스토리 섹션 존재:', hasStorySection);
    console.log('건너뛰기 버튼 존재:', hasSkipButton);
    console.log('새 스토리 버튼 존재:', hasNewStoryButton);
    
    // 적어도 하나의 주요 버튼이 있어야 함
    expect(hasSkipButton || hasNewStoryButton).toBe(true);
  });

  test('건너뛰기 후 폼 페이지로 이동', async ({ page }) => {
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');

    // 건너뛰기 버튼 클릭
    const skipButton = page.locator('button:has-text("건너뛰기")');
    if (await skipButton.isVisible({ timeout: 5000 })) {
      await skipButton.click();
      
      // 폼 페이지로 이동했는지 확인
      await page.waitForTimeout(1000);
      
      // 프로젝트명 입력 필드가 있는지 확인
      const projectNameInput = page.locator('input[placeholder*="프로젝트"], input[data-testid*="prompt-name"]');
      const hasProjectInput = await projectNameInput.count() > 0;
      
      console.log('프로젝트명 입력 필드 존재:', hasProjectInput);
      
      if (hasProjectInput) {
        await expect(projectNameInput.first()).toBeVisible();
      }
    } else {
      console.log('건너뛰기 버튼을 찾을 수 없음 - 이미 폼 페이지일 수 있음');
    }
  });

  test('기본 폼 요소들 존재 확인', async ({ page }) => {
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');

    // 건너뛰기가 가능하면 클릭
    const skipButton = page.locator('button:has-text("건너뛰기")');
    if (await skipButton.isVisible({ timeout: 3000 })) {
      await skipButton.click();
      await page.waitForTimeout(1000);
    }

    // 폼 요소들 확인
    const formElements = {
      projectInput: await page.locator('input[type="text"]').count(),
      textareas: await page.locator('textarea').count(),
      buttons: await page.locator('button').count(),
      selects: await page.locator('select').count()
    };

    console.log('폼 요소 개수:', formElements);

    // 최소한의 폼 요소들이 있는지 확인
    expect(formElements.projectInput + formElements.textareas).toBeGreaterThan(0);
    expect(formElements.buttons).toBeGreaterThan(0);
  });

  test('스타일 선택 UI 확인 (있는 경우)', async ({ page }) => {
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');

    // 건너뛰기
    const skipButton = page.locator('button:has-text("건너뛰기")');
    if (await skipButton.isVisible({ timeout: 3000 })) {
      await skipButton.click();
      await page.waitForTimeout(1000);
    }

    // 스타일 관련 요소들 확인
    const styleElements = {
      tabs: await page.locator('[data-testid*="style-tab"], button:has-text("영상미"), button:has-text("장르")').count(),
      cards: await page.locator('[data-testid*="style-card"], [class*="style"]').count(),
      checkboxes: await page.locator('input[type="checkbox"]').count()
    };

    console.log('스타일 관련 요소:', styleElements);

    // 스타일 선택 UI가 있다면 기본 동작 테스트
    if (styleElements.tabs > 0) {
      const firstTab = page.locator('[data-testid*="style-tab"], button:has-text("영상미")').first();
      if (await firstTab.isVisible()) {
        await firstTab.click();
        console.log('스타일 탭 클릭 성공');
      }
    }
  });

  test('반응형 디자인 기본 확인', async ({ page }) => {
    // 데스크톱
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');
    
    const desktopElements = await page.locator('button, input, textarea').count();
    console.log('데스크톱 모드 요소 수:', desktopElements);

    // 모바일
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const mobileElements = await page.locator('button, input, textarea').count();
    console.log('모바일 모드 요소 수:', mobileElements);

    // 기본적으로 모바일에서도 주요 요소들이 표시되어야 함
    expect(mobileElements).toBeGreaterThan(0);
  });

  test('페이지 성능 및 로딩 시간 기본 확인', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log('페이지 로딩 시간:', loadTime + 'ms');
    
    // 기본적인 성능 임계값 (10초)
    expect(loadTime).toBeLessThan(10000);
    
    // 페이지의 기본 요소들이 로드되었는지 확인
    const mainContent = await page.locator('main, [role="main"], body > div').count();
    expect(mainContent).toBeGreaterThan(0);
  });

  test('네비게이션 및 라우팅 기본 확인', async ({ page }) => {
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');
    
    // 현재 URL 확인
    expect(page.url()).toContain('/prompt-generator');
    
    // 페이지 제목이 설정되어 있는지 확인
    const title = await page.title();
    console.log('페이지 제목:', title);
    expect(title.length).toBeGreaterThan(0);
    
    // 메타 태그나 기본 SEO 요소 확인
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    if (metaDescription) {
      console.log('메타 설명:', metaDescription);
    }
  });

  test('에러 상태 기본 핸들링', async ({ page }) => {
    // 네트워크 에러 시뮬레이션
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test error' })
      });
    });

    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');
    
    // 에러 상태에서도 페이지가 크래시하지 않고 기본 UI는 표시되는지 확인
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.length || 0).toBeGreaterThan(10);
    
    // 에러 메시지나 폴백 UI 확인
    const hasErrorMessage = await page.locator('text=에러, text=오류, text=실패').count() > 0;
    const hasRetryButton = await page.locator('button:has-text("다시"), button:has-text("재시도")').count() > 0;
    
    console.log('에러 메시지 표시:', hasErrorMessage);
    console.log('재시도 버튼 표시:', hasRetryButton);
  });
});