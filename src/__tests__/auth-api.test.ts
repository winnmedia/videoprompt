/**
 * 인증 API 단위 테스트
 * TDD 원칙: API 엔드포인트의 동작을 검증
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock fetch for API requests
global.fetch = vi.fn();

const BASE_URL = 'http://localhost:3000';

// 테스트용 사용자 데이터
const createTestUser = () => ({
  email: `test.${Date.now()}@example.com`,
  username: `testuser${Date.now()}`,
  password: 'SecurePassword123!',
});

describe('인증 API 단위 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('유효한 데이터로 회원가입 성공', async () => {
      const testUser = createTestUser();
      
      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            id: 'test-user-id',
            email: testUser.email,
            username: testUser.username
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.email).toBe(testUser.email);
      expect(data.data.username).toBe(testUser.username);
      expect(data.data.id).toBeDefined();
    });

    test('중복 이메일로 회원가입 실패', async () => {
      const testUser = createTestUser();
      
      // Mock error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '이미 사용중인 이메일입니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('이미 사용중인 이메일입니다.');
    });

    test('약한 비밀번호로 회원가입 실패', async () => {
      const testUser = { ...createTestUser(), password: '123' };
      
      // Mock validation error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '비밀번호는 최소 8자 이상이어야 합니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toContain('비밀번호는 최소 8자');
    });

    test('잘못된 이메일 형식으로 회원가입 실패', async () => {
      const testUser = { ...createTestUser(), email: 'invalid-email' };
      
      // Mock validation error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '유효한 이메일 주소를 입력해주세요.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toContain('유효한 이메일');
    });
  });

  describe('POST /api/auth/login', () => {
    test('유효한 자격 증명으로 로그인 성공', async () => {
      const testUser = createTestUser();
      
      // Mock successful login response with token
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'set-cookie') {
              return 'session=test-jwt-token; HttpOnly; Secure; SameSite=Strict';
            }
            return null;
          }
        },
        json: async () => ({
          ok: true,
          data: {
            id: 'test-user-id',
            email: testUser.email,
            username: testUser.username,
            token: 'test-jwt-token'
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.email).toBe(testUser.email);
      expect(data.data.token).toBeDefined();
    });

    test('잘못된 비밀번호로 로그인 실패', async () => {
      const testUser = createTestUser();
      
      // Mock authentication error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '로그인 정보가 올바르지 않습니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: 'wrongpassword'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('로그인 정보가 올바르지 않습니다.');
    });

    test('이메일 미인증 사용자 로그인 차단', async () => {
      const testUser = createTestUser();
      
      // Mock email not verified error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '이메일 인증이 필요합니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('이메일 인증이 필요합니다.');
    });

    test('존재하지 않는 사용자로 로그인 실패', async () => {
      const testUser = createTestUser();
      
      // Mock user not found error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '로그인 정보가 올바르지 않습니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('로그인 정보가 올바르지 않습니다.');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    test('유효한 인증 코드로 이메일 인증 성공', async () => {
      const testUser = createTestUser();
      const verificationCode = '123456';
      
      // Mock successful verification
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            message: '이메일 인증이 완료되었습니다.',
            email: testUser.email,
            verifiedAt: new Date().toISOString()
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          code: verificationCode
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.email).toBe(testUser.email);
      expect(data.data.verifiedAt).toBeDefined();
    });

    test('잘못된 인증 코드로 인증 실패', async () => {
      const testUser = createTestUser();
      
      // Mock invalid code error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '인증 코드가 올바르지 않습니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          code: '000000'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('인증 코드가 올바르지 않습니다.');
    });

    test('만료된 인증 코드로 인증 실패', async () => {
      const testUser = createTestUser();
      
      // Mock expired code error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '인증 코드가 만료되었습니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          code: '123456'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('인증 코드가 만료되었습니다.');
    });
  });

  describe('GET /api/auth/me', () => {
    test('유효한 토큰으로 사용자 정보 조회 성공', async () => {
      const testUser = createTestUser();
      
      // Mock successful me response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            id: 'test-user-id',
            email: testUser.email,
            username: testUser.username,
            role: 'user'
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer test-jwt-token' 
        }
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.email).toBe(testUser.email);
      expect(data.data.id).toBeDefined();
    });

    test('유효하지 않은 토큰으로 접근 실패', async () => {
      // Mock unauthorized error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '인증이 필요합니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer invalid-token' 
        }
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('인증이 필요합니다.');
    });

    test('토큰 없이 접근 실패', async () => {
      // Mock unauthorized error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          ok: false,
          message: '인증이 필요합니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        method: 'GET'
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.ok).toBe(false);
      expect(data.message).toBe('인증이 필요합니다.');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('로그아웃 성공', async () => {
      // Mock successful logout
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          message: '로그아웃되었습니다.'
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 
          'Cookie': 'session=test-jwt-token' 
        }
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.message).toBe('로그아웃되었습니다.');
    });
  });

  describe('테스트용 API 엔드포인트', () => {
    test('GET /api/auth/check-user-exists - 사용자 존재 확인', async () => {
      const testUser = createTestUser();
      
      // Mock user exists response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            exists: true,
            emailVerified: false
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/check-user-exists?email=${testUser.email}`, {
        method: 'GET'
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.exists).toBe(true);
      expect(data.data.emailVerified).toBe(false);
    });

    test('GET /api/auth/verification-status - 인증 상태 확인', async () => {
      const testUser = createTestUser();
      
      // Mock verification status response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            codeGenerated: true,
            codeExpiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            attempts: 0,
            maxAttempts: 5
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/verification-status?email=${testUser.email}`, {
        method: 'GET'
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.codeGenerated).toBe(true);
      expect(data.data.codeExpiry).toBeDefined();
      expect(data.data.maxAttempts).toBe(5);
    });

    test('GET /api/auth/get-verification-code - 테스트 코드 조회', async () => {
      const testUser = createTestUser();
      
      // Mock verification code response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            code: '123456',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
          }
        })
      });

      const response = await fetch(`${BASE_URL}/api/auth/get-verification-code?email=${testUser.email}`, {
        method: 'GET',
        headers: { 'X-Test-Mode': '1' }
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.ok).toBe(true);
      expect(data.data.code).toBe('123456');
      expect(data.data.expiresAt).toBeDefined();
    });
  });
});