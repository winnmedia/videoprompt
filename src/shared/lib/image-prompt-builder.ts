/**
 * Image Prompt Builder for Gemini 2.5 Flash Image Preview
 * 
 * 스토리보드 샷을 Gemini 이미지 생성에 최적화된 프롬프트로 변환
 * 
 * @module lib/utils/image-prompt-builder
 */

export interface ShotDescription {
  id: string;
  description: string;
  cameraAngle?: string;
  cameraMovement?: string;
  shotSize?: string;
  mood?: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  location?: string;
  characters?: string[];
  objects?: string[];
  action?: string;
  emotion?: string;
}

export interface VisualStyle {
  genre?: string;
  visualStyle?: string;
  colorPalette?: string[];
  atmosphere?: string;
  cinematographer?: string;
  reference?: string;
}

/**
 * 샷 설명을 Gemini 이미지 프롬프트로 변환
 */
export function buildImagePrompt(
  shot: ShotDescription,
  style: VisualStyle,
  options: {
    language?: 'en' | 'ko';
    detailLevel?: 'minimal' | 'standard' | 'detailed';
    includeNegativePrompt?: boolean;
  } = {}
): string {
  const {
    language = 'en',
    detailLevel = 'detailed',
    includeNegativePrompt = false
  } = options;

  const prompts: string[] = [];

  // 1. 스타일 프리셋 설정
  if (style.visualStyle) {
    prompts.push(getStylePreset(style.visualStyle));
  }

  // 2. 장르별 특성 추가
  if (style.genre) {
    prompts.push(getGenreCharacteristics(style.genre));
  }

  // 3. 메인 샷 설명
  prompts.push(shot.description);

  // 4. 카메라 설정
  if (shot.cameraAngle || shot.shotSize) {
    const cameraSettings = [];
    if (shot.shotSize) cameraSettings.push(getShotSizeDescription(shot.shotSize));
    if (shot.cameraAngle) cameraSettings.push(getCameraAngleDescription(shot.cameraAngle));
    if (shot.cameraMovement) cameraSettings.push(`${shot.cameraMovement} camera movement`);
    prompts.push(cameraSettings.join(', '));
  }

  // 5. 조명 및 분위기
  if (shot.lighting || shot.mood) {
    const moodSettings = [];
    if (shot.lighting) moodSettings.push(getLightingDescription(shot.lighting));
    if (shot.mood) moodSettings.push(`${shot.mood} mood`);
    if (shot.timeOfDay) moodSettings.push(`${shot.timeOfDay} lighting`);
    prompts.push(moodSettings.join(', '));
  }

  // 6. 환경 설정
  if (shot.location || shot.weather) {
    const envSettings = [];
    if (shot.location) envSettings.push(`location: ${shot.location}`);
    if (shot.weather) envSettings.push(`${shot.weather} weather`);
    prompts.push(envSettings.join(', '));
  }

  // 7. 색상 팔레트
  if (style.colorPalette && style.colorPalette.length > 0) {
    prompts.push(`color palette: ${style.colorPalette.join(', ')}`);
  }

  // 8. 기술적 품질 지시자
  if (detailLevel === 'detailed') {
    prompts.push(getTechnicalQualityPrompt());
  }

  // 9. 시네마토그래피 참조
  if (style.cinematographer || style.reference) {
    const refs = [];
    if (style.cinematographer) refs.push(`in the style of ${style.cinematographer}`);
    if (style.reference) refs.push(`inspired by ${style.reference}`);
    prompts.push(refs.join(', '));
  }

  // 10. 네거티브 프롬프트 (원하지 않는 요소)
  const negativeElements = includeNegativePrompt ? getNegativePrompt() : '';

  // 프롬프트 조합
  let finalPrompt = prompts.filter(Boolean).join(', ');
  
  // 한국어 요청 시 핵심 키워드는 영어 유지 (품질 향상)
  if (language === 'ko') {
    finalPrompt = translateKeyTerms(finalPrompt);
  }

  if (negativeElements) {
    finalPrompt += ` | Avoid: ${negativeElements}`;
  }

  return optimizePromptLength(finalPrompt);
}

/**
 * 스타일 프리셋 반환
 */
function getStylePreset(style: string): string {
  const presets: Record<string, string> = {
    'cinematic': 'cinematic film still, professional cinematography, movie scene',
    'anime': 'anime style, Studio Ghibli inspired, hand-drawn animation',
    'realistic': 'photorealistic, ultra realistic, professional photography',
    'storyboard': 'storyboard sketch, rough drawing, concept art style',
    'noir': 'film noir style, high contrast black and white, dramatic shadows',
    'vintage': 'vintage film aesthetic, grain, retro color grading',
    'cyberpunk': 'cyberpunk aesthetic, neon lights, futuristic dystopia',
    'fantasy': 'fantasy art style, magical atmosphere, epic scenery'
  };

  return presets[style] || style;
}

/**
 * 장르별 특성 반환
 */
function getGenreCharacteristics(genre: string): string {
  const characteristics: Record<string, string> = {
    'action': 'dynamic composition, intense action, high energy',
    'drama': 'emotional depth, character-focused, intimate framing',
    'comedy': 'bright and cheerful, expressive characters, vibrant colors',
    'horror': 'dark atmosphere, ominous shadows, unsettling composition',
    'romance': 'soft lighting, warm colors, intimate moments',
    'sci-fi': 'futuristic elements, advanced technology, otherworldly',
    'documentary': 'realistic, observational, natural lighting',
    'thriller': 'tense atmosphere, dramatic angles, suspenseful'
  };

  return characteristics[genre] || '';
}

/**
 * 샷 크기 설명
 */
function getShotSizeDescription(size: string): string {
  const sizes: Record<string, string> = {
    'extreme-wide': 'extreme wide shot, vast landscape',
    'wide': 'wide shot, full environment visible',
    'medium-wide': 'medium wide shot, full body with environment',
    'medium': 'medium shot, waist up',
    'medium-close': 'medium close-up, chest up',
    'close-up': 'close-up shot, face filling frame',
    'extreme-close': 'extreme close-up, detail shot'
  };

  return sizes[size] || size;
}

/**
 * 카메라 앵글 설명
 */
function getCameraAngleDescription(angle: string): string {
  const angles: Record<string, string> = {
    'eye-level': 'eye level angle',
    'low': 'low angle shot, looking up',
    'high': 'high angle shot, looking down',
    'dutch': 'dutch angle, tilted frame',
    'birds-eye': 'bird\'s eye view, overhead shot',
    'worms-eye': 'worm\'s eye view, extreme low angle'
  };

  return angles[angle] || angle;
}

/**
 * 조명 설명
 */
function getLightingDescription(lighting: string): string {
  const lightings: Record<string, string> = {
    'natural': 'natural lighting, soft daylight',
    'golden-hour': 'golden hour lighting, warm sunset glow',
    'blue-hour': 'blue hour lighting, twilight atmosphere',
    'high-key': 'high key lighting, bright and even',
    'low-key': 'low key lighting, dramatic shadows',
    'rembrandt': 'Rembrandt lighting, dramatic side light',
    'silhouette': 'silhouette lighting, backlit subject',
    'neon': 'neon lighting, vibrant colors'
  };

  return lightings[lighting] || lighting;
}

/**
 * 기술적 품질 프롬프트
 */
function getTechnicalQualityPrompt(): string {
  return 'highly detailed, professional quality, sharp focus, cinematic composition, rule of thirds';
}

/**
 * 네거티브 프롬프트 (피해야 할 요소)
 */
function getNegativePrompt(): string {
  return 'text, watermark, signature, low quality, blurry, distorted, amateur';
}

/**
 * 핵심 용어 한국어 처리 (영어 키워드 유지)
 */
function translateKeyTerms(prompt: string): string {
  // 한국어 설명 + 영어 기술 용어 혼용
  // Gemini는 영어 프롬프트에서 더 좋은 품질을 보임
  return prompt;
}

/**
 * 프롬프트 길이 최적화 (Gemini 토큰 제한 고려)
 */
function optimizePromptLength(prompt: string, maxLength: number = 500): string {
  if (prompt.length <= maxLength) return prompt;
  
  // 우선순위: 메인 설명 > 스타일 > 기술적 세부사항
  const parts = prompt.split(', ');
  const prioritized = parts.slice(0, Math.floor(parts.length * 0.7));
  
  return prioritized.join(', ');
}

/**
 * 배치 프롬프트 생성 (여러 샷 일관성 유지)
 */
export function buildBatchPrompts(
  shots: ShotDescription[],
  style: VisualStyle,
  options: {
    maintainConsistency?: boolean;
    characterDescriptions?: Record<string, string>;
  } = {}
): string[] {
  const { maintainConsistency = true, characterDescriptions = {} } = options;
  
  // 공통 스타일 요소 추출
  const commonStyle = maintainConsistency
    ? `Consistent visual style throughout: ${style.visualStyle}, ${style.colorPalette?.join(', ')}`
    : '';
  
  return shots.map(shot => {
    // 캐릭터 일관성 유지
    const characters = shot.characters?.map(
      char => characterDescriptions[char] || char
    );
    
    const enrichedShot = {
      ...shot,
      characters
    };
    
    const prompt = buildImagePrompt(enrichedShot, style);
    return maintainConsistency ? `${commonStyle}, ${prompt}` : prompt;
  });
}

/**
 * 프롬프트 검증
 */
export function validatePrompt(prompt: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // 길이 체크
  if (prompt.length < 20) {
    issues.push('프롬프트가 너무 짧습니다');
    suggestions.push('더 구체적인 설명을 추가하세요');
  }
  
  if (prompt.length > 1000) {
    issues.push('프롬프트가 너무 깁니다');
    suggestions.push('핵심 요소만 남기고 단순화하세요');
  }
  
  // 금지어 체크
  const bannedWords = ['nsfw', 'nude', 'violent', 'gore'];
  const foundBanned = bannedWords.filter(word => 
    prompt.toLowerCase().includes(word)
  );
  
  if (foundBanned.length > 0) {
    issues.push(`금지된 단어 포함: ${foundBanned.join(', ')}`);
  }
  
  // 품질 향상 제안
  if (!prompt.includes('lighting')) {
    suggestions.push('조명 설정을 추가하면 품질이 향상됩니다');
  }
  
  if (!prompt.includes('shot') && !prompt.includes('angle')) {
    suggestions.push('카메라 앵글을 명시하면 더 영화적인 결과를 얻을 수 있습니다');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}