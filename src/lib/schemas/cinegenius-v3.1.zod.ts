/**
 * CineGenius v3.1 Zod Schema Implementation
 * 
 * Veo 3 최적화된 영상 프롬프트 생성을 위한 포괄적 스키마
 * JSON Schema 2020-12 스펙을 Zod로 구현
 * 
 * @version 3.1
 * @author CineGenius Team
 */

import { z } from 'zod';

// =============================================================================
// 🔧 유틸리티 스키마
// =============================================================================

/** UUID v4 패턴 검증 */
export const UUIDSchema = z.string().uuid('유효한 UUID v4 형식이 아닙니다');

/** SMPTE 타임코드 패턴 (HH:MM:SS:FF 또는 HH:MM:SS;FF) */
export const SMPTETimecodeSchema = z.string().regex(
  /^[0-9]{2}:[0-9]{2}:[0-9]{2}[:;][0-9]{2}$/,
  'SMPTE 타임코드는 HH:MM:SS:FF 또는 HH:MM:SS;FF 형식이어야 합니다'
);

/** 타임스탬프 패턴 (HH:MM:SS.mmm) */
export const TimestampSchema = z.string().regex(
  /^[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?$/,
  '타임스탬프는 HH:MM:SS 또는 HH:MM:SS.mmm 형식이어야 합니다'
);

// =============================================================================
// 📝 Core Schema Components
// =============================================================================

/** 사용자 입력 */
export const UserInputSchema = z.object({
  oneLineScenario: z.string().min(1, '시나리오는 필수입니다').max(500, '시나리오는 500자 이내로 입력해주세요'),
  targetAudience: z.string().max(200, '타겟 관객은 200자 이내로 입력해주세요').optional(),
  referenceUrls: z.array(z.string().url('유효한 URL 형식이 아닙니다')).max(20, '참조 URL은 최대 20개까지 가능합니다').optional(),
  referenceAudioUrl: z.string().url('유효한 오디오 URL 형식이 아닙니다').optional(),
});

/** 프로젝트 설정 */
export const ProjectConfigSchema = z.object({
  creationMode: z.string().min(1, '생성 모드는 필수입니다'),
  frameworkType: z.string().min(1, '프레임워크 타입은 필수입니다'),
  aiAssistantPersona: z.string().min(1, 'AI 어시스턴트 페르소나는 필수입니다'),
});

// =============================================================================
// 🎨 Style & Visual Schema
// =============================================================================

/** 스타일 융합 */
export const StyleFusionSchema = z.object({
  styleA: z.string().min(1, '스타일 A는 필수입니다').max(80, '스타일 A는 80자 이내로 입력해주세요'),
  styleB: z.string().min(1, '스타일 B는 필수입니다').max(80, '스타일 B는 80자 이내로 입력해주세요'),
  ratio: z.number().min(0, '비율은 0 이상이어야 합니다').max(1, '비율은 1 이하여야 합니다'),
});

/** 기본 스타일 */
export const BaseStyleSchema = z.object({
  visualStyle: z.string().min(1, '비주얼 스타일은 필수입니다').max(80, '비주얼 스타일은 80자 이내로 입력해주세요'),
  genre: z.string().min(1, '장르는 필수입니다').max(80, '장르는 80자 이내로 입력해주세요'),
  mood: z.string().min(1, '무드는 필수입니다').max(80, '무드는 80자 이내로 입력해주세요'),
  quality: z.string().min(1, '화질은 필수입니다').max(40, '화질은 40자 이내로 입력해주세요'),
  styleFusion: StyleFusionSchema,
});

/** 공간적 맥락 */
export const SpatialContextSchema = z.object({
  placeDescription: z.string().min(1, '장소 설명은 필수입니다').max(300, '장소 설명은 300자 이내로 입력해주세요'),
  weather: z.string().min(1, '날씨는 필수입니다').max(40, '날씨는 40자 이내로 입력해주세요'),
  lighting: z.string().min(1, '조명은 필수입니다').max(60, '조명은 60자 이내로 입력해주세요'),
});

// =============================================================================
// 📷 Camera Schema
// =============================================================================

/** 물리적 카메라 설정 */
export const PhysicalCameraSchema = z.object({
  aperture: z.string().max(10, '조리개 설정은 10자 이내로 입력해주세요').optional(),
  shutter: z.string().max(10, '셔터 설정은 10자 이내로 입력해주세요').optional(),
  iso: z.number().int().min(25, 'ISO는 25 이상이어야 합니다').max(204800, 'ISO는 204800 이하여야 합니다').optional(),
  ndFilter: z.string().max(10, 'ND 필터 설정은 10자 이내로 입력해주세요').optional(),
});

/** 카메라 설정 */
export const CameraSettingSchema = z.object({
  primaryLens: z.string().min(1, '기본 렌즈는 필수입니다').max(60, '기본 렌즈는 60자 이내로 입력해주세요'),
  dominantMovement: z.string().min(1, '주요 움직임은 필수입니다').max(60, '주요 움직임은 60자 이내로 입력해주세요'),
  colorGrade: z.string().max(120, '컬러 그레이딩은 120자 이내로 입력해주세요').optional(),
  physical: PhysicalCameraSchema.optional(),
});

/** 전달 규격 */
export const DeliverySpecSchema = z.object({
  durationMs: z.number().int().min(1, '지속 시간은 1ms 이상이어야 합니다'),
  aspectRatio: z.string().min(1, '화면비는 필수입니다').max(20, '화면비는 20자 이내로 입력해주세요'),
  fps: z.number().min(1, 'FPS는 1 이상이어야 합니다').max(240, 'FPS는 240 이하여야 합니다').optional(),
  resolution: z.string().max(20, '해상도는 20자 이내로 입력해주세요').optional(),
  shotType: z.string().max(60, '샷 타입은 60자 이내로 입력해주세요').optional(),
  bitrateHint: z.string().max(40, '비트레이트 힌트는 40자 이내로 입력해주세요').optional(),
});

// =============================================================================
// 🎬 Production Schema
// =============================================================================

/** 연속성 설정 */
export const ContinuitySchema = z.object({
  singleTake: z.boolean().optional(),
  noCuts: z.boolean().optional(),
  motionVectorContinuity: z.string().max(200, '모션 벡터 연속성은 200자 이내로 입력해주세요').optional(),
  textureContinuityNote: z.string().max(200, '텍스처 연속성 노트는 200자 이내로 입력해주세요').optional(),
  transitionPolicy: z.string().max(120, '전환 정책은 120자 이내로 입력해주세요').optional(),
});

/** 룩 개발 */
export const LookDevSchema = z.object({
  grade: z.string().max(120, '그레이드는 120자 이내로 입력해주세요').optional(),
  grain: z.string().max(80, '그레인은 80자 이내로 입력해주세요').optional(),
  textureTreatment: z.string().max(120, '텍스처 트리트먼트는 120자 이내로 입력해주세요').optional(),
  lutName: z.string().max(60, 'LUT 이름은 60자 이내로 입력해주세요').optional(),
  colorTemperature: z.number().min(1000, '색온도는 1000K 이상이어야 합니다').max(20000, '색온도는 20000K 이하여야 합니다').optional(),
  contrastCurve: z.string().max(60, '콘트라스트 커브는 60자 이내로 입력해주세요').optional(),
});

/** 카메라 계획 */
export const CameraPlanSchema = z.object({
  lensRoster: z.array(z.string().min(1, '렌즈 명은 필수입니다').max(60, '렌즈 명은 60자 이내로 입력해주세요')).max(20, '렌즈 목록은 최대 20개까지 가능합니다').optional(),
  movementSummary: z.string().max(300, '움직임 요약은 300자 이내로 입력해주세요').optional(),
  preferredRig: z.string().max(60, '선호 리그는 60자 이내로 입력해주세요').optional(),
});

// =============================================================================
// 🎵 Audio Schema
// =============================================================================

/** 오디오 디자인 */
export const AudioDesignSchema = z.object({
  musicIntent: z.string().max(120, '음악 의도는 120자 이내로 입력해주세요').optional(),
  sfxPalette: z.array(z.string().min(1, 'SFX는 필수입니다').max(80, 'SFX는 80자 이내로 입력해주세요')).max(50, 'SFX 팔레트는 최대 50개까지 가능합니다').optional(),
  mixNotes: z.string().max(300, '믹스 노트는 300자 이내로 입력해주세요').optional(),
  duckingRules: z.array(z.string().min(1, '덕킹 규칙은 필수입니다').max(120, '덕킹 규칙은 120자 이내로 입력해주세요')).max(20, '덕킹 규칙은 최대 20개까지 가능합니다').optional(),
});

/** 오디오 레이어 (Veo 3 문법 지원) */
export const AudioLayersSchema = z.object({
  diegetic: z.string().max(200, '현장음은 200자 이내로 입력해주세요'),
  non_diegetic: z.string().max(200, '비현장음은 200자 이내로 입력해주세요'),
  voice: z.string().max(200, '대사는 200자 이내로 입력해주세요'),
  concept: z.string().max(120, '컨셉트는 120자 이내로 입력해주세요'),
});

// =============================================================================
// 🎭 Elements Schema
// =============================================================================

/** 캐릭터 */
export const CharacterSchema = z.object({
  id: z.string().min(1, '캐릭터 ID는 필수입니다').max(60, '캐릭터 ID는 60자 이내로 입력해주세요'),
  description: z.string().min(1, '캐릭터 설명은 필수입니다').max(300, '캐릭터 설명은 300자 이내로 입력해주세요'),
  reference_image_url: z.string().url('유효한 이미지 URL 형식이 아닙니다').optional(),
});

/** 핵심 객체 */
export const CoreObjectSchema = z.object({
  id: z.string().min(1, '객체 ID는 필수입니다').max(60, '객체 ID는 60자 이내로 입력해주세요'),
  description: z.string().min(1, '객체 설명은 필수입니다').max(300, '객체 설명은 300자 이내로 입력해주세요'),
  material: z.string().max(60, '재질은 60자 이내로 입력해주세요').optional(),
  reference_image_url: z.string().url('유효한 이미지 URL 형식이 아닙니다').optional(),
});

/** 조립 지시사항 */
export const AssemblyDirectivesSchema = z.object({
  sourceContainer: z.string().max(120, '소스 컨테이너는 120자 이내로 입력해주세요').optional(),
  assembledElements: z.array(z.string().min(1, '조립 요소는 필수입니다').max(120, '조립 요소는 120자 이내로 입력해주세요')).max(100, '조립 요소는 최대 100개까지 가능합니다').optional(),
  animationModel: z.string().max(120, '애니메이션 모델은 120자 이내로 입력해주세요').optional(),
  physicalityNote: z.string().max(200, '물리성 노트는 200자 이내로 입력해주세요').optional(),
});

/** 요소들 */
export const ElementsSchema = z.object({
  characters: z.array(CharacterSchema).max(50, '캐릭터는 최대 50개까지 가능합니다'),
  coreObjects: z.array(CoreObjectSchema).max(100, '핵심 객체는 최대 100개까지 가능합니다'),
  assemblyDirectives: AssemblyDirectivesSchema.optional(),
});

// =============================================================================
// 📋 Timeline Schema
// =============================================================================

/** 타임코드 */
export const TimecodeSchema = z.object({
  startMs: z.number().int().min(0, '시작 시간은 0 이상이어야 합니다').optional(),
  endMs: z.number().int().min(0, '종료 시간은 0 이상이어야 합니다').optional(),
  smpteStart: z.string().max(12, 'SMPTE 시작 시간은 12자 이내로 입력해주세요').optional(),
  smpteEnd: z.string().max(12, 'SMPTE 종료 시간은 12자 이내로 입력해주세요').optional(),
});

/** 카메라 작업 */
export const CameraWorkSchema = z.object({
  angle: z.string().min(1, '카메라 앵글은 필수입니다').max(40, '카메라 앵글은 40자 이내로 입력해주세요'),
  move: z.string().min(1, '카메라 움직임은 필수입니다').max(40, '카메라 움직임은 40자 이내로 입력해주세요'),
  focus: z.string().max(80, '포커스는 80자 이내로 입력해주세요'),
});

/** 페이싱 & 효과 */
export const PacingFXSchema = z.object({
  pacing: z.string().min(1, '페이싱은 필수입니다').max(40, '페이싱은 40자 이내로 입력해주세요'),
  editingStyle: z.string().min(1, '편집 스타일은 필수입니다').max(40, '편집 스타일은 40자 이내로 입력해주세요'),
  visualEffect: z.string().min(1, '시각 효과는 필수입니다').max(60, '시각 효과는 60자 이내로 입력해주세요'),
});

/** 타임라인 아이템 */
export const TimelineItemSchema = z.object({
  sequence: z.number().int().min(0, '시퀀스는 0 이상이어야 합니다'),
  timestamp: TimestampSchema.optional(),
  timecode: TimecodeSchema.optional(),
  visualDirecting: z.string().min(1, '비주얼 연출은 필수입니다').max(600, '비주얼 연출은 600자 이내로 입력해주세요'),
  cameraWork: CameraWorkSchema,
  pacingFX: PacingFXSchema,
  audioLayers: AudioLayersSchema,
  actionNote: z.string().max(600, '액션 노트는 600자 이내로 입력해주세요').optional(),
  audioNote: z.string().max(300, '오디오 노트는 300자 이내로 입력해주세요').optional(),
  visualNote: z.string().max(300, '비주얼 노트는 300자 이내로 입력해주세요').optional(),
});

// =============================================================================
// 📊 Metadata Schema
// =============================================================================

/** 메타데이터 */
export const MetadataSchema = z.object({
  promptName: z.string().min(1, '프롬프트 이름은 필수입니다').max(120, '프롬프트 이름은 120자 이내로 입력해주세요'),
  baseStyle: BaseStyleSchema,
  spatialContext: SpatialContextSchema,
  cameraSetting: CameraSettingSchema,
  deliverySpec: DeliverySpecSchema,
  continuity: ContinuitySchema.optional(),
  lookDev: LookDevSchema.optional(),
  cameraPlan: CameraPlanSchema.optional(),
});

/** 프롬프트 블루프린트 */
export const PromptBlueprintSchema = z.object({
  metadata: MetadataSchema,
  elements: ElementsSchema,
  audioDesign: AudioDesignSchema.optional(),
  timeline: z.array(TimelineItemSchema).min(1, '타임라인은 최소 1개의 아이템이 필요합니다').max(500, '타임라인은 최대 500개까지 가능합니다'),
});

// =============================================================================
// ⚙️ Generation Control Schema
// =============================================================================

/** 감독 강조 */
export const DirectorEmphasisSchema = z.object({
  term: z.string().min(1, '강조 용어는 필수입니다').max(80, '강조 용어는 80자 이내로 입력해주세요'),
  weight: z.number().min(-3, '가중치는 -3 이상이어야 합니다').max(3, '가중치는 3 이하여야 합니다'),
});

/** 초기화 이미지 */
export const InitializationImageSchema = z.object({
  imageUrl: z.string().url('유효한 이미지 URL 형식이 아닙니다'),
  strength: z.number().min(0.1, '강도는 0.1 이상이어야 합니다').max(1.0, '강도는 1.0 이하여야 합니다'),
});

/** 마지막 프레임 데이터 */
export const LastFrameDataSchema = z.object({
  imageUrl: z.string().url('유효한 이미지 URL 형식이 아닙니다'),
  description: z.string().max(300, '설명은 300자 이내로 입력해주세요'),
});

/** 샷 바이 샷 */
export const ShotByShotSchema = z.object({
  enabled: z.boolean(),
  lockedSegments: z.array(z.number().int().min(0, '잠긴 세그먼트는 0 이상이어야 합니다')).max(500, '잠긴 세그먼트는 최대 500개까지 가능합니다').optional(),
  lastFrameData: LastFrameDataSchema.optional(),
});

/** 준수 사항 */
export const ComplianceSchema = z.object({
  disableTextOverlays: z.boolean().default(true),
  brandName: z.string().max(80, '브랜드명은 80자 이내로 입력해주세요').optional(),
  logoVisibility: z.string().max(80, '로고 가시성은 80자 이내로 입력해주세요').optional(),
  legalRestrictions: z.array(z.string().min(1, '법적 제한은 필수입니다').max(120, '법적 제한은 120자 이내로 입력해주세요')).max(50, '법적 제한은 최대 50개까지 가능합니다').optional(),
  negativeOverlays: z.array(z.string().min(1, '네거티브 오버레이는 필수입니다').max(120, '네거티브 오버레이는 120자 이내로 입력해주세요')).max(50, '네거티브 오버레이는 최대 50개까지 가능합니다').optional(),
});

/** 생성 제어 */
export const GenerationControlSchema = z.object({
  directorEmphasis: z.array(DirectorEmphasisSchema).max(50, '감독 강조는 최대 50개까지 가능합니다'),
  initializationImage: InitializationImageSchema.optional(),
  shotByShot: ShotByShotSchema,
  compliance: ComplianceSchema.optional(),
  seed: z.number().int().min(0, '시드는 0 이상이어야 합니다').max(2147483647, '시드는 2147483647 이하여야 합니다'),
});

// =============================================================================
// 📤 Final Output Schema
// =============================================================================

/** 최종 출력 */
export const FinalOutputSchema = z.object({
  finalPromptText: z.string().min(1, '최종 프롬프트 텍스트는 필수입니다').max(5000, '최종 프롬프트 텍스트는 5000자 이내로 입력해주세요'),
  keywords: z.array(z.string().min(1, '키워드는 필수입니다').max(60, '키워드는 60자 이내로 입력해주세요')).max(200, '키워드는 최대 200개까지 가능합니다'),
  negativePrompts: z.array(z.string().min(1, '네거티브 프롬프트는 필수입니다').max(60, '네거티브 프롬프트는 60자 이내로 입력해주세요')).max(200, '네거티브 프롬프트는 최대 200개까지 가능합니다'),
});

// =============================================================================
// 🎯 Main CineGenius v3.1 Schema
// =============================================================================

/** CineGenius v3.1 메인 스키마 */
export const CineGeniusV31Schema = z.object({
  version: z.literal('3.1'),
  projectId: UUIDSchema,
  createdAt: z.string().datetime('유효한 ISO 날짜 형식이 아닙니다'),
  userInput: UserInputSchema,
  projectConfig: ProjectConfigSchema,
  promptBlueprint: PromptBlueprintSchema,
  generationControl: GenerationControlSchema,
  aiAnalysis: z.record(z.any()).optional(),
  finalOutput: FinalOutputSchema,
  uiHints: z.record(z.array(z.union([z.string(), z.number()]))).optional(),
})
.refine(
  (data) => {
    // noCuts가 true일 때 특정 편집 스타일 금지
    if (data.promptBlueprint.metadata.continuity?.noCuts) {
      const forbiddenStyles = ['Jump Cut', 'Cross-dissolve', 'Wipe', 'Split Screen'];
      return data.promptBlueprint.timeline.every(item => 
        !forbiddenStyles.includes(item.pacingFX.editingStyle)
      );
    }
    return true;
  },
  {
    message: 'noCuts가 true일 때는 Jump Cut, Cross-dissolve, Wipe, Split Screen을 사용할 수 없습니다',
    path: ['promptBlueprint', 'timeline'],
  }
);

// =============================================================================
// 📋 TypeScript 타입 내보내기
// =============================================================================

export type CineGeniusV31 = z.infer<typeof CineGeniusV31Schema>;
export type UserInput = z.infer<typeof UserInputSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type PromptBlueprint = z.infer<typeof PromptBlueprintSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type Elements = z.infer<typeof ElementsSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type GenerationControl = z.infer<typeof GenerationControlSchema>;
export type FinalOutput = z.infer<typeof FinalOutputSchema>;

// =============================================================================
// 🎨 UI Hints Constants
// =============================================================================

/** UI 힌트 기본값 */
export const UI_HINTS = {
  creationMode: ['VISUAL_FIRST', 'SOUND_FIRST'],
  frameworkType: ['EVENT_DRIVEN', 'DIRECTION_DRIVEN', 'HYBRID'],
  aiAssistantPersona: ['ASSISTANT_DIRECTOR', 'CINEMATOGRAPHER', 'SCREENWRITER'],
  
  visualStyle: [
    'Photorealistic',
    'Cinematic',
    'Documentary Style',
    'Glossy Commercial',
    'Lo-Fi VHS',
    'Hand-drawn Animation',
    'Unreal Engine 5 Render'
  ],
  
  genre: [
    'Action-Thriller',
    'Sci-Fi Noir',
    'Fantasy Epic',
    'Slice of Life',
    'Psychological Thriller',
    'Mockumentary',
    'Cyberpunk'
  ],
  
  mood: [
    'Tense',
    'Moody',
    'Serene',
    'Whimsical',
    'Melancholic',
    'Suspenseful',
    'Awe-inspiring',
    'Meditative'
  ],
  
  weather: ['Clear', 'Rain', 'Heavy Rain', 'Snow', 'Fog', 'Overcast'],
  
  lighting: [
    'Daylight (Midday)',
    'Golden Hour',
    'Night',
    'Studio Lighting',
    'Harsh Midday Sun',
    'Single Key Light (Rembrandt)',
    'Backlit Silhouette',
    'Neon Glow'
  ],
  
  primaryLens: [
    '14mm Ultra-Wide',
    '24mm Wide-angle',
    '35mm (Natural)',
    '50mm Standard',
    '85mm Portrait',
    '90mm Macro'
  ],
  
  aspectRatio: ['9:16', '1:1', '4:5', '16:9', '2.39:1'],
  fps: [24, 25, 30, 50, 60],
  
  cameraAngle: [
    'Wide Shot (WS)',
    'Medium Shot (MS)',
    'Close Up (CU)',
    'Extreme Close Up (ECU)',
    'Point of View (POV)'
  ],
  
  cameraMove: [
    'Pan (Left/Right)',
    'Tilt (Up/Down)',
    'Dolly (In/Out)',
    'Tracking (Follow)',
    'Whip Pan',
    'Static Shot'
  ],
  
  pacing: [
    'Real-time',
    'Slow-motion (0.5x)',
    'Fast-motion (2x)',
    'Time-lapse',
    'Freeze-frame'
  ],
  
  editingStyle: [
    'Standard Cut',
    'Match Cut',
    'Jump Cut',
    'Cross-dissolve',
    'Wipe',
    'Split Screen'
  ],
  
  visualEffect: [
    'None',
    'Lens Flare',
    'Light Leaks',
    'Film Grain',
    'Chromatic Aberration',
    'Slow Shutter (Motion Blur)'
  ],
} as const;

// =============================================================================
// 🔄 유틸리티 함수들
// =============================================================================

/** 빈 CineGenius v3.1 인스턴스 생성 */
export function createEmptyCineGeniusV31(): Partial<CineGeniusV31> {
  return {
    version: '3.1',
    projectId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userInput: {
      oneLineScenario: '',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST',
      frameworkType: 'EVENT_DRIVEN',
      aiAssistantPersona: 'ASSISTANT_DIRECTOR',
    },
    promptBlueprint: {
      metadata: {
        promptName: '',
        baseStyle: {
          visualStyle: 'Cinematic',
          genre: 'Action-Thriller',
          mood: 'Tense',
          quality: '4K',
          styleFusion: {
            styleA: 'Christopher Nolan',
            styleB: 'Denis Villeneuve',
            ratio: 0.5,
          },
        },
        spatialContext: {
          placeDescription: '',
          weather: 'Clear',
          lighting: 'Golden Hour',
        },
        cameraSetting: {
          primaryLens: '50mm Standard',
          dominantMovement: 'Smooth Tracking (Dolly)',
          colorGrade: '',
        },
        deliverySpec: {
          durationMs: 30000,
          aspectRatio: '16:9',
          fps: 24,
        },
      },
      elements: {
        characters: [],
        coreObjects: [],
      },
      timeline: [],
    },
    generationControl: {
      directorEmphasis: [],
      shotByShot: {
        enabled: false,
      },
      seed: Math.floor(Math.random() * 2147483647),
    },
    finalOutput: {
      finalPromptText: '',
      keywords: [],
      negativePrompts: [],
    },
  };
}