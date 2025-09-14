import { test, expect, type Page } from '@playwright/test';
import {
  AuthTestHelper,
  createTestUser,
  type TestUser,
  type AuthToken,
} from '../fixtures/auth';

/**
 * 미들웨어 보안 검증 테스트
 *
 * Next.js 미들웨어가 제대로 인증을 처리하고 보안을 유지하는지 검증
 *
 * Critical Security Tests:
 * - 보호된 라우트 접근 제한
 * - JWT 토큰 검증 로직
 * - 인증된 사용자의 auth-only 페이지 차단
 * - Edge case 시나리오 처리
 *
 * TDD 접근:
 * - Red: 보안 취약점이 있다고 가정하고 테스트
 * - Green: 미들웨어가 올바르게 차단하는지 검증
 * - Refactor: 보안 강화 확인
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

// 미들웨어에서 보호하는 경로들 (middleware.ts와 동기화)
const PROTECTED_PATHS = [
  '/admin',
  '/queue',
  '/admin/dashboard',
  '/admin/users',
];

const AUTH_ONLY_PATHS = [
  '/login',
  '/register',
];

test.describe('미들웨어 보안 검증', () => {
  let authHelper: AuthTestHelper;
  let authenticatedUser: { user: TestUser; token: AuthToken };

  test.beforeEach(async ({ page, request }) => {
    authHelper = new AuthTestHelper(page, request);
    authenticatedUser = await authHelper.createAuthenticatedUser();
  });

  test.describe('보호된 라우트 접근 제어', () => {
    test('미인증 사용자의 보호된 라우트 접근 차단', async ({ page }) => {
      // Given: 토큰 없는 상태
      await authHelper.removeTokenFromLocalStorage();

      // When & Then: 각 보호된 경로에 접근 시도
      for (const protectedPath of PROTECTED_PATHS) {
        await page.goto(protectedPath);

        // 로그인 페이지로 리다이렉트되어야 함
        await expect(page).toHaveURL(/\/login/);

        // redirect 파라미터에 원래 경로가 있는지 확인
        const currentUrl = new URL(page.url());
        const redirectParam = currentUrl.searchParams.get('redirect');
        expect(redirectParam).toBe(protectedPath);

        console.log(`✅ ${protectedPath} → 로그인 리다이렉트 (redirect=${redirectParam})`);
      }
    });

    test('인증된 사용자의 보호된 라우트 접근 허용', async ({ page }) => {
      // Given: 유효한 토큰 설정
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);

      // When & Then: 각 보호된 경로에 접근
      for (const protectedPath of PROTECTED_PATHS) {
        await page.goto(protectedPath);

        // 로그인 페이지로 리다이렉트되지 않아야 함
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('/login');

        console.log(`✅ ${protectedPath} → 접근 허용`);
      }
    });

    test('만료된 토큰으로 보호된 라우트 접근 시도', async ({ page }) => {
      // Given: 만료된 토큰 설정
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);

      // When & Then: 보호된 경로 접근
      for (const protectedPath of PROTECTED_PATHS) {
        await page.goto(protectedPath);

        // 로그인 페이지로 리다이렉트되어야 함
        await expect(page).toHaveURL(/\/login/);

        console.log(`✅ ${protectedPath} → 만료된 토큰으로 차단됨`);
      }
    });
  });

  test.describe('인증된 사용자의 Auth-Only 페이지 차단', () => {
    test('로그인된 사용자가 로그인/회원가입 페이지 접근 시 홈으로 리다이렉트', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);

      // When & Then: 로그인/회원가입 페이지 접근 시도
      for (const authOnlyPath of AUTH_ONLY_PATHS) {
        await page.goto(authOnlyPath);

        // 홈페이지로 리다이렉트되어야 함
        await expect(page).toHaveURL('/');

        console.log(`✅ ${authOnlyPath} → 홈으로 리다이렉트`);
      }
    });

    test('미인증 사용자는 로그인/회원가입 페이지 정상 접근', async ({ page }) => {
      // Given: 토큰 없는 상태
      await authHelper.removeTokenFromLocalStorage();

      // When & Then: 로그인/회원가입 페이지 접근
      for (const authOnlyPath of AUTH_ONLY_PATHS) {
        await page.goto(authOnlyPath);

        // 페이지가 정상적으로 로드되어야 함
        await page.waitForLoadState('networkidle');
        const currentUrl = page.url();
        expect(currentUrl).toContain(authOnlyPath);

        console.log(`✅ ${authOnlyPath} → 정상 접근`);
      }
    });
  });

  test.describe('JWT 토큰 검증 로직 테스트', () => {
    test('미들웨어의 다양한 토큰 소스 검증', async ({ page }) => {
      // Test 1: Authorization Bearer 헤더
      await page.route('/admin', async (route) => {
        const request = route.request();
        request.headers()['authorization'] = `Bearer ${authenticatedUser.token.token}`;
        await route.continue();
      });

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/login');

      // Test 2: Session 쿠키
      await page.context().addCookies([{
        name: 'session',
        value: authenticatedUser.token.token,
        domain: 'localhost',
        path: '/'
      }]);

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).not.toContain('/login');

      console.log('✅ 미들웨어 토큰 소스 검증 완료');
    });

    test('잘못된 JWT 형식 토큰 차단', async ({ page }) => {
      // Given: 잘못된 형식의 토큰들
      const invalidTokens = [
        'not-a-jwt-token',
        'invalid.jwt.format',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD.signature',
        '', // 빈 토큰
        'null',
        'undefined',
      ];

      // When & Then: 각 잘못된 토큰으로 접근 시도
      for (const invalidToken of invalidTokens) {
        await page.context().addCookies([{
          name: 'session',
          value: invalidToken,
          domain: 'localhost',
          path: '/'
        }]);

        await page.goto('/admin');

        // 로그인 페이지로 리다이렉트되어야 함
        await expect(page).toHaveURL(/\/login/);

        console.log(`✅ 잘못된 토큰 "${invalidToken.substring(0, 20)}..." 차단됨`);

        // 쿠키 정리
        await page.context().clearCookies();
      }
    });

    test('토큰 변조 시도 차단', async ({ page }) => {
      // Given: 원본 토큰을 변조
      const originalToken = authenticatedUser.token.token;
      const tokenParts = originalToken.split('.');

      // 각 부분을 변조한 토큰들
      const tamperedTokens = [
        `TAMPERED.${tokenParts[1]}.${tokenParts[2]}`, // 헤더 변조
        `${tokenParts[0]}.TAMPERED.${tokenParts[2]}`, // 페이로드 변조
        `${tokenParts[0]}.${tokenParts[1]}.TAMPERED`, // 서명 변조
      ];

      // When & Then: 변조된 토큰으로 접근 시도
      for (const tamperedToken of tamperedTokens) {
        await page.context().addCookies([{
          name: 'session',
          value: tamperedToken,
          domain: 'localhost',
          path: '/'
        }]);

        await page.goto('/admin');

        // 로그인 페이지로 리다이렉트되어야 함
        await expect(page).toHaveURL(/\/login/);

        console.log('✅ 변조된 토큰 차단됨');

        await page.context().clearCookies();
      }
    });
  });

  test.describe('미들웨어 Edge Cases', () => {
    test('API 경로는 미들웨어에서 제외 확인', async ({ page }) => {
      // Given: 토큰 없는 상태로 API 경로 접근
      await authHelper.removeTokenFromLocalStorage();

      // When: API 경로 접근 (미들웨어에서 제외되어야 함)
      const apiPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/me',
        '/api/planning/scenario',
      ];

      // Then: API는 미들웨어에서 처리하지 않고 개별 API에서 처리
      for (const apiPath of apiPaths) {
        const response = await page.request.get(`${BASE_URL}${apiPath}`);

        // 미들웨어에서 리다이렉트하지 않음 (API는 JSON 응답)
        expect(response.status()).not.toBe(302); // 리다이렉트 아님
        expect(response.headers()['content-type']).toContain('application/json');

        console.log(`✅ API ${apiPath} → 미들웨어 제외 확인 (${response.status()})`);
      }
    });

    test('정적 파일 경로 미들웨어 제외 확인', async ({ page }) => {
      // Given: 정적 파일 경로들
      const staticPaths = [
        '/_next/static/css/app.css',
        '/_next/image?url=/favicon.ico&w=32&q=75',
        '/favicon.ico',
        '/robots.txt',
        '/sitemap.xml',
      ];

      // When & Then: 정적 파일들이 미들웨어를 거치지 않는지 확인
      for (const staticPath of staticPaths) {
        const response = await page.request.get(`${BASE_URL}${staticPath}`);

        // 404는 허용 (파일이 실제로 없을 수 있음)
        // 중요한 것은 리다이렉트(302)가 아니라는 것
        expect(response.status()).not.toBe(302);

        console.log(`✅ 정적 파일 ${staticPath} → 미들웨어 제외 (${response.status()})`);
      }
    });

    test('동시 다중 요청에서의 미들웨어 안정성', async ({ browser }) => {
      // Given: 여러 브라우저 컨텍스트로 동시 요청
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext(),
      ]);

      const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

      // When: 동시에 보호된 경로 접근
      const accessPromises = pages.map(async (page, index) => {
        if (index % 2 === 0) {
          // 짝수 번째는 인증된 사용자
          const helper = new AuthTestHelper(page, page.request);
          await helper.setTokenInLocalStorage(authenticatedUser.token.token);
        }
        // 홀수 번째는 미인증 사용자

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        return {
          index,
          url: page.url(),
          isAuthenticated: index % 2 === 0,
        };
      });

      const results = await Promise.all(accessPromises);

      // Then: 각각 올바르게 처리되어야 함
      results.forEach((result) => {
        if (result.isAuthenticated) {
          expect(result.url).not.toContain('/login');
        } else {
          expect(result.url).toContain('/login');
        }

        console.log(`User ${result.index}: ${result.isAuthenticated ? 'Authenticated' : 'Unauthenticated'} → ${result.url.includes('/login') ? 'Redirected' : 'Allowed'}`);
      });

      // 정리
      await Promise.all(contexts.map(ctx => ctx.close()));
    });

    test('미들웨어 성능 - 토큰 검증 시간', async ({ page }) => {
      // Given: 유효한 토큰
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);

      // When: 보호된 경로에 여러 번 접근하여 성능 측정
      const measurements = [];

      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        const endTime = Date.now();

        measurements.push(endTime - startTime);
      }

      // Then: 미들웨어 처리 시간이 합리적이어야 함
      const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;

      console.log(`미들웨어 평균 처리 시간: ${averageTime}ms`);
      console.log(`개별 측정: ${measurements.join(', ')}ms`);

      // 10초 이내에 처리되어야 함 (너무 느리면 문제)
      expect(averageTime).toBeLessThan(10000);
      measurements.forEach(time => {
        expect(time).toBeLessThan(15000); // 개별 요청도 15초 이내
      });
    });
  });

  test.describe('프로덕션 환경 특화 테스트', () => {
    test('Admin 토큰 검증 (프로덕션 환경)', async ({ page }) => {
      // 이 테스트는 실제로는 프로덕션 환경에서만 동작
      // 개발 환경에서는 스킵되어야 함

      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  Admin token test skipped (not production environment)');
        return;
      }

      // Given: Admin 토큰 없이 /admin 접근
      await page.goto('/admin');

      // Then: 401 Unauthorized 응답
      const response = await page.request.get(`${BASE_URL}/admin`);
      expect(response.status()).toBe(401);

      // Given: 잘못된 Admin 토큰
      const response2 = await page.request.get(`${BASE_URL}/admin?token=invalid-token`);
      expect(response2.status()).toBe(401);

      console.log('✅ 프로덕션 Admin 토큰 검증 완료');
    });

    test('trace ID 및 request ID 헤더 확인', async ({ page }) => {
      // Given: 임의의 페이지 요청
      await page.goto('/');

      // When: 네트워크 요청 모니터링
      let traceId: string | null = null;
      let requestId: string | null = null;

      page.on('response', response => {
        const headers = response.headers();
        if (headers['x-trace-id']) {
          traceId = headers['x-trace-id'];
        }
        if (headers['x-request-id']) {
          requestId = headers['x-request-id'];
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Then: 트레이스 헤더들이 설정되어야 함
      expect(traceId).toBeTruthy();
      expect(requestId).toBeTruthy();

      console.log(`✅ Trace ID: ${traceId}`);
      console.log(`✅ Request ID: ${requestId}`);
    });

    test('인증 상태 헤더 확인', async ({ page }) => {
      // Test 1: 미인증 상태
      await authHelper.removeTokenFromLocalStorage();

      let authHeader: string | null = null;

      page.on('response', response => {
        const headers = response.headers();
        if (headers['x-authenticated']) {
          authHeader = headers['x-authenticated'];
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      expect(authHeader).toBe('false');

      // Test 2: 인증 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      authHeader = null;

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      expect(authHeader).toBe('true');

      console.log('✅ 인증 상태 헤더 확인 완료');
    });
  });
});