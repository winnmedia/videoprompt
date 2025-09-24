/**
 * Story Generation Engine
 * 4단계 스토리 생성의 핵심 비즈니스 로직
 * CLAUDE.md 비용 안전 규칙 준수
 */

import {
  type FourActStory,
  type StoryGenerationParams,
  createFourActStory,
  ACT_TEMPLATES,
  extractThumbnailPrompt
} from '../../../entities/story';
import type {
  AIGenerationResponse,
  StoryGenerationRequest,
  AIModelConfig,
  StoryPromptTemplate,
  GenerationProgress
} from '../types';

export class StoryGenerationEngine {
  private readonly aiConfig: AIModelConfig;
  private readonly promptTemplate: StoryPromptTemplate;
  private generationCache = new Map<string, FourActStory>();
  private lastGenerationTime = 0;
  private readonly MIN_GENERATION_INTERVAL = 60000; // 1분 캐싱 (비용 안전)

  constructor() {
    this.aiConfig = {
      model: 'gemini',
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9
    };

    this.promptTemplate = {
      systemPrompt: `당신은 전문적인 스토리텔러입니다. 주어진 정보를 바탕으로 기승전결의 4단계 구조로 구성된 매력적인 스토리를 작성하세요.

핵심 원칙:
1. 각 Act는 명확한 역할과 목적을 가져야 합니다
2. 캐릭터의 성장과 변화가 드러나야 합니다
3. 감정의 기복과 긴장감을 적절히 배치하세요
4. 타겟 오디언스에 맞는 언어와 내용을 사용하세요
5. 지정된 장르의 특성을 잘 반영하세요`,

      actPrompts: {
        setup: `도입부(Setup)를 작성하세요:
- 주요 인물과 배경을 자연스럽게 소개
- 앞으로 전개될 갈등의 단서 제시
- 독자/시청자의 호기심을 자극하는 요소 포함`,

        development: `전개부(Development)를 작성하세요:
- 갈등이 점점 복잡해지고 심화
- 등장인물들의 선택과 행동이 결과를 낳음
- 긴장감이 지속적으로 상승`,

        climax: `절정부(Climax)를 작성하세요:
- 모든 갈등이 정점에 도달
- 가장 극적이고 인상적인 순간
- 주인공의 운명을 결정하는 결정적 선택`,

        resolution: `결말부(Resolution)를 작성하세요:
- 갈등의 해결과 새로운 균형
- 캐릭터의 성장과 변화 확인
- 여운과 의미 있는 메시지 전달`
      },

      structurePrompt: `전체 스토리의 구조와 흐름을 점검하여 다음을 확인하세요:
1. 4단계 간의 자연스러운 연결
2. 시간적 흐름의 논리성
3. 캐릭터 발전의 일관성
4. 주제 의식의 명확성`,

      optimizationPrompt: `스토리를 다음 관점에서 최적화하세요:
1. 불필요한 내용 제거
2. 핵심 메시지 강화
3. 감정적 임팩트 극대화
4. 가독성과 흐름 개선`
    };
  }

  async generateStory(
    request: StoryGenerationRequest,
    progressCallback?: (progress: GenerationProgress) => void
  ): Promise<AIGenerationResponse> {
    const startTime = Date.now();

    try {
      // 입력 검증
      this.validateRequest(request);

      // 비용 안전: 캐싱 확인 ($300 사건 방지)
      const cacheKey = this.generateCacheKey(request.params);
      if (this.shouldUseCache(cacheKey)) {
        const cachedStory = this.generationCache.get(cacheKey);
        if (cachedStory) {
          return {
            success: true,
            story: cachedStory,
            tokensUsed: 0, // 캐시 사용
            generationTime: Date.now() - startTime
          };
        }
      }

      // 비용 안전: 최소 간격 체크
      if (!this.canGenerate()) {
        throw new Error('생성 간격이 너무 짧습니다. 1분 후 다시 시도해주세요.');
      }

      // 진행률 초기화
      let progress: GenerationProgress = {
        phase: 'analyzing',
        actProgress: { setup: 0, development: 0, climax: 0, resolution: 0 },
        overallProgress: 0,
        currentAct: null,
        estimatedTimeRemaining: 120 // 2분 추정
      };

      progressCallback?.(progress);

      // 1단계: 기본 스토리 구조 생성
      progress = { ...progress, phase: 'structuring', overallProgress: 10 };
      progressCallback?.(progress);

      const baseStory = createFourActStory(request.params, request.userId);
      if (request.scenarioId) {
        // TODO: 시나리오 연결 로직
      }

      // 2단계: 각 Act별 AI 생성
      progress = { ...progress, phase: 'writing', overallProgress: 20 };
      progressCallback?.(progress);

      const generatedStory = await this.generateActContents(
        baseStory,
        request.params,
        (actProgress) => {
          progress = {
            ...progress,
            actProgress,
            overallProgress: 20 + (Object.values(actProgress).reduce((a, b) => a + b, 0) / 4) * 0.6,
            currentAct: this.getCurrentActFromProgress(actProgress)
          };
          progressCallback?.(progress);
        }
      );

      // 3단계: 구조 최적화
      progress = { ...progress, phase: 'optimizing', overallProgress: 85 };
      progressCallback?.(progress);

      const optimizedStory = await this.optimizeStoryStructure(generatedStory);

      // 4단계: 완료
      progress = { ...progress, phase: 'completed', overallProgress: 100 };
      progressCallback?.(progress);

      // 캐시 저장
      this.generationCache.set(cacheKey, optimizedStory);
      this.lastGenerationTime = Date.now();

      const response: AIGenerationResponse = {
        success: true,
        story: optimizedStory,
        tokensUsed: this.estimateTokenUsage(optimizedStory),
        generationTime: Date.now() - startTime
      };

      return response;

    } catch (error) {
      const errorResponse: AIGenerationResponse = {
        success: false,
        error: {
          type: this.categorizeError(error),
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
          details: error,
          retryable: this.isRetryableError(error),
          timestamp: new Date().toISOString()
        },
        tokensUsed: 0,
        generationTime: Date.now() - startTime
      };

      return errorResponse;
    }
  }

  private async generateActContents(
    baseStory: FourActStory,
    params: StoryGenerationParams,
    progressCallback: (progress: GenerationProgress['actProgress']) => void
  ): Promise<FourActStory> {
    const actProgress = { setup: 0, development: 0, climax: 0, resolution: 0 };

    // 시뮬레이션: 실제로는 Gemini API 호출
    const acts = Object.keys(baseStory.acts) as Array<keyof typeof baseStory.acts>;

    for (const actType of acts) {
      const act = baseStory.acts[actType];

      // AI 콘텐츠 생성 시뮬레이션
      const generatedContent = await this.generateActContent(act, params, actType);

      baseStory.acts[actType] = {
        ...act,
        content: generatedContent.content,
        keyEvents: generatedContent.keyEvents,
        characterFocus: generatedContent.characterFocus || act.characterFocus
      };

      actProgress[actType] = 100;
      progressCallback(actProgress);

      // 진행률 시뮬레이션을 위한 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      ...baseStory,
      aiGenerated: true,
      aiModel: 'gemini',
      aiPrompt: this.buildFullPrompt(params)
    };
  }

  private async generateActContent(
    act: any,
    params: StoryGenerationParams,
    actType: keyof typeof ACT_TEMPLATES
  ): Promise<{
    content: string;
    keyEvents: string[];
    characterFocus?: string[];
  }> {
    // 실제 구현에서는 Gemini API 호출
    // 현재는 템플릿 기반 생성으로 시뮬레이션

    const template = ACT_TEMPLATES[actType];
    const intensityMultiplier = params.intensity / 100;

    const contentTemplates = {
      setup: `${params.title}의 시작. 주인공은 ${params.synopsis}를 둘러싼 상황에 처해있다. ${params.genre} 장르의 특성을 살린 ${params.tone} 톤으로 이야기가 시작된다. 등장인물들의 관계와 배경이 자연스럽게 드러나며, 앞으로 펼쳐질 갈등의 씨앗이 뿌려진다.`,

      development: `갈등이 본격적으로 시작된다. 주인공은 예상치 못한 장애물들과 마주하게 되고, 상황은 점점 복잡해진다. ${params.tone} 분위기 속에서 긴장감이 고조되며, 등장인물들의 진짜 모습이 드러나기 시작한다. 선택의 순간들이 연이어 찾아온다.`,

      climax: `모든 것이 정점에 달한다. 지금까지 쌓여온 갈등과 긴장이 폭발하는 순간이다. 주인공은 가장 어려운 선택에 직면하고, 모든 것을 걸고 결정적인 행동을 취한다. ${params.genre}의 특성이 가장 극적으로 드러나는 클라이맥스이다.`,

      resolution: `모든 갈등이 해결되고 새로운 균형이 찾아온다. 주인공은 여정을 통해 성장했고, 이야기는 의미 있는 메시지를 남기며 마무리된다. ${params.tone}의 여운이 남는 결말로 독자에게 깊은 인상을 남긴다.`
    };

    const baseContent = contentTemplates[actType];
    const enhancedContent = this.enhanceContentByIntensity(baseContent, intensityMultiplier);

    return {
      content: enhancedContent,
      keyEvents: this.generateKeyEvents(actType, params),
      characterFocus: params.keyCharacters
    };
  }

  private enhanceContentByIntensity(content: string, intensity: number): string {
    if (intensity < 0.3) {
      return content + ' 차분하고 서정적인 분위기로 이야기가 전개된다.';
    } else if (intensity < 0.7) {
      return content + ' 적절한 긴장감과 함께 흥미진진하게 이야기가 펼쳐진다.';
    } else {
      return content + ' 강렬하고 역동적인 에너지로 가득 찬 이야기가 전개된다.';
    }
  }

  private generateKeyEvents(actType: keyof typeof ACT_TEMPLATES, params: StoryGenerationParams): string[] {
    const eventTemplates = {
      setup: ['인물 소개', '배경 설정', '갈등의 단서', '목표 설정'],
      development: ['갈등 심화', '새로운 인물 등장', '예상치 못한 장애물', '관계 변화'],
      climax: ['결정적 대결', '진실 폭로', '최고 긴장감', '운명의 선택'],
      resolution: ['갈등 해결', '캐릭터 성장 확인', '새로운 시작', '여운과 메시지']
    };

    return eventTemplates[actType] || [];
  }

  private async optimizeStoryStructure(story: FourActStory): Promise<FourActStory> {
    // 구조 최적화 로직
    const totalDuration = Object.values(story.acts).reduce((sum, act) => sum + act.duration, 0);

    return {
      ...story,
      totalDuration,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
  }

  private generateCacheKey(params: StoryGenerationParams): string {
    return `story_${JSON.stringify(params)}`.replace(/\s/g, '');
  }

  private shouldUseCache(cacheKey: string): boolean {
    const now = Date.now();
    const cacheValidDuration = 60000; // 1분
    return (now - this.lastGenerationTime) < cacheValidDuration;
  }

  private canGenerate(): boolean {
    const now = Date.now();
    return (now - this.lastGenerationTime) >= this.MIN_GENERATION_INTERVAL;
  }

  private estimateTokenUsage(story: FourActStory): number {
    const totalLength = Object.values(story.acts)
      .reduce((sum, act) => sum + act.content.length, 0);
    return Math.ceil(totalLength / 4); // 대략적인 토큰 계산
  }

  private categorizeError(error: any): 'api_error' | 'validation_error' | 'rate_limit' | 'network_error' | 'unknown_error' {
    if (error.message?.includes('rate limit')) return 'rate_limit';
    if (error.message?.includes('validation')) return 'validation_error';
    if (error.message?.includes('network')) return 'network_error';
    if (error.message?.includes('API')) return 'api_error';
    return 'unknown_error';
  }

  private isRetryableError(error: any): boolean {
    const retryableTypes = ['network_error', 'rate_limit'];
    return retryableTypes.includes(this.categorizeError(error));
  }

  private getCurrentActFromProgress(actProgress: GenerationProgress['actProgress']): 'setup' | 'development' | 'climax' | 'resolution' | null {
    const entries = Object.entries(actProgress) as Array<[keyof typeof actProgress, number]>;
    const inProgress = entries.find(([_, progress]) => progress > 0 && progress < 100);
    return inProgress ? inProgress[0] : null;
  }

  private validateRequest(request: StoryGenerationRequest): void {
    const { params } = request;

    // 제목 검증
    if (!params.title || params.title.trim().length === 0) {
      throw new Error('validation: 제목은 필수입니다.');
    }
    if (params.title.length > 100) {
      throw new Error('validation: 제목은 100자를 초과할 수 없습니다.');
    }

    // 시놉시스 검증
    if (!params.synopsis || params.synopsis.trim().length === 0) {
      throw new Error('validation: 시놉시스는 필수입니다.');
    }
    if (params.synopsis.length < 10) {
      throw new Error('validation: 시놉시스는 최소 10자 이상이어야 합니다.');
    }
    if (params.synopsis.length > 1000) {
      throw new Error('validation: 시놉시스는 1000자를 초과할 수 없습니다.');
    }

    // 필수 필드 검증
    if (!params.genre) {
      throw new Error('validation: 장르는 필수입니다.');
    }
    if (!params.targetAudience) {
      throw new Error('validation: 타겟 오디언스는 필수입니다.');
    }
    if (!params.tone) {
      throw new Error('validation: 톤은 필수입니다.');
    }

    // 사용자 ID 검증
    if (!request.userId || request.userId.trim().length === 0) {
      throw new Error('validation: 사용자 ID는 필수입니다.');
    }
  }

  private buildFullPrompt(params: StoryGenerationParams): string {
    return `${this.promptTemplate.systemPrompt}\n\n제목: ${params.title}\n줄거리: ${params.synopsis}\n장르: ${params.genre}\n톤: ${params.tone}\n창의성: ${params.creativity}\n강도: ${params.intensity}`;
  }
}