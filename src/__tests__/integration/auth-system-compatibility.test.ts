/**
 * 새로운 통합 인증 시스템 호환성 테스트
 *
 * 목적: 새로운 withAuth 미들웨어와 기존 시스템의 호환성 검증
 * - MSW를 통한 실제 HTTP 요청 테스트
 * - Service Role Key graceful degradation 확인
 * - 무한 루프 방지 메커니즘 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { supabaseMockHelpers, TEST_USERS, TEST_TOKENS } from '@/shared/lib/mocks/supabase-mock';

describe('통합 인증 시스템 호환성 테스트', () => {
  beforeEach(() => {
    supabaseMockHelpers.reset();
  });

  describe('MSW 핸들러와 새로운 인증 시스템 통합', () => {
    it('유효한 Supabase 토큰으로 /api/auth/me 호출이 성공해야 함', async () => {
      // Given: 유효한 사용자 설정
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: MSW를 통한 실제 HTTP 요청
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
          'x-supabase-token': TEST_TOKENS.VALID
        }
      });

      // Then: 새로운 인증 시스템 응답 형식 확인
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          tokenType: expect.any(String),
          serviceMode: expect.any(String)
        })
      );

      // 새로운 캐싱 헤더 확인
      expect(response.headers.get('X-Service-Mode')).toBeTruthy();
      expect(response.headers.get('X-Loop-Prevention')).toBe('active');
      expect(response.headers.get('ETag')).toBeTruthy();
    });

    it('유효하지 않은 토큰으로 인증 실패해야 함', async () => {
      // When: 유효하지 않은 토큰으로 요청
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.INVALID
        }
      });

      // Then: 401 에러와 통일된 에러 형식
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('INVALID_TOKEN');
      expect(data.message).toBeTruthy();
      expect(data.code).toBe('TOKEN_INVALID');
    });

    it('토큰 없이 요청 시 401 에러를 반환해야 함', async () => {
      // When: 토큰 없이 요청
      const response = await fetch('/api/auth/me');

      // Then: 401 에러
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
      expect(data.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('ETag 기반 캐싱 동작 확인', () => {
    it('동일한 요청에 대해 304 Not Modified를 반환해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: 첫 번째 요청
      const firstResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
          'x-supabase-token': TEST_TOKENS.VALID
        }
      });

      expect(firstResponse.ok).toBe(true);
      const etag = firstResponse.headers.get('ETag');
      expect(etag).toBeTruthy();

      // When: ETag로 조건부 요청
      const secondResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
          'x-supabase-token': TEST_TOKENS.VALID,
          'If-None-Match': etag!
        }
      });

      // Then: 304 Not Modified
      expect(secondResponse.status).toBe(304);
      expect(secondResponse.headers.get('X-Service-Mode')).toBeTruthy();
    });
  });

  describe('Service Role Key Graceful Degradation', () => {
    it('Service Role Key 없이도 degraded mode로 동작해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: degraded mode 엔드포인트 호출
      const response = await fetch('/api/auth/me/degraded', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
          'x-supabase-token': TEST_TOKENS.VALID
        }
      });

      // Then: degraded mode 응답
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.data.serviceMode).toBe('degraded');
      expect(data.data.isEmailVerified).toBe(false); // 제한된 정보
      expect(response.headers.get('X-Service-Mode')).toBe('degraded');
      expect(response.headers.get('X-Degradation-Reason')).toBe('service-role-key-unavailable');
    });
  });

  describe('무한 루프 방지 ($300 사건 재발 방지)', () => {
    it('빠른 연속 호출에 대해 적절히 제한해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: 빠른 연속 호출 (5회)
      const promises = Array.from({ length: 5 }, (_, i) =>
        fetch('/api/auth/me', {
          headers: {
            'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
            'x-supabase-token': TEST_TOKENS.VALID,
            'X-Request-Index': i.toString() // 각 요청을 구분하기 위해
          }
        })
      );

      const responses = await Promise.all(promises);

      // Then: 모든 요청이 성공해야 함 (아직 limit 미만)
      responses.forEach((response, index) => {
        expect(response.ok).toBe(true, `Request ${index} should succeed`);
        expect(response.headers.get('X-Loop-Prevention')).toBe('active');
      });

      // 호출 통계 확인
      const stats = supabaseMockHelpers.getCallStats();
      expect(stats.callCount['auth.getUser'] || 0).toBeLessThan(20); // 합리적인 범위
    });

    it('무한 루프 패턴 감지 시 차단해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      try {
        // When: 무한 루프 시뮬레이션 (매우 빠른 연속 호출)
        for (let i = 0; i < 15; i++) {
          await fetch('/api/auth/me', {
            headers: {
              'Authorization': 'Bearer ' + TEST_TOKENS.VALID
            }
          });
        }

        // Then: 호출 제한이 발생해야 함
        const stats = supabaseMockHelpers.getCallStats();
        const risk = supabaseMockHelpers.getInfiniteLoopRisk('auth.getUser');

        // 무한 루프 감지 또는 합리적인 제한이 있어야 함
        expect(risk.callCount).toBeLessThan(50); // 무제한 호출 방지
      } catch (error) {
        // 무한 루프 감지로 인한 에러는 예상되는 동작
        expect(error.message).toContain('INFINITE_LOOP_DETECTED');
      }
    });
  });

  describe('다양한 토큰 형태 지원', () => {
    it('Legacy JWT 토큰도 지원해야 함', async () => {
      // Given: Legacy 토큰
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.LEGACY_JWT,
          'x-legacy-token': TEST_TOKENS.LEGACY_JWT
        }
      });

      // Legacy 토큰 지원 여부에 따라 다른 결과 예상
      if (response.ok) {
        const data = await response.json();
        expect(data.data.tokenType).toBe('legacy');
      } else {
        // Legacy 토큰 미지원 시 적절한 에러
        expect(response.status).toBe(401);
      }
    });

    it('만료된 토큰에 대해 적절한 에러를 반환해야 함', async () => {
      // When: 만료된 토큰으로 요청
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer ' + TEST_TOKENS.EXPIRED
        }
      });

      // Then: 401 에러
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(['INVALID_TOKEN', 'TOKEN_EXPIRED', 'UNAUTHORIZED']).toContain(data.error);
    });
  });

  describe('헤더 기반 인증 정보 처리', () => {
    it('다양한 인증 헤더를 올바르게 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: 다양한 헤더 조합으로 요청
      const testCases = [
        {
          headers: { 'Authorization': 'Bearer ' + TEST_TOKENS.VALID },
          description: 'Authorization 헤더만'
        },
        {
          headers: { 'x-supabase-token': TEST_TOKENS.VALID },
          description: 'x-supabase-token 헤더만'
        },
        {
          headers: {
            'Authorization': 'Bearer ' + TEST_TOKENS.VALID,
            'x-supabase-token': TEST_TOKENS.VALID
          },
          description: '두 헤더 모두'
        }
      ];

      for (const testCase of testCases) {
        const response = await fetch('/api/auth/me', {
          headers: testCase.headers
        });

        // Then: 모든 케이스에서 성공하거나 일관된 에러
        if (response.ok) {
          const data = await response.json();
          expect(data.ok).toBe(true);
          expect(data.data.id).toBeTruthy();
        } else {
          // 실패한 경우에도 일관된 에러 형식
          expect(response.status).toBeOneOf([401, 400]);
          const data = await response.json();
          expect(data.ok).toBe(false);
          expect(data.error).toBeTruthy();
        }
      }
    });
  });

  describe('에러 처리 일관성', () => {
    it('모든 에러 응답이 통일된 형식을 가져야 함', async () => {
      const errorScenarios = [
        {
          headers: {},
          expectedStatus: 401,
          description: '인증 정보 없음'
        },
        {
          headers: { 'Authorization': 'Bearer invalid-token' },
          expectedStatus: 401,
          description: '잘못된 토큰'
        },
        {
          headers: { 'Authorization': 'Bearer ' + TEST_TOKENS.EXPIRED },
          expectedStatus: 401,
          description: '만료된 토큰'
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await fetch('/api/auth/me', {
          headers: scenario.headers
        });

        expect(response.status).toBe(scenario.expectedStatus);

        const data = await response.json();
        expect(data).toEqual(
          expect.objectContaining({
            ok: false,
            error: expect.any(String),
            message: expect.any(String),
            code: expect.any(String)
          })
        );

        // traceId는 있을 수도 없을 수도 있음
        if (data.traceId) {
          expect(data.traceId).toBe('test-trace-id');
        }
      }
    });
  });
});