import { test, expect } from '@playwright/test';

/**
 * 프로덕션 환경 스모크 테스트
 * 
 * TDD 원칙:
 * - 가장 기본적인 기능들이 동작하는지 빠르게 검증
 * - 배포 후 즉시 실행하여 서비스 상태 확인
 * - 실패 시 즉시 알 수 있는 핵심 지표들 검증
 * 
 * 스모크 테스트는:
 * 1. 빠르게 실행되어야 함 (5분 이내)
 * 2. 핵심 기능만 검증
 * 3. 실패 시 서비스 중단 수준의 문제임을 의미
 */

const PRODUCTION_BASE_URL = 'https://www.vridge.kr';

test.describe('프로덕션 스모크 테스트', () => {
  
  // 빠른 실행을 위해 타임아웃 단축
  test.use({ actionTimeout: 10000, navigationTimeout: 15000 });

  test.describe('핵심 서비스 가용성', () => {
    
    test('메인 페이지 접근 가능성', async ({ page }) => {
      // TDD Red Phase: 가장 기본적인 서비스 접근성 검증
      
      const startTime = Date.now();
      const response = await page.goto('/');
      const responseTime = Date.now() - startTime;
      
      // 응답 상태 검증
      expect(response).toBeTruthy();
      expect(response!.status()).toBeLessThan(500);
      expect(response!.status()).not.toBe(404);
      
      // 응답 시간 검증 (15초 이내)
      expect(responseTime).toBeLessThan(15000);
      
      // 기본 HTML 구조 확인
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang');
      
      console.log(`메인 페이지 응답 시간: ${responseTime}ms, 상태: ${response!.status()}`);
    });

    test('도메인 SSL 인증서 유효성', async ({ page }) => {
      // TDD Red Phase: HTTPS 보안 연결 확인
      
      const response = await page.goto('/');
      
      // HTTPS 연결 확인
      expect(page.url()).toMatch(/^https:/);
      
      // 보안 연결 상태 확인 (브라우저 API 사용)
      const securityState = await page.evaluate(() => {
        return {
          protocol: location.protocol,
          isSecure: location.protocol === 'https:',
        };
      });
      
      expect(securityState.protocol).toBe('https:');
      expect(securityState.isSecure).toBe(true);
      
      console.log('SSL 인증서 및 보안 연결 확인됨');
    });

    test('기본 리소스 로드 상태', async ({ page }) => {
      // TDD Red Phase: 핵심 리소스들이 로드되는지 확인
      
      const resourceErrors: string[] = [];
      const criticalResources: string[] = [];
      
      page.on('response', response => {
        const url = response.url();
        const status = response.status();
        
        // CSS, JS, 폰트 등 핵심 리소스 추적
        if (url.includes('.css') || url.includes('.js') || url.includes('.woff')) {
          criticalResources.push(url);
        }
        
        // 4xx, 5xx 에러 추적
        if (status >= 400) {
          resourceErrors.push(`${status}: ${url}`);
        }
      });
      
      await page.goto('/', { waitUntil: 'networkidle' });
      
      console.log(`로드된 핵심 리소스: ${criticalResources.length}개`);
      console.log(`리소스 로드 에러: ${resourceErrors.length}개`);
      
      if (resourceErrors.length > 0) {
        console.log('리소스 에러 목록:', resourceErrors.slice(0, 5));
      }
      
      // 심각한 리소스 에러는 5개 미만이어야 함
      expect(resourceErrors.length).toBeLessThan(5);
    });
  });

  test.describe('핵심 API 엔드포인트', () => {
    
    test('헬스체크 또는 기본 API 응답', async ({ request }) => {
      // TDD Red Phase: 서버가 살아있고 API가 응답하는지 확인
      
      const healthCheckEndpoints = [
        '/api/health',
        '/api/status', 
        '/api/ping',
        '/health',
        '/status'
      ];
      
      let healthCheckFound = false;
      
      for (const endpoint of healthCheckEndpoints) {
        try {
          const response = await request.get(endpoint, { timeout: 5000 });
          const status = response.status();
          
          if (status === 200) {
            console.log(`헬스체크 엔드포인트 발견: ${endpoint}`);
            healthCheckFound = true;
            
            const responseText = await response.text();
            expect(responseText.length).toBeGreaterThan(0);
            break;
          }
        } catch (error) {
          // 엔드포인트가 없을 수 있으므로 에러 무시
          continue;
        }
      }
      
      if (!healthCheckFound) {
        console.log('전용 헬스체크 엔드포인트를 찾을 수 없음 - 메인 페이지로 대체 검증');
        
        // 헬스체크가 없다면 메인 페이지라도 200 응답해야 함
        const response = await request.get('/');
        expect(response.status()).toBeLessThan(500);
      }
    });

    test('인증 API 기본 응답 (POST 요청)', async ({ request }) => {
      // TDD Red Phase: 인증 관련 API가 최소한 405 에러가 아닌 응답을 주는지 확인
      
      const authEndpoints = [
        '/api/auth/login',
        '/api/auth/register', 
        '/api/login',
        '/api/register'
      ];
      
      for (const endpoint of authEndpoints) {
        try {
          const response = await request.post(endpoint, {
            data: { test: 'smoke' },
            timeout: 5000
          });
          
          const status = response.status();
          console.log(`${endpoint} 응답 상태: ${status}`);
          
          // 405 (Method Not Allowed)는 서버 구성 오류
          expect(status).not.toBe(405);
          
          // 500 (Internal Server Error)는 서버 장애
          expect(status).not.toBe(500);
          
          // 200, 400, 401, 422 등은 정상적인 응답
          const validStatuses = [200, 201, 400, 401, 422, 403];
          expect(validStatuses).toContain(status);
          
          // 응답 본문이 있어야 함
          const responseText = await response.text();
          expect(responseText.length).toBeGreaterThan(0);
          
        } catch (error) {
          console.log(`${endpoint} 테스트 중 에러:`, error);
          throw error;
        }
      }
    });
  });

  test.describe('기본 사용자 플로우', () => {
    
    test('회원가입 페이지 접근 및 폼 존재', async ({ page }) => {
      // TDD Red Phase: 회원가입 기본 플로우가 시작 가능한지 확인
      
      const response = await page.goto('/register');
      
      // 페이지 접근 성공
      expect(response!.status()).toBeLessThan(500);
      expect(response!.status()).not.toBe(404);
      
      // 기본 폼 요소 존재 확인
      const formElements = {
        email: page.locator('input[type="email"], input[name="email"]'),
        password: page.locator('input[type="password"], input[name="password"]'),
        submit: page.locator('button[type="submit"], input[type="submit"]')
      };
      
      for (const [name, element] of Object.entries(formElements)) {
        await expect(element.first()).toBeVisible();
        console.log(`${name} 필드 확인됨`);
      }
    });

    test('로그인 페이지 접근 및 폼 존재', async ({ page }) => {
      // TDD Red Phase: 로그인 기본 플로우가 시작 가능한지 확인
      
      const response = await page.goto('/login');
      
      expect(response!.status()).toBeLessThan(500);
      expect(response!.status()).not.toBe(404);
      
      // 로그인 폼 요소들
      await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"], input[type="submit"]').first()).toBeVisible();
      
      console.log('로그인 페이지 기본 구조 확인됨');
    });
  });

  test.describe('검색엔진 최적화 기본 요소', () => {
    
    test('메타태그 및 SEO 기본 요소', async ({ page }) => {
      // TDD Red Phase: 기본적인 SEO 요소들이 있는지 확인
      
      await page.goto('/');
      
      // 필수 메타태그들
      const metaTags = {
        title: await page.locator('title').textContent(),
        description: await page.locator('meta[name="description"]').getAttribute('content'),
        viewport: await page.locator('meta[name="viewport"]').getAttribute('content'),
        charset: await page.locator('meta[charset]').getAttribute('charset')
      };
      
      // 타이틀 존재 및 길이 확인
      expect(metaTags.title).toBeTruthy();
      expect(metaTags.title!.length).toBeGreaterThan(5);
      expect(metaTags.title!.length).toBeLessThan(70);
      
      // 뷰포트 메타태그 (모바일 대응)
      expect(metaTags.viewport).toBeTruthy();
      
      // 문자 인코딩
      expect(metaTags.charset).toBeTruthy();
      
      console.log('SEO 기본 요소들:');
      console.log(`- 타이틀: ${metaTags.title}`);
      console.log(`- 설명: ${metaTags.description || '없음'}`);
      console.log(`- 뷰포트: ${metaTags.viewport}`);
      console.log(`- 문자셋: ${metaTags.charset}`);
    });

    test('구조화된 데이터 및 접근성 기본 요소', async ({ page }) => {
      // TDD Red Phase: 웹 표준 준수 기본 요소 확인
      
      await page.goto('/');
      
      // HTML 구조 요소들
      const structuralElements = {
        headings: await page.locator('h1, h2, h3, h4, h5, h6').count(),
        navigation: await page.locator('nav, [role="navigation"]').count(),
        main: await page.locator('main, [role="main"]').count(),
        images: await page.locator('img').count()
      };
      
      // 최소 하나의 헤딩 요소
      expect(structuralElements.headings).toBeGreaterThan(0);
      
      console.log('구조 요소들:');
      console.log(`- 헤딩 요소: ${structuralElements.headings}개`);
      console.log(`- 네비게이션: ${structuralElements.navigation}개`);
      console.log(`- 메인 콘텐츠: ${structuralElements.main}개`);
      console.log(`- 이미지: ${structuralElements.images}개`);
    });
  });

  test.describe('성능 기본 임계값', () => {
    
    test('페이지 로드 시간 임계값', async ({ page }) => {
      // TDD Red Phase: 기본적인 성능 임계값 확인
      
      const startTime = Date.now();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const domLoadTime = Date.now() - startTime;
      
      await page.waitForLoadState('networkidle');
      const fullLoadTime = Date.now() - startTime;
      
      // DOM 로드 시간 (10초 이내)
      expect(domLoadTime).toBeLessThan(10000);
      
      // 전체 로드 시간 (20초 이내)
      expect(fullLoadTime).toBeLessThan(20000);
      
      console.log(`DOM 로드 시간: ${domLoadTime}ms`);
      console.log(`전체 로드 시간: ${fullLoadTime}ms`);
    });

    test('JavaScript 에러 모니터링', async ({ page }) => {
      // TDD Red Phase: 심각한 JavaScript 에러가 없는지 확인
      
      const jsErrors: string[] = [];
      const jsWarnings: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          jsErrors.push(msg.text());
        } else if (msg.type() === 'warning') {
          jsWarnings.push(msg.text());
        }
      });
      
      page.on('pageerror', error => {
        jsErrors.push(`Page Error: ${error.message}`);
      });
      
      await page.goto('/');
      
      // JavaScript 실행 대기
      await page.waitForTimeout(3000);
      
      // 심각한 에러 필터링 (파비콘, 개발 도구 관련 제외)
      const seriousErrors = jsErrors.filter(error => 
        !error.toLowerCase().includes('favicon') &&
        !error.toLowerCase().includes('dev') &&
        !error.toLowerCase().includes('hot-reload') &&
        !error.toLowerCase().includes('_next')
      );
      
      console.log(`JavaScript 에러: ${jsErrors.length}개 (심각한 에러: ${seriousErrors.length}개)`);
      console.log(`JavaScript 경고: ${jsWarnings.length}개`);
      
      if (seriousErrors.length > 0) {
        console.log('심각한 에러들:', seriousErrors.slice(0, 3));
      }
      
      // 심각한 JavaScript 에러는 3개 미만이어야 함
      expect(seriousErrors.length).toBeLessThan(3);
    });
  });
});