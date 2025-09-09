import { test, expect, Page } from '@playwright/test';

/**
 * 종합적인 인증 플로우 E2E 테스트
 * - TDD 원칙: 실패하는 테스트를 먼저 작성하여 시스템의 요구사항을 명세화
 * - 데이터베이스 상태 검증을 포함한 실제 비즈니스 로직 검증
 * - MSW 사용하지 않고 실제 API 엔드포인트 테스트
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

// 테스트용 유니크 데이터 생성
const createTestUser = () => {
  const timestamp = Date.now();
  return {
    email: `test.user.${timestamp}@example.com`,
    username: `testuser${timestamp}`,
    password: 'SecurePassword123!',
    weakPassword: '123',
    invalidEmail: 'invalid-email',
  };
};

test.describe('종합 인증 플로우 E2E 테스트', () => {
  test.describe('회원가입 프로세스', () => {
    test('유효한 데이터로 회원가입 성공', async ({ page }) => {
      const testUser = createTestUser();
      
      await page.goto('/register');
      
      // 회원가입 폼 작성
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      
      // 회원가입 버튼 클릭
      await page.click('[data-testid="register-button"]');
      
      // 성공 응답 검증 (이메일 인증 안내 페이지로 이동)
      await expect(page.locator('[data-testid="email-verification-notice"]')).toBeVisible();
      await expect(page.locator('text=이메일을 확인해주세요')).toBeVisible();
      
      // API 호출로 데이터베이스 상태 검증
      const response = await page.request.get(`${BASE_URL}/api/auth/check-user-exists`, {
        data: { email: testUser.email }
      });
      const userData = await response.json();
      expect(userData.ok).toBe(true);
      expect(userData.data.exists).toBe(true);
      expect(userData.data.emailVerified).toBe(false); // 아직 이메일 인증 전
    });

    test('이메일 인증 코드 생성 검증', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // API 직접 호출로 회원가입
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      expect(registerResponse.ok()).toBe(true);
      
      // 이메일 인증 코드 생성 확인
      const verificationResponse = await request.get(`${BASE_URL}/api/auth/verification-status`, {
        data: { email: testUser.email }
      });
      const verificationData = await verificationResponse.json();
      
      expect(verificationData.ok).toBe(true);
      expect(verificationData.data.codeGenerated).toBe(true);
      expect(verificationData.data.codeExpiry).toBeDefined();
      expect(new Date(verificationData.data.codeExpiry).getTime()).toBeGreaterThan(Date.now());
    });
  });

  test.describe('이메일 인증 프로세스', () => {
    test('유효한 인증 코드로 이메일 인증 성공', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 회원가입
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      // 테스트용 인증 코드 가져오기 (실제 환경에서는 이메일에서)
      const codeResponse = await request.get(`${BASE_URL}/api/auth/get-verification-code`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' } // 테스트 모드에서만 동작
      });
      const codeData = await codeResponse.json();
      const verificationCode = codeData.data.code;
      
      // 이메일 인증 페이지로 이동
      await page.goto(`/verify-email?email=${encodeURIComponent(testUser.email)}`);
      
      // 인증 코드 입력
      await page.fill('[data-testid="verification-code-input"]', verificationCode);
      await page.click('[data-testid="verify-code-button"]');
      
      // 성공 메시지 확인
      await expect(page.locator('[data-testid="verification-success-message"]')).toBeVisible();
      
      // 데이터베이스 상태 검증 - 사용자가 활성화됨
      const userStatusResponse = await request.get(`${BASE_URL}/api/auth/user-status`, {
        data: { email: testUser.email }
      });
      const userStatus = await userStatusResponse.json();
      
      expect(userStatus.ok).toBe(true);
      expect(userStatus.data.emailVerified).toBe(true);
      expect(userStatus.data.isActive).toBe(true);
    });

    test('만료된 인증 코드 처리', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 회원가입
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,  
          password: testUser.password
        }
      });
      
      // 만료된 코드 시뮬레이션
      await request.post(`${BASE_URL}/api/auth/expire-verification-code`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      await page.goto(`/verify-email?email=${encodeURIComponent(testUser.email)}`);
      
      // 임의의 코드 입력
      await page.fill('[data-testid="verification-code-input"]', '123456');
      await page.click('[data-testid="verify-code-button"]');
      
      // 에러 메시지 확인
      await expect(page.locator('[data-testid="error-message"]')).toContainText('인증 코드가 만료되었습니다');
    });
  });

  test.describe('로그인 프로세스', () => {
    test('인증된 사용자 로그인 성공', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 회원가입 및 이메일 인증 완료 사용자 생성
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      // 이메일 인증 완료 처리
      await request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      await page.goto('/login');
      
      // 로그인 폼 작성
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');
      
      // 로그인 성공 확인 - 메인 페이지로 리디렉트
      await expect(page).toHaveURL('/');
      
      // 세션 쿠키 확인
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'session');
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toBeTruthy();
      
      // 인증 상태 확인
      const authResponse = await page.request.get(`${BASE_URL}/api/auth/me`);
      const authData = await authResponse.json();
      
      expect(authData.ok).toBe(true);
      expect(authData.data.email).toBe(testUser.email);
      expect(authData.data.username).toBe(testUser.username);
    });

    test('세션 지속성 및 보호된 라우트 접근 확인', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 인증된 사용자 생성 및 로그인
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      // 로그인
      const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: testUser.email, password: testUser.password }
      });
      expect(loginResponse.ok()).toBe(true);
      
      // 세션 쿠키 설정
      const setCookieHeader = loginResponse.headers()['set-cookie'];
      const cookies = Array.isArray(setCookieHeader) 
        ? setCookieHeader.join('; ') 
        : String(setCookieHeader);
      
      // 보호된 라우트 접근 테스트
      const protectedRoutes = ['/admin', '/planning/create', '/editor/new'];
      
      for (const route of protectedRoutes) {
        const response = await request.get(`${BASE_URL}${route}`, {
          headers: { Cookie: cookies }
        });
        
        // 인증된 사용자는 접근 가능해야 함 (403이 아님)
        expect(response.status()).not.toBe(403);
        expect(response.status()).not.toBe(401);
      }
    });

    test('토큰 지속성 테스트', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 사용자 생성 및 로그인
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: testUser.email, password: testUser.password }
      });
      
      const loginData = await loginResponse.json();
      const authToken = loginData.data.token;
      
      // 토큰을 이용한 API 요청
      const authenticatedRequest = await request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      expect(authenticatedRequest.ok()).toBe(true);
      const userData = await authenticatedRequest.json();
      expect(userData.data.email).toBe(testUser.email);
    });
  });

  test.describe('에러 시나리오 테스트', () => {
    test('잘못된 이메일 형식 검증', async ({ page }) => {
      const testUser = createTestUser();
      
      await page.goto('/register');
      
      await page.fill('[data-testid="email-input"]', testUser.invalidEmail);
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      
      await page.click('[data-testid="register-button"]');
      
      // HTML5 유효성 검증 또는 커스텀 에러 메시지 확인
      await expect(page.locator('[data-testid="error-message"]')).toContainText('유효한 이메일');
    });

    test('약한 비밀번호 검증', async ({ page }) => {
      const testUser = createTestUser();
      
      await page.goto('/register');
      
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="username-input"]', testUser.username);
      await page.fill('[data-testid="password-input"]', testUser.weakPassword);
      await page.fill('[data-testid="confirm-password-input"]', testUser.weakPassword);
      
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('비밀번호는 최소 8자');
    });

    test('중복 회원가입 방지', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 첫 번째 회원가입
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      // 같은 이메일로 재가입 시도
      await page.goto('/register');
      
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="username-input"]', testUser.username + '2');
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('이미 사용중인 이메일');
    });

    test('잘못된 로그인 자격 증명', async ({ page }) => {
      const testUser = createTestUser();
      
      await page.goto('/login');
      
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('로그인 정보가 올바르지 않습니다');
    });

    test('이메일 미인증 사용자 로그인 차단', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 회원가입만 하고 이메일 인증 안 함
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await page.goto('/login');
      
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('이메일 인증이 필요합니다');
    });

    test('잘못된 인증 코드 처리', async ({ page, request }) => {
      const testUser = createTestUser();
      
      // 회원가입
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await page.goto(`/verify-email?email=${encodeURIComponent(testUser.email)}`);
      
      // 잘못된 코드 입력
      await page.fill('[data-testid="verification-code-input"]', '000000');
      await page.click('[data-testid="verify-code-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText('인증 코드가 올바르지 않습니다');
    });
  });

  test.describe('데이터베이스 상태 검증', () => {
    test('회원가입 후 사용자 데이터 정확성 검증', async ({ request }) => {
      const testUser = createTestUser();
      
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      expect(registerResponse.ok()).toBe(true);
      
      // 데이터베이스에서 사용자 정보 조회
      const userResponse = await request.get(`${BASE_URL}/api/auth/user-details`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      const userData = await userResponse.json();
      
      expect(userData.ok).toBe(true);
      expect(userData.data.email).toBe(testUser.email);
      expect(userData.data.username).toBe(testUser.username);
      expect(userData.data.passwordHash).toBeDefined();
      expect(userData.data.passwordHash).not.toBe(testUser.password); // 해시됨
      expect(userData.data.emailVerified).toBe(false);
      expect(userData.data.createdAt).toBeDefined();
      expect(userData.data.role).toBe('user');
    });

    test('이메일 인증 후 상태 변경 확인', async ({ request }) => {
      const testUser = createTestUser();
      
      // 회원가입
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      // 이메일 인증 완료
      await request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      // 사용자 상태 확인
      const userResponse = await request.get(`${BASE_URL}/api/auth/user-details`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      const userData = await userResponse.json();
      
      expect(userData.data.emailVerified).toBe(true);
      expect(userData.data.emailVerifiedAt).toBeDefined();
    });

    test('로그인 세션 토큰 유효성 검증', async ({ request }) => {
      const testUser = createTestUser();
      
      // 사용자 생성 및 이메일 인증
      await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
        data: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' }
      });
      
      // 로그인
      const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: testUser.email, password: testUser.password }
      });
      
      const loginData = await loginResponse.json();
      const token = loginData.data.token;
      
      // 토큰 디코딩 및 검증
      const tokenValidationResponse = await request.post(`${BASE_URL}/api/auth/validate-token`, {
        data: { token },
        headers: { 'X-Test-Mode': '1' }
      });
      
      const tokenData = await tokenValidationResponse.json();
      
      expect(tokenData.ok).toBe(true);
      expect(tokenData.data.valid).toBe(true);
      expect(tokenData.data.payload.sub).toBeDefined(); // userId
      expect(tokenData.data.payload.email).toBe(testUser.email);
      expect(tokenData.data.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000)); // 만료시간 확인
    });
  });
});