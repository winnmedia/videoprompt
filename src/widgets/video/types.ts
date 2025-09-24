/**
 * 영상 생성 위젯 타입 정의
 */

import type { PromptEngineering } from '../../entities/prompt';
import type { VideoGenerationSettings } from '../../entities/video';

export interface VideoGeneratorProps {
  prompts: PromptEngineering[];
  userId: string;
  onVideoGenerated: (jobId: string) => void;
  className?: string;
}

export interface VideoProgressProps {
  userId: string;
  jobIds?: string[];
  onRegenerateRequest: (jobId: string, newSettings?: Partial<VideoGenerationSettings>) => void;
  className?: string;
}