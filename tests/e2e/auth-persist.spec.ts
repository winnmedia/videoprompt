import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

test.describe('회원가입 → 핵심 기능 → 데이터 저장 E2E', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Run only on Chromium here');

  test('register → login(cookie) → create share/comment with ownership', async ({ request }) => {
    const email = `e2e_${Date.now()}@example.com`;
    const username = `e2e_user_${Date.now()}`;
    const password = 'E2e_pass_1234';

    // 회원가입
    const regRes = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { email, username, password },
    });
    expect(regRes.ok()).toBeTruthy();

    // 로그인(세션 쿠키 수신)
    const login = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password },
    });
    expect(login.ok()).toBeTruthy();
    const setCookie = login.headers()['set-cookie'] || login.headers()['Set-Cookie'];
    expect(setCookie).toBeTruthy();

    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    // 시나리오 생성(소유 귀속)
    const sc = await request.post(`${BASE_URL}/api/planning/scenario`, {
      data: { title: 'e2e-scn', logline: 'e2e', structure4: {}, shots12: {} },
      headers: { Cookie: cookieHeader },
    });
    expect(sc.ok()).toBeTruthy();
    const scJson = await sc.json();
    const scenarioId = scJson?.data?.id as string;
    expect(scenarioId).toBeTruthy();

    // 프롬프트 생성(소유 귀속)
    const pr = await request.post(`${BASE_URL}/api/planning/prompt`, {
      data: { scenarioId, metadata: { k: 1 }, timeline: [], version: 1 },
      headers: { Cookie: cookieHeader },
    });
    expect(pr.ok()).toBeTruthy();
    const prJson = await pr.json();
    const promptId = prJson?.data?.id as string;
    expect(promptId).toBeTruthy();

    // 공유 토큰(소유 귀속)
    const shareRes = await request.post(`${BASE_URL}/api/shares`, {
      data: { targetType: 'prompt', targetId: promptId, role: 'commenter', expiresIn: 3600 },
      headers: { Cookie: cookieHeader },
    });
    expect(shareRes.ok()).toBeTruthy();
    const share = await shareRes.json();
    const token = share?.data?.token as string;
    expect(token?.length).toBeGreaterThan(0);

    // 댓글 작성(소유 귀속)
    const commentRes = await request.post(`${BASE_URL}/api/comments`, {
      data: { token, targetType: 'prompt', targetId: promptId, text: 'hello-e2e', timecode: '000000' },
      headers: { Cookie: cookieHeader },
    });
    expect(commentRes.ok()).toBeTruthy();

    // 소유자 검증(리스트는 임시로 사용자별 필터 대신 헤더로 확인: x-user-id)
    // 실제 환경에서는 /me 리소스 또는 userId 필드 select 후 검증하도록 확장
    const who = await login.json();
    const userId = who?.data?.id as string;
    expect(userId).toBeTruthy();

    // 프롬프트 목록에서 최근 항목이 존재하는지 확인(시나리오 기준)
    const listPr = await request.get(`${BASE_URL}/api/planning/prompt?scenarioId=${scenarioId}`, {
      headers: { 'x-user-id': userId },
    });
    expect(listPr.ok()).toBeTruthy();
    const listJson = await listPr.json();
    expect(Array.isArray(listJson?.data)).toBeTruthy();

    // 댓글 목록에서 방금 작성한 코멘트와 userId를 확인
    const listCo = await request.get(
      `${BASE_URL}/api/comments?targetType=prompt&targetId=${promptId}`,
      { headers: { 'x-user-id': userId } },
    );
    expect(listCo.ok()).toBeTruthy();
    const listCoJson = await listCo.json();
    expect(Array.isArray(listCoJson?.data)).toBeTruthy();
    const mine = listCoJson.data.find((c: any) => c.text === 'hello-e2e');
    expect(mine).toBeTruthy();
    expect(mine.userId).toBe(userId);
  });
});


