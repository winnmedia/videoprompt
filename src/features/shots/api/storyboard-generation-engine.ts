/**
 * Storyboard Generation Engine
 * 개별 숏트를 위한 콘티 생성 시스템
 * ByteDance API 활용한 이미지 생성
 */

import type {
  StoryboardGenerationRequest,
  StoryboardGenerationResponse,
  ShotGenerationError
} from '../types';
import type { ShotStoryboard, TwelveShot } from '../../../entities/Shot';

export class StoryboardGenerationEngine {
  private readonly BASE_STYLE_PROMPTS = {
    sketch: 'black and white pencil sketch, clean lines, detailed storyboard style',
    realistic: 'photorealistic, high detail, cinematic lighting, film quality',
    anime: 'anime style, clean animation look, detailed character design',
    cinematic: 'cinematic composition, dramatic lighting, film shot, professional'
  };

  private readonly LIGHTING_PROMPTS = {
    bright: 'bright natural lighting, well-lit, clear visibility',
    dim: 'low light, moody atmosphere, subtle shadows',
    dramatic: 'dramatic lighting, strong contrast, cinematic shadows',
    natural: 'natural daylight, soft shadows, realistic lighting',
    neon: 'neon lighting, colorful glow, urban night atmosphere',
    'golden-hour': 'golden hour lighting, warm sunset/sunrise, soft glow'
  };

  private readonly COLOR_PROMPTS = {
    warm: 'warm color palette, oranges and yellows, cozy atmosphere',
    cool: 'cool color palette, blues and greens, calm mood',
    monochrome: 'black and white, high contrast, dramatic',
    vibrant: 'vibrant colors, saturated, energetic mood',
    muted: 'muted colors, subtle tones, sophisticated palette',
    'high-contrast': 'high contrast colors, bold, striking visual'
  };

  async generateStoryboard(
    request: StoryboardGenerationRequest,
    shot: TwelveShot
  ): Promise<StoryboardGenerationResponse> {
    try {
      // Cost Safety: 호출 빈도 제한
      const cacheKey = `storyboard_${request.shotId}_${request.style || 'default'}`;

      // 기존 콘티가 있고 재생성이 아니라면 스킵
      if (!request.regenerate && shot.storyboard.status === 'completed') {
        return {
          success: true,
          storyboard: shot.storyboard
        };
      }

      // 1단계: 프롬프트 생성
      const prompt = this.buildStoryboardPrompt(shot, request);

      // 2단계: 이미지 생성 API 호출
      const imageResult = await this.generateImage(prompt, request.style || 'cinematic');

      if (!imageResult.success) {
        return {
          success: false,
          error: {
            type: 'api_error',
            message: '콘티 이미지 생성에 실패했습니다',
            retryable: true,
            timestamp: new Date().toISOString(),
            details: imageResult.error
          }
        };
      }

      // 3단계: 스토리보드 객체 생성
      const storyboard: ShotStoryboard = {
        id: shot.storyboard.id,
        shotId: shot.id,
        imageUrl: imageResult.imageUrl,
        prompt,
        style: request.style || 'cinematic',
        status: 'completed',
        generationAttempts: shot.storyboard.generationAttempts + 1,
        aiModel: 'bytedance',
        generatedAt: new Date().toISOString(),
        downloadUrl: imageResult.downloadUrl
      };

      return {
        success: true,
        storyboard,
        tokensUsed: this.estimateTokenUsage(prompt)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'unknown_error',
          message: error instanceof Error ? error.message : '콘티 생성 중 오류가 발생했습니다',
          retryable: true,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private buildStoryboardPrompt(
    shot: TwelveShot,
    request: StoryboardGenerationRequest
  ): string {
    // 커스텀 프롬프트가 있다면 우선 사용
    if (request.customPrompt) {
      return this.enhancePrompt(request.customPrompt, shot, request.style || 'cinematic');
    }

    // 기본 프롬프트 구성
    const basePrompt = this.buildBasePrompt(shot);
    const stylePrompt = this.BASE_STYLE_PROMPTS[request.style || 'cinematic'];
    const lightingPrompt = this.LIGHTING_PROMPTS[shot.lightingMood];
    const colorPrompt = this.COLOR_PROMPTS[shot.colorPalette];

    // 카메라 앵글 프롬프트
    const cameraPrompt = this.getCameraAnglePrompt(shot.shotType);

    // 감정/분위기 프롬프트
    const moodPrompt = this.getMoodPrompt(shot.emotion);

    return `${basePrompt}, ${cameraPrompt}, ${moodPrompt}, ${lightingPrompt}, ${colorPrompt}, ${stylePrompt}, storyboard frame, clean composition, professional quality`;
  }

  private buildBasePrompt(shot: TwelveShot): string {
    let prompt = shot.description;

    // 등장인물 추가
    if (shot.charactersInShot.length > 0) {
      prompt += `, featuring ${shot.charactersInShot.join(' and ')}`;
    }

    // 대사가 있다면 추가
    if (shot.dialogue) {
      prompt += `, with dialogue scene`;
    }

    return prompt;
  }

  private getCameraAnglePrompt(shotType: TwelveShot['shotType']): string {
    const cameraPrompts = {
      'extreme-wide': 'extreme wide shot, establishing shot, vast landscape or environment',
      'wide': 'wide shot, full body visible, environmental context',
      'medium-wide': 'medium wide shot, three-quarter body visible',
      'medium': 'medium shot, waist up, personal interaction',
      'medium-close': 'medium close-up, chest up, intimate conversation',
      'close-up': 'close-up shot, head and shoulders, emotional focus',
      'extreme-close-up': 'extreme close-up, face detail, intense emotion',
      'pov': 'point of view shot, first person perspective',
      'over-shoulder': 'over shoulder shot, conversation angle',
      'insert': 'insert shot, detail focus, specific object',
      'cutaway': 'cutaway shot, reaction or environment',
      'establishing': 'establishing shot, location setting'
    };

    return cameraPrompts[shotType] || 'medium shot';
  }

  private getMoodPrompt(emotion: TwelveShot['emotion']): string {
    const moodPrompts = {
      'neutral': 'calm neutral mood',
      'tension': 'tense atmosphere, suspenseful mood',
      'excitement': 'exciting energy, dynamic action',
      'calm': 'peaceful serene atmosphere',
      'mystery': 'mysterious atmosphere, intriguing mood',
      'romance': 'romantic mood, intimate atmosphere',
      'action': 'action-packed, dynamic movement',
      'drama': 'dramatic intensity, emotional weight',
      'comedy': 'light-hearted, humorous mood',
      'horror': 'scary atmosphere, ominous mood',
      'sadness': 'melancholic mood, emotional sadness',
      'hope': 'hopeful atmosphere, optimistic mood'
    };

    return moodPrompts[emotion] || 'neutral mood';
  }

  private enhancePrompt(
    customPrompt: string,
    shot: TwelveShot,
    style: ShotStoryboard['style']
  ): string {
    const styleEnhancement = this.BASE_STYLE_PROMPTS[style];
    const cameraEnhancement = this.getCameraAnglePrompt(shot.shotType);

    return `${customPrompt}, ${cameraEnhancement}, ${styleEnhancement}`;
  }

  private async generateImage(
    prompt: string,
    style: ShotStoryboard['style']
  ): Promise<{
    success: boolean;
    imageUrl?: string;
    downloadUrl?: string;
    error?: any;
  }> {
    try {
      // Cost Safety: 실제 이미지 생성 API 호출 대신 시뮬레이션
      console.log('이미지 생성 시뮬레이션:', prompt.slice(0, 100));

      // 실제 구현에서는 ByteDance API 호출
      // const result = await byteDanceAPI.generateImage({
      //   prompt,
      //   style,
      //   width: 1024,
      //   height: 576, // 16:9 비율
      //   quality: 'high'
      // });

      // 시뮬레이션된 성공 응답
      const mockImageUrl = `https://placeholder.pics/svg/1024x576/DEDEDE/555555/${encodeURIComponent('Shot ' + Date.now())}`;

      return {
        success: true,
        imageUrl: mockImageUrl,
        downloadUrl: mockImageUrl // 실제로는 고해상도 다운로드 URL
      };

    } catch (error) {
      console.error('이미지 생성 실패:', error);
      return {
        success: false,
        error
      };
    }
  }

  async batchGenerateStoryboards(
    shots: TwelveShot[],
    style: ShotStoryboard['style'] = 'cinematic',
    progressCallback?: (completed: number, total: number) => void
  ): Promise<{
    success: boolean;
    results: Array<{
      shotId: string;
      storyboard?: ShotStoryboard;
      error?: ShotGenerationError;
    }>;
  }> {
    const results: Array<{
      shotId: string;
      storyboard?: ShotStoryboard;
      error?: ShotGenerationError;
    }> = [];

    // 순차적으로 생성 (API 제한 고려)
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];

      try {
        const request: StoryboardGenerationRequest = {
          shotId: shot.id,
          collectionId: shot.storyId,
          style,
          regenerate: false
        };

        const result = await this.generateStoryboard(request, shot);

        if (result.success && result.storyboard) {
          results.push({
            shotId: shot.id,
            storyboard: result.storyboard
          });
        } else {
          results.push({
            shotId: shot.id,
            error: result.error
          });
        }

        progressCallback?.(i + 1, shots.length);

        // Cost Safety: API 호출 간 딜레이
        if (i < shots.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        results.push({
          shotId: shot.id,
          error: {
            type: 'unknown_error',
            message: error instanceof Error ? error.message : '알 수 없는 오류',
            retryable: true,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    const successCount = results.filter(r => r.storyboard).length;

    return {
      success: successCount > 0,
      results
    };
  }

  private estimateTokenUsage(prompt: string): number {
    // 이미지 생성의 경우 텍스트 토큰 사용량이 적음
    return Math.round(prompt.length / 4) + 50; // 기본 오버헤드
  }

  // 스타일별 추천 설정
  getStyleRecommendations(shotType: TwelveShot['shotType'], emotion: TwelveShot['emotion']): {
    recommendedStyle: ShotStoryboard['style'];
    alternativeStyles: ShotStoryboard['style'][];
    tips: string[];
  } {
    // 샷 타입과 감정에 따른 스타일 추천
    let recommendedStyle: ShotStoryboard['style'] = 'cinematic';
    const alternativeStyles: ShotStoryboard['style'][] = [];
    const tips: string[] = [];

    if (emotion === 'action' || emotion === 'excitement') {
      recommendedStyle = 'realistic';
      alternativeStyles.push('cinematic', 'sketch');
      tips.push('액션 장면은 현실적인 스타일이 효과적입니다');
    } else if (emotion === 'comedy') {
      recommendedStyle = 'anime';
      alternativeStyles.push('sketch', 'realistic');
      tips.push('코미디 장면은 애니메이션 스타일이 재미있게 표현됩니다');
    } else if (shotType === 'close-up' || shotType === 'extreme-close-up') {
      recommendedStyle = 'realistic';
      alternativeStyles.push('cinematic', 'sketch');
      tips.push('클로즈업은 디테일한 현실적 스타일이 좋습니다');
    } else {
      recommendedStyle = 'cinematic';
      alternativeStyles.push('realistic', 'sketch', 'anime');
      tips.push('영화적 스타일은 전반적인 스토리보드에 적합합니다');
    }

    return {
      recommendedStyle,
      alternativeStyles,
      tips
    };
  }
}