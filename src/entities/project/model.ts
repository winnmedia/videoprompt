export interface ScenarioData {
  story?: string;
  genre?: string;
  tone?: string | string[];
  target?: string;
  structure?: string[]; // 4단계 구조
  format?: string;
  tempo?: string;
  developmentMethod?: string;
  developmentIntensity?: string;
  durationSec?: number;
  // 추가 메타(기획안 PDF 링크 등)는 필요 시 확장
}

export interface PromptData {
  finalPrompt?: string;
  negativePrompt?: string;
  keywords?: string[];
  // 상세 설정 스냅샷(선택)
  visualStyle?: string;
  mood?: string;
  quality?: string;
  directorStyle?: string;
}

export interface VideoData {
  provider?: 'seedance' | 'veo3' | 'mock';
  jobId?: string; // seedance
  operationId?: string; // veo
  videoUrl?: string; // 최종 URL 또는 data-uri(mock)
  status?: 'queued' | 'processing' | 'pending' | 'succeeded' | 'failed';
}

export interface VersionMeta {
  id: string;
  label: string; // v1, v2, ...
  src: string;
  uploadedAt: string; // ISO
}

export interface ProjectPipelineState {
  id: string;
  scenario: ScenarioData;
  prompt: PromptData;
  video: VideoData;
  versions: VersionMeta[];
  createdAt: string;
  updatedAt: string;
}
