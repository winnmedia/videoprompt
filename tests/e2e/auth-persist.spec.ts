import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:3100';

test.describe('회원가입 → 핵심 기능 → 데이터 저장 E2E', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Run only on Chromium here');

  test('register user → create share token → post comment → list comment', async ({ page, request }) => {
    // 회원가입
    const email = `e2e_${Date.now()}@example.com`;
    const username = `e2e_user_${Date.now()}`;
    const password = 'E2e_pass_1234';

    const res = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { email, username, password },
    });
    expect(res.ok()).toBeTruthy();
    const reg = await res.json();
    expect(reg?.ok).toBeTruthy();
    expect(reg?.data?.email).toBe(email);

    // 공유 토큰 발급 (프롬프트/비디오 등 핵심 리소스 가정: targetId='e2e-video')
    const shareRes = await request.post(`${BASE_URL}/api/shares`, {
      data: { targetType: 'video', targetId: 'e2e-video', role: 'commenter', expiresIn: 3600 },
    });
    expect(shareRes.ok()).toBeTruthy();
    const share = await shareRes.json();
    expect(share?.ok).toBeTruthy();
    const token = share?.data?.token as string;
    expect(token?.length).toBeGreaterThan(0);

    // 댓글 작성
    const commentRes = await request.post(`${BASE_URL}/api/comments`, {
      data: {
        token,
        targetType: 'video',
        targetId: 'e2e-video',
        text: 'hello-e2e',
        timecode: '000000',
      },
    });
    expect(commentRes.ok()).toBeTruthy();
    const created = await commentRes.json();
    expect(created?.ok).toBeTruthy();

    // 댓글 조회
    const listRes = await request.get(
      `${BASE_URL}/api/comments?targetType=video&targetId=e2e-video`,
    );
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list?.ok).toBeTruthy();
    expect(Array.isArray(list?.data)).toBeTruthy();
    expect(list.data.find((c: any) => c.text === 'hello-e2e')).toBeTruthy();
  });
});


