/**
 * generate-story API 통합 테스트
 * 실제 API 엔드포인트 테스트 (배열 -> 문자열 변환 포함)
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/generate-story/route';
import { vi } from 'vitest';

// Mock 환경변수 설정
const mockEnv = {
  GOOGLE_GEMINI_API_KEY: 'test_gemini_key',
  OPENAI_API_KEY: 'test_openai_key'
};

// Gemini API Mock 설정
global.fetch = vi.fn();

// Supabase Auth Mock
vi.mock('@/shared/lib/supabase-auth', () => ({
  requireSupabaseAuthentication: vi.fn().mockResolvedValue({
    type: 'guest',
    message: 'Guest access allowed'
  }),
  isAuthenticated: vi.fn().mockReturnValue(false),
  isGuest: vi.fn().mockReturnValue(true),
}));

describe('generate-story API 통합 테스트', () => {
  beforeEach(() => {
    // 환경변수 설정
    Object.assign(process.env, mockEnv);

    // fetch mock 초기화
    vi.clearAllMocks();
  });

  describe('toneAndManner 배열 입력 처리', () => {
    it('배열 형태 toneAndManner를 받아서 API 호출에 성공해야 한다', async () => {
      // Gemini API 성공 응답 Mock
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  steps: [
                    {
                      step: 1,
                      title: '도입부',
                      description: '매력적인 시작',
                      keyElements: ['hook', 'character'],
                      emotionalArc: '호기심 유발',
                      duration: '15초',
                      visualDirection: '클로즈업'
                    },
                    {
                      step: 2,
                      title: '전개부',
                      description: '갈등 상황',
                      keyElements: ['conflict', 'tension'],
                      emotionalArc: '긴장감 상승',
                      duration: '20초',
                      visualDirection: '와이드 샷'
                    },
                    {
                      step: 3,
                      title: '절정부',
                      description: '클라이맥스',
                      keyElements: ['climax', 'resolution'],
                      emotionalArc: '감정 폭발',
                      duration: '15초',
                      visualDirection: '다이나믹 컷'
                    },
                    {
                      step: 4,
                      title: '결말부',
                      description: '마무리',
                      keyElements: ['conclusion', 'message'],
                      emotionalArc: '만족감',
                      duration: '10초',
                      visualDirection: '페이드 아웃'
                    }
                  ]
                })
              }]
            }
          }],
          usageMetadata: { inputTokens: 100, outputTokens: 200 }
        })
      });

      // 프론트엔드에서 보내는 형태의 요청 (toneAndManner가 배열)
      const requestBody = {
        title: '테스트 영상',
        oneLineStory: '재미있는 이야기',
        toneAndManner: ['밝은', '활기찬', '유쾌한'], // 배열 형태
        genre: '코미디',
        target: '20-30대',
        duration: '60초',
        format: '16:9',
        tempo: '빠름',
        developmentMethod: '클래식 기승전결',
        developmentIntensity: '강함'
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const responseData = await response.json();

      // 응답 검증
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.data.steps).toHaveLength(4);
      expect(responseData.data.metadata.provider).toBe('gemini');

      // Gemini API 호출 시 toneAndManner가 문자열로 전송되었는지 확인
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('밝은, 활기찬, 유쾌한') // 배열이 문자열로 변환됨
        })
      );
    });

    it('문자열 형태 toneAndManner도 정상 처리해야 한다', async () => {
      // Gemini API 성공 응답 Mock (동일)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  steps: [
                    { step: 1, title: '1단계', description: '내용1', keyElements: [], emotionalArc: '감정1' },
                    { step: 2, title: '2단계', description: '내용2', keyElements: [], emotionalArc: '감정2' },
                    { step: 3, title: '3단계', description: '내용3', keyElements: [], emotionalArc: '감정3' },
                    { step: 4, title: '4단계', description: '내용4', keyElements: [], emotionalArc: '감정4' }
                  ]
                })
              }]
            }
          }],
          usageMetadata: {}
        })
      });

      const requestBody = {
        title: '테스트 영상',
        oneLineStory: '재미있는 이야기',
        toneAndManner: '밝은, 활기찬', // 이미 문자열 형태
        genre: '코미디',
        target: '20-30대'
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });

    it('잘못된 toneAndManner 형태(빈 배열)도 안전하게 처리해야 한다', async () => {
      // Gemini API 성공 응답 Mock
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  steps: [
                    { step: 1, title: '1단계', description: '내용', keyElements: [], emotionalArc: '감정' },
                    { step: 2, title: '2단계', description: '내용', keyElements: [], emotionalArc: '감정' },
                    { step: 3, title: '3단계', description: '내용', keyElements: [], emotionalArc: '감정' },
                    { step: 4, title: '4단계', description: '내용', keyElements: [], emotionalArc: '감정' }
                  ]
                })
              }]
            }
          }],
          usageMetadata: {}
        })
      });

      const requestBody = {
        title: '테스트 영상',
        oneLineStory: '재미있는 이야기',
        toneAndManner: [], // 빈 배열
        genre: '코미디',
        target: '20-30대'
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      // API 호출 시 기본값 '일반적'이 사용되었는지 확인
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          body: expect.stringContaining('일반적')
        })
      );
    });
  });

  describe('400 에러 방지 검증', () => {
    it('기존 문제 상황(배열 입력)에서 400 에러가 발생하지 않아야 한다', async () => {
      // Gemini API 성공 응답
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ steps: Array(4).fill({ step: 1, title: 'test', description: 'test', keyElements: [], emotionalArc: 'test' }) }) }] } }],
          usageMetadata: {}
        })
      });

      // 문제가 되었던 요청 형태
      const problematicRequest = {
        title: '테스트',
        oneLineStory: '테스트 스토리',
        toneAndManner: ['밝은', '유쾌한'], // 이전에 400 에러를 발생시켰던 배열 형태
        genre: '코미디',
        target: '일반인'
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        body: JSON.stringify(problematicRequest),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);

      // 이제 400 에러가 아닌 200 성공 응답이어야 함
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(400);
    });
  });
});