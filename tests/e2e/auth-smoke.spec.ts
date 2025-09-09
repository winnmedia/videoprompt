import { test, expect } from '@playwright/test';

/**
 * 인증 플로우 스모크 테스트
 * 실제 데이터베이스 없이도 실행 가능한 기본적인 UI 테스트
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3000';

test.describe('인증 플로우 스모크 테스트', () => {
  test('회원가입 페이지 렌더링 확인', async ({ page }) => {
    await page.goto('/register');
    
    // 페이지 로드 확인
    await expect(page).toHaveTitle(/회원가입|VideoPrompt/);
    
    // 필수 UI 요소 확인
    await expect(page.locator('text=회원가입')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    
    // 로그인 링크 확인
    await expect(page.locator('text=로그인')).toBeVisible();
  });

  test('로그인 페이지 렌더링 확인', async ({ page }) => {
    await page.goto('/login');
    
    // 페이지 로드 확인
    await expect(page).toHaveTitle(/로그인|VideoPrompt/);
    
    // 필수 UI 요소 확인
    await expect(page.locator('text=로그인')).toBeVisible();
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    
    // 회원가입 링크 확인
    await expect(page.locator('text=회원가입')).toBeVisible();
    
    // 비밀번호 찾기 링크 확인
    await expect(page.locator('text=비밀번호를 잊으셨나요?')).toBeVisible();
  });

  test('이메일 인증 페이지 렌더링 확인', async ({ page }) => {
    await page.goto('/verify-email');
    
    // 페이지 로드 확인
    await expect(page).toHaveTitle(/이메일 인증|VideoPrompt/);
    
    // 필수 UI 요소 확인
    await expect(page.locator('text=이메일 인증')).toBeVisible();
  });

  test('회원가입 폼 유효성 검증 테스트', async ({ page }) => {
    await page.goto('/register');
    
    // 빈 폼 제출 시도
    await page.click('[data-testid="register-button"]');
    
    // HTML5 유효성 검증 또는 에러 메시지 확인
    // 이메일 필드가 required 속성을 가지는지 확인
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('required');
    
    const usernameInput = page.locator('[data-testid="username-input"]');
    await expect(usernameInput).toHaveAttribute('required');
    
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('required');
    
    const confirmPasswordInput = page.locator('[data-testid="confirm-password-input"]');
    await expect(confirmPasswordInput).toHaveAttribute('required');
  });

  test('로그인 폼 유효성 검증 테스트', async ({ page }) => {
    await page.goto('/login');
    
    // 빈 폼 제출 시도
    await page.click('[data-testid="login-button"]');
    
    // HTML5 유효성 검증 확인
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('required');
    
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('잘못된 이메일 형식 검증', async ({ page }) => {
    await page.goto('/register');
    
    // 잘못된 이메일 형식 입력
    await page.fill('[data-testid="email-input"]', 'invalid-email');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.fill('[data-testid="confirm-password-input"]', 'password123');
    
    // 폼 제출
    await page.click('[data-testid="register-button"]');
    
    // 이메일 필드에서 유효성 검증 실패 확인
    const emailInput = page.locator('[data-testid="email-input"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('비밀번호 확인 일치 검증 (클라이언트 사이드)', async ({ page }) => {
    await page.goto('/register');
    
    // 다른 비밀번호 입력
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.fill('[data-testid="confirm-password-input"]', 'different-password');
    
    // 폼 제출
    await page.click('[data-testid="register-button"]');
    
    // 에러 메시지가 표시되는지 확인 (서버 응답 기다림)
    await page.waitForTimeout(1000);
    
    // 에러 메시지 요소가 있는지 확인
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
  });

  test('페이지 간 네비게이션 테스트', async ({ page }) => {
    // 로그인 페이지에서 회원가입 페이지로 이동
    await page.goto('/login');
    await page.click('text=회원가입');
    await expect(page).toHaveURL(/.*\/register/);
    
    // 회원가입 페이지에서 로그인 페이지로 이동
    await page.click('text=로그인');
    await expect(page).toHaveURL(/.*\/login/);
    
    // 홈으로 돌아가기 링크 테스트
    await page.click('text=홈으로 돌아가기');
    await expect(page).toHaveURL('/');
  });

  test('접근성 기본 검증', async ({ page }) => {
    await page.goto('/register');
    
    // 폼 레이블과 입력 필드 연결 확인
    const emailInput = page.locator('[data-testid="email-input"]');
    await expect(emailInput).toHaveAttribute('id');
    
    const usernameInput = page.locator('[data-testid="username-input"]');
    await expect(usernameInput).toHaveAttribute('id');
    
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('id');
    
    // 버튼이 접근 가능한지 확인
    const registerButton = page.locator('[data-testid="register-button"]');
    await expect(registerButton).toBeEnabled();
    
    // 키보드 네비게이션 테스트
    await page.keyboard.press('Tab');
    await expect(emailInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(usernameInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
  });

  test('반응형 디자인 기본 확인', async ({ page }) => {
    // 모바일 뷰포트로 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');
    
    // 모바일에서도 필수 요소가 보이는지 확인
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    
    // 태블릿 뷰포트로 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    
    // 데스크탑 뷰포트로 설정
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
  });
});