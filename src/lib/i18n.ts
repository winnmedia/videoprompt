import { mapCameraToEnglish } from '@/lib/pel/camera';

const THEME_MAP: Record<string, string> = {
  '집': 'home interior',
  '부엌': 'kitchen',
  '거실': 'living room',
  '복도': 'hallway',
  '욕실(문 닫힘)': 'bathroom (door closed)',
  '바다(맑은 낮)': 'sunny seaside daytime',
  '숲(낮)': 'forest (day)',
  '도시 밤': 'city at night',
  '학교 운동장': 'school track field',
  '비 오는 골목': 'rainy alley',
  '눈 오는 밤': 'snowy night',
  '우주선 내부(카툰풍)': 'spaceship interior (cartoon style)',
  '노을 해변': 'sunset beach',
  '사막 일몰': 'desert at dusk',
  '설산 고원 밤': 'high mountain snowy plateau at night',
  '비 오는 도시 카페': 'rainy city cafe',
  '도서관 오후': 'library in the afternoon',
  '지하철 승강장': 'subway platform',
  '해질녘 옥상': 'rooftop at dusk',
  '봄 벚꽃길': 'spring cherry blossom path',
  '일반': 'general',
};

const STYLE_MAP: Record<string, string> = {
  '자연스러운': 'natural',
  '드라마틱한': 'dramatic',
  '코믹한': 'comic',
  '로맨틱한': 'romantic',
  '액션': 'action',
  '미스터리': 'mystery',
  '판타지': 'fantasy',
  'SF': 'sci-fi',
};

const MOOD_MAP: Record<string, string> = {
  '밝음': 'bright',
  '아늑함': 'cozy',
  '모험': 'adventurous',
  '신비': 'mysterious',
  '차분': 'calm',
};

const WEATHER_MAP: Record<string, string> = {
  '맑음': 'clear',
  '비': 'rain',
  '눈': 'snow',
  '안개': 'fog',
};

const CHARACTER_MAP: Record<string, string> = {
  '엄마': 'mother',
  '아빠': 'father',
  '친구': 'friend',
  '강아지': 'dog',
  '고양이': 'cat',
  '로봇': 'robot',
};

const ACTION_MAP: Record<string, string> = {
  '걷기': 'walking',
  '달리기': 'running',
  '요리': 'cooking',
  '춤': 'dancing',
  '숨바꼭질': 'hide-and-seek',
  '문열기/닫기': 'open/close door',
};

export function translateKoreanToEnglish(value?: string): string | undefined {
  if (!value) return value;
  if (THEME_MAP[value]) return THEME_MAP[value];
  if (STYLE_MAP[value]) return STYLE_MAP[value];
  if (MOOD_MAP[value]) return MOOD_MAP[value];
  if (WEATHER_MAP[value]) return WEATHER_MAP[value];
  if (CHARACTER_MAP[value]) return CHARACTER_MAP[value];
  if (ACTION_MAP[value]) return ACTION_MAP[value];
  // camera handled separately
  return value;
}

export function translateArray(values?: string[]): string[] {
  if (!values) return [];
  return values.map(v => translateKoreanToEnglish(v) || v);
}

export interface WizardLikeContext {
  scenario: string;
  theme?: string;
  style?: string;
  aspectRatio?: string;
  durationSec?: number;
  targetAudience?: string;
  mood?: string;
  camera?: string;
  weather?: string;
  characters?: string[];
  actions?: string[];
  enhancedPrompt?: string;
  suggestions?: string[];
  // Optional cinematic/technical fields for richer prompts
  resolution?: string;
  fps?: string;
  genre?: string;
  visualTone?: string;
  cameraMovement?: string;
  shotType?: string;
  speed?: string;
  lighting?: string;
  colorPalette?: string;
  soundAmbience?: string;
  sfxDensity?: string;
  safetyPreset?: string;
  detailStrength?: string;
  motionSmoothing?: string;
  coherence?: string;
  randomness?: string;
  seed?: number;
}

export function translateWizardContextToEnglish(ctx: WizardLikeContext): WizardLikeContext {
  return {
    ...ctx,
    theme: translateKoreanToEnglish(ctx.theme) || ctx.theme,
    style: translateKoreanToEnglish(ctx.style) || ctx.style,
    mood: translateKoreanToEnglish(ctx.mood) || ctx.mood,
    camera: mapCameraToEnglish(ctx.camera) || ctx.camera,
    weather: translateKoreanToEnglish(ctx.weather) || ctx.weather,
    characters: translateArray(ctx.characters),
    actions: translateArray(ctx.actions),
    // scenario/enhancedPrompt left as-is (LLM instructed to English). Could integrate MT if needed.
  };
}


