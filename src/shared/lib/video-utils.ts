/**
 * 영상 처리 유틸리티
 *
 * 영상 파일 업로드, 메타데이터 추출, 썸네일 생성, 스크린샷 생성 등
 * 피드백 시스템에서 사용되는 영상 관련 처리 기능들을 제공
 */

// ===========================================
// 타입 정의
// ===========================================

export interface VideoMetadata {
  duration: number; // 초 단위
  width: number;
  height: number;
  resolution: string; // "1920x1080"
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  fileSize: number;
}

export interface ScreenshotOptions {
  timestamp: number; // 초 단위
  width?: number;
  height?: number;
  quality?: number; // 0.1 ~ 1.0
}

export interface VideoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 ~ 1.0
  maxFileSize?: number; // 바이트 단위
}

// ===========================================
// 경로 생성 유틸리티
// ===========================================

/**
 * 업로드 파일 경로 생성
 */
export function generateUploadPath(
  projectId: string,
  videoSlotId: string,
  type: 'video' | 'thumbnail' | 'screenshot',
  originalFileName: string
): string {
  const timestamp = Date.now();
  const extension = originalFileName.split('.').pop() || 'unknown';

  // 파일명 정리 (특수문자 제거)
  const cleanFileName = originalFileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_');

  switch (type) {
    case 'video':
      return `${projectId}/videos/${videoSlotId}/${timestamp}_${cleanFileName}`;
    case 'thumbnail':
      return `${projectId}/thumbnails/${videoSlotId}/${timestamp}_thumb.jpg`;
    case 'screenshot':
      return `${projectId}/screenshots/${videoSlotId}/${timestamp}_${extension}`;
    default:
      throw new Error(`Unknown upload type: ${type}`);
  }
}

// ===========================================
// 영상 메타데이터 추출
// ===========================================

/**
 * 영상 파일에서 메타데이터 추출
 */
export async function extractVideoMetadata(videoFile: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);

    video.preload = 'metadata';
    video.muted = true;

    video.onloadedmetadata = () => {
      try {
        const metadata: VideoMetadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
          fileSize: videoFile.size,
        };

        // 추가 메타데이터 추출 시도
        if (videoFile.type) {
          metadata.codec = extractCodecFromMimeType(videoFile.type);
        }

        URL.revokeObjectURL(objectUrl);
        resolve(metadata);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to extract video metadata: ${error}`));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video for metadata extraction'));
    };

    video.src = objectUrl;
  });
}

/**
 * MIME 타입에서 코덱 정보 추출
 */
function extractCodecFromMimeType(mimeType: string): string {
  const codecMap: Record<string, string> = {
    'video/mp4': 'H.264',
    'video/webm': 'VP8/VP9',
    'video/quicktime': 'H.264',
    'video/x-msvideo': 'Various',
  };

  return codecMap[mimeType] || 'Unknown';
}

// ===========================================
// 썸네일 생성
// ===========================================

/**
 * 영상의 첫 프레임에서 썸네일 생성
 */
export async function createVideoThumbnail(
  videoFile: File,
  timestamp: number = 1.0, // 1초 지점
  width: number = 320,
  height: number = 180
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Cannot get canvas context'));
      return;
    }

    const objectUrl = URL.createObjectURL(videoFile);

    video.preload = 'metadata';
    video.muted = true;
    video.currentTime = timestamp;

    video.onloadedmetadata = () => {
      // 비율 유지하면서 리사이징
      const aspectRatio = video.videoWidth / video.videoHeight;

      if (aspectRatio > width / height) {
        // 가로가 더 긴 경우
        canvas.width = width;
        canvas.height = width / aspectRatio;
      } else {
        // 세로가 더 긴 경우
        canvas.width = height * aspectRatio;
        canvas.height = height;
      }
    };

    video.onseeked = () => {
      try {
        // 비디오 프레임을 캔버스에 그리기
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 캔버스를 Blob으로 변환
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          0.8 // 품질
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to create thumbnail: ${error}`));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video for thumbnail creation'));
    };

    video.src = objectUrl;
  });
}

// ===========================================
// 스크린샷 생성
// ===========================================

/**
 * 특정 타임스탬프에서 스크린샷 생성
 */
export async function createVideoScreenshot(
  videoFile: File,
  options: ScreenshotOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Cannot get canvas context'));
      return;
    }

    const objectUrl = URL.createObjectURL(videoFile);

    video.preload = 'metadata';
    video.muted = true;
    video.currentTime = options.timestamp;

    video.onloadedmetadata = () => {
      // 캔버스 크기 설정
      canvas.width = options.width || video.videoWidth;
      canvas.height = options.height || video.videoHeight;
    };

    video.onseeked = () => {
      try {
        // 비디오 프레임을 캔버스에 그리기
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 캔버스를 Blob으로 변환
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create screenshot blob'));
            }
          },
          'image/jpeg',
          options.quality || 0.9
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to create screenshot: ${error}`));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video for screenshot creation'));
    };

    video.src = objectUrl;
  });
}

/**
 * 영상에서 여러 타임스탬프의 스크린샷들을 일괄 생성
 */
export async function createMultipleScreenshots(
  videoFile: File,
  timestamps: number[],
  options: Partial<ScreenshotOptions> = {}
): Promise<{ timestamp: number; blob: Blob }[]> {
  const screenshots: { timestamp: number; blob: Blob }[] = [];

  for (const timestamp of timestamps) {
    try {
      const blob = await createVideoScreenshot(videoFile, {
        ...options,
        timestamp,
      });
      screenshots.push({ timestamp, blob });
    } catch (error) {
      console.warn(`Failed to create screenshot at ${timestamp}s:`, error);
      // 개별 스크린샷 실패는 전체 프로세스를 중단하지 않음
    }
  }

  return screenshots;
}

// ===========================================
// 영상 압축
// ===========================================

/**
 * 영상 파일 압축 (클라이언트 사이드)
 * 주의: 브라우저에서 동영상 압축은 제한적이므로 서버 사이드 처리 권장
 */
export async function compressVideo(
  videoFile: File,
  options: VideoCompressionOptions = {}
): Promise<File> {
  // 브라우저에서의 영상 압축은 매우 제한적
  // 실제 프로덕션에서는 FFmpeg 서버나 클라우드 서비스 사용 권장

  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    maxFileSize = 300 * 1024 * 1024, // 300MB
  } = options;

  // 파일 크기가 이미 작으면 그대로 반환
  if (videoFile.size <= maxFileSize) {
    return videoFile;
  }

  // 현재는 기본 압축 로직만 구현
  // 실제로는 WebCodecs API나 외부 라이브러리 필요
  console.warn('Video compression is limited in browser. Consider server-side processing.');

  return videoFile;
}

// ===========================================
// 파일 유효성 검증
// ===========================================

/**
 * 영상 파일 유효성 검증
 */
export function validateVideoFile(file: File): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 파일 존재 확인
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // 파일 크기 확인 (300MB)
  const maxSize = 300 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File size exceeds 300MB limit (current: ${Math.round(file.size / 1024 / 1024)}MB)`);
  }

  // 파일 타입 확인
  const allowedTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ];

  if (!allowedTypes.includes(file.type)) {
    errors.push(`Unsupported file type: ${file.type}. Allowed: MP4, WebM, MOV, AVI`);
  }

  // 파일명 확인
  if (file.name.length > 255) {
    errors.push('Filename too long (max 255 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ===========================================
// 진행률 추적
// ===========================================

export class UploadProgressTracker {
  private callbacks: Array<(progress: number) => void> = [];

  onProgress(callback: (progress: number) => void): void {
    this.callbacks.push(callback);
  }

  updateProgress(progress: number): void {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    this.callbacks.forEach(callback => callback(clampedProgress));
  }

  complete(): void {
    this.updateProgress(100);
  }

  error(): void {
    this.updateProgress(0);
  }
}

// ===========================================
// 업로드 유틸리티
// ===========================================

/**
 * 청크 단위 파일 업로드 (대용량 파일용)
 */
export async function uploadFileInChunks(
  file: File,
  uploadUrl: string,
  chunkSize: number = 5 * 1024 * 1024, // 5MB chunks
  progressTracker?: UploadProgressTracker
): Promise<Response> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadPromises: Promise<Response>[] = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const chunkUpload = async (): Promise<Response> => {
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('fileName', file.name);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (progressTracker) {
        const progress = ((chunkIndex + 1) / totalChunks) * 100;
        progressTracker.updateProgress(progress);
      }

      return response;
    };

    uploadPromises.push(chunkUpload());
  }

  // 모든 청크 업로드 완료 대기
  const responses = await Promise.all(uploadPromises);

  // 마지막 응답 반환 (일반적으로 모든 청크가 완료된 상태)
  return responses[responses.length - 1];
}