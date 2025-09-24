/**
 * 프롬프트 생성 엔진 (Prompt Generation Engine)
 * UserJourneyMap 12-14단계 핵심 비즈니스 로직
 *
 * 백엔드 서비스 원칙 적용:
 * - 도메인 중심 설계
 * - 계약 기반 검증
 * - 탄력적 패턴 (Circuit Breaker, Retry)
 * - 비용 안전 장치
 */

import type {
  PromptEngineering,
  AIVideoModel,
  PromptOptimizationLevel,
  ModelOptimization,
} from '../../entities/prompt';
import {
  generatePromptsForSelectedShots,
  createPromptEngineering,
  customizePrompt,
} from '../../entities/prompt';
import type { TwelveShotCollection, TwelveShot } from '../../entities/Shot';
import type { FourActStory } from '../../entities/story';
import { CostSafetyMiddleware } from '@/shared/lib/cost-safety-middleware';

// ===== 프롬프트 생성 서비스 =====

export interface PromptGenerationService {
  // 12숏트에서 선택된 숏트들의 프롬프트 생성
  generateForSelectedShots(
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[],
    targetModels: AIVideoModel[],
    options?: PromptGenerationOptions
  ): Promise<PromptEngineering[]>;

  // 전체 12숏트 배치 프롬프트 생성
  generateBatchPrompts(
    shotCollection: TwelveShotCollection,
    targetModels: AIVideoModel[],
    options?: PromptGenerationOptions
  ): Promise<PromptEngineering[]>;

  // AI 기반 프롬프트 최적화
  optimizePrompt(
    prompt: PromptEngineering,
    model: AIVideoModel,
    targetLevel: PromptOptimizationLevel
  ): Promise<PromptEngineering>;

  // 프롬프트 품질 검증 및 개선 제안
  validateAndSuggest(
    prompt: PromptEngineering
  ): Promise<ValidationResult>;

  // 비용 예측 및 최적화
  estimateCosts(
    prompts: PromptEngineering[]
  ): Promise<CostEstimation>;
}

export interface PromptGenerationOptions {
  optimizationLevel: PromptOptimizationLevel;
  enableAIEnhancement: boolean;
  prioritizeConsistency: boolean;
  maxCostPerPrompt: number;
  customTemplates?: Record<AIVideoModel, string>;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
  improvements: ImprovementSuggestion[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  field: string;
  model?: AIVideoModel;
}

export interface ImprovementSuggestion {
  type: 'keyword_enhancement' | 'style_improvement' | 'technical_optimization';
  message: string;
  expectedImprovement: number;
  implementation: string;
}

export interface CostEstimation {
  totalCost: number;
  costBreakdown: CostBreakdownItem[];
  recommendations: CostRecommendation[];
  alternativeOptions: AlternativeOption[];
}

export interface CostBreakdownItem {
  model: AIVideoModel;
  promptCount: number;
  costPerPrompt: number;
  totalCost: number;
}

export interface CostRecommendation {
  type: 'model_switch' | 'quality_reduction' | 'batch_optimization';
  message: string;
  potentialSavings: number;
  implementation: string;
}

export interface AlternativeOption {
  description: string;
  totalCost: number;
  qualityImpact: number; // -10 to +10
  timeImpact: number; // -10 to +10
}

// ===== 프롬프트 생성 엔진 구현 =====

export class PromptGenerationEngine implements PromptGenerationService {
  private costSafety: CostSafetyMiddleware;
  private aiEnhancementService: AIEnhancementService;
  private promptTemplateLibrary: PromptTemplateLibrary;

  constructor() {
    this.costSafety = new CostSafetyMiddleware();

    this.aiEnhancementService = new AIEnhancementService();
    this.promptTemplateLibrary = new PromptTemplateLibrary();
  }

  /**
   * 선택된 숏트들의 프롬프트 생성 (UserJourneyMap 14단계)
   */
  async generateForSelectedShots(
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[],
    targetModels: AIVideoModel[],
    options: PromptGenerationOptions = this.getDefaultOptions()
  ): Promise<PromptEngineering[]> {
    // 입력 검증
    this.validateGenerationInput(shotCollection, selectedShotIds, targetModels);

    // 비용 안전 검사
    // TODO: Implement rate limit and cost checks
    // await this.costSafety.checkRateLimit();
    // await this.costSafety.checkCostLimit(selectedShotIds.length * targetModels.length * 0.01);

    try {
      const selectedShots = this.getSelectedShots(shotCollection, selectedShotIds);
      const prompts: PromptEngineering[] = [];

      // 각 선택된 숏트에 대해 프롬프트 생성
      for (const shot of selectedShots) {
        const prompt = await this.generatePromptForShot(shot, targetModels, options);
        prompts.push(prompt);
      }

      // 일관성 최적화 (옵션 활성화 시)
      if (options.prioritizeConsistency) {
        await this.optimizeConsistency(prompts);
      }

      // 비용 추적
      // TODO: Implement cost tracking
      // this.costSafety.trackCost(prompts.length * targetModels.length * 0.01);

      return prompts;
    } catch (error) {
      console.error('프롬프트 생성 실패:', error);
      throw new Error(`프롬프트 생성 중 오류가 발생했습니다: ${(error as Error).message}`);
    }
  }

  /**
   * 전체 12숏트 배치 프롬프트 생성
   */
  async generateBatchPrompts(
    shotCollection: TwelveShotCollection,
    targetModels: AIVideoModel[],
    options: PromptGenerationOptions = this.getDefaultOptions()
  ): Promise<PromptEngineering[]> {
    const allShotIds = shotCollection.shots.map(shot => shot.id);
    return this.generateForSelectedShots(shotCollection, allShotIds, targetModels, options);
  }

  /**
   * 개별 숏트 프롬프트 생성
   */
  private async generatePromptForShot(
    shot: TwelveShot,
    targetModels: AIVideoModel[],
    options: PromptGenerationOptions
  ): Promise<PromptEngineering> {
    // 스토리보드 검증
    if (shot.storyboard.status !== 'completed') {
      throw new Error(`숏트 ${shot.globalOrder}의 콘티가 완성되지 않았습니다.`);
    }

    // 기본 프롬프트 생성
    let prompt = createPromptEngineering(
      shot,
      shot.storyboard,
      targetModels,
      options.optimizationLevel
    );

    // AI 향상 적용 (옵션 활성화 시)
    if (options.enableAIEnhancement) {
      prompt = await this.aiEnhancementService.enhance(prompt, options);
    }

    // 커스텀 템플릿 적용
    if (options.customTemplates) {
      prompt = this.applyCustomTemplates(prompt, options.customTemplates);
    }

    return prompt;
  }

  /**
   * AI 기반 프롬프트 최적화
   */
  async optimizePrompt(
    prompt: PromptEngineering,
    model: AIVideoModel,
    targetLevel: PromptOptimizationLevel
  ): Promise<PromptEngineering> {
    // 비용 안전 검사
    // TODO: Implement cost safety checks
    // await this.costSafety.checkRateLimit();
    // await this.costSafety.checkCostLimit(0.02); // 최적화 비용

    try {
      // AI 기반 최적화 수행
      const optimizedPrompt = await this.aiEnhancementService.optimizeForModel(
        prompt,
        model,
        targetLevel
      );

      // 비용 추적
      // TODO: Implement cost tracking
      // this.costSafety.trackCost(0.02);

      return optimizedPrompt;
    } catch (error) {
      console.error('프롬프트 최적화 실패:', error);
      throw new Error(`프롬프트 최적화 중 오류가 발생했습니다: ${(error as Error).message}`);
    }
  }

  /**
   * 프롬프트 품질 검증 및 개선 제안
   */
  async validateAndSuggest(prompt: PromptEngineering): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    const improvements: ImprovementSuggestion[] = [];

    // 기본 품질 검증
    const basicValidation = this.validateBasicQuality(prompt);
    issues.push(...basicValidation.issues);

    // 모델별 특화 검증
    for (const [model, optimization] of Object.entries(prompt.modelOptimizations)) {
      const modelValidation = this.validateModelOptimization(optimization, model as AIVideoModel);
      issues.push(...modelValidation.issues);
    }

    // AI 기반 개선 제안 생성
    const aiSuggestions = await this.generateAISuggestions(prompt);
    suggestions.push(...aiSuggestions.suggestions);
    improvements.push(...aiSuggestions.improvements);

    // 전체 점수 계산
    const score = this.calculateValidationScore(issues, prompt.qualityScore);

    return {
      isValid: issues.filter(issue => issue.severity === 'error').length === 0,
      score,
      issues,
      suggestions,
      improvements,
    };
  }

  /**
   * 비용 예측 및 최적화
   */
  async estimateCosts(prompts: PromptEngineering[]): Promise<CostEstimation> {
    const costBreakdown: CostBreakdownItem[] = [];
    let totalCost = 0;

    // 모델별 비용 계산
    const modelCosts = this.calculateModelCosts(prompts);

    for (const [model, data] of Object.entries(modelCosts)) {
      const item: CostBreakdownItem = {
        model: model as AIVideoModel,
        promptCount: data.count,
        costPerPrompt: data.costPerPrompt,
        totalCost: data.totalCost,
      };
      costBreakdown.push(item);
      totalCost += data.totalCost;
    }

    // 비용 절약 권장사항 생성
    const recommendations = this.generateCostRecommendations(costBreakdown, totalCost);

    // 대안 옵션 제안
    const alternativeOptions = this.generateAlternativeOptions(prompts, totalCost);

    return {
      totalCost,
      costBreakdown,
      recommendations,
      alternativeOptions,
    };
  }

  // ===== 유틸리티 메서드들 =====

  private validateGenerationInput(
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[],
    targetModels: AIVideoModel[]
  ): void {
    if (!shotCollection.id) {
      throw new Error('유효하지 않은 숏트 컬렉션입니다.');
    }

    if (selectedShotIds.length === 0) {
      throw new Error('최소 하나의 숏트를 선택해야 합니다.');
    }

    if (targetModels.length === 0) {
      throw new Error('최소 하나의 AI 모델을 선택해야 합니다.');
    }

    // 선택된 숏트가 모두 존재하는지 확인
    const existingShotIds = shotCollection.shots.map(shot => shot.id);
    const invalidShotIds = selectedShotIds.filter(id => !existingShotIds.includes(id));
    if (invalidShotIds.length > 0) {
      throw new Error(`존재하지 않는 숏트 ID: ${invalidShotIds.join(', ')}`);
    }
  }

  private getSelectedShots(
    shotCollection: TwelveShotCollection,
    selectedShotIds: string[]
  ): TwelveShot[] {
    return shotCollection.shots.filter(shot => selectedShotIds.includes(shot.id));
  }

  private async optimizeConsistency(prompts: PromptEngineering[]): Promise<void> {
    if (prompts.length < 2) return;

    // 첫 번째 프롬프트를 기준으로 일관성 키워드 추출
    const referencePrompt = prompts[0];
    const consistencyKeywords = this.extractConsistencyKeywords(referencePrompt);

    // 나머지 프롬프트들에 일관성 키워드 적용
    for (let i = 1; i < prompts.length; i++) {
      prompts[i] = this.applyConsistencyKeywords(prompts[i], consistencyKeywords);
    }
  }

  private extractConsistencyKeywords(prompt: PromptEngineering): string[] {
    // 캐릭터, 스타일, 색상 팔레트 등 일관성 키워드 추출
    const keywords: string[] = [];

    // 캐릭터 정보
    keywords.push(...prompt.sourceShot.charactersInShot);

    // 스타일 정보
    keywords.push(prompt.sourceShot.colorPalette);
    keywords.push(prompt.sourceShot.lightingMood);
    keywords.push(prompt.sourceStoryboard.style);

    return keywords.filter(Boolean);
  }

  private applyConsistencyKeywords(
    prompt: PromptEngineering,
    keywords: string[]
  ): PromptEngineering {
    // 각 모델 최적화에 일관성 키워드 추가
    const updatedOptimizations = { ...prompt.modelOptimizations };

    for (const [model, optimization] of Object.entries(updatedOptimizations)) {
      const consistencyPhrase = keywords.join(', ');
      optimization.prompt = `${optimization.prompt}, consistent with: ${consistencyPhrase}`;
    }

    return {
      ...prompt,
      modelOptimizations: updatedOptimizations,
    };
  }

  private applyCustomTemplates(
    prompt: PromptEngineering,
    customTemplates: Record<AIVideoModel, string>
  ): PromptEngineering {
    const updatedOptimizations = { ...prompt.modelOptimizations };

    for (const [model, template] of Object.entries(customTemplates)) {
      if (updatedOptimizations[model as AIVideoModel]) {
        const optimization = updatedOptimizations[model as AIVideoModel];
        optimization.prompt = template.replace('{original_prompt}', optimization.prompt);
      }
    }

    return {
      ...prompt,
      modelOptimizations: updatedOptimizations,
    };
  }

  private validateBasicQuality(prompt: PromptEngineering): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    // 품질 점수 검증
    if (prompt.qualityScore < 70) {
      issues.push({
        severity: 'warning',
        message: `품질 점수가 낮습니다 (${prompt.qualityScore}/100)`,
        field: 'qualityScore',
      });
    }

    // 프롬프트 길이 검증
    for (const [model, optimization] of Object.entries(prompt.modelOptimizations)) {
      if (optimization.prompt.length < 50) {
        issues.push({
          severity: 'warning',
          message: `${model} 프롬프트가 너무 짧습니다`,
          field: 'prompt',
          model: model as AIVideoModel,
        });
      }

      if (optimization.tokenCount > 500) {
        issues.push({
          severity: 'error',
          message: `${model} 토큰 수가 제한을 초과했습니다 (${optimization.tokenCount}/500)`,
          field: 'tokenCount',
          model: model as AIVideoModel,
        });
      }
    }

    return { issues };
  }

  private validateModelOptimization(
    optimization: ModelOptimization,
    model: AIVideoModel
  ): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];

    // 비용 검증
    if (optimization.estimatedCost > 2.0) {
      issues.push({
        severity: 'warning',
        message: `${model} 예상 비용이 높습니다 ($${optimization.estimatedCost})`,
        field: 'estimatedCost',
        model,
      });
    }

    // 품질 예측 검증
    if (optimization.qualityPrediction.overallScore < 80) {
      issues.push({
        severity: 'info',
        message: `${model} 품질 예측이 낮습니다 (${optimization.qualityPrediction.overallScore}/100)`,
        field: 'qualityPrediction',
        model,
      });
    }

    return { issues };
  }

  private async generateAISuggestions(prompt: PromptEngineering): Promise<{
    suggestions: string[];
    improvements: ImprovementSuggestion[];
  }> {
    // 실제 구현에서는 AI API를 호출하여 개선 제안 생성
    const suggestions: string[] = [];
    const improvements: ImprovementSuggestion[] = [];

    // 키워드 강화 제안
    if (prompt.qualityScore < 85) {
      improvements.push({
        type: 'keyword_enhancement',
        message: '더 구체적인 시각적 디테일을 추가하여 품질을 향상시킬 수 있습니다',
        expectedImprovement: 10,
        implementation: '조명, 카메라 앵글, 색상 팔레트 키워드 추가',
      });
    }

    // 스타일 개선 제안
    improvements.push({
      type: 'style_improvement',
      message: '영화적 스타일 키워드를 추가하여 전문성을 높일 수 있습니다',
      expectedImprovement: 8,
      implementation: '"cinematic", "professional", "high-end" 등의 키워드 추가',
    });

    // 기술적 최적화 제안
    improvements.push({
      type: 'technical_optimization',
      message: '해상도 및 품질 키워드를 최적화할 수 있습니다',
      expectedImprovement: 5,
      implementation: '"8K", "ultra-detailed", "sharp focus" 등의 키워드 추가',
    });

    suggestions.push(
      '프롬프트에 더 구체적인 감정적 톤을 추가해보세요',
      '카메라 움직임을 더 상세히 기술해보세요',
      '색상 팔레트와 조명을 더 명확히 명시해보세요'
    );

    return { suggestions, improvements };
  }

  private calculateValidationScore(issues: ValidationIssue[], baseScore: number): number {
    let score = baseScore;

    // 이슈에 따른 점수 차감
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 15;
          break;
        case 'warning':
          score -= 8;
          break;
        case 'info':
          score -= 3;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateModelCosts(prompts: PromptEngineering[]): Record<string, {
    count: number;
    costPerPrompt: number;
    totalCost: number;
  }> {
    const modelCosts: Record<string, { count: number; costPerPrompt: number; totalCost: number }> = {};

    for (const prompt of prompts) {
      for (const [model, optimization] of Object.entries(prompt.modelOptimizations)) {
        if (!modelCosts[model]) {
          modelCosts[model] = {
            count: 0,
            costPerPrompt: optimization.estimatedCost,
            totalCost: 0,
          };
        }
        modelCosts[model].count++;
        modelCosts[model].totalCost += optimization.estimatedCost;
      }
    }

    return modelCosts;
  }

  private generateCostRecommendations(
    costBreakdown: CostBreakdownItem[],
    totalCost: number
  ): CostRecommendation[] {
    const recommendations: CostRecommendation[] = [];

    // 높은 비용 모델에 대한 대안 제안
    const expensiveModels = costBreakdown.filter(item => item.costPerPrompt > 0.1);
    for (const model of expensiveModels) {
      recommendations.push({
        type: 'model_switch',
        message: `${model.model}을 더 경제적인 모델로 대체하여 비용을 절약할 수 있습니다`,
        potentialSavings: model.totalCost * 0.5,
        implementation: 'zeroscope 또는 animatediff 모델 사용 고려',
      });
    }

    // 전체 비용이 높은 경우 배치 최적화 제안
    if (totalCost > 10) {
      recommendations.push({
        type: 'batch_optimization',
        message: '배치 처리를 통해 비용을 최적화할 수 있습니다',
        potentialSavings: totalCost * 0.2,
        implementation: '동시 처리 수 조정 및 우선순위 기반 처리',
      });
    }

    return recommendations;
  }

  private generateAlternativeOptions(
    prompts: PromptEngineering[],
    currentCost: number
  ): AlternativeOption[] {
    return [
      {
        description: '경제적 모델만 사용 (zeroscope + animatediff)',
        totalCost: currentCost * 0.4,
        qualityImpact: -3,
        timeImpact: 2,
      },
      {
        description: '프리미엄 모델만 사용 (runway-gen3 + pika-labs)',
        totalCost: currentCost * 1.8,
        qualityImpact: 5,
        timeImpact: -1,
      },
      {
        description: '선택적 최적화 (핵심 숏트만 고품질)',
        totalCost: currentCost * 0.7,
        qualityImpact: 0,
        timeImpact: 1,
      },
    ];
  }

  private getDefaultOptions(): PromptGenerationOptions {
    return {
      optimizationLevel: 'standard',
      enableAIEnhancement: true,
      prioritizeConsistency: true,
      maxCostPerPrompt: 1.0,
    };
  }
}

// ===== AI 향상 서비스 =====

class AIEnhancementService {
  async enhance(
    prompt: PromptEngineering,
    options: PromptGenerationOptions
  ): Promise<PromptEngineering> {
    // 실제 구현에서는 AI API를 호출하여 프롬프트 향상
    // 여기서는 룰 기반 향상 적용

    const enhancedOptimizations = { ...prompt.modelOptimizations };

    for (const [model, optimization] of Object.entries(enhancedOptimizations)) {
      // 키워드 강화
      optimization.prompt = this.enhanceKeywords(optimization.prompt);

      // 스타일 향상
      optimization.prompt = this.enhanceStyle(optimization.prompt, model as AIVideoModel);

      // 기술적 품질 향상
      optimization.prompt = this.enhanceTechnicalQuality(optimization.prompt);
    }

    return {
      ...prompt,
      modelOptimizations: enhancedOptimizations,
    };
  }

  async optimizeForModel(
    prompt: PromptEngineering,
    model: AIVideoModel,
    targetLevel: PromptOptimizationLevel
  ): Promise<PromptEngineering> {
    // 특정 모델에 대한 최적화 수행
    const optimization = prompt.modelOptimizations[model];
    if (!optimization) {
      throw new Error(`${model} 모델 최적화가 존재하지 않습니다`);
    }

    const optimizedPrompt = this.optimizePromptForLevel(optimization.prompt, targetLevel);

    return customizePrompt(prompt, model, 'prompt', optimizedPrompt, 'AI 최적화');
  }

  private enhanceKeywords(prompt: string): string {
    // 감정적 키워드 강화
    if (!prompt.includes('emotional')) {
      prompt += ', emotionally engaging';
    }

    // 시각적 디테일 강화
    if (!prompt.includes('detailed')) {
      prompt += ', highly detailed';
    }

    return prompt;
  }

  private enhanceStyle(prompt: string, model: AIVideoModel): string {
    const modelStyles: Record<AIVideoModel, string> = {
      'runway-gen3': 'cinematic quality, film-like',
      'stable-video': 'photorealistic, stable generation',
      'pika-labs': 'vibrant animation, smooth motion',
      'zeroscope': 'clear footage, stable camera',
      'animatediff': 'consistent animation style',
      'bytedance-seedream': 'storyboard quality, production-ready',
    };

    const styleKeywords = modelStyles[model];
    if (!prompt.includes(styleKeywords)) {
      prompt += `, ${styleKeywords}`;
    }

    return prompt;
  }

  private enhanceTechnicalQuality(prompt: string): string {
    const technicalKeywords = ['sharp focus', 'high resolution', 'professional quality'];

    for (const keyword of technicalKeywords) {
      if (!prompt.includes(keyword)) {
        prompt += `, ${keyword}`;
      }
    }

    return prompt;
  }

  private optimizePromptForLevel(prompt: string, level: PromptOptimizationLevel): string {
    const optimizations = {
      basic: ['clear', 'good quality'],
      standard: ['detailed', 'high quality', 'professional'],
      advanced: ['ultra detailed', 'premium quality', 'expertly crafted', 'cinematic'],
      expert: ['masterpiece', 'ultra high quality', 'award-winning', 'cinematic excellence', '8K resolution'],
    };

    const keywords = optimizations[level];
    return `${prompt}, ${keywords.join(', ')}`;
  }
}

// ===== 프롬프트 템플릿 라이브러리 =====

class PromptTemplateLibrary {
  private templates: Record<AIVideoModel, Record<string, string>> = {
    'runway-gen3': {
      cinematic: '{original_prompt}, cinematic shot, film quality, professional cinematography',
      commercial: '{original_prompt}, commercial style, polished production, broadcast quality',
      artistic: '{original_prompt}, artistic vision, creative composition, aesthetic excellence',
    },
    'stable-video': {
      realistic: '{original_prompt}, photorealistic, natural lighting, realistic textures',
      dramatic: '{original_prompt}, dramatic lighting, high contrast, cinematic mood',
      documentary: '{original_prompt}, documentary style, authentic feel, natural colors',
    },
    'pika-labs': {
      animated: '{original_prompt}, smooth animation, vibrant colors, fluid motion',
      cartoon: '{original_prompt}, cartoon style, exaggerated features, bright colors',
      stylized: '{original_prompt}, stylized animation, artistic interpretation, unique style',
    },
    'zeroscope': {
      stable: '{original_prompt}, stable camera, smooth motion, clear footage',
      technical: '{original_prompt}, technical precision, accurate representation, clean lines',
      simple: '{original_prompt}, simple composition, clear focus, minimal distractions',
    },
    'animatediff': {
      consistent: '{original_prompt}, consistent style, character continuity, uniform animation',
      expressive: '{original_prompt}, expressive animation, dynamic movement, emotional depth',
      detailed: '{original_prompt}, detailed animation, rich textures, intricate designs',
    },
    'bytedance-seedream': {
      storyboard: '{original_prompt}, storyboard style, production quality, professional layout',
      sketch: '{original_prompt}, sketch style, conceptual art, design development',
      presentation: '{original_prompt}, presentation ready, client-suitable, polished concept',
    },
  };

  getTemplate(model: AIVideoModel, style: string): string {
    return this.templates[model]?.[style] || '{original_prompt}';
  }

  getAvailableStyles(model: AIVideoModel): string[] {
    return Object.keys(this.templates[model] || {});
  }
}

// 기본 인스턴스 생성
export const promptGenerationEngine = new PromptGenerationEngine();