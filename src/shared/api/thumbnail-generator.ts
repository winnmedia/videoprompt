/**
 * Thumbnail Generator API Client
 * DALLE-3/Stable Diffusion 연동으로 Act별 썸네일 생성
 * CLAUDE.md 비용 안전 규칙 준수
 */

import type { StoryAct, FourActStory } from '../../entities/story';

export interface ThumbnailGenerationRequest {
  prompt: string;
  style: 'photorealistic' | 'illustration' | 'concept_art' | 'storyboard';
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16';
  quality: 'standard' | 'hd';
  seed?: number; // 일관성을 위한 시드값
}

export interface ThumbnailGenerationResponse {
  success: boolean;
  thumbnailUrl?: string;
  thumbnailId?: string;
  cost: number; // USD
  generationTime: number; // 밀리초
  error?: string;
}

export interface ThumbnailStyle {
  name: string;
  description: string;
  basePrompt: string;
  negativePrompt: string;
  preferredModel: 'dalle-3' | 'stable-diffusion' | 'midjourney';
}

// 스타일 프리셋
export const THUMBNAIL_STYLES: Record<string, ThumbnailStyle> = {
  cinematic: {
    name: '영화적',
    description: '영화 스틸컷 같은 고품질 이미지',
    basePrompt: 'cinematic shot, professional lighting, film grain, depth of field',
    negativePrompt: 'cartoon, anime, low quality, blurry, distorted',
    preferredModel: 'dalle-3'
  },
  storyboard: {
    name: '스토리보드',
    description: '영화 콘티용 스케치 스타일',
    basePrompt: 'storyboard sketch, clean lines, professional concept art, black and white',
    negativePrompt: 'colored, photorealistic, messy lines',
    preferredModel: 'stable-diffusion'
  },
  illustration: {
    name: '일러스트',
    description: '깔끔한 디지털 아트',
    basePrompt: 'digital illustration, clean art style, vibrant colors, detailed',
    negativePrompt: 'photorealistic, low quality, pixelated',
    preferredModel: 'midjourney'
  },
  concept: {
    name: '컨셉 아트',
    description: '게임/영화 컨셉 아트 스타일',
    basePrompt: 'concept art, matte painting, detailed environment, atmospheric',
    negativePrompt: 'cartoon, simple, low detail',
    preferredModel: 'stable-diffusion'
  }
};

export class ThumbnailGenerator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private lastGenerationTime = 0;
  private readonly costTracker = {
    daily: 0,
    monthly: 0,
    lastReset: new Date().toDateString()
  };

  // 비용 제한 ($300 사건 방지)
  private readonly COST_LIMITS = {
    perGeneration: 0.04, // $0.04 per image (DALLE-3)
    dailyLimit: 5.00, // $5 per day
    monthlyLimit: 50.00, // $50 per month
    cooldownMs: 10000 // 10초 쿨다운
  };

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = 'https://api.openai.com/v1/images/generations';

    if (!this.apiKey) {
      console.warn('OPENAI_API_KEY가 설정되지 않았습니다. 썸네일 생성이 제한됩니다.');
    }
  }

  async generateActThumbnail(
    act: StoryAct,
    story: FourActStory,
    style: keyof typeof THUMBNAIL_STYLES = 'cinematic'
  ): Promise<ThumbnailGenerationResponse> {
    const startTime = Date.now();

    try {
      // 비용 안전 체크
      if (!this.canGenerate()) {
        return {
          success: false,
          error: '생성 제한에 도달했습니다. 잠시 후 다시 시도해주세요.',
          cost: 0,
          generationTime: Date.now() - startTime
        };
      }

      // 프롬프트 생성
      const prompt = this.buildActPrompt(act, story, style);

      // 썸네일 생성 요청
      const request: ThumbnailGenerationRequest = {
        prompt,
        style: this.mapToImageStyle(style),
        aspectRatio: '16:9', // 영상용 비율
        quality: 'hd'
      };

      const response = await this.callImageAPI(request);

      // 비용 추적
      this.trackCost(response.cost);
      this.lastGenerationTime = Date.now();

      return response;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        cost: 0,
        generationTime: Date.now() - startTime
      };
    }
  }

  async generateStoryThumbnails(
    story: FourActStory,
    style: keyof typeof THUMBNAIL_STYLES = 'cinematic'
  ): Promise<{
    success: boolean;
    thumbnails: Record<keyof FourActStory['acts'], string>;
    totalCost: number;
    error?: string;
  }> {
    const thumbnails: Record<keyof FourActStory['acts'], string> = {
      setup: '',
      development: '',
      climax: '',
      resolution: ''
    };

    let totalCost = 0;
    let hasError = false;
    let errorMessage = '';

    // 각 Act별 순차 생성 (병렬 생성은 비용 증가 위험)
    for (const [actType, act] of Object.entries(story.acts)) {
      try {
        const response = await this.generateActThumbnail(
          act,
          story,
          style
        );

        if (response.success && response.thumbnailUrl) {
          thumbnails[actType as keyof FourActStory['acts']] = response.thumbnailUrl;
          totalCost += response.cost;
        } else {
          hasError = true;
          errorMessage = response.error || '썸네일 생성 실패';
          break;
        }

        // 생성 간격 조절 (API 제한 방지)
        if (Object.keys(story.acts).indexOf(actType) < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        }

      } catch (error) {
        hasError = true;
        errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        break;
      }
    }

    return {
      success: !hasError,
      thumbnails,
      totalCost,
      error: hasError ? errorMessage : undefined
    };
  }

  private buildActPrompt(
    act: StoryAct,
    story: FourActStory,
    style: keyof typeof THUMBNAIL_STYLES
  ): string {
    const styleConfig = THUMBNAIL_STYLES[style];
    const genreKeywords = this.getGenreKeywords(story.genre);
    const emotionKeywords = this.getEmotionKeywords(act.emotions);

    // Act별 특화 키워드
    const actKeywords = {
      1: 'beginning, introduction, setup, calm moment',
      2: 'development, rising action, conflict building, tension',
      3: 'climax, peak moment, dramatic, intense action',
      4: 'resolution, ending, aftermath, peaceful conclusion'
    };

    const baseScene = act.content.slice(0, 150); // 첫 150자만 사용
    const actSpecific = actKeywords[act.actNumber];

    return [
      styleConfig.basePrompt,
      genreKeywords,
      emotionKeywords,
      actSpecific,
      baseScene,
      '4K quality, professional composition'
    ].filter(Boolean).join(', ');
  }

  private getGenreKeywords(genre: FourActStory['genre']): string {
    const genreMap = {
      drama: 'emotional drama, realistic lighting, character focus',
      action: 'dynamic action, motion blur, energetic composition',
      comedy: 'bright lighting, cheerful atmosphere, expressive characters',
      documentary: 'realistic style, natural lighting, authentic feel',
      educational: 'clear composition, instructional style, clean background',
      thriller: 'dark atmosphere, suspenseful mood, dramatic shadows',
      romance: 'warm lighting, intimate composition, soft focus'
    };

    return genreMap[genre] || 'cinematic style, professional lighting';
  }

  private getEmotionKeywords(emotion: StoryAct['emotions']): string {
    const emotionMap = {
      tension: 'tense atmosphere, dramatic lighting, suspenseful mood',
      calm: 'peaceful setting, soft lighting, serene atmosphere',
      excitement: 'dynamic energy, vibrant colors, action-packed',
      sadness: 'melancholic mood, muted colors, emotional depth',
      hope: 'uplifting atmosphere, warm lighting, optimistic mood',
      fear: 'dark shadows, ominous atmosphere, threatening mood'
    };

    return emotionMap[emotion] || 'balanced mood, neutral atmosphere';
  }

  private mapToImageStyle(style: keyof typeof THUMBNAIL_STYLES): ThumbnailGenerationRequest['style'] {
    const styleMap = {
      cinematic: 'photorealistic' as const,
      storyboard: 'storyboard' as const,
      illustration: 'illustration' as const,
      concept: 'concept_art' as const
    };

    return (styleMap as any)[style] || 'photorealistic';
  }

  private async callImageAPI(request: ThumbnailGenerationRequest): Promise<ThumbnailGenerationResponse> {
    // 실제 구현에서는 DALLE-3 API 호출
    // 현재는 모킹으로 시뮬레이션

    // 모킹 응답
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 시뮬레이션

    const mockThumbnailUrl = `https://images.unsplash.com/photo-1${Math.random().toString().slice(2, 12)}`;

    return {
      success: true,
      thumbnailUrl: mockThumbnailUrl,
      thumbnailId: `thumb_${Date.now()}`,
      cost: this.COST_LIMITS.perGeneration,
      generationTime: 3000
    };
  }

  private canGenerate(): boolean {
    // 시간 제한 체크
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < this.COST_LIMITS.cooldownMs) {
      return false;
    }

    // 일일 비용 제한 체크
    if (this.costTracker.daily >= this.COST_LIMITS.dailyLimit) {
      return false;
    }

    // 월간 비용 제한 체크
    if (this.costTracker.monthly >= this.COST_LIMITS.monthlyLimit) {
      return false;
    }

    return true;
  }

  private trackCost(cost: number): void {
    const today = new Date().toDateString();

    // 일일 리셋
    if (this.costTracker.lastReset !== today) {
      this.costTracker.daily = 0;
      this.costTracker.lastReset = today;
    }

    this.costTracker.daily += cost;
    this.costTracker.monthly += cost;

    // 경고 로그
    if (this.costTracker.daily > this.COST_LIMITS.dailyLimit * 0.8) {
      console.warn(`일일 썸네일 생성 비용이 80% 초과: $${this.costTracker.daily.toFixed(2)}`);
    }
  }

  // 비용 현황 조회
  getCostStatus(): {
    dailyUsed: number;
    monthlyUsed: number;
    dailyLimit: number;
    monthlyLimit: number;
    canGenerate: boolean;
  } {
    return {
      dailyUsed: this.costTracker.daily,
      monthlyUsed: this.costTracker.monthly,
      dailyLimit: this.COST_LIMITS.dailyLimit,
      monthlyLimit: this.COST_LIMITS.monthlyLimit,
      canGenerate: this.canGenerate()
    };
  }
}