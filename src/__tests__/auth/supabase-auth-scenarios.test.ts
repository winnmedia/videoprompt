/**
 * Supabase 인증 시나리오별 테스트
 * TDD: Red → Green → Refactor
 *
 * 테스트 목표:
 * 1. 모든 인증 실패 시나리오 커버 (100% 커버리지)
 * 2. requireSupabaseAuthentication의 모든 경로 테스트
 * 3. 401/400 에러 재발 방지
 * 4. $300 사건 같은 무한 루프 방지
 * 5. 플래키 테스트 제거 (결정론적 테스트)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireSupabaseAuthentication, isAuthError, isAuthenticated, isGuest } from '@/shared/lib/supabase-auth';
import { supabaseMockHelpers, TEST_USERS, TEST_TOKENS } from '@/shared/lib/mocks/supabase-mock';

describe('Supabase 인증 시스템 - 실패 시나리오 테스트', () => {
  beforeEach(() => {
    // 각 테스트 전에 모킹 상태 리셋
    supabaseMockHelpers.reset();
    vi.clearAllMocks();
  });

  describe('🔴 RED Phase: 실패 테스트부터 작성', () => {
    it('유효하지 않은 토큰으로 인증 실패해야 함', async () => {
      // Given: 잘못된 토큰이 포함된 요청
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.INVALID}`
        }
      });

      // When: 인증을 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패해야 함
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.statusCode).toBe(401);
        expect(result.message).toContain('유효한 인증 토큰이 필요합니다');
      }
    });

    it('만료된 토큰으로 인증 실패해야 함', async () => {
      // Given: 만료된 토큰
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.EXPIRED}`
        }
      });

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.statusCode).toBe(401);
      }
    });

    it('Authorization 헤더 없이 인증 실패해야 함', async () => {
      // Given: Authorization 헤더가 없는 요청
      const req = new NextRequest('http://localhost:3000/api/test');

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.statusCode).toBe(401);
      }
    });

    it('이메일 인증이 필요한 API에서 미인증 사용자 차단해야 함', async () => {
      // Given: 이메일 미인증 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.UNVERIFIED_USER);
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: 이메일 인증 필수 옵션으로 인증 시도
      const result = await requireSupabaseAuthentication(req, { requireEmailVerified: true });

      // Then: 인증 실패 (이메일 미인증)
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.message).toContain('이메일 인증이 필요합니다');
      }
    });

    it('게스트 모드가 비활성화된 상태에서 미인증 사용자 차단해야 함', async () => {
      // Given: 미인증 사용자
      const req = new NextRequest('http://localhost:3000/api/test');

      // When: 게스트 모드 비활성화로 인증 시도
      const result = await requireSupabaseAuthentication(req, { allowGuest: false });

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.statusCode).toBe(401);
      }
    });

    it('Supabase 서비스 장애 시 인증 실패해야 함', async () => {
      // Given: Supabase 서비스 에러 설정
      const serviceError = new Error('Supabase service unavailable');
      supabaseMockHelpers.setError(serviceError);

      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.code).toBe('UNAUTHORIZED');
        expect(result.message).toContain('인증 처리 중 오류가 발생했습니다');
      }
    });
  });

  describe('🟢 GREEN Phase: 성공 테스트', () => {
    it('유효한 Supabase 토큰으로 인증 성공해야 함', async () => {
      // Given: 유효한 사용자와 토큰
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 성공
      expect(isAuthenticated(result)).toBe(true);
      if (isAuthenticated(result)) {
        expect(result.id).toBe(TEST_USERS.VALID_USER.id);
        expect(result.email).toBe(TEST_USERS.VALID_USER.email);
        expect(result.tokenType).toBe('supabase');
      }
    });

    it('게스트 모드에서 미인증 사용자 허용해야 함', async () => {
      // Given: 미인증 사용자
      const req = new NextRequest('http://localhost:3000/api/test');

      // When: 게스트 모드로 인증 시도
      const result = await requireSupabaseAuthentication(req, { allowGuest: true });

      // Then: 게스트로 허용
      expect(isGuest(result)).toBe(true);
      if (isGuest(result)) {
        expect(result.id).toBe(null);
        expect(result.isAuthenticated).toBe(false);
        expect(result.tokenType).toBe('guest');
      }
    });

    it('레거시 JWT 토큰으로 인증 성공해야 함 (백업 경로)', async () => {
      // Given: 레거시 JWT 토큰 (Supabase 실패 시 백업)
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.LEGACY_JWT}`
        }
      });

      // 레거시 JWT 인증 모킹 (별도 구현 필요)
      vi.doMock('@/shared/lib/auth', () => ({
        verifySessionToken: vi.fn((token: string) => {
          if (token === TEST_TOKENS.LEGACY_JWT) {
            return {
              sub: 'legacy-user-id',
              email: 'legacy@example.com',
              username: 'legacyuser'
            };
          }
          return null;
        })
      }));

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 레거시 JWT로 인증 성공
      expect(isAuthenticated(result)).toBe(true);
      if (isAuthenticated(result)) {
        expect(result.tokenType).toBe('legacy');
      }
    });
  });

  describe('🔄 REFACTOR Phase: 엣지 케이스 및 경계 테스트', () => {
    it('동시 다발적 인증 요청 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);
      const requests = Array.from({ length: 5 }, () =>
        new NextRequest('http://localhost:3000/api/test', {
          headers: {
            'Authorization': `Bearer ${TEST_TOKENS.VALID}`
          }
        })
      );

      // When: 동시에 5개 요청 처리
      const results = await Promise.all(
        requests.map(req => requireSupabaseAuthentication(req))
      );

      // Then: 모든 요청이 성공해야 함
      results.forEach(result => {
        expect(isAuthenticated(result)).toBe(true);
      });
    });

    it('빈 Authorization 헤더 처리해야 함', async () => {
      // Given: 빈 Authorization 헤더
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': ''
        }
      });

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
    });

    it('Bearer 없는 토큰 헤더 처리해야 함', async () => {
      // Given: Bearer 없는 토큰
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': TEST_TOKENS.VALID // Bearer 없음
        }
      });

      // When: 인증 시도
      const result = await requireSupabaseAuthentication(req);

      // Then: 인증 실패
      expect(isAuthError(result)).toBe(true);
    });

    it('대소문자 혼합 Bearer 헤더 처리해야 함', async () => {
      // Given: 다양한 케이스의 Bearer 헤더
      const testCases = ['bearer', 'Bearer', 'BEARER', 'BeArEr'];

      for (const bearerCase of testCases) {
        supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);
        const req = new NextRequest('http://localhost:3000/api/test', {
          headers: {
            'Authorization': `${bearerCase} ${TEST_TOKENS.VALID}`
          }
        });

        // When: 인증 시도
        const result = await requireSupabaseAuthentication(req);

        // Then: 대소문자 관계없이 성공
        expect(isAuthenticated(result)).toBe(true);
      }
    });
  });

  describe('🚨 $300 사건 방지: 무한 루프 감지', () => {
    it('빠른 연속 호출 감지해야 함', async () => {
      // Given: 유효한 요청이지만 빠른 연속 호출
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: 빠른 연속으로 12회 호출 (무한 루프 시뮬레이션)
      const promises = Array.from({ length: 12 }, () =>
        requireSupabaseAuthentication(req)
      );

      // Then: 무한 루프 감지로 에러 발생해야 함
      try {
        await Promise.all(promises);
        // 무한 루프가 감지되지 않으면 테스트 실패
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('INFINITE_LOOP_DETECTED');
        expect((error as Error).message).toContain('This would cost $300+');
      }
    });

    it('정상적인 간격의 호출은 허용해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: 1초 간격으로 호출 (정상 사용 패턴)
      const results = [];
      for (let i = 0; i < 3; i++) {
        const req = new NextRequest('http://localhost:3000/api/test', {
          headers: {
            'Authorization': `Bearer ${TEST_TOKENS.VALID}`
          }
        });

        const result = await requireSupabaseAuthentication(req);
        results.push(result);

        // 간격 두기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Then: 모든 호출이 성공해야 함
      results.forEach(result => {
        expect(isAuthenticated(result)).toBe(true);
      });
    });
  });

  describe('📊 타입 가드 함수 테스트', () => {
    it('isAuthError 타입 가드가 올바르게 동작해야 함', () => {
      const authError = {
        code: 'UNAUTHORIZED' as const,
        message: 'Test error',
        statusCode: 401 as const
      };

      expect(isAuthError(authError)).toBe(true);
    });

    it('isAuthenticated 타입 가드가 올바르게 동작해야 함', () => {
      const authUser = {
        id: 'test-id',
        email: 'test@example.com',
        username: 'testuser',
        isAuthenticated: true as const,
        tokenType: 'supabase' as const
      };

      expect(isAuthenticated(authUser)).toBe(true);
    });

    it('isGuest 타입 가드가 올바르게 동작해야 함', () => {
      const guestUser = {
        id: null,
        email: null,
        username: null,
        isAuthenticated: false as const,
        tokenType: 'guest' as const
      };

      expect(isGuest(guestUser)).toBe(true);
    });
  });
});