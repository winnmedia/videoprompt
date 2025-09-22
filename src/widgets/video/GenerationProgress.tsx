/**
 * GenerationProgress Widget
 *
 * 영상 생성 진행 상황 표시 컴포넌트 (17단계 UserJourneyMap)
 * - 실시간 로딩바와 생성 진행 상황 표시
 * - 접근성 WCAG 2.1 AA 준수
 * - 반응형 디자인
 */

import { useEffect, useState } from 'react'

export interface GenerationProgressProps {
  /** 현재 진행률 (0-100) */
  progress: number
  /** 현재 단계 메시지 */
  currentStep: string
  /** 전체 단계 목록 */
  steps?: ProgressStep[]
  /** 예상 완료 시간 (초) */
  estimatedTime?: number
  /** 에러 상태 */
  hasError?: boolean
  /** 에러 메시지 */
  errorMessage?: string
  /** 취소 가능 여부 */
  cancellable?: boolean
  /** 취소 콜백 */
  onCancel?: () => void
}

export interface ProgressStep {
  id: string
  label: string
  description: string
  completed: boolean
  active: boolean
}

const DEFAULT_STEPS: ProgressStep[] = [
  {
    id: 'preparation',
    label: '준비',
    description: '프롬프트와 이미지 분석 중',
    completed: false,
    active: false,
  },
  {
    id: 'generation',
    label: '생성',
    description: 'AI가 영상을 생성하고 있습니다',
    completed: false,
    active: false,
  },
  {
    id: 'processing',
    label: '처리',
    description: '영상 품질 최적화 중',
    completed: false,
    active: false,
  },
  {
    id: 'completion',
    label: '완료',
    description: '영상 생성이 완료되었습니다',
    completed: false,
    active: false,
  },
]

export function GenerationProgress({
  progress,
  currentStep,
  steps = DEFAULT_STEPS,
  estimatedTime,
  hasError = false,
  errorMessage,
  cancellable = true,
  onCancel,
}: GenerationProgressProps) {
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [remainingTime, setRemainingTime] = useState(estimatedTime)

  // 경과 시간 추적
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // 남은 시간 계산
  useEffect(() => {
    if (estimatedTime && progress > 0) {
      const elapsed = timeElapsed
      const totalEstimated = (elapsed / progress) * 100
      const remaining = Math.max(0, totalEstimated - elapsed)
      setRemainingTime(Math.ceil(remaining))
    }
  }, [progress, timeElapsed, estimatedTime])

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 현재 활성 단계 찾기
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.active || step.label === currentStep)
  }

  // 진행률에 따른 색상 결정
  const getProgressColor = () => {
    if (hasError) return 'bg-error-500'
    if (progress === 100) return 'bg-success-500'
    return 'bg-video-progress-fill'
  }

  const currentStepIndex = getCurrentStepIndex()

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-neutral-900">
          {hasError ? '생성 실패' : progress === 100 ? '생성 완료' : 'AI 영상 생성 중'}
        </h2>
        <p className="text-neutral-600">
          {hasError
            ? '영상 생성 중 오류가 발생했습니다'
            : progress === 100
            ? '영상이 성공적으로 생성되었습니다'
            : '잠시만 기다려주세요...'}
        </p>
      </div>

      {/* 메인 진행바 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">{currentStep}</span>
          <span className="text-neutral-800 font-medium">
            {hasError ? '실패' : `${Math.round(progress)}%`}
          </span>
        </div>

        <div
          className="w-full bg-video-progress-bg rounded-full h-3 overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="progress-label"
        >
          <div
            className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{
              width: `${hasError ? 100 : progress}%`,
              '--progress-width': `${progress}%`
            } as React.CSSProperties & { '--progress-width': string }}
          />
        </div>

        <div
          id="progress-label"
          className="sr-only"
        >
          영상 생성 진행률: {Math.round(progress)}%
        </div>
      </div>

      {/* 단계별 진행 상황 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-800">진행 단계</h3>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex || (index === currentStepIndex && progress === 100)
            const isActive = index === currentStepIndex && !hasError && progress < 100
            const isFailed = hasError && index === currentStepIndex

            return (
              <div
                key={step.id}
                className={`
                  flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200
                  ${isActive
                    ? 'border-primary-300 bg-primary-50'
                    : isCompleted
                    ? 'border-success-300 bg-success-50'
                    : isFailed
                    ? 'border-error-300 bg-error-50'
                    : 'border-neutral-200 bg-neutral-50'
                  }
                `}
              >
                {/* 상태 아이콘 */}
                <div
                  className={`
                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                    ${isCompleted
                      ? 'bg-success-500 text-white'
                      : isActive
                      ? 'bg-primary-500 text-white'
                      : isFailed
                      ? 'bg-error-500 text-white'
                      : 'bg-neutral-300 text-neutral-500'
                    }
                  `}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-3 h-3 bg-white rounded-full animate-video-pulse" />
                  ) : isFailed ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* 단계 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4
                      className={`
                        font-medium text-sm
                        ${isActive || isCompleted
                          ? 'text-neutral-900'
                          : isFailed
                          ? 'text-error-700'
                          : 'text-neutral-600'
                        }
                      `}
                    >
                      {step.label}
                    </h4>

                    {isActive && (
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-primary-500 rounded-full animate-loading-dots" />
                        <div className="w-1 h-1 bg-primary-500 rounded-full animate-loading-dots" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 bg-primary-500 rounded-full animate-loading-dots" style={{ animationDelay: '0.4s' }} />
                      </div>
                    )}
                  </div>

                  <p
                    className={`
                      text-xs mt-1
                      ${isActive
                        ? 'text-neutral-700'
                        : isFailed
                        ? 'text-error-600'
                        : 'text-neutral-500'
                      }
                    `}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 시간 정보 */}
      {!hasError && (
        <div className="flex justify-between items-center text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg">
          <div>
            <span className="font-medium">경과 시간:</span>{' '}
            {formatTime(timeElapsed)}
          </div>
          {remainingTime !== undefined && progress < 100 && (
            <div>
              <span className="font-medium">예상 남은 시간:</span>{' '}
              {formatTime(remainingTime)}
            </div>
          )}
        </div>
      )}

      {/* 에러 메시지 */}
      {hasError && errorMessage && (
        <div
          className="bg-error-50 border border-error-200 rounded-lg p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start space-x-3">
            <svg
              className="flex-shrink-0 w-5 h-5 text-error-500 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-error-800">오류 발생</h4>
              <p className="text-sm text-error-700 mt-1">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* 취소 버튼 */}
      {cancellable && !hasError && progress < 100 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors duration-150"
          >
            생성 취소
          </button>
        </div>
      )}
    </div>
  )
}