/**
 * AI 기획 페이지 포괄적 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 기본 성공 플로우 - 전체 워크플로우 완주
 * 2. 특수 케이스 - 장르 "기타" 선택, 프리셋 사용
 * 3. 입력 검증 - 필수 필드, 버튼 활성화/비활성화
 * 4. 네비게이션 - 단계 이동, 상태 유지
 * 5. 에러 처리 - API 실패, 네트워크 오류
 * 6. 접근성 - 키보드 네비게이션, 스크린 리더
 */

import { test, expect } from '@playwright/test';

// 테스트 헬퍼 함수들
async function assertNoConsoleErrors(page: any) {
  const errors: string[] = [];
  const ignored = [
    /auto imagen preview failed/i,
    /Failed to fetch/i,
    /Failed to load resource:.*404/i,
    /ResizeObserver loop limit exceeded/i,
    /Non-Error promise rejection captured/i
  ];

  page.on('pageerror', (e: any) => {
    const text = e?.message ? String(e.message) : String(e);
    if (!ignored.some((re) => re.test(text))) errors.push(text);
  });

  page.on('console', (msg: any) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!ignored.some((re) => re.test(text))) errors.push(text);
  });

  return () => expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([]);
}

async function fillRequiredFields(page: any) {
  // 제목 입력
  await page.fill('input[placeholder*="영상 제목"]', '테스트 영상 기획');

  // 로그라인 입력
  await page.fill('textarea[placeholder*="영상의 핵심 내용"]', '테스트를 위한 간단한 영상 스토리입니다.');

  // 타겟 오디언스 입력
  await page.fill('input[placeholder*="20-30대 젊은 층"]', '20-30대 IT 종사자');

  // 톤앤매너 선택 - 더 정확한 셀렉터 사용
  const toneSelect = page.locator('select').nth(0); // 첫 번째 select 요소
  await toneSelect.selectOption('calm');

  // 장르 선택 - 더 정확한 셀렉터 사용
  const genreSelect = page.locator('select').nth(1); // 두 번째 select 요소
  await genreSelect.selectOption('drama');
}

async function waitForStepTransition(page: any, expectedStep: number) {
  // 단계 전환 애니메이션 대기
  await page.waitForTimeout(500);

  // 단계 인디케이터 확인
  const stepIndicator = page.locator(`[class*="bg-blue-600"]:has-text("${expectedStep}")`);
  await expect(stepIndicator).toBeVisible();
}

test.describe('AI 기획 페이지 포괄적 E2E 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 모든 다이얼로그 자동 해제
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    // 클립보드 API 모킹
    await page.addInitScript(() => {
      const stub = { writeText: async (_text: string) => void 0 };
      Object.defineProperty(navigator, 'clipboard', {
        value: stub,
        configurable: true
      });
    });
  });

  test('시나리오 1: 기본 성공 플로우 - 전체 워크플로우 완주', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    // 1. 기획 관리 페이지 접속
    await page.goto('/planning');
    await expect(page.locator('h1:has-text("기획 관리")')).toBeVisible();

    // 2. 새 기획 만들기 클릭 (Create 페이지로 이동)
    await page.goto('/planning/create');
    await expect(page.locator('h1:has-text("영상 기획")')).toBeVisible();

    // 3. Step 1 - 기본 정보 입력
    await expect(page.locator('h2:has-text("기본 정보 입력 및 선택")')).toBeVisible();

    // 필수 필드 입력
    await fillRequiredFields(page);

    // 다음 단계 버튼이 활성화되었는지 확인
    const nextButton1 = page.locator('button:has-text("다음 단계: 전개 방식")');
    await expect(nextButton1).toBeEnabled();

    // 다음 단계로 이동
    await nextButton1.click();
    await waitForStepTransition(page, 2);

    // 4. Step 2 - 전개 방식 설정
    await expect(page.locator('h2:has-text("스토리 전개 방식 설정")')).toBeVisible();

    // 전개 방식 선택
    await page.locator('button:has-text("기승전결")').click();
    await expect(page.locator('button:has-text("기승전결")[class*="border-blue-500"]')).toBeVisible();

    // 전개 강도 선택
    await page.locator('button:has-text("적당히")').click();
    await expect(page.locator('button:has-text("적당히")[class*="border-blue-500"]')).toBeVisible();

    // 설정 요약 확인
    await expect(page.locator('text=제목: 테스트 영상 기획')).toBeVisible();
    await expect(page.locator('text=전개 방식: 기승전결')).toBeVisible();

    // 기획안 생성 버튼 클릭
    const generateButton = page.locator('button:has-text("다음 단계: 기획 완성")');
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // 로딩 상태 확인
    await expect(page.locator('text=기획안 생성 중...')).toBeVisible({ timeout: 2000 });

    // 5. Step 3 - 기획 완성 확인
    await expect(page.locator('h2:has-text("기획안 완성 및 확인")')).toBeVisible({ timeout: 10000 });

    // 생성된 기획안 확인
    await expect(page.locator('text=AI가 생성한 기획안')).toBeVisible();
    await expect(page.locator('text=기획 요약')).toBeVisible();

    // 저장 버튼 확인
    const saveButton = page.locator('button:has-text("기획안 저장 및 완료")');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();

    await assertClean();
  });

  test('시나리오 2: 특수 케이스 - 장르 "기타" 선택과 프리셋 사용', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 프리셋 사용 테스트
    await page.locator('button:has-text("브랜드 30초")').click();

    // 프리셋 적용 확인 - value 속성 대신 선택된 옵션 확인
    const durationSelect = page.locator('select').nth(2);
    const genreSelect = page.locator('select').nth(1);

    await expect(durationSelect).toHaveValue('30');
    await expect(genreSelect).toHaveValue('advertisement');

    // 장르를 "기타"로 변경
    await genreSelect.selectOption('other');

    // 커스텀 장르 입력 필드 활성화 확인
    await expect(page.locator('input[placeholder*="예: 판타지, 스릴러"]')).toBeVisible();

    // 커스텀 장르 입력
    await page.fill('input[placeholder*="예: 판타지, 스릴러"]', '웹툰 원작');

    // 필수 필드 입력
    await page.fill('input[placeholder*="영상 제목"]', '웹툰 원작 영상');
    await page.fill('textarea[placeholder*="영상의 핵심 내용"]', '인기 웹툰을 원작으로 한 영상 콘텐츠');
    await page.selectOption('select', 'dramatic');

    // 다음 단계로 진행 가능한지 확인
    const nextButton = page.locator('button:has-text("다음 단계: 전개 방식")');
    await expect(nextButton).toBeEnabled();

    await assertClean();
  });

  test('시나리오 3: 입력 검증 - 필수 필드 및 버튼 상태', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 초기 상태에서 다음 단계 버튼이 비활성화되어 있는지 확인
    const nextButton = page.locator('button:has-text("다음 단계: 전개 방식")');
    await expect(nextButton).toBeDisabled();

    // 제목만 입력
    await page.fill('input[placeholder*="영상 제목"]', '테스트');
    await expect(nextButton).toBeDisabled(); // 여전히 비활성화

    // 로그라인 추가 입력
    await page.fill('textarea[placeholder*="영상의 핵심 내용"]', '테스트 로그라인');
    await expect(nextButton).toBeDisabled(); // 여전히 비활성화

    // 장르 선택
    await page.selectOption('select', 'drama');
    await expect(nextButton).toBeEnabled(); // 이제 활성화

    // 장르를 "기타"로 변경하고 커스텀 입력 없이 시도
    await page.selectOption('select', 'other');
    await expect(nextButton).toBeEnabled(); // 아직 활성화 (커스텀 입력 검증은 Step2에서)

    // 커스텀 장르 입력 후 다음 단계로
    await page.fill('input[placeholder*="예: 판타지, 스릴러"]', '');
    await page.fill('input[placeholder*="예: 판타지, 스릴러"]', '커스텀 장르');

    // 톤앤매너 선택
    await page.selectOption('select', 'calm');

    await nextButton.click();
    await waitForStepTransition(page, 2);

    // Step 2에서 아무것도 선택하지 않으면 버튼 비활성화
    const generateButton = page.locator('button:has-text("다음 단계: 기획 완성")');
    await expect(generateButton).toBeDisabled();

    // 전개 방식만 선택
    await page.locator('button:has-text("기승전결")').click();
    await expect(generateButton).toBeDisabled(); // 여전히 비활성화

    // 전개 강도도 선택
    await page.locator('button:has-text("적당히")').click();
    await expect(generateButton).toBeEnabled(); // 이제 활성화

    await assertClean();
  });

  test('시나리오 4: 네비게이션 - 단계 이동 및 상태 유지', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 첫 번째 단계에서 데이터 입력
    await fillRequiredFields(page);
    await page.selectOption('select', '60');
    await page.selectOption('select', 'animation');

    // 다음 단계로 이동
    await page.locator('button:has-text("다음 단계: 전개 방식")').click();
    await waitForStepTransition(page, 2);

    // 두 번째 단계에서 선택
    await page.locator('button:has-text("픽사")').click();
    await page.locator('button:has-text("풍부하게")').click();

    // 이전 단계로 돌아가기
    await page.locator('button:has-text("이전 단계")').click();
    await waitForStepTransition(page, 1);

    // 입력값들이 유지되는지 확인
    await expect(page.locator('input[value="테스트 영상 기획"]')).toBeVisible();
    await expect(page.locator('select[value="60"]')).toBeVisible();
    await expect(page.locator('select[value="animation"]')).toBeVisible();

    // 다시 두 번째 단계로 이동
    await page.locator('button:has-text("다음 단계: 전개 방식")').click();
    await waitForStepTransition(page, 2);

    // 이전 선택값들이 유지되는지 확인
    await expect(page.locator('button:has-text("픽사")[class*="border-blue-500"]')).toBeVisible();
    await expect(page.locator('button:has-text("풍부하게")[class*="border-blue-500"]')).toBeVisible();

    // 요약 섹션에서 모든 정보 확인
    await expect(page.locator('text=제목: 테스트 영상 기획')).toBeVisible();
    await expect(page.locator('text=분량: 60초')).toBeVisible();
    await expect(page.locator('text=전개 방식: 픽사')).toBeVisible();
    await expect(page.locator('text=전개 강도: 풍부하게')).toBeVisible();

    await assertClean();
  });

  test('시나리오 5: 진행률 표시 정확성', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 초기 진행률 0% 확인
    await expect(page.locator('text=0%')).toBeVisible();

    // 제목만 입력 (아직 0%)
    await page.fill('input[placeholder*="영상 제목"]', '테스트');
    await expect(page.locator('text=0%')).toBeVisible();

    // 모든 필수 필드 입력 후 100% 확인
    await fillRequiredFields(page);
    await expect(page.locator('text=100%')).toBeVisible();

    // 다음 단계로 이동 후 0% 확인
    await page.locator('button:has-text("다음 단계: 전개 방식")').click();
    await waitForStepTransition(page, 2);
    await expect(page.locator('text=0%')).toBeVisible();

    // 전개 방식만 선택 (아직 0%)
    await page.locator('button:has-text("기승전결")').click();
    await expect(page.locator('text=0%')).toBeVisible();

    // 전개 강도까지 선택 후 100% 확인
    await page.locator('button:has-text("적당히")').click();
    await expect(page.locator('text=100%')).toBeVisible();

    await assertClean();
  });

  test('시나리오 6: 접근성 - 키보드 네비게이션', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 탭 키로 네비게이션 테스트
    await page.keyboard.press('Tab'); // 제목 필드로 이동
    await expect(page.locator('input[placeholder*="영상 제목"]')).toBeFocused();

    await page.keyboard.type('키보드 테스트 제목');

    await page.keyboard.press('Tab'); // 타겟 필드로 이동
    await expect(page.locator('input[placeholder*="20-30대 젊은 층"]')).toBeFocused();

    await page.keyboard.type('키보드 사용자');

    await page.keyboard.press('Tab'); // 로그라인으로 이동
    await expect(page.locator('textarea[placeholder*="영상의 핵심 내용"]')).toBeFocused();

    await page.keyboard.type('키보드로 입력하는 로그라인');

    // 드롭다운은 마우스로 선택 (키보드 네비게이션은 복잡함)
    await page.selectOption('select', 'calm');
    await page.selectOption('select', 'drama');

    // Enter 키로 다음 단계 버튼 클릭
    await page.locator('button:has-text("다음 단계: 전개 방식")').focus();
    await page.keyboard.press('Enter');

    await waitForStepTransition(page, 2);

    // 방향키로 버튼 선택 (접근성 향상을 위한 제안)
    await page.locator('button:has-text("기승전결")').focus();
    await page.keyboard.press('Enter');

    await page.locator('button:has-text("적당히")').focus();
    await page.keyboard.press('Enter');

    await assertClean();
  });

  test('시나리오 7: 에러 처리 - 네트워크 오류 시뮬레이션', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 모든 필드 입력
    await fillRequiredFields(page);
    await page.locator('button:has-text("다음 단계: 전개 방식")').click();
    await waitForStepTransition(page, 2);

    await page.locator('button:has-text("기승전결")').click();
    await page.locator('button:has-text("적당히")').click();

    // API 요청 실패 시뮬레이션
    await page.route('**/api/ai/generate-planning', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    // 기획안 생성 버튼 클릭
    await page.locator('button:has-text("다음 단계: 기획 완성")').click();

    // 로딩 상태 확인
    await expect(page.locator('text=기획안 생성 중...')).toBeVisible();

    // API 실패 후에도 기본 기획안이 생성되는지 확인
    await expect(page.locator('h2:has-text("기획안 완성 및 확인")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=기획 요약')).toBeVisible();

    await assertClean();
  });

  test('시나리오 8: 모든 드롭다운 옵션 선택 테스트', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    // 톤앤매너 모든 옵션 테스트
    const toneOptions = ['calm', 'lively', 'thrilling', 'cute', 'chic', 'dramatic'];
    for (const option of toneOptions) {
      await page.selectOption('select', option);
      await expect(page.locator(`select[value="${option}"]`)).toBeVisible();
    }

    // 장르 모든 옵션 테스트
    const genreOptions = ['drama', 'horror', 'sf', 'action', 'advertisement', 'documentary', 'comedy', 'romance'];
    for (const option of genreOptions) {
      await page.selectOption('select', option);
      await expect(page.locator(`select[value="${option}"]`)).toBeVisible();
    }

    // 분량 모든 옵션 테스트
    const durationOptions = ['15', '30', '60', '90', '120'];
    for (const option of durationOptions) {
      await page.selectOption('select', option);
      await expect(page.locator(`select[value="${option}"]`)).toBeVisible();
    }

    // 포맷 모든 옵션 테스트
    const formatOptions = ['interview', 'storytelling', 'animation', 'motion-graphics', 'live-action', 'mixed'];
    for (const option of formatOptions) {
      await page.selectOption('select', option);
      await expect(page.locator(`select[value="${option}"]`)).toBeVisible();
    }

    // 템포 모든 옵션 테스트
    const tempoOptions = ['fast', 'normal', 'slow'];
    for (const option of tempoOptions) {
      await page.selectOption('select', option);
      await expect(page.locator(`select[value="${option}"]`)).toBeVisible();
    }

    await assertClean();
  });

  test('시나리오 9: 모든 프리셋 버튼 테스트', async ({ page }) => {
    const assertClean = await assertNoConsoleErrors(page);

    await page.goto('/planning/create');

    const durationSelect = page.locator('select').nth(2); // 분량 select
    const genreSelect = page.locator('select').nth(1); // 장르 select

    // 브랜드 30초 프리셋
    await page.locator('button:has-text("브랜드 30초")').click();
    await expect(durationSelect).toHaveValue('30');
    await expect(genreSelect).toHaveValue('advertisement');

    // 다큐 90초 프리셋
    await page.locator('button:has-text("다큐 90초")').click();
    await expect(durationSelect).toHaveValue('90');
    await expect(genreSelect).toHaveValue('documentary');

    // 드라마 60초 프리셋
    await page.locator('button:has-text("드라마 60초")').click();
    await expect(durationSelect).toHaveValue('60');
    await expect(genreSelect).toHaveValue('drama');

    // 액션 45초 프리셋
    await page.locator('button:has-text("액션 45초")').click();
    await expect(durationSelect).toHaveValue('60'); // 실제로는 60초로 설정됨
    await expect(genreSelect).toHaveValue('action');

    await assertClean();
  });
});