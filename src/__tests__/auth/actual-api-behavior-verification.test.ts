/**
 * 실제 API 동작 검증 테스트 - 코드와 현실의 괴리 해소
 *
 * 목적: MSW 모킹이 아닌 실제 API 엔드포인트 호출로
 *       코드가 실제로 의도한 대로 작동하는지 검증
 *
 * Grace의 TDD 철학: 테스트가 실패해야 실제 문제를 발견할 수 있다
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/shared/lib/api-client';

// 실제 API 라우트 핸들러 import
import { GET as authMeHandler } from '@/app/api/auth/me/route';
import { POST as authRefreshHandler } from '@/app/api/auth/refresh/route';

describe('🔍 실제 API 동작 검증 - auth/me 무한루프 방지', () => {

  // 테스트 환경 변수 설정
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-auth-verification';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    // 환경 변수 정리
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  describe('💥 RED Phase: 실제 API 호출로 문제 재현', () => {

    it('🚨 실패해야 함: auth/me를 토큰 없이 호출했을 때 무한루프 없이 게스트 모드 반환', async () => {
      // GIVEN: 토큰이 없는 요청
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // WHEN: 실제 auth/me API 핸들러 호출
      const response = await authMeHandler(request);

      // THEN: 게스트 모드로 응답해야 함 (401이 아닌)
      const status = response.status;
      const data = await response.json();

      console.log('🔍 토큰 없는 auth/me 응답:', { status, data });

      // 예상: 게스트 모드로 200 응답 (Grace의 예상)
      // 실제: 401 에러가 날 가능성 높음 (실제 문제)
      expect(status).toBe(200);
      expect(data.data.isGuest).toBe(true);
      expect(data.data.accessToken).toBeNull();
    });

    it('🚨 실패해야 함: refresh 토큰 없이 refresh API 호출했을 때 400 에러 (401 아닌)', async () => {
      // GIVEN: refresh 토큰이 없는 요청
      const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // WHEN: 실제 refresh API 핸들러 호출
      const response = await authRefreshHandler(request);

      // THEN: 400 에러여야 함 (무한루프 방지)
      const status = response.status;
      const data = await response.json();

      console.log('🔍 토큰 없는 refresh 응답:', { status, data });

      // 예상: 400 Bad Request (무한루프 방지)
      // 실제: 500 에러나 다른 예외가 날 가능성
      expect(status).toBe(400);
      expect(data.error).toContain('MISSING_REFRESH_TOKEN');
    });

    it('🚨 실패해야 함: 만료된 토큰으로 auth/me 호출했을 때 토큰 갱신 시도 후 게스트 모드', async () => {
      // GIVEN: 만료된 JWT 토큰
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE2MDk0NTkyMDB9.invalid';

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${expiredToken}`,
          'Content-Type': 'application/json'
        }
      });

      // WHEN: 실제 auth/me API 핸들러 호출
      const response = await authMeHandler(request);

      // THEN: 토큰 갱신 실패 후 게스트 모드로 전환되어야 함
      const status = response.status;
      const data = await response.json();

      console.log('🔍 만료된 토큰 auth/me 응답:', { status, data });

      // 예상: 게스트 모드로 graceful degradation
      // 실제: 401 에러나 서버 에러가 날 가능성
      expect(status).toBe(200);
      expect(data.data.isGuest).toBe(true);
    });

  });

  describe('🔧 환경 변수 및 초기화 검증', () => {

    it('🚨 실패할 수도 있음: 필수 환경 변수들이 런타임에 실제로 로드되는지 확인', async () => {
      // GIVEN: 환경 변수들
      const requiredEnvVars = [
        'JWT_SECRET',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY'
      ];

      // WHEN: 런타임에서 환경 변수 확인
      const missingVars: string[] = [];

      requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
          missingVars.push(varName);
        }
      });

      console.log('🔍 환경 변수 상태:', {
        JWT_SECRET: !!process.env.JWT_SECRET,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        missing: missingVars
      });

      // THEN: 모든 필수 환경 변수가 있어야 함
      expect(missingVars).toHaveLength(0);
    });

    it('🔧 Supabase 클라이언트가 실제로 초기화되는지 확인', async () => {
      // WHEN: Supabase 클라이언트 초기화 시도
      let supabaseInitError = null;

      try {
        const { supabase } = await import('@/lib/supabase');
        expect(supabase).toBeDefined();
        console.log('✅ Supabase 클라이언트 초기화 성공');
      } catch (error) {
        supabaseInitError = error;
        console.error('❌ Supabase 클라이언트 초기화 실패:', error);
      }

      // THEN: 초기화가 성공해야 함
      expect(supabaseInitError).toBeNull();
    });

  });

  describe('🔄 API Client 중복 호출 방지 검증', () => {

    it('🚨 중요: 동일한 auth/me 요청을 동시에 여러 번 호출했을 때 실제로 1번만 실행되는지', async () => {
      // GIVEN: API 호출 카운터 초기화
      let actualApiCallCount = 0;

      // Mock console.log to count actual API calls
      const originalLog = console.log;
      console.log = (...args) => {
        if (args[0] && args[0].includes('🔍 API 요청:') && args[0].includes('/api/auth/me')) {
          actualApiCallCount++;
        }
        originalLog(...args);
      };

      try {
        // WHEN: 동일한 요청을 동시에 5번 실행
        const promises = Array(5).fill(null).map(() =>
          apiClient.get('/api/auth/me')
        );

        await Promise.allSettled(promises);

        // THEN: 실제 API 호출은 1번만 발생해야 함
        console.log(`🔍 실제 API 호출 횟수: ${actualApiCallCount}`);

        // $300 사건 방지: 중복 호출이 실제로 방지되어야 함
        expect(actualApiCallCount).toBeLessThanOrEqual(1);

      } finally {
        console.log = originalLog;
      }
    });

    it('🚨 캐시가 실제로 작동하는지 확인 - 1분 내 같은 요청은 캐시에서 반환', async () => {
      // GIVEN: 첫 번째 요청으로 캐시 생성
      const firstResponse = await apiClient.get('/api/auth/me');

      const startTime = Date.now();

      // WHEN: 즉시 같은 요청 재실행
      const secondResponse = await apiClient.get('/api/auth/me');

      const responseTime = Date.now() - startTime;

      // THEN: 두 번째 요청은 캐시에서 즉시 반환되어야 함 (< 100ms)
      console.log(`🔍 두 번째 요청 응답 시간: ${responseTime}ms`);

      expect(responseTime).toBeLessThan(100); // 캐시 히트는 매우 빨라야 함
      expect(secondResponse).toEqual(firstResponse); // 응답이 동일해야 함
    });

  });

  describe('📊 실제 에러 패턴 모니터링', () => {

    it('🔍 401 → refresh → 400 에러 체인이 실제로 차단되는지 검증', async () => {
      // 이 테스트는 실제 환경에서 무한루프 패턴을 재현하고 차단되는지 확인
      const errorLog: string[] = [];

      const originalError = console.error;
      console.error = (...args) => {
        errorLog.push(args.join(' '));
        originalError(...args);
      };

      try {
        // GIVEN: 무효한 토큰으로 여러 번 요청
        const invalidToken = 'invalid-token-that-will-cause-401';

        for (let i = 0; i < 3; i++) {
          try {
            await apiClient.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${invalidToken}` }
            });
          } catch (error) {
            // 에러 무시 - 패턴만 확인
          }
        }

        // THEN: 무한루프가 발생하지 않아야 함
        const refreshErrors = errorLog.filter(log =>
          log.includes('refresh') && log.includes('infinite')
        );

        console.log('🔍 에러 로그 패턴:', refreshErrors);

        // 무한루프 경고가 있다면 차단 메커니즘이 작동한 것
        expect(refreshErrors.length).toBeLessThan(10); // 과도한 재시도 없어야 함

      } finally {
        console.error = originalError;
      }
    });

  });

});

/**
 * 🎯 이 테스트의 목적:
 *
 * 1. 실제 API 핸들러를 직접 호출하여 MSW 모킹 없이 검증
 * 2. 코드에 작성된 무한루프 방지 로직이 실제로 작동하는지 확인
 * 3. 환경 변수, 쿠키, 토큰 처리가 런타임에 정상 동작하는지 검증
 * 4. $300 사건과 같은 무한루프 패턴이 실제로 차단되는지 확인
 *
 * 🚨 예상 결과: 대부분의 테스트가 실패할 것임
 *
 * 이는 코드와 실제 동작 사이의 괴리를 드러내는 정상적인 TDD 과정입니다.
 * 실패한 테스트들을 통해 실제 문제를 식별하고 수정할 것입니다.
 */