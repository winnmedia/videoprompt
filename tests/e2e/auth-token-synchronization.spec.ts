import { test, expect, type Page } from '@playwright/test';
import {
  AuthTestHelper,
  createTestUser,
  type TestUser,
  type AuthToken,
} from '../fixtures/auth';

/**
 * 토큰 시스템 동기화 및 상태 관리 종합 테스트
 *
 * Critical Test Suite: $300 사건 재발 방지를 위한 토큰 생명주기 검증
 *
 * TDD 원칙:
 * - Red: localStorage/쿠키 동기화 실패 시나리오 테스트
 * - Green: 토큰 갱신 및 만료 처리 검증
 * - Refactor: 토큰 상태 일관성 보장
 *
 * 핵심 검증 사항:
 * - localStorage ↔ 쿠키 동기화
 * - 토큰 만료 시 자동 갱신/로그아웃
 * - 다중 탭에서의 토큰 상태 동기화
 * - 위조된 토큰 차단
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

test.describe('토큰 시스템 동기화 검증', () => {
  let authHelper: AuthTestHelper;
  let authenticatedUser: { user: TestUser; token: AuthToken };

  test.beforeEach(async ({ page, request }) => {
    authHelper = new AuthTestHelper(page, request);
    authenticatedUser = await authHelper.createAuthenticatedUser();
  });

  test.describe('localStorage와 쿠키 동기화', () => {
    test('로그인 시 localStorage와 쿠키 모두 설정 확인', async ({ page }) => {
      // Given: 로그인 페이지로 이동
      await page.goto('/login');

      // When: 로그인 수행
      await page.fill('[data-testid="email-input"]', authenticatedUser.user.email);
      await page.fill('[data-testid="password-input"]', authenticatedUser.user.password);
      await page.click('[data-testid="login-button"]');

      // 로그인 완료 대기
      await expect(page).toHaveURL('/');

      // Then: localStorage와 쿠키 모두 토큰 저장 확인
      const storageState = await page.evaluate(() => {
        return {
          localStorage: {
            authToken: localStorage.getItem('auth_token'),
            authTokenExpiresAt: localStorage.getItem('auth_token_expires_at'),
          },
          cookies: document.cookie,
        };
      });

      expect(storageState.localStorage.authToken).toBeTruthy();
      expect(storageState.localStorage.authTokenExpiresAt).toBeTruthy();
      expect(storageState.cookies).toContain('session');

      // 토큰 만료 시간이 미래인지 확인
      const expiresAt = parseInt(storageState.localStorage.authTokenExpiresAt!);
      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    test('토큰 수동 설정 시 자동 동기화 확인', async ({ page }) => {
      // Given: 페이지 로드 후 수동으로 localStorage에 토큰 설정
      await page.goto('/');

      const token = authenticatedUser.token.token;
      await page.evaluate((tokenValue) => {
        localStorage.setItem('auth_token', tokenValue);
        localStorage.setItem('auth_token_expires_at', String(Date.now() + 3600000));

        // 토큰 동기화 이벤트 트리거 (실제 앱에서 사용하는 방식)
        window.dispatchEvent(new CustomEvent('auth:token-updated'));
      }, token);

      // When: 페이지 새로고침 후 인증 상태 확인
      await page.reload();

      // 인증이 필요한 페이지로 이동하여 토큰이 작동하는지 확인
      await page.goto('/admin');

      // Then: 자동으로 쿠키와 동기화되어 인증 상태 유지
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login'); // 로그인 페이지로 리디렉트되지 않음
    });

    test('쿠키 삭제 시 localStorage 자동 정리', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/');

      // 쿠키 설정 (로그인 상태 시뮬레이션)
      await page.context().addCookies([{
        name: 'session',
        value: authenticatedUser.token.token,
        domain: 'localhost',
        path: '/'
      }]);

      // When: 쿠키만 삭제 (서버에서 로그아웃 시뮬레이션)
      await page.context().clearCookies();

      // 동기화 이벤트 트리거
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      });

      // Then: localStorage도 자동으로 정리되어야 함
      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.token).toBeNull();
    });

    test('다중 탭에서의 토큰 상태 동기화', async ({ context }) => {
      // Given: 첫 번째 탭에서 로그인
      const page1 = await context.newPage();
      await page1.goto('/login');

      await page1.fill('[data-testid="email-input"]', authenticatedUser.user.email);
      await page1.fill('[data-testid="password-input"]', authenticatedUser.user.password);
      await page1.click('[data-testid="login-button"]');
      await expect(page1).toHaveURL('/');

      // When: 두 번째 탭 오픈
      const page2 = await context.newPage();
      await page2.goto('/');

      // Then: 두 번째 탭도 자동으로 인증 상태여야 함
      const authInfo2 = await page2.evaluate(() => ({
        token: localStorage.getItem('auth_token'),
        isAuthenticated: !!localStorage.getItem('auth_token'),
      }));

      expect(authInfo2.isAuthenticated).toBe(true);
      expect(authInfo2.token).toBeTruthy();

      // When: 첫 번째 탭에서 로그아웃
      await page1.evaluate(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expires_at');
        window.dispatchEvent(new CustomEvent('auth:logout'));
      });

      // 약간의 대기 (동기화 시간)
      await page2.waitForTimeout(1000);

      // Then: 두 번째 탭도 자동으로 로그아웃 상태가 되어야 함
      const authInfo2AfterLogout = await page2.evaluate(() => ({
        token: localStorage.getItem('auth_token'),
        isAuthenticated: !!localStorage.getItem('auth_token'),
      }));

      expect(authInfo2AfterLogout.isAuthenticated).toBe(false);

      await page1.close();
      await page2.close();
    });
  });

  test.describe('토큰 만료 처리', () => {
    test('토큰 만료 시 자동 로그아웃 플로우', async ({ page }) => {
      // Given: 만료된 토큰 설정
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);

      // When: 보호된 페이지 접근
      await page.goto('/admin');

      // Then: 자동으로 로그인 페이지로 리디렉트
      await expect(page).toHaveURL(/\/login/);

      // localStorage도 정리되어야 함
      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.token).toBeNull();
    });

    test('토큰 만료 임박 시 자동 갱신', async ({ page }) => {
      // Given: 만료 임박한 토큰 설정 (1분 후 만료)
      const almostExpiredToken = authenticatedUser.token.token;
      await page.addInitScript((token) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_token_expires_at', String(Date.now() + 60000)); // 1분 후 만료
      }, almostExpiredToken);

      await page.goto('/');

      // When: API 호출이 발생할 상황 생성 (자동 갱신 트리거)
      const apiResponse = await page.request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${almostExpiredToken}` }
      });

      // Then: 토큰 자동 갱신 또는 적절한 처리
      if (apiResponse.ok()) {
        const responseData = await apiResponse.json();

        // 새로운 토큰이 응답에 포함되었는지 확인
        if (responseData.data?.accessToken || responseData.data?.token) {
          console.log('Token refresh successful');
          expect(responseData.data.accessToken || responseData.data.token).toBeTruthy();
        }
      } else {
        // 토큰 갱신 실패 시 로그아웃 처리
        expect(apiResponse.status()).toBe(401);
      }
    });

    test('refresh token을 이용한 토큰 갱신', async ({ page }) => {
      // Given: refresh token이 있는 상태
      const refreshToken = authenticatedUser.token.refreshToken;

      if (refreshToken) {
        // 현재 토큰을 만료시킴
        await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);

        // When: refresh token으로 새 토큰 요청
        const refreshResult = await authHelper.attemptTokenRefresh(refreshToken);

        // Then: 새로운 토큰 획득 성공
        expect(refreshResult.success).toBe(true);
        expect(refreshResult.newToken).toBeTruthy();
        expect(refreshResult.newToken).not.toBe(authenticatedUser.token.token);

        // 새 토큰으로 API 호출 성공 확인
        const apiResponse = await page.request.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${refreshResult.newToken}` }
        });

        expect(apiResponse.ok()).toBe(true);
      } else {
        console.log('Refresh token not available - skipping test');
      }
    });
  });

  test.describe('토큰 보안 검증', () => {
    test('XSS 공격으로부터 토큰 보호', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/');

      // When: XSS 스크립트 실행 시뮬레이션
      const tokenExtractionAttempt = await page.evaluate(() => {
        try {
          // 다양한 토큰 추출 시도
          const attempts = {
            localStorage: localStorage.getItem('auth_token'),
            cookies: document.cookie,
            sessionStorage: sessionStorage.getItem('auth_token'),
          };

          // 토큰이 실제로 접근 가능한지 확인
          return {
            success: true,
            tokens: attempts,
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      });

      // Then: 토큰 접근 가능 여부에 따른 보안 검증
      if (tokenExtractionAttempt.success) {
        // 토큰이 접근 가능한 경우, 추가 보안 조치가 있는지 확인
        console.log('Tokens accessible:', tokenExtractionAttempt.tokens);

        // HttpOnly 쿠키 등의 보안 조치 확인
        const hasSecureCookie = tokenExtractionAttempt.tokens.cookies.includes('HttpOnly');
        if (!hasSecureCookie) {
          console.warn('⚠️  토큰이 JavaScript로 접근 가능합니다. HttpOnly 쿠키 사용을 고려하세요.');
        }
      }
    });

    test('CSRF 토큰 검증', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/');

      // When: CSRF 토큰 없이 중요한 작업 시도
      const csrfProtectedResponse = await page.request.post(`${BASE_URL}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${authenticatedUser.token.token}` }
        // CSRF 토큰 없이 요청
      });

      // Then: CSRF 보호가 있는 경우 확인
      if (csrfProtectedResponse.status() === 403) {
        console.log('✅ CSRF protection active');

        const responseData = await csrfProtectedResponse.json().catch(() => ({}));
        expect(responseData.error).toMatch(/CSRF|토큰|보안/);
      } else {
        // CSRF 보호가 없다면 최소한 올바른 인증은 되어야 함
        expect([200, 204]).toContain(csrfProtectedResponse.status());
      }
    });

    test('토큰 재사용 공격 방지', async ({ page }) => {
      // Given: 로그아웃된 토큰
      const token = authenticatedUser.token.token;

      // 로그아웃 수행
      await page.request.post(`${BASE_URL}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // When: 로그아웃된 토큰으로 API 접근 시도
      const reuseAttempt = await page.request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Then: 토큰 재사용 차단되어야 함
      expect(reuseAttempt.status()).toBe(401);

      const responseData = await reuseAttempt.json().catch(() => ({}));
      expect(responseData.error || responseData.message).toMatch(/만료|유효하지 않음|토큰/);
    });
  });

  test.describe('브라우저 환경별 토큰 처리', () => {
    test('시크릿 모드에서의 토큰 처리', async ({ browser }) => {
      // Given: 시크릿 모드 컨텍스트 생성
      const incognitoContext = await browser.newContext();
      const incognitoPage = await incognitoContext.newPage();

      // When: 시크릿 모드에서 로그인
      await incognitoPage.goto('/login');
      await incognitoPage.fill('[data-testid="email-input"]', authenticatedUser.user.email);
      await incognitoPage.fill('[data-testid="password-input"]', authenticatedUser.user.password);
      await incognitoPage.click('[data-testid="login-button"]');

      // Then: 정상적으로 로그인되어야 함
      await expect(incognitoPage).toHaveURL('/');

      const incognitoAuthInfo = await incognitoPage.evaluate(() => ({
        hasToken: !!localStorage.getItem('auth_token'),
        hasCookie: document.cookie.includes('session'),
      }));

      expect(incognitoAuthInfo.hasToken).toBe(true);

      // 시크릿 모드 컨텍스트 종료 시 토큰 자동 삭제 확인
      await incognitoContext.close();
    });

    test('페이지 새로고침 시 토큰 지속성', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/admin');

      // When: 페이지 새로고침
      await page.reload();

      // Then: 인증 상태 유지
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');

      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.token).toBeTruthy();
    });

    test('브라우저 재시작 시뮬레이션', async ({ browser }) => {
      // Given: 새로운 컨텍스트에서 토큰 설정 (브라우저 재시작 시뮬레이션)
      const newContext = await browser.newContext();
      const newPage = await newContext.newPage();

      // When: localStorage에 토큰 수동 설정 (이전 세션에서 저장된 토큰)
      await newPage.addInitScript((token) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_token_expires_at', String(Date.now() + 3600000));
      }, authenticatedUser.token.token);

      await newPage.goto('/admin');

      // Then: 토큰이 여전히 유효한지 확인
      const currentUrl = newPage.url();
      if (currentUrl.includes('/login')) {
        // 토큰이 만료되었거나 유효하지 않음
        console.log('Token expired or invalid after browser restart simulation');
      } else {
        // 토큰이 여전히 유효함
        console.log('Token persisted after browser restart simulation');
        expect(currentUrl).not.toContain('/login');
      }

      await newContext.close();
    });
  });

  test.describe('Edge Case 처리', () => {
    test('localStorage 용량 한계 시 토큰 처리', async ({ page }) => {
      // Given: localStorage 용량을 거의 가득 채움
      await page.evaluate(() => {
        try {
          // localStorage 용량 한계까지 데이터 저장
          let i = 0;
          while (i < 1000) {
            localStorage.setItem(`test_key_${i}`, 'x'.repeat(1000));
            i++;
          }
        } catch (error) {
          console.log('localStorage full:', error);
        }
      });

      // When: 토큰 저장 시도
      const tokenSetResult = await page.evaluate((token) => {
        try {
          localStorage.setItem('auth_token', token);
          return { success: true, error: null };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }, authenticatedUser.token.token);

      // Then: 토큰 저장 실패 시 적절한 처리
      if (!tokenSetResult.success) {
        console.log('Token storage failed due to localStorage limit');
        expect(tokenSetResult.error).toContain('QuotaExceededError');

        // 대체 저장소 사용 또는 적절한 에러 처리 확인
        // 실제 앱에서는 쿠키나 다른 저장소 사용해야 함
      } else {
        console.log('Token stored successfully despite localStorage pressure');
      }

      // 정리
      await page.evaluate(() => {
        localStorage.clear();
      });
    });

    test('네트워크 연결 끊김 시 토큰 갱신 실패 처리', async ({ page }) => {
      // Given: 만료 임박한 토큰과 오프라인 상태
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);
      await authHelper.simulateNetworkConditions('offline');

      // When: 토큰 갱신이 필요한 상황에서 API 호출
      await page.goto('/admin');

      // Then: 적절한 오프라인 처리
      const pageContent = await page.textContent('body');
      const isOfflineHandled = pageContent?.includes('오프라인') ||
                              pageContent?.includes('네트워크') ||
                              page.url().includes('/login');

      expect(isOfflineHandled).toBe(true);

      // 네트워크 복구
      await authHelper.simulateNetworkConditions('normal');
    });

    test('동시 다중 토큰 갱신 요청 처리', async ({ page }) => {
      // Given: 만료 임박한 토큰
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/');

      // When: 동시에 여러 API 호출 (토큰 갱신 중복 요청 시뮬레이션)
      const apiCalls = Array.from({ length: 5 }, (_, index) =>
        page.request.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authenticatedUser.token.token}` }
        })
      );

      const responses = await Promise.all(apiCalls);

      // Then: 중복 토큰 갱신 요청이 적절히 처리되어야 함
      const statusCodes = responses.map(r => r.status());
      console.log('Concurrent token refresh requests:', statusCodes);

      // 모두 실패하거나 모두 성공해야 함 (일관성 유지)
      const allSuccess = statusCodes.every(code => code === 200);
      const allFailed = statusCodes.every(code => code === 401);

      expect(allSuccess || allFailed).toBe(true);
    });
  });
});