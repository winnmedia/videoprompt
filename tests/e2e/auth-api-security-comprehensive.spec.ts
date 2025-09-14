import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import {
  AuthTestHelper,
  createTestUser,
  type TestUser,
  type AuthToken,
} from '../fixtures/auth';

/**
 * 추가 API 인증 보안 테스트 - 기존 테스트에서 누락된 중요 시나리오들
 *
 * TDD 원칙: Red → Green → Refactor
 * - Planning API들이 실제로 사용자별 데이터 분리를 하는지 검증
 * - JWT 토큰 변조 시도 차단 검증
 * - API 엔드포인트별 권한 레벨 검증
 *
 * CLAUDE.md 준수:
 * - MSW 사용하지 않고 실제 API 테스트
 * - 결정론적 테스트 환경
 * - $300 사건 방지를 위한 API 호출 제한
 */

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

test.describe('API 인증 보안 종합 테스트', () => {
  let authHelper: AuthTestHelper;
  let authenticatedUser1: { user: TestUser; token: AuthToken };
  let authenticatedUser2: { user: TestUser; token: AuthToken };

  test.beforeEach(async ({ page, request }) => {
    authHelper = new AuthTestHelper(page, request);

    // 두 명의 서로 다른 인증된 사용자 생성 (데이터 분리 테스트용)
    authenticatedUser1 = await authHelper.createAuthenticatedUser();
    authenticatedUser2 = await authHelper.createAuthenticatedUser();
  });

  test.describe('Planning API 사용자별 데이터 분리 검증', () => {
    test('시나리오 API - 다른 사용자의 시나리오 접근 차단', async ({ request }) => {
      // Given: 사용자1이 시나리오 생성
      const user1Token = authenticatedUser1.token.token;

      const scenario = await request.post(`${BASE_URL}/api/planning/scenario`, {
        headers: { Authorization: `Bearer ${user1Token}` },
        data: {
          title: 'User1 Private Scenario',
          logline: 'Private content',
          structure4: {},
          shots12: {}
        }
      });

      expect(scenario.ok()).toBe(true);
      const scenarioData = await scenario.json();
      const scenarioId = scenarioData.data.id;

      // When: 사용자2가 사용자1의 시나리오에 접근 시도
      const user2Token = authenticatedUser2.token.token;

      const unauthorizedAccess = await request.get(
        `${BASE_URL}/api/planning/scenario?id=${scenarioId}`,
        {
          headers: { Authorization: `Bearer ${user2Token}` },
        }
      );

      // Then: 접근 거부되어야 함
      expect(unauthorizedAccess.status()).toBe(403);

      // 사용자1은 자신의 시나리오에 접근 가능해야 함
      const authorizedAccess = await request.get(
        `${BASE_URL}/api/planning/scenario?id=${scenarioId}`,
        {
          headers: { Authorization: `Bearer ${user1Token}` },
        }
      );

      expect(authorizedAccess.ok()).toBe(true);
    });

    test('프롬프트 API - 사용자별 프롬프트 목록 분리', async ({ request }) => {
      // Given: 두 사용자가 각각 시나리오와 프롬프트 생성
      const user1Token = authenticatedUser1.token.token;
      const user2Token = authenticatedUser2.token.token;

      // 사용자1 데이터
      const scenario1 = await request.post(`${BASE_URL}/api/planning/scenario`, {
        headers: { Authorization: `Bearer ${user1Token}` },
        data: { title: 'User1 Scenario', logline: 'content1', structure4: {}, shots12: {} }
      });
      const scenarioId1 = (await scenario1.json()).data.id;

      await request.post(`${BASE_URL}/api/planning/prompt`, {
        headers: { Authorization: `Bearer ${user1Token}` },
        data: { scenarioId: scenarioId1, metadata: { user: 1 }, timeline: [], version: 1 }
      });

      // 사용자2 데이터
      const scenario2 = await request.post(`${BASE_URL}/api/planning/scenario`, {
        headers: { Authorization: `Bearer ${user2Token}` },
        data: { title: 'User2 Scenario', logline: 'content2', structure4: {}, shots12: {} }
      });
      const scenarioId2 = (await scenario2.json()).data.id;

      await request.post(`${BASE_URL}/api/planning/prompt`, {
        headers: { Authorization: `Bearer ${user2Token}` },
        data: { scenarioId: scenarioId2, metadata: { user: 2 }, timeline: [], version: 1 }
      });

      // When: 각 사용자가 자신의 프롬프트 목록 조회
      const user1Prompts = await request.get(`${BASE_URL}/api/planning/prompt`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      });

      const user2Prompts = await request.get(`${BASE_URL}/api/planning/prompt`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });

      // Then: 각 사용자는 자신의 데이터만 볼 수 있어야 함
      expect(user1Prompts.ok()).toBe(true);
      expect(user2Prompts.ok()).toBe(true);

      const user1Data = await user1Prompts.json();
      const user2Data = await user2Prompts.json();

      // 데이터가 섞이지 않았는지 확인
      const user1HasUser2Data = user1Data.data.some((item: any) =>
        item.metadata?.user === 2 || item.scenarioId === scenarioId2
      );

      const user2HasUser1Data = user2Data.data.some((item: any) =>
        item.metadata?.user === 1 || item.scenarioId === scenarioId1
      );

      expect(user1HasUser2Data).toBe(false);
      expect(user2HasUser1Data).toBe(false);
    });

    test('대시보드 API - 사용자별 통계 데이터 분리', async ({ request }) => {
      // Given: 두 사용자가 각각 데이터 생성 후 대시보드 조회
      const user1Token = authenticatedUser1.token.token;
      const user2Token = authenticatedUser2.token.token;

      // When: 대시보드 데이터 조회
      const user1Dashboard = await request.get(`${BASE_URL}/api/planning/dashboard`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      });

      const user2Dashboard = await request.get(`${BASE_URL}/api/planning/dashboard`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });

      // Then: 각자 다른 통계를 가져야 함
      expect(user1Dashboard.ok()).toBe(true);
      expect(user2Dashboard.ok()).toBe(true);

      const user1Stats = await user1Dashboard.json();
      const user2Stats = await user2Dashboard.json();

      // 통계가 사용자별로 분리되어 있는지 확인
      expect(user1Stats.data.userId).not.toBe(user2Stats.data.userId);
    });
  });

  test.describe('JWT 토큰 변조 및 위조 시도 차단', () => {
    test('변조된 JWT 토큰으로 API 접근 시도', async ({ request }) => {
      // Given: 유효한 토큰을 변조
      const validToken = authenticatedUser1.token.token;
      const tokenParts = validToken.split('.');

      // 페이로드 부분을 다른 사용자 ID로 변조
      const fakePayload = Buffer.from(JSON.stringify({
        sub: 'admin-user-id',
        email: 'admin@example.com',
        username: 'admin',
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');

      const tamperedToken = `${tokenParts[0]}.${fakePayload}.${tokenParts[2]}`;

      // When: 변조된 토큰으로 API 접근
      const response = await request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });

      // Then: 접근 거부되어야 함
      expect(response.status()).toBe(401);

      const responseData = await response.json().catch(() => ({}));
      expect(responseData.error || responseData.message).toContain('토큰');
    });

    test('만료된 토큰으로 API 접근 시도', async ({ request }) => {
      // Given: 만료된 토큰 생성 (실제로는 테스트 환경에서 시뮬레이션)
      const jwt = await import('jsonwebtoken');
      const expiredToken = jwt.default.sign(
        {
          sub: authenticatedUser1.user.email,
          email: authenticatedUser1.user.email,
          username: authenticatedUser1.user.username,
          type: 'access'
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // 1시간 전에 만료
      );

      // When: 만료된 토큰으로 API 접근
      const response = await request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      // Then: 접근 거부되어야 함
      expect(response.status()).toBe(401);
    });

    test('잘못된 서명을 가진 토큰 차단', async ({ request }) => {
      // Given: 잘못된 시크릿으로 서명된 토큰
      const jwt = await import('jsonwebtoken');
      const wrongToken = jwt.default.sign(
        {
          sub: authenticatedUser1.user.email,
          email: authenticatedUser1.user.email,
          username: authenticatedUser1.user.username,
          type: 'access'
        },
        'wrong-secret-key', // 잘못된 시크릿 키
        { expiresIn: '1h' }
      );

      // When: 잘못된 서명의 토큰으로 API 접근
      const response = await request.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${wrongToken}` },
      });

      // Then: 접근 거부되어야 함
      expect(response.status()).toBe(401);
    });
  });

  test.describe('API 권한 레벨 검증', () => {
    test('일반 사용자의 관리자 API 접근 차단', async ({ request }) => {
      // Given: 일반 사용자 토큰
      const userToken = authenticatedUser1.token.token;

      // When: 관리자 전용 API들에 접근 시도
      const adminApis = [
        '/api/admin/users',
        '/api/admin/dashboard',
        '/api/admin/system-status',
        '/api/admin/logs'
      ];

      for (const apiPath of adminApis) {
        const response = await request.get(`${BASE_URL}${apiPath}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });

        // Then: 접근 거부되어야 함 (403 Forbidden 또는 404 Not Found)
        expect([403, 404]).toContain(response.status());
      }
    });

    test('게스트 사용자의 보호된 API 접근 차단', async ({ request }) => {
      // Given: 토큰 없는 상태

      // When: 인증이 필요한 API들에 접근 시도
      const protectedApis = [
        '/api/planning/scenario',
        '/api/planning/prompt',
        '/api/planning/dashboard',
        '/api/templates',
        '/api/auth/me'
      ];

      for (const apiPath of protectedApis) {
        const response = await request.get(`${BASE_URL}${apiPath}`);

        // Then: 401 Unauthorized 응답이어야 함
        expect(response.status()).toBe(401);

        const responseData = await response.json().catch(() => ({}));
        expect(responseData.error || responseData.message).toMatch(/인증|토큰|로그인/);
      }
    });
  });

  test.describe('API 응답 일관성 검증', () => {
    test('모든 인증 실패 응답이 일관된 형식', async ({ request }) => {
      // Given: 다양한 인증 실패 시나리오
      const testScenarios = [
        {
          name: '토큰 없음',
          headers: {},
          expectedStatus: 401
        },
        {
          name: '잘못된 Bearer 형식',
          headers: { Authorization: 'InvalidFormat token123' },
          expectedStatus: 401
        },
        {
          name: '빈 토큰',
          headers: { Authorization: 'Bearer ' },
          expectedStatus: 401
        },
        {
          name: '의미없는 문자열',
          headers: { Authorization: 'Bearer invalid-token-string' },
          expectedStatus: 401
        }
      ];

      // When: 각 시나리오로 API 호출
      for (const scenario of testScenarios) {
        const response = await request.get(`${BASE_URL}/api/auth/me`, {
          headers: scenario.headers
        });

        // Then: 일관된 응답 형식 검증
        expect(response.status()).toBe(scenario.expectedStatus);

        const responseData = await response.json().catch(() => ({}));

        // 응답 구조 일관성 확인
        expect(responseData).toHaveProperty('ok', false);
        expect(responseData).toHaveProperty('error');
        expect(typeof responseData.error).toBe('string');
        expect(responseData.error.length).toBeGreaterThan(0);

        console.log(`${scenario.name}: ${responseData.error}`);
      }
    });

    test('성공 응답의 데이터 구조 일관성', async ({ request }) => {
      // Given: 유효한 인증 토큰
      const validToken = authenticatedUser1.token.token;

      // When: 다양한 성공적인 API 호출
      const successfulApis = [
        '/api/auth/me',
        '/api/planning/dashboard',
        '/api/templates'
      ];

      for (const apiPath of successfulApis) {
        const response = await request.get(`${BASE_URL}${apiPath}`, {
          headers: { Authorization: `Bearer ${validToken}` }
        });

        if (response.ok()) {
          const responseData = await response.json();

          // Then: 모든 성공 응답이 일관된 구조를 가져야 함
          expect(responseData).toHaveProperty('ok', true);
          expect(responseData).toHaveProperty('data');
          expect(responseData).toHaveProperty('traceId');

          console.log(`${apiPath}: OK (traceId: ${responseData.traceId})`);
        }
      }
    });
  });

  test.describe('레이트 리미팅 및 남용 방지', () => {
    test('동일 사용자의 과도한 API 호출 제한', async ({ request }) => {
      // Given: 유효한 토큰
      const token = authenticatedUser1.token.token;
      const endpoint = '/api/auth/me';

      // When: 짧은 시간 내 많은 API 호출 ($300 사건 방지)
      const promises = [];
      const callCount = 10; // 제한된 횟수로 테스트

      for (let i = 0; i < callCount; i++) {
        promises.push(
          request.get(`${BASE_URL}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }

      const responses = await Promise.all(promises);

      // Then: 대부분 성공하되, 너무 많은 요청은 제한될 수 있음
      const successCount = responses.filter(r => r.ok()).length;
      const tooManyRequestsCount = responses.filter(r => r.status() === 429).length;

      expect(successCount + tooManyRequestsCount).toBe(callCount);

      // 적어도 일부는 성공해야 함 (완전 차단은 아님)
      expect(successCount).toBeGreaterThan(0);

      console.log(`API calls: ${successCount} success, ${tooManyRequestsCount} rate limited`);
    });

    test('의심스러운 토큰 패턴 탐지', async ({ request }) => {
      // Given: 의심스러운 패턴의 토큰들
      const suspiciousTokens = [
        'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.FAKE_TOKEN',
        'Bearer ' + 'a'.repeat(500), // 너무 긴 토큰
        'Bearer token_with_suspicious_content_admin_root_system',
        'Bearer 000000000000000000000000000000000' // 의심스러운 패턴
      ];

      // When: 각 의심스러운 토큰으로 API 접근
      for (const suspiciousToken of suspiciousTokens) {
        const response = await request.get(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: suspiciousToken }
        });

        // Then: 모두 거부되어야 함
        expect(response.status()).toBe(401);
      }
    });
  });
});

/**
 * 추가 보조 테스트 - 실제 프로덕션 환경 시뮬레이션
 */
test.describe('프로덕션 환경 시뮬레이션 테스트', () => {
  test('동시 다중 사용자 인증 상황', async ({ browser }) => {
    // Given: 여러 브라우저 컨텍스트 (다중 사용자 시뮬레이션)
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);

    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const requests = pages.map(page => page.request);

    // When: 동시에 여러 사용자가 인증 API 호출
    const authPromises = requests.map(async (request, index) => {
      const testUser = createTestUser();

      // 각자 회원가입
      const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: testUser.email,
          username: testUser.username,
          password: testUser.password
        }
      });

      if (registerResponse.ok()) {
        // 각자 로그인
        const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
          data: {
            email: testUser.email,
            password: testUser.password
          }
        });

        return {
          userId: index,
          registerSuccess: registerResponse.ok(),
          loginSuccess: loginResponse.ok(),
          loginData: loginResponse.ok() ? await loginResponse.json() : null
        };
      }

      return {
        userId: index,
        registerSuccess: false,
        loginSuccess: false,
        loginData: null
      };
    });

    const results = await Promise.all(authPromises);

    // Then: 모든 사용자가 독립적으로 인증되어야 함
    results.forEach((result, index) => {
      console.log(`User ${index}: Register=${result.registerSuccess}, Login=${result.loginSuccess}`);

      if (result.registerSuccess) {
        expect(result.loginSuccess).toBe(true);
        expect(result.loginData?.data?.token).toBeTruthy();
      }
    });

    // 정리
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('네트워크 지연 상황에서의 토큰 검증 안정성', async ({ page }) => {
    // Given: 느린 네트워크 시뮬레이션
    const authHelper = new AuthTestHelper(page, page.request);
    await authHelper.simulateNetworkConditions('slow');

    const authenticatedUser = await authHelper.createAuthenticatedUser();

    // When: 느린 네트워크에서 API 호출
    const startTime = Date.now();
    const response = await page.request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authenticatedUser.token.token}` }
    });
    const responseTime = Date.now() - startTime;

    // Then: 지연이 있더라도 정확한 인증이 이루어져야 함
    expect(response.ok()).toBe(true);
    expect(responseTime).toBeGreaterThan(500); // 지연이 시뮬레이션 되었는지 확인

    const userData = await response.json();
    expect(userData.data.email).toBe(authenticatedUser.user.email);

    // 네트워크 상태 복구
    await authHelper.simulateNetworkConditions('normal');
  });
});