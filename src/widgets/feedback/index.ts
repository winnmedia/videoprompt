/**
 * Feedback Widgets Public API
 *
 * CLAUDE.md 준수: FSD Public API 구성
 * widgets/feedback 레이어의 모든 컴포넌트를 외부에 노출하는 Public API
 */

// ===========================================
// 메인 위젯 컴포넌트들
// ===========================================

/**
 * 영상 플레이어와 타임코드 기반 피드백 UI를 통합한 메인 뷰어
 */
export { VideoFeedbackViewer } from './VideoFeedbackViewer'

/**
 * 특정 타임코드에 감정 피드백 및 텍스트 댓글을 입력하는 UI
 */
export { FeedbackCollector } from './FeedbackCollector'

/**
 * 영상 하단 타임라인에 피드백을 시각화하고 클릭으로 해당 시점 이동 지원
 */
export { FeedbackTimeline } from './FeedbackTimeline'

/**
 * URL 공유 링크 생성, QR 코드 생성, 권한 설정을 제공하는 컴포넌트
 */
export { ShareLinkGenerator } from './ShareLinkGenerator'

/**
 * 피드백 데이터를 시각화하고 감정 분석 차트, 시점별 피드백 분포를 제공
 */
export { FeedbackDashboard } from './FeedbackDashboard'

/**
 * 스크린샷 캡처, 영상 교체/삭제, URL 복사, 다운로드 등의 액션을 제공
 */
export { VideoActionBar } from './VideoActionBar'

// ===========================================
// 합성 패턴을 위한 그룹화된 내보내기
// ===========================================

/**
 * 피드백 뷰어 관련 컴포넌트 그룹
 *
 * VideoFeedbackViewer + FeedbackTimeline + VideoActionBar를 조합하여
 * 완전한 영상 피드백 뷰어를 구성할 수 있습니다.
 */
export const FeedbackViewer = {
  Main: VideoFeedbackViewer,
  Timeline: FeedbackTimeline,
  ActionBar: VideoActionBar
} as const

/**
 * 피드백 입력 관련 컴포넌트 그룹
 *
 * FeedbackCollector를 중심으로 피드백 입력 UI를 구성할 수 있습니다.
 */
export const FeedbackInput = {
  Collector: FeedbackCollector
} as const

/**
 * 피드백 분석 관련 컴포넌트 그룹
 *
 * FeedbackDashboard를 중심으로 피드백 분석 및 통계 UI를 구성할 수 있습니다.
 */
export const FeedbackAnalytics = {
  Dashboard: FeedbackDashboard
} as const

/**
 * 공유 관련 컴포넌트 그룹
 *
 * ShareLinkGenerator를 중심으로 피드백 세션 공유 UI를 구성할 수 있습니다.
 */
export const FeedbackSharing = {
  LinkGenerator: ShareLinkGenerator
} as const

// ===========================================
// 복합 컴포넌트 패턴
// ===========================================

/**
 * 모든 피드백 위젯을 포함하는 복합 객체
 *
 * 사용 예시:
 * ```tsx
 * import { FeedbackWidgets } from '@/widgets/feedback'
 *
 * function FeedbackPage() {
 *   return (
 *     <div>
 *       <FeedbackWidgets.Viewer.Main sessionId="session-1" />
 *       <FeedbackWidgets.Input.Collector />
 *       <FeedbackWidgets.Analytics.Dashboard />
 *     </div>
 *   )
 * }
 * ```
 */
export const FeedbackWidgets = {
  Viewer: FeedbackViewer,
  Input: FeedbackInput,
  Analytics: FeedbackAnalytics,
  Sharing: FeedbackSharing
} as const

// ===========================================
// 유틸리티 및 헬퍼 함수들
// ===========================================

/**
 * 피드백 위젯들에서 공통으로 사용하는 유틸리티 함수들
 */
export const FeedbackUtils = {
  /**
   * 타임코드를 MM:SS 형식으로 포맷팅
   */
  formatTimecode: (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  },

  /**
   * MM:SS 형식의 문자열을 초 단위로 변환
   */
  parseTimecode: (timeString: string): number => {
    const [minutes, seconds] = timeString.split(':').map(Number)
    return (minutes || 0) * 60 + (seconds || 0)
  },

  /**
   * 파일 크기를 읽기 쉬운 형식으로 포맷팅
   */
  formatFileSize: (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  },

  /**
   * 비디오 형식 유효성 검증
   */
  isValidVideoFormat: (filename: string): boolean => {
    const validExtensions = ['mp4', 'webm', 'mov', 'avi']
    const extension = filename.split('.').pop()?.toLowerCase()
    return extension ? validExtensions.includes(extension) : false
  },

  /**
   * 감정 타입을 사람이 읽기 쉬운 형태로 변환
   */
  formatEmotionType: (emotion: string): string => {
    const emotionMap: Record<string, string> = {
      like: '좋아요',
      dislike: '싫어요',
      confused: '혼란스러움',
      love: '사랑해요',
      laugh: '웃겨요',
      wow: '놀라워요',
      sad: '슬퍼요',
      angry: '화나요',
      sleepy: '지루해요'
    }
    return emotionMap[emotion] || emotion
  }
} as const

// ===========================================
// 타입 재내보내기
// ===========================================

/**
 * 피드백 위젯에서 사용하는 주요 타입들을 재내보내기
 * entities 레이어의 타입들을 widgets 레이어에서 쉽게 접근할 수 있도록 함
 */
export type {
  VideoSlot,
  EmotionType,
  TimecodeComment,
  EmotionReaction,
  FeedbackSession,
  FeedbackSessionMetadata,
  TimecodeHotspot,
  ParticipantPermissions,
  CreateCommentRequest,
  CreateReactionRequest
} from '../../entities/feedback'

// ===========================================
// 기본 내보내기 (선택사항)
// ===========================================

/**
 * 기본 내보내기로 가장 많이 사용될 컴포넌트 제공
 */
export default VideoFeedbackViewer