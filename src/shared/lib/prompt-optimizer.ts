/**
 * Prompt Optimization Utilities
 * 
 * 프롬프트 토큰 최적화 및 품질 향상을 위한 유틸리티
 */

import { z } from 'zod';

/**
 * 프롬프트 최적화 설정
 */
export interface OptimizationConfig {
  maxTokens?: number;
  priorityWeights?: {
    action: number;     // 행동/피사체 가중치
    environment: number; // 장면/환경 가중치
    style: number;      // 스타일/미학 가중치
    camera: number;     // 카메라 연출 가중치
    audio: number;      // 오디오 신호 가중치
  };
  compressionLevel?: 'none' | 'light' | 'moderate' | 'aggressive';
  preserveCore?: boolean; // 핵심 요소 보존 여부
}

/**
 * 프롬프트 구조 스키마 (Veo 최적화)
 */
export const VeoPromptSchema = z.object({
  action: z.string().describe('행동/피사체 - Priority 1'),
  environment: z.string().describe('장면/환경 - Priority 2'),
  style: z.string().describe('스타일/미학 - Priority 3'),
  camera: z.string().optional().describe('카메라 연출 - Priority 4'),
  audio: z.string().optional().describe('오디오 신호 - Priority 5'),
  control: z.string().optional().describe('제어 신호 - Priority 6'),
});

export type VeoPrompt = z.infer<typeof VeoPromptSchema>;

/**
 * 프롬프트 토큰 추정 (간략화된 버전)
 * 실제로는 tiktoken 라이브러리 사용 권장
 */
export function estimateTokenCount(text: string): number {
  // 대략적인 추정: 평균 4자당 1토큰
  return Math.ceil(text.length / 4);
}

/**
 * 프롬프트 압축 - 중복 제거 및 간소화
 */
export function compressPrompt(
  prompt: string,
  level: OptimizationConfig['compressionLevel'] = 'light'
): string {
  let compressed = prompt;

  switch (level) {
    case 'none':
      return prompt;
    
    case 'light':
      // 연속된 공백 제거
      compressed = compressed.replace(/\s+/g, ' ').trim();
      // 중복된 구두점 제거
      compressed = compressed.replace(/([.,!?])\1+/g, '$1');
      break;
    
    case 'moderate':
      // light 압축 적용
      compressed = compressPrompt(compressed, 'light');
      // 불필요한 관사 제거
      compressed = compressed.replace(/\b(the|a|an)\s+/gi, '');
      // 긴 설명을 짧게
      compressed = compressed.replace(/very\s+/gi, '');
      compressed = compressed.replace(/extremely\s+/gi, '');
      break;
    
    case 'aggressive':
      // moderate 압축 적용
      compressed = compressPrompt(compressed, 'moderate');
      // 부사 제거
      compressed = compressed.replace(/\b\w+ly\b/gi, '');
      // 전치사구 간소화
      compressed = compressed.replace(/\s+(of|in|on|at|to|for|with|by)\s+/gi, ' ');
      break;
  }

  return compressed;
}

/**
 * 프롬프트 구조화 및 최적화
 */
export function structurePrompt(
  components: Partial<VeoPrompt>,
  config: OptimizationConfig = {}
): string {
  const weights = config.priorityWeights || {
    action: 1.0,
    environment: 0.9,
    style: 0.8,
    camera: 0.7,
    audio: 0.6,
  };

  const sections: string[] = [];

  // Priority 1: 행동/피사체
  if (components.action) {
    const compressed = compressPrompt(components.action, config.compressionLevel);
    if (weights.action > 0) {
      sections.push(compressed);
    }
  }

  // Priority 2: 장면/환경
  if (components.environment) {
    const compressed = compressPrompt(components.environment, config.compressionLevel);
    if (weights.environment > 0) {
      sections.push(compressed);
    }
  }

  // Priority 3: 스타일/미학
  if (components.style) {
    const compressed = compressPrompt(components.style, config.compressionLevel);
    if (weights.style > 0) {
      sections.push(compressed);
    }
  }

  // Priority 4: 카메라 연출
  if (components.camera && weights.camera > 0) {
    const compressed = compressPrompt(components.camera, config.compressionLevel);
    sections.push(compressed);
  }

  // Priority 5: 오디오 신호
  if (components.audio && weights.audio > 0) {
    sections.push(components.audio); // 오디오는 압축하지 않음 (Veo 문법 보존)
  }

  // Priority 6: 제어 신호
  if (components.control) {
    sections.push(components.control);
  }

  const finalPrompt = sections.join(', ');

  // 토큰 제한 확인
  if (config.maxTokens) {
    const tokenCount = estimateTokenCount(finalPrompt);
    if (tokenCount > config.maxTokens) {
      // 우선순위가 낮은 섹션부터 제거
      while (sections.length > 1 && estimateTokenCount(sections.join(', ')) > config.maxTokens) {
        sections.pop();
      }
      return sections.join(', ');
    }
  }

  return finalPrompt;
}

/**
 * 전개 방식별 프롬프트 템플릿
 */
export const DevelopmentMethodTemplates = {
  '훅-몰입-반전-떡밥': {
    act1: {
      emphasis: ['shocking opening', 'immediate attention', 'mysterious element'],
      pacing: 'fast-paced',
      mood: 'intriguing',
    },
    act2: {
      emphasis: ['rapid development', 'escalating tension', 'information reveal'],
      pacing: 'accelerating',
      mood: 'immersive',
    },
    act3: {
      emphasis: ['plot twist', 'shocking revelation', 'unexpected turn'],
      pacing: 'climactic',
      mood: 'surprising',
    },
    act4: {
      emphasis: ['open ending', 'hidden clue', 'sequel hook'],
      pacing: 'mysterious',
      mood: 'anticipatory',
    },
  },
  '귀납법': {
    act1: {
      emphasis: ['specific example', 'concrete observation', 'individual case'],
      pacing: 'observational',
      mood: 'analytical',
    },
    act2: {
      emphasis: ['pattern emergence', 'similar case', 'recurring theme'],
      pacing: 'methodical',
      mood: 'comparative',
    },
    act3: {
      emphasis: ['decisive example', 'pattern completion', 'clear evidence'],
      pacing: 'conclusive',
      mood: 'revelatory',
    },
    act4: {
      emphasis: ['general principle', 'universal truth', 'broader meaning'],
      pacing: 'reflective',
      mood: 'enlightening',
    },
  },
  '연역법': {
    act1: {
      emphasis: ['thesis statement', 'central claim', 'main proposition'],
      pacing: 'declarative',
      mood: 'assertive',
    },
    act2: {
      emphasis: ['supporting evidence', 'logical proof', 'first argument'],
      pacing: 'argumentative',
      mood: 'convincing',
    },
    act3: {
      emphasis: ['deeper proof', 'counter-argument', 'additional evidence'],
      pacing: 'intensifying',
      mood: 'comprehensive',
    },
    act4: {
      emphasis: ['conclusion', 'reaffirmation', 'final proof'],
      pacing: 'definitive',
      mood: 'conclusive',
    },
  },
  '다큐(인터뷰식)': {
    act1: {
      emphasis: ['documentary opening', 'subject introduction', 'context setting'],
      pacing: 'exploratory',
      mood: 'investigative',
    },
    act2: {
      emphasis: ['personal testimony', 'first perspective', 'intimate account'],
      pacing: 'conversational',
      mood: 'authentic',
    },
    act3: {
      emphasis: ['contrasting view', 'different angle', 'alternative perspective'],
      pacing: 'comparative',
      mood: 'thought-provoking',
    },
    act4: {
      emphasis: ['synthesis', 'narrator insight', 'broader implications'],
      pacing: 'contemplative',
      mood: 'insightful',
    },
  },
  '픽사스토리': {
    act1: {
      emphasis: ['ordinary world', 'daily routine', 'familiar setting'],
      pacing: 'comfortable',
      mood: 'warm',
    },
    act2: {
      emphasis: ['routine repetition', 'hidden desire', 'small discontent'],
      pacing: 'rhythmic',
      mood: 'yearning',
    },
    act3: {
      emphasis: ['disrupting event', 'catalyst moment', 'adventure begins'],
      pacing: 'adventurous',
      mood: 'exciting',
    },
    act4: {
      emphasis: ['transformation', 'new equilibrium', 'lesson learned'],
      pacing: 'satisfying',
      mood: 'fulfilling',
    },
  },
  '클래식 기승전결': {
    act1: {
      emphasis: ['exposition', 'character introduction', 'world building'],
      pacing: 'establishing',
      mood: 'introductory',
    },
    act2: {
      emphasis: ['rising action', 'conflict development', 'tension building'],
      pacing: 'escalating',
      mood: 'developing',
    },
    act3: {
      emphasis: ['climax', 'peak conflict', 'decisive moment'],
      pacing: 'intense',
      mood: 'dramatic',
    },
    act4: {
      emphasis: ['resolution', 'new balance', 'denouement'],
      pacing: 'resolving',
      mood: 'conclusive',
    },
  },
};

/**
 * 프롬프트 품질 검증
 */
export function validatePromptQuality(prompt: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 길이 검사
  if (prompt.length < 50) {
    issues.push('프롬프트가 너무 짧습니다');
    suggestions.push('더 구체적인 디테일을 추가하세요');
  }
  if (prompt.length > 2000) {
    issues.push('프롬프트가 너무 깁니다');
    suggestions.push('핵심 요소만 남기고 압축하세요');
  }

  // 구체성 검사
  const hasConcreteDetails = /\b(wearing|holding|standing|walking|looking)\b/i.test(prompt);
  if (!hasConcreteDetails) {
    issues.push('구체적인 행동 묘사가 부족합니다');
    suggestions.push('캐릭터의 구체적인 행동을 추가하세요');
  }

  // 시각적 요소 검사
  const hasVisualElements = /\b(color|light|dark|bright|shadow)\b/i.test(prompt);
  if (!hasVisualElements) {
    issues.push('시각적 요소가 부족합니다');
    suggestions.push('조명, 색상, 분위기 등을 추가하세요');
  }

  // 중복 검사
  const words = prompt.toLowerCase().split(/\s+/);
  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  const repetitions = Array.from(wordCount.entries())
    .filter(([word, count]) => count > 3 && word.length > 3);
  
  if (repetitions.length > 0) {
    issues.push(`과도한 반복: ${repetitions.map(([word]) => word).join(', ')}`);
    suggestions.push('반복되는 단어를 동의어로 교체하세요');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

/**
 * 메타 정보 제거
 */
export function removeMetaInformation(text: string): string {
  // 장르, 톤, 전개방식 등의 메타 정보 패턴 제거
  const metaPatterns = [
    /\b(genre|tone|style|method|approach|format|tempo|intensity):\s*\w+/gi,
    /\b(using|following|based on)\s+(the\s+)?\w+\s+(method|approach|style)/gi,
    /\[(genre|tone|style|method):[^\]]+\]/gi,
    /\((genre|tone|style|method):[^)]+\)/gi,
  ];

  let cleaned = text;
  metaPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // 연속된 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * 프롬프트 향상 - 창의성과 구체성 추가
 */
export function enhancePromptCreativity(
  basePrompt: string,
  options: {
    addSensoryDetails?: boolean;
    addEmotionalDepth?: boolean;
    addCinematicElements?: boolean;
  } = {}
): string {
  let enhanced = basePrompt;

  if (options.addSensoryDetails) {
    // 감각적 디테일 추가를 위한 키워드
    const sensoryEnhancements = [
      'textured surfaces',
      'ambient sounds',
      'tactile elements',
      'atmospheric depth',
    ];
    // 프롬프트에 자연스럽게 통합
    enhanced = integrateEnhancements(enhanced, sensoryEnhancements);
  }

  if (options.addEmotionalDepth) {
    // 감정적 깊이 추가
    const emotionalEnhancements = [
      'subtle expressions',
      'emotional undertones',
      'psychological depth',
      'nuanced reactions',
    ];
    enhanced = integrateEnhancements(enhanced, emotionalEnhancements);
  }

  if (options.addCinematicElements) {
    // 영화적 요소 추가
    const cinematicEnhancements = [
      'cinematic composition',
      'dynamic framing',
      'visual storytelling',
      'compelling perspective',
    ];
    enhanced = integrateEnhancements(enhanced, cinematicEnhancements);
  }

  return enhanced;
}

/**
 * 향상 요소를 프롬프트에 자연스럽게 통합
 */
function integrateEnhancements(prompt: string, enhancements: string[]): string {
  // 프롬프트 끝에 자연스럽게 추가
  const selectedEnhancements = enhancements
    .slice(0, 2) // 최대 2개만 선택
    .join(', ');
  
  if (selectedEnhancements) {
    return `${prompt}, with ${selectedEnhancements}`;
  }
  
  return prompt;
}

/**
 * 배치 프롬프트 최적화
 */
export function optimizePromptBatch(
  prompts: string[],
  config: OptimizationConfig = {}
): string[] {
  // 공통 요소 추출
  const commonElements = extractCommonElements(prompts);
  
  // 각 프롬프트 최적화
  return prompts.map(prompt => {
    // 공통 요소 제거하여 중복 방지
    let optimized = removeCommonElements(prompt, commonElements);
    
    // 압축 적용
    optimized = compressPrompt(optimized, config.compressionLevel);
    
    // 필요시 공통 요소를 한 번만 추가
    if (config.preserveCore && commonElements.length > 0) {
      optimized = `${optimized}, ${commonElements.join(', ')}`;
    }
    
    return optimized;
  });
}

/**
 * 공통 요소 추출
 */
function extractCommonElements(prompts: string[]): string[] {
  if (prompts.length < 2) return [];
  
  // 모든 프롬프트에서 반복되는 구문 찾기
  const firstWords = prompts[0].split(/[,.]/).map(s => s.trim());
  const commonElements = firstWords.filter(phrase => {
    return prompts.every(prompt => prompt.includes(phrase));
  });
  
  return commonElements;
}

/**
 * 공통 요소 제거
 */
function removeCommonElements(prompt: string, commonElements: string[]): string {
  let cleaned = prompt;
  commonElements.forEach(element => {
    cleaned = cleaned.replace(element, '').replace(/,\s*,/g, ',').trim();
  });
  return cleaned;
}