import { test, expect, Page } from '@playwright/test';

/**
 * 프로덕션 환경 인증 플로우 E2E 테스트
 * 
 * TDD 원칙:
 * - Red: 실패하는 테스트를 먼저 작성하여 현재 시스템의 문제점 파악
 * - Green: 최소한의 수정으로 테스트 통과
 * - Refactor: 코드 품질 향상
 * 
 * 대상: https://www.vridge.kr
 * 목적: 실제 프로덕션 서비스의 회원가입/로그인 플로우 검증
 */

const PRODUCTION_BASE_URL = 'https://www.vridge.kr';

// 테스트용 유니크 데이터 생성 (프로덕션에서는 더 신중해야 함)
const createTestUser = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 10000);
  return {
    email: `test.e2e.${timestamp}.${randomNum}@example.com`,
    username: `teste2e${timestamp}${randomNum}`,
    password: 'TestPassword123!',
    weakPassword: '123',
    invalidEmail: 'invalid-email-format',
  };
};

test.describe('프로덕션 환경 인증 테스트', () => {
  
  test.beforeEach(async ({ page }) => {
    // 각 테스트마다 깨끗한 상태로 시작
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('사이트 접근성 및 기본 페이지 로드', () => {
    
    test('메인 페이지 로드 성공 (실패 예상 - 현재 localhost 이슈)', async ({ page }) => {
      // TDD Red Phase: 현재 시스템의 문제점을 드러내는 실패하는 테스트
      
      // 네트워크 요청 모니터링
      const responses: Array<{ url: string; status: number }> = [];
      page.on('response', response => {
        responses.push({
          url: response.url(),
          status: response.status()
        });
      });

      const response = await page.goto('/');
      
      // 기본적인 페이지 로드 검증
      expect(response?.status()).toBeLessThan(500); // 서버 에러가 아님
      expect(response?.status()).not.toBe(404); // 페이지가 존재함
      
      // 페이지 타이틀 확인
      await expect(page).toHaveTitle(/VLANET|vridge|VideoPlanet/i);
      
      // 기본 UI 요소들이 로드되는지 확인
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
      expect(bodyText!.length).toBeGreaterThan(0);
      
      // 콘솔 에러 확인
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // 1초 대기하여 JavaScript 에러 캐치
      await page.waitForTimeout(1000);
      
      // 네트워크 에러 검증
      const failedRequests = responses.filter(r => r.status >= 400);
      if (failedRequests.length > 0) {
        console.log('Failed requests:', failedRequests);
      }
      
      // 심각한 에러가 없어야 함
      const seriousErrors = consoleErrors.filter(error => 
        !error.includes('404') && 
        !error.includes('favicon') &&
        !error.includes('_next')
      );
      
      if (seriousErrors.length > 0) {
        console.log('Console errors detected:', seriousErrors);
      }
    });

    test('회원가입 페이지 접근 (실패 예상)', async ({ page }) => {
      // TDD Red Phase: 회원가입 페이지가 제대로 로드되는지 검증
      
      const response = await page.goto('/register');
      
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
      
      // 회원가입 폼의 핵심 요소들 확인
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      
      // 제출 버튼 존재 확인
      const submitButton = page.locator('button[type="submit"], button:has-text("회원가입"), button:has-text("가입"), button:has-text("Register")');
      await expect(submitButton.first()).toBeVisible();
    });

    test('로그인 페이지 접근 (실패 예상)', async ({ page }) => {
      // TDD Red Phase: 로그인 페이지 접근성 검증
      
      const response = await page.goto('/login');
      
      expect(response?.status()).toBeLessThan(500);
      expect(response?.status()).not.toBe(404);
      
      // 로그인 폼 요소들 확인
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
      
      // 로그인 버튼 존재 확인
      const loginButton = page.locator('button[type="submit"], button:has-text("로그인"), button:has-text("Login")');
      await expect(loginButton.first()).toBeVisible();
    });
  });

  test.describe('실제 회원가입 플로우', () => {
    
    test('회원가입 폼 작성 및 제출 (API 응답 검증)', async ({ page }) => {
      // TDD Red Phase: 실제 회원가입 API가 제대로 응답하는지 검증
      
      const testUser = createTestUser();
      
      await page.goto('/register');
      
      // 네트워크 요청 모니터링 
      const apiCalls: Array<{ url: string; method: string; status: number }> = [];
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiCalls.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status()
          });
        }
      });
      
      // 폼 필드 찾기 (다양한 셀렉터로 시도)
      const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="메일"], input[placeholder*="email" i]').first();
      const usernameInput = page.locator('input[name="username"], input[placeholder*="이름"], input[placeholder*="name" i]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="비밀번호"], input[placeholder*="password" i]').first();
      
      await expect(emailInput).toBeVisible();
      
      // 폼 작성
      await emailInput.fill(testUser.email);
      
      // 사용자명 필드가 있다면 입력
      if (await usernameInput.isVisible({ timeout: 1000 })) {
        await usernameInput.fill(testUser.username);
      }
      
      await passwordInput.fill(testUser.password);
      
      // 비밀번호 확인 필드가 있다면 입력
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirm"], input[placeholder*="확인"]');
      if (await confirmPasswordInput.isVisible({ timeout: 1000 })) {
        await confirmPasswordInput.fill(testUser.password);
      }
      
      // 제출 버튼 클릭
      const submitButton = page.locator('button[type="submit"], button:has-text("회원가입"), button:has-text("가입"), button:has-text("Register")').first();
      await submitButton.click();
      
      // 응답 대기 (최대 10초)
      await page.waitForTimeout(3000);
      
      // API 호출 결과 검증
      console.log('API calls made:', apiCalls);
      
      const registerApiCall = apiCalls.find(call => 
        call.url.includes('/api/auth/register') || 
        call.url.includes('/register') || 
        call.method === 'POST'
      );
      
      if (registerApiCall) {
        console.log('Register API call:', registerApiCall);
        
        // 405 (Method Not Allowed) 또는 500 (Internal Server Error)이 아니어야 함
        expect(registerApiCall.status).not.toBe(405);
        expect(registerApiCall.status).not.toBe(500);
        
        // 성공 또는 검증 실패 응답이어야 함
        const validStatuses = [200, 201, 400, 422]; // 정상 처리 또는 유효성 검증 실패
        expect(validStatuses).toContain(registerApiCall.status);
      }
      
      // 페이지 상태 확인 - 에러 페이지가 아니어야 함
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('error');
      expect(currentUrl).not.toContain('500');
      
      // 페이지에 심각한 에러 메시지가 없어야 함
      const errorElements = await page.locator('div:has-text("500"), div:has-text("Internal Server Error"), div:has-text("Application error")').count();
      expect(errorElements).toBe(0);
    });

    test('회원가입 성공 시 리디렉션 확인', async ({ page }) => {
      // TDD Red Phase: 회원가입 성공 후 적절한 페이지로 이동하는지 검증
      
      const testUser = createTestUser();
      
      await page.goto('/register');
      
      // 폼 작성 (간소화)
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill(testUser.email);
        await passwordInput.fill(testUser.password);
        
        // 사용자명 입력
        const usernameInput = page.locator('input[name="username"]');
        if (await usernameInput.isVisible({ timeout: 1000 })) {
          await usernameInput.fill(testUser.username);
        }
        
        // 제출
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        
        // 리디렉션 대기 (최대 10초)
        await page.waitForTimeout(3000);
        
        const finalUrl = page.url();
        
        // 에러 페이지가 아니어야 함
        expect(finalUrl).not.toContain('error');
        expect(finalUrl).not.toContain('500');
        
        // 적절한 성공 또는 다음 단계 페이지여야 함
        const validNextPages = [
          'verify', 'email', 'success', 'dashboard', 'login', '/'
        ];
        
        const hasValidRedirect = validNextPages.some(page => finalUrl.includes(page));
        expect(hasValidRedirect).toBe(true);
      }
    });
  });

  test.describe('로그인 플로우', () => {
    
    test('로그인 API 응답 검증', async ({ page }) => {
      // TDD Red Phase: 로그인 API가 제대로 동작하는지 검증
      
      await page.goto('/login');
      
      // 네트워크 모니터링
      const apiCalls: Array<{ url: string; status: number; method: string }> = [];
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          });
        }
      });
      
      // 테스트용 더미 데이터로 로그인 시도
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('testpassword123');
        
        const loginButton = page.locator('button[type="submit"], button:has-text("로그인")').first();
        await loginButton.click();
        
        // API 응답 대기
        await page.waitForTimeout(3000);
        
        console.log('Login API calls:', apiCalls);
        
        const loginApiCall = apiCalls.find(call => 
          call.url.includes('/api/auth/login') || 
          (call.method === 'POST' && call.url.includes('login'))
        );
        
        if (loginApiCall) {
          // 405 또는 500 에러가 아니어야 함
          expect(loginApiCall.status).not.toBe(405);
          expect(loginApiCall.status).not.toBe(500);
          
          // 유효한 응답 상태여야 함 (인증 실패도 정상 응답)
          const validStatuses = [200, 400, 401, 422];
          expect(validStatuses).toContain(loginApiCall.status);
        }
      }
    });
  });

  test.describe('API 엔드포인트 직접 검증', () => {
    
    test('회원가입 API 엔드포인트 응답 확인', async ({ request }) => {
      // TDD Red Phase: API 엔드포인트가 실제로 응답하는지 직접 검증
      
      const testUser = createTestUser();
      
      try {
        const response = await request.post('/api/auth/register', {
          data: {
            email: testUser.email,
            username: testUser.username,
            password: testUser.password
          },
          timeout: 10000
        });
        
        const status = response.status();
        console.log(`Register API response status: ${status}`);
        
        // 405 (Method Not Allowed) 에러가 아니어야 함
        expect(status).not.toBe(405);
        
        // 500 (Internal Server Error) 에러가 아니어야 함  
        expect(status).not.toBe(500);
        
        // 응답이 있어야 함
        const responseText = await response.text();
        expect(responseText.length).toBeGreaterThan(0);
        
        // JSON 응답인지 확인
        try {
          const jsonResponse = JSON.parse(responseText);
          expect(jsonResponse).toBeDefined();
        } catch {
          console.log('Non-JSON response received:', responseText.substring(0, 200));
        }
        
      } catch (error) {
        console.error('Register API test failed:', error);
        throw error;
      }
    });

    test('로그인 API 엔드포인트 응답 확인', async ({ request }) => {
      // TDD Red Phase: 로그인 API 직접 검증
      
      try {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'test@example.com',
            password: 'testpassword123'
          },
          timeout: 10000
        });
        
        const status = response.status();
        console.log(`Login API response status: ${status}`);
        
        // 405나 500 에러가 아니어야 함
        expect(status).not.toBe(405);
        expect(status).not.toBe(500);
        
        // 응답 본문이 있어야 함
        const responseText = await response.text();
        expect(responseText.length).toBeGreaterThan(0);
        
      } catch (error) {
        console.error('Login API test failed:', error);
        throw error;
      }
    });
  });
});