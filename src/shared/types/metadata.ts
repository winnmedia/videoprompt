/**
 * 메타데이터 타입 정의
 * any 타입 제거를 위한 구체적인 메타데이터 스키마
 */

// 시나리오 메타데이터
export interface ScenarioMetadata {
  version?: string;
  author?: string;
  hasFourStep?: boolean;
  hasTwelveShot?: boolean;
  story?: string;
  genre?: string;
  tone?: string;
  target?: string;
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
  durationSec?: number;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 프롬프트 메타데이터
export interface PromptMetadata {
  scenarioTitle?: string;
  version?: string;
  keywordCount?: number;
  segmentCount?: number;
  quality?: 'standard' | 'premium';
  finalPrompt?: string;
  keywords?: string[];
  negativePrompt?: string;
  visualStyle?: string;
  mood?: string;
  directorStyle?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 비디오 메타데이터
export interface VideoMetadata {
  title?: string;
  prompt?: string;
  provider?: string;
  duration?: number;
  aspectRatio?: string;
  codec?: string;
  version?: string;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  refPromptTitle?: string;
  jobId?: string;
  operationId?: string;
  completedAt?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 통합 메타데이터 (Union Type)
export type ProjectMetadata = ScenarioMetadata | PromptMetadata | VideoMetadata;

// 메타데이터 타입 가드
export function isScenarioMetadata(metadata: ProjectMetadata): metadata is ScenarioMetadata {
  return 'story' in metadata || 'developmentMethod' in metadata;
}

export function isPromptMetadata(metadata: ProjectMetadata): metadata is PromptMetadata {
  return 'finalPrompt' in metadata || 'keywords' in metadata;
}

export function isVideoMetadata(metadata: ProjectMetadata): metadata is VideoMetadata {
  return 'videoUrl' in metadata || 'provider' in metadata;
}

// 메타데이터 검증 유틸리티
export function validateMetadata(metadata: unknown, type: 'scenario' | 'prompt' | 'video'): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const meta = metadata as Record<string, unknown>;

  switch (type) {
    case 'scenario':
      return typeof meta.story === 'string' || typeof meta.developmentMethod === 'string';
    case 'prompt':
      return typeof meta.finalPrompt === 'string' || Array.isArray(meta.keywords);
    case 'video':
      return typeof meta.videoUrl === 'string' || typeof meta.provider === 'string';
    default:
      return false;
  }
}