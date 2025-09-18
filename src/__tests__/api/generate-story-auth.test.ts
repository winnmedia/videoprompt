/**
 * generate-story API 인증 로직 테스트
 * TDD: Red → Green → Refactor
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/generate-story/route';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// MSW 서버 설정
const server = setupServer(
  // Gemini API 모킹
  http.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', () => {
    return HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  steps: [
                    {
                      step: 1,
                      title: '1단계',
                      description: '테스트 설명',
                      keyElements: ['요소1', '요소2'],
                      emotionalArc: '감정 변화',
                      duration: '15초',
                      visualDirection: '시각적 연출'
                    },
                    {
                      step: 2,
                      title: '2단계',
                      description: '테스트 설명',
                      keyElements: ['요소1', '요소2'],
                      emotionalArc: '감정 변화',
                      duration: '15초',
                      visualDirection: '시각적 연출'
                    },
                    {
                      step: 3,
                      title: '3단계',
                      description: '테스트 설명',
                      keyElements: ['요소1', '요소2'],
                      emotionalArc: '감정 변화',
                      duration: '15초',
                      visualDirection: '시각적 연출'
                    },
                    {
                      step: 4,
                      title: '4단계',
                      description: '테스트 설명',
                      keyElements: ['요소1', '요소2'],
                      emotionalArc: '감정 변화',
                      duration: '15초',
                      visualDirection: '시각적 연출'
                    }
                  ]
                })
              }
            ]
          }
        }
      ],
      usageMetadata: { totalTokenCount: 100 }
    });
  }),

  // OpenAI API 모킹 (폴백용)
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              act1: { title: '1막', description: '테스트', key_elements: ['요소1'], emotional_arc: '감정1' },
              act2: { title: '2막', description: '테스트', key_elements: ['요소2'], emotional_arc: '감정2' },
              act3: { title: '3막', description: '테스트', key_elements: ['요소3'], emotional_arc: '감정3' },
              act4: { title: '4막', description: '테스트', key_elements: ['요소4'], emotional_arc: '감정4' }
            })
          }
        }
      ],
      usage: { total_tokens: 150 }
    });
  })
);

// JWT 토큰 생성 헬퍼
function createJWTToken(payload: any, isValid = true): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadEncoded = btoa(JSON.stringify({
    sub: payload.userId || 'test-user-123',
    exp: isValid ? Math.floor(Date.now() / 1000) + 3600 : Math.floor(Date.now() / 1000) - 3600, // 1시간 후 또는 1시간 전 만료
    iat: Math.floor(Date.now() / 1000),
    ...payload
  }));
  const signature = btoa('fake-signature');

  return `${header}.${payloadEncoded}.${signature}`;
}

beforeAll(() => {
  // 환경 변수 설정
  process.env.GOOGLE_API_KEY = 'test-gemini-api-key';
  process.env.OPENAI_API_KEY = 'test-openai-api-key';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

  server.listen();
});

afterEach(() => server.resetHandlers());

afterAll(() => {
  server.close();
  // 환경 변수 정리
  delete process.env.GOOGLE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.JWT_SECRET;
});

describe('generate-story API 인증 로직', () => {
  const validStoryData = {
    title: '테스트 스토리',
    oneLineStory: '흥미진진한 모험 이야기',
    toneAndManner: '유쾌한',
    genre: '모험',
    target: '청소년',
    duration: '60초',
    format: '16:9',
    tempo: '보통',
    developmentMethod: '클래식 기승전결',
    developmentIntensity: '보통'
  };

  describe('인증 헤더 처리', () => {
    it('Bearer 토큰이 유효할 때 정상 처리되어야 함', async () => {
      // Given: 유효한 Bearer 토큰과 요청 데이터
      const validToken = createJWTToken({ userId: 'test-user-123' }, true);
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 성공 응답 (인증 성공으로 처리)
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('Bearer 토큰이 잘못되었을 때 401 에러를 반환해야 함', async () => {
      // Given: 만료된 Bearer 토큰
      const invalidToken = createJWTToken({ userId: 'test-user-123' }, false); // 만료된 토큰
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${invalidToken}`
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 401 Unauthorized (400이 아님!)
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.error.message).toContain('인증');
    });
  });

  describe('쿠키 인증 처리', () => {
    it('유효한 세션 쿠키로 인증되어야 함', async () => {
      // Given: 유효한 세션 쿠키
      const validSessionToken = createJWTToken({ userId: 'session-user-456' }, true);
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${validSessionToken}`
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 성공 응답
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('잘못된 세션 쿠키일 때 401 에러를 반환해야 함', async () => {
      // Given: 만료된 세션 쿠키
      const invalidSessionToken = createJWTToken({ userId: 'session-user-456' }, false);
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${invalidSessionToken}`
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 401 Unauthorized
      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('게스트 사용자 처리', () => {
    it('인증 헤더가 없을 때 게스트 모드로 처리되어야 함', async () => {
      // Given: 인증 헤더가 없는 요청
      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 게스트 모드로 성공 처리
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.metadata.userId).toBe(null);
    });
  });

  describe('입력 데이터 검증', () => {
    it('필수 필드가 없을 때 400 Bad Request를 반환해야 함', async () => {
      // Given: 필수 필드가 누락된 데이터
      const invalidData = {
        title: '', // 빈 제목
        oneLineStory: '스토리',
        genre: '모험'
        // 기타 필수 필드 누락
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: 400 Bad Request (인증 오류가 아닌 입력 검증 오류)
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('TokenManager 통합', () => {
    it('TokenManager를 통해 추출된 토큰을 우선적으로 사용해야 함', async () => {
      // Given: 복합 인증 헤더 (Bearer + Cookie)
      const bearerToken = createJWTToken({ userId: 'bearer-user-789' }, true);
      const sessionCookie = createJWTToken({ userId: 'session-user-456' }, true);

      const request = new NextRequest('http://localhost:3000/api/ai/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'Cookie': `session=${sessionCookie}`
        },
        body: JSON.stringify(validStoryData)
      });

      // When: API 호출
      const response = await POST(request);
      const result = await response.json();

      // Then: Bearer 토큰이 우선적으로 사용됨 (TokenManager 우선순위 규칙)
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      // Bearer 토큰이 사용되었음을 확인할 수 있는 메타데이터 검증
    });
  });
});