import { expect, Page, APIRequestContext } from '@playwright/test';

/**
 * 인증 관련 E2E 테스트를 위한 Fixture 및 Helper 유틸리티
 * 
 * TDD 원칙에 따라 401 인증 오류 시나리오를 체계적으로 테스트하기 위한
 * 재사용 가능한 유틸리티와 테스트 데이터를 제공합니다.
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

/**
 * 테스트용 사용자 데이터 타입 정의
 */
export interface TestUser {
  email: string;
  username: string;
  password: string;
  weakPassword: string;
  invalidEmail: string;
}

/**
 * 인증 토큰 데이터 타입 정의
 */
export interface AuthToken {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
}

/**
 * API 응답 타입 정의
 */
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 성능 메트릭 타입 정의
 */
export interface PerformanceMetrics {
  responseTime: number;
  timestamp: number;
  endpoint: string;
  statusCode: number;
}

/**
 * 테스트용 유니크 사용자 데이터 생성
 */
export function createTestUser(): TestUser {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  return {
    email: `test.user.${timestamp}.${randomSuffix}@example.com`,
    username: `testuser${timestamp}${randomSuffix}`,
    password: 'SecurePassword123!@#',
    weakPassword: '123',
    invalidEmail: 'invalid-email-format',
  };
}

/**
 * 인증 관련 Helper 클래스
 */
export class AuthTestHelper {
  constructor(
    private page: Page,
    private request: APIRequestContext
  ) {}

  /**
   * 완전히 인증된 사용자 생성 (회원가입 + 이메일 인증 + 로그인 완료)
   */
  async createAuthenticatedUser(): Promise<{ user: TestUser; token: AuthToken }> {
    const testUser = createTestUser();
    
    // 1. 회원가입
    const registerResponse = await this.request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
      },
    });
    
    expect(registerResponse.ok()).toBe(true);
    
    // 2. 이메일 인증 완료 (테스트 모드)
    const verifyResponse = await this.request.post(`${BASE_URL}/api/auth/verify-email-direct`, {
      data: { email: testUser.email },
      headers: { 'X-Test-Mode': '1' },
    });
    
    expect(verifyResponse.ok()).toBe(true);
    
    // 3. 로그인하여 토큰 획득
    const loginResponse = await this.request.post(`${BASE_URL}/api/auth/login`, {
      data: { 
        email: testUser.email, 
        password: testUser.password,
      },
    });
    
    expect(loginResponse.ok()).toBe(true);
    const loginData: ApiResponse<AuthToken> = await loginResponse.json();
    
    return {
      user: testUser,
      token: loginData.data!,
    };
  }

  /**
   * localStorage에 토큰 설정
   */
  async setTokenInLocalStorage(token: string): Promise<void> {
    await this.page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_token_expires_at', String(Date.now() + 3600000)); // 1시간 후 만료
    }, token);
  }

  /**
   * localStorage에서 토큰 제거
   */
  async removeTokenFromLocalStorage(): Promise<void> {
    await this.page.addInitScript(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token_expires_at');
    });
  }

  /**
   * localStorage에 만료된 토큰 설정
   */
  async setExpiredTokenInLocalStorage(token: string): Promise<void> {
    await this.page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_token_expires_at', String(Date.now() - 3600000)); // 1시간 전에 만료됨
    }, token);
  }

  /**
   * localStorage에서 인증 정보 확인
   */
  async getAuthInfoFromLocalStorage(): Promise<{
    token: string | null;
    expiresAt: string | null;
    isExpired: boolean;
  }> {
    return await this.page.evaluate(() => {
      const token = localStorage.getItem('auth_token');
      const expiresAt = localStorage.getItem('auth_token_expires_at');
      const isExpired = expiresAt ? Date.now() > parseInt(expiresAt) : false;
      
      return {
        token,
        expiresAt,
        isExpired,
      };
    });
  }

  /**
   * API 요청 시 Bearer 토큰 헤더 검증
   */
  async verifyBearerTokenHeader(endpoint: string, token: string): Promise<{
    success: boolean;
    statusCode: number;
    hasAuthHeader: boolean;
  }> {
    const response = await this.request.get(`${BASE_URL}${endpoint}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
      },
    });

    // Bearer 토큰 헤더가 올바르게 전달되었는지는 서버 응답을 통해 간접적으로 확인
    // 200 응답이면 인증 헤더가 올바르게 처리된 것으로 가정
    const hasAuthHeader = response.ok();

    return {
      success: response.ok(),
      statusCode: response.status(),
      hasAuthHeader,
    };
  }

  /**
   * 401 오류 시나리오 검증
   */
  async verify401Error(endpoint: string, expectedMessage?: string): Promise<{
    statusCode: number;
    errorMessage: string;
    isUnauthorized: boolean;
  }> {
    const response = await this.request.get(`${BASE_URL}${endpoint}`);
    const responseData: ApiResponse = await response.json().catch(() => ({}));

    return {
      statusCode: response.status(),
      errorMessage: responseData.error || responseData.message || '',
      isUnauthorized: response.status() === 401,
    };
  }

  /**
   * 토큰 새로고침 테스트
   */
  async attemptTokenRefresh(refreshToken: string): Promise<{
    success: boolean;
    newToken?: string;
    error?: string;
  }> {
    const response = await this.request.post(`${BASE_URL}/api/auth/refresh-token`, {
      data: { refreshToken },
    });

    if (response.ok()) {
      const data: ApiResponse<AuthToken> = await response.json();
      return {
        success: true,
        newToken: data.data?.token,
      };
    } else {
      const errorData: ApiResponse = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || errorData.message || 'Unknown error',
      };
    }
  }

  /**
   * 성능 메트릭 측정
   */
  async measureApiPerformance(
    endpoint: string, 
    options: { method?: 'GET' | 'POST'; headers?: Record<string, string>; data?: any } = {}
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    
    let response;
    if (options.method === 'POST') {
      response = await this.request.post(`${BASE_URL}${endpoint}`, {
        headers: options.headers,
        data: options.data,
      });
    } else {
      response = await this.request.get(`${BASE_URL}${endpoint}`, {
        headers: options.headers,
      });
    }
    
    const endTime = Date.now();
    
    return {
      responseTime: endTime - startTime,
      timestamp: startTime,
      endpoint,
      statusCode: response.status(),
    };
  }

  /**
   * 자동 로그아웃 시나리오 테스트
   */
  async simulateAutoLogout(): Promise<void> {
    // 401 오류 발생 후 자동 로그아웃 확인
    await this.page.evaluate(() => {
      // 실제 애플리케이션의 자동 로그아웃 로직을 트리거
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    });
    
    // 로그인 페이지로 리디렉트 확인
    await expect(this.page).toHaveURL(/\/login/);
    
    // localStorage 정리 확인
    const authInfo = await this.getAuthInfoFromLocalStorage();
    expect(authInfo.token).toBeNull();
  }

  /**
   * 보호된 라우트 접근 테스트
   */
  async testProtectedRouteAccess(routes: string[], token?: string): Promise<{
    route: string;
    accessible: boolean;
    statusCode: number;
    redirectedToLogin: boolean;
  }[]> {
    const results = [];
    
    for (const route of routes) {
      if (token) {
        await this.setTokenInLocalStorage(token);
      } else {
        await this.removeTokenFromLocalStorage();
      }
      
      await this.page.goto(route);
      
      const currentUrl = this.page.url();
      const redirectedToLogin = currentUrl.includes('/login');
      
      // API 호출로 실제 상태 코드 확인
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await this.request.get(`${BASE_URL}${route}`, { headers });
      
      results.push({
        route,
        accessible: response.ok(),
        statusCode: response.status(),
        redirectedToLogin,
      });
    }
    
    return results;
  }

  /**
   * 크로스 브라우저 localStorage 동작 확인
   */
  async verifyCrossBrowserLocalStorageSupport(): Promise<{
    hasLocalStorage: boolean;
    canStore: boolean;
    canRetrieve: boolean;
    error?: string;
  }> {
    try {
      const result = await this.page.evaluate(() => {
        // localStorage 지원 확인
        if (typeof Storage === 'undefined' || !window.localStorage) {
          return { hasLocalStorage: false, canStore: false, canRetrieve: false };
        }

        try {
          // 저장 테스트
          const testKey = 'playwright_test_key';
          const testValue = 'playwright_test_value';
          localStorage.setItem(testKey, testValue);
          
          // 검색 테스트
          const retrievedValue = localStorage.getItem(testKey);
          
          // 정리
          localStorage.removeItem(testKey);
          
          return {
            hasLocalStorage: true,
            canStore: true,
            canRetrieve: retrievedValue === testValue,
          };
        } catch (error) {
          return {
            hasLocalStorage: true,
            canStore: false,
            canRetrieve: false,
            error: (error as Error).message,
          };
        }
      });

      return result;
    } catch (error) {
      return {
        hasLocalStorage: false,
        canStore: false,
        canRetrieve: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 네트워크 상태 시뮬레이션 (오프라인/느린 연결)
   */
  async simulateNetworkConditions(condition: 'offline' | 'slow' | 'normal'): Promise<void> {
    const context = this.page.context();
    
    switch (condition) {
      case 'offline':
        await context.setOffline(true);
        break;
      case 'slow':
        await context.setOffline(false);
        // 느린 3G 연결 시뮬레이션
        await context.route('**/*', async (route) => {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연
          await route.continue();
        });
        break;
      case 'normal':
        await context.setOffline(false);
        await context.unroute('**/*');
        break;
    }
  }
}

/**
 * 공통 테스트 데이터
 */
export const TEST_ENDPOINTS = {
  PROTECTED_ROUTES: [
    '/admin',
    '/admin/dashboard',
    '/planning/create',
    '/editor/new',
    '/profile',
    '/settings',
  ],
  AUTH_ENDPOINTS: [
    '/api/auth/me',
    '/api/auth/refresh-token',
    '/api/auth/logout',
  ],
  API_ENDPOINTS: [
    '/api/scenarios',
    '/api/templates',
    '/api/users/profile',
  ],
} as const;

/**
 * 성능 기준값
 */
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME_MS: 100,
  PAGE_LOAD_TIME_MS: 3000,
  TOKEN_VALIDATION_TIME_MS: 50,
} as const;

/**
 * 테스트 시나리오별 에러 메시지
 */
export const ERROR_MESSAGES = {
  NO_TOKEN: '인증 토큰이 없습니다',
  EXPIRED_TOKEN: '토큰이 만료되었습니다',
  INVALID_TOKEN: '유효하지 않은 토큰입니다',
  UNAUTHORIZED: '권한이 없습니다',
  LOGIN_REQUIRED: '로그인이 필요합니다',
} as const;