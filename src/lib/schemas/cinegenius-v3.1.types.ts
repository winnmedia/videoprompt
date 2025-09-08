/**
 * CineGenius v3.1 TypeScript 타입 정의
 * 
 * CineGenius v3.1 JSON Schema에서 파생된 TypeScript 타입들
 * Zod 스키마와 연동하여 런타임 검증과 컴파일 타임 타입 체킹을 동시에 지원
 */

import type { z } from 'zod';
import {
  UUIDSchema,
  CameraAngleSchema,
  CameraMovementSchema,
  LightingSchema,
  WeatherSchema,
  UserInputSchema,
  ProjectConfigSchema,
  PromptElementSchema,
  ElementConfigSchema,
  CoreElementsSchema,
  CinematographySchema,
  EnvironmentSchema,
  StyleDirectionSchema,
  PromptBlueprintSchema,
  GenerationControlSchema,
  AudioLayerSchema,
  VeoGenerationConfigSchema,
  FinalOutputSchema,
  CineGeniusV31Schema
} from './cinegenius-v3.1.zod';

// 기본 타입들
export type UUID = z.infer<typeof UUIDSchema>;
export type CameraAngle = z.infer<typeof CameraAngleSchema>;
export type CameraMovement = z.infer<typeof CameraMovementSchema>;
export type Lighting = z.infer<typeof LightingSchema>;
export type Weather = z.infer<typeof WeatherSchema>;

// 사용자 입력 관련 타입들
export type UserInput = z.infer<typeof UserInputSchema>;

// 프로젝트 설정 관련 타입들
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// 프롬프트 요소 관련 타입들
export type PromptElement = z.infer<typeof PromptElementSchema>;
export type ElementConfig = z.infer<typeof ElementConfigSchema>;
export type CoreElements = z.infer<typeof CoreElementsSchema>;

// 촬영 및 환경 관련 타입들
export type Cinematography = z.infer<typeof CinematographySchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type StyleDirection = z.infer<typeof StyleDirectionSchema>;

// 프롬프트 블루프린트 관련 타입들
export type PromptBlueprint = z.infer<typeof PromptBlueprintSchema>;

// 생성 제어 관련 타입들
export type GenerationControl = z.infer<typeof GenerationControlSchema>;
export type AudioLayer = z.infer<typeof AudioLayerSchema>;
export type VeoGenerationConfig = z.infer<typeof VeoGenerationConfigSchema>;

// 최종 출력 관련 타입들
export type FinalOutput = z.infer<typeof FinalOutputSchema>;

// 메인 CineGenius v3.1 타입
export type CineGeniusV31 = z.infer<typeof CineGeniusV31Schema>;

// 유틸리티 타입들
export interface PromptGenerationOptions {
  /** Veo 3 최적화 활성화 */
  enableVeoOptimization?: boolean;
  /** 오디오 레이어 포함 여부 */
  includeAudioLayers?: boolean;
  /** 텍스트 오버레이 비활성화 */
  disableTextOverlays?: boolean;
  /** 최대 프롬프트 길이 (Veo 3 제한) */
  maxPromptLength?: number;
}

export interface ValidationResult {
  /** 검증 성공 여부 */
  isValid: boolean;
  /** 오류 메시지들 */
  errors: string[];
  /** 경고 메시지들 */
  warnings: string[];
}

export interface PromptCompilationResult {
  /** 컴파일된 최종 프롬프트 */
  compiledPrompt: string;
  /** Veo 3 최적화된 메타데이터 */
  metadata: {
    cameraInstructions: string[];
    audioInstructions: string[];
    visualPriorities: string[];
  };
  /** 검증 결과 */
  validation: ValidationResult;
}

// 레거시 v2 호환성을 위한 타입 매핑
export interface LegacyV2Metadata {
  prompt_name: string;
  base_style: string;
  aspect_ratio: string;
  room_description: string;
  camera_setup: string;
}

export interface LegacyV2Timeline {
  sequence: number;
  timestamp: string;
  action: string;
  audio: string;
}

export interface LegacyV2ScenePrompt {
  metadata: LegacyV2Metadata;
  key_elements: string[];
  assembled_elements: string[];
  negative_prompts?: string[];
  timeline: LegacyV2Timeline[];
  text: 'none' | string;
  keywords: string[];
}

// v2에서 v3.1로 마이그레이션을 위한 변환 함수 타입
export type V2ToV3MigrationFunction = (v2Data: LegacyV2ScenePrompt) => CineGeniusV31;

// Veo 3 특화 타입들
export interface VeoAudioSyntax {
  /** 음향 효과: [SFX: 효과명] */
  sfx: string[];
  /** 배경음악: [Music: 음악 설명] */
  music: string[];
  /** 대화: Speaker Name: "대화 내용" */
  dialogue: Array<{
    speaker: string;
    text: string;
  }>;
}

export interface VeoCameraInstruction {
  /** 카메라 움직임 명령 */
  movement: CameraMovement;
  /** 카메라 각도 */
  angle: CameraAngle;
  /** 지속 시간 (초) */
  duration: number;
  /** 우선순위 (1-10) */
  priority: number;
}

// UI 컴포넌트를 위한 헬퍼 타입들
export interface UISelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormFieldConfig {
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean';
  label: string;
  placeholder?: string;
  options?: UISelectOption[];
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  hint?: string;
}

// 프롬프트 생성 워크플로우 타입들
export type PromptGenerationStep = 
  | 'user_input'
  | 'project_config' 
  | 'prompt_blueprint'
  | 'generation_control'
  | 'final_output';

export interface WorkflowStep {
  step: PromptGenerationStep;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  canSkip: boolean;
}

export interface PromptGenerationWorkflow {
  steps: WorkflowStep[];
  currentStep: PromptGenerationStep;
  data: Partial<CineGeniusV31>;
  isGenerating: boolean;
}

// 에러 타입들
export class CineGeniusValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'CineGeniusValidationError';
  }
}

export class PromptCompilationError extends Error {
  constructor(
    message: string,
    public stage: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PromptCompilationError';
  }
}

// 상수 타입들
export const CINEGENIUS_VERSION = '3.1' as const;
export const MAX_VEO_PROMPT_LENGTH = 2000 as const;
export const MIN_VIDEO_DURATION = 5 as const;
export const MAX_VIDEO_DURATION = 20 as const;

// 내보내기를 위한 네임스페이스
export namespace CineGeniusV31Types {
  export type Schema = CineGeniusV31;
  export type UserInput = UserInput;
  export type ProjectConfig = ProjectConfig;
  export type PromptBlueprint = PromptBlueprint;
  export type GenerationControl = GenerationControl;
  export type FinalOutput = FinalOutput;
  export type ValidationResult = ValidationResult;
  export type CompilationResult = PromptCompilationResult;
}

// 기본 내보내기
export default CineGeniusV31;