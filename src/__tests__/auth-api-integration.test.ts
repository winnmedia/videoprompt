/**
 * 인증 API 통합 테스트 - 실제 프로덕션 API 검증
 * Mock 대신 실제 HTTP 요청을 사용하여 프로덕션 오류 탐지
 * TDD 원칙: RED → GREEN → REFACTOR
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { getApiClient, localApiClient, productionApiClient } from '@/test/api-client';
import { TestUserManager, PerformanceMonitor, retryOperation, validateApiResponse, getTestConfig } from '@/test/utils';

describe('인증 API 통합 테스트 - 실제 프로덕션 검증', () => {
  let testUserManager: TestUserManager;
  let performanceMonitor: PerformanceMonitor;
  const config = getTestConfig();

  // 테스트 환경별 설정
  const testEnvironments = [
    { name: 'Local Development', client: localApiClient, baseUrl: 'http://localhost:3000' },
    { name: 'Production', client: productionApiClient, baseUrl: 'https://www.vridge.kr' },
  ];

  beforeAll(async () => {
    console.log('🚀 Starting Auth API Integration Tests');
    console.log('📊 Test Configuration:', config);
    
    // 로컬 서버가 실행 중인지 확인
    try {
      const health = await localApiClient.healthCheck();
      if (!health.healthy) {
        console.warn('⚠️  Local server is not healthy, skipping local tests');
      }
    } catch (error) {
      console.warn('⚠️  Local server is not running, skipping local tests');
    }
  });

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(async () => {
    if (testUserManager) {
      await testUserManager.cleanupAllUsers();
    }
  });

  afterAll(() => {
    console.log('✅ Auth API Integration Tests Completed');
  });

  // 각 환경에 대해 테스트 실행
  testEnvironments.forEach(({ name, client, baseUrl }) => {
    describe(`${name} Environment (${baseUrl})`, () => {
      beforeEach(() => {
        testUserManager = new TestUserManager(client);
        client.clearAuthToken(); // 인증 상태 초기화
      });

      describe('API Health Check', () => {
        test('서버 상태 확인 및 응답 시간 측정', async () => {
          performanceMonitor.start();
          
          const healthCheck = await retryOperation(
            () => client.healthCheck(),
            config.healthCheckRetryCount,
            config.healthCheckInterval
          );

          const responseTime = performanceMonitor.stop();

          expect(healthCheck.healthy).toBe(true);
          expect(responseTime).toBeLessThan(config.maxResponseTime);
          
          console.log(`📈 ${name} Health Check: ${responseTime}ms`);
        });

        test('API 엔드포인트 접근성 확인', async () => {
          const endpoints = [
            '/api/health',
            '/api/auth/register',
            '/api/auth/login',
            '/api/auth/verify-email',
          ];

          for (const endpoint of endpoints) {
            const response = await client.get(endpoint);
            // 404가 아닌 것만 확인 (인증 오류는 정상)
            expect([200, 400, 401, 405, 422]).toContain(
              response.ok ? 200 : (response as any).status || 400
            );
          }
        });
      });

      describe('POST /api/auth/register - 실제 사용자 등록', () => {
        test('유효한 데이터로 회원가입 성공', async () => {
          const testUser = await testUserManager.createTestUser();
          
          performanceMonitor.start();
          const response = await client.post('/api/auth/register', {
            email: testUser.email,
            username: testUser.username,
            password: testUser.password,
          });
          const responseTime = performanceMonitor.stop();

          expect(response.ok).toBe(true);
          expect(responseTime).toBeLessThan(config.maxResponseTime);
          
          if (response.data) {
            validateApiResponse(response.data, ['id', 'email', 'username']);
            expect(response.data.email).toBe(testUser.email);
            expect(response.data.username).toBe(testUser.username);
            expect(response.data.id).toBeDefined();
          }
          
          console.log(`✅ User registered in ${responseTime}ms`);
        });

        test('중복 이메일로 회원가입 실패 검증', async () => {
          // 첫 번째 사용자 생성
          const firstUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', firstUser);
          
          // 동일한 이메일로 두 번째 등록 시도
          const response = await client.post('/api/auth/register', {
            email: firstUser.email,
            username: `different_${firstUser.username}`,
            password: firstUser.password,
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toContain('이메일');
        });

        test('약한 비밀번호 검증', async () => {
          const testUser = await testUserManager.createTestUser();
          testUser.password = '123'; // 약한 비밀번호
          
          const response = await client.post('/api/auth/register', testUser);

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/비밀번호|password/i);
        });

        test('잘못된 이메일 형식 검증', async () => {
          const testUser = await testUserManager.createTestUser();
          testUser.email = 'invalid-email-format';
          
          const response = await client.post('/api/auth/register', testUser);

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/이메일|email/i);
        });
      });

      describe('POST /api/auth/login - 실제 로그인 검증', () => {
        test('인증된 사용자 로그인 성공', async () => {
          // 사용자 생성 및 인증
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          await testUserManager.verifyTestUser(testUser);
          
          performanceMonitor.start();
          const response = await client.post('/api/auth/login', {
            email: testUser.email,
            password: testUser.password,
          });
          const responseTime = performanceMonitor.stop();

          expect(response.ok).toBe(true);
          expect(responseTime).toBeLessThan(config.maxResponseTime);
          
          if (response.data) {
            validateApiResponse(response.data, ['id', 'email', 'token']);
            expect(response.data.email).toBe(testUser.email);
            expect(response.data.token).toBeDefined();
          }
          
          console.log(`✅ Login successful in ${responseTime}ms`);
        });

        test('잘못된 비밀번호로 로그인 실패', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          await testUserManager.verifyTestUser(testUser);
          
          const response = await client.post('/api/auth/login', {
            email: testUser.email,
            password: 'wrongpassword',
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/로그인|인증|password/i);
        });

        test('이메일 미인증 사용자 로그인 차단', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          // 이메일 인증하지 않음
          
          const response = await client.post('/api/auth/login', {
            email: testUser.email,
            password: testUser.password,
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/인증|verification/i);
        });

        test('존재하지 않는 사용자 로그인 실패', async () => {
          const response = await client.post('/api/auth/login', {
            email: 'nonexistent@example.com',
            password: 'anypassword',
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toBeDefined();
        });
      });

      describe('POST /api/auth/verify-email - 이메일 인증', () => {
        test('유효한 인증 코드로 이메일 인증 성공', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          
          // 인증 코드 조회
          const codeResponse = await client.get('/api/auth/get-verification-code', {
            params: { email: testUser.email },
            headers: { 'X-Test-Mode': '1' },
          });
          
          expect(codeResponse.ok).toBe(true);
          expect(codeResponse.data?.code).toBeDefined();
          
          performanceMonitor.start();
          const response = await client.post('/api/auth/verify-email', {
            email: testUser.email,
            code: codeResponse.data.code,
          });
          const responseTime = performanceMonitor.stop();

          expect(response.ok).toBe(true);
          expect(responseTime).toBeLessThan(config.maxResponseTime);
          
          if (response.data) {
            validateApiResponse(response.data, ['email', 'verifiedAt']);
            expect(response.data.email).toBe(testUser.email);
            expect(response.data.verifiedAt).toBeDefined();
          }
          
          console.log(`✅ Email verified in ${responseTime}ms`);
        });

        test('잘못된 인증 코드로 인증 실패', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          
          const response = await client.post('/api/auth/verify-email', {
            email: testUser.email,
            code: '000000', // 잘못된 코드
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/인증|code|코드/i);
        });

        test('만료된 인증 코드 처리', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          
          // 인증 코드 만료 처리 (테스트 환경에서만)
          await client.post('/api/auth/expire-verification-code', {
            email: testUser.email,
          }, {
            headers: { 'X-Test-Mode': '1' },
          });
          
          const response = await client.post('/api/auth/verify-email', {
            email: testUser.email,
            code: '123456',
          });

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/만료|expired/i);
        });
      });

      describe('GET /api/auth/me - 사용자 정보 조회', () => {
        test('유효한 토큰으로 사용자 정보 조회 성공', async () => {
          // 사용자 생성, 인증, 로그인
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          await testUserManager.verifyTestUser(testUser);
          
          const session = await testUserManager.loginTestUser(testUser);
          expect(session).toBeDefined();
          
          if (session) {
            client.setAuthToken(session.token);
            
            performanceMonitor.start();
            const response = await client.get('/api/auth/me');
            const responseTime = performanceMonitor.stop();

            expect(response.ok).toBe(true);
            expect(responseTime).toBeLessThan(config.maxResponseTime);
            
            if (response.data) {
              validateApiResponse(response.data, ['id', 'email', 'username']);
              expect(response.data.email).toBe(testUser.email);
              expect(response.data.id).toBeDefined();
            }
            
            console.log(`✅ User info retrieved in ${responseTime}ms`);
          }
        });

        test('유효하지 않은 토큰으로 접근 실패', async () => {
          client.setAuthToken('invalid-token-123');
          
          const response = await client.get('/api/auth/me');

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/인증|token|unauthorized/i);
        });

        test('토큰 없이 접근 실패', async () => {
          client.clearAuthToken();
          
          const response = await client.get('/api/auth/me');

          expect(response.ok).toBe(false);
          expect(response.message || response.error).toMatch(/인증|token|unauthorized/i);
        });
      });

      describe('POST /api/auth/logout - 로그아웃', () => {
        test('인증된 사용자 로그아웃 성공', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          await testUserManager.verifyTestUser(testUser);
          
          const session = await testUserManager.loginTestUser(testUser);
          if (session) {
            client.setAuthToken(session.token);
            
            performanceMonitor.start();
            const response = await client.post('/api/auth/logout');
            const responseTime = performanceMonitor.stop();

            expect(response.ok).toBe(true);
            expect(responseTime).toBeLessThan(config.maxResponseTime);
            
            console.log(`✅ Logout successful in ${responseTime}ms`);
          }
        });
      });

      describe('테스트용 API 엔드포인트 검증', () => {
        test('사용자 존재 확인 API', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          
          const response = await client.get('/api/auth/check-user-exists', {
            params: { email: testUser.email },
          });

          expect(response.ok).toBe(true);
          
          if (response.data) {
            validateApiResponse(response.data, ['exists']);
            expect(response.data.exists).toBe(true);
          }
        });

        test('인증 상태 확인 API', async () => {
          const testUser = await testUserManager.createTestUser();
          await client.post('/api/auth/register', testUser);
          
          const response = await client.get('/api/auth/verification-status', {
            params: { email: testUser.email },
          });

          expect(response.ok).toBe(true);
          
          if (response.data) {
            validateApiResponse(response.data, ['codeGenerated', 'attempts', 'maxAttempts']);
            expect(typeof response.data.codeGenerated).toBe('boolean');
            expect(typeof response.data.attempts).toBe('number');
            expect(typeof response.data.maxAttempts).toBe('number');
          }
        });
      });

      describe('성능 및 신뢰성 테스트', () => {
        test('동시 요청 처리 능력 검증', async () => {
          const concurrentUsers = Array.from({ length: 5 }, () => testUserManager.createTestUser());
          const users = await Promise.all(concurrentUsers);
          
          performanceMonitor.start();
          const registerPromises = users.map(user =>
            client.post('/api/auth/register', user)
          );
          
          const results = await Promise.allSettled(registerPromises);
          const responseTime = performanceMonitor.stop();
          
          const successCount = results.filter(result => 
            result.status === 'fulfilled' && result.value.ok
          ).length;
          
          expect(successCount).toBeGreaterThan(0);
          expect(responseTime).toBeLessThan(config.performanceTimeout);
          
          console.log(`📊 Concurrent requests: ${successCount}/5 successful in ${responseTime}ms`);
        });

        test('네트워크 오류 복구 능력 검증', async () => {
          const testUser = await testUserManager.createTestUser();
          
          // 재시도 메커니즘을 통한 네트워크 오류 복구 테스트
          const result = await retryOperation(
            () => client.post('/api/auth/register', testUser),
            3,
            1000
          );
          
          expect(result.ok).toBe(true);
        });
      });
    });
  });
});