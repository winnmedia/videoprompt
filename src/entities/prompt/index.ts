/**
 * Prompt Entity - Public API
 *
 * CLAUDE.md 준수: FSD Public API 패턴
 * entities/prompt 레이어의 유일한 외부 접근점
 */

// 타입 정의 모두 export
export type {
  VLANETPrompt,
  UserInput,
  ReferenceSnapshot,
  ProjectConfig,
  Profile,
  BrandPolicy,
  PromptBlueprint,
  PromptMetadata,
  BaseStyle,
  StyleFusion,
  DirectorStyle,
  SpatialContext,
  CameraSetting,
  PhysicalCameraSetting,
  DeliverySpec,
  Continuity,
  LookDev,
  CameraPlan,
  Elements,
  Character,
  CoreObject,
  AssemblyDirectives,
  AudioDesign,
  GrammarPolicy,
  TimelineItem,
  Timecode,
  CameraWork,
  PacingFX,
  AudioLayers,
  GenerationControl,
  EmphasisTerm,
  InitializationImage,
  ShotByShot,
  LastFrameData,
  Compliance,
  CulturalConstraints,
  Reproducibility,
  FinalOutput,
  FinalOutputCompact,
  CompactMetadata,
  CompactTimelineItem,
  PromptGenerationInput,
  PromptGenerationResponse,
  PromptError,
  PromptValidationResult,
} from './types'

// 상수 정의
export const VLANET_SCHEMA_VERSION = '1.0' as const

export const DIRECTOR_STYLES = [
  'Christopher Nolan',
  'David Fincher',
  'Wes Anderson',
  'Tim Burton',
  'Sofia Coppola',
  'Bong Joon-ho',
  'Denis Villeneuve',
] as const

export const CAMERA_ANGLES = [
  'Wide Shot (WS)',
  'Medium Shot (MS)',
  'Close Up (CU)',
  'Extreme Close Up (ECU)',
  'Point of View (POV)',
] as const

export const CAMERA_MOVEMENTS = [
  'Pan (Left/Right)',
  'Tilt (Up/Down)',
  'Dolly (In/Out)',
  'Tracking (Follow)',
  'Whip Pan',
  'Static Shot',
] as const

export const ASPECT_RATIOS = ['9:16', '1:1', '4:5', '16:9', '2.39:1'] as const

export const QUALITY_OPTIONS = ['4K', '8K', 'IMAX Quality', 'HD'] as const

export const WEATHER_OPTIONS = [
  'Clear',
  'Rain',
  'Heavy Rain',
  'Snow',
  'Fog',
  'Overcast',
] as const

export const LIGHTING_OPTIONS = [
  'Daylight (Midday)',
  'Golden Hour',
  'Night',
  'Studio Lighting',
  'Harsh Midday Sun',
  'Single Key Light (Rembrandt)',
  'Backlit Silhouette',
  'Neon Glow',
] as const