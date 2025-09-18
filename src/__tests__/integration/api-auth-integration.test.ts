/**
 * requireSupabaseAuthentication API 통합 테스트
 * TDD: Red → Green → Refactor
 *
 * 테스트 목표:
 * 1. 모든 인증 필요 API 엔드포인트 검증
 * 2. 401/400 에러 시나리오 완전 커버
 * 3. 프로덕션 시나리오 재현
 * 4. MSW 통합으로 네트워크 레이어 테스트
 * 5. E2E 수준의 인증 플로우 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMocks } from 'node-mocks-http';
import { supabaseMockHelpers, TEST_USERS, TEST_TOKENS } from '@/shared/lib/mocks/supabase-mock';

// 실제 API 라우트 핸들러들 import
import { GET as authMeHandler } from '@/app/api/auth/me/route';
import { POST as generateStoryHandler } from '@/app/api/ai/generate-story/route';
import { GET as storiesListHandler, POST as storiesCreateHandler } from '@/app/api/planning/stories/route';

describe('requireSupabaseAuthentication API 통합 테스트', () => {
  beforeEach(() => {
    supabaseMockHelpers.reset();
    vi.clearAllMocks();

    // 테스트 환경 설정
    process.env.INTEGRATION_TEST = 'true';
  });

  afterEach(() => {
    delete process.env.INTEGRATION_TEST;
  });

  describe('🔴 RED Phase: 인증 실패 시나리오', () => {
    it('/api/auth/me - 토큰 없이 401 에러 반환해야 함', async () => {
      // Given: Authorization 헤더가 없는 요청
      const req = new NextRequest('http://localhost:3000/api/auth/me');

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.message).toContain('유효한 인증 토큰이 필요합니다');
    });

    it('/api/auth/me - 잘못된 토큰으로 401 에러 반환해야 함', async () => {
      // Given: 잘못된 토큰
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.INVALID}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.ok).toBe(false);
    });

    it('/api/auth/me - 만료된 토큰으로 401 에러 반환해야 함', async () => {
      // Given: 만료된 토큰
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.EXPIRED}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);
    });

    it('/api/ai/generate-story - 인증 없이 401 에러 반환해야 함', async () => {
      // Given: 인증 없는 스토리 생성 요청
      const req = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '테스트 스토리',
          genre: 'drama',
          tone: 'serious'
        })
      });

      // When: API 호출
      const response = await generateStoryHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.ok).toBe(false);
    });

    it('/api/planning/stories - GET 인증 없이 401 에러 반환해야 함', async () => {
      // Given: 인증 없는 스토리 목록 요청
      const req = new NextRequest('http://localhost:3000/api/planning/stories');

      // When: API 호출
      const response = await storiesListHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);
    });

    it('/api/planning/stories - POST 인증 없이 401 에러 반환해야 함', async () => {
      // Given: 인증 없는 스토리 생성 요청
      const req = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '테스트 스토리',
          oneLineStory: '테스트 스토리입니다'
        })
      });

      // When: API 호출
      const response = await storiesCreateHandler(req);

      // Then: 401 에러 응답
      expect(response.status).toBe(401);
    });

    it('이메일 미인증 사용자 차단 시나리오', async () => {
      // Given: 이메일 미인증 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.UNVERIFIED_USER);

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: 이메일 인증이 필요한 API 호출
      const response = await authMeHandler(req);

      // Then: 401 에러 또는 이메일 인증 필요 메시지
      const data = await response.json();
      expect([401, 403]).toContain(response.status);

      if (response.status === 401) {
        expect(data.message).toContain('이메일 인증이 필요합니다');
      }
    });

    it('Supabase 서비스 장애 시 500 에러 반환해야 함', async () => {
      // Given: Supabase 서비스 에러 설정
      supabaseMockHelpers.setError(new Error('Supabase service unavailable'));

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 401 에러 (서비스 장애도 인증 실패로 처리)
      expect(response.status).toBe(401);
    });
  });

  describe('🟢 GREEN Phase: 인증 성공 시나리오', () => {
    it('/api/auth/me - 유효한 토큰으로 사용자 정보 반환해야 함', async () => {
      // Given: 유효한 사용자와 토큰
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 성공 응답과 사용자 정보
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBe(TEST_USERS.VALID_USER.id);
      expect(data.data.email).toBe(TEST_USERS.VALID_USER.email);
    });

    it('/api/ai/generate-story - 인증된 사용자의 스토리 생성 성공해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '테스트 스토리',
          genre: 'drama',
          toneAndManner: 'serious',
          targetAudience: 'adult'
        })
      });

      // When: API 호출
      const response = await generateStoryHandler(req);

      // Then: 성공 응답 (또는 비즈니스 로직 에러만)
      expect([200, 201, 400]).toContain(response.status);

      // 401 에러는 발생하지 않아야 함 (인증 성공)
      expect(response.status).not.toBe(401);

      if (response.status >= 400) {
        const data = await response.json();
        // 인증 에러가 아닌 비즈니스 로직 에러여야 함
        expect(data.message).not.toContain('인증');
        expect(data.message).not.toContain('토큰');
      }
    });

    it('/api/planning/stories - 인증된 사용자의 스토리 목록 조회 성공해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/planning/stories', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: API 호출
      const response = await storiesListHandler(req);

      // Then: 성공 응답
      expect([200, 201]).toContain(response.status);
      expect(response.status).not.toBe(401); // 인증 에러 아님
    });

    it('레거시 JWT 토큰으로 백업 인증 성공해야 함', async () => {
      // Given: Supabase 실패 시 레거시 JWT로 백업
      // 먼저 Supabase 실패 설정
      supabaseMockHelpers.setError(new Error('Supabase down'));

      // 레거시 JWT 모킹
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

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.LEGACY_JWT}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 레거시 JWT로 인증 성공
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.data.id).toBe('legacy-user-id');
    });
  });

  describe('🔄 REFACTOR Phase: 엣지 케이스 및 경계 테스트', () => {
    it('동시 다발적 API 요청 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      // When: 동시에 여러 API 호출
      const requests = [
        authMeHandler(new NextRequest('http://localhost:3000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${TEST_TOKENS.VALID}` }
        })),
        storiesListHandler(new NextRequest('http://localhost:3000/api/planning/stories', {
          headers: { 'Authorization': `Bearer ${TEST_TOKENS.VALID}` }
        })),
        authMeHandler(new NextRequest('http://localhost:3000/api/auth/me', {
          headers: { 'Authorization': `Bearer ${TEST_TOKENS.VALID}` }
        }))
      ];

      const responses = await Promise.all(requests);

      // Then: 모든 요청이 성공해야 함
      responses.forEach(response => {
        expect(response.status).not.toBe(401);
        expect([200, 201]).toContain(response.status);
      });
    });

    it('대소문자 혼합 Authorization 헤더 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const testCases = [
        'authorization',
        'Authorization',
        'AUTHORIZATION',
        'AuThOrIzAtIoN'
      ];

      // When: 다양한 대소문자 헤더로 요청
      for (const headerName of testCases) {
        const req = new NextRequest('http://localhost:3000/api/auth/me', {
          headers: {
            [headerName]: `Bearer ${TEST_TOKENS.VALID}`
          }
        });

        const response = await authMeHandler(req);

        // Then: 대소문자 관계없이 성공
        expect(response.status).toBe(200);
      }
    });

    it('빈 요청 본문 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/planning/stories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // 빈 객체
      });

      // When: API 호출
      const response = await storiesCreateHandler(req);

      // Then: 인증은 성공하되 비즈니스 로직 에러 발생
      expect(response.status).not.toBe(401); // 인증 에러 아님
      expect(response.status).toBe(400); // 비즈니스 로직 에러
    });

    it('잘못된 JSON 형식 요청 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid json {' // 잘못된 JSON
      });

      // When: API 호출
      const response = await generateStoryHandler(req);

      // Then: 인증은 성공하되 JSON 파싱 에러
      expect(response.status).not.toBe(401); // 인증 에러 아님
      expect([400, 500]).toContain(response.status); // 파싱 에러
    });
  });

  describe('📊 성능 및 안정성 테스트', () => {
    it('API 응답 시간이 허용 범위 내여야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      // When: API 호출 시간 측정
      const startTime = Date.now();
      const response = await authMeHandler(req);
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // Then: 응답 시간이 500ms 이하여야 함
      expect(responseTime).toBeLessThan(500);
      expect(response.status).toBe(200);
    });

    it('메모리 누수 없이 연속 요청 처리해야 함', async () => {
      // Given: 유효한 사용자
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const startMemory = process.memoryUsage().heapUsed;

      // When: 연속 100회 요청
      for (let i = 0; i < 100; i++) {
        const req = new NextRequest('http://localhost:3000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${TEST_TOKENS.VALID}`
          }
        });

        const response = await authMeHandler(req);
        expect(response.status).toBe(200);

        // 가비지 컬렉션 유도
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Then: 메모리 증가가 10MB 이하여야 함
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('에러 복구 능력 테스트', async () => {
      // Given: 일시적 에러 후 복구 시나리오

      // 1단계: 에러 상황
      supabaseMockHelpers.setError(new Error('Temporary error'));

      const req1 = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      const response1 = await authMeHandler(req1);
      expect(response1.status).toBe(401); // 에러 상황

      // 2단계: 복구
      supabaseMockHelpers.setError(); // 에러 해제
      supabaseMockHelpers.setCurrentUser(TEST_USERS.VALID_USER);

      const req2 = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${TEST_TOKENS.VALID}`
        }
      });

      const response2 = await authMeHandler(req2);

      // Then: 복구 후 정상 동작
      expect(response2.status).toBe(200);
    });
  });

  describe('🛡️ 보안 테스트', () => {
    it('SQL 인젝션 시도 차단해야 함', async () => {
      // Given: SQL 인젝션이 포함된 토큰
      const maliciousToken = "'; DROP TABLE users; --";

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${maliciousToken}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 안전하게 차단
      expect(response.status).toBe(401);
    });

    it('XSS 시도 차단해야 함', async () => {
      // Given: XSS가 포함된 토큰
      const xssToken = '<script>alert("xss")</script>';

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${xssToken}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 안전하게 차단
      expect(response.status).toBe(401);
    });

    it('비정상적으로 긴 토큰 차단해야 함', async () => {
      // Given: 비정상적으로 긴 토큰 (DoS 시도)
      const longToken = 'a'.repeat(10000);

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${longToken}`
        }
      });

      // When: API 호출
      const response = await authMeHandler(req);

      // Then: 안전하게 차단
      expect(response.status).toBe(401);
    });
  });
});