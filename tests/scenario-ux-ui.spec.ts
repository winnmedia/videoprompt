import { test, expect } from '@playwright/test';

test.describe('시나리오 페이지 UX/UI 점검', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scenario');
  });

  test('1단계: 스토리 입력 UI 요소 점검', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText('AI 시나리오 생성');

    // 진행 단계 표시 확인
    await expect(page.locator('text=스토리 입력')).toBeVisible();
    await expect(page.locator('text=4단계 구성')).toBeVisible();
    await expect(page.locator('text=숏트 분해')).toBeVisible();

    // 진행률 바 확인
    await expect(page.locator('.bg-primary')).toBeVisible();

    // 1단계 폼 요소들 확인
    await expect(page.locator('label:has-text("제목")')).toBeVisible();
    await expect(page.locator('input[placeholder*="시나리오 제목"]')).toBeVisible();

    await expect(page.locator('label:has-text("한 줄 스토리")')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="스토리의 핵심"]')).toBeVisible();

    await expect(page.locator('label:has-text("타겟")')).toBeVisible();
    await expect(page.locator('input[placeholder*="타겟 시청자"]')).toBeVisible();

    await expect(page.locator('label:has-text("분량")')).toBeVisible();
    await expect(page.locator('input[placeholder*="30초, 60초, 90초"]')).toBeVisible();
  });

  test('톤앤매너 체크박스 UI 점검', async ({ page }) => {
    // 톤앤매너 섹션 확인
    await expect(page.locator('label:has-text("톤앤매너 (다중 선택)")')).toBeVisible();

    // 체크박스 옵션들 확인
    const toneOptions = [
      '드라마틱',
      '코믹',
      '로맨틱',
      '미스터리',
      '액션',
      '감성적',
      '유머러스',
      '진지한',
      '판타지',
      '현실적',
    ];

    for (const tone of toneOptions) {
      const checkbox = page.locator(`input[type="checkbox"]:has-text("${tone}")`);
      await expect(checkbox).toBeVisible();
    }

    // 체크박스 선택 테스트
    await page.locator('input[type="checkbox"]:has-text("드라마틱")').check();
    await page.locator('input[type="checkbox"]:has-text("액션")').check();

    // 선택된 옵션 미리보기 확인
    await expect(page.locator('text=톤앤매너: 드라마틱, 액션')).toBeVisible();
  });

  test('템포 및 전개 강도 라디오 버튼 UI 점검', async ({ page }) => {
    // 템포 라디오 버튼 확인
    await expect(page.locator('label:has-text("템포")')).toBeVisible();
    const tempoOptions = ['빠르게', '보통', '느리게'];

    for (const tempo of tempoOptions) {
      const radio = page.locator(`input[type="radio"][value="${tempo}"]`);
      await expect(radio).toBeVisible();
    }

    // 전개 강도 라디오 버튼 확인
    await expect(page.locator('label:has-text("전개 강도")')).toBeVisible();
    const intensityOptions = ['그대로', '적당히', '풍부하게'];

    for (const intensity of intensityOptions) {
      const radio = page.locator(`input[type="radio"][value="${intensity}"]`);
      await expect(radio).toBeVisible();
    }

    // 라디오 버튼 선택 테스트
    await page.locator('input[type="radio"][value="빠르게"]').check();
    await page.locator('input[type="radio"][value="풍부하게"]').check();

    // 선택된 옵션 미리보기 확인
    await expect(page.locator('text=템포: 빠르게')).toBeVisible();
    await expect(page.locator('text=전개 강도: 풍부하게')).toBeVisible();
  });

  test('드롭다운 선택 UI 점검', async ({ page }) => {
    // 장르 드롭다운 확인
    await expect(page.locator('label:has-text("장르")')).toBeVisible();
    await expect(page.locator('select')).toHaveCount(3); // 장르, 포맷, 전개 방식

    // 장르 옵션 선택 테스트
    await page.locator('select').first().selectOption('액션-스릴러');
    await expect(page.locator('text=장르: 액션-스릴러')).toBeVisible();

    // 포맷 옵션 선택 테스트
    await page.locator('select').nth(1).selectOption('16:9');
    await expect(page.locator('text=포맷: 16:9')).toBeVisible();

    // 전개 방식 옵션 선택 테스트
    await page.locator('select').last().selectOption('클래식 기승전결');
    await expect(page.locator('text=전개 방식: 클래식 기승전결')).toBeVisible();
  });

  test('4단계 스토리 생성 버튼 및 상태 점검', async ({ page }) => {
    // 필수 필드 입력
    await page.locator('input[placeholder*="시나리오 제목"]').fill('테스트 시나리오');
    await page.locator('textarea[placeholder*="스토리의 핵심"]').fill('테스트 스토리 내용입니다.');

    // 생성 버튼 확인
    const generateButton = page.locator('button:has-text("4단계 스토리 생성")');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();

    // 버튼 클릭
    await generateButton.click();

    // 로딩 상태 확인 (API 호출 실패 시에도 로딩 상태는 표시되어야 함)
    await expect(page.locator('text=생성 중...')).toBeVisible();
  });

  test('브랜드 색상 및 디자인 일관성 점검', async ({ page }) => {
    // 브랜드 색상 확인 (CSS 변수 사용)
    const primaryColor = await page
      .locator('.bg-primary')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    // 카드 스타일 확인
    await expect(page.locator('.card')).toBeVisible();

    // 입력 필드 스타일 확인
    const inputField = page.locator('input[placeholder*="시나리오 제목"]');
    await expect(inputField).toHaveClass(/input-primary/);

    // 버튼 스타일 확인
    const primaryButton = page.locator('button:has-text("4단계 스토리 생성")');
    await expect(primaryButton).toHaveClass(/btn-primary/);
  });

  test('반응형 디자인 점검', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });

    // 모바일에서 1열 레이아웃 확인
    const formGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2');
    await expect(formGrid).toBeVisible();

    // 체크박스가 2열로 배치되는지 확인
    const toneCheckboxes = page.locator('.grid.grid-cols-2.gap-2');
    await expect(toneCheckboxes).toBeVisible();

    // 데스크톱 뷰포트로 복원
    await page.setViewportSize({ width: 1280, height: 720 });

    // 데스크톱에서 2열 레이아웃 확인
    await expect(page.locator('.grid.grid-cols-1.lg\\:grid-cols-2')).toBeVisible();
  });

  test('접근성 점검', async ({ page }) => {
    // 모든 입력 필드에 라벨이 있는지 확인
    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      if (id) {
        await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      }
    }

    // 포커스 표시 확인
    await page.locator('input[placeholder*="시나리오 제목"]').focus();
    await expect(page.locator('input[placeholder*="시나리오 제목"]')).toHaveCSS('outline', /none/);
    await expect(page.locator('input[placeholder*="시나리오 제목"]')).toHaveCSS('ring', /2px/);
  });
});
