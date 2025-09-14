/**
 * Gemini 2.0 Flash Client 단위 테스트
 *
 * 테스트 범위:
 * - API 호출 성공/실패 처리
 * - Rate limiting 동작
 * - 에러 분류 및 재시도 로직
 * - JSON 파싱 및 응답 검증
 * - 토큰 사용량 계산
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient, GeminiConfig, type GeminiRequest, type GeminiResponse } from '@/shared/lib/gemini-client';

// fetch 모킹을 위한 타입
interface MockFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

describe('Gemini 2.0 Flash Client 단위 테스트', () => {
  let client: GeminiClient;
  let mockFetch: vi.MockedFunction<MockFetch>;

  beforeEach(() => {
    // fetch 모킹
    mockFetch = vi.fn() as vi.MockedFunction<MockFetch>;
    global.fetch = mockFetch;

    // 클라이언트 설정
    const config: GeminiConfig = {
      apiKey: 'AIza-test-key-1234567890',
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      maxOutputTokens: 8192
    };

    client = new GeminiClient(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('초기화 및 설정 검증', () => {
    it('유효한 API 키로 클라이언트를 생성할 수 있어야 한다', () => {
      expect(client).toBeInstanceOf(GeminiClient);
      expect(client.getStatus().model).toBe('gemini-2.0-flash-exp');
      expect(client.getStatus().maxTokens).toBe(8192);
    });

    it('잘못된 API 키로 클라이언트 생성 시 에러가 발생해야 한다', () => {
      expect(() => {
        new GeminiClient({ apiKey: '', model: 'gemini-2.0-flash-exp' });
      }).toThrow('Gemini API 키가 필요합니다');

      expect(() => {
        new GeminiClient({ apiKey: 'invalid-key', model: 'gemini-2.0-flash-exp' });
      }).toThrow('올바른 Gemini API 키 형식이 아닙니다');
    });

    it('기본 설정 값이 올바르게 적용되어야 한다', () => {
      const config: GeminiConfig = {
        apiKey: 'AIza-test-key-1234567890',
        model: 'gemini-2.0-flash-exp'
      };

      const defaultClient = new GeminiClient(config);
      const status = defaultClient.getStatus();

      expect(status.maxTokens).toBe(8192);
    });
  });

  describe('API 호출 성공 케이스', () => {
    it('정상적인 텍스트 생성 요청이 성공해야 한다', async () => {
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: '테스트 응답입니다.' }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [
          {
            parts: [
              { text: '테스트 요청입니다.' }
            ]
          }
        ]
      };

      const result = await client.generateContent(request);
      expect(result).toBe('테스트 응답입니다.');

      // API 호출 검증
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('JSON 응답을 올바르게 파싱할 수 있어야 한다', async () => {
      const jsonContent = '{"title": "테스트", "steps": [1, 2, 3]}';
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: jsonContent }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [
          {
            parts: [
              { text: 'JSON을 생성해주세요.' }
            ]
          }
        ]
      };

      const result = await client.generateJSON(request);
      expect(result).toEqual({
        title: '테스트',
        steps: [1, 2, 3]
      });
    });

    it('코드 블록이 포함된 JSON 응답을 올바르게 파싱해야 한다', async () => {
      const jsonWithCodeBlock = '```json\n{"test": true}\n```';
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: jsonWithCodeBlock }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [
          {
            parts: [
              { text: 'JSON을 생성해주세요.' }
            ]
          }
        ]
      };

      const result = await client.generateJSON(request);
      expect(result).toEqual({ test: true });
    });
  });

  describe('에러 처리 및 재시도', () => {
    it('429 (Rate Limit) 에러 시 재시도해야 한다', async () => {
      // 첫 번째 호출: 429 에러
      // 두 번째 호출: 성공
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: () => Promise.resolve('Rate limit exceeded')
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '재시도 성공!' }] },
                finishReason: 'STOP'
              }
            ]
          })
        } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      const result = await client.generateContent(request, { maxRetries: 2 });
      expect(result).toBe('재시도 성공!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('500 (Server Error) 에러 시 재시도해야 한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Server error')
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '서버 복구 후 성공!' }] },
                finishReason: 'STOP'
              }
            ]
          })
        } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      const result = await client.generateContent(request, { maxRetries: 2 });
      expect(result).toBe('서버 복구 후 성공!');
    });

    it('400 (Bad Request) 에러 시 재시도하지 않아야 한다', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request')
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      await expect(client.generateContent(request, { maxRetries: 3 }))
        .rejects
        .toThrow('API call failed: 400 Bad Request');

      // 400 에러는 재시도하지 않으므로 1번만 호출
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('모든 재시도가 실패하면 마지막 에러를 던져야 한다', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('Service unavailable')
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      await expect(client.generateContent(request, { maxRetries: 2 }))
        .rejects
        .toThrow('API call failed: 503 Service Unavailable');

      // maxRetries = 2이므로 총 2번 호출
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rate Limiting', () => {
    it('Rate limit 체크가 정상 동작해야 한다', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          candidates: [
            {
              content: { parts: [{ text: 'success' }] },
              finishReason: 'STOP'
            }
          ]
        })
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      // 첫 번째 요청은 성공해야 함
      const result1 = await client.generateContent(request, { rateLimitKey: 'test' });
      expect(result1).toBe('success');

      // Rate limit 상태 확인
      const status = client.getStatus();
      expect(status.rateLimits).toHaveProperty('test');
    });
  });

  describe('안전성 필터링', () => {
    it('안전성 필터에 차단된 콘텐츠는 에러를 발생시켜야 한다', async () => {
      const blockedResponse: GeminiResponse = {
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              probability: 'HIGH'
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(blockedResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'potentially unsafe content' }] }]
      };

      await expect(client.generateContent(request))
        .rejects
        .toThrow('Content was blocked by safety filters');
    });
  });

  describe('JSON 파싱 오류 처리', () => {
    it('잘못된 JSON 응답은 파싱 에러를 발생시켜야 한다', async () => {
      const invalidJson = '{ invalid json content }';
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: invalidJson }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'Generate JSON' }] }]
      };

      await expect(client.generateJSON(request))
        .rejects
        .toThrow('Failed to parse JSON response from Gemini');
    });

    it('빈 응답은 에러를 발생시켜야 한다', async () => {
      const emptyResponse: GeminiResponse = {
        candidates: []
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(emptyResponse)
      } as Response);

      const request: GeminiRequest = {
        contents: [{ parts: [{ text: 'test' }] }]
      };

      await expect(client.generateContent(request))
        .rejects
        .toThrow('Empty response from Gemini API');
    });
  });
});