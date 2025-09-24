/**
 * 시나리오 생성 비즈니스 로직 테스트
 * TDD 구현: Red → Green → Refactor
 */

import { ScenarioService } from '../../features/scenario.feature';
import type { ScenarioGenerationRequest } from '../../entities/scenario';

// Gemini 클라이언트 모킹
jest.mock('../../shared/lib/gemini-client', () => ({
  generateScenario: jest.fn(),
}));

import { generateScenario } from '../../shared/lib/gemini-client';

const mockGenerateScenario = generateScenario as jest.MockedFunction<typeof generateScenario>;

// 전역 mockGeminiResponse 정의
const mockGeminiResponse = {
  scenario: {
    title: '꿈을 찾는 소녀',
    content: '한국의 작은 시골 마을에 살고 있는 17세 소녀...',
    summary: '시골 소녀가 연기자의 꿈을 포기하지 않고 성장하는 이야기',
    structure: 'traditional' as const,
    estimatedDuration: 15,
  },
  quality: {
    score: 85,
    feedback: ['캐릭터의 내적 갈등이 잘 표현됨', '현실적이면서도 희망적인 결말'],
  },
  metadata: {
    model: 'gemini-1.5-pro',
    tokens: 650,
    cost: 0.08,
    generatedAt: '2024-01-01T00:00:00.000Z',
  },
};

describe('ScenarioService', () => {
  const validRequest: ScenarioGenerationRequest = {
    title: '테스트 시나리오',
    content: '이것은 50자 이상의 유효한 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
    genre: 'drama',
    style: 'realistic',
    target: 'general',
    structure: 'traditional',
    intensity: 'medium',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateScenario', () => {


    it('유효한 요청으로 시나리오를 생성해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.scenario).toBeDefined();
      expect(result.scenario.title).toBe('꿈을 찾는 소녀');
      expect(result.scenario.content).toContain('한국의 작은 시골 마을');
      expect(result.scenario.status).toBe('completed');
      expect(result.scenario.userId).toBe('test-user');
      expect(result.scenario.metadata.genre).toBe('drama');
      expect(result.scenario.metadata.qualityScore).toBe(85);
    });

    it('피드백과 제안사항을 포함해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.feedback).toContain('캐릭터의 내적 갈등이 잘 표현됨');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('제목이 없으면 에러를 던져야 한다', async () => {
      const invalidRequest = { ...validRequest, title: '' };

      await expect(ScenarioService.generateScenario(invalidRequest, 'test-user'))
        .rejects.toThrow('입력 검증 실패');
    });

    it('내용이 없으면 에러를 던져야 한다', async () => {
      const invalidRequest = { ...validRequest, content: '' };

      await expect(ScenarioService.generateScenario(invalidRequest, 'test-user'))
        .rejects.toThrow('입력 검증 실패');
    });

    it('제목이 100자를 초과하면 에러를 던져야 한다', async () => {
      const invalidRequest = { ...validRequest, title: 'a'.repeat(101) };

      await expect(ScenarioService.generateScenario(invalidRequest, 'test-user'))
        .rejects.toThrow('입력 검증 실패');
    });

    it('내용이 50자 미만이면 에러를 던져야 한다', async () => {
      const invalidRequest = { ...validRequest, content: '짧은 내용' };

      await expect(ScenarioService.generateScenario(invalidRequest, 'test-user'))
        .rejects.toThrow('입력 검증 실패');
    });

    it('내용이 5000자를 초과하면 에러를 던져야 한다', async () => {
      const invalidRequest = { ...validRequest, content: 'a'.repeat(5001) };

      await expect(ScenarioService.generateScenario(invalidRequest, 'test-user'))
        .rejects.toThrow('입력 검증 실패');
    });

    it('Gemini API 호출이 실패하면 에러를 던져야 한다', async () => {
      mockGenerateScenario.mockRejectedValue(new Error('API 호출 실패'));

      await expect(ScenarioService.generateScenario(validRequest, 'test-user'))
        .rejects.toThrow('시나리오 생성 실패');
    });

    it('생성된 시나리오에 메타데이터가 포함되어야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.scenario.metadata).toEqual({
        genre: 'drama',
        style: 'realistic',
        target: 'general',
        structure: 'traditional',
        intensity: 'medium',
        estimatedDuration: 15,
        qualityScore: 85,
        tokens: 650,
        cost: 0.08,
      });
    });

    it('시나리오 ID가 생성되어야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.scenario.id).toMatch(/^scenario_\d+_[a-z0-9]+$/);
    });

    it('생성 시간이 설정되어야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.scenario.createdAt).toBeDefined();
      expect(result.scenario.updatedAt).toBeDefined();
      expect(new Date(result.scenario.createdAt)).toBeInstanceOf(Date);
      expect(new Date(result.scenario.updatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('updateScenario', () => {
    it('유효한 업데이트로 시나리오를 수정해야 한다', async () => {
      const updates = {
        title: '수정된 제목',
        content: '이것은 50자 이상의 수정된 시나리오 내용입니다. 충분한 길이를 확보하기 위해 더 많은 텍스트를 추가합니다.',
      };

      const result = await ScenarioService.updateScenario('test-id', updates);

      expect(result.id).toBe('test-id');
      expect(result.title).toBe('수정된 제목');
      expect(result.content).toBe(updates.content);
      expect(result.updatedAt).toBeDefined();
    });

    it('유효하지 않은 업데이트는 에러를 던져야 한다', async () => {
      const invalidUpdates = {
        title: '',
        content: '',
      };

      await expect(ScenarioService.updateScenario('test-id', invalidUpdates))
        .rejects.toThrow('수정 검증 실패');
    });
  });

  describe('regenerateScenario', () => {
    it('원본 요청을 기반으로 재생성해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.regenerateScenario(validRequest, 'test-user');

      expect(result.scenario).toBeDefined();
      expect(mockGenerateScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          title: validRequest.title,
          content: validRequest.content,
          genre: '드라마',
          style: '현실적',
          target: '일반',
          structure: 'traditional',
          intensity: 'medium',
        })
      );
    });

    it('변형 옵션을 적용하여 재생성해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const variations = {
        intensity: 'high' as const,
        structure: 'three-act' as const,
      };

      const result = await ScenarioService.regenerateScenario(validRequest, 'test-user', variations);

      expect(result.scenario).toBeDefined();
      expect(mockGenerateScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          intensity: 'high',
          structure: 'three-act',
        })
      );
    });
  });

  describe('generateStatistics', () => {
    const mockScenario = {
      id: 'test-id',
      title: '테스트 시나리오',
      content: '이것은 테스트용 시나리오 내용입니다. 여러 문장으로 구성되어 있습니다. 통계 계산을 위한 샘플 텍스트입니다.\n\n이것은 두 번째 단락입니다. 더 많은 내용을 포함하고 있습니다.',
      userId: 'test-user',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      status: 'completed' as const,
      metadata: {
        genre: 'drama' as const,
        style: 'realistic' as const,
        target: 'general' as const,
        structure: 'traditional' as const,
        intensity: 'medium' as const,
        estimatedDuration: 15,
        qualityScore: 85,
        tokens: 100,
        cost: 0.05,
      },
    };

    it('시나리오 통계를 생성해야 한다', () => {
      const stats = ScenarioService.generateStatistics(mockScenario);

      expect(stats.words).toBeGreaterThan(0);
      expect(stats.sentences).toBeGreaterThan(0);
      expect(stats.paragraphs).toBeGreaterThan(0);
      expect(stats.readingTime).toBeGreaterThan(0);
      expect(stats.complexity).toMatch(/^(simple|moderate|complex)$/);
      expect(stats.emotionalTone).toMatch(/^(positive|neutral|negative)$/);
    });

    it('단어 수를 정확히 계산해야 한다', () => {
      const stats = ScenarioService.generateStatistics(mockScenario);
      const expectedWords = mockScenario.content.split(/\s+/).length;

      expect(stats.words).toBe(expectedWords);
    });

    it('읽기 시간을 계산해야 한다', () => {
      const stats = ScenarioService.generateStatistics(mockScenario);
      const expectedReadingTime = Math.ceil(stats.words / 200);

      expect(stats.readingTime).toBe(expectedReadingTime);
    });
  });

  describe('장르/스타일/타겟 매핑', () => {
    it('장르를 한국어로 매핑해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(mockGenerateScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          genre: '드라마',
        })
      );
    });

    it('스타일을 한국어로 매핑해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(mockGenerateScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          style: '현실적',
        })
      );
    });

    it('타겟을 한국어로 매핑해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(mockGenerateScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          target: '일반',
        })
      );
    });
  });

  describe('개선 제안 생성', () => {
    it('짧은 시나리오에 대해 상세 묘사 제안을 해야 한다', async () => {
      const shortContentResponse = {
        ...mockGeminiResponse,
        scenario: {
          ...mockGeminiResponse.scenario,
          content: '짧은 내용'.repeat(20), // 500자 미만
        },
      };

      mockGenerateScenario.mockResolvedValue(shortContentResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.suggestions).toContain('더 자세한 장면 묘사를 추가해보세요');
    });

    it('긴 시나리오에 대해 간소화 제안을 해야 한다', async () => {
      const longContentResponse = {
        ...mockGeminiResponse,
        scenario: {
          ...mockGeminiResponse.scenario,
          content: '긴 내용'.repeat(500), // 2000자 초과
        },
      };

      mockGenerateScenario.mockResolvedValue(longContentResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.suggestions).toContain('핵심 장면에 집중하여 내용을 간소화해보세요');
    });

    it('낮은 품질 점수에 대해 개선 제안을 해야 한다', async () => {
      const lowQualityResponse = {
        ...mockGeminiResponse,
        quality: {
          ...mockGeminiResponse.quality,
          score: 60, // 70 미만
        },
      };

      mockGenerateScenario.mockResolvedValue(lowQualityResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      expect(result.suggestions).toContain('캐릭터의 동기를 더 명확히 해보세요');
      expect(result.suggestions).toContain('갈등 구조를 강화해보세요');
    });
  });

  describe('대안 옵션 생성', () => {
    it('현재 강도와 다른 대안을 제안해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      const intensityAlternatives = result.alternatives.filter(alt => alt.intensity && alt.intensity !== 'medium');
      expect(intensityAlternatives.length).toBeGreaterThan(0);
    });

    it('현재 구조와 다른 대안을 제안해야 한다', async () => {
      mockGenerateScenario.mockResolvedValue(mockGeminiResponse);

      const result = await ScenarioService.generateScenario(validRequest, 'test-user');

      const structureAlternatives = result.alternatives.filter(alt => alt.structure && alt.structure !== 'traditional');
      expect(structureAlternatives.length).toBeGreaterThan(0);
    });
  });
});