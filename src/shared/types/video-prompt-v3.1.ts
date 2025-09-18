/**
 * CineGenius v3.1 VideoPrompt UI 타입 정의
 * 
 * 새로운 CineGenius v3.1 스키마와 기존 UI 컴포넌트를 연결하는 타입들
 * 기존 video-prompt.ts와의 호환성을 유지하면서 점진적 마이그레이션 지원
 */

import type {
  CineGeniusV31,
  PromptGenerationWorkflow,
  WorkflowStep,
  PromptGenerationStep
} from '@/lib/schemas/cinegenius-v3.1.types';

// UI 상태 관리를 위한 프롬프트 생성 상태
export interface PromptGenerationStateV31 {
  // 워크플로우 관리
  workflow: PromptGenerationWorkflow;
  
  // CineGenius v3.1 데이터
  data: Partial<CineGeniusV31>;
  
  // UI 상태
  isGenerating: boolean;
  isValidating: boolean;
  
  // 생성된 결과
  compiledPrompt?: string;
  
  // 에러 및 검증
  errors: Record<string, string[]>;
  warnings: string[];
  
  // 레거시 호환성
  legacyMode: boolean;
}

// 단계별 폼 데이터 타입들
export interface UserInputFormData {
  directPrompt: string;
  referenceImages: Array<{
    url: string;
    description: string;
  }>;
  creativeBrief: string;
  targetAudience: string;
  styleProceedModifier: string;
}

export interface ProjectConfigFormData {
  projectName: string;
  videoLength: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '21:9';
  outputFormat: string;
  priority: number;
  metadata: Record<string, any>;
}

export interface PromptBlueprintFormData {
  coreElements: {
    visualElements: Array<{
      type: string;
      description: string;
      priority: number;
      metadata: Record<string, any>;
    }>;
    actionElements: Array<{
      type: string;
      description: string;
      timing: string;
      intensity: number;
    }>;
  };
  cinematography: {
    cameraAngle: string;
    cameraMovement: string;
    duration: number;
    transitionType: string;
  };
  environment: {
    location: string;
    timeOfDay: string;
    lighting: string;
    weather: string;
    mood: string;
  };
  styleDirection: {
    visualStyle: string;
    colorPalette: string;
    mood: string;
    referenceStyle: string;
  };
}

export interface GenerationControlFormData {
  audioLayers: Array<{
    type: 'sfx' | 'music' | 'dialogue' | 'ambient';
    description?: string;
    speaker?: string;
    content?: string;
    timing: string;
    volume: number;
  }>;
  veoOptimization: {
    disableTextOverlays: boolean;
    priorityMode: 'balanced' | 'visual' | 'audio' | 'motion';
    maxPromptLength: number;
  };
}

// UI 컴포넌트 Props 타입들
export interface StepIndicatorProps {
  steps: WorkflowStep[];
  currentStep: PromptGenerationStep;
  onStepClick: (step: PromptGenerationStep) => void;
}

export interface FormStepProps<T> {
  data: T;
  onDataChange: (data: Partial<T>) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  errors?: Record<string, string[]>;
  isLoading?: boolean;
}

// 개별 폼 컴포넌트 Props
export type UserInputFormProps = FormStepProps<UserInputFormData>;
export type ProjectConfigFormProps = FormStepProps<ProjectConfigFormData>;
export type PromptBlueprintFormProps = FormStepProps<PromptBlueprintFormData>;
export type GenerationControlFormProps = FormStepProps<GenerationControlFormData>;

// 최종 출력 및 프리뷰 Props
export interface FinalOutputProps {
  data: Partial<CineGeniusV31>;
  compiledPrompt: string;
  isGenerating: boolean;
  onGenerate: () => Promise<void>;
  onExport: (format: 'json' | 'txt' | 'prompt') => void;
  onSave: () => Promise<void>;
}

// 레거시 호환성을 위한 어댑터 타입들
export interface LegacyAdapter {
  // v2 -> v3.1 변환
  fromLegacy: (legacyData: any) => Partial<CineGeniusV31>;
  // v3.1 -> v2 변환 (하위 호환성)
  toLegacy: (v31Data: CineGeniusV31) => any;
}

// UI 상태 액션 타입들
export type PromptStateAction =
  | { type: 'SET_STEP'; step: PromptGenerationStep }
  | { type: 'UPDATE_DATA'; data: Partial<CineGeniusV31> }
  | { type: 'SET_GENERATING'; isGenerating: boolean }
  | { type: 'SET_VALIDATING'; isValidating: boolean }
  | { type: 'SET_COMPILED_PROMPT'; prompt: string }
  | { type: 'SET_ERRORS'; errors: Record<string, string[]> }
  | { type: 'ADD_WARNING'; warning: string }
  | { type: 'CLEAR_WARNINGS' }
  | { type: 'TOGGLE_LEGACY_MODE'; legacyMode: boolean }
  | { type: 'RESET_STATE' };

// 유효성 검사 결과 타입
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: string[];
  suggestions: Array<{
    field: string;
    suggestion: string;
    type: 'improvement' | 'optimization' | 'fix';
  }>;
}

// 프리셋 관리 타입들
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  category: 'cinematic' | 'documentary' | 'commercial' | 'artistic' | 'experimental';
  data: Partial<CineGeniusV31>;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
}

export interface PresetManager {
  presets: PromptPreset[];
  selectedPreset?: PromptPreset;
  loadPreset: (id: string) => Promise<void>;
  savePreset: (name: string, description: string, category: PromptPreset['category']) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  sharePreset: (id: string) => Promise<string>; // 공유 URL 반환
}

// 실시간 미리보기 타입들
export interface PromptPreview {
  compiledPrompt: string;
  wordCount: number;
  estimatedDuration: number;
  veoCompatibility: 'excellent' | 'good' | 'fair' | 'poor';
  suggestions: string[];
}

export interface RealTimePreview {
  preview: PromptPreview;
  isUpdating: boolean;
  lastUpdated: Date;
  updatePreview: (data: Partial<CineGeniusV31>) => void;
}

// 내보내기 옵션 타입들
export type ExportFormat = 'cinegenius-v3.1' | 'legacy-v2' | 'veo-optimized' | 'plain-text' | 'json-schema';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeValidation: boolean;
  compressOutput: boolean;
  filename?: string;
}

// 협업 및 공유 타입들 (WebSocket 없이 폴링 기반)
export interface ShareableProject {
  id: string;
  data: CineGeniusV31;
  shareCode: string;
  expiresAt: Date;
  allowEdit: boolean;
  collaborators: string[];
}

export interface CollaborationState {
  project?: ShareableProject;
  isOwner: boolean;
  canEdit: boolean;
  lastSync: Date;
  syncProject: () => Promise<void>;
}

// 히스토리 및 버전 관리
export interface VersionHistory {
  id: string;
  version: number;
  data: CineGeniusV31;
  description: string;
  createdAt: Date;
  author: string;
}

export interface HistoryManager {
  history: VersionHistory[];
  currentVersion: number;
  canUndo: boolean;
  canRedo: boolean;
  saveVersion: (description: string) => void;
  restoreVersion: (version: number) => void;
  compareVersions: (v1: number, v2: number) => any;
}

// 통계 및 분석 타입들
export interface UsageAnalytics {
  promptsGenerated: number;
  averagePromptLength: number;
  mostUsedStyles: string[];
  mostUsedCameraAngles: string[];
  sessionDuration: number;
  errorRate: number;
}

// 메인 컨텍스트 타입
export interface PromptGeneratorContextV31 {
  state: PromptGenerationStateV31;
  dispatch: (action: PromptStateAction) => void;
  
  // 주요 액션들
  goToStep: (step: PromptGenerationStep) => void;
  updateData: (data: Partial<CineGeniusV31>) => void;
  generatePrompt: () => Promise<void>;
  validateData: () => Promise<ValidationResult>;
  exportProject: (options: ExportOptions) => Promise<void>;
  
  // 유틸리티
  presetManager: PresetManager;
  realtimePreview: RealTimePreview;
  collaboration: CollaborationState;
  historyManager: HistoryManager;
  analytics: UsageAnalytics;
}

// 기본 상수들
export const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: 'user_input',
    title: '사용자 입력',
    description: '기본 프롬프트 및 참조 이미지 입력',
    isCompleted: false,
    isActive: true,
    canSkip: false
  },
  {
    step: 'project_config',
    title: '프로젝트 설정',
    description: '영상 길이, 비율, 출력 형식 설정',
    isCompleted: false,
    isActive: false,
    canSkip: false
  },
  {
    step: 'prompt_blueprint',
    title: '프롬프트 블루프린트',
    description: '시각 요소, 촬영 기법, 환경 설정',
    isCompleted: false,
    isActive: false,
    canSkip: false
  },
  {
    step: 'generation_control',
    title: '생성 제어',
    description: '오디오 레이어 및 Veo 최적화 설정',
    isCompleted: false,
    isActive: false,
    canSkip: true
  },
  {
    step: 'final_output',
    title: '최종 출력',
    description: '프롬프트 생성 및 결과 확인',
    isCompleted: false,
    isActive: false,
    canSkip: false
  }
];

export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (와이드스크린)', description: '가장 일반적인 영상 비율' },
  { value: '9:16', label: '9:16 (세로형)', description: '모바일 및 숏폼 콘텐츠' },
  { value: '1:1', label: '1:1 (정사각형)', description: '소셜 미디어 포스트' },
  { value: '4:3', label: '4:3 (클래식)', description: '전통적인 TV 비율' },
  { value: '21:9', label: '21:9 (시네마)', description: '영화관 스크린 비율' }
] as const;

export const VIDEO_LENGTHS = [
  { value: 5, label: '5초', description: '짧은 클립' },
  { value: 10, label: '10초', description: '일반적인 길이' },
  { value: 15, label: '15초', description: '광고 길이' },
  { value: 20, label: '20초', description: '긴 클립' }
] as const;

export default PromptGenerationStateV31;