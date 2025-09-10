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
  abortController?: AbortController;
}

/**
 * 서킷 브레이커 상태 관리
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold = 3,
    private readonly timeout = 60000 // 1분
  ) {}
  
  canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    
    return true; // HALF_OPEN
  }
  
  onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

const circuitBreaker = new CircuitBreaker();

/**
 * 지수 백오프 계산
 */
function calculateBackoffDelay(attempt: number, baseDelay = 1000): number {
  const maxDelay = 30000; // 최대 30초
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * 이미지 생성 요청을 시작하고 결과를 폴링으로 기다림
 */
export async function generateImageWithPolling(
  request: ImageGenerationRequest,
  options: PollingOptions = {}
): Promise<ImageGenerationResponse> {
  const {
    maxRetries = 3, // 메모리 보호를 위해 3회로 제한
    retryInterval = 5000, // 5초 간격
    onProgress,
    onError,
    abortController,
  } = options;
  
  // 서킷 브레이커 체크
  if (!circuitBreaker.canExecute()) {
    const error = '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
    onError?.(error);
    throw new Error(error);
  }

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
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      while (retryCount < maxRetries) {
        // 중단 신호 체크
        if (abortController?.signal.aborted) {
          throw new Error('작업이 중단되었습니다.');
        }
        
        try {
          // 지수 백오프를 사용한 대기
          const delay = retryCount === 0 ? retryInterval : calculateBackoffDelay(retryCount, 2000);
          
          await new Promise((resolve, reject) => {
            timeoutId = setTimeout(resolve, delay);
            abortController?.signal.addEventListener('abort', () => {
              if (timeoutId) clearTimeout(timeoutId);
              reject(new Error('작업이 중단되었습니다.'));
            });
          });
          
          // 타임아웃 정리
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          onProgress?.(10 + (retryCount / maxRetries) * 80, '이미지 생성 진행 중...');

          const statusResponse = await fetch(`/api/imagen/status/${jobId}`, {
            signal: abortController?.signal
          });
          
          if (!statusResponse.ok) {
            retryCount++;
            if (retryCount >= maxRetries) {
              circuitBreaker.onFailure();
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
            circuitBreaker.onSuccess();
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
            circuitBreaker.onFailure();
            const errorMessage = statusData.error || '이미지 생성 실패';
            onError?.(errorMessage);
            throw new Error(errorMessage);
          }

          // 계속 진행 중
          retryCount++;

        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            circuitBreaker.onFailure();
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            onError?.(errorMessage);
            throw error;
          }
        }
      }
    } finally {
      // 리소스 정리
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    // 최대 재시도 초과 (while 루프가 끝난 경우)
    circuitBreaker.onFailure();
    const timeoutError = '이미지 생성 시간 초과';
    onError?.(timeoutError);
    throw new Error(timeoutError);

  } catch (error) {
    // 중단된 경우에는 서킷 브레이커에 실패를 기록하지 않음
    if (error instanceof Error && error.message !== '작업이 중단되었습니다.') {
      circuitBreaker.onFailure();
    }
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
  onProgress?: (progress: number, status: string) => void,
  abortController?: AbortController
): Promise<string> {
  const result = await generateImageWithPolling(
    { prompt, aspectRatio },
    { onProgress, abortController }
  );
  
  // Null 체크와 fallback 처리 추가
  if (!result || !result.imageUrl) {
    console.warn('No image URL received, using fallback');
    // 간단한 fallback URL 반환 (플레이스홀더)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzA4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+7J2066mV IOyDnOyEsSDsm5A8L3RleHQ+Cjwvc3ZnPg==';
  }
  
  return result.imageUrl;
}

/**
 * Blob URL 정리를 위한 유틸리티 함수
 */
export function createManagedBlobUrl(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  
  return {
    url,
    revoke: () => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
    }
  };
}

/**
 * 자동 정리되는 Blob URL 생성
 */
export function createAutoCleanupBlobUrl(blob: Blob, timeoutMs = 300000): string {
  const url = URL.createObjectURL(blob);
  
  // 5분 후 자동 정리
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn('Failed to auto-cleanup blob URL:', error);
    }
  }, timeoutMs);
  
  return url;
}