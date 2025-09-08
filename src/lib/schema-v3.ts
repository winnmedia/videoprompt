/**
 * CineGenius v3.1 Zod 스키마 정의
 * 
 * PROMPT_ARCHITECTURE.md 스펙에 따른 JSON Schema 2020-12 구현
 * TypeScript + Zod로 런타임 검증 제공
 */

import { z } from 'zod';

// =============================================================================
// 🎯 정규식 패턴 (Production-grade validation)
// =============================================================================

/** SMPTE 타임코드 패턴 (HH:MM:SS:FF 또는 HH:MM:SS;FF) */
const SMPTETimecodePattern = /^[0-9]{2}:[0-9]{2}:[0-9]{2}[:;][0-9]{2}$/;

/** 화면비 패턴 (16:9, 2.39:1 등) */
const AspectRatioPattern = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;

/** 해상도 패턴 (HD, FHD, 4K 또는 1920x1080) */
const ResolutionPattern = /^((HD|FHD|4K|8K)|([1-9]\d{2,4}x[1-9]\d{2,4}))$/;

/** 조리개 패턴 (f/1.4, f/5.6) */
const AperturePattern = /^f\/(\d+(?:\.\d+)?)$/;

/** 셔터 스피드 패턴 (1/50, 1/1000, 0.5s) */
const ShutterPattern = /^(1\/[1-9]\d{1,5}|[0-9]+(?:\.[0-9]+)?s)$/;

/** ND 필터 패턴 (ND8, ND0.9, 3 stops) */
const NDFilterPattern = /^(ND\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*stops)$/;

/** 타임스탬프 패턴 (HH:MM:SS.mmm) */
const TimestampPattern = /^[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?$/;

// =============================================================================
// 🧱 Basic Schema Components
// =============================================================================

const UUIDSchema = z.string().uuid('유효한 UUID v4 형식이 아닙니다');

const SMPTETimecodeSchema = z.string().regex(
  SMPTETimecodePattern, 
  'SMPTE 타임코드는 HH:MM:SS:FF 또는 HH:MM:SS;FF 형식이어야 합니다'
);

const AspectRatioSchema = z.string().regex(
  AspectRatioPattern, 
  '화면비는 16:9, 2.39:1 등의 형식이어야 합니다'
);

const ResolutionSchema = z.string().regex(
  ResolutionPattern, 
  '해상도는 HD, FHD, 4K 또는 1920x1080 형식이어야 합니다'
);

const ApertureSchema = z.string().regex(
  AperturePattern, 
  '조리개는 f/1.4, f/5.6 형식이어야 합니다'
);

const ShutterSchema = z.string().regex(
  ShutterPattern, 
  '셔터 스피드는 1/50, 1/1000, 0.5s 형식이어야 합니다'
);

const NDFilterSchema = z.string().regex(
  NDFilterPattern, 
  'ND 필터는 ND8, ND0.9, 3 stops 형식이어야 합니다'
);

const TimestampSchema = z.string().regex(
  TimestampPattern, 
  '타임스탬프는 HH:MM:SS.mmm 형식이어야 합니다'
);

// =============================================================================
// 📝 User Input Schema
// =============================================================================

const UserInputSchema = z.object({
  oneLineScenario: z.string().min(1, '시나리오는 필수입니다').max(500, '시나리오는 500자 이내여야 합니다'),
  targetAudience: z.string().max(200, '타겟 오디언스는 200자 이내여야 합니다').optional(),
  referenceUrls: z.array(z.string().url('유효한 URL이 아닙니다'))
    .max(20, '참조 URL은 최대 20개까지 가능합니다').optional(),
  referenceAudioUrl: z.string().url('유효한 오디오 URL이 아닙니다').optional(),
});

// =============================================================================
// 🛠️ Project Config Schema
// =============================================================================

const ProjectConfigSchema = z.object({
  creationMode: z.enum(['VISUAL_FIRST', 'SOUND_FIRST', 'STORY_FIRST']),
  frameworkType: z.enum(['EVENT_DRIVEN', 'DIRECTION_DRIVEN', 'HYBRID']),
  aiAssistantPersona: z.enum(['ASSISTANT_DIRECTOR', 'CINEMATOGRAPHER', 'SCREENWRITER']),
});

// =============================================================================
// 🎨 Style System Schema
// =============================================================================

const StyleFusionSchema = z.object({
  styleA: z.string().min(1, '스타일 A는 필수입니다').max(80, '스타일 A는 80자 이내여야 합니다'),
  styleB: z.string().min(1, '스타일 B는 필수입니다').max(80, '스타일 B는 80자 이내여야 합니다'),
  ratio: z.number().min(0, '비율은 0 이상이어야 합니다').max(1, '비율은 1 이하여야 합니다'),
});

const ExtendedBaseStyleSchema = z.object({
  visualStyle: z.string().min(1, '비주얼 스타일은 필수입니다').max(80, '비주얼 스타일은 80자 이내여야 합니다'),
  genre: z.string().min(1, '장르는 필수입니다').max(80, '장르는 80자 이내여야 합니다'),
  mood: z.string().min(1, '분위기는 필수입니다').max(80, '분위기는 80자 이내여야 합니다'),
  quality: z.string().min(1, '품질은 필수입니다').max(40, '품질은 40자 이내여야 합니다'),
  styleFusion: StyleFusionSchema,
});

// =============================================================================
// 📍 Spatial Context Schema
// =============================================================================

const ExtendedSpatialContextSchema = z.object({
  placeDescription: z.string().min(1, '장소 설명은 필수입니다').max(300, '장소 설명은 300자 이내여야 합니다'),
  weather: z.string().min(1, '날씨는 필수입니다').max(40, '날씨는 40자 이내여야 합니다'),
  lighting: z.string().min(1, '조명은 필수입니다').max(60, '조명은 60자 이내여야 합니다'),
});

// =============================================================================
// 📷 Camera System Schema
// =============================================================================

const PhysicalCameraSettingsSchema = z.object({
  aperture: ApertureSchema.optional(),
  shutter: ShutterSchema.optional(),
  iso: z.number().int().min(25, 'ISO는 25 이상이어야 합니다').max(204800, 'ISO는 204800 이하여야 합니다').optional(),
  ndFilter: NDFilterSchema.optional(),
});

const ExtendedCameraSettingSchema = z.object({
  primaryLens: z.string().min(1, '주 렌즈는 필수입니다').max(60, '주 렌즈는 60자 이내여야 합니다'),
  dominantMovement: z.string().min(1, '주요 움직임은 필수입니다').max(60, '주요 움직임은 60자 이내여야 합니다'),
  colorGrade: z.string().max(120, '색보정은 120자 이내여야 합니다').optional(),
  physical: PhysicalCameraSettingsSchema.optional(),
});

// =============================================================================
// 📐 Delivery Spec Schema
// =============================================================================

const DeliverySpecSchema = z.object({
  durationMs: z.number().int().min(1, '지속 시간은 1ms 이상이어야 합니다'),
  aspectRatio: AspectRatioSchema,
  fps: z.number().min(1, 'FPS는 1 이상이어야 합니다').max(240, 'FPS는 240 이하여야 합니다').optional(),
  resolution: ResolutionSchema.optional(),
  shotType: z.string().max(60, '샷 타입은 60자 이내여야 합니다').optional(),
  bitrateHint: z.string().max(40, '비트레이트 힌트는 40자 이내여야 합니다').optional(),
});

// =============================================================================
// 🎭 Advanced Control Schema
// =============================================================================

const ContinuityControlSchema = z.object({
  singleTake: z.boolean().optional(),
  noCuts: z.boolean().optional(),
  motionVectorContinuity: z.string().max(200, '모션 벡터 연속성은 200자 이내여야 합니다').optional(),
  textureContinuityNote: z.string().max(200, '텍스처 연속성 노트는 200자 이내여야 합니다').optional(),
  transitionPolicy: z.enum(['None', 'Only-internal time ramp', 'No editorial transitions']).optional(),
});

const LookDevelopmentSchema = z.object({
  grade: z.string().max(120, '그레이딩은 120자 이내여야 합니다').optional(),
  grain: z.string().max(80, '그레인은 80자 이내여야 합니다').optional(),
  textureTreatment: z.string().max(120, '텍스처 처리는 120자 이내여야 합니다').optional(),
  lutName: z.string().max(60, 'LUT 이름은 60자 이내여야 합니다').optional(),
  colorTemperature: z.number().min(1000, '색온도는 1000K 이상이어야 합니다').max(20000, '색온도는 20000K 이하여야 합니다').optional(),
  contrastCurve: z.string().max(60, '대비 곡선은 60자 이내여야 합니다').optional(),
});

const CameraPlanSchema = z.object({
  lensRoster: z.array(z.string().min(1, '렌즈명은 필수입니다').max(60, '렌즈명은 60자 이내여야 합니다'))
    .max(20, '렌즈는 최대 20개까지 가능합니다').optional(),
  movementSummary: z.string().max(300, '움직임 요약은 300자 이내여야 합니다').optional(),
  preferredRig: z.string().max(60, '선호 리그는 60자 이내여야 합니다').optional(),
});

// =============================================================================
// 📊 Extended Metadata Schema
// =============================================================================

const ExtendedMetadataSchema = z.object({
  promptName: z.string().min(1, '프롬프트 이름은 필수입니다').max(120, '프롬프트 이름은 120자 이내여야 합니다'),
  baseStyle: ExtendedBaseStyleSchema,
  spatialContext: ExtendedSpatialContextSchema,
  cameraSetting: ExtendedCameraSettingSchema,
  deliverySpec: DeliverySpecSchema,
  continuity: ContinuityControlSchema.optional(),
  lookDev: LookDevelopmentSchema.optional(),
  cameraPlan: CameraPlanSchema.optional(),
});

// =============================================================================
// 🎵 Audio Design Schema
// =============================================================================

const AudioDesignSchema = z.object({
  musicIntent: z.string().max(120, '음악 의도는 120자 이내여야 합니다').optional(),
  sfxPalette: z.array(z.string().min(1, '효과음명은 필수입니다').max(80, '효과음명은 80자 이내여야 합니다'))
    .max(50, '효과음은 최대 50개까지 가능합니다').optional(),
  mixNotes: z.string().max(300, '믹싱 노트는 300자 이내여야 합니다').optional(),
  duckingRules: z.array(z.string().min(1, '덕킹 규칙은 필수입니다').max(120, '덕킹 규칙은 120자 이내여야 합니다'))
    .max(20, '덕킹 규칙은 최대 20개까지 가능합니다').optional(),
});

// =============================================================================
// 🎬 Timeline System Schema
// =============================================================================

const SMPTETimecodeObjectSchema = z.object({
  startMs: z.number().int().min(0, '시작 시간은 0 이상이어야 합니다'),
  endMs: z.number().int().min(0, '종료 시간은 0 이상이어야 합니다'),
  smpteStart: SMPTETimecodeSchema.optional(),
  smpteEnd: SMPTETimecodeSchema.optional(),
}).refine(
  (data) => data.startMs < data.endMs,
  {
    message: '종료 시간은 시작 시간보다 커야 합니다',
    path: ['endMs'],
  }
);

const ExtendedCameraWorkSchema = z.object({
  angle: z.string().min(1, '앵글은 필수입니다').max(40, '앵글은 40자 이내여야 합니다'),
  move: z.string().min(1, '움직임은 필수입니다').max(40, '움직임은 40자 이내여야 합니다'),
  focus: z.string().max(80, '포커스는 80자 이내여야 합니다').optional(),
});

const ExtendedPacingFXSchema = z.object({
  pacing: z.string().min(1, '페이싱은 필수입니다').max(40, '페이싱은 40자 이내여야 합니다'),
  editingStyle: z.string().min(1, '편집 스타일은 필수입니다').max(40, '편집 스타일은 40자 이내여야 합니다'),
  visualEffect: z.string().min(1, '비주얼 이펙트는 필수입니다').max(60, '비주얼 이펙트는 60자 이내여야 합니다'),
});

const AudioLayersSchema = z.object({
  diegetic: z.string().max(200, '실제 소리는 200자 이내여야 합니다').optional(),
  non_diegetic: z.string().max(200, '비실제 소리는 200자 이내여야 합니다').optional(),
  voice: z.string().max(200, '음성은 200자 이내여야 합니다').optional(),
  concept: z.string().max(120, '컨셉트는 120자 이내여야 합니다').optional(),
});

const ExtendedTimelineSegmentSchema = z.object({
  sequence: z.number().int().min(0, '시퀀스는 0 이상이어야 합니다'),
  timestamp: TimestampSchema.optional(),
  timecode: SMPTETimecodeObjectSchema.optional(),
  visualDirecting: z.string().min(1, '비주얼 연출은 필수입니다').max(600, '비주얼 연출은 600자 이내여야 합니다'),
  cameraWork: ExtendedCameraWorkSchema,
  pacingFX: ExtendedPacingFXSchema,
  audioLayers: AudioLayersSchema,
  actionNote: z.string().max(600, '액션 노트는 600자 이내여야 합니다').optional(),
  audioNote: z.string().max(300, '오디오 노트는 300자 이내여야 합니다').optional(),
  visualNote: z.string().max(300, '비주얼 노트는 300자 이내여야 합니다').optional(),
}).refine(
  (data) => data.timestamp || data.timecode,
  {
    message: 'timestamp 또는 timecode 중 하나는 반드시 제공되어야 합니다',
    path: ['timestamp'],
  }
);

// =============================================================================
// 🧩 Elements Schema
// =============================================================================

const ExtendedCharacterSchema = z.object({
  id: z.string().min(1, '캐릭터 ID는 필수입니다').max(60, '캐릭터 ID는 60자 이내여야 합니다'),
  description: z.string().min(1, '캐릭터 설명은 필수입니다').max(300, '캐릭터 설명은 300자 이내여야 합니다'),
  reference_image_url: z.string().url('유효한 이미지 URL이 아닙니다').optional(),
});

const ExtendedCoreObjectSchema = z.object({
  id: z.string().min(1, '오브젝트 ID는 필수입니다').max(60, '오브젝트 ID는 60자 이내여야 합니다'),
  description: z.string().min(1, '오브젝트 설명은 필수입니다').max(300, '오브젝트 설명은 300자 이내여야 합니다'),
  material: z.string().max(60, '재질은 60자 이내여야 합니다').optional(),
  reference_image_url: z.string().url('유효한 이미지 URL이 아닙니다').optional(),
});

const AssemblyDirectivesSchema = z.object({
  sourceContainer: z.string().max(120, '소스 컨테이너는 120자 이내여야 합니다').optional(),
  assembledElements: z.array(z.string().min(1, '요소명은 필수입니다').max(120, '요소명은 120자 이내여야 합니다'))
    .max(100, '조립 요소는 최대 100개까지 가능합니다').optional(),
  animationModel: z.string().max(120, '애니메이션 모델은 120자 이내여야 합니다').optional(),
  physicalityNote: z.string().max(200, '물리성 노트는 200자 이내여야 합니다').optional(),
});

const ExtendedElementsSchema = z.object({
  characters: z.array(ExtendedCharacterSchema).max(50, '캐릭터는 최대 50개까지 가능합니다'),
  coreObjects: z.array(ExtendedCoreObjectSchema).max(100, '핵심 오브젝트는 최대 100개까지 가능합니다'),
  assemblyDirectives: AssemblyDirectivesSchema.optional(),
});

// =============================================================================
// 🎛️ Generation Control Schema
// =============================================================================

const DirectorEmphasisSchema = z.object({
  term: z.string().min(1, '용어는 필수입니다').max(80, '용어는 80자 이내여야 합니다'),
  weight: z.number().min(-3, '가중치는 -3 이상이어야 합니다').max(3, '가중치는 3 이하여야 합니다'),
});

const ShotByShotSchema = z.object({
  enabled: z.boolean(),
  lockedSegments: z.array(z.number().int().min(0, '시퀀스 번호는 0 이상이어야 합니다'))
    .max(500, '잠긴 세그먼트는 최대 500개까지 가능합니다').optional(),
  lastFrameData: z.object({
    imageUrl: z.string().url('유효한 이미지 URL이 아닙니다'),
    description: z.string().max(300, '설명은 300자 이내여야 합니다'),
  }).optional(),
});

const ComplianceControlSchema = z.object({
  brandName: z.string().max(80, '브랜드명은 80자 이내여야 합니다').optional(),
  logoVisibility: z.string().max(80, '로고 가시성은 80자 이내여야 합니다').optional(),
  legalRestrictions: z.array(z.string().min(1, '제한사항은 필수입니다').max(120, '제한사항은 120자 이내여야 합니다'))
    .max(50, '법적 제한사항은 최대 50개까지 가능합니다').optional(),
  negativeOverlays: z.array(z.string().min(1, '네거티브 오버레이는 필수입니다').max(120, '네거티브 오버레이는 120자 이내여야 합니다'))
    .max(50, '네거티브 오버레이는 최대 50개까지 가능합니다').optional(),
});

const GenerationControlSchema = z.object({
  directorEmphasis: z.array(DirectorEmphasisSchema).max(50, '감독 강조점은 최대 50개까지 가능합니다'),
  shotByShot: ShotByShotSchema,
  compliance: ComplianceControlSchema.optional(),
  seed: z.number().int().min(0, '시드값은 0 이상이어야 합니다').max(2147483647, '시드값은 2147483647 이하여야 합니다'),
});

// =============================================================================
// 📤 Final Output Schema
// =============================================================================

const FinalOutputSchema = z.object({
  finalPromptText: z.string().min(1, '최종 프롬프트 텍스트는 필수입니다').max(5000, '최종 프롬프트 텍스트는 5000자 이내여야 합니다'),
  keywords: z.array(z.string().min(1, '키워드는 필수입니다').max(60, '키워드는 60자 이내여야 합니다'))
    .max(200, '키워드는 최대 200개까지 가능합니다'),
  negativePrompts: z.array(z.string().min(1, '네거티브 프롬프트는 필수입니다').max(60, '네거티브 프롬프트는 60자 이내여야 합니다'))
    .max(200, '네거티브 프롬프트는 최대 200개까지 가능합니다'),
});

// =============================================================================
// 🎯 Prompt Blueprint Schema
// =============================================================================

const PromptBlueprintSchema = z.object({
  metadata: ExtendedMetadataSchema,
  elements: ExtendedElementsSchema,
  audioDesign: AudioDesignSchema.optional(),
  timeline: z.array(ExtendedTimelineSegmentSchema).min(1, '타임라인은 최소 1개 세그먼트가 필요합니다').max(500, '타임라인은 최대 500개 세그먼트까지 가능합니다'),
});

// =============================================================================
// 🎬 Main CineGenius v3.1 Schema
// =============================================================================

export const CineGeniusV3PromptSchema = z.object({
  version: z.literal('3.1'),
  projectId: UUIDSchema,
  createdAt: z.string().datetime('유효한 날짜 형식이 아닙니다'),
  userInput: UserInputSchema,
  projectConfig: ProjectConfigSchema,
  promptBlueprint: PromptBlueprintSchema,
  generationControl: GenerationControlSchema,
  aiAnalysis: z.record(z.string(), z.any()).optional(),
  finalOutput: FinalOutputSchema,
  uiHints: z.record(z.string(), z.array(z.union([z.string(), z.number()]))).optional(),
}).refine(
  // 연속성 제어 규칙: noCuts = true일 때 편집 스타일 제한
  (data) => {
    if (data.promptBlueprint.metadata.continuity?.noCuts) {
      const forbiddenStyles = ['Jump Cut', 'Cross-dissolve', 'Wipe', 'Split Screen'];
      return !data.promptBlueprint.timeline.some(segment =>
        forbiddenStyles.includes(segment.pacingFX.editingStyle)
      );
    }
    return true;
  },
  {
    message: 'noCuts가 활성화되었을 때는 Jump Cut, Cross-dissolve, Wipe, Split Screen 편집 스타일을 사용할 수 없습니다',
    path: ['promptBlueprint', 'timeline'],
  }
).refine(
  // 타임라인 시퀀스 유일성 검증
  (data) => {
    const sequences = data.promptBlueprint.timeline.map(segment => segment.sequence);
    return new Set(sequences).size === sequences.length;
  },
  {
    message: '타임라인 시퀀스 번호는 중복될 수 없습니다',
    path: ['promptBlueprint', 'timeline'],
  }
);

// =============================================================================
// 🔄 Legacy Schema Import
// =============================================================================

import { 
  ScenePromptSchema,
  KidChoiceSchema,
  RecommendCardSchema,
  EnhancementBundleSchema 
} from './schema';

// =============================================================================
// 🚀 Universal Schema (Version Detection)
// =============================================================================

/**
 * 버전을 감지하여 적절한 스키마로 검증하는 Universal Schema
 */
export const UniversalPromptSchema = z.union([
  // CineGenius v3.1
  CineGeniusV3PromptSchema,
  
  // Legacy Schemas (v2.x)
  ScenePromptSchema.extend({ version: z.literal('2.x').optional() }),
  KidChoiceSchema.extend({ version: z.literal('2.x').optional() }),
  RecommendCardSchema.extend({ version: z.literal('2.x').optional() }),
  EnhancementBundleSchema.extend({ version: z.literal('2.x').optional() }),
]);

// =============================================================================
// 🛠️ Validation Helpers
// =============================================================================

/**
 * 프롬프트 버전 감지 및 검증
 */
export function validatePrompt(data: unknown) {
  try {
    return UniversalPromptSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const friendlyErrors = error.issues.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      throw new Error(`검증 실패: ${JSON.stringify(friendlyErrors, null, 2)}`);
    }
    throw error;
  }
}

/**
 * CineGenius v3.1 전용 검증
 */
export function validateV3Prompt(data: unknown) {
  try {
    return CineGeniusV3PromptSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error);
      const friendlyErrors = (error.issues || []).map(err => ({
        path: (err.path || []).join('.'),
        message: err.message,
        code: err.code,
      }));
      throw new Error(`CineGenius v3.1 검증 실패: ${JSON.stringify(friendlyErrors, null, 2)}`);
    }
    throw error;
  }
}

/**
 * 부분 검증 (Draft 단계용)
 */
export const PartialV3Schema = CineGeniusV3PromptSchema.partial({
  promptBlueprint: true,
  generationControl: true,
  finalOutput: true,
});

export function validatePartialV3Prompt(data: unknown) {
  return PartialV3Schema.parse(data);
}

// =============================================================================
// 🧪 Development Helpers
// =============================================================================

/**
 * 개발용: 스키마 구조 출력
 */
export function printSchemaStructure() {
  if (process.env.NODE_ENV === 'development') {
    console.log('📋 CineGenius v3.1 Schema Structure:');
    console.log(JSON.stringify(CineGeniusV3PromptSchema.shape, null, 2));
  }
}

/**
 * 개발용: 예제 데이터 생성
 */
export function createV3Example() {
  return {
    version: '3.1' as const,
    projectId: '123e4567-e89b-12d3-a456-426614174000',
    createdAt: new Date().toISOString(),
    userInput: {
      oneLineScenario: '미래 도시에서 벌어지는 액션 스릴러',
      targetAudience: '20-40세 액션 영화 팬',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST' as const,
      frameworkType: 'HYBRID' as const,
      aiAssistantPersona: 'CINEMATOGRAPHER' as const,
    },
    promptBlueprint: {
      metadata: {
        promptName: '네오서울 체이스',
        baseStyle: {
          visualStyle: 'Cyberpunk',
          genre: 'Action-Thriller',
          mood: 'Tense',
          quality: '4K',
          styleFusion: {
            styleA: 'Christopher Nolan',
            styleB: 'Denis Villeneuve',
            ratio: 0.7,
          },
        },
        spatialContext: {
          placeDescription: '2087년 네온사인이 빛나는 미래 도시',
          weather: 'Rain',
          lighting: 'Neon Glow',
        },
        cameraSetting: {
          primaryLens: '35mm (Natural)',
          dominantMovement: 'Smooth Tracking (Dolly)',
          colorGrade: 'Cyberpunk Blue-Orange',
          physical: {
            aperture: 'f/2.8',
            shutter: '1/50',
            iso: 800,
            ndFilter: 'ND8',
          },
        },
        deliverySpec: {
          durationMs: 8000,
          aspectRatio: '16:9',
          fps: 24,
          resolution: '4K',
        },
      },
      elements: {
        characters: [
          {
            id: 'protagonist',
            description: '검은 코트를 입은 사이버 해커',
          },
        ],
        coreObjects: [
          {
            id: 'vehicle',
            description: '날아다니는 스포츠카',
            material: 'Carbon Fiber',
          },
        ],
      },
      timeline: [
        {
          sequence: 0,
          timestamp: '00:00:00.000',
          visualDirecting: '주인공이 빌딩 옥상에서 도시를 내려다본다',
          cameraWork: {
            angle: 'Wide Shot (WS)',
            move: 'Static Shot',
            focus: 'Deep Focus',
          },
          pacingFX: {
            pacing: 'Real-time',
            editingStyle: 'Standard Cut',
            visualEffect: 'Lens Flare',
          },
          audioLayers: {
            diegetic: '도시 소음, 비 소리',
            non_diegetic: '긴장감 있는 사운드트랙',
            voice: '',
            concept: 'Cyberpunk Atmosphere',
          },
        },
      ],
    },
    generationControl: {
      directorEmphasis: [
        { term: 'cyberpunk aesthetic', weight: 2.5 },
        { term: 'neon lighting', weight: 2.0 },
      ],
      shotByShot: {
        enabled: false,
      },
      seed: 42,
    },
    finalOutput: {
      finalPromptText: '4K cyberpunk action thriller scene...',
      keywords: ['cyberpunk', 'future city', 'neon', 'rain', 'thriller'],
      negativePrompts: ['blurry', 'low quality', 'amateur'],
    },
  };
}