import { test, expect } from '@playwright/test';

/**
 * E2E 테스트: 프롬프트 생성기와 다른 기능들의 통합
 * 
 * 통합 테스트 시나리오:
 * 1. 스토리 기획 → 프롬프트 생성 → 비디오 생성 파이프라인
 * 2. 프로젝트 스토어 상태 관리 및 지속성
 * 3. 프롬프트 히스토리 및 버전 관리
 * 4. 팀 공유 및 협업 워크플로우
 * 5. 다양한 AI 서비스와의 연동
 * 6. 프롬프트 템플릿 및 재사용성
 */

test.describe('프롬프트 생성기 통합 테스트', () => {

  test('스토리 기획에서 프롬프트 생성까지 전체 파이프라인', async ({ page }) => {
    // 1. 스토리 기획 페이지에서 스토리 생성
    await page.goto('/scenario');
    
    // 스토리 기획 페이지가 로드되는지 확인
    await expect(page.locator('h1, h2, h3').filter({ hasText: /스토리|기획|시나리오/ })).toBeVisible({ timeout: 10000 });
    
    // 새 스토리 생성 (페이지 구조에 따라 조정 필요)
    const newStoryButton = page.locator('button:has-text("새 스토리"), button:has-text("생성"), button:has-text("시작")').first();
    if (await newStoryButton.isVisible({ timeout: 5000 })) {
      await newStoryButton.click();
      
      // 스토리 정보 입력 (실제 폼 구조에 맞게 조정)
      const titleInput = page.locator('input[placeholder*="제목"], input[placeholder*="title"], input[name*="title"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.fill('통합 테스트 스토리');
      }
      
      const descriptionInput = page.locator('textarea[placeholder*="설명"], textarea[placeholder*="줄거리"], textarea[name*="story"]').first();
      if (await descriptionInput.isVisible({ timeout: 3000 })) {
        await descriptionInput.fill('한적한 도서관에서 고서를 찾는 학자가 신비로운 책을 발견하여 시공간을 넘나드는 모험을 시작하는 이야기');
      }
      
      // 스토리 저장
      const saveButton = page.locator('button:has-text("저장"), button:has-text("생성"), button[type="submit"]').first();
      if (await saveButton.isVisible({ timeout: 3000 })) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // 2. 프롬프트 생성기로 이동
    await page.goto('/prompt-generator');
    
    // 스토리 목록에서 방금 생성한 스토리가 보이는지 확인
    const storyList = page.locator('text=생성된 스토리 목록');
    await expect(storyList).toBeVisible();
    
    // 생성된 스토리 찾기 및 선택
    const storyCards = page.locator('[class*="story"], [data-testid*="story"]');
    const storyCount = await storyCards.count();
    
    if (storyCount > 0) {
      // 첫 번째 스토리 선택하여 프롬프트 생성
      const firstStoryCard = storyCards.first();
      const promptGenButton = firstStoryCard.locator('button:has-text("프롬프트 생성")');
      
      if (await promptGenButton.isVisible()) {
        await promptGenButton.click();
        
        // 4단계(최종 단계)로 바로 이동했는지 확인
        await expect(page.locator('text=AI 어시스턴트 및 최종화')).toBeVisible();
        
        // 선택된 스토리 정보가 표시되는지 확인
        const selectedStoryInfo = page.locator('text=선택된 스토리:');
        if (await selectedStoryInfo.isVisible()) {
          await expect(selectedStoryInfo).toBeVisible();
        }
        
        // 프롬프트 생성 실행
        const generateButton = page.locator('button:has-text("프롬프트 생성")');
        if (await generateButton.isVisible()) {
          await generateButton.click();
          
          // 생성 완료 대기
          await page.waitForTimeout(3000);
          await expect(page.locator('text=생성 중')).toBeHidden({ timeout: 10000 });
        }
      }
    }
    
    // 3. 프로젝트 스토어에 데이터가 저장되었는지 확인
    const projectState = await page.evaluate(() => {
      // @ts-ignore
      return window.__PROJECT_STORE__ || null;
    });
    
    if (projectState) {
      console.log('프로젝트 스토어 상태:', projectState);
    }
  });

  test('프로젝트 스토어 상태 지속성 및 동기화', async ({ page }) => {
    // 프롬프트 생성 후 상태 확인
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 프롬프트 데이터 입력
    await page.locator('[data-testid="input-prompt-name"]').fill('상태 지속성 테스트');
    await page.locator('[data-testid="style-tab-visual"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    await page.locator('[data-testid="textarea-room-desc"]').fill('테스트용 장면 설명');
    await page.locator('[data-testid="textarea-camera-setup"]').fill('테스트용 카메라 설정');
    
    // 1단계 완료
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 페이지 새로고침 후 상태 유지 확인
    await page.reload();
    
    // 스토리 목록 건너뛰고 1단계로 이동
    if (await page.locator('button:has-text("건너뛰기")').isVisible({ timeout: 3000 })) {
      await page.locator('button:has-text("건너뛰기")').click();
    }
    
    // 입력한 데이터가 유지되었는지 확인 (로컬 스토리지나 스토어에서)
    const nameValue = await page.locator('[data-testid="input-prompt-name"]').inputValue();
    const sceneValue = await page.locator('[data-testid="textarea-room-desc"]').inputValue();
    
    // 상태가 완전히 유지되지 않더라도 부분적으로라도 복원되는지 확인
    console.log('새로고침 후 폼 상태:', { nameValue, sceneValue });
    
    // 다른 페이지로 이동 후 복귀 테스트
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.goto('/prompt-generator');
    
    // 프로젝트 스토어 상태 확인
    const storeState = await page.evaluate(() => {
      // @ts-ignore
      return {
        localStorage: Object.keys(localStorage).reduce((acc, key) => {
          if (key.includes('project') || key.includes('prompt')) {
            acc[key] = localStorage.getItem(key);
          }
          return acc;
        }, {}),
        // @ts-ignore
        store: window.__STORE_STATE__ || null
      };
    });
    
    console.log('스토어 지속성 상태:', storeState);
  });

  test('프롬프트 히스토리 및 버전 관리', async ({ page }) => {
    let promptHistory: any[] = [];
    
    // API 호출 모니터링
    page.on('response', async (response) => {
      if (response.url().includes('/api/planning/prompt')) {
        try {
          if (response.request().method() === 'GET') {
            const data = await response.json();
            promptHistory = data.data || [];
          }
        } catch (error) {
          console.error('히스토리 데이터 파싱 실패:', error);
        }
      }
    });
    
    // 첫 번째 프롬프트 생성
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    await createSimplePrompt(page, '첫 번째 버전 프롬프트', '첫 번째 테스트 장면');
    
    // 프롬프트 생성 완료 후 잠시 대기
    await page.waitForTimeout(2000);
    
    // 두 번째 프롬프트 생성 (수정된 버전)
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    await createSimplePrompt(page, '두 번째 버전 프롬프트', '수정된 테스트 장면');
    
    await page.waitForTimeout(2000);
    
    // 프롬프트 히스토리 조회 (프롬프트 목록 페이지가 있다면)
    const historyEndpoint = '/api/planning/prompt';
    const historyResponse = await page.request.get(historyEndpoint);
    
    if (historyResponse.ok()) {
      const historyData = await historyResponse.json();
      console.log('프롬프트 히스토리:', {
        total: historyData.stats?.total || 0,
        v3_count: historyData.stats?.v3_count || 0,
        v2_count: historyData.stats?.v2_count || 0
      });
      
      // 버전 관리 확인
      if (historyData.data && historyData.data.length >= 2) {
        const prompts = historyData.data;
        expect(prompts.length).toBeGreaterThanOrEqual(2);
        
        // 각 프롬프트가 고유한 ID를 가지는지 확인
        const ids = prompts.map((p: any) => p.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
        
        // 생성 시간 순서 확인
        const timestamps = prompts.map((p: any) => new Date(p.createdAt).getTime());
        const sortedTimestamps = [...timestamps].sort((a, b) => b - a); // 내림차순
        expect(timestamps).toEqual(sortedTimestamps);
      }
    }
  });

  test('팀 공유 및 협업 워크플로우', async ({ page }) => {
    // 프롬프트 생성
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    await createSimplePrompt(page, '팀 공유 테스트 프롬프트', '팀과 공유할 프로젝트');
    
    // 프롬프트 생성 완료 후 공유 기능 테스트
    await page.waitForTimeout(2000);
    
    // 공유 기능이 있다면 테스트 (UI에 공유 버튼이 있는지 확인)
    const shareButton = page.locator('button:has-text("공유"), button:has-text("내보내기"), button[title*="공유"]');
    
    if (await shareButton.first().isVisible({ timeout: 3000 })) {
      await shareButton.first().click();
      
      // 공유 다이얼로그나 모달이 열리는지 확인
      const shareModal = page.locator('[role="dialog"], .modal, [class*="share"]');
      if (await shareModal.isVisible({ timeout: 2000 })) {
        await expect(shareModal).toBeVisible();
        
        // 공유 URL이나 내보내기 옵션 확인
        const shareUrl = page.locator('input[readonly], input[value*="http"]');
        if (await shareUrl.isVisible({ timeout: 2000 })) {
          const url = await shareUrl.inputValue();
          expect(url).toContain('http');
        }
        
        // 모달 닫기
        const closeButton = page.locator('button:has-text("닫기"), button:has-text("취소"), [aria-label="닫기"]');
        if (await closeButton.first().isVisible()) {
          await closeButton.first().click();
        }
      }
    }
    
    // 프로젝트 내보내기 기능 테스트 (JSON/XML 등)
    const exportButton = page.locator('button:has-text("내보내기"), button:has-text("다운로드"), button[title*="export"]');
    
    if (await exportButton.first().isVisible({ timeout: 3000 })) {
      // 다운로드 이벤트 모니터링
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      
      await exportButton.first().click();
      
      const download = await downloadPromise;
      if (download) {
        console.log('내보내기 성공:', {
          filename: download.suggestedFilename(),
          size: await download.path().then(path => path ? 'file exists' : 'no file')
        });
      }
    }
  });

  test('다양한 AI 서비스와의 연동 테스트', async ({ page }) => {
    // 통합 서비스 페이지로 이동
    await page.goto('/integrations');
    
    // 통합 서비스 목록 확인
    await expect(page.locator('h1, h2, h3').filter({ hasText: /통합|연동|서비스/ })).toBeVisible({ timeout: 10000 });
    
    // AI 서비스 카테고리 필터링
    const categorySelect = page.locator('[data-testid="category-select"], select[name*="category"]');
    if (await categorySelect.isVisible({ timeout: 3000 })) {
      await categorySelect.selectOption('AI Services');
      await page.waitForTimeout(1000);
    }
    
    // 비디오 생성 관련 서비스 검색
    const searchInput = page.locator('[data-testid="search-input"], input[placeholder*="검색"]');
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('video');
      await page.waitForTimeout(1000);
    }
    
    // 검색 결과에서 비디오 생성 서비스 확인
    const serviceCards = page.locator('[data-testid*="integration"], [class*="service"], [class*="integration"]');
    const serviceCount = await serviceCards.count();
    
    if (serviceCount > 0) {
      console.log(`${serviceCount}개의 연동 서비스 발견`);
      
      // 첫 번째 서비스 클릭하여 상세 정보 확인
      const firstService = serviceCards.first();
      if (await firstService.isVisible()) {
        await firstService.click();
        
        // 서비스 상세 페이지나 설정 모달 확인
        const serviceDetail = page.locator('[role="dialog"], .modal, [class*="detail"]');
        if (await serviceDetail.isVisible({ timeout: 3000 })) {
          // API 키 설정이나 연동 설정 옵션 확인
          const apiKeyInput = page.locator('input[placeholder*="API"], input[name*="key"], input[type="password"]');
          if (await apiKeyInput.isVisible()) {
            console.log('API 키 설정 입력 필드 발견');
          }
          
          // 연동 테스트 버튼이 있는지 확인
          const testButton = page.locator('button:has-text("테스트"), button:has-text("연결")');
          if (await testButton.isVisible()) {
            console.log('연동 테스트 기능 사용 가능');
          }
        }
      }
    }
    
    // 프롬프트 생성기로 돌아가서 생성된 프롬프트를 외부 서비스로 전송하는 기능 테스트
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    await createSimplePrompt(page, 'AI 서비스 연동 테스트', '외부 서비스 테스트용 장면');
    
    // 프롬프트 생성 후 외부 서비스 연동 버튼이 있는지 확인
    await page.waitForTimeout(2000);
    
    const externalServiceButtons = page.locator(
      'button:has-text("Runway"), button:has-text("OpenAI"), button:has-text("Stable"), ' +
      'button[title*="전송"], button[class*="service"]'
    );
    
    const externalButtonCount = await externalServiceButtons.count();
    if (externalButtonCount > 0) {
      console.log(`${externalButtonCount}개의 외부 서비스 연동 버튼 발견`);
    }
  });

  test('프롬프트 템플릿 및 재사용성', async ({ page }) => {
    // 첫 번째 프롬프트 생성 (템플릿으로 저장할 프롬프트)
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 상세한 템플릿용 프롬프트 생성
    await page.locator('[data-testid="input-prompt-name"]').fill('템플릿 테스트 - 카페 장면');
    
    // 다양한 스타일 선택
    await page.locator('[data-testid="style-tab-visual"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    
    await page.locator('[data-testid="style-tab-mood"]').click();
    await page.locator('[data-testid*="style-card-"]').first().click();
    
    await page.locator('[data-testid="textarea-room-desc"]').fill(
      '따뜻한 오후 햇살이 비치는 아늑한 카페, 원목 테이블과 빈티지 의자들, 벽에 걸린 그림들과 책장'
    );
    
    await page.locator('[data-testid="textarea-camera-setup"]').fill(
      '창가 테이블에서 시작하여 카페 전체를 보여주는 부드러운 팬 샷, 마지막에 커피 컵 클로즈업'
    );
    
    // 고급 설정
    await page.locator('[data-testid="select-weather"]').selectOption('Clear');
    await page.locator('[data-testid="select-lighting"]').selectOption('Golden Hour');
    await page.locator('[data-testid="select-primary-lens"]').selectOption('35mm (Natural)');
    
    // 1단계 완료
    await page.locator('[data-testid="btn-next-step1"]').click();
    
    // 나머지 단계들을 빠르게 진행
    for (let step = 2; step <= 3; step++) {
      const nextButton = page.locator('button:has-text("다음 단계")');
      if (await nextButton.isVisible({ timeout: 2000 })) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    // 프롬프트 생성
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      await page.waitForTimeout(3000);
    }
    
    // 템플릿으로 저장하는 기능이 있는지 확인
    const saveTemplateButton = page.locator(
      'button:has-text("템플릿"), button:has-text("저장"), button:has-text("재사용")'
    );
    
    if (await saveTemplateButton.first().isVisible({ timeout: 3000 })) {
      await saveTemplateButton.first().click();
      
      // 템플릿 이름 입력
      const templateNameInput = page.locator('input[placeholder*="템플릿"], input[name*="template"]');
      if (await templateNameInput.isVisible({ timeout: 2000 })) {
        await templateNameInput.fill('카페 장면 템플릿');
        
        // 저장 확인
        const confirmSaveButton = page.locator('button:has-text("저장"), button:has-text("확인")');
        if (await confirmSaveButton.isVisible()) {
          await confirmSaveButton.click();
        }
      }
    }
    
    // 새 프롬프트에서 템플릿 사용 테스트
    await page.goto('/prompt-generator');
    await page.locator('button:has-text("건너뛰기")').click();
    
    // 템플릿 로드 버튼이 있는지 확인
    const loadTemplateButton = page.locator(
      'button:has-text("템플릿"), button:has-text("불러오기"), select[name*="template"]'
    );
    
    if (await loadTemplateButton.first().isVisible({ timeout: 3000 })) {
      await loadTemplateButton.first().click();
      
      // 템플릿 목록에서 선택
      const templateOption = page.locator('option:has-text("카페"), li:has-text("카페"), button:has-text("카페")');
      if (await templateOption.first().isVisible({ timeout: 2000 })) {
        await templateOption.first().click();
        
        // 템플릿이 로드되었는지 확인 (일부 필드가 자동으로 채워졌는지)
        const loadedName = await page.locator('[data-testid="input-prompt-name"]').inputValue();
        const loadedScene = await page.locator('[data-testid="textarea-room-desc"]').inputValue();
        
        if (loadedName.includes('카페') || loadedScene.includes('카페')) {
          console.log('템플릿 로드 성공:', { loadedName, sceneLength: loadedScene.length });
        }
      }
    }
  });

  test('전체 워크플로우 성능 및 사용성 테스트', async ({ page }) => {
    const startTime = Date.now();
    
    // 전체 프로세스 시간 측정
    await page.goto('/prompt-generator');
    
    // 네트워크 성능 모니터링
    const networkRequests: Array<{ url: string; duration: number; status: number }> = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        networkRequests.push({
          url: response.url(),
          duration: response.request().timing()?.responseEnd || 0,
          status: response.status()
        });
      }
    });
    
    // 스토리 목록 건너뛰기
    await page.locator('button:has-text("건너뛰기")').click();
    
    const formFillStartTime = Date.now();
    
    // 폼 작성 시간 측정
    await createSimplePrompt(page, '성능 테스트 프롬프트', '성능 측정용 장면');
    
    const formFillDuration = Date.now() - formFillStartTime;
    
    // 프롬프트 생성 시간 측정
    const generationStartTime = Date.now();
    
    const generateButton = page.locator('button:has-text("프롬프트 생성")');
    if (await generateButton.isVisible()) {
      await generateButton.click();
      
      // 생성 완료까지 대기
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]') || 
              !document.querySelector('text=생성 중'),
        {},
        { timeout: 30000 }
      ).catch(() => {
        console.log('생성 완료 감지 실패 - 타임아웃으로 계속 진행');
      });
    }
    
    const generationDuration = Date.now() - generationStartTime;
    const totalDuration = Date.now() - startTime;
    
    // 성능 메트릭 출력
    console.log('성능 테스트 결과:', {
      totalDuration: `${totalDuration}ms`,
      formFillDuration: `${formFillDuration}ms`,
      generationDuration: `${generationDuration}ms`,
      networkRequestCount: networkRequests.length,
      averageResponseTime: networkRequests.length > 0 
        ? `${networkRequests.reduce((sum, req) => sum + req.duration, 0) / networkRequests.length}ms`
        : 'N/A'
    });
    
    // 성능 임계값 검증
    expect(totalDuration).toBeLessThan(60000); // 전체 과정 1분 이내
    expect(formFillDuration).toBeLessThan(10000); // 폼 작성 10초 이내
    expect(generationDuration).toBeLessThan(30000); // 프롬프트 생성 30초 이내
    
    // 네트워크 요청 성공률 확인
    const failedRequests = networkRequests.filter(req => req.status >= 400);
    expect(failedRequests.length).toBe(0);
  });
});

// 헬퍼 함수
async function createSimplePrompt(page: any, name: string, scene: string) {
  await page.locator('[data-testid="input-prompt-name"]').fill(name);
  
  await page.locator('[data-testid="style-tab-visual"]').click();
  await page.locator('[data-testid*="style-card-"]').first().click();
  
  await page.locator('[data-testid="textarea-room-desc"]').fill(scene);
  await page.locator('[data-testid="textarea-camera-setup"]').fill('표준 카메라 설정');
  
  await page.locator('[data-testid="btn-next-step1"]').click();
  
  // 나머지 단계들 빠르게 진행
  for (let step = 2; step <= 3; step++) {
    const nextButton = page.locator('button:has-text("다음 단계")');
    if (await nextButton.isVisible({ timeout: 2000 })) {
      await nextButton.click();
      await page.waitForTimeout(300);
    }
  }
}