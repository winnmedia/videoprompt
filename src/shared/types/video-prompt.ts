// VideoPrompt 서비스의 핵심 타입 정의
// 
// 📝 Legacy Types (v2.x 호환성 유지)
// CineGenius v3.1 통합을 위해 기존 타입 보존
// 새로운 기능은 video-prompt-v3.ts 참조

// 기본 스타일 옵션들
export const VIDEO_STYLES = {
  visual: [
    'Photorealistic',
    'Hyperrealistic',
    'Cinematic',
    'Anamorphic',
    'Vintage Film',
    'Documentary',
    'Experimental',
    'Abstract',
    'Minimalist',
    'Baroque',
    'Neo-noir',
    'Cyberpunk',
    'Steampunk',
    'Retro-futuristic',
    'Gothic',
    'Art Deco',
  ] as const,
  genre: [
    'Action-Thriller',
    'Sci-Fi Noir',
    'Fantasy Epic',
    'Modern Drama',
    'Horror',
    'Romantic Comedy',
    'Mystery',
    'Western',
    'War',
    'Musical',
    'Documentary',
    'Superhero',
    'Martial Arts',
    'Spy',
    'Heist',
    'Survival',
    'Coming-of-age',
  ] as const,
  mood: [
    'Tense',
    'Moody',
    'Gritty',
    'Serene',
    'Energetic',
    'Nostalgic',
    'Mysterious',
    'Whimsical',
    'Melancholic',
    'Euphoric',
    'Suspenseful',
    'Peaceful',
    'Chaotic',
    'Dreamy',
    'Nightmarish',
    'Hopeful',
    'Desperate',
  ] as const,
  quality: [
    '4K',
    '8K',
    'IMAX Quality',
    'HD',
    'Ultra HD',
    'Cinema 4K',
    'HDR',
    'Dolby Vision',
    'Raw Footage',
    'ProRes',
    'Film Grain',
  ] as const,
  director: [
    'Christopher Nolan',
    'David Fincher',
    'Wes Anderson',
    'Quentin Tarantino',
    'Stanley Kubrick',
    'Alfred Hitchcock',
    'Akira Kurosawa',
    'Federico Fellini',
    'Ingmar Bergman',
    'Denis Villeneuve',
    'Bong Joon-ho',
    'Park Chan-wook',
  ] as const,
} as const;

export const SPATIAL_CONTEXT = {
  weather: [
    'Clear',
    'Rain',
    'Heavy Rain',
    'Snow',
    'Fog',
    'Overcast',
    'Storm',
    'Thunder',
    'Lightning',
    'Hail',
    'Mist',
    'Drizzle',
    'Blizzard',
    'Sandstorm',
    'Heatwave',
    'Freezing Rain',
  ] as const,
  lighting: [
    'Daylight',
    'Golden Hour',
    'Blue Hour',
    'Night',
    'Studio Lighting',
    'Flickering Light',
    'Sunrise',
    'Sunset',
    'Twilight',
    'Moonlight',
    'Candlelight',
    'Neon',
    'Firelight',
    'Starlight',
    'Cloudy',
    'Overcast',
    'Harsh Sunlight',
    'Soft Diffused',
    'Hard Shadows',
    'Rim Lighting',
    'Backlighting',
  ] as const,
} as const;

export const CAMERA_SETTINGS = {
  lens: [
    '16mm Fisheye',
    '24mm Wide-angle',
    '50mm Standard',
    '85mm Portrait',
    '135mm Telephoto',
    '35mm Wide',
    '70mm Medium Tele',
    '200mm Long Tele',
    '400mm Super Tele',
    '8mm Ultra Wide',
    '12mm Super Wide',
    '100mm Macro',
    '300mm Wildlife',
  ] as const,
  movement: [
    'Static Shot',
    'Shaky Handheld',
    'Smooth Tracking',
    'Crane Shot',
    'Zoom',
    'Steadicam',
    'Gimbal',
    'Drone Shot',
    'Helicopter Shot',
    'Cable Cam',
    'Jib Movement',
    'Slider',
    'Car Mount',
    'Shoulder Rig',
    'Tripod Pan',
    'Dutch Angle',
    'Low Angle',
    'High Angle',
    "Bird's Eye",
    "Worm's Eye",
  ] as const,
} as const;

export const MATERIALS = [
  'Brushed Metal',
  'Polished Wood',
  'Transparent Glass',
  'Matte Plastic',
  'Rough Fabric',
  'Leather',
  'Chrome',
  'Stainless Steel',
  'Copper',
  'Bronze',
  'Gold',
  'Silver',
  'Marble',
  'Granite',
  'Concrete',
  'Brick',
  'Ceramic',
  'Porcelain',
  'Silk',
  'Velvet',
  'Denim',
  'Canvas',
  'Linen',
  'Wool',
  'Carbon Fiber',
  'Titanium',
  'Aluminum',
  'Iron',
  'Stone',
  'Crystal',
] as const;

export const CAMERA_ANGLES = [
  'Wide Shot',
  'Medium Shot',
  'Close Up',
  'Extreme Close Up',
  'Point of View',
  'Long Shot',
  'Medium Long Shot',
  'Medium Close Up',
  'Big Close Up',
  'Two Shot',
  'Group Shot',
  'Over-the-Shoulder Shot',
  'Reaction Shot',
] as const;

export const CAMERA_MOVEMENTS = [
  'Pan',
  'Tilt',
  'Dolly',
  'Tracking',
  'Whip Pan',
  'Arc Shot',
  'Spiral Shot',
  '360° Rotation',
  'Vertical Rise',
  'Horizontal Slide',
  'Push In',
  'Pull Out',
  'Rise Up',
  'Drop Down',
  'Circle Around',
] as const;

export const PACING_OPTIONS = [
  'Real-time',
  'Slow-motion (0.5x/0.2x)',
  'Fast-motion (2x)',
  'Time-lapse',
  'Freeze-frame',
  'Bullet Time',
  'Matrix Effect',
  'Ultra Slow (0.1x)',
  'Hyper Fast (5x)',
  'Variable Speed',
  'Reverse Motion',
  'Stop Motion',
  'Step Frame',
  'Smooth Ramp',
] as const;

export const AUDIO_QUALITY = [
  'Clear',
  'Muffled',
  'Echoing',
  'Distant',
  'Crisp',
  'Bass Heavy',
  'Treble Rich',
  'Stereo Wide',
  'Mono',
  'Surround Sound',
  'Atmospheric',
  'Ambient',
  'Diegetic',
  'Non-diegetic',
  'Foley',
] as const;

// 타입 정의
export type VideoStyle =
  | (typeof VIDEO_STYLES.visual)[number]
  | (typeof VIDEO_STYLES.genre)[number]
  | (typeof VIDEO_STYLES.mood)[number]
  | (typeof VIDEO_STYLES.quality)[number]
  | (typeof VIDEO_STYLES.director)[number];
export type SpatialContext =
  | (typeof SPATIAL_CONTEXT.weather)[number]
  | (typeof SPATIAL_CONTEXT.lighting)[number];
export type CameraSetting =
  | (typeof CAMERA_SETTINGS.lens)[number]
  | (typeof CAMERA_SETTINGS.movement)[number];
export type Material = (typeof MATERIALS)[number];
export type CameraAngle = (typeof CAMERA_ANGLES)[number];
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];
export type Pacing = (typeof PACING_OPTIONS)[number];
export type AudioQuality = (typeof AUDIO_QUALITY)[number];

// 메타데이터 인터페이스
export interface Metadata {
  prompt_name: string;
  base_style: string[];
  aspect_ratio: string;
  room_description: string;
  camera_setup: string;
  // 확장 필드 (FRD 기반 선택지)
  weather?: (typeof SPATIAL_CONTEXT.weather)[number] | string;
  lighting?: (typeof SPATIAL_CONTEXT.lighting)[number] | string;
  primary_lens?: (typeof CAMERA_SETTINGS.lens)[number] | string;
  dominant_movement?: (typeof CAMERA_SETTINGS.movement)[number] | string;
  material?: (typeof MATERIALS)[number] | string;
}

// 요소 인터페이스
export interface Character {
  id: string;
  description: string;
  reference_image_url?: string;
}

export interface CoreObject {
  id: string;
  description: string;
  reference_image_url?: string;
}

export interface Elements {
  characters: Character[];
  core_objects: CoreObject[];
}

// 타임라인 세그먼트 인터페이스
export interface TimelineSegment {
  id: string;
  sequence: number;
  timestamp: string;
  action: string;
  audio: string;
  camera_angle?: CameraAngle;
  camera_movement?: CameraMovement;
  pacing?: Pacing;
  audio_quality?: AudioQuality;
}

// 최종 프롬프트 인터페이스
export interface VideoPrompt {
  metadata: Metadata;
  key_elements: string[];
  assembled_elements: string[];
  negative_prompts: string[];
  timeline: TimelineSegment[];
  text: string;
  keywords: string[];
}

// 프롬프트 생성 상태 인터페이스
export interface PromptGenerationState {
  metadata: Partial<Metadata>;
  elements: Elements;
  timeline: TimelineSegment[];
  negative_prompts: string[];
  keywords: string[];
  isGenerating: boolean;
  generatedPrompt?: VideoPrompt;
}

// API 응답 인터페이스
export interface AIResponse {
  keywords: string[];
  negative_prompts: string[];
}

export interface ImageUploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// 폼 상태 인터페이스
export interface FormState {
  step: number;
  isValid: boolean;
  errors: Record<string, string[]>;
}
