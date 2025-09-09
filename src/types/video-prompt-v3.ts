/**
 * CineGenius v3.1 Prompt Architecture
 * 
 * 전문적인 영상 제작을 위한 확장된 프롬프트 구조
 * PROMPT_ARCHITECTURE.md 스펙 기반으로 구현
 * 
 * @version 3.1
 * @compatibility 기존 VideoPrompt와 호환
 */

import type { VideoPrompt } from './video-prompt';

// =============================================================================
// 🎬 CineGenius v3.1 Core Types
// =============================================================================

/**
 * CineGenius v3.1 프롬프트 메인 인터페이스
 */
export interface CineGeniusV3Prompt {
  /** 스키마 버전 */
  version: '3.1';
  
  /** 프로젝트 고유 식별자 (UUID v4) */
  projectId: string;
  
  /** 생성 일시 */
  createdAt: string;
  
  /** 사용자 입력 */
  userInput: UserInput;
  
  /** 프로젝트 설정 */
  projectConfig: ProjectConfig;
  
  /** 프롬프트 블루프린트 */
  promptBlueprint: PromptBlueprint;
  
  /** 생성 제어 */
  generationControl: GenerationControl;
  
  /** AI 분석 결과 (읽기 전용) */
  aiAnalysis?: Record<string, any>;
  
  /** 최종 출력 */
  finalOutput: FinalOutput;
  
  /** UI 힌트 (쓰기 전용) */
  uiHints?: Record<string, Array<string | number>>;
}

// =============================================================================
// 📝 User Input
// =============================================================================

export interface UserInput {
  /** 한 줄 시나리오 */
  oneLineScenario: string;
  
  /** 타겟 오디언스 */
  targetAudience?: string;
  
  /** 참조 URL 목록 */
  referenceUrls?: string[];
  
  /** 참조 오디오 URL */
  referenceAudioUrl?: string;
}

// =============================================================================
// 🛠️ Project Config
// =============================================================================

export interface ProjectConfig {
  /** 생성 모드 */
  creationMode: 'VISUAL_FIRST' | 'SOUND_FIRST' | 'STORY_FIRST';
  
  /** 프레임워크 타입 */
  frameworkType: 'EVENT_DRIVEN' | 'DIRECTION_DRIVEN' | 'HYBRID';
  
  /** AI 어시스턴트 페르소나 */
  aiAssistantPersona: 'ASSISTANT_DIRECTOR' | 'CINEMATOGRAPHER' | 'SCREENWRITER';
}

// =============================================================================
// 🎨 Style System (기존 확장)
// =============================================================================

/**
 * 스타일 융합 시스템
 */
export interface StyleFusion {
  /** 주 스타일 */
  styleA: string;
  
  /** 보조 스타일 */
  styleB: string;
  
  /** 블렌딩 비율 (0~1) */
  ratio: number;
}

/**
 * 확장된 베이스 스타일
 */
export interface ExtendedBaseStyle {
  /** 비주얼 스타일 */
  visualStyle: string;
  
  /** 장르 */
  genre: string;
  
  /** 분위기 */
  mood: string;
  
  /** 품질 */
  quality: string;
  
  /** 스타일 융합 */
  styleFusion: StyleFusion;
}

// =============================================================================
// 📍 Spatial Context (기존 확장)
// =============================================================================

export interface ExtendedSpatialContext {
  /** 장소 설명 */
  placeDescription: string;
  
  /** 날씨 */
  weather: string;
  
  /** 조명 */
  lighting: string;
}

// =============================================================================
// 📷 Camera System (대폭 확장)
// =============================================================================

/**
 * 물리적 카메라 파라미터
 */
export interface PhysicalCameraSettings {
  /** 조리개 (f/1.4, f/2.8 등) */
  aperture?: string;
  
  /** 셔터 스피드 (1/50, 1/1000 등) */
  shutter?: string;
  
  /** ISO 감도 */
  iso?: number;
  
  /** ND 필터 (ND8, ND0.9 등) */
  ndFilter?: string;
}

/**
 * 확장된 카메라 설정
 */
export interface ExtendedCameraSetting {
  /** 주 렌즈 */
  primaryLens: string;
  
  /** 주요 움직임 */
  dominantMovement: string;
  
  /** 색보정 */
  colorGrade?: string;
  
  /** 물리적 파라미터 */
  physical?: PhysicalCameraSettings;
}

// =============================================================================
// 📐 Delivery Spec (정규식 패턴 적용)
// =============================================================================

export interface DeliverySpec {
  /** 지속 시간 (밀리초) */
  durationMs: number;
  
  /** 화면비 (16:9, 9:16 등) */
  aspectRatio: string;
  
  /** 프레임 레이트 */
  fps?: number;
  
  /** 해상도 (HD, FHD, 4K 등) */
  resolution?: string;
  
  /** 샷 타입 */
  shotType?: string;
  
  /** 비트레이트 힌트 */
  bitrateHint?: string;
}

// =============================================================================
// 🎭 Continuity Control (신규)
// =============================================================================

export interface ContinuityControl {
  /** 단일 테이크 여부 */
  singleTake?: boolean;
  
  /** 컷 없음 여부 */
  noCuts?: boolean;
  
  /** 모션 벡터 연속성 */
  motionVectorContinuity?: string;
  
  /** 텍스처 연속성 노트 */
  textureContinuityNote?: string;
  
  /** 전환 정책 */
  transitionPolicy?: 'None' | 'Only-internal time ramp' | 'No editorial transitions';
}

// =============================================================================
// 🎨 Look Development (신규)
// =============================================================================

export interface LookDevelopment {
  /** 그레이딩 */
  grade?: string;
  
  /** 그레인 */
  grain?: string;
  
  /** 텍스처 처리 */
  textureTreatment?: string;
  
  /** LUT 이름 */
  lutName?: string;
  
  /** 색온도 */
  colorTemperature?: number;
  
  /** 대비 곡선 */
  contrastCurve?: string;
}

// =============================================================================
// 📹 Camera Plan (신규)
// =============================================================================

export interface CameraPlan {
  /** 렌즈 로스터 */
  lensRoster?: string[];
  
  /** 움직임 요약 */
  movementSummary?: string;
  
  /** 선호 리그 */
  preferredRig?: string;
}

// =============================================================================
// 📊 Extended Metadata
// =============================================================================

export interface ExtendedMetadata {
  /** 프롬프트 이름 */
  promptName: string;
  
  /** 확장된 베이스 스타일 */
  baseStyle: ExtendedBaseStyle;
  
  /** 확장된 공간 컨텍스트 */
  spatialContext: ExtendedSpatialContext;
  
  /** 확장된 카메라 설정 */
  cameraSetting: ExtendedCameraSetting;
  
  /** 배달 사양 */
  deliverySpec: DeliverySpec;
  
  /** 연속성 제어 */
  continuity?: ContinuityControl;
  
  /** 룩 개발 */
  lookDev?: LookDevelopment;
  
  /** 카메라 계획 */
  cameraPlan?: CameraPlan;
}

// =============================================================================
// 🎵 Audio Design (신규)
// =============================================================================

export interface AudioDesign {
  /** 음악 의도 */
  musicIntent?: string;
  
  /** 효과음 팔레트 */
  sfxPalette?: string[];
  
  /** 믹싱 노트 */
  mixNotes?: string;
  
  /** 덕킹 규칙 */
  duckingRules?: string[];
}

// =============================================================================
// 🎬 Timeline System (SMPTE 지원)
// =============================================================================

/**
 * SMPTE 타임코드
 */
export interface SMPTETimecode {
  /** 시작 시간 (ms) */
  startMs: number;
  
  /** 종료 시간 (ms) */
  endMs: number;
  
  /** SMPTE 시작 (HH:MM:SS:FF) */
  smpteStart?: string;
  
  /** SMPTE 종료 (HH:MM:SS:FF) */
  smpteEnd?: string;
}

/**
 * 카메라 워크 (확장)
 */
export interface ExtendedCameraWork {
  /** 앵글 */
  angle: string;
  
  /** 움직임 */
  move: string;
  
  /** 포커스 */
  focus?: string;
}

/**
 * 페이싱 FX (확장)
 */
export interface ExtendedPacingFX {
  /** 페이싱 */
  pacing: string;
  
  /** 편집 스타일 */
  editingStyle: string;
  
  /** 비주얼 이펙트 */
  visualEffect: string;
}

/**
 * 다층 오디오 레이어
 */
export interface AudioLayers {
  /** 실제 소리 (화면 내) */
  diegetic?: string;
  
  /** 비실제 소리 (화면 외) */
  non_diegetic?: string;
  
  /** 음성 */
  voice?: string;
  
  /** 컨셉트 */
  concept?: string;
}

/**
 * 확장된 타임라인 세그먼트
 */
export interface ExtendedTimelineSegment {
  /** 시퀀스 번호 */
  sequence: number;
  
  /** 타임스탬프 (HH:MM:SS.mmm) */
  timestamp?: string;
  
  /** SMPTE 타임코드 */
  timecode?: SMPTETimecode;
  
  /** 비주얼 연출 */
  visualDirecting: string;
  
  /** 카메라 워크 */
  cameraWork: ExtendedCameraWork;
  
  /** 페이싱 FX */
  pacingFX: ExtendedPacingFX;
  
  /** 오디오 레이어 */
  audioLayers: AudioLayers;
  
  /** 액션 노트 */
  actionNote?: string;
  
  /** 오디오 노트 */
  audioNote?: string;
  
  /** 비주얼 노트 */
  visualNote?: string;
}

// =============================================================================
// 🧩 Elements (기존과 호환)
// =============================================================================

export interface ExtendedCharacter {
  /** ID */
  id: string;
  
  /** 설명 */
  description: string;
  
  /** 참조 이미지 URL */
  reference_image_url?: string;
}

export interface ExtendedCoreObject {
  /** ID */
  id: string;
  
  /** 설명 */
  description: string;
  
  /** 재질 */
  material?: string;
  
  /** 참조 이미지 URL */
  reference_image_url?: string;
}

export interface AssemblyDirectives {
  /** 소스 컨테이너 */
  sourceContainer?: string;
  
  /** 조립된 요소들 */
  assembledElements?: string[];
  
  /** 애니메이션 모델 */
  animationModel?: string;
  
  /** 물리성 노트 */
  physicalityNote?: string;
}

export interface ExtendedElements {
  /** 캐릭터 목록 */
  characters: ExtendedCharacter[];
  
  /** 핵심 오브젝트 목록 */
  coreObjects: ExtendedCoreObject[];
  
  /** 조립 지시사항 */
  assemblyDirectives?: AssemblyDirectives;
}

// =============================================================================
// 🎛️ Generation Control (신규)
// =============================================================================

export interface DirectorEmphasis {
  /** 용어 */
  term: string;
  
  /** 가중치 (-3 ~ 3) */
  weight: number;
}

export interface ShotByShot {
  /** 활성화 여부 */
  enabled: boolean;
  
  /** 잠긴 세그먼트들 */
  lockedSegments?: number[];
  
  /** 마지막 프레임 데이터 */
  lastFrameData?: {
    imageUrl: string;
    description: string;
  };
}

export interface ComplianceControl {
  /** 브랜드명 */
  brandName?: string;
  
  /** 로고 가시성 */
  logoVisibility?: string;
  
  /** 법적 제한사항 */
  legalRestrictions?: string[];
  
  /** 네거티브 오버레이 */
  negativeOverlays?: string[];
}

export interface GenerationControl {
  /** 감독 강조점 */
  directorEmphasis: DirectorEmphasis[];
  
  /** 샷별 제어 */
  shotByShot: ShotByShot;
  
  /** 컴플라이언스 */
  compliance?: ComplianceControl;
  
  /** 시드값 */
  seed: number;
}

// =============================================================================
// 📤 Final Output (기존과 호환)
// =============================================================================

export interface FinalOutput {
  /** 최종 프롬프트 텍스트 */
  finalPromptText: string;
  
  /** 키워드 목록 */
  keywords: string[];
  
  /** 네거티브 프롬프트 */
  negativePrompts: string[];
}

// =============================================================================
// 🎯 Prompt Blueprint (통합)
// =============================================================================

export interface PromptBlueprint {
  /** 확장된 메타데이터 */
  metadata: ExtendedMetadata;
  
  /** 확장된 요소들 */
  elements: ExtendedElements;
  
  /** 오디오 디자인 */
  audioDesign?: AudioDesign;
  
  /** 확장된 타임라인 */
  timeline: ExtendedTimelineSegment[];
}

// =============================================================================
// 🔄 Compatibility Layer
// =============================================================================

/**
 * 기존 VideoPrompt에서 CineGeniusV3Prompt로 변환
 */
export function convertToV3(legacy: VideoPrompt): CineGeniusV3Prompt {
  return {
    version: '3.1',
    projectId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userInput: {
      oneLineScenario: legacy.metadata.room_description || '',
      targetAudience: '',
    },
    projectConfig: {
      creationMode: 'VISUAL_FIRST',
      frameworkType: 'HYBRID',
      aiAssistantPersona: 'ASSISTANT_DIRECTOR',
    },
    promptBlueprint: {
      metadata: {
        promptName: legacy.metadata.prompt_name || 'Untitled',
        baseStyle: {
          visualStyle: Array.isArray(legacy.metadata.base_style) ? legacy.metadata.base_style.join(', ') : '',
          genre: 'Drama',
          mood: 'Neutral',
          quality: '4K',
          styleFusion: {
            styleA: Array.isArray(legacy.metadata.base_style) ? legacy.metadata.base_style[0] || '' : '',
            styleB: Array.isArray(legacy.metadata.base_style) ? legacy.metadata.base_style[1] || '' : '',
            ratio: 1.0,
          },
        },
        spatialContext: {
          placeDescription: legacy.metadata.room_description || '',
          weather: legacy.metadata.weather || '',
          lighting: legacy.metadata.lighting || '',
        },
        cameraSetting: {
          primaryLens: legacy.metadata.primary_lens || '35mm (Natural)',
          dominantMovement: legacy.metadata.dominant_movement || 'Static Shot',
          colorGrade: '',
        },
        deliverySpec: {
          durationMs: 8000, // 기본 8초
          aspectRatio: legacy.metadata.aspect_ratio || '16:9',
        },
      },
      elements: {
        characters: legacy.key_elements?.map((element, index) => ({
          id: `char_${index}`,
          description: element,
        })) || [],
        coreObjects: legacy.assembled_elements?.map((element, index) => ({
          id: `obj_${index}`,
          description: element,
        })) || [],
      },
      timeline: legacy.timeline?.map((segment, index) => ({
        sequence: index,
        visualDirecting: segment.action || '',
        cameraWork: {
          angle: segment.camera_angle || 'Medium Shot',
          move: segment.camera_movement || 'Static Shot',
        },
        pacingFX: {
          pacing: segment.pacing || 'Real-time',
          editingStyle: 'Standard Cut',
          visualEffect: 'None',
        },
        audioLayers: {
          diegetic: segment.audio || '',
          non_diegetic: '',
          voice: '',
          concept: segment.audio_quality || '',
        },
      })) || [],
    },
    generationControl: {
      directorEmphasis: [],
      shotByShot: {
        enabled: false,
      },
      seed: Math.floor(Math.random() * 2147483647),
    },
    finalOutput: {
      finalPromptText: legacy.text || '',
      keywords: legacy.keywords || [],
      negativePrompts: legacy.negative_prompts || [],
    },
  };
}

/**
 * CineGeniusV3Prompt에서 기존 VideoPrompt로 변환 (하위 호환성)
 */
export function convertToLegacy(v3: CineGeniusV3Prompt): VideoPrompt {
  return {
    metadata: {
      prompt_name: v3.promptBlueprint.metadata.promptName,
      base_style: [v3.promptBlueprint.metadata.baseStyle.visualStyle],
      aspect_ratio: v3.promptBlueprint.metadata.deliverySpec.aspectRatio,
      room_description: v3.promptBlueprint.metadata.spatialContext.placeDescription,
      camera_setup: v3.promptBlueprint.metadata.cameraSetting.primaryLens,
      weather: v3.promptBlueprint.metadata.spatialContext.weather,
      lighting: v3.promptBlueprint.metadata.spatialContext.lighting,
      primary_lens: v3.promptBlueprint.metadata.cameraSetting.primaryLens,
      dominant_movement: v3.promptBlueprint.metadata.cameraSetting.dominantMovement,
    },
    key_elements: v3.promptBlueprint.elements.characters.map(char => char.description),
    assembled_elements: v3.promptBlueprint.elements.coreObjects.map(obj => obj.description),
    negative_prompts: v3.finalOutput.negativePrompts,
    timeline: v3.promptBlueprint.timeline.map((segment, index) => ({
      id: `timeline-${index}`,
      sequence: segment.sequence,
      timestamp: segment.timestamp || '',
      action: segment.visualDirecting,
      audio: segment.audioLayers.diegetic || '',
      camera_angle: segment.cameraWork.angle as any,
      camera_movement: segment.cameraWork.move as any,
      pacing: segment.pacingFX.pacing as any,
      audio_quality: segment.audioLayers.concept as any,
    })),
    text: v3.finalOutput.finalPromptText,
    keywords: v3.finalOutput.keywords,
  };
}

// =============================================================================
// 📊 Type Guards
// =============================================================================

/**
 * CineGenius v3.1 타입 가드
 */
export function isCineGeniusV3(prompt: any): prompt is CineGeniusV3Prompt {
  return prompt && prompt.version === '3.1';
}

/**
 * Legacy 프롬프트 타입 가드
 */
export function isLegacyPrompt(prompt: any): prompt is VideoPrompt {
  return prompt && !prompt.version;
}