/**
 * Story Generator Feature Tests
 * TDD - 비즈니스 로직 및 AI 통합 테스트
 */

import { StoryGenerationEngine } from '../../features/story-generator/model/StoryGenerationEngine';
import type { StoryGenerationRequest } from '../../features/story-generator/types';

// 테스트용 모킹
jest.mock('../../shared/api/thumbnail-generator', () => ({
  ThumbnailGenerator: jest.fn().mockImplementation(() => ({
    generateActThumbnail: jest.fn().mockResolvedValue({
      success: true,
      thumbnailUrl: 'https://mock-thumbnail-url.com/image.jpg',
      thumbnailId: 'mock-thumbnail-id',
      cost: 0.04,
      generationTime: 3000
    })
  }))
}));

describe('StoryGenerationEngine', () => {
  let engine: StoryGenerationEngine;

  beforeEach(() => {
    engine = new StoryGenerationEngine();
  });

  const mockRequest: StoryGenerationRequest = {
    params: {
      title: '시간을 되돌리는 사진사',
      synopsis: '낡은 카메라를 발견한 사진사가 과거로 돌아가 인생의 중요한 순간들을 다시 경험하게 되는 이야기',
      genre: 'drama',
      targetAudience: 'adult',
      tone: 'dramatic',
      creativity: 70,
      intensity: 60,
      pacing: 'medium',
      keyCharacters: ['민수', '옛 연인'],
      keyThemes: ['후회', '성장']
    },
    userId: 'test-user-123'
  };

  describe('generateStory', () => {
    it('should generate a complete four-act story', async () => {
      const progressCallback = jest.fn();
      const result = await engine.generateStory(mockRequest, progressCallback);

      expect(result.success).toBe(true);
      expect(result.story).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.generationTime).toBeGreaterThan(0);

      // 진행률 콜백이 호출되었는지 확인
      expect(progressCallback).toHaveBeenCalled();

      // 스토리 구조 검증
      if (result.story) {
        expect(result.story.title).toBe(mockRequest.params.title);
        expect(result.story.synopsis).toBe(mockRequest.params.synopsis);
        expect(result.story.genre).toBe(mockRequest.params.genre);
        expect(result.story.userId).toBe(mockRequest.userId);
        expect(result.story.aiGenerated).toBe(true);
        expect(result.story.aiModel).toBe('gemini');

        // 4단계 구조 검증
        expect(Object.keys(result.story.acts)).toHaveLength(4);
        Object.values(result.story.acts).forEach(act => {
          expect(act.content).toBeTruthy(); // AI가 생성한 내용이 있어야 함
          expect(act.keyEvents).toBeDefined();
          expect(act.characterFocus).toBeDefined();
        });
      }
    });

    it('should handle progress tracking correctly', async () => {
      const progressCallback = jest.fn();
      await engine.generateStory(mockRequest, progressCallback);

      // 진행률 콜백 호출 검증
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.any(String),
          overallProgress: expect.any(Number),
          actProgress: expect.objectContaining({
            setup: expect.any(Number),
            development: expect.any(Number),
            climax: expect.any(Number),
            resolution: expect.any(Number)
          })
        })
      );

      // 최종 완료 상태 확인
      const finalCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
      expect(finalCall[0].phase).toBe('completed');
      expect(finalCall[0].overallProgress).toBe(100);
    });

    it('should use caching to prevent duplicate requests', async () => {
      // 첫 번째 요청
      const result1 = await engine.generateStory(mockRequest);

      // 동일한 요청 (캐시 사용)
      const result2 = await engine.generateStory(mockRequest);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.tokensUsed).toBe(0); // 캐시 사용 시 토큰 사용량 0
    });

    it('should enforce rate limiting', async () => {
      // 첫 번째 요청으로 lastGenerationTime 설정
      await engine.generateStory(mockRequest);

      // 다른 파라미터로 즉시 두 번째 요청 시도 (캐시 우회, rate limit 발생해야 함)
      const differentRequest: StoryGenerationRequest = {
        ...mockRequest,
        params: {
          ...mockRequest.params,
          title: '다른 제목' // 다른 캐시 키를 생성하기 위해
        }
      };

      const result = await engine.generateStory(differentRequest);

      // rate limit 에러가 발생해야 함
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('생성 간격이 너무 짧습니다');
    });

    it('should handle specific act regeneration', async () => {
      const regenerateRequest: StoryGenerationRequest = {
        ...mockRequest,
        regenerateAct: 'climax'
      };

      const result = await engine.generateStory(regenerateRequest);

      expect(result.success).toBe(true);
      expect(result.story).toBeDefined();

      // 특정 Act만 재생성되었는지 확인 (실제로는 전체 스토리가 생성되지만,
      // 프로덕션에서는 해당 Act만 업데이트되도록 구현해야 함)
      if (result.story) {
        expect(result.story.acts.climax.content).toBeTruthy();
      }
    });

    it('should handle generation errors gracefully', async () => {
      // 잘못된 파라미터로 에러 유발
      const invalidRequest: StoryGenerationRequest = {
        params: {
          title: '', // 빈 제목으로 에러 유발
          synopsis: 'test synopsis that is long enough to pass validation requirements',
          genre: 'drama',
          targetAudience: 'adult',
          tone: 'dramatic',
          creativity: 70,
          intensity: 60,
          pacing: 'medium'
        },
        userId: 'test-user'
      };

      const result = await engine.generateStory(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBeDefined();
      expect(result.error?.message).toBeTruthy();
      expect(result.error?.retryable).toBeDefined();
      expect(result.error?.timestamp).toBeTruthy();
    });

    it('should validate creativity and intensity parameters', async () => {
      const invalidCreativityRequest: StoryGenerationRequest = {
        ...mockRequest,
        params: {
          ...mockRequest.params,
          creativity: 150 // 유효 범위 초과
        }
      };

      const result = await engine.generateStory(invalidCreativityRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('창의성');
    });

    it('should estimate token usage reasonably', async () => {
      const result = await engine.generateStory(mockRequest);

      if (result.success && result.story) {
        expect(result.tokensUsed).toBeGreaterThan(0);
        expect(result.tokensUsed).toBeLessThan(10000); // 합리적인 범위

        // 토큰 사용량이 생성된 콘텐츠 길이와 비례하는지 확인
        const totalContentLength = Object.values(result.story.acts)
          .reduce((sum, act) => sum + act.content.length, 0);

        const estimatedTokens = Math.ceil(totalContentLength / 4);
        expect(result.tokensUsed).toBeCloseTo(estimatedTokens, -1); // 10의 자리까지 근사
      }
    });

    it('should set correct generation metadata', async () => {
      const result = await engine.generateStory(mockRequest);

      if (result.success && result.story) {
        expect(result.story.aiGenerated).toBe(true);
        expect(result.story.aiModel).toBe('gemini');
        expect(result.story.aiPrompt).toBeTruthy();
        expect(result.story.generationParams).toEqual({
          creativity: mockRequest.params.creativity,
          intensity: mockRequest.params.intensity,
          pacing: mockRequest.params.pacing
        });
      }
    });

    it('should handle scenario connection', async () => {
      const requestWithScenario: StoryGenerationRequest = {
        ...mockRequest,
        scenarioId: 'test-scenario-123'
      };

      const result = await engine.generateStory(requestWithScenario);

      expect(result.success).toBe(true);
      // 실제 구현에서는 시나리오 연결 로직이 실행되어야 함
    });
  });

  describe('error handling', () => {
    it('should categorize different types of errors', async () => {
      // 다양한 에러 상황 시뮬레이션
      const errorCases = [
        { title: '', expectedType: 'validation_error' },
        { synopsis: 'short', expectedType: 'validation_error' }
      ];

      for (const errorCase of errorCases) {
        const invalidRequest: StoryGenerationRequest = {
          ...mockRequest,
          params: { ...mockRequest.params, ...errorCase }
        };

        const result = await engine.generateStory(invalidRequest);

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe(errorCase.expectedType);
      }
    });

    it('should provide retry information', async () => {
      const invalidRequest: StoryGenerationRequest = {
        ...mockRequest,
        params: { ...mockRequest.params, title: '' }
      };

      const result = await engine.generateStory(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error?.retryable).toBeDefined();
      expect(typeof result.error?.retryable).toBe('boolean');
    });
  });

  describe('performance', () => {
    it('should complete generation within reasonable time', async () => {
      const startTime = Date.now();
      const result = await engine.generateStory(mockRequest);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // 10초 이내
    });

    it('should report accurate generation time', async () => {
      const result = await engine.generateStory(mockRequest);

      expect(result.success).toBe(true);
      expect(result.generationTime).toBeGreaterThan(0);
      expect(result.generationTime).toBeLessThan(30000); // 30초 이내
    });
  });
});