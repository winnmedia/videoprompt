/**
 * Video Widgets Public API
 *
 * CLAUDE.md 준수: widgets/video 레이어 Public API
 * 영상 생성과 관련된 모든 UI 위젯을 외부에 노출
 * FSD 규칙: 내부 구현 숨김, 깔끔한 인터페이스 제공
 */

// 메인 영상 생성 위젯
export { VideoGenerator } from './VideoGenerator'
export type { VideoGeneratorProps, VideoGenerationData } from './VideoGenerator'

// 영상 재생 위젯
export { VideoPlayer } from './VideoPlayer'
export type { VideoPlayerProps } from './VideoPlayer'

// 생성 진행 상황 위젯
export { GenerationProgress } from './GenerationProgress'
export type { GenerationProgressProps, ProgressStep } from './GenerationProgress'

// 영상 제어 위젯
export { VideoControls } from './VideoControls'
export type { VideoControlsProps, VideoFeedback } from './VideoControls'

/**
 * 사용 예시:
 *
 * import { VideoGenerator, VideoPlayer, GenerationProgress, VideoControls } from '@/widgets/video'
 *
 * // 15-16단계: 영상 생성
 * <VideoGenerator
 *   storyboardImages={images}
 *   onGenerationStart={handleStart}
 * />
 *
 * // 17단계: 진행 상황 표시
 * <GenerationProgress
 *   progress={75}
 *   currentStep="AI가 영상을 생성하고 있습니다"
 * />
 *
 * // 18단계: 영상 재생 및 제어
 * <VideoPlayer src={videoUrl} />
 * <VideoControls
 *   videoUrl={videoUrl}
 *   onFeedbackSubmit={handleFeedback}
 * />
 */