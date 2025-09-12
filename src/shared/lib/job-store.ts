/**
 * 작업 상태 관리를 위한 인메모리 스토어
 * 프로덕션에서는 Redis 등으로 교체해야 함
 */

interface JobData {
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  imageUrl?: string;
  error?: string;
  createdAt: number;
}

// 간단한 메모리 스토어
const jobStore = new Map<string, JobData>();

// 5분 후 자동 삭제
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// 정리 작업 설정 (서버 시작 시 한 번만)
let cleanupInterval: NodeJS.Timeout | null = null;

function setupCleanup() {
  if (cleanupInterval) return; // 이미 설정됨
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobStore.entries()) {
      if (now - job.createdAt > CLEANUP_INTERVAL) {
        jobStore.delete(jobId);
      }
    }
  }, CLEANUP_INTERVAL);
}

// 클린업 중지 함수
export function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// 클린업 설정 초기화
setupCleanup();

// 프로세스 종료 시 클린업
if (typeof process !== 'undefined') {
  process.on('beforeExit', stopCleanup);
  process.on('SIGTERM', stopCleanup);
  process.on('SIGINT', stopCleanup);
}

/**
 * 작업 상태를 업데이트하는 함수
 */
export function updateJobStatus(
  jobId: string,
  status: 'processing' | 'completed' | 'failed',
  progress: number,
  imageUrl?: string,
  error?: string
) {
  const existing = jobStore.get(jobId);
  jobStore.set(jobId, {
    status,
    progress,
    imageUrl: imageUrl || existing?.imageUrl,
    error: error || existing?.error,
    createdAt: existing?.createdAt || Date.now(),
  });
}

/**
 * 새 작업을 생성하는 함수
 */
export function createJob(jobId: string) {
  jobStore.set(jobId, {
    status: 'processing',
    progress: 0,
    createdAt: Date.now(),
  });
}

/**
 * 작업 상태를 조회하는 함수
 */
export function getJobStatus(jobId: string): JobData | undefined {
  return jobStore.get(jobId);
}