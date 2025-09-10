/**
 * 비동기 이미지 생성 폴링 유틸리티
 * Vercel의 10초 타임아웃 제한을 우회하기 위한 폴링 패턴 구현
 */

interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: string;
  quality?: string;
}

interface ImageGenerationResponse {
  ok: boolean;
  jobId?: string;
  status?: 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  error?: string;
  traceId?: string;
}

interface JobStatus {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  imageUrl?: string;
  error?: string;
}

interface PollingOptions {
  maxRetries?: number;
  retryInterval?: number;
  onProgress?: (progress: number, status: string) => void;
  onError?: (error: string) => void;
}

/**
 * 이미지 생성 요청을 시작하고 결과를 폴링으로 기다림
 */
export async function generateImageWithPolling(
  request: ImageGenerationRequest,
  options: PollingOptions = {}
): Promise<ImageGenerationResponse> {
  const {
    maxRetries = 30, // 30번 시도 (약 5분)
    retryInterval = 10000, // 10초 간격
    onProgress,
    onError,
  } = options;

  try {
    // 1. 이미지 생성 요청 시작
    onProgress?.(5, '이미지 생성 요청 시작...');
    
    const startResponse = await fetch('/api/imagen/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-trace-id': crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      },
      body: JSON.stringify(request),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${startResponse.status}`;
      onError?.(errorMessage);
      throw new Error(`이미지 생성 요청 실패: ${errorMessage}`);
    }

    const startData: ImageGenerationResponse = await startResponse.json();

    // E2E 빠른 모드인 경우 즉시 반환
    if (startData.status === 'completed') {
      onProgress?.(100, '완료');
      return startData;
    }

    if (!startData.jobId) {
      const errorMessage = 'jobId가 없습니다';
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }

    onProgress?.(10, '이미지 생성 진행 중...');

    // 2. 상태 폴링 시작
    const jobId = startData.jobId;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryInterval));

        onProgress?.(10 + (retryCount / maxRetries) * 80, '이미지 생성 진행 중...');

        const statusResponse = await fetch(`/api/imagen/status/${jobId}`);
        
        if (!statusResponse.ok) {
          retryCount++;
          if (retryCount >= maxRetries) {
            const errorMessage = `상태 확인 실패: HTTP ${statusResponse.status}`;
            onError?.(errorMessage);
            throw new Error(errorMessage);
          }
          continue;
        }

        const statusData: JobStatus = await statusResponse.json();

        // 진행률 업데이트
        const actualProgress = Math.max(10, statusData.progress);
        onProgress?.(actualProgress, getStatusMessage(statusData.status, statusData.progress));

        // 완료됨
        if (statusData.status === 'completed') {
          onProgress?.(100, '완료');
          return {
            ok: true,
            jobId: statusData.jobId,
            status: statusData.status,
            imageUrl: statusData.imageUrl,
            traceId: startData.traceId,
          };
        }

        // 실패함
        if (statusData.status === 'failed') {
          const errorMessage = statusData.error || '이미지 생성 실패';
          onError?.(errorMessage);
          throw new Error(errorMessage);
        }

        // 계속 진행 중
        retryCount++;

      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          onError?.(errorMessage);
          throw error;
        }
      }
    }

    // 최대 재시도 초과
    const timeoutError = '이미지 생성 시간 초과';
    onError?.(timeoutError);
    throw new Error(timeoutError);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '이미지 생성 실패';
    onError?.(errorMessage);
    throw error;
  }
}

/**
 * 상태에 따른 메시지 생성
 */
function getStatusMessage(status: string, progress: number): string {
  switch (status) {
    case 'processing':
      if (progress < 20) return '이미지 생성 준비 중...';
      if (progress < 40) return '서버 연결 중...';
      if (progress < 70) return '이미지 생성 중...';
      if (progress < 90) return '이미지 처리 중...';
      return '완료 처리 중...';
    case 'completed':
      return '완료';
    case 'failed':
      return '실패';
    default:
      return '진행 중...';
  }
}

/**
 * 간단한 이미지 생성 함수 (기본 옵션 사용)
 */
export async function generateImage(
  prompt: string,
  aspectRatio: string = '16:9',
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const result = await generateImageWithPolling(
    { prompt, aspectRatio },
    { onProgress }
  );
  
  if (!result.imageUrl) {
    throw new Error('이미지 URL을 받을 수 없습니다');
  }
  
  return result.imageUrl;
}