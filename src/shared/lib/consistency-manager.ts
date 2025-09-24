/**
 * 일관성 관리자 (Consistency Manager)
 * 콘티 이미지 간 일관성 유지를 위한 핵심 시스템
 *
 * 기능:
 * - 첫 번째 이미지에서 특징 추출
 * - 후속 이미지 생성 시 일관성 특징 적용
 * - 가중치 기반 일관성 제어
 * - 스타일별 최적화 전략
 */

import { z } from 'zod';

// 일관성 특징 스키마
export const consistencyFeaturesSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualFeatures: z.array(z.string()),
    importance: z.number().min(0).max(1).default(0.8),
  })),
  locations: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualElements: z.array(z.string()),
    importance: z.number().min(0).max(1).default(0.6),
  })),
  objects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    visualProperties: z.array(z.string()),
    importance: z.number().min(0).max(1).default(0.7),
  })),
  style: z.object({
    name: z.string(),
    description: z.string(),
    visualCharacteristics: z.array(z.string()),
    colorPalette: z.array(z.string()),
    technique: z.string(),
    importance: z.number().min(0).max(1).default(0.7),
  }),
  composition: z.object({
    frameType: z.string(), // 'close-up', 'medium', 'wide'
    cameraAngle: z.string(), // 'eye-level', 'high', 'low'
    lighting: z.string(), // 'natural', 'dramatic', 'soft'
    importance: z.number().min(0).max(1).default(0.5),
  }),
  extractedAt: z.string(),
  confidence: z.number().min(0).max(1),
});

export type ConsistencyFeatures = z.infer<typeof consistencyFeaturesSchema>;

// 일관성 적용 설정
export const consistencyConfigSchema = z.object({
  weights: z.object({
    characters: z.number().min(0).max(1).default(0.8),
    locations: z.number().min(0).max(1).default(0.6),
    objects: z.number().min(0).max(1).default(0.7),
    style: z.number().min(0).max(1).default(0.7),
    composition: z.number().min(0).max(1).default(0.5),
  }).default({
    characters: 0.8,
    locations: 0.6,
    objects: 0.7,
    style: 0.7,
    composition: 0.5,
  }),
  styleAdaptation: z.object({
    pencil: z.object({
      emphasizeLines: z.boolean().default(true),
      softShading: z.boolean().default(true),
      detailLevel: z.enum(['low', 'medium', 'high']).default('medium'),
    }),
    rough: z.object({
      sketchyLines: z.boolean().default(true),
      incompleteForms: z.boolean().default(true),
      energeticStrokes: z.boolean().default(true),
    }),
    monochrome: z.object({
      grayScale: z.boolean().default(true),
      contrastEnhancement: z.boolean().default(true),
      shadowEmphasis: z.boolean().default(true),
    }),
    colored: z.object({
      vibrantColors: z.boolean().default(true),
      colorHarmony: z.boolean().default(true),
      realisticShading: z.boolean().default(true),
    }),
  }).default({
    pencil: {
      emphasizeLines: true,
      softShading: true,
      detailLevel: 'medium' as const,
    },
    rough: {
      sketchyLines: true,
      incompleteForms: true,
      energeticStrokes: true,
    },
    monochrome: {
      grayScale: true,
      contrastEnhancement: true,
      shadowEmphasis: true,
    },
    colored: {
      vibrantColors: true,
      colorHarmony: true,
      realisticShading: true,
    },
  }),
  adaptationStrength: z.number().min(0).max(1).default(0.8),
});

export type ConsistencyConfig = z.infer<typeof consistencyConfigSchema>;

/**
 * 일관성 관리자 클래스
 * 이미지 간 일관성 유지를 위한 핵심 로직 관리
 */
export class ConsistencyManager {
  private config: ConsistencyConfig;
  private extractedFeatures: ConsistencyFeatures | null = null;

  constructor(config?: Partial<ConsistencyConfig>) {
    this.config = consistencyConfigSchema.parse(config || {});
  }

  /**
   * 첫 번째 이미지에서 일관성 특징 추출
   * AI API나 이미지 분석을 통해 특징을 추출하고 구조화
   */
  async extractFeatures(
    imageUrl: string,
    prompt: string,
    style: 'pencil' | 'rough' | 'monochrome' | 'colored'
  ): Promise<ConsistencyFeatures> {
    try {
      // 프롬프트 분석을 통한 초기 특징 추출
      const promptFeatures = this.analyzePromptForFeatures(prompt);

      // 스타일별 특징 강화
      const styleEnhancedFeatures = this.enhanceFeaturesByStyle(promptFeatures, style);

      // 일관성 특징 객체 생성
      const features: ConsistencyFeatures = {
        characters: styleEnhancedFeatures.characters.map((char: any) => ({
          name: char.name,
          description: char.description,
          visualFeatures: char.features,
          importance: this.config.weights.characters,
        })),
        locations: styleEnhancedFeatures.locations.map((loc: any) => ({
          name: loc.name,
          description: loc.description,
          visualElements: loc.elements,
          importance: this.config.weights.locations,
        })),
        objects: styleEnhancedFeatures.objects.map((obj: any) => ({
          name: obj.name,
          description: obj.description,
          visualProperties: obj.properties,
          importance: this.config.weights.objects,
        })),
        style: {
          name: style,
          description: this.getStyleDescription(style),
          visualCharacteristics: this.getStyleCharacteristics(style),
          colorPalette: this.getStyleColorPalette(style),
          technique: this.getStyleTechnique(style),
          importance: this.config.weights.style,
        },
        composition: {
          frameType: this.extractFrameType(prompt),
          cameraAngle: this.extractCameraAngle(prompt),
          lighting: this.extractLighting(prompt),
          importance: this.config.weights.composition,
        },
        extractedAt: new Date().toISOString(),
        confidence: 0.85, // 기본 신뢰도
      };

      this.extractedFeatures = features;
      return features;
    } catch (error) {
      console.error('특징 추출 실패:', error);
      throw new Error('일관성 특징 추출에 실패했습니다');
    }
  }

  /**
   * 일관성 특징을 적용하여 프롬프트 생성
   * 후속 이미지 생성 시 사용할 프롬프트에 일관성 특징 적용
   */
  applyConsistencyToPrompt(
    originalPrompt: string,
    features: ConsistencyFeatures,
    shotIndex: number
  ): string {
    if (!features) {
      return originalPrompt;
    }

    let enhancedPrompt = originalPrompt;

    // 캐릭터 일관성 적용
    if (features.characters.length > 0 && this.config.weights.characters > 0) {
      const characterDescriptions = features.characters
        .filter(char => char.importance > 0.5)
        .map(char => `${char.name}: ${char.visualFeatures.join(', ')}`)
        .join('; ');
      enhancedPrompt += `. Characters: ${characterDescriptions}`;
    }

    // 위치/배경 일관성 적용
    if (features.locations.length > 0 && this.config.weights.locations > 0) {
      const locationDescriptions = features.locations
        .filter(loc => loc.importance > 0.4)
        .map(loc => `${loc.name}: ${loc.visualElements.join(', ')}`)
        .join('; ');
      enhancedPrompt += `. Setting: ${locationDescriptions}`;
    }

    // 객체 일관성 적용
    if (features.objects.length > 0 && this.config.weights.objects > 0) {
      const objectDescriptions = features.objects
        .filter(obj => obj.importance > 0.5)
        .map(obj => `${obj.name}: ${obj.visualProperties.join(', ')}`)
        .join('; ');
      enhancedPrompt += `. Objects: ${objectDescriptions}`;
    }

    // 스타일 일관성 적용
    if (features.style && this.config.weights.style > 0) {
      const styleDescription = `${features.style.name} style: ${features.style.visualCharacteristics.join(', ')}`;
      enhancedPrompt += `. Style: ${styleDescription}`;
    }

    // 구도 일관성 적용 (필요한 경우)
    if (features.composition && this.config.weights.composition > 0) {
      enhancedPrompt += `. Composition: ${features.composition.frameType} shot, ${features.composition.cameraAngle} angle, ${features.composition.lighting} lighting`;
    }

    // 샷 진행도에 따른 일관성 강도 조절
    const progressRatio = shotIndex / 12; // 12개 샷 기준
    const consistencyStrength = this.config.adaptationStrength * (1 - progressRatio * 0.2); // 후반으로 갈수록 약간 완화

    enhancedPrompt += `. Consistency: maintain ${Math.round(consistencyStrength * 100)}% visual consistency with previous frames`;

    return enhancedPrompt;
  }

  /**
   * 특징 업데이트
   * 새로운 이미지가 생성될 때마다 특징을 점진적으로 업데이트
   */
  updateFeatures(newFeatures: Partial<ConsistencyFeatures>): void {
    if (!this.extractedFeatures) return;

    // 캐릭터 특징 업데이트 (새로운 시각적 특징 추가)
    if (newFeatures.characters) {
      this.extractedFeatures.characters = this.mergeCharacterFeatures(
        this.extractedFeatures.characters,
        newFeatures.characters
      );
    }

    // 위치 특징 업데이트
    if (newFeatures.locations) {
      this.extractedFeatures.locations = this.mergeLocationFeatures(
        this.extractedFeatures.locations,
        newFeatures.locations
      );
    }

    // 신뢰도 조정 (더 많은 데이터로 신뢰도 증가)
    this.extractedFeatures.confidence = Math.min(
      this.extractedFeatures.confidence + 0.05,
      0.95
    );
  }

  /**
   * 프롬프트에서 특징 분석
   */
  private analyzePromptForFeatures(prompt: string) {
    // 간단한 키워드 기반 분석 (실제로는 더 정교한 NLP 사용)
    const characters: any[] = [];
    const locations: any[] = [];
    const objects: any[] = [];

    // 캐릭터 키워드 감지
    const characterKeywords = ['man', 'woman', 'child', 'person', 'character', 'hero', 'protagonist'];
    characterKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        characters.push({
          name: keyword,
          description: `A ${keyword} character`,
          features: ['consistent appearance', 'recognizable features'],
        });
      }
    });

    // 위치 키워드 감지
    const locationKeywords = ['room', 'street', 'forest', 'building', 'landscape', 'indoor', 'outdoor'];
    locationKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        locations.push({
          name: keyword,
          description: `A ${keyword} location`,
          elements: ['consistent architecture', 'similar lighting'],
        });
      }
    });

    // 객체 키워드 감지
    const objectKeywords = ['car', 'table', 'chair', 'door', 'window', 'tree', 'building'];
    objectKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) {
        objects.push({
          name: keyword,
          description: `A ${keyword} object`,
          properties: ['consistent design', 'similar materials'],
        });
      }
    });

    return { characters, locations, objects };
  }

  /**
   * 스타일별 특징 강화
   */
  private enhanceFeaturesByStyle(features: any, style: string) {
    const styleConfig = this.config.styleAdaptation[style as keyof typeof this.config.styleAdaptation];

    // 스타일별 특징 강화 로직
    switch (style) {
      case 'pencil':
        features.characters.forEach((char: any) => {
          char.features.push('pencil sketch lines', 'soft shading');
        });
        break;
      case 'rough':
        features.characters.forEach((char: any) => {
          char.features.push('sketchy outlines', 'energetic strokes');
        });
        break;
      case 'monochrome':
        features.characters.forEach((char: any) => {
          char.features.push('grayscale values', 'high contrast');
        });
        break;
      case 'colored':
        features.characters.forEach((char: any) => {
          char.features.push('vibrant colors', 'realistic shading');
        });
        break;
    }

    return features;
  }

  /**
   * 스타일 설명 및 특성 정의
   */
  private getStyleDescription(style: string): string {
    const descriptions = {
      pencil: 'Hand-drawn pencil sketch with soft lines and gentle shading',
      rough: 'Quick sketch with energetic, loose strokes and incomplete forms',
      monochrome: 'Black and white artwork with strong contrast and tonal values',
      colored: 'Full-color illustration with vibrant hues and realistic rendering',
    };
    return descriptions[style as keyof typeof descriptions] || style;
  }

  private getStyleCharacteristics(style: string): string[] {
    const characteristics = {
      pencil: ['soft lines', 'gentle shading', 'paper texture', 'graphite appearance'],
      rough: ['energetic strokes', 'loose sketching', 'incomplete lines', 'dynamic movement'],
      monochrome: ['grayscale palette', 'high contrast', 'tonal values', 'black and white'],
      colored: ['vibrant colors', 'realistic shading', 'color harmony', 'full spectrum'],
    };
    return characteristics[style as keyof typeof characteristics] || [];
  }

  private getStyleColorPalette(style: string): string[] {
    const palettes = {
      pencil: ['#2B2B2B', '#4A4A4A', '#6B6B6B', '#8C8C8C', '#ADADAD'],
      rough: ['#1A1A1A', '#333333', '#666666', '#999999', '#CCCCCC'],
      monochrome: ['#000000', '#333333', '#666666', '#999999', '#FFFFFF'],
      colored: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'],
    };
    return palettes[style as keyof typeof palettes] || [];
  }

  private getStyleTechnique(style: string): string {
    const techniques = {
      pencil: 'traditional pencil drawing with cross-hatching and blending',
      rough: 'quick gesture drawing with confident, loose strokes',
      monochrome: 'ink wash or charcoal technique with tonal modeling',
      colored: 'digital painting or colored pencil with realistic rendering',
    };
    return techniques[style as keyof typeof techniques] || style;
  }

  /**
   * 프롬프트에서 구도 요소 추출
   */
  private extractFrameType(prompt: string): string {
    const frameKeywords = {
      'close-up': ['close up', 'close-up', 'face', 'portrait', 'detail'],
      'medium': ['medium shot', 'waist up', 'half body', 'medium'],
      'wide': ['wide shot', 'full body', 'landscape', 'environment', 'establishing'],
    };

    for (const [frameType, keywords] of Object.entries(frameKeywords)) {
      if (keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
        return frameType;
      }
    }
    return 'medium'; // 기본값
  }

  private extractCameraAngle(prompt: string): string {
    const angleKeywords = {
      'high': ['high angle', 'bird\'s eye', 'overhead', 'looking down'],
      'low': ['low angle', 'worm\'s eye', 'looking up', 'from below'],
      'eye-level': ['eye level', 'straight on', 'normal angle'],
    };

    for (const [angle, keywords] of Object.entries(angleKeywords)) {
      if (keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
        return angle;
      }
    }
    return 'eye-level'; // 기본값
  }

  private extractLighting(prompt: string): string {
    const lightingKeywords = {
      'dramatic': ['dramatic', 'high contrast', 'chiaroscuro', 'moody'],
      'soft': ['soft light', 'gentle', 'diffused', 'natural'],
      'natural': ['daylight', 'sunlight', 'natural light', 'outdoor'],
    };

    for (const [lighting, keywords] of Object.entries(lightingKeywords)) {
      if (keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
        return lighting;
      }
    }
    return 'natural'; // 기본값
  }

  /**
   * 캐릭터 특징 병합
   */
  private mergeCharacterFeatures(existing: any[], newFeatures: any[]): any[] {
    // 기존 특징과 새로운 특징을 병합하는 로직
    return existing.map(existingChar => {
      const matchingNew = newFeatures.find(newChar => newChar.name === existingChar.name);
      if (matchingNew) {
        return {
          ...existingChar,
          visualFeatures: [...new Set([...existingChar.visualFeatures, ...matchingNew.visualFeatures])],
        };
      }
      return existingChar;
    });
  }

  /**
   * 위치 특징 병합
   */
  private mergeLocationFeatures(existing: any[], newFeatures: any[]): any[] {
    return existing.map(existingLoc => {
      const matchingNew = newFeatures.find(newLoc => newLoc.name === existingLoc.name);
      if (matchingNew) {
        return {
          ...existingLoc,
          visualElements: [...new Set([...existingLoc.visualElements, ...matchingNew.visualElements])],
        };
      }
      return existingLoc;
    });
  }

  /**
   * 현재 추출된 특징 조회
   */
  getExtractedFeatures(): ConsistencyFeatures | null {
    return this.extractedFeatures;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<ConsistencyConfig>): void {
    this.config = consistencyConfigSchema.parse({
      ...this.config,
      ...newConfig,
    });
  }

  /**
   * 일관성 품질 점수 계산
   */
  calculateConsistencyScore(prompt1: string, prompt2: string): number {
    // 두 프롬프트 간 일관성 점수 계산 (0-1)
    // 실제로는 더 정교한 벡터 유사도 계산 사용
    const words1 = new Set(prompt1.toLowerCase().split(' '));
    const words2 = new Set(prompt2.toLowerCase().split(' '));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}

// 기본 일관성 관리자 인스턴스
let defaultConsistencyManager: ConsistencyManager | null = null;

export function getConsistencyManager(config?: Partial<ConsistencyConfig>): ConsistencyManager {
  if (!defaultConsistencyManager) {
    defaultConsistencyManager = new ConsistencyManager(config);
  }
  return defaultConsistencyManager;
}

export default ConsistencyManager;