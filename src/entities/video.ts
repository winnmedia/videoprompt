/**
 * 영상 생성 엔티티 (Video Generation Entity)
 * UserJourneyMap 15-17단계 완전 구현
 *
 * 백엔드 도메인 중심 아키텍처 적용:
 * - 큐 기반 비동기 처리 시스템
 * - Circuit Breaker 패턴 적용
 * - 진행률 실시간 추적
 * - 피드백 및 재생성 시스템
 */

import { z } from 'zod';
import type { PromptEngineering, AIVideoModel } from './prompt';
import type { ShotStoryboard } from './Shot';

// ===== 영상 생성 상태 및 타입 정의 =====

export type VideoGenerationStatus =
  | 'queued'      // 대기열에 추가됨
  | 'processing'  // 생성 중
  | 'completed'   // 생성 완료
  | 'failed'      // 생성 실패
  | 'cancelled'   // 사용자 취소
  | 'timeout';    // 시간 초과

export type VideoQuality = '480p' | '720p' | '1080p' | '4K';
export type VideoFormat = 'mp4' | 'mov' | 'webm' | 'gif';
export type VideoAspectRatio = '16:9' | '4:3' | '1:1' | '9:16';

export type RegenerationReason =
  | 'quality_issue'      // 품질 문제
  | 'style_mismatch'     // 스타일 불일치
  | 'content_error'      // 내용 오류
  | 'technical_issue'    // 기술적 문제
  | 'user_preference';   // 사용자 선호도

// ===== 영상 생성 작업 도메인 모델 =====

export interface VideoGenerationJob {
  id: string;
  userId: string;

  // 소스 데이터
  promptEngineering: PromptEngineering;
  storyboard: ShotStoryboard;
  selectedModel: AIVideoModel;

  // 생성 설정
  generationSettings: VideoGenerationSettings;

  // 상태 관리
  status: VideoGenerationStatus;
  progress: VideoGenerationProgress;

  // 결과 데이터
  result?: VideoGenerationResult;
  error?: VideoGenerationError;

  // 큐 및 처리 정보
  queueInfo: QueueInfo;
  processingInfo: ProcessingInfo;

  // 재생성 관련
  regenerationHistory: RegenerationAttempt[];
  maxRegenerationAttempts: number;

  // 타임스탬프
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletionAt?: string;
}

export interface VideoGenerationSettings {
  quality: VideoQuality;
  format: VideoFormat;
  aspectRatio: VideoAspectRatio;
  fps: number;
  duration: number; // 초

  // AI 모델별 고급 설정
  modelSpecificSettings: Record<string, any>;

  // 최적화 설정
  enableUpscaling: boolean;
  enableStabilization: boolean;
  enableNoiseReduction: boolean;

  // 출력 옵션
  includeWatermark: boolean;
  outputDescription: string;
}

export interface VideoGenerationProgress {
  stage: VideoGenerationStage;
  percentage: number; // 0-100
  currentFrame?: number;
  totalFrames?: number;

  // 단계별 진행률
  stageProgress: StageProgress[];

  // 예상 시간
  estimatedTimeRemaining: number; // 초
  totalEstimatedTime: number; // 초

  // 실시간 상태
  currentOperation: string;
  operationStartedAt: string;
}

export type VideoGenerationStage =
  | 'initializing'    // 초기화
  | 'preprocessing'   // 전처리
  | 'generating'      // 생성 중
  | 'postprocessing'  // 후처리
  | 'uploading'       // 업로드
  | 'finalizing';     // 완료 처리

export interface StageProgress {
  stage: VideoGenerationStage;
  name: string;
  percentage: number;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration: number; // 초
}

export interface VideoGenerationResult {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number; // 초
  fileSize: number; // bytes

  // 메타데이터
  metadata: VideoMetadata;

  // 품질 분석
  qualityAnalysis: VideoQualityAnalysis;

  // 다운로드 정보
  downloadInfo: DownloadInfo[];
}

export interface VideoMetadata {
  format: VideoFormat;
  quality: VideoQuality;
  aspectRatio: VideoAspectRatio;
  fps: number;
  codec: string;
  bitrate: number; // kbps

  // AI 생성 정보
  aiModel: AIVideoModel;
  promptUsed: string;
  generationParams: Record<string, any>;

  // 처리 정보
  processingTime: number; // 초
  generatedAt: string;
  cost: number; // USD
}

export interface VideoQualityAnalysis {
  overallScore: number; // 0-100
  technicalQuality: TechnicalQuality;
  contentQuality: ContentQuality;
  aiQuality: AIQuality;
}

export interface TechnicalQuality {
  resolution: number; // 0-100
  frameRate: number; // 0-100
  stability: number; // 0-100
  colorAccuracy: number; // 0-100
  sharpness: number; // 0-100
}

export interface ContentQuality {
  promptAdherence: number; // 0-100
  visualCoherence: number; // 0-100
  motionQuality: number; // 0-100
  artisticValue: number; // 0-100
}

export interface AIQuality {
  modelPerformance: number; // 0-100
  artifactLevel: number; // 0-100 (낮을수록 좋음)
  consistencyScore: number; // 0-100
  creativityScore: number; // 0-100
}

export interface DownloadInfo {
  format: VideoFormat;
  quality: VideoQuality;
  fileSize: number;
  downloadUrl: string;
  expiresAt: string;
}

export interface VideoGenerationError {
  code: string;
  message: string;
  details: string;
  timestamp: string;

  // 복구 정보
  isRetryable: boolean;
  suggestedAction: string;
  errorCategory: 'api' | 'processing' | 'quota' | 'system';
}

export interface QueueInfo {
  position: number;
  estimatedWaitTime: number; // 초
  priority: number; // 1-10 (높을수록 우선순위)
  queuedAt: string;
  queueId: string;
}

export interface ProcessingInfo {
  nodeId?: string;
  workerId?: string;
  attemptCount: number;
  lastAttemptAt?: string;

  // 자원 사용량
  resourceUsage: ResourceUsage;

  // 성능 메트릭
  performanceMetrics: PerformanceMetrics;
}

export interface ResourceUsage {
  gpuUtilization: number; // 0-100
  memoryUsage: number; // MB
  cpuUsage: number; // 0-100
  networkBandwidth: number; // Mbps
}

export interface PerformanceMetrics {
  framesPerSecond: number;
  timePerFrame: number; // 초
  throughput: number; // 초당 처리된 초
  efficiency: number; // 0-100
}

export interface RegenerationAttempt {
  id: string;
  parentJobId: string;
  reason: RegenerationReason;
  feedback: string;

  // 변경된 설정
  modifiedSettings: Partial<VideoGenerationSettings>;
  modifiedPrompt?: string;

  // 결과
  status: VideoGenerationStatus;
  result?: VideoGenerationResult;

  // 타임스탬프
  createdAt: string;
  completedAt?: string;
}

// ===== 피드백 시스템 =====

export interface VideoFeedback {
  id: string;
  videoJobId: string;
  userId: string;

  // 피드백 타입
  feedbackType: 'like' | 'dislike' | 'neutral' | 'detailed';

  // 상세 피드백
  qualityRating: number; // 1-5
  contentRating: number; // 1-5
  overallRating: number; // 1-5

  // 텍스트 피드백
  comments: string;
  suggestions: string;

  // 카테고리별 평가
  categoryRatings: CategoryRating[];

  // 재생성 요청
  requestRegeneration: boolean;
  regenerationReason?: RegenerationReason;

  // 타임스탬프
  createdAt: string;
}

export interface CategoryRating {
  category: 'visual_quality' | 'motion_smoothness' | 'prompt_accuracy' | 'creativity' | 'technical_quality';
  rating: number; // 1-5
  comment?: string;
}

// ===== 배치 영상 생성 시스템 =====

export interface VideoBatchGeneration {
  id: string;
  userId: string;

  // 배치 설정
  promptEngineerings: PromptEngineering[];
  batchSettings: BatchVideoSettings;

  // 상태 관리
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  progress: BatchProgress;

  // 결과
  jobs: VideoGenerationJob[];
  summary: BatchSummary;

  // 타임스탬프
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BatchVideoSettings {
  defaultSettings: VideoGenerationSettings;
  perJobSettings: Record<string, Partial<VideoGenerationSettings>>;

  // 배치 전략
  processingStrategy: 'sequential' | 'parallel' | 'adaptive';
  maxConcurrentJobs: number;

  // 실패 처리
  retryFailedJobs: boolean;
  maxRetries: number;

  // 비용 제어
  maxTotalCost: number;
  costPerJob: number;
}

export interface BatchProgress {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;

  percentage: number; // 0-100
  estimatedTimeRemaining: number; // 초

  currentlyProcessing: string[]; // Job IDs
}

export interface BatchSummary {
  totalCost: number;
  averageQuality: number;
  processingTime: number; // 초

  successRate: number; // 0-100
  errorsByCategory: Record<string, number>;

  qualityDistribution: Record<VideoQuality, number>;
  modelPerformance: Record<AIVideoModel, number>;
}

// ===== Zod 스키마 검증 =====

export const videoGenerationSettingsSchema = z.object({
  quality: z.enum(['480p', '720p', '1080p', '4K']),
  format: z.enum(['mp4', 'mov', 'webm', 'gif']),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16']),
  fps: z.number().min(1).max(60),
  duration: z.number().min(0.1).max(120),
  enableUpscaling: z.boolean(),
  enableStabilization: z.boolean(),
  enableNoiseReduction: z.boolean(),
  includeWatermark: z.boolean(),
  outputDescription: z.string().max(500),
});

export const videoGenerationJobSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  selectedModel: z.enum(['runway-gen3', 'stable-video', 'pika-labs', 'zeroscope', 'animatediff', 'bytedance-seedream']),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled', 'timeout']),
  maxRegenerationAttempts: z.number().min(0).max(10),
  createdAt: z.string(),
});

export const videoFeedbackSchema = z.object({
  videoJobId: z.string().min(1),
  feedbackType: z.enum(['like', 'dislike', 'neutral', 'detailed']),
  qualityRating: z.number().min(1).max(5),
  contentRating: z.number().min(1).max(5),
  overallRating: z.number().min(1).max(5),
  comments: z.string().max(1000),
  suggestions: z.string().max(1000),
  requestRegeneration: z.boolean(),
});

// ===== 도메인 로직 함수들 =====

/**
 * 새로운 영상 생성 작업 생성
 */
export function createVideoGenerationJob(
  userId: string,
  promptEngineering: PromptEngineering,
  storyboard: ShotStoryboard,
  selectedModel: AIVideoModel,
  settings: Partial<VideoGenerationSettings> = {}
): VideoGenerationJob {
  if (!userId || !promptEngineering.id || !storyboard.id) {
    throw new Error('필수 파라미터가 누락되었습니다');
  }

  const timestamp = new Date().toISOString();
  const jobId = `video_${promptEngineering.shotId}_${selectedModel}_${Date.now()}`;

  // 기본 설정 적용
  const defaultSettings: VideoGenerationSettings = {
    quality: '1080p',
    format: 'mp4',
    aspectRatio: '16:9',
    fps: 24,
    duration: promptEngineering.sourceShot.duration,
    modelSpecificSettings: {},
    enableUpscaling: false,
    enableStabilization: true,
    enableNoiseReduction: true,
    includeWatermark: false,
    outputDescription: `AI generated video for shot ${promptEngineering.sourceShot.globalOrder}`,
  };

  const finalSettings = { ...defaultSettings, ...settings };

  // 예상 완료 시간 계산
  const estimatedProcessingTime = calculateEstimatedProcessingTime(selectedModel, finalSettings);
  const estimatedCompletionAt = new Date(Date.now() + estimatedProcessingTime * 1000).toISOString();

  return {
    id: jobId,
    userId,
    promptEngineering,
    storyboard,
    selectedModel,
    generationSettings: finalSettings,
    status: 'queued',
    progress: initializeProgress(),
    queueInfo: {
      position: 1, // Will be updated by queue manager
      estimatedWaitTime: 0,
      priority: 5, // Default priority
      queuedAt: timestamp,
      queueId: `queue_${Date.now()}`,
    },
    processingInfo: {
      attemptCount: 0,
      resourceUsage: {
        gpuUtilization: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        networkBandwidth: 0,
      },
      performanceMetrics: {
        framesPerSecond: 0,
        timePerFrame: 0,
        throughput: 0,
        efficiency: 0,
      },
    },
    regenerationHistory: [],
    maxRegenerationAttempts: 3,
    createdAt: timestamp,
    estimatedCompletionAt,
  };
}

/**
 * 진행률 초기화
 */
function initializeProgress(): VideoGenerationProgress {
  const timestamp = new Date().toISOString();

  return {
    stage: 'initializing',
    percentage: 0,
    stageProgress: [
      { stage: 'initializing', name: '초기화', percentage: 0, estimatedDuration: 30 },
      { stage: 'preprocessing', name: '전처리', percentage: 0, estimatedDuration: 60 },
      { stage: 'generating', name: '생성', percentage: 0, estimatedDuration: 300 },
      { stage: 'postprocessing', name: '후처리', percentage: 0, estimatedDuration: 90 },
      { stage: 'uploading', name: '업로드', percentage: 0, estimatedDuration: 45 },
      { stage: 'finalizing', name: '완료', percentage: 0, estimatedDuration: 15 },
    ],
    estimatedTimeRemaining: 540, // 9분
    totalEstimatedTime: 540,
    currentOperation: '작업 대기 중...',
    operationStartedAt: timestamp,
  };
}

/**
 * 예상 처리 시간 계산 (AI 모델별)
 */
function calculateEstimatedProcessingTime(
  model: AIVideoModel,
  settings: VideoGenerationSettings
): number {
  // 모델별 기본 처리 시간 (초당)
  const baseTimePerSecond: Record<AIVideoModel, number> = {
    'runway-gen3': 30,      // 30초 처리시간 per 1초 영상
    'stable-video': 45,     // 45초 처리시간 per 1초 영상
    'pika-labs': 25,        // 25초 처리시간 per 1초 영상
    'zeroscope': 20,        // 20초 처리시간 per 1초 영상
    'animatediff': 35,      // 35초 처리시간 per 1초 영상
    'bytedance-seedream': 40, // 40초 처리시간 per 1초 영상
  };

  let baseTime = baseTimePerSecond[model] * settings.duration;

  // 품질별 배수 적용
  const qualityMultiplier = {
    '480p': 0.7,
    '720p': 1.0,
    '1080p': 1.5,
    '4K': 2.5,
  };

  baseTime *= qualityMultiplier[settings.quality];

  // 추가 처리 옵션별 시간 증가
  if (settings.enableUpscaling) baseTime *= 1.3;
  if (settings.enableStabilization) baseTime *= 1.2;
  if (settings.enableNoiseReduction) baseTime *= 1.1;

  return Math.round(baseTime);
}

/**
 * 진행률 업데이트
 */
export function updateVideoGenerationProgress(
  job: VideoGenerationJob,
  stage: VideoGenerationStage,
  percentage: number,
  currentOperation: string = '',
  currentFrame?: number,
  totalFrames?: number
): VideoGenerationJob {
  const timestamp = new Date().toISOString();

  // 현재 단계의 인덱스 찾기
  const stageIndex = job.progress.stageProgress.findIndex(s => s.stage === stage);
  if (stageIndex === -1) {
    throw new Error(`Invalid stage: ${stage}`);
  }

  // 이전 단계들은 100% 완료로 설정
  const updatedStageProgress = job.progress.stageProgress.map((stageInfo, index) => {
    if (index < stageIndex) {
      return { ...stageInfo, percentage: 100, completedAt: timestamp };
    } else if (index === stageIndex) {
      return {
        ...stageInfo,
        percentage,
        startedAt: stageInfo.startedAt || timestamp,
        ...(percentage === 100 ? { completedAt: timestamp } : {}),
      };
    }
    return stageInfo;
  });

  // 전체 진행률 계산
  const totalPercentage = calculateTotalProgress(updatedStageProgress);

  // 남은 시간 계산
  const estimatedTimeRemaining = calculateRemainingTime(updatedStageProgress, totalPercentage);

  const updatedProgress: VideoGenerationProgress = {
    ...job.progress,
    stage,
    percentage: Math.min(percentage, 100),
    currentFrame,
    totalFrames,
    stageProgress: updatedStageProgress,
    estimatedTimeRemaining,
    currentOperation: currentOperation || `${stage} 단계 진행 중...`,
    operationStartedAt: timestamp,
  };

  return {
    ...job,
    progress: updatedProgress,
    ...(stage === 'generating' && !job.startedAt ? { startedAt: timestamp } : {}),
  };
}

/**
 * 전체 진행률 계산
 */
function calculateTotalProgress(stageProgress: StageProgress[]): number {
  const totalDuration = stageProgress.reduce((sum, stage) => sum + stage.estimatedDuration, 0);
  let completedDuration = 0;

  stageProgress.forEach(stage => {
    completedDuration += (stage.percentage / 100) * stage.estimatedDuration;
  });

  return Math.round((completedDuration / totalDuration) * 100);
}

/**
 * 남은 시간 계산
 */
function calculateRemainingTime(stageProgress: StageProgress[], totalPercentage: number): number {
  const totalDuration = stageProgress.reduce((sum, stage) => sum + stage.estimatedDuration, 0);
  const remainingPercentage = 100 - totalPercentage;
  return Math.round((remainingPercentage / 100) * totalDuration);
}

/**
 * 영상 생성 완료 처리
 */
export function completeVideoGeneration(
  job: VideoGenerationJob,
  result: VideoGenerationResult
): VideoGenerationJob {
  const timestamp = new Date().toISOString();

  return {
    ...job,
    status: 'completed',
    result,
    completedAt: timestamp,
    progress: {
      ...job.progress,
      stage: 'finalizing',
      percentage: 100,
      currentOperation: '생성 완료',
      estimatedTimeRemaining: 0,
    },
  };
}

/**
 * 영상 생성 실패 처리
 */
export function failVideoGeneration(
  job: VideoGenerationJob,
  error: VideoGenerationError
): VideoGenerationJob {
  const timestamp = new Date().toISOString();

  return {
    ...job,
    status: 'failed',
    error,
    completedAt: timestamp,
    progress: {
      ...job.progress,
      currentOperation: `실패: ${error.message}`,
      estimatedTimeRemaining: 0,
    },
    processingInfo: {
      ...job.processingInfo,
      attemptCount: job.processingInfo.attemptCount + 1,
      lastAttemptAt: timestamp,
    },
  };
}

/**
 * 재생성 요청 처리
 */
export function requestRegeneration(
  job: VideoGenerationJob,
  reason: RegenerationReason,
  feedback: string,
  modifiedSettings?: Partial<VideoGenerationSettings>,
  modifiedPrompt?: string
): RegenerationAttempt {
  if (job.regenerationHistory.length >= job.maxRegenerationAttempts) {
    throw new Error(`최대 재생성 횟수(${job.maxRegenerationAttempts}회)를 초과했습니다`);
  }

  const timestamp = new Date().toISOString();
  const regenerationId = `regen_${job.id}_${job.regenerationHistory.length + 1}`;

  return {
    id: regenerationId,
    parentJobId: job.id,
    reason,
    feedback,
    modifiedSettings: modifiedSettings || {},
    modifiedPrompt,
    status: 'queued',
    createdAt: timestamp,
  };
}

/**
 * 피드백 생성
 */
export function createVideoFeedback(
  videoJobId: string,
  userId: string,
  feedbackData: {
    feedbackType: VideoFeedback['feedbackType'];
    qualityRating: number;
    contentRating: number;
    overallRating: number;
    comments: string;
    suggestions: string;
    categoryRatings: CategoryRating[];
    requestRegeneration: boolean;
    regenerationReason?: RegenerationReason;
  }
): VideoFeedback {
  // 입력 검증
  const validatedData = videoFeedbackSchema.parse({
    videoJobId,
    ...feedbackData,
  });

  const timestamp = new Date().toISOString();
  const feedbackId = `feedback_${videoJobId}_${Date.now()}`;

  return {
    id: feedbackId,
    userId,
    ...validatedData,
    categoryRatings: feedbackData.categoryRatings,
    regenerationReason: feedbackData.regenerationReason,
    createdAt: timestamp,
  };
}

/**
 * 배치 영상 생성 초기화
 */
export function createVideoBatchGeneration(
  userId: string,
  promptEngineerings: PromptEngineering[],
  batchSettings: BatchVideoSettings
): VideoBatchGeneration {
  if (promptEngineerings.length === 0) {
    throw new Error('최소 하나의 프롬프트가 필요합니다');
  }

  const timestamp = new Date().toISOString();
  const batchId = `batch_video_${Date.now()}`;

  return {
    id: batchId,
    userId,
    promptEngineerings,
    batchSettings,
    status: 'pending',
    progress: {
      totalJobs: promptEngineerings.length,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      percentage: 0,
      estimatedTimeRemaining: promptEngineerings.length * 300, // 5분 per job 추정
      currentlyProcessing: [],
    },
    jobs: [],
    summary: {
      totalCost: 0,
      averageQuality: 0,
      processingTime: 0,
      successRate: 0,
      errorsByCategory: {},
      qualityDistribution: {
        '480p': 0,
        '720p': 0,
        '1080p': 0,
        '4K': 0,
      },
      modelPerformance: {
        'runway-gen3': 0,
        'stable-video': 0,
        'pika-labs': 0,
        'zeroscope': 0,
        'animatediff': 0,
        'bytedance-seedream': 0,
      } as Record<AIVideoModel, number>,
    },
    createdAt: timestamp,
  };
}

/**
 * 영상 품질 분석
 */
export function analyzeVideoQuality(
  videoUrl: string,
  metadata: VideoMetadata,
  promptEngineering: PromptEngineering
): VideoQualityAnalysis {
  // 실제 구현에서는 AI 기반 품질 분석을 수행
  // 여기서는 메타데이터와 프롬프트 정보를 기반으로 추정

  const technicalQuality: TechnicalQuality = {
    resolution: getResolutionScore(metadata.quality),
    frameRate: getFrameRateScore(metadata.fps),
    stability: 85, // AI 모델별 평균값
    colorAccuracy: 82,
    sharpness: 88,
  };

  const contentQuality: ContentQuality = {
    promptAdherence: calculatePromptAdherence(promptEngineering),
    visualCoherence: 87,
    motionQuality: 84,
    artisticValue: 79,
  };

  const aiQuality: AIQuality = {
    modelPerformance: getModelPerformanceScore(metadata.aiModel),
    artifactLevel: 15, // 낮을수록 좋음
    consistencyScore: 86,
    creativityScore: 81,
  };

  const overallScore = Math.round(
    (
      (technicalQuality.resolution + technicalQuality.frameRate + technicalQuality.stability + technicalQuality.colorAccuracy + technicalQuality.sharpness) / 5 * 0.3 +
      (contentQuality.promptAdherence + contentQuality.visualCoherence + contentQuality.motionQuality + contentQuality.artisticValue) / 4 * 0.4 +
      (aiQuality.modelPerformance + (100 - aiQuality.artifactLevel) + aiQuality.consistencyScore + aiQuality.creativityScore) / 4 * 0.3
    )
  );

  return {
    overallScore,
    technicalQuality,
    contentQuality,
    aiQuality,
  };
}

/**
 * 해상도 점수 계산
 */
function getResolutionScore(quality: VideoQuality): number {
  const scores = {
    '480p': 60,
    '720p': 75,
    '1080p': 90,
    '4K': 100,
  };
  return scores[quality];
}

/**
 * 프레임레이트 점수 계산
 */
function getFrameRateScore(fps: number): number {
  if (fps >= 60) return 100;
  if (fps >= 30) return 90;
  if (fps >= 24) return 80;
  if (fps >= 15) return 60;
  return 40;
}

/**
 * 프롬프트 준수도 계산
 */
function calculatePromptAdherence(promptEngineering: PromptEngineering): number {
  // 프롬프트 품질 점수를 기반으로 추정
  return Math.min(promptEngineering.qualityScore + 10, 100);
}

/**
 * AI 모델 성능 점수
 */
function getModelPerformanceScore(model: AIVideoModel): number {
  const scores: Record<AIVideoModel, number> = {
    'runway-gen3': 92,
    'stable-video': 88,
    'pika-labs': 85,
    'zeroscope': 78,
    'animatediff': 82,
    'bytedance-seedream': 86,
  };
  return scores[model];
}

/**
 * 비용 계산
 */
export function calculateVideoGenerationCost(
  model: AIVideoModel,
  settings: VideoGenerationSettings
): number {
  const baseCosts: Record<AIVideoModel, number> = {
    'runway-gen3': 0.05,
    'stable-video': 0.02,
    'pika-labs': 0.03,
    'zeroscope': 0.01,
    'animatediff': 0.015,
    'bytedance-seedream': 0.025,
  };

  let cost = baseCosts[model] * settings.duration;

  // 품질별 비용 배수
  const qualityMultiplier = {
    '480p': 0.8,
    '720p': 1.0,
    '1080p': 1.5,
    '4K': 2.5,
  };

  cost *= qualityMultiplier[settings.quality];

  // 추가 옵션별 비용
  if (settings.enableUpscaling) cost *= 1.3;
  if (settings.enableStabilization) cost *= 1.1;
  if (settings.enableNoiseReduction) cost *= 1.05;

  return Math.round(cost * 100) / 100; // 소수점 2자리
}