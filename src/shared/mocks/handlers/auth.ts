/**
 * 인증 API 핸들러
 * $300 사건 방지를 위한 /api/auth/me 특별 처리 포함
 */

import { http, HttpResponse } from 'msw';
import { createMockUser, createMockAuthToken, createMockError } from '../data/factories';
import { withCostSafety } from './cost-safety';

// 인증 상태 저장소
const authStore = new Map<string, any>();

export const authHandlers = [
  // 로그인
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json() as any;

    if (!email || !password) {
      return HttpResponse.json(
        createMockError('이메일과 비밀번호를 입력해주세요', 400),
        { status: 400 }
      );
    }

    // 테스트 계정 검증
    if (email === 'test@example.com' && password === 'password123') {
      const user = createMockUser('test-user');
      const token = createMockAuthToken('test-auth');

      // 인증 상태 저장
      authStore.set('current-user', user);
      authStore.set('access-token', token.access_token);

      return HttpResponse.json({
        ...token,
        user,
      });
    }

    return HttpResponse.json(
      createMockError('잘못된 이메일 또는 비밀번호입니다', 401),
      { status: 401 }
    );
  }),

  // 로그아웃
  http.post('/api/auth/logout', () => {
    authStore.clear();
    return HttpResponse.json({ message: '로그아웃되었습니다' });
  }),

  // 회원가입
  http.post('/api/auth/register', async ({ request }) => {
    const { email, password, name } = await request.json() as any;

    if (!email || !password || !name) {
      return HttpResponse.json(
        createMockError('모든 필드를 입력해주세요', 400),
        { status: 400 }
      );
    }

    const user = createMockUser(email.split('@')[0]);
    const token = createMockAuthToken(email.split('@')[0]);

    // 인증 상태 저장
    authStore.set('current-user', user);
    authStore.set('access-token', token.access_token);

    return HttpResponse.json({
      ...token,
      user: { ...user, email, name },
    });
  }),

  // 현재 사용자 정보 조회 - $300 사건 방지 특별 처리
  http.get('/api/auth/me', withCostSafety('/api/auth/me', ({ request }: any) => {
    const authHeader = request.headers.get('authorization');
    const token = authStore.get('access-token');

    // 토큰 검증
    if (!authHeader || !authHeader.startsWith('Bearer ') || !token) {
      return HttpResponse.json(
        createMockError('인증이 필요합니다', 401),
        { status: 401 }
      );
    }

    const providedToken = authHeader.replace('Bearer ', '');
    if (providedToken !== token) {
      return HttpResponse.json(
        createMockError('유효하지 않은 토큰입니다', 401),
        { status: 401 }
      );
    }

    const user = authStore.get('current-user');
    if (!user) {
      return HttpResponse.json(
        createMockError('사용자를 찾을 수 없습니다', 404),
        { status: 404 }
      );
    }

    // $300 사건 방지: 캐시된 응답 반환
    console.log('[MSW] /api/auth/me 호출 - 캐시된 사용자 정보 반환');
    return HttpResponse.json({ user });
  })),

  // 토큰 갱신
  http.post('/api/auth/refresh', async ({ request }) => {
    const { refresh_token } = await request.json() as any;

    if (!refresh_token) {
      return HttpResponse.json(
        createMockError('리프레시 토큰이 필요합니다', 400),
        { status: 400 }
      );
    }

    // 새 토큰 발급
    const newToken = createMockAuthToken('refreshed-auth');
    authStore.set('access-token', newToken.access_token);

    return HttpResponse.json({
      access_token: newToken.access_token,
      expires_in: newToken.expires_in,
      token_type: newToken.token_type,
    });
  }),

  // 비밀번호 재설정 요청
  http.post('/api/auth/forgot-password', async ({ request }) => {
    const { email } = await request.json() as any;

    if (!email) {
      return HttpResponse.json(
        createMockError('이메일을 입력해주세요', 400),
        { status: 400 }
      );
    }

    return HttpResponse.json({
      message: '비밀번호 재설정 링크가 이메일로 전송되었습니다',
    });
  }),

  // 이메일 인증
  http.post('/api/auth/verify-email', async ({ request }) => {
    const { token } = await request.json() as any;

    if (!token) {
      return HttpResponse.json(
        createMockError('인증 토큰이 필요합니다', 400),
        { status: 400 }
      );
    }

    return HttpResponse.json({
      message: '이메일이 성공적으로 인증되었습니다',
    });
  }),
];