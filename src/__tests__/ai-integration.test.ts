import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIServiceManager, createAIServiceManager } from '@/lib/ai-client';
import { createMockResponse, createMockError } from '@/test/setup';

describe('AI Integration Tests', () => {
  let aiManager: AIServiceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables directly
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key';
    
    aiManager = createAIServiceManager();
  });

  describe('AIServiceManager', () => {
    it('should be created with configuration', () => {
      expect(aiManager).toBeInstanceOf(AIServiceManager);
      expect(aiManager.isServiceAvailable('openai')).toBe(true);
      expect(aiManager.isServiceAvailable('gemini')).toBe(true);
    });

    it('should return available services', () => {
      const services = aiManager.getAvailableServices();
      expect(services).toContain('openai');
      expect(services).toContain('gemini');
    });
  });

  describe('OpenAI Integration', () => {
    it('should generate scene prompt successfully', async () => {
      // Given: OpenAI API가 정상 응답
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              enhancedPrompt: '따뜻한 부엌에서 아이가 쿠키를 만드는 장면',
              suggestions: ['부엌', '쿠키', '아이'],
              metadata: { duration: 30, theme: '따뜻함' }
            })
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce(createMockResponse(mockResponse));

      // When: 장면 생성 요청
      const result = await aiManager.generateScenePrompt({
        prompt: '아이가 쿠키를 만드는 장면',
        theme: '따뜻함',
        style: '자연스러운',
        aspectRatio: '16:9',
        duration: 30
      });

      // Then: 성공적인 응답
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.enhancedPrompt).toContain('쿠키');
    });

    it('should handle OpenAI API errors', async () => {
      // Given: OpenAI API 오류
      (global.fetch as any).mockResolvedValueOnce(createMockError('Rate limit exceeded', 429));

      // When: 오류 상황에서 장면 생성 시도
      const result = await aiManager.generateScenePrompt({
        prompt: '테스트 장면'
      });

      // Then: 오류 처리
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Gemini Integration', () => {
    it('should generate scene prompt using Gemini', async () => {
      // Given: Gemini API가 정상 응답
      const mockResponse = {
        ok: true,
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                enhancedPrompt: '맑은 바다에서 아이가 수영하는 장면',
                suggestions: ['바다', '수영', '아이'],
                metadata: { duration: 45, theme: '자연' }
              })
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce(createMockResponse(mockResponse));

      // When: Gemini로 장면 생성 요청
      const result = await aiManager.generateScenePrompt({
        prompt: '바다에서 수영하는 아이',
        theme: '자연',
        style: '밝은',
        aspectRatio: '16:9',
        duration: 45
      });

      // Then: 성공적인 응답
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.enhancedPrompt).toContain('바다');
    });

    it('should handle Gemini API errors', async () => {
      // Given: Gemini API 오류
      (global.fetch as any).mockResolvedValueOnce(createMockError('Internal server error', 500));

      // When: 오류 상황에서 장면 생성 시도
      const result = await aiManager.generateScenePrompt({
        prompt: '테스트 장면',
        preferredService: 'gemini'
      });

      // Then: 오류 처리
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to Gemini when OpenAI fails', async () => {
      // Given: OpenAI 실패, Gemini 성공
      (global.fetch as any)
        .mockResolvedValueOnce(createMockError('Rate limit exceeded', 429))
        .mockResolvedValueOnce(createMockResponse({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  enhancedPrompt: 'Gemini fallback 응답',
                  suggestions: ['fallback'],
                  metadata: {}
                })
              }]
            }
          }]
        }));

      // When: OpenAI 실패 후 Gemini fallback
      const result = await aiManager.generateScenePrompt({
        prompt: 'fallback 테스트'
      });

      // Then: Gemini fallback 성공
      expect(result.success).toBe(true);
      expect(result.data?.enhancedPrompt).toContain('Gemini fallback');
    });

    it('should fallback to OpenAI when Gemini fails', async () => {
      // Given: Gemini 실패, OpenAI 성공
      (global.fetch as any)
        .mockResolvedValueOnce(createMockError('Internal server error', 500))
        .mockResolvedValueOnce(createMockResponse({
          choices: [{
            message: {
              content: JSON.stringify({
                enhancedPrompt: 'OpenAI fallback 응답',
                suggestions: ['fallback'],
                metadata: {}
              })
            }
          }]
        }));

      // When: Gemini 실패 후 OpenAI fallback
      const result = await aiManager.generateScenePrompt({
        prompt: 'fallback 테스트',
        preferredService: 'gemini'
      });

      // Then: OpenAI fallback 성공
      expect(result.success).toBe(true);
      expect(result.data?.enhancedPrompt).toContain('OpenAI fallback');
    });
  });

  describe('Prompt Enhancement', () => {
    it('should enhance existing prompts', async () => {
      // Given: 프롬프트 개선 요청
      const existingPrompt = '아이가 쿠키를 만듦';
      const feedback = '더 구체적으로 만들어주세요';

      (global.fetch as any).mockResolvedValueOnce(createMockResponse({
        choices: [{
          message: {
            content: '아이가 부엌에서 쿠키 반죽을 만드는 구체적인 장면'
          }
        }]
      }));

      // When: 프롬프트 개선
      const result = await aiManager.enhancePrompt(existingPrompt, feedback);

      // Then: 개선된 프롬프트 반환
      expect(result.success).toBe(true);
      expect(result.data?.enhancedPrompt).toContain('부엌');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Given: 네트워크 오류
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // When: 네트워크 오류 상황에서 요청
      const result = await aiManager.generateScenePrompt({
        prompt: '네트워크 테스트'
      });

      // Then: 적절한 오류 처리
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid JSON responses', async () => {
      // Given: 잘못된 JSON 응답
      (global.fetch as any).mockResolvedValueOnce(createMockResponse({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      }));

      // When: 잘못된 JSON 처리
      const result = await aiManager.generateScenePrompt({
        prompt: 'JSON 테스트'
      });

      // Then: 텍스트로 처리
      expect(result.success).toBe(true);
      expect(result.data?.enhancedPrompt).toBe('Invalid JSON response');
    });
  });
});
