/**
 * VLANET Prompt v1.0 Schema Types
 *
 * 프롬프트 생성 도메인의 핵심 타입 정의
 * CLAUDE.md 준수: FSD entities 레이어, 도메인 순수성
 */

/**
 * VLANET Prompt v1.0 메인 스키마
 */
export interface VLANETPrompt {
  version: '1.0'
  projectId: string // UUID v4 형식
  createdAt: string // ISO date-time
  userInput: UserInput
  projectConfig: ProjectConfig
  promptBlueprint: PromptBlueprint
  generationControl: GenerationControl
  profiles?: Profile[]
  brandPolicies?: BrandPolicy[]
  audioDesign?: AudioDesign
  reproducibility?: Reproducibility
  aiAnalysis?: Record<string, unknown>
  finalOutput?: FinalOutput
  finalOutputCompact?: FinalOutputCompact
  uiHints?: Record<string, unknown>
}

/**
 * 사용자 입력 데이터
 */
export interface UserInput {
  oneLineScenario: string
  targetAudience?: string
  referenceUrls?: string[]
  referenceAudioUrl?: string
  referenceSnapshots?: ReferenceSnapshot[]
}

export interface ReferenceSnapshot {
  url: string
  sha256: string // 64자 헥스
  fetchedAt: string // ISO date-time
  mimeType?: string
}

/**
 * 프로젝트 설정
 */
export interface ProjectConfig {
  creationMode: 'VISUAL_FIRST' | 'SOUND_FIRST'
  frameworkType: 'EVENT_DRIVEN' | 'DIRECTION_DRIVEN' | 'HYBRID'
  aiAssistantPersona: 'ASSISTANT_DIRECTOR' | 'CINEMATOGRAPHER' | 'SCREENWRITER'
  profileId?: string
}

/**
 * 프로파일 정의
 */
export interface Profile {
  name: string
  lockedFields?: string[]
  overrides?: Record<string, string | number | boolean | unknown[]>
}

/**
 * 브랜드 정책
 */
export interface BrandPolicy {
  id: string
  logoRules?: string
  colorUsage?: string
  negativeOverlays?: string[]
  legalNotes?: string
}

/**
 * 프롬프트 블루프린트 - 핵심 생성 데이터
 */
export interface PromptBlueprint {
  metadata: PromptMetadata
  elements: Elements
  timeline: TimelineItem[]
}

/**
 * 프롬프트 메타데이터
 */
export interface PromptMetadata {
  promptName: string
  baseStyle: BaseStyle
  spatialContext: SpatialContext
  cameraSetting: CameraSetting
  deliverySpec: DeliverySpec
  continuity?: Continuity
  lookDev?: LookDev
  cameraPlan?: CameraPlan
}

export interface BaseStyle {
  visualStyle: string
  genre: string
  mood: string
  quality: '4K' | '8K' | 'IMAX Quality' | 'HD'
  styleFusion: StyleFusion
}

export interface StyleFusion {
  styleA: DirectorStyle
  styleB: DirectorStyle
  ratio: number // 0-1
}

export type DirectorStyle =
  | 'Christopher Nolan'
  | 'David Fincher'
  | 'Wes Anderson'
  | 'Tim Burton'
  | 'Sofia Coppola'
  | 'Bong Joon-ho'
  | 'Denis Villeneuve'

export interface SpatialContext {
  placeDescription: string
  weather: 'Clear' | 'Rain' | 'Heavy Rain' | 'Snow' | 'Fog' | 'Overcast'
  lighting:
    | 'Daylight (Midday)'
    | 'Golden Hour'
    | 'Night'
    | 'Studio Lighting'
    | 'Harsh Midday Sun'
    | 'Single Key Light (Rembrandt)'
    | 'Backlit Silhouette'
    | 'Neon Glow'
  regionTag?: string
}

export interface CameraSetting {
  primaryLens:
    | '14mm Ultra-Wide'
    | '24mm Wide-angle'
    | '35mm (Natural)'
    | '50mm Standard'
    | '85mm Portrait'
    | '90mm Macro'
  dominantMovement:
    | 'Static Shot'
    | 'Shaky Handheld'
    | 'Smooth Tracking (Dolly)'
    | 'Whip Pan'
    | 'Jib/Crane Shot'
    | 'Drone Fly-over'
    | 'Vertigo Effect (Dolly Zoom)'
  colorGrade?: string
  physical?: PhysicalCameraSetting
}

export interface PhysicalCameraSetting {
  aperture?: string // f/1.4 형식
  shutter?: string // 1/60 또는 0.5s 형식
  iso?: number // 25-204800
  ndFilter?: string // ND8 형식
}

export interface DeliverySpec {
  durationMs: number
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9' | '2.39:1'
  fps?: 24 | 25 | 30 | 50 | 60
  resolution?: 'HD' | 'FHD' | '4K' | '8K'
  shotType?: string
  bitrateHint?: string
}

export interface Continuity {
  singleTake?: boolean
  noCuts?: boolean
  motionVectorContinuity?: string
  textureContinuityNote?: string
  transitionPolicy?: 'None' | 'Only-internal time ramp' | 'No editorial transitions'
}

export interface LookDev {
  grade?: string
  grain?: 'None' | 'Fine cinematic' | 'Medium 35mm' | 'Coarse 16mm'
  textureTreatment?: string
  lutName?: string
  colorTemperature?: number // 1000-20000
  contrastCurve?: string
}

export interface CameraPlan {
  lensRoster?: string[]
  movementSummary?: string
  preferredRig?: 'Handheld' | 'Dolly' | 'Gimbal' | 'Crane' | 'Drone'
}

/**
 * 요소 정의 (캐릭터, 오브젝트 등)
 */
export interface Elements {
  characters: Character[]
  coreObjects: CoreObject[]
  assemblyDirectives?: AssemblyDirectives
}

export interface Character {
  id: string
  description: string
  reference_image_url?: string
}

export interface CoreObject {
  id: string
  description: string
  material?: string
  reference_image_url?: string
}

export interface AssemblyDirectives {
  sourceContainer?: string
  assembledElements?: string[]
  animationModel?: string
  physicalityNote?: string
}

/**
 * 오디오 디자인
 */
export interface AudioDesign {
  musicIntent?: string
  sfxPalette?: string[]
  mixNotes?: string
  duckingRules?: string[]
  grammarPolicy?: GrammarPolicy
}

export interface GrammarPolicy {
  autoWrapDiegetic?: boolean
  autoWrapNonDiegetic?: boolean
  musicKeywords?: string[]
}

/**
 * 타임라인 아이템 (개별 샷)
 */
export interface TimelineItem {
  sequence: number
  timestamp?: string // HH:MM:SS.mmm 형식
  timecode?: Timecode
  visualDirecting: string
  cameraWork: CameraWork
  pacingFX: PacingFX
  audioLayers: AudioLayers
  actionNote?: string
  audioNote?: string
  visualNote?: string
}

export interface Timecode {
  startMs?: number
  endMs?: number
  smpteStart?: string // HH:MM:SS:FF 형식
  smpteEnd?: string
}

export interface CameraWork {
  angle: 'Wide Shot (WS)' | 'Medium Shot (MS)' | 'Close Up (CU)' | 'Extreme Close Up (ECU)' | 'Point of View (POV)'
  move: 'Pan (Left/Right)' | 'Tilt (Up/Down)' | 'Dolly (In/Out)' | 'Tracking (Follow)' | 'Whip Pan' | 'Static Shot'
  focus?: string
}

export interface PacingFX {
  pacing: 'Real-time' | 'Slow-motion (0.5x)' | 'Fast-motion (2x)' | 'Time-lapse' | 'Freeze-frame'
  editingStyle:
    | 'None'
    | 'Only-internal time ramp'
    | 'Standard Cut'
    | 'Match Cut'
    | 'Jump Cut'
    | 'Cross-dissolve'
    | 'Wipe'
    | 'Split Screen'
  visualEffect:
    | 'None'
    | 'Lens Flare'
    | 'Light Leaks'
    | 'Film Grain'
    | 'Chromatic Aberration'
    | 'Slow Shutter (Motion Blur)'
}

export interface AudioLayers {
  diegetic: string // [SFX: ...] 형식 또는 빈 문자열
  non_diegetic: string // [Music: ...] 또는 [Score: ...] 형식 또는 빈 문자열
  voice: string // "Speaker: dialogue" 형식 또는 빈 문자열
  concept:
    | ''
    | 'Muffled Underwater Audio'
    | 'Heartbeat Rhythm'
    | 'High-frequency Ringing'
    | 'Glitchy Digital Noise'
    | 'Warm Vinyl Crackle'
}

/**
 * 생성 제어
 */
export interface GenerationControl {
  directorEmphasis: EmphasisTerm[]
  initializationImage?: InitializationImage
  shotByShot: ShotByShot
  compliance?: Compliance
  seed: number // 0-2147483647
}

export interface EmphasisTerm {
  term: string
  weight: number // -3 to 3
}

export interface InitializationImage {
  imageUrl?: string
  strength?: number // 0.1-1.0
}

export interface ShotByShot {
  enabled: boolean
  lockedSegments?: number[]
  lastFrameData?: LastFrameData
}

export interface LastFrameData {
  imageUrl: string
  description: string
}

export interface Compliance {
  disableTextOverlays?: boolean
  brandName?: string
  logoVisibility?: string
  legalRestrictions?: string[]
  negativeOverlays?: string[]
  brandPolicyId?: string
  culturalConstraints?: CulturalConstraints
}

export interface CulturalConstraints {
  allowedMotifs?: string[]
  disallowedMotifs?: string[]
  regionLocale?: string
}

/**
 * 재현성 메타데이터
 */
export interface Reproducibility {
  promptHash?: string
  schemaVersion?: string
  toolchain?: string
  randomSeedPolicy?: 'FIXED' | 'SEMI_FIXED' | 'UNFIXED'
}

/**
 * 최종 출력 (상세형)
 */
export interface FinalOutput {
  finalPromptText: string
  keywords: string[]
  negativePrompts: string[]
}

/**
 * 최종 출력 (간결형)
 */
export interface FinalOutputCompact {
  metadata: CompactMetadata
  key_elements: string[]
  assembled_elements: string[]
  negative_prompts: string[]
  timeline: CompactTimelineItem[]
  text: string
  keywords: string[]
}

export interface CompactMetadata {
  prompt_name: string
  base_style: string
  aspect_ratio: string // "9:16" 형식
  room_description: string
  camera_setup: string
}

export interface CompactTimelineItem {
  sequence: number
  timestamp: string // "mm:ss-mm:ss" 형식
  action: string
  audio: string
}

/**
 * 프롬프트 생성 입력 데이터
 */
export interface PromptGenerationInput {
  selectedShotIds: string[]
  projectId: string
  userPreferences?: Partial<ProjectConfig>
  customPromptName?: string
}

/**
 * 프롬프트 생성 응답
 */
export interface PromptGenerationResponse {
  prompt: VLANETPrompt
  generatedAt: string
  processingTimeMs: number
  warnings?: string[]
}

/**
 * 에러 타입
 */
export interface PromptError {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * 검증 결과
 */
export interface PromptValidationResult {
  isValid: boolean
  errors: PromptError[]
  warnings?: string[]
}