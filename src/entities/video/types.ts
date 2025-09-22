/**
 * Video Generation Domain Types
 *
 * CLAUDE.md 준수: entities 레이어 순수 도메인 모델
 * 외부 기술에 의존하지 않는 비즈니스 규칙과 타입 정의
 */

/**
 * 영상 생성 상태
 * 데이터베이스 enum과 일치
 */
export type VideoGenerationStatus =
  | 'pending'      // 대기 중
  | 'processing'   // 생성 중
  | 'completed'    // 완료
  | 'failed'       // 실패
  | 'cancelled'    // 취소됨

/**
 * 지원되는 영상 생성 제공업체
 */
export type VideoProvider =
  | 'runway'       // Runway ML
  | 'seedance'     // ByteDance/Seedance
  | 'stable-video' // Stable Video Diffusion

/**
 * 영상 해상도
 */
export interface Resolution {
  readonly width: number
  readonly height: number
}

/**
 * 영상 메타데이터
 */
export interface VideoMetadata {
  readonly duration?: number         // 길이 (초)
  readonly resolution?: Resolution   // 해상도
  readonly format?: string          // 포맷 (mp4, webm 등)
  readonly size?: number            // 파일 크기 (bytes)
  readonly estimatedTime?: number   // 예상 생성 시간 (초)
  readonly fps?: number            // 프레임 레이트
  readonly aspectRatio?: string    // 화면 비율 ('16:9', '9:16' 등)
}

/**
 * 영상 생성 파라미터
 */
export interface VideoGenerationParams {
  readonly prompt: string           // 생성 프롬프트
  readonly imageUrl?: string        // 입력 이미지 URL (옵션)
  readonly duration?: number        // 원하는 길이 (초)
  readonly resolution?: Resolution  // 원하는 해상도
  readonly aspectRatio?: string     // 화면 비율
  readonly seed?: number           // 시드값 (재현성)
}

/**
 * 외부 API 작업 정보
 */
export interface VideoJob {
  readonly id: string              // 외부 API job ID
  readonly provider: VideoProvider // 제공업체
  readonly status: VideoGenerationStatus
  readonly progress?: number       // 진행률 (0-100)
  readonly estimatedTime?: number  // 남은 예상 시간 (초)
  readonly resultUrl?: string      // 결과 영상 URL
  readonly error?: string          // 오류 메시지
}

/**
 * 영상 생성 도메인 모델
 * 데이터베이스 테이블과 일치하는 핵심 엔티티
 */
export interface VideoGeneration {
  readonly id: string
  readonly scenarioId: string
  readonly projectId: string
  readonly userId: string
  readonly status: VideoGenerationStatus
  readonly externalJobId?: string

  // 입력 데이터
  readonly inputPrompt: string
  readonly inputImageUrl?: string
  readonly inputParams?: VideoGenerationParams

  // 출력 데이터
  readonly outputVideoUrl?: string
  readonly outputThumbnailUrl?: string

  // 메타데이터
  readonly provider: VideoProvider
  readonly metadata: VideoMetadata

  // 감사 추적
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly completedAt?: Date
  readonly isDeleted: boolean
}

/**
 * 영상 생성 요청
 */
export interface VideoGenerationRequest {
  readonly scenarioId: string
  readonly projectId: string
  readonly provider: VideoProvider
  readonly params: VideoGenerationParams
}

/**
 * 영상 생성 응답
 */
export interface VideoGenerationResponse {
  readonly id: string
  readonly status: VideoGenerationStatus
  readonly externalJobId?: string
  readonly estimatedTime?: number
}

/**
 * 큐 아이템
 */
export interface VideoQueueItem {
  readonly id: string
  readonly videoGenerationId: string
  readonly provider: VideoProvider
  readonly params: VideoGenerationParams
  readonly priority: number        // 우선순위 (낮을수록 높은 우선순위)
  readonly retryCount: number      // 재시도 횟수
  readonly maxRetries: number      // 최대 재시도 횟수
  readonly createdAt: Date
  readonly scheduledAt?: Date      // 예약 실행 시간
}

/**
 * 진행 상태 업데이트
 */
export interface VideoProgressUpdate {
  readonly videoGenerationId: string
  readonly status: VideoGenerationStatus
  readonly progress?: number
  readonly estimatedTime?: number
  readonly resultUrl?: string
  readonly error?: string
  readonly updatedAt: Date
}

/**
 * 영상 피드백
 */
export interface VideoFeedback {
  readonly id: string
  readonly videoGenerationId: string
  readonly userId: string
  readonly rating: number          // 1-5 점
  readonly comment?: string        // 피드백 내용
  readonly issues?: VideoIssue[]   // 구체적 문제점
  readonly createdAt: Date
}

/**
 * 영상 문제점 타입
 */
export type VideoIssue =
  | 'quality_low'      // 화질 낮음
  | 'content_mismatch' // 프롬프트와 불일치
  | 'duration_wrong'   // 길이 문제
  | 'artifacts'        // 아티팩트 존재
  | 'motion_poor'      // 모션 품질 낮음
  | 'other'           // 기타

/**
 * 도메인 상수
 */
export const VideoConstants = {
  // 최대값
  MAX_PROMPT_LENGTH: 1000,
  MAX_DURATION_SECONDS: 30,
  MAX_RETRIES: 3,

  // 기본값
  DEFAULT_DURATION: 5,
  DEFAULT_RESOLUTION: { width: 1024, height: 576 } as const,
  DEFAULT_ASPECT_RATIO: '16:9',

  // 우선순위
  PRIORITY: {
    HIGH: 1,
    NORMAL: 5,
    LOW: 10
  } as const,

  // 지원 해상도
  SUPPORTED_RESOLUTIONS: [
    { width: 512, height: 512 },   // 1:1
    { width: 768, height: 512 },   // 3:2
    { width: 1024, height: 576 },  // 16:9
    { width: 576, height: 1024 },  // 9:16
  ] as const
} as const

/**
 * 타입 가드
 */
export function isVideoGenerationStatus(value: string): value is VideoGenerationStatus {
  return ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(value)
}

export function isVideoProvider(value: string): value is VideoProvider {
  return ['runway', 'seedance', 'stable-video'].includes(value)
}

export function isValidResolution(resolution: Resolution): boolean {
  return resolution.width > 0 &&
         resolution.height > 0 &&
         resolution.width <= 2048 &&
         resolution.height <= 2048
}