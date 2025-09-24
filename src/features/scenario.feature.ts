/**
 * 시나리오 생성 비즈니스 로직
 * UserJourneyMap 3-4단계 구현
 * Gemini API 통합 및 비즈니스 규칙 적용
 */

import { generateScenario, type GeminiPrompt } from '../shared/lib/gemini-client';
import type {
  Scenario,
  ScenarioGenerationRequest,
  ScenarioGenerationResponse,
  ScenarioMetadata,
} from '../entities/scenario';
import { createScenarioId, validateScenario } from '../entities/scenario';

// Redux Toolkit을 사용한 시나리오 상태 관리
export interface ScenarioState {
  current: Scenario | null;
  history: Scenario[];
  isGenerating: boolean;
  error: string | null;
  progress: number;
  cache: Map<string, Scenario>;
}

export const initialScenarioState: ScenarioState = {
  current: null,
  history: [],
  isGenerating: false,
  error: null,
  progress: 0,
  cache: new Map(),
};

// 비즈니스 로직 함수들
export class ScenarioService {
  /**
   * 시나리오 생성 메인 함수
   * UserJourneyMap 3-4단계 요구사항 구현
   */
  static async generateScenario(
    request: ScenarioGenerationRequest,
    userId: string
  ): Promise<ScenarioGenerationResponse> {
    // 1. 입력 검증
    const validationErrors = this.validateGenerationRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(`입력 검증 실패: ${validationErrors.join(', ')}`);
    }

    // 2. Gemini API 호출을 위한 프롬프트 변환
    const geminiPrompt: GeminiPrompt = {
      title: request.title,
      content: request.content,
      genre: this.mapGenreToGemini(request.genre),
      style: this.mapStyleToGemini(request.style),
      target: this.mapTargetToGemini(request.target),
      structure: ['traditional', 'three-act', 'free-form'].includes(request.structure) ? request.structure : 'three-act' as any,
      intensity: request.intensity,
    };

    try {
      // 3. AI 생성 호출
      const geminiResponse = await generateScenario(geminiPrompt);

      // 4. 응답을 도메인 모델로 변환
      const scenario: Scenario = {
        id: createScenarioId(),
        title: geminiResponse.scenario.title,
        content: geminiResponse.scenario.content,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed',
        metadata: {
          genre: request.genre,
          style: request.style,
          target: request.target,
          structure: request.structure,
          intensity: request.intensity,
          estimatedDuration: geminiResponse.scenario.estimatedDuration,
          qualityScore: geminiResponse.quality.score,
          tokens: geminiResponse.metadata.tokens,
          cost: geminiResponse.metadata.cost,
        },
      };

      // 5. 품질 개선 제안 생성
      const suggestions = this.generateImprovementSuggestions(
        scenario,
        geminiResponse.quality.feedback
      );

      // 6. 대안 옵션 생성
      const alternatives = this.generateAlternatives(request);

      return {
        scenario,
        feedback: geminiResponse.quality.feedback,
        suggestions,
        alternatives,
      };
    } catch (error) {
      console.error('[ScenarioService] 생성 실패:', error);
      throw new Error(`시나리오 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 시나리오 수정
   */
  static async updateScenario(
    scenarioId: string,
    updates: Partial<Scenario>
  ): Promise<Scenario> {
    // 수정 검증
    const validationErrors = validateScenario(updates);
    if (validationErrors.length > 0) {
      throw new Error(`수정 검증 실패: ${validationErrors.join(', ')}`);
    }

    // TODO: 실제 저장소에서 시나리오 업데이트
    const updatedScenario: Scenario = {
      ...updates,
      id: scenarioId,
      updatedAt: new Date().toISOString(),
    } as Scenario;

    return updatedScenario;
  }

  /**
   * 시나리오 재생성
   */
  static async regenerateScenario(
    originalRequest: ScenarioGenerationRequest,
    userId: string,
    variations?: Partial<ScenarioMetadata>
  ): Promise<ScenarioGenerationResponse> {
    // 변형 옵션 적용
    const modifiedRequest = {
      ...originalRequest,
      ...variations,
    };

    return this.generateScenario(modifiedRequest, userId);
  }

  /**
   * 입력 검증
   */
  private static validateGenerationRequest(
    request: ScenarioGenerationRequest
  ): string[] {
    const errors: string[] = [];

    if (!request.title?.trim()) {
      errors.push('제목은 필수입니다');
    }

    if (!request.content?.trim()) {
      errors.push('내용은 필수입니다');
    }

    if (request.title && request.title.length > 100) {
      errors.push('제목은 100자를 초과할 수 없습니다');
    }

    if (request.content && request.content.length < 50) {
      errors.push('내용은 최소 50자 이상이어야 합니다');
    }

    if (request.content && request.content.length > 5000) {
      errors.push('내용은 5000자를 초과할 수 없습니다');
    }

    return errors;
  }

  /**
   * 장르를 Gemini API 형식으로 변환
   */
  private static mapGenreToGemini(genre: string): string {
    const genreMap: Record<string, string> = {
      drama: '드라마',
      comedy: '코미디',
      romance: '로맨스',
      thriller: '스릴러',
      horror: '호러',
      fantasy: '판타지',
      'sci-fi': 'SF',
      action: '액션',
      mystery: '미스터리',
      'slice-of-life': '일상',
      documentary: '다큐멘터리',
      animation: '애니메이션',
    };

    return genreMap[genre] || genre;
  }

  /**
   * 스타일을 Gemini API 형식으로 변환
   */
  private static mapStyleToGemini(style: string): string {
    const styleMap: Record<string, string> = {
      realistic: '현실적',
      stylized: '양식화된',
      minimalist: '미니멀',
      dramatic: '극적',
      comedic: '코믹',
      poetic: '시적',
      raw: '날것의',
      polished: '세련된',
      experimental: '실험적',
      commercial: '상업적',
      artistic: '예술적',
      documentary: '다큐멘터리',
    };

    return styleMap[style] || style;
  }

  /**
   * 타겟을 Gemini API 형식으로 변환
   */
  private static mapTargetToGemini(target: string): string {
    const targetMap: Record<string, string> = {
      children: '어린이',
      teens: '청소년',
      'young-adults': '청년',
      adults: '성인',
      seniors: '시니어',
      family: '가족',
      general: '일반',
      niche: '틈새',
      professional: '전문가',
      international: '국제',
    };

    return targetMap[target] || target;
  }

  /**
   * 개선 제안 생성
   */
  private static generateImprovementSuggestions(
    scenario: Scenario,
    feedback: string[]
  ): string[] {
    const suggestions: string[] = [...feedback];

    // 시나리오 길이 기반 제안
    if (scenario.content.length < 500) {
      suggestions.push('더 자세한 장면 묘사를 추가해보세요');
    }

    if (scenario.content.length >= 2000) {
      suggestions.push('핵심 장면에 집중하여 내용을 간소화해보세요');
    }

    // 품질 점수 기반 제안
    if (scenario.metadata.qualityScore < 70) {
      suggestions.push('캐릭터의 동기를 더 명확히 해보세요');
      suggestions.push('갈등 구조를 강화해보세요');
    }

    // 구조별 제안
    switch (scenario.metadata.structure) {
      case 'traditional':
        suggestions.push('각 단계(기승전결)의 균형을 확인해보세요');
        break;
      case 'three-act':
        suggestions.push('2막에서 충분한 갈등을 만들어보세요');
        break;
      case 'free-form':
        suggestions.push('자유로운 구조 안에서도 일관성을 유지해보세요');
        break;
    }

    return suggestions;
  }

  /**
   * 대안 옵션 생성
   */
  private static generateAlternatives(
    request: ScenarioGenerationRequest
  ): Partial<ScenarioMetadata>[] {
    const alternatives: Partial<ScenarioMetadata>[] = [];

    // 강도 변형
    if (request.intensity !== 'low') {
      alternatives.push({
        intensity: 'low',
        structure: request.structure,
      });
    }

    if (request.intensity !== 'high') {
      alternatives.push({
        intensity: 'high',
        structure: request.structure,
      });
    }

    // 구조 변형
    if (request.structure !== 'three-act') {
      alternatives.push({
        structure: 'three-act',
        intensity: request.intensity,
      });
    }

    if (request.structure !== 'free-form') {
      alternatives.push({
        structure: 'free-form',
        intensity: request.intensity,
      });
    }

    return alternatives;
  }

  /**
   * 시나리오 통계 생성
   */
  static generateStatistics(scenario: Scenario) {
    const words = scenario.content.split(/\s+/).length;
    const sentences = scenario.content.split(/[.!?]+/).length;
    const paragraphs = scenario.content.split(/\n\s*\n/).length;

    return {
      words,
      sentences,
      paragraphs,
      readingTime: Math.ceil(words / 200), // 분 단위
      complexity: this.calculateComplexity(scenario.content),
      emotionalTone: this.analyzeEmotionalTone(scenario.content),
    };
  }

  /**
   * 복잡도 계산
   */
  private static calculateComplexity(content: string): 'simple' | 'moderate' | 'complex' {
    const avgWordLength = content.split(/\s+/).reduce((acc, word) => acc + word.length, 0) / content.split(/\s+/).length;
    const avgSentenceLength = content.length / content.split(/[.!?]+/).length;

    if (avgWordLength < 4 && avgSentenceLength < 80) return 'simple';
    if (avgWordLength < 6 && avgSentenceLength < 120) return 'moderate';
    return 'complex';
  }

  /**
   * 감정 톤 분석
   */
  private static analyzeEmotionalTone(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['행복', '기쁨', '사랑', '희망', '웃음', '성공'];
    const negativeWords = ['슬픔', '고통', '분노', '절망', '죽음', '실패'];

    const positiveCount = positiveWords.reduce(
      (count, word) => count + (content.match(new RegExp(word, 'g')) || []).length,
      0
    );

    const negativeCount = negativeWords.reduce(
      (count, word) => count + (content.match(new RegExp(word, 'g')) || []).length,
      0
    );

    if (positiveCount > negativeCount * 1.5) return 'positive';
    if (negativeCount > positiveCount * 1.5) return 'negative';
    return 'neutral';
  }
}

// Hook: 시나리오 생성 관리 (API 클라이언트)
export function useScenarioGeneration() {
  // API 클라이언트를 통한 시나리오 생성
  const generateScenario = async (
    request: ScenarioGenerationRequest,
    userId: string
  ): Promise<ScenarioGenerationResponse> => {
    try {
      const response = await fetch('/api/scenario/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`, // 임시 인증 방식
        },
        body: JSON.stringify(request),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || '시나리오 생성에 실패했습니다.');
      }

      if (!result.success) {
        throw new Error(result.error?.message || '시나리오 생성에 실패했습니다.');
      }

      return {
        scenario: result.data.scenario,
        feedback: result.data.feedback,
        suggestions: result.data.suggestions,
        alternatives: result.data.alternatives,
      };
    } catch (error) {
      console.error('[Hook] 시나리오 생성 실패:', error);
      throw error;
    }
  };

  return {
    generateScenario,
    updateScenario: ScenarioService.updateScenario,
    regenerateScenario: ScenarioService.regenerateScenario,
    generateStatistics: ScenarioService.generateStatistics,
  };
}