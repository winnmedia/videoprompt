/**
 * Shots Feature Types
 * 12단계 숏트 생성 및 관리 타입 정의
 */

import type {
  TwelveShotCollection,
  TwelveShot,
  ShotBreakdownParams,
  ShotStoryboard
} from '../../entities/Shot';
import type { FourActStory } from '../../entities/story';

// Re-export entity types
export type { ShotBreakdownParams, TwelveShotCollection, TwelveShot, ShotStoryboard };

// 숏트 생성 요청
export interface ShotGenerationRequest {
  story: FourActStory;
  params: ShotBreakdownParams;
  userId: string;
  regenerateShot?: string; // 특정 숏트만 재생성
}

// 숏트 생성 응답
export interface ShotGenerationResponse {
  success: boolean;
  collection?: TwelveShotCollection;
  error?: ShotGenerationError;
  tokensUsed?: number;
  generationTime?: number;
}

// 숏트 생성 에러
export interface ShotGenerationError {
  type: 'api_error' | 'validation_error' | 'token_limit' | 'timeout' | 'unknown_error';
  message: string;
  retryable: boolean;
  timestamp: string;
  details?: Record<string, any>;
}

// 숏트 생성 진행률
export interface ShotGenerationProgress {
  phase: 'analyzing' | 'generating' | 'refining' | 'creating_storyboards' | 'completed' | 'error';
  currentShot: number; // 1-12
  overallProgress: number; // 0-100
  estimatedTimeRemaining: number; // 초
  currentTask: string;
}

// 콘티 생성 요청
export interface StoryboardGenerationRequest {
  shotId: string;
  collectionId: string;
  regenerate?: boolean;
  customPrompt?: string;
  style?: ShotStoryboard['style'];
}

// 콘티 생성 응답
export interface StoryboardGenerationResponse {
  success: boolean;
  storyboard?: ShotStoryboard;
  error?: ShotGenerationError;
  tokensUsed?: number;
}

// Redux State
export interface ShotState {
  // 현재 12단계 숏트 컬렉션
  currentCollection: TwelveShotCollection | null;

  // 생성 상태
  isGenerating: boolean;
  generationProgress: ShotGenerationProgress;

  // 콘티 생성 상태
  storyboardGeneration: {
    [shotId: string]: {
      isGenerating: boolean;
      error?: ShotGenerationError;
    };
  };

  // 에러 관리
  error: ShotGenerationError | null;

  // 히스토리
  collections: TwelveShotCollection[]; // 최근 생성한 컬렉션들

  // UI 상태
  selectedShotId: string | null;
  dragEnabled: boolean;
  previewMode: 'grid' | 'timeline' | 'storyboard';
}

// 드래그앤드롭 관련
export interface DragDropState {
  isDragging: boolean;
  draggedShotId: string | null;
  dropTargetIndex: number | null;
  dragPreview: {
    shot: TwelveShot;
    originalIndex: number;
  } | null;
}

// 숏트 편집 요청
export interface ShotEditRequest {
  shotId: string;
  updates: Partial<Pick<TwelveShot,
    'title' | 'description' | 'shotType' | 'cameraMovement' |
    'duration' | 'emotion' | 'lightingMood' | 'colorPalette' |
    'transitionType' | 'charactersInShot' | 'dialogue' |
    'voiceOverNotes' | 'continuityNotes' | 'visualReferences'
  >>;
}

// PDF 다운로드 요청
export interface ShotPlanDownloadRequest {
  collectionId: string;
  format: 'pdf' | 'png' | 'jpg';
  layout: 'horizontal' | 'vertical' | 'grid';
  includeStoryboards: boolean;
  includeMetadata: boolean;
}

// PDF 다운로드 응답
export interface ShotPlanDownloadResponse {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: ShotGenerationError;
}

// 숏트 분석 결과
export interface ShotAnalysis {
  storyStructure: {
    actBalance: number; // 0-100 (Act 간 균형)
    pacing: number;     // 0-100 (페이싱 적절성)
    flow: number;       // 0-100 (스토리 흐름)
  };
  cinematography: {
    shotVariety: number;    // 0-100 (샷 다양성)
    cameraMovement: number; // 0-100 (카메라 움직임 적절성)
    visualInterest: number; // 0-100 (시각적 흥미)
  };
  technical: {
    duration: number;       // 총 예상 시간
    complexity: number;     // 0-100 (제작 복잡도)
    feasibility: number;    // 0-100 (실현 가능성)
  };
  suggestions: string[];
  warnings: string[];
}