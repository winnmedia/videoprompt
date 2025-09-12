import { test, expect, Page } from '@playwright/test';
import { 
  AuthTestHelper, 
  TEST_ENDPOINTS, 
  PERFORMANCE_THRESHOLDS, 
  ERROR_MESSAGES,
  createTestUser,
  type TestUser,
  type AuthToken,
  type PerformanceMetrics,
} from '../fixtures/auth';

/**
 * 401 인증 오류 해결을 위한 특화 E2E 테스트
 * 
 * TDD 원칙: Red → Green → Refactor
 * - 실패하는 테스트를 먼저 작성하여 요구사항을 명세화
 * - 401 오류 시나리오에 특화된 테스트 케이스
 * - 토큰 복구 메커니즘 검증
 * - 성능 및 브라우저 호환성 검증
 * 
 * CLAUDE.md FSD 아키텍처 준수:
 * - MSW 없이 실제 API 엔드포인트 테스트
 * - 결정론적(Deterministic) 테스트 환경 보장
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

// 테스트 전용 상수
const TEST_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
  PERFORMANCE_SAMPLES: 5,
} as const;

test.describe('401 인증 오류 해결 E2E 테스트', () => {
  let authHelper: AuthTestHelper;
  let authenticatedUser: { user: TestUser; token: AuthToken };

  test.beforeEach(async ({ page, request }) => {
    authHelper = new AuthTestHelper(page, request);
    
    // 각 테스트마다 새로운 인증된 사용자 생성
    authenticatedUser = await authHelper.createAuthenticatedUser();
  });

  test.describe('401 오류 시나리오 검증', () => {
    test('localStorage에 토큰 없음 - 401 오류 발생 확인', async () => {
      // Given: 토큰이 없는 상태
      await authHelper.removeTokenFromLocalStorage();
      
      // When: 보호된 API 엔드포인트 호출
      const unauthorizedResult = await authHelper.verify401Error('/api/auth/me');
      
      // Then: 401 오류 및 적절한 에러 메시지 확인
      expect(unauthorizedResult.isUnauthorized).toBe(true);
      expect(unauthorizedResult.statusCode).toBe(401);
      expect(unauthorizedResult.errorMessage).toContain(ERROR_MESSAGES.NO_TOKEN);
    });

    test('만료된 토큰 - 401 오류 발생 확인', async () => {
      // Given: 만료된 토큰 설정
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);
      
      // When: 보호된 API 엔드포인트 호출
      const expiredTokenResult = await authHelper.verify401Error('/api/auth/me');
      
      // Then: 401 오류 및 만료 메시지 확인
      expect(expiredTokenResult.isUnauthorized).toBe(true);
      expect(expiredTokenResult.statusCode).toBe(401);
      expect(expiredTokenResult.errorMessage).toContain(ERROR_MESSAGES.EXPIRED_TOKEN);
      
      // localStorage에서 만료 상태 확인
      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.isExpired).toBe(true);
    });

    test('Bearer 헤더 누락 - 401 오류 발생 확인', async ({ request }) => {
      // Given: 유효한 토큰이지만 Bearer 헤더 없이 요청
      const response = await request.get(`${BASE_URL}/api/auth/me`);
      
      // Then: 401 오류 확인
      expect(response.status()).toBe(401);
      
      const responseData = await response.json().catch(() => ({}));
      expect(responseData.error || responseData.message).toContain(ERROR_MESSAGES.NO_TOKEN);
    });

    test('잘못된 Bearer 토큰 형식 - 401 오류 발생 확인', async ({ request }) => {
      // Given: 잘못된 형식의 토큰
      const invalidTokenFormats = [
        'invalid-token-format',
        'Bearer ',
        'Bearer invalid.token.format',
        'Token ' + authenticatedUser.token.token, // Bearer가 아닌 다른 prefix
      ];

      for (const invalidToken of invalidTokenFormats) {
        // When: 잘못된 형식으로 API 호출
        const response = await request.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: invalidToken },
        });

        // Then: 401 오류 확인
        expect(response.status()).toBe(401);
        
        const responseData = await response.json().catch(() => ({}));
        expect(responseData.error || responseData.message).toMatch(
          new RegExp(`(${ERROR_MESSAGES.INVALID_TOKEN}|${ERROR_MESSAGES.NO_TOKEN})`)
        );
      }
    });
  });

  test.describe('Bearer 토큰 전달 검증', () => {
    test('올바른 Bearer 토큰 헤더 전달 확인', async () => {
      // Given: 유효한 토큰
      const token = authenticatedUser.token.token;
      
      // When: Bearer 헤더와 함께 API 호출
      const bearerResult = await authHelper.verifyBearerTokenHeader('/api/auth/me', token);
      
      // Then: 성공적인 요청 및 헤더 확인
      expect(bearerResult.success).toBe(true);
      expect(bearerResult.statusCode).toBe(200);
      expect(bearerResult.hasAuthHeader).toBe(true);
    });

    test('다중 보호된 엔드포인트 Bearer 토큰 검증', async () => {
      // Given: 인증된 사용자 토큰
      const token = authenticatedUser.token.token;
      
      // When: 여러 보호된 엔드포인트 테스트
      const protectedEndpoints = TEST_ENDPOINTS.AUTH_ENDPOINTS;
      
      for (const endpoint of protectedEndpoints) {
        const result = await authHelper.verifyBearerTokenHeader(endpoint, token);
        
        // Then: 모든 엔드포인트에서 올바른 Bearer 헤더 처리 확인
        expect(result.hasAuthHeader).toBe(true);
        // 401이 아닌 상태 코드 (200, 400, 404 등은 허용, 인증 자체는 통과)
        expect(result.statusCode).not.toBe(401);
      }
    });
  });

  test.describe('토큰 복구 시나리오', () => {
    test('토큰 새로고침 성공 시나리오', async ({ page }) => {
      // Given: 유효한 refresh token이 있는 사용자
      const refreshToken = authenticatedUser.token.refreshToken;
      
      // 현재 토큰을 만료시킴
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);
      
      if (refreshToken) {
        // When: 토큰 새로고침 시도
        const refreshResult = await authHelper.attemptTokenRefresh(refreshToken);
        
        // Then: 새로운 토큰 획득 성공
        expect(refreshResult.success).toBe(true);
        expect(refreshResult.newToken).toBeDefined();
        expect(refreshResult.newToken).not.toBe(authenticatedUser.token.token);
        
        // 새 토큰으로 API 호출 성공 확인
        const newTokenResult = await authHelper.verifyBearerTokenHeader(
          '/api/auth/me', 
          refreshResult.newToken!
        );
        expect(newTokenResult.success).toBe(true);
      }
    });

    test('자동 로그아웃 시나리오', async ({ page }) => {
      // Given: 인증된 상태에서 보호된 페이지 접근
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/admin');
      
      // When: 토큰을 만료시키고 자동 로그아웃 트리거
      await authHelper.setExpiredTokenInLocalStorage(authenticatedUser.token.token);
      
      // 401 오류 발생하는 API 호출로 자동 로그아웃 트리거
      await page.evaluate(() => {
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        }).catch(() => {
          // 401 오류 시 자동 로그아웃 이벤트 발생
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        });
      });
      
      // Then: 자동 로그아웃 동작 확인
      await authHelper.simulateAutoLogout();
      
      // 토큰이 정리되었는지 확인
      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.token).toBeNull();
    });

    test('재로그인 플로우', async ({ page }) => {
      // Given: 401 오류로 인한 자동 로그아웃 후
      await authHelper.removeTokenFromLocalStorage();
      await page.goto('/login');
      
      // When: 기존 사용자로 재로그인
      await page.fill('[data-testid="email-input"]', authenticatedUser.user.email);
      await page.fill('[data-testid="password-input"]', authenticatedUser.user.password);
      await page.click('[data-testid="login-button"]');
      
      // Then: 로그인 성공 및 토큰 복구 확인
      await expect(page).toHaveURL('/');
      
      const newAuthInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(newAuthInfo.token).not.toBeNull();
      expect(newAuthInfo.isExpired).toBe(false);
      
      // 새 토큰으로 API 호출 성공 확인
      const apiResult = await authHelper.verifyBearerTokenHeader(
        '/api/auth/me', 
        newAuthInfo.token!
      );
      expect(apiResult.success).toBe(true);
    });
  });

  test.describe('성능 테스트', () => {
    test('API 응답 시간 100ms 이하 검증', async () => {
      // Given: 유효한 인증 토큰
      const token = authenticatedUser.token.token;
      const measurements: PerformanceMetrics[] = [];
      
      // When: 여러 번 API 호출하여 성능 측정
      for (let i = 0; i < TEST_CONFIG.PERFORMANCE_SAMPLES; i++) {
        const metrics = await authHelper.measureApiPerformance('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        measurements.push(metrics);
      }
      
      // Then: 평균 응답 시간이 임계값 이하인지 확인
      const averageResponseTime = measurements.reduce(
        (sum, metric) => sum + metric.responseTime, 
        0
      ) / measurements.length;
      
      expect(averageResponseTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_MS);
      
      // 모든 개별 측정값도 임계값의 2배 이하인지 확인 (이상치 방지)
      measurements.forEach(metric => {
        expect(metric.responseTime).toBeLessThanOrEqual(
          PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_MS * 2
        );
        expect(metric.statusCode).toBe(200);
      });
    });

    test('토큰 검증 성능 테스트', async () => {
      // Given: 다양한 길이의 토큰들
      const tokens = [
        authenticatedUser.token.token,
        'short-token',
        'very-long-token-'.repeat(10) + authenticatedUser.token.token,
      ];
      
      for (const token of tokens) {
        // When: 토큰 검증 시간 측정
        const startTime = Date.now();
        await authHelper.verifyBearerTokenHeader('/api/auth/me', token);
        const validationTime = Date.now() - startTime;
        
        // Then: 검증 시간이 임계값 이하인지 확인
        expect(validationTime).toBeLessThanOrEqual(
          PERFORMANCE_THRESHOLDS.TOKEN_VALIDATION_TIME_MS
        );
      }
    });

    test('네트워크 지연 상황에서의 401 오류 처리', async ({ page }) => {
      // Given: 느린 네트워크 상황 시뮬레이션
      await authHelper.simulateNetworkConditions('slow');
      await authHelper.removeTokenFromLocalStorage();
      
      // When: 보호된 리소스 접근 시도
      const startTime = Date.now();
      await page.goto('/admin');
      const loadTime = Date.now() - startTime;
      
      // Then: 적절한 시간 내에 로그인 페이지로 리디렉트
      await expect(page).toHaveURL(/\/login/);
      expect(loadTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.PAGE_LOAD_TIME_MS);
      
      // 네트워크 상태 복구
      await authHelper.simulateNetworkConditions('normal');
    });
  });

  test.describe('브라우저 호환성 테스트', () => {
    test('localStorage 지원 및 동작 확인', async ({ page }) => {
      // Given: 다양한 브라우저 환경에서의 localStorage 테스트
      const localStorageSupport = await authHelper.verifyCrossBrowserLocalStorageSupport();
      
      // Then: localStorage 기본 기능 확인
      expect(localStorageSupport.hasLocalStorage).toBe(true);
      expect(localStorageSupport.canStore).toBe(true);
      expect(localStorageSupport.canRetrieve).toBe(true);
      
      if (localStorageSupport.error) {
        console.warn('localStorage 오류:', localStorageSupport.error);
      }
    });

    test('다양한 토큰 형태의 localStorage 저장/복구', async ({ page }) => {
      // Given: 다양한 형태의 토큰들
      const tokenVariations = [
        authenticatedUser.token.token, // 정상 JWT
        'simple-token-123', // 단순 문자열
        JSON.stringify({ token: authenticatedUser.token.token }), // JSON 형태
        'Bearer ' + authenticatedUser.token.token, // Bearer prefix 포함
      ];
      
      for (const tokenVariation of tokenVariations) {
        // When: 각 토큰 형태를 localStorage에 저장
        await authHelper.setTokenInLocalStorage(tokenVariation);
        
        // Then: 저장 및 검색 확인
        const storedAuthInfo = await authHelper.getAuthInfoFromLocalStorage();
        expect(storedAuthInfo.token).toBe(tokenVariation);
        
        // 정리
        await authHelper.removeTokenFromLocalStorage();
      }
    });

    test('세션 스토리지와의 동기화 테스트', async ({ page }) => {
      // Given: 토큰을 localStorage에 저장
      const token = authenticatedUser.token.token;
      await authHelper.setTokenInLocalStorage(token);
      
      // When: 다른 탭에서 동일한 도메인 접근 시뮬레이션
      const secondPage = await page.context().newPage();
      await secondPage.goto('/');
      
      // Then: 세션 공유 확인
      const sharedAuthInfo = await secondPage.evaluate(() => {
        return {
          token: localStorage.getItem('auth_token'),
          expiresAt: localStorage.getItem('auth_token_expires_at'),
        };
      });
      
      expect(sharedAuthInfo.token).toBe(token);
      expect(sharedAuthInfo.expiresAt).toBeDefined();
      
      await secondPage.close();
    });

    test('브라우저 새로고침 시 토큰 지속성', async ({ page }) => {
      // Given: 인증된 상태
      await authHelper.setTokenInLocalStorage(authenticatedUser.token.token);
      await page.goto('/admin');
      
      // When: 브라우저 새로고침
      await page.reload();
      
      // Then: 인증 상태 유지 확인
      const authInfo = await authHelper.getAuthInfoFromLocalStorage();
      expect(authInfo.token).toBe(authenticatedUser.token.token);
      expect(authInfo.isExpired).toBe(false);
      
      // 보호된 페이지에 여전히 접근 가능한지 확인
      await expect(page).not.toHaveURL(/\/login/);
    });
  });

  test.describe('보호된 라우트 접근 테스트', () => {
    test('인증 없이 보호된 라우트 접근 시 401/로그인 리디렉트', async () => {
      // Given: 토큰 없는 상태
      await authHelper.removeTokenFromLocalStorage();
      
      // When: 모든 보호된 라우트 접근 시도
      const accessResults = await authHelper.testProtectedRouteAccess(
        [...TEST_ENDPOINTS.PROTECTED_ROUTES]
      );
      
      // Then: 모든 라우트에서 인증 실패 확인
      accessResults.forEach(result => {
        expect(result.accessible).toBe(false);
        expect([401, 403]).toContain(result.statusCode);
        expect(result.redirectedToLogin).toBe(true);
      });
    });

    test('유효한 토큰으로 보호된 라우트 접근 성공', async () => {
      // Given: 유효한 토큰
      const token = authenticatedUser.token.token;
      
      // When: 보호된 라우트 접근
      const accessResults = await authHelper.testProtectedRouteAccess(
        [...TEST_ENDPOINTS.PROTECTED_ROUTES],
        token
      );
      
      // Then: 접근 허용 확인 (권한에 따라 다를 수 있음)
      accessResults.forEach(result => {
        // 401은 발생하지 않아야 함 (인증은 통과)
        expect(result.statusCode).not.toBe(401);
        expect(result.redirectedToLogin).toBe(false);
      });
    });

    test('만료된 토큰으로 보호된 라우트 접근 시 자동 리디렉트', async () => {
      // Given: 만료된 토큰
      const expiredToken = authenticatedUser.token.token;
      await authHelper.setExpiredTokenInLocalStorage(expiredToken);
      
      // When: 보호된 라우트 접근
      const accessResults = await authHelper.testProtectedRouteAccess(
        [...TEST_ENDPOINTS.PROTECTED_ROUTES],
        expiredToken
      );
      
      // Then: 모든 라우트에서 접근 거부 및 로그인 리디렉트
      accessResults.forEach(result => {
        expect(result.accessible).toBe(false);
        expect(result.statusCode).toBe(401);
        expect(result.redirectedToLogin).toBe(true);
      });
    });
  });

  test.describe('오프라인 상황 처리', () => {
    test('오프라인 상태에서 401 오류 처리', async ({ page }) => {
      // Given: 오프라인 상태 시뮬레이션
      await authHelper.simulateNetworkConditions('offline');
      await authHelper.removeTokenFromLocalStorage();
      
      // When: 보호된 페이지 접근 시도
      try {
        await page.goto('/admin', { timeout: 5000 });
      } catch (error) {
        // 네트워크 오류 예상
        expect(error).toBeDefined();
      }
      
      // Then: 적절한 오프라인 UI 표시 또는 캐시된 로그인 페이지
      const pageContent = await page.content();
      expect(
        pageContent.includes('오프라인') || 
        pageContent.includes('네트워크') ||
        page.url().includes('/login')
      ).toBe(true);
      
      // 네트워크 복구
      await authHelper.simulateNetworkConditions('normal');
    });
  });
});

/**
 * 추가 보조 테스트 - 데이터 정합성 확인
 */
test.describe('데이터 정합성 검증', () => {
  test('401 오류 후 사용자 세션 데이터 정리 확인', async ({ page, request }) => {
    const authHelper = new AuthTestHelper(page, request);
    const user = await authHelper.createAuthenticatedUser();
    
    // Given: 인증된 상태에서 사용자 데이터 존재
    await authHelper.setTokenInLocalStorage(user.token.token);
    await page.goto('/profile');
    
    // When: 토큰 만료로 인한 401 오류 발생
    await authHelper.setExpiredTokenInLocalStorage(user.token.token);
    await authHelper.simulateAutoLogout();
    
    // Then: 모든 클라이언트 측 사용자 데이터 정리 확인
    const sessionData = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
      };
    });
    
    // 인증 관련 데이터가 모두 정리되었는지 확인
    expect(sessionData.localStorage['auth_token']).toBeUndefined();
    expect(sessionData.localStorage['auth_token_expires_at']).toBeUndefined();
    expect(sessionData.localStorage['user_profile']).toBeUndefined();
  });
});