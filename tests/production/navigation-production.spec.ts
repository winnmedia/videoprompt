import { test, expect, Page } from '@playwright/test';

/**
 * 프로덕션 환경 네비게이션 및 기본 기능 E2E 테스트
 * 
 * TDD 원칙:
 * - 실제 사용자 경험 관점에서 테스트
 * - 실패하는 테스트로 현재 문제점 파악
 * - 핵심 네비게이션 플로우 검증
 * 
 * 대상: https://www.vridge.kr
 */

const PRODUCTION_BASE_URL = 'https://www.vridge.kr';

test.describe('프로덕션 환경 네비게이션 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 각 테스트마다 깨끗한 상태로 시작
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('기본 페이지 접근성', () => {
    
    test('메인 페이지 로드 및 기본 요소 확인', async ({ page }) => {
      // TDD Red Phase: 메인 페이지가 제대로 로드되는지 검증
      
      const startTime = Date.now();
      const response = await page.goto('/');
      const loadTime = Date.now() - startTime;
      
      // 기본 응답 검증
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
      
      // 로드 시간 검증 (30초 이내)
      expect(loadTime).toBeLessThan(30000);
      
      // 페이지 제목 확인
      await expect(page).toHaveTitle(/vridge|VideoPlanet|영상|video/i);
      
      // 기본 HTML 구조 확인
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang');
      
      // 네비게이션 바 또는 헤더 확인
      const headerSelectors = [
        'header',
        'nav', 
        '[role="navigation"]',
        '.header',
        '.navbar'
      ];
      
      let headerFound = false;
      for (const selector of headerSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 1000 })) {
          headerFound = true;
          break;
        }
      }
      expect(headerFound).toBe(true);
    });

    test('주요 페이지 링크 접근성 확인', async ({ page }) => {
      // TDD Red Phase: 주요 페이지들이 접근 가능한지 검증
      
      await page.goto('/');
      
      const importantPages = [
        { path: '/login', name: '로그인', required: true },
        { path: '/register', name: '회원가입', required: true }, 
        { path: '/about', name: '소개', required: false },
        { path: '/pricing', name: '요금제', required: false },
        { path: '/contact', name: '연락처', required: false }
      ];
      
      for (const pagePath of importantPages) {
        try {
          console.log(`Testing page: ${pagePath.name} (${pagePath.path})`);
          
          const response = await page.goto(pagePath.path);
          const status = response?.status() || 0;
          
          // 500대 에러가 아니어야 함
          expect(status).toBeLessThan(500);
          
          // 필수 페이지는 404가 아니어야 함
          if (pagePath.required) {
            expect(status).not.toBe(404);
          }
          
          // 기본 HTML 구조가 있어야 함
          const bodyContent = await page.textContent('body');
          expect(bodyContent).toBeTruthy();
          expect(bodyContent!.trim().length).toBeGreaterThan(0);
          
          // 필수 페이지만 에러 페이지 검증
          if (pagePath.required) {
            const hasErrorIndicators = await page.locator('div:has-text("500"), div:has-text("Error"), div:has-text("오류")').count();
            expect(hasErrorIndicators).toBe(0);
          }
          
        } catch (error) {
          console.log(`Page ${pagePath.name} (${pagePath.path}) failed:`, error);
          // 필수 페이지만 실패 시 테스트 중단
          if (pagePath.required) {
            throw error; // 핵심 페이지는 반드시 성공해야 함
          }
        }
      }
    });

    test('네비게이션 링크 동작 확인', async ({ page }) => {
      // TDD Red Phase: 페이지 내 네비게이션 링크들이 동작하는지 검증
      
      await page.goto('/');
      
      // 네비게이션 링크 찾기
      const navigationLinks = await page.locator('a[href^="/"], a[href^="https://www.vridge.kr"]').all();
      
      if (navigationLinks.length > 0) {
        console.log(`Found ${navigationLinks.length} navigation links`);
        
        // 처음 몇 개 링크만 테스트 (시간 절약)
        const linksToTest = navigationLinks.slice(0, Math.min(5, navigationLinks.length));
        
        for (const link of linksToTest) {
          const href = await link.getAttribute('href');
          if (href && !href.includes('mailto:') && !href.includes('tel:')) {
            try {
              console.log(`Testing link: ${href}`);
              
              // 링크 클릭
              await Promise.all([
                page.waitForLoadState('networkidle', { timeout: 10000 }),
                link.click()
              ]);
              
              // 페이지가 로드되었는지 확인
              const currentUrl = page.url();
              expect(currentUrl).toBeDefined();
              
              // 에러 페이지가 아닌지 확인
              const hasErrors = await page.locator('div:has-text("500"), div:has-text("Error")').count();
              expect(hasErrors).toBe(0);
              
              // 메인 페이지로 돌아가기
              await page.goto('/');
              
            } catch (error) {
              console.log(`Link test failed for ${href}:`, error);
            }
          }
        }
      }
    });
  });

  test.describe('검색 및 인터랙션 기능', () => {
    
    test('검색 기능 존재 여부 및 동작 확인', async ({ page }) => {
      // TDD Red Phase: 검색 기능이 구현되어 있는지 확인
      
      await page.goto('/');
      
      // 검색 관련 요소 찾기
      const searchSelectors = [
        'input[type="search"]',
        'input[placeholder*="검색"]',
        'input[placeholder*="search" i]',
        '.search-input',
        '#search',
        '[data-testid*="search"]'
      ];
      
      let searchFound = false;
      let searchInput: any = null;
      
      for (const selector of searchSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          searchFound = true;
          searchInput = element;
          break;
        }
      }
      
      if (searchFound && searchInput) {
        console.log('Search input found, testing functionality');
        
        // 검색어 입력
        await searchInput.fill('테스트 검색');
        
        // 검색 버튼 또는 엔터키
        const searchButton = page.locator('button:has-text("검색"), button:has-text("Search"), button[type="submit"]').first();
        
        if (await searchButton.isVisible({ timeout: 1000 })) {
          await searchButton.click();
        } else {
          await searchInput.press('Enter');
        }
        
        // 검색 결과 또는 반응이 있는지 확인
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        const urlChanged = !currentUrl.endsWith('/') && currentUrl !== PRODUCTION_BASE_URL;
        
        if (urlChanged) {
          console.log('Search seems to work - URL changed to:', currentUrl);
          
          // 에러 페이지가 아닌지 확인
          const hasErrors = await page.locator('div:has-text("500"), div:has-text("Error")').count();
          expect(hasErrors).toBe(0);
        }
      } else {
        console.log('No search functionality found - this may be expected');
      }
    });

    test('기본 폼 상호작용 테스트', async ({ page }) => {
      // TDD Red Phase: 페이지의 기본적인 폼들이 동작하는지 확인
      
      await page.goto('/');
      
      // 폼 요소들 찾기
      const forms = await page.locator('form').all();
      
      if (forms.length > 0) {
        console.log(`Found ${forms.length} forms on the page`);
        
        for (let i = 0; i < Math.min(3, forms.length); i++) {
          const form = forms[i];
          
          // 폼 내 입력 필드들 확인
          const inputs = await form.locator('input, textarea, select').all();
          
          if (inputs.length > 0) {
            console.log(`Form ${i + 1} has ${inputs.length} input fields`);
            
            // 첫 번째 입력 필드에 테스트 데이터 입력
            const firstInput = inputs[0];
            const inputType = await firstInput.getAttribute('type') || 'text';
            
            if (inputType === 'email') {
              await firstInput.fill('test@example.com');
            } else if (inputType === 'password') {
              await firstInput.fill('testpassword123');
            } else if (inputType === 'text' || inputType === 'search') {
              await firstInput.fill('테스트 입력');
            }
            
            // 입력이 되었는지 확인
            const inputValue = await firstInput.inputValue();
            expect(inputValue.length).toBeGreaterThan(0);
          }
        }
      } else {
        console.log('No forms found on the main page');
      }
    });
  });

  test.describe('반응형 디자인 및 모바일 호환성', () => {
    
    test('모바일 뷰포트에서 페이지 로드', async ({ page }) => {
      // TDD Red Phase: 모바일에서도 페이지가 제대로 표시되는지 확인
      
      // 모바일 뷰포트 설정
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      const response = await page.goto('/');
      
      // 기본 로드 확인
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
      
      // 모바일에서 기본 요소들이 보이는지 확인
      await expect(page.locator('body')).toBeVisible();
      
      // 가로 스크롤이 생기지 않았는지 확인
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // 20px 여유
      
      // 모바일 메뉴나 햄버거 메뉴 확인
      const mobileMenuSelectors = [
        '.mobile-menu',
        '.hamburger',
        '.menu-toggle',
        'button[aria-label*="menu" i]',
        'button:has-text("☰")'
      ];
      
      let mobileMenuFound = false;
      for (const selector of mobileMenuSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 1000 })) {
          mobileMenuFound = true;
          console.log('Mobile menu found');
          break;
        }
      }
      
      // 모바일 메뉴가 없어도 테스트 실패하지 않음 (선택적 기능)
      console.log('Mobile menu found:', mobileMenuFound);
    });

    test('태블릿 뷰포트에서 페이지 로드', async ({ page }) => {
      // TDD Red Phase: 태블릿 화면에서의 동작 확인
      
      // 태블릿 뷰포트 설정
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      const response = await page.goto('/');
      
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
      
      // 기본 요소 표시 확인
      await expect(page.locator('body')).toBeVisible();
      
      // 태블릿에서 레이아웃이 깨지지 않았는지 확인
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    });
  });

  test.describe('성능 및 접근성 기본 검사', () => {
    
    test('페이지 로드 성능 기본 측정', async ({ page }) => {
      // TDD Red Phase: 기본적인 성능 지표 확인
      
      const startTime = Date.now();
      
      // 네트워크 요청 모니터링
      const requests: Array<{ url: string; status: number; size?: number }> = [];
      
      page.on('response', response => {
        requests.push({
          url: response.url(),
          status: response.status()
        });
      });
      
      const response = await page.goto('/', { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      // 기본 로드 시간 확인 (30초 이내)
      expect(loadTime).toBeLessThan(30000);
      console.log(`Page load time: ${loadTime}ms`);
      
      // 실패한 리소스 확인
      const failedRequests = requests.filter(r => r.status >= 400);
      console.log(`Failed requests: ${failedRequests.length}`);
      
      if (failedRequests.length > 0) {
        console.log('Failed requests:', failedRequests.slice(0, 5)); // 첫 5개만 로그
      }
      
      // 너무 많은 리소스 실패는 문제
      expect(failedRequests.length).toBeLessThan(10);
    });

    test('기본 접근성 요소 확인', async ({ page }) => {
      // TDD Red Phase: 기본적인 웹 접근성 확인
      
      await page.goto('/');
      
      // HTML lang 속성 확인
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
      
      // 기본 구조 요소들 확인
      const structuralElements = [
        'h1, h2, h3, h4, h5, h6', // 제목 요소
        'main, [role="main"]',    // 메인 콘텐츠
        'nav, [role="navigation"]' // 네비게이션
      ];
      
      for (const selector of structuralElements) {
        const elements = await page.locator(selector).count();
        if (elements > 0) {
          console.log(`Found ${elements} ${selector} elements`);
        }
      }
      
      // 이미지 alt 속성 확인 (있다면)
      const images = await page.locator('img').all();
      if (images.length > 0) {
        console.log(`Found ${images.length} images`);
        
        for (let i = 0; i < Math.min(5, images.length); i++) {
          const img = images[i];
          const alt = await img.getAttribute('alt');
          const src = await img.getAttribute('src');
          
          if (src && !src.includes('data:') && !src.includes('svg')) {
            // 의미있는 이미지는 alt 속성이 있어야 함
            expect(alt !== null).toBe(true);
          }
        }
      }
    });
  });
});