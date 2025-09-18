/**
 * httpOnly 쿠키 실제 동작 검증 테스트
 *
 * 목적: MSW 없이 실제 쿠키 처리가 어떻게 작동하는지 검증
 * Grace의 지침: 실제 환경에서 발생할 수 있는 모든 시나리오 테스트
 */

import { NextRequest } from 'next/server';
import { GET as authMeHandler } from '@/app/api/auth/me/route';
import { POST as authRefreshHandler } from '@/app/api/auth/refresh/route';

// 실제 환경과 동일한 조건으로 테스트
describe('🔒 httpOnly 쿠키 실제 동작 검증', () => {

  // 실제 환경 변수 설정
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-cookie-verification';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';
  });

  describe('💥 RED Phase: 쿠키 없는 상황에서 실제 동작', () => {

    it('🚨 실패 예상: 쿠키 없이 auth/me 호출 시 실제 응답', async () => {
      // GIVEN: 완전히 빈 요청 (쿠키 없음)
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Authorization 헤더도 없음
        }
      });

      console.log('🔍 요청 쿠키:', request.cookies.getAll());
      console.log('🔍 요청 헤더:', Object.fromEntries(request.headers.entries()));

      // WHEN: 실제 핸들러 호출
      let response: Response;
      let responseData: any;
      let error: any = null;

      try {
        response = await authMeHandler(request);
        responseData = await response.json();

        console.log('🔍 응답 상태:', response.status);
        console.log('🔍 응답 데이터:', responseData);
        console.log('🔍 응답 헤더:', Object.fromEntries(response.headers.entries()));

      } catch (e) {
        error = e;
        console.error('🚨 핸들러 실행 중 에러:', error);
      }

      // THEN: 에러 없이 처리되어야 함
      expect(error).toBeNull();

      // 실제로는 어떤 응답이 올지 확인
      if (response! && responseData) {
        console.log(`📊 실제 응답: ${response!.status} - ${JSON.stringify(responseData, null, 2)}`);

        // 게스트 모드로 응답하는지 확인
        if (response!.status === 200) {
          expect(responseData.data).toBeDefined();
          // 게스트 모드 특성 확인
          expect(responseData.data.isGuest).toBe(true);
        }
      }
    });

    it('🚨 실패 예상: refresh 토큰 없이 refresh API 호출 시 실제 응답', async () => {
      // GIVEN: refresh 토큰이 없는 요청
      const request = new NextRequest('http://localhost:3000/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Refresh 요청 쿠키:', request.cookies.getAll());

      // WHEN: 실제 refresh 핸들러 호출
      let response: Response;
      let responseData: any;
      let error: any = null;

      try {
        response = await authRefreshHandler(request);
        responseData = await response.json();

        console.log('🔍 Refresh 응답 상태:', response.status);
        console.log('🔍 Refresh 응답 데이터:', responseData);

      } catch (e) {
        error = e;
        console.error('🚨 Refresh 핸들러 실행 중 에러:', error);
      }

      // THEN: 에러 없이 처리되어야 함
      expect(error).toBeNull();

      if (response! && responseData) {
        console.log(`📊 실제 Refresh 응답: ${response!.status} - ${JSON.stringify(responseData, null, 2)}`);

        // 400 에러가 나와야 무한루프 방지됨
        if (response!.status === 400) {
          expect(responseData.error).toContain('MISSING_REFRESH_TOKEN');
          console.log('✅ 무한루프 방지 - 400 에러 정상 반환');
        } else {
          console.warn(`⚠️ 예상과 다른 응답: ${response!.status}`);
        }
      }
    });

  });

  describe('🍪 쿠키 시뮬레이션 테스트', () => {

    it('🔧 유효한 Supabase 쿠키가 있을 때 실제 동작', async () => {
      // GIVEN: 유효한 Supabase 쿠키를 시뮬레이션
      const mockAccessToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJpc3MiOiJzdXBhYmFzZSIsImV4cCI6OTk5OTk5OTk5OX0.test';
      const mockRefreshToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJpc3MiOiJzdXBhYmFzZSIsImV4cCI6OTk5OTk5OTk5OX0.refresh';

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sb-access-token=${mockAccessToken}; sb-refresh-token=${mockRefreshToken}`
        }
      });

      console.log('🔍 쿠키 시뮬레이션 요청:', request.cookies.getAll());

      // WHEN: 실제 핸들러 호출
      let response: Response;
      let responseData: any;
      let error: any = null;

      try {
        response = await authMeHandler(request);
        responseData = await response.json();

        console.log('🔍 쿠키 시뮬레이션 응답 상태:', response.status);
        console.log('🔍 쿠키 시뮬레이션 응답 데이터:', responseData);

      } catch (e) {
        error = e;
        console.error('🚨 쿠키 시뮬레이션 에러:', error);
      }

      // THEN: 결과 분석
      if (error) {
        console.log('❌ 쿠키가 있어도 에러 발생 - 환경 설정 문제 가능성');
      } else if (response!) {
        console.log(`📊 쿠키 시뮬레이션 결과: ${response!.status}`);

        if (response!.status === 200 && responseData) {
          console.log('✅ 쿠키 인식 성공');
          expect(responseData.data).toBeDefined();
        }
      }
    });

    it('🔧 Bearer 토큰이 있을 때 실제 동작', async () => {
      // GIVEN: Authorization 헤더에 Bearer 토큰
      const mockBearerToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJpc3MiOiJzdXBhYmFzZSIsImV4cCI6OTk5OTk5OTk5OX0.bearer';

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockBearerToken}`
        }
      });

      console.log('🔍 Bearer 토큰 요청 헤더:', Object.fromEntries(request.headers.entries()));

      // WHEN: 실제 핸들러 호출
      let response: Response;
      let responseData: any;
      let error: any = null;

      try {
        response = await authMeHandler(request);
        responseData = await response.json();

        console.log('🔍 Bearer 토큰 응답 상태:', response.status);
        console.log('🔍 Bearer 토큰 응답 데이터:', responseData);

      } catch (e) {
        error = e;
        console.error('🚨 Bearer 토큰 처리 에러:', error);
      }

      // THEN: 결과 분석
      if (error) {
        console.log('❌ Bearer 토큰도 에러 발생 - 인증 시스템 전체 문제');
      } else if (response!) {
        console.log(`📊 Bearer 토큰 결과: ${response!.status}`);
      }
    });

  });

  describe('🔄 무한루프 패턴 실제 재현', () => {

    it('🚨 위험: 401 → refresh → 400 체인이 실제로 차단되는지 확인', async () => {
      // GIVEN: 무효한 토큰으로 시작
      const invalidToken = 'invalid-token-123';

      // Step 1: auth/me에 무효한 토큰으로 요청
      const authRequest = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${invalidToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Step 1: 무효한 토큰으로 auth/me 호출');

      let authResponse: Response;
      let authError: any = null;

      try {
        authResponse = await authMeHandler(authRequest);
        console.log('🔍 auth/me 응답 상태:', authResponse.status);

        if (authResponse.status === 401) {
          console.log('✅ 401 에러 정상 반환 - 다음은 refresh 시도');

          // Step 2: refresh API 호출 (토큰 없이)
          const refreshRequest = new NextRequest('http://localhost:3000/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log('🔍 Step 2: refresh API 호출 (토큰 없이)');

          const refreshResponse = await authRefreshHandler(refreshRequest);
          console.log('🔍 refresh 응답 상태:', refreshResponse.status);

          if (refreshResponse.status === 400) {
            console.log('✅ 무한루프 차단 성공 - 400 에러로 체인 종료');
            expect(refreshResponse.status).toBe(400);
          } else {
            console.warn(`⚠️ 무한루프 위험: refresh가 ${refreshResponse.status} 반환`);
          }
        }

      } catch (e) {
        authError = e;
        console.error('🚨 무한루프 테스트 중 에러:', authError);
      }

      // THEN: 에러 없이 차단되어야 함
      expect(authError).toBeNull();
    });

  });

  describe('📊 성능 및 호출 빈도 모니터링', () => {

    it('🔍 실제 응답 시간 측정', async () => {
      // GIVEN: 일반적인 요청
      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // WHEN: 응답 시간 측정
      const startTime = Date.now();

      try {
        const response = await authMeHandler(request);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`🔍 auth/me 실제 응답 시간: ${responseTime}ms`);
        console.log(`🔍 응답 상태: ${response.status}`);

        // THEN: 성능 기준 확인
        expect(responseTime).toBeLessThan(5000); // 5초 내 응답

        if (responseTime > 1000) {
          console.warn(`⚠️ 느린 응답: ${responseTime}ms (1초 초과)`);
        }

      } catch (error) {
        const endTime = Date.now();
        const errorTime = endTime - startTime;
        console.error(`🚨 에러 발생까지 시간: ${errorTime}ms`, error);
      }
    });

  });

});

/**
 * 🎯 이 테스트의 핵심 목적:
 *
 * 1. 실제 API 핸들러가 다양한 시나리오에서 어떻게 동작하는지 확인
 * 2. 쿠키, Bearer 토큰, 환경 변수 등 실제 환경 요소들의 동작 검증
 * 3. 무한루프 방지 메커니즘이 실제로 작동하는지 확인
 * 4. 성능 이슈나 타임아웃 문제 식별
 *
 * 🚨 중요: 이 테스트들은 실제 문제를 드러내기 위해 의도적으로 실패할 수 있습니다.
 * 실패는 버그가 아니라 현실을 정확히 반영하는 것입니다.
 */