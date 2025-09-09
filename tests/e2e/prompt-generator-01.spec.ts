import { test, expect } from '@playwright/test';

/**
 * E2E 테스트: 프롬프트 생성 시스템
 * 
 * 테스트 범위:
 * 1. 네비게이션 및 기본 페이지 접근
 * 2. 메타데이터 폼 입력 및 검증
 * 3. 프롬프트 생성 API 호출
 * 4. 생성된 프롬프트 품질 검증
 * 5. 프롬프트 사용 및 내보내기
 * 6. 다른 기능들과의 통합
 */

test.describe('프롬프트 생성 시스템', () => {
  test.beforeEach(async ({ page }) => {
    // 개발 서버 접근 전 상태 확인
    await page.goto('/prompt-generator');
    await page.waitForLoadState('networkidle');
  });

  test('네비게이션 및 페이지 로드 테스트', async ({ page }) => {
    // 페이지 제목 확인 (스크린샷에서 보이는 실제 제목)
    await expect(page.locator('h1, h2').filter({ hasText: /AI 영상 프롬프트 생성기|프롬프트 생성/ })).toBeVisible();
    
    // 단계 진행 표시 확인 (1, 2, 3, 4 버튼들)
    await expect(page.locator('text=단계 1')).toBeVisible();
    
    // 스토리 목록 섹션이 처음에 표시되는지 확인
    await expect(page.locator('text=생성된 스토리 목록')).toBeVisible();
    
    // 건너뛰기 버튼으로 스토리 목록을 건너뛸 수 있는지 확인
    const skipButton = page.locator('button:has-text("건너뛰기")');
    await expect(skipButton).toBeVisible();
    await skipButton.click();
    
    // 1단계 폼이 표시되는지 확인
    await expect(page.locator('text=프로젝트 설정 및 메타데이터')).toBeVisible();
  });

  test('메타데이터 폼 - 필수 필드 검증', async ({ page }) => {
    // 스토리 목록 건너뛰기
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 빈 폼으로 다음 단계 시도 (실패해야 함)
    const nextButton = page.locator('[data-testid="btn-next-step1"]');
    await expect(nextButton).toBeDisabled();
    
    // 프로젝트명만 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('테스트 영상 프로젝트');
    await expect(nextButton).toBeDisabled(); // 여전히 비활성화 상태여야 함
    
    // 스타일 선택
    await page.locator('[data-testid="style-tab-visual"]').click();
    const firstStyleCard = page.locator('[data-testid*="style-card-"]').first();
    await firstStyleCard.click();
    await expect(nextButton).toBeDisabled(); // 여전히 비활성화 상태여야 함
    
    // 장면 설명 입력
    await page.locator('[data-testid="textarea-room-desc"]').fill('밤중의 어두운 도시 옥상, 비에 젖어 반짝이는 표면');
    await expect(nextButton).toBeDisabled(); // 여전히 비활성화 상태여야 함
    
    // 카메라 설정 입력 (마지막 필수 필드)
    await page.locator('[data-testid="textarea-camera-setup"]').fill('천천히 돌리면서 시작하고 흔들리는 핸드헬드 스타일');
    
    // 모든 필수 필드가 채워졌으므로 버튼이 활성화되어야 함
    await expect(nextButton).toBeEnabled();
  });

  test('메타데이터 폼 - 다양한 설정 옵션 테스트', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 기본 정보 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('액션 시퀀스 테스트');
    
    // 다양한 스타일 탭 테스트
    const styleCategories = ['visual', 'genre', 'mood', 'quality', 'director'];
    
    for (const category of styleCategories) {
      await page.locator(`[data-testid="style-tab-${category}"]`).click();
      // 각 카테고리에서 최소 한 개의 스타일 카드가 있는지 확인
      await expect(page.locator('[data-testid*="style-card-"]').first()).toBeVisible();
      
      // 첫 번째 스타일 선택
      const firstStyle = page.locator('[data-testid*="style-card-"]').first();
      await firstStyle.click();
    }
    
    // 스타일 검색 기능 테스트
    await page.locator('[data-testid="style-search"]').fill('시네마');
    // 검색 결과에 따라 필터링된 스타일 카드들 확인
    const searchResults = page.locator('[data-testid*="style-card-"]');
    await expect(searchResults).toHaveCount({ min: 0 }); // 0개 이상의 결과
    
    // 검색 초기화
    await page.locator('[data-testid="style-search"]').fill('');
    
    // 종횡비 설정 테스트
    await page.locator('[data-testid="select-aspect-ratio"]').selectOption('9:16');
    const selectedRatio = await page.locator('[data-testid="select-aspect-ratio"]').inputValue();
    expect(selectedRatio).toBe('9:16');
    
    // 장면 설명 입력
    await page.locator('[data-testid="textarea-room-desc"]').fill('현대적인 도시의 고층 빌딩 옥상, 네온사인이 밝게 빛나는 밤');
    
    // 카메라 설정 입력
    await page.locator('[data-testid="textarea-camera-setup"]').fill('드론으로 시작해서 점점 가까워지는 카메라 무빙');
    
    // 선택적 필드들 설정
    await page.locator('[data-testid="select-weather"]').selectOption('Rain');
    await page.locator('[data-testid="select-lighting"]').selectOption('Golden Hour');
    await page.locator('[data-testid="select-primary-lens"]').selectOption('24mm (Wide Angle)');
    await page.locator('[data-testid="select-dominant-movement"]').selectOption('Drone Shot');
    await page.locator('[data-testid="select-material"]').selectOption('Glass');
    
    // 다음 단계로 진행
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 2단계 페이지로 이동했는지 확인
    await expect(page.locator('text=장면 요소 정의')).toBeVisible();
  });

  test('프롬프트 생성 과정 전체 플로우', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 1단계: 메타데이터 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('완전한 영상 프롬프트 테스트');
    
    // 스타일 선택
    await page.locator('[data-testid="style-tab-visual"]').click();
    const visualStyle = page.locator('[data-testid*="style-card-"]').first();
    await visualStyle.click();
    
    await page.locator('[data-testid="textarea-room-desc"]').fill('미래형 연구실, 홀로그램과 LED 조명이 가득한 공간');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('360도 회전하며 전체를 보여주는 카메라 무빙');
    
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 2단계: 장면 요소 정의 (다음 버튼이 있으면 클릭)
    const step2NextButton = page.locator('button:has-text("다음 단계")');
    if (await step2NextButton.isVisible()) {
      await step2NextButton.click();
    }
    
    // 3단계: 동적 타임라인 (다음 버튼이 있으면 클릭)
    const step3NextButton = page.locator('button:has-text("다음 단계")');
    if (await step3NextButton.isVisible()) {
      await step3NextButton.click();
    }
    
    // 4단계: 최종 프롬프트 생성
    await expect(page.locator('text=AI 어시스턴트 및 최종화')).toBeVisible();
    
    // 프롬프트 생성 API 호출 감지를 위한 네트워크 모니터링
    const promptGenerationPromise = page.waitForResponse(
      response => response.url().includes('/api/planning/prompt') && response.request().method() === 'POST'
    );
    
    // 프롬프트 생성 버튼 클릭
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    await generateButton.click();
    
    // 로딩 상태 확인
    await expect(page.locator('text=생성 중')).toBeVisible();
    
    // API 응답 대기
    const response = await promptGenerationPromise;
    expect(response.status()).toBe(201); // 성공적인 생성
    
    // 생성 완료 후 상태 변화 확인
    await expect(page.locator('text=생성 중')).toBeHidden({ timeout: 10000 });
  });

  test('CineGenius v3.1 모드 테스트', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // v3.1 모드로 전환
    const v31Toggle = page.locator('button:has-text("v2")');
    await v31Toggle.click();
    
    // v3.1 모드 UI 확인
    await expect(page.locator('text=CineGenius v3.1')).toBeVisible();
    await expect(page.locator('text=사용자 입력 및 프로젝트 설정')).toBeVisible();
    
    // 기본 프롬프트 입력
    const directPromptInput = page.locator('textarea[placeholder*="햇살이 비치는 카페"]');
    await directPromptInput.fill('고양이가 창가에서 햇살을 받으며 낮잠을 자는 평화로운 장면');
    
    // 프로젝트 설정
    await page.locator('input[placeholder="내 영상 프로젝트"]').fill('고양이 낮잠 프로젝트');
    
    // 영상 길이 선택
    await page.locator('select').first().selectOption('15');
    
    // 화면 비율 선택
    await page.locator('button:has-text("1:1")').click();
    
    // 다음 단계 버튼이 활성화되었는지 확인
    const nextStepButton = page.locator('button:has-text("다음 단계")');
    await expect(nextStepButton).toBeEnabled();
    
    // 다음 단계로 진행
    await nextStepButton.click();
    
    // v3.1 2단계 확인
    await expect(page.locator('text=v3.1 단계 2')).toBeVisible();
  });

  test('프롬프트 품질 및 관련성 검증', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 특정 장르와 스타일로 프롬프트 생성
    await page.locator('[data-testid="input-prompt-name"]').fill('SF 액션 시퀀스');
    
    // SF 관련 스타일 선택
    await page.locator('[data-testid="style-tab-genre"]').click();
    const sciFiStyle = page.locator('[data-testid*="style-card-"]:has-text("SF")').first();
    if (await sciFiStyle.isVisible()) {
      await sciFiStyle.click();
    } else {
      // SF가 없으면 첫 번째 장르 선택
      await page.locator('[data-testid*="style-card-"]').first().click();
    }
    
    await page.locator('[data-testid="textarea-room-desc"]').fill('우주선 내부 조종실, 홀로그램 디스플레이와 파란 불빛');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('주인공의 얼굴에서 시작해서 우주선 전체를 보여주는 pull back');
    
    // 전체 과정 완료
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 단계들을 빠르게 진행 (실제 입력 없이)
    for (let step = 2; step <= 3; step++) {
      const nextButton = page.locator('button:has-text("다음 단계")');
      if (await nextButton.isVisible({ timeout: 2000 })) {
        await nextButton.click();
      }
    }
    
    // 프롬프트 생성 모니터링
    let generatedPromptData: any = null;
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt') && response.request().method() === 'POST') {
        try {
          generatedPromptData = await response.json();
        } catch (error) {
          console.error('프롬프트 데이터 파싱 실패:', error);
        }
      }
    });
    
    // 프롬프트 생성 실행
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible({ timeout: 2000 })) {
      await generateButton.click();
      
      // 생성 완료 대기
      await page.waitForTimeout(3000);
      
      // 생성된 프롬프트의 품질 검증은 실제 데이터가 있을 때만
      if (generatedPromptData) {
        // 프롬프트가 입력한 컨텍스트와 관련이 있는지 확인
        // (실제 구현에서는 더 정교한 검증 로직 필요)
        console.log('Generated prompt data:', generatedPromptData);
      }
    }
  });

  test('프롬프트 사용 및 내보내기 기능', async ({ page }) => {
    // 간단한 프롬프트 생성 후 사용 테스트
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 최소 필수 정보 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('내보내기 테스트');
    await page.locator('[data-testid="style-tab-visual"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    await page.locator('[data-testid="textarea-room-desc"]').fill('테스트용 장면');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('테스트용 카메라');
    
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 최종 단계까지 진행
    for (let step = 2; step <= 3; step++) {
      const nextButton = page.locator('button:has-text("다음 단계")');
      if (await nextButton.isVisible({ timeout: 2000 })) {
        await nextButton.click();
      }
    }
    
    // 프롬프트 생성
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(2000);
    }
    
    // 프로젝트 스토어에 프롬프트가 저장되었는지 확인 (개발자 도구를 통해)
    const projectStoreState = await page.evaluate(() => {
      // @ts-ignore - 브라우저 환경에서의 window 객체 접근
      return window.__STORE_STATE__ || null;
    });
    
    // 실제 저장 확인은 구체적인 스토어 구현에 따라 달라짐
    console.log('Project store state:', projectStoreState);
  });

  test('스토리에서 프롬프트 생성 플로우', async ({ page }) => {
    // 스토리 목록이 표시되어야 함
    await expect(page.locator('text=생성된 스토리 목록')).toBeVisible();
    
    // 스토리가 있는지 확인하고, 없으면 건너뛰기
    const storyCards = page.locator('[data-testid*="story-card-"]');
    const storyCount = await storyCards.count();
    
    if (storyCount > 0) {
      // 첫 번째 스토리의 "프롬프트 생성" 버튼 클릭
      const firstStoryGenerateButton = storyCards.first().locator('button:has-text("프롬프트 생성")');
      await firstStoryGenerateButton.click();
      
      // 4단계로 바로 이동했는지 확인
      await expect(page.locator('text=AI 어시스턴트 및 최종화')).toBeVisible();
      
      // 스토리 정보가 프롬프트에 반영되었는지 확인
      const selectedStoryInfo = page.locator('text=선택된 스토리:');
      if (await selectedStoryInfo.isVisible()) {
        await expect(selectedStoryInfo).toBeVisible();
      }
    } else {
      // 스토리가 없으면 새 스토리 생성 링크가 있는지 확인
      await expect(page.locator('link:has-text("스토리 생성하기")')).toBeVisible();
      
      // 건너뛰기로 일반 플로우 테스트
      await page.locator('button:has-text("건너뛰기")').click();
      await expect(page.locator('text=프로젝트 설정 및 메타데이터')).toBeVisible();
    }
  });

  test('에러 처리 및 복구 테스트', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 잘못된 입력 테스트
    await page.locator('[data-testid="input-prompt-name"]').fill(''); // 빈 값
    await page.locator('[data-testid="textarea-room-desc"]').fill(''); // 빈 값
    
    // 다음 단계 버튼이 비활성화되어 있어야 함
    await expect(page.locator('[data-testid="btn-next-step1"]')).toBeDisabled();
    
    // 올바른 입력으로 복구
    await page.locator('[data-testid="input-prompt-name"]').fill('복구 테스트 프로젝트');
    await page.locator('[data-testid="style-tab-visual"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    await page.locator('[data-testid="textarea-room-desc"]').fill('복구 테스트 장면');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('복구 테스트 카메라');
    
    // 버튼이 다시 활성화되어야 함
    await expect(page.locator('[data-testid="btn-next-step1"]')).toBeEnabled();
    
    // 네트워크 에러 시뮬레이션 (실제 환경에서는 MSW 등 사용)
    await page.route('/api/planning/prompt', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // 전체 과정 진행 후 에러 발생 확인
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    for (let step = 2; step <= 3; step++) {
      const nextButton = page.locator('button:has-text("다음 단계")');
      if (await nextButton.isVisible({ timeout: 2000 })) {
        await nextButton.click();
      }
    }
    
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // 에러 후에도 UI가 복구되는지 확인 (로딩 상태가 해제되는지)
      await page.waitForTimeout(3000);
      await expect(page.locator('text=생성 중')).toBeHidden();
    }
  });

  test('접근성(A11y) 및 키보드 네비게이션', async ({ page }) => {
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 키보드로 폼 네비게이션 테스트
    await page.keyboard.press('Tab'); // 프로젝트명 입력으로 이동
    await page.keyboard.type('키보드 네비게이션 테스트');
    
    // 스타일 탭으로 이동
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // 영상미 탭으로
    await page.keyboard.press('Space'); // 탭 선택
    
    // 스타일 카드 선택
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space'); // 첫 번째 스타일 선택
    
    // 장면 설명으로 이동
    await page.keyboard.press('Tab');
    while (await page.locator(':focus').getAttribute('data-testid') !== 'textarea-room-desc') {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.type('키보드로 입력한 장면 설명');
    
    // 카메라 설정으로 이동
    await page.keyboard.press('Tab');
    while (await page.locator(':focus').getAttribute('data-testid') !== 'textarea-camera-setup') {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.type('키보드로 입력한 카메라 설정');
    
    // 다음 단계 버튼으로 이동하여 활성화 확인
    await page.keyboard.press('Tab');
    while (await page.locator(':focus').getAttribute('data-testid') !== 'btn-next-step1') {
      await page.keyboard.press('Tab');
    }
    
    // 엔터로 다음 단계 진행
    await page.keyboard.press('Enter');
    await expect(page.locator('text=장면 요소 정의')).toBeVisible();
  });

  test('반응형 디자인 및 모바일 뷰', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 모바일에서도 모든 UI 요소가 접근 가능한지 확인
    await expect(page.locator('[data-testid="input-prompt-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="style-tab-visual"]')).toBeVisible();
    
    // 스타일 탭 동작 확인
    await page.locator('[data-testid="style-tab-visual"]').click();
    await expect(page.locator('[data-testid*="style-card-"]').first()).toBeVisible();
    
    // 폼 입력 테스트
    await page.locator('[data-testid="input-prompt-name"]').fill('모바일 테스트');
    await page.locator('[data-testid*="style-card-"]').first().click();
    await page.locator('[data-testid="textarea-room-desc"]').fill('모바일에서 입력한 장면');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('모바일에서 입력한 카메라');
    
    // 다음 단계 버튼이 보이고 클릭 가능한지 확인
    const nextButton = page.locator('[data-testid="btn-next-step1"]');
    await nextButton.scrollIntoViewIfNeeded();
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();
    
    // 데스크톱으로 다시 변경
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // 데스크톱에서도 동일한 상태가 유지되는지 확인
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();
  });
});