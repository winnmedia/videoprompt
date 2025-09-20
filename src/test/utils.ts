/**
 * 프로덕션 테스트를 위한 유틸리티 함수들
 * 실제 데이터 생성, 정리, 검증을 담당
 */

import { ApiClient } from './api-client';
import { logger } from '@/shared/lib/logger';


// 테스트 데이터 타입 정의
export interface TestUser {
  id?: string;
  email: string;
  username: string;
  password: string;
  verificationCode?: string;
  verified?: boolean;
}

export interface TestSession {
  userId: string;
  token: string;
  expiresAt: string;
}

// 테스트용 고유 사용자 데이터 생성
export function createUniqueTestUser(): TestUser {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  
  return {
    email: `integration_test_${timestamp}_${randomId}@vridge.kr`,
    username: `testuser_${timestamp}_${randomId}`,
    password: 'TestPassword123!@#',
    verified: false,
  };
}

// 테스트 환경 감지
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

// 테스트 정리가 활성화되어 있는지 확인
export function isCleanupEnabled(): boolean {
  return process.env.TEST_CLEANUP_ENABLED === 'true';
}

// 테스트용 사용자 정리 클래스
export class TestUserManager {
  private apiClient: ApiClient;
  private createdUsers: TestUser[] = [];

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * 새 테스트 사용자 생성
   */
  async createTestUser(): Promise<TestUser> {
    if (!isTestEnvironment()) {
      throw new Error('Test user creation is only allowed in test environment');
    }

    const testUser = createUniqueTestUser();
    
    try {
      const response = await this.apiClient.post('/api/auth/register', {
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
      });

      if (response.ok && response.data) {
        testUser.id = response.data.id;
        this.createdUsers.push(testUser);
        
        // 자동으로 정리 목록에 추가
        if (isCleanupEnabled()) {
          await this.scheduleCleanup(testUser);
        }
      }

      return testUser;
    } catch (error) {
      throw new Error(`Failed to create test user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 테스트 사용자의 이메일 인증 처리
   */
  async verifyTestUser(testUser: TestUser): Promise<boolean> {
    if (!testUser.email) {
      throw new Error('Test user email is required for verification');
    }

    try {
      // 테스트 모드에서 인증 코드 조회
      const codeResponse = await this.apiClient.get('/api/auth/get-verification-code', {
        params: { email: testUser.email },
        headers: { 'X-Test-Mode': '1' },
      });

      if (!codeResponse.ok || !codeResponse.data?.code) {
        throw new Error('Failed to get verification code');
      }

      const verificationCode = codeResponse.data.code;

      // 이메일 인증 수행
      const verifyResponse = await this.apiClient.post('/api/auth/verify-email', {
        email: testUser.email,
        code: verificationCode,
      });

      if (verifyResponse.ok) {
        testUser.verified = true;
        testUser.verificationCode = verificationCode;
        return true;
      }

      return false;
    } catch (error) {
      throw new Error(`Failed to verify test user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 테스트 사용자 로그인
   */
  async loginTestUser(testUser: TestUser): Promise<TestSession | null> {
    if (!testUser.email || !testUser.password) {
      throw new Error('Test user email and password are required for login');
    }

    try {
      const response = await this.apiClient.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      if (response.ok && response.data) {
        return {
          userId: response.data.id,
          token: response.data.token,
          expiresAt: response.data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to login test user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 생성된 모든 테스트 사용자 정리
   */
  async cleanupAllUsers(): Promise<void> {
    if (!isCleanupEnabled()) {
      logger.info('Cleanup is disabled. Skipping user cleanup.');
      return;
    }

    const cleanupPromises = this.createdUsers.map(user => this.cleanupUser(user));
    await Promise.allSettled(cleanupPromises);
    this.createdUsers = [];
  }

  /**
   * 개별 테스트 사용자 정리
   */
  private async cleanupUser(testUser: TestUser): Promise<void> {
    if (!testUser.email) return;

    try {
      // 데이터베이스에서 직접 사용자 삭제 (테스트 환경에서만)
      await this.apiClient.delete(`/api/test/cleanup-user`, {
        headers: {
          'X-Test-Mode': '1',
          'X-User-Email': testUser.email,
        },
      });
    } catch (error) {
      console.warn(`Failed to cleanup user ${testUser.email}:`, error);
    }
  }

  /**
   * 테스트 사용자 정리 예약 (시간 기반)
   */
  private async scheduleCleanup(testUser: TestUser): Promise<void> {
    const retentionHours = Number(process.env.TEST_USER_RETENTION_HOURS) || 1;
    const cleanupTime = Date.now() + (retentionHours * 60 * 60 * 1000);

    // 실제 구현에서는 별도 스케줄링 시스템 사용
    setTimeout(async () => {
      await this.cleanupUser(testUser);
    }, cleanupTime - Date.now());
  }

  /**
   * 생성된 테스트 사용자 수 반환
   */
  getCreatedUserCount(): number {
    return this.createdUsers.length;
  }

  /**
   * 모든 생성된 사용자 정보 반환 (디버깅용)
   */
  getCreatedUsers(): TestUser[] {
    return [...this.createdUsers];
  }
}

// 성능 측정 유틸리티
export class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.getElapsedTime();
  }

  getElapsedTime(): number {
    return this.endTime - this.startTime;
  }

  isWithinThreshold(thresholdMs: number): boolean {
    return this.getElapsedTime() <= thresholdMs;
  }
}

// 재시도 로직 유틸리티
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // 지수적 백오프 적용
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// HTTP 상태 코드 검증
export function assertHttpStatus(actual: number, expected: number | number[]): void {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];
  
  if (!expectedCodes.includes(actual)) {
    throw new Error(`Expected HTTP status ${expectedCodes.join(' or ')}, got ${actual}`);
  }
}

// API 응답 스키마 검증 (기본적인 구조 확인)
export function validateApiResponse(response: any, requiredFields: string[]): void {
  if (!response) {
    throw new Error('Response is null or undefined');
  }

  const missingFields = requiredFields.filter(field => !(field in response));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

// 환경별 설정 로드
export function getTestConfig() {
  return {
    healthCheckTimeout: Number(process.env.HEALTH_CHECK_TIMEOUT) || 30000,
    healthCheckRetryCount: Number(process.env.HEALTH_CHECK_RETRY_COUNT) || 3,
    healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 5000,
    performanceTimeout: Number(process.env.PERFORMANCE_TIMEOUT) || 10000,
    maxResponseTime: Number(process.env.MAX_RESPONSE_TIME) || 5000,
    loadTestConcurrency: Number(process.env.LOAD_TEST_CONCURRENCY) || 10,
  };
}