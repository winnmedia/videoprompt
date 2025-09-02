import { test, expect } from '@playwright/test';

// FRD 기반 사용자 여정(통합 파이프라인)
// 1) 홈 진입 → 헤더/네비 존재 확인
// 2) /api/ai/generate-prompt 호출로 프롬프트 생성(LLM 개입/폴백 포함)
// 3) /api/imagen/preview 호출로 콘티 이미지(실제/구글/폴백SVG) 확보
// 4) /workflow 접근하여 기본 UI 요소 확인

const BASE = process.env.PW_BASE_URL || 'http://localhost:3100';

test.describe('FRD 사용자 여정 - 통합 파이프라인', () => {
  test('프롬프트 생성 → 이미지 프리뷰 → 워크플로우 UI', async ({ page, request }) => {
    // 1) 홈 진입
    await page.goto(BASE);
    await expect(page).toHaveTitle(/VLANET|Video|AI/i);

    // 헤더/네비 존재(안정 셀렉터)
    const nav = page.getByTestId('main-nav');
    await expect(nav).toBeVisible();

    // 2) 프롬프트 생성(API)
    const generatePayload = {
      story: '밤중 옥상 거래 장면',
      scenario: { genre: 'Action-Thriller', tone: ['cinematic'], structure: ['도입','전개','위기','해결'] },
      visual_preferences: { style: ['Cinematic'], mood: ['Tense'], quality: ['HD'] },
      target_audience: '전체',
    };

    const genRes = await request.post('/api/ai/generate-prompt', {
      data: generatePayload,
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(genRes.ok()).toBeTruthy();
    const genJson = await genRes.json();

    const finalPrompt = genJson.final_prompt ?? genJson.data?.final_prompt ?? genJson.message ?? '';
    expect(typeof finalPrompt).toBe('string');
    expect(finalPrompt.length).toBeGreaterThan(10);

    // 3) 이미지 프리뷰(API) — 폴백이라도 반드시 ok=true, imageUrl(string)
    const imagenPayload = {
      prompt: `Storyboard frame: ${generatePayload.story}`,
      aspectRatio: '16:9',
      quality: 'standard',
    };
    const imRes = await request.post('/api/imagen/preview', {
      data: imagenPayload,
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json', 'x-e2e-fast': '1' },
    });
    expect(imRes.ok()).toBeTruthy();
    const imJson = await imRes.json();

    expect(imJson.ok).toBeTruthy();
    expect(['railway', 'google-image-api', 'fallback-svg']).toContain(imJson.provider);
    expect(typeof imJson.imageUrl).toBe('string');
    expect((imJson.imageUrl as string).length).toBeGreaterThan(100);

    // 4) 워크플로우 UI 접근(안내/입력 요소 존재)
    await page.goto(`${BASE}/workflow`);
    await expect(page.getByTestId('workflow-title')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('workflow-story-input')).toBeVisible({ timeout: 15000 });
  });
});


