/**
 * 생성된 콘텐츠를 관리 페이지에 자동 등록하는 유틸리티
 * 프로젝트 스토어 데이터를 사용하여 planning API에 등록
 */

import type { ProjectPipelineState, ScenarioData, PromptData, VideoData } from '@/shared/types/project';
import { logger } from '@/shared/lib/logger';
import { safeFetch } from '@/shared/lib/api-retry';

// ===============================================
// 타입 정의
// ===============================================

export interface ContentRegistrationResult {
  success: boolean;
  scenarioId?: string;
  promptId?: string;
  videoId?: string;
  message?: string;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: 'preparing' | 'uploading' | 'processing' | 'completed' | 'failed';
}

export interface UploadChunk {
  index: number;
  start: number;
  end: number;
  data: ArrayBuffer;
}

export interface UploadSession {
  uploadId: string;
  originalFileName: string;
  sanitizedFileName: string;
  fileSize: number;
  fileType: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  createdAt: string;
  expiresAt: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// ===============================================
// 상수 정의
// ===============================================

export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILE_SIZE = 600 * 1024 * 1024; // 600MB

export const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/avi',
  'video/x-msvideo',
  'video/3gpp',
  'video/x-ms-wmv',
];

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

/**
 * 시나리오를 planning API에 등록
 */
export async function registerScenarioContent(
  scenarioData: ScenarioData, 
  projectId: string
): Promise<ContentRegistrationResult> {
  try {
    if (!scenarioData.title || !scenarioData.story) {
      return {
        success: false,
        error: '시나리오 제목과 내용이 필요합니다.'
      };
    }

    const payload = {
      type: 'scenario',
      title: scenarioData.title,
      story: scenarioData.story,
      genre: scenarioData.genre || '',
      tone: Array.isArray(scenarioData.tone) ? scenarioData.tone.join(', ') : (scenarioData.tone || ''),
      target: scenarioData.target || '',
      format: scenarioData.format || '16:9',
      tempo: scenarioData.tempo || '보통',
      developmentMethod: scenarioData.developmentMethod || '',
      developmentIntensity: scenarioData.developmentIntensity || '',
      durationSec: scenarioData.durationSec || 10,
      projectId,
      source: 'scenario-page',
      createdAt: new Date().toISOString()
    };

    const response = await safeFetch('/api/planning/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        scenarioId: data.id,
        message: '시나리오가 관리 페이지에 등록되었습니다.'
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || '시나리오 등록에 실패했습니다.'
      };
    }
  } catch (error) {
    logger.error('시나리오 등록 오류:', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 프롬프트를 전용 API 엔드포인트에 등록 (개선된 에러 처리)
 */
export async function registerPromptContent(
  promptData: PromptData,
  scenarioTitle: string,
  projectId: string
): Promise<ContentRegistrationResult> {
  try {
    if (!promptData.finalPrompt) {
      return {
        success: false,
        error: '최종 프롬프트가 필요합니다.'
      };
    }

    const payload = {
      scenarioTitle: scenarioTitle || '프롬프트',
      finalPrompt: promptData.finalPrompt,
      keywords: promptData.keywords || [],
      negativePrompt: promptData.negativePrompt || '',
      visualStyle: promptData.visualStyle || '',
      mood: promptData.mood || '',
      directorStyle: promptData.directorStyle || '',
      projectId,
      metadata: {
        quality: promptData.quality || '',
        source: 'prompt-generator',
        createdAt: new Date().toISOString()
      }
    };

    const response = await safeFetch('/api/planning/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        promptId: data.data?.promptId || data.promptId,
        message: data.message || '프롬프트가 관리 페이지에 등록되었습니다.'
      };
    } else {
      // 개선된 에러 처리: HTTP 상태별 메시지 분류
      const errorData = await response.json().catch(() => ({}));
      let userFriendlyError = '프롬프트 등록에 실패했습니다.';

      switch (response.status) {
        case 400:
          userFriendlyError = '입력 데이터에 오류가 있습니다. 프롬프트 내용을 확인해주세요.';
          break;
        case 401:
          userFriendlyError = '로그인이 필요합니다. 다시 로그인해주세요.';
          break;
        case 403:
          userFriendlyError = '프롬프트 저장 권한이 없습니다. 관리자에게 문의하세요.';
          break;
        case 429:
          userFriendlyError = '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.';
          break;
        case 500:
          userFriendlyError = '서버 오류입니다. 잠시 후 다시 시도해주세요.';
          break;
        case 503:
          userFriendlyError = '서비스가 일시적으로 이용할 수 없습니다. 잠시 후 다시 시도해주세요.';
          break;
        default:
          userFriendlyError = errorData.message || `서버 오류 (${response.status})`;
      }

      return {
        success: false,
        error: userFriendlyError
      };
    }
  } catch (error) {
    logger.error('프롬프트 등록 오류:', error instanceof Error ? error : new Error(String(error)));

    // 네트워크 vs 시스템 오류 구분
    let userFriendlyError = '알 수 없는 오류가 발생했습니다.';

    if (error instanceof TypeError && error.message.includes('fetch')) {
      userFriendlyError = '네트워크 연결을 확인해주세요. 인터넷 연결이 불안정합니다.';
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        userFriendlyError = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (error.message.includes('abort')) {
        userFriendlyError = '요청이 취소되었습니다.';
      } else {
        userFriendlyError = error.message;
      }
    }

    return {
      success: false,
      error: userFriendlyError
    };
  }
}

/**
 * 영상을 planning API에 등록
 */
export async function registerVideoContent(
  videoData: VideoData, 
  title: string,
  promptTitle: string,
  projectId: string
): Promise<ContentRegistrationResult> {
  try {
    if (!videoData.videoUrl && videoData.status !== 'processing') {
      return {
        success: false,
        error: '영상 URL이 필요합니다.'
      };
    }

    const payload = {
      type: 'video',
      title: title || '생성된 영상',
      provider: videoData.provider || 'unknown',
      jobId: videoData.jobId,
      operationId: videoData.operationId,
      videoUrl: videoData.videoUrl,
      status: videoData.status || 'queued',
      refPromptTitle: promptTitle,
      projectId,
      source: 'workflow',
      createdAt: new Date().toISOString()
    };

    const response = await safeFetch('/api/planning/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        videoId: data.id,
        message: '영상이 관리 페이지에 등록되었습니다.'
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || '영상 등록에 실패했습니다.'
      };
    }
  } catch (error) {
    logger.error('영상 등록 오류:', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    };
  }
}

/**
 * 전체 프로젝트 데이터를 관리 페이지에 등록
 */
export async function registerFullProject(
  projectData: ProjectPipelineState
): Promise<ContentRegistrationResult> {
  const results: ContentRegistrationResult[] = [];
  let overallSuccess = true;
  const messages: string[] = [];

  try {
    // 1. 시나리오 등록
    if (projectData.scenario?.title && projectData.scenario?.story) {
      const scenarioResult = await registerScenarioContent(projectData.scenario, projectData.id);
      results.push(scenarioResult);
      if (scenarioResult.success && scenarioResult.message) {
        messages.push(scenarioResult.message);
      } else if (!scenarioResult.success) {
        overallSuccess = false;
        messages.push(`시나리오 등록 실패: ${scenarioResult.error}`);
      }
    }

    // 2. 프롬프트 등록
    if (projectData.prompt?.finalPrompt) {
      const promptResult = await registerPromptContent(
        projectData.prompt, 
        projectData.scenario?.title || '프롬프트',
        projectData.id
      );
      results.push(promptResult);
      if (promptResult.success && promptResult.message) {
        messages.push(promptResult.message);
      } else if (!promptResult.success) {
        overallSuccess = false;
        messages.push(`프롬프트 등록 실패: ${promptResult.error}`);
      }
    }

    // 3. 영상 등록
    if (projectData.video?.videoUrl || projectData.video?.status === 'processing') {
      const videoResult = await registerVideoContent(
        projectData.video,
        projectData.scenario?.title || '생성된 영상',
        projectData.scenario?.title || '프롬프트',
        projectData.id
      );
      results.push(videoResult);
      if (videoResult.success && videoResult.message) {
        messages.push(videoResult.message);
      } else if (!videoResult.success) {
        overallSuccess = false;
        messages.push(`영상 등록 실패: ${videoResult.error}`);
      }
    }

    return {
      success: overallSuccess,
      message: messages.length > 0 ? messages.join('\n') : '등록할 데이터가 없습니다.',
      scenarioId: results.find(r => r.scenarioId)?.scenarioId,
      promptId: results.find(r => r.promptId)?.promptId,
      videoId: results.find(r => r.videoId)?.videoId,
    };

  } catch (error) {
    logger.error('전체 프로젝트 등록 오류:', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      error: error instanceof Error ? error.message : '전체 프로젝트 등록 중 오류가 발생했습니다.'
    };
  }
}

// ===============================================
// 유틸리티 함수들
// ===============================================

/**
 * 파일 크기를 읽기 쉬운 형태로 포맷
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 파일명을 안전한 형태로 변환
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * 비디오 파일 타입 검증
 */
export function isValidVideoFile(file: File): boolean {
  return SUPPORTED_VIDEO_TYPES.includes(file.type);
}

/**
 * 파일 크기 검증
 */
export function isFileSizeValid(size: number): boolean {
  return size <= MAX_FILE_SIZE && size > 0;
}

/**
 * 파일을 청크로 분할
 */
export function createFileChunks(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE): UploadChunk[] {
  const chunks: UploadChunk[] = [];
  const totalSize = file.size;
  let start = 0;
  let index = 0;
  
  while (start < totalSize) {
    const end = Math.min(start + chunkSize, totalSize);
    const chunk: UploadChunk = {
      index,
      start,
      end,
      data: file.slice(start, end).arrayBuffer() as any, // 실제로는 Promise<ArrayBuffer>
    };
    chunks.push(chunk);
    start = end;
    index++;
  }
  
  return chunks;
}

/**
 * 업로드 진행률 계산
 */
export function calculateProgress(loaded: number, total: number): UploadProgress {
  const percentage = Math.round((loaded / total) * 100);
  let stage: UploadProgress['stage'] = 'uploading';
  
  if (percentage === 0) stage = 'preparing';
  else if (percentage === 100) stage = 'processing';
  
  return { loaded, total, percentage, stage };
}

/**
 * 재시도 지연시간 계산
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * 재시도 가능한 오류인지 확인
 */
export function isRetriableError(error: Error): boolean {
  const retriablePatterns = [
    /network/i,
    /timeout/i,
    /temporary/i,
    /5\d\d/,
    /429/,
  ];
  
  return retriablePatterns.some(pattern => 
    pattern.test(error.message) || pattern.test(error.name)
  );
}

/**
 * 업로드 세션 생성
 */
export function createUploadSession(file: File): UploadSession {
  return {
    uploadId: crypto.randomUUID(),
    originalFileName: file.name,
    sanitizedFileName: sanitizeFileName(file.name),
    fileSize: file.size,
    fileType: file.type,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간 후 만료
  };
}

/**
 * 업로드 헤더 생성
 */
export function createUploadHeaders(session: UploadSession): HeadersInit {
  return {
    'Content-Type': session.fileType,
    'X-Upload-Id': session.uploadId,
    'X-File-Name': session.originalFileName,
    'X-File-Size': session.fileSize.toString(),
  };
}

/**
 * 메모리 사용량 확인
 */
export function getMemoryUsage(): { used: number; total: number } {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize || 0,
      total: memory.totalJSHeapSize || 0,
    };
  }
  return { used: 0, total: 0 };
}

/**
 * 취소 토큰 생성
 */
export function createCancellationToken(): { token: AbortController; cancel: () => void } {
  const controller = new AbortController();
  return {
    token: controller,
    cancel: () => controller.abort(),
  };
}

/**
 * 파일 체크섬 계산
 */
export async function calculateFileChecksum(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 업로드 세션 만료 확인
 */
export function isUploadSessionExpired(session: UploadSession): boolean {
  return new Date(session.expiresAt) < new Date();
}

/**
 * 업로드 세션 활성 상태 확인
 */
export function isUploadSessionActive(session: UploadSession): boolean {
  return session.status === 'uploading' || session.status === 'pending';
}