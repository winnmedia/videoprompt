/**
 * 400 에러 시나리오 E2E 테스트
 * 실제 브라우저 환경에서 400 에러 복구 능력 검증
 */

import { test, expect, Page } from '@playwright/test';

test.describe('400 에러 시나리오 E2E 테스트', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // MSW를 통한 API 모킹 설정 (실제 외부 API 호출 방지)
    await page.addInitScript(() => {
      // 400 에러 시나리오를 위한 API 모킹
      (window as any).mockApiResponse = null;
    });

    await page.goto('/scenario');
  });

  test('빈 스토리 입력 시 클라이언트 측 기본값 적용으로 400 에러 방지', async () => {
    // API 응답 모킹 - 서버에서 기본값이 적용된 요청 받음
    await page.route('/api/ai/generate-story', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      
      // 클라이언트가 기본값을 적용했는지 확인
      expect(body.story).toBe('영상 시나리오를 만들어주세요'); // 기본값
      expect(body.genre).toBe('드라마'); // 기본값
      expect(body.tone).toBe('일반적'); // 기본값
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          structure: {
            act1: { title: '시작', description: '기본값으로 생성된 스토리', key_elements: ['요소1'], emotional_arc: '감정 변화' },
            act2: { title: '전개', description: '기본값으로 생성된 스토리', key_elements: ['요소1'], emotional_arc: '감정 변화' },
            act3: { title: '절정', description: '기본값으로 생성된 스토리', key_elements: ['요소1'], emotional_arc: '감정 변화' },
            act4: { title: '결말', description: '기본값으로 생성된 스토리', key_elements: ['요소1'], emotional_arc: '감정 변화' }
          },
          visual_style: ['기본'],
          mood_palette: ['기본'],
          technical_approach: ['기본'],
          target_audience_insights: ['기본']
        })
      });
    });

    // 빈 폼으로 제출 시도
    const generateButton = page.locator('button:has-text("스토리 생성")');
    await generateButton.click();

    // 성공적으로 스토리가 생성되어야 함 (400 에러 없음)
    await expect(page.locator('[data-testid="story-steps"]')).toBeVisible();
    await expect(page.locator('text=기본값으로 생성된 스토리')).toBeVisible();
  });

  test('빈 톤앤매너 배열 시 기본값 적용으로 400 에러 방지', async () => {
    // 빈 배열이 조인되어 빈 문자열이 되는 시나리오
    await page.route('/api/ai/generate-story', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      
      // tone이 빈 문자열이었다가 기본값으로 변환되었는지 확인
      expect(body.tone).toBe('일반적'); // 빈 문자열 → 기본값 변환
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          structure: {
            act1: { title: '시작', description: '톤 기본값 적용됨', key_elements: ['톤'], emotional_arc: '감정' },
            act2: { title: '전개', description: '톤 기본값 적용됨', key_elements: ['톤'], emotional_arc: '감정' },
            act3: { title: '절정', description: '톤 기본값 적용됨', key_elements: ['톤'], emotional_arc: '감정' },
            act4: { title: '결말', description: '톤 기본값 적용됨', key_elements: ['톤'], emotional_arc: '감정' }
          },
          visual_style: ['톤적용'], mood_palette: ['톤적용'], 
          technical_approach: ['톤적용'], target_audience_insights: ['톤적용']
        })
      });
    });

    // 스토리는 입력하되 톤앤매너는 선택 안 함
    await page.fill('textarea[placeholder*="스토리"]', '테스트 스토리');
    
    // 톤앤매너 선택 없이 생성 버튼 클릭 (빈 배열 → 빈 문자열 시나리오)
    const generateButton = page.locator('button:has-text("스토리 생성")');
    await generateButton.click();

    // 400 에러 없이 성공해야 함
    await expect(page.locator('text=톤 기본값 적용됨')).toBeVisible({ timeout: 10000 });
  });

  test('서버 측 400 에러 발생 시 사용자 친화적 메시지 표시', async () => {
    // 강제로 400 에러 발생시키기
    await page.route('/api/ai/generate-story', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: '스토리를 입력해주세요 (최소 1자)',
          userMessage: 'AI 서비스 요청에 문제가 있습니다. 모든 필드를 확인해주세요.'
        })
      });
    });

    await page.fill('textarea[placeholder*="스토리"]', '테스트');
    const generateButton = page.locator('button:has-text("스토리 생성")');
    await generateButton.click();

    // 에러 메시지가 표시되어야 함
    await expect(page.locator('text=AI 서비스 요청에 문제가 있습니다')).toBeVisible();
    
    // 스토리 단계는 표시되지 않아야 함
    await expect(page.locator('[data-testid="story-steps"]')).not.toBeVisible();
  });

  test('네트워크 에러 시 재시도 메커니즘 작동', async () => {
    let attemptCount = 0;

    await page.route('/api/ai/generate-story', async (route) => {
      attemptCount++;
      
      if (attemptCount <= 2) {
        // 처음 2번은 네트워크 에러
        await route.abort('failed');
        return;
      }

      // 3번째는 성공
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          structure: {
            act1: { title: '재시도 성공', description: '재시도 후 성공', key_elements: ['재시도'], emotional_arc: '성공' },
            act2: { title: '재시도 성공', description: '재시도 후 성공', key_elements: ['재시도'], emotional_arc: '성공' },
            act3: { title: '재시도 성공', description: '재시도 후 성공', key_elements: ['재시도'], emotional_arc: '성공' },
            act4: { title: '재시도 성공', description: '재시도 후 성공', key_elements: ['재시도'], emotional_arc: '성공' }
          },
          visual_style: ['재시도'], mood_palette: ['재시도'], 
          technical_approach: ['재시도'], target_audience_insights: ['재시도']
        })
      });
    });

    await page.fill('textarea[placeholder*="스토리"]', '재시도 테스트');
    const generateButton = page.locator('button:has-text("스토리 생성")');
    await generateButton.click();

    // 로딩 인디케이터가 보여야 함 (재시도 중)
    await expect(page.locator('text=AI가 스토리를 생성하고 있습니다')).toBeVisible();
    
    // 최종적으로 성공해야 함
    await expect(page.locator('text=재시도 후 성공')).toBeVisible({ timeout: 15000 });
    
    // 최소 2번 이상 재시도했는지 확인
    expect(attemptCount).toBeGreaterThanOrEqual(3);
  });

  test('API 응답 스키마 검증 실패 시 graceful degradation', async () => {
    // 잘못된 응답 구조 반환
    await page.route('/api/ai/generate-story', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          // structure 필드 누락 - 스키마 검증 실패 유발
          invalid_field: 'test'
        })
      });
    });

    await page.fill('textarea[placeholder*="스토리"]', '스키마 테스트');
    const generateButton = page.locator('button:has-text("스토리 생성")');
    await generateButton.click();

    // 사용자 친화적 에러 메시지 표시
    await expect(page.locator('text=AI 응답 형식이 올바르지 않습니다')).toBeVisible();
  });

  test('연속 에러 발생 시 사용자 가이드 제공', async () => {
    let errorCount = 0;
    
    await page.route('/api/ai/generate-story', async (route) => {
      errorCount++;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: '연속 에러 테스트'
        })
      });
    });

    // 3번 연속 에러 발생
    for (let i = 0; i < 3; i++) {
      await page.fill('textarea[placeholder*="스토리"]', `에러 테스트 ${i + 1}`);
      const generateButton = page.locator('button:has-text("스토리 생성")');
      await generateButton.click();
      
      await page.waitForTimeout(1000); // 에러 표시 대기
    }

    // 3번째 에러 후에는 가이드 메시지가 추가로 표시되어야 함
    await expect(page.locator('text=문제가 지속되면 페이지를 새로고침')).toBeVisible();
    expect(errorCount).toBe(3);
  });

  test('캐시된 요청 시 에러 복구 확인', async () => {
    // 첫 번째 요청: 성공
    await page.route('/api/ai/generate-story', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      
      // 요청 내용에 따라 다른 응답
      if (body.story === '캐시 테스트') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            structure: {
              act1: { title: '캐시됨', description: '캐시된 응답', key_elements: ['캐시'], emotional_arc: '캐시' },
              act2: { title: '캐시됨', description: '캐시된 응답', key_elements: ['캐시'], emotional_arc: '캐시' },
              act3: { title: '캐시됨', description: '캐시된 응답', key_elements: ['캐시'], emotional_arc: '캐시' },
              act4: { title: '캐시됨', description: '캐시된 응답', key_elements: ['캐시'], emotional_arc: '캐시' }
            },
            visual_style: ['캐시'], mood_palette: ['캐시'], 
            technical_approach: ['캐시'], target_audience_insights: ['캐시']
          })
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Bad Request' })
        });
      }
    });

    // 첫 번째 요청 (성공)
    await page.fill('textarea[placeholder*="스토리"]', '캐시 테스트');
    await page.click('button:has-text("스토리 생성")');
    await expect(page.locator('text=캐시된 응답')).toBeVisible();

    // 페이지 새로고침 없이 동일한 요청 (캐시됨)
    await page.fill('textarea[placeholder*="스토리"]', '');
    await page.fill('textarea[placeholder*="스토리"]', '캐시 테스트');
    await page.click('button:has-text("스토리 생성")');
    
    // 캐시된 결과가 즉시 표시되어야 함 (400 에러 우회)
    await expect(page.locator('text=캐시된 스토리를 불러왔습니다')).toBeVisible();
  });

  test.afterEach(async () => {
    // 테스트 간 격리를 위한 정리
    await page.unroute('/api/ai/generate-story');
  });
});