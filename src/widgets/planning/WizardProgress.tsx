/**
 * WizardProgress Widget
 *
 * 3-Step Wizard의 진행률 표시 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { memo, useMemo } from 'react'
import type { WizardStep } from '../../entities/planning'

/**
 * 진행률 표시 속성
 */
export interface WizardProgressProps {
  currentStep: WizardStep
  completionPercentage: number
  isProcessing?: boolean
  className?: string
  showStepLabels?: boolean
  showPercentage?: boolean
}

/**
 * 각 단계별 가중치 (총 100%)
 */
const STEP_WEIGHTS = {
  input: 25,  // 25%
  story: 35,  // 35%
  shots: 40,  // 40%
} as const

/**
 * 3-Step Wizard 진행률 컴포넌트
 */
export const WizardProgress = memo(function WizardProgress({
  currentStep,
  completionPercentage,
  isProcessing = false,
  className = '',
  showStepLabels = true,
  showPercentage = true,
}: WizardProgressProps) {
  // 전체 진행률 계산
  const overallProgress = useMemo(() => {
    let baseProgress = 0

    // 완료된 단계들의 기본 점수
    switch (currentStep) {
      case 'input':
        baseProgress = 0
        break
      case 'story':
        baseProgress = STEP_WEIGHTS.input
        break
      case 'shots':
        baseProgress = STEP_WEIGHTS.input + STEP_WEIGHTS.story
        break
    }

    // 현재 단계의 완료 비율 추가
    const currentStepWeight = STEP_WEIGHTS[currentStep]
    const currentStepProgress = (completionPercentage / 100) * currentStepWeight

    return Math.min(100, baseProgress + currentStepProgress)
  }, [currentStep, completionPercentage])

  // 진행률 색상 결정
  const progressColor = useMemo(() => {
    if (isProcessing) return 'bg-blue-500'
    if (overallProgress >= 100) return 'bg-green-500'
    if (overallProgress >= 75) return 'bg-primary-500'
    if (overallProgress >= 50) return 'bg-yellow-500'
    return 'bg-gray-400'
  }, [isProcessing, overallProgress])

  // 현재 단계 메시지
  const currentStepMessage = useMemo(() => {
    if (isProcessing) {
      switch (currentStep) {
        case 'input':
          return 'AI가 스토리를 생성하고 있습니다...'
        case 'story':
          return '12숏으로 분해하고 있습니다...'
        case 'shots':
          return '콘티를 생성하고 있습니다...'
        default:
          return '처리 중...'
      }
    }

    switch (currentStep) {
      case 'input':
        return '기본 정보를 입력해주세요'
      case 'story':
        return '4단계 스토리를 검토하고 수정해주세요'
      case 'shots':
        return '12숏을 편집하고 콘티를 생성해주세요'
      default:
        return ''
    }
  }, [currentStep, isProcessing])

  return (
    <div className={`wizard-progress ${className}`} data-testid="wizard-progress">
      {/* 메인 진행률 바 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">전체 진행률</h3>
            <p className="text-xs text-gray-600 mt-1">{currentStepMessage}</p>
          </div>
          {showPercentage && (
            <div className="text-right">
              <span className="text-lg font-bold text-gray-900">
                {Math.round(overallProgress)}%
              </span>
              {isProcessing && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary-600">진행 중</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          {/* 배경 바 */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            {/* 진행률 바 */}
            <div
              className={`h-3 rounded-full transition-all duration-500 ease-out ${progressColor} ${
                isProcessing ? 'animate-pulse' : ''
              }`}
              style={{ width: `${overallProgress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(overallProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`전체 진행률 ${Math.round(overallProgress)}%`}
            />
          </div>

          {/* 단계별 구분선 */}
          <div className="absolute top-0 left-0 w-full h-3 flex">
            <div
              className="border-r border-white"
              style={{ width: `${STEP_WEIGHTS.input}%` }}
            />
            <div
              className="border-r border-white"
              style={{ width: `${STEP_WEIGHTS.story}%` }}
            />
            <div style={{ width: `${STEP_WEIGHTS.shots}%` }} />
          </div>
        </div>

        {/* 단계별 라벨 */}
        {showStepLabels && (
          <div className="flex justify-between text-xs text-gray-500">
            <div className="flex flex-col items-start" style={{ width: `${STEP_WEIGHTS.input}%` }}>
              <span className={currentStep === 'input' ? 'font-medium text-primary-600' : ''}>
                1. 기본정보
              </span>
              <span className="text-gray-400">{STEP_WEIGHTS.input}%</span>
            </div>
            <div className="flex flex-col items-center" style={{ width: `${STEP_WEIGHTS.story}%` }}>
              <span className={currentStep === 'story' ? 'font-medium text-primary-600' : ''}>
                2. 스토리
              </span>
              <span className="text-gray-400">{STEP_WEIGHTS.story}%</span>
            </div>
            <div className="flex flex-col items-end" style={{ width: `${STEP_WEIGHTS.shots}%` }}>
              <span className={currentStep === 'shots' ? 'font-medium text-primary-600' : ''}>
                3. 숏 편집
              </span>
              <span className="text-gray-400">{STEP_WEIGHTS.shots}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 상세 진행률 (현재 단계) */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            현재 단계: {
              currentStep === 'input' ? '1단계 기본정보' :
              currentStep === 'story' ? '2단계 스토리' :
              '3단계 숏 편집'
            }
          </span>
          <span className="text-sm text-gray-600">{completionPercentage}%</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${completionPercentage}%` }}
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`현재 단계 진행률 ${completionPercentage}%`}
          />
        </div>
      </div>

      {/* 예상 완료 시간 */}
      {!isProcessing && overallProgress > 0 && overallProgress < 100 && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          <EstimatedTimeRemaining
            currentProgress={overallProgress}
            currentStep={currentStep}
          />
        </div>
      )}
    </div>
  )
})

/**
 * 예상 완료 시간 컴포넌트
 */
interface EstimatedTimeRemainingProps {
  currentProgress: number
  currentStep: WizardStep
}

const EstimatedTimeRemaining = memo(function EstimatedTimeRemaining({
  currentProgress,
  currentStep,
}: EstimatedTimeRemainingProps) {
  const estimatedMinutes = useMemo(() => {
    // 단계별 예상 소요 시간 (분)
    const timeEstimates = {
      input: 3,
      story: 5,
      shots: 10,
    }

    const remainingProgress = 100 - currentProgress
    const totalEstimatedTime = Object.values(timeEstimates).reduce((sum, time) => sum + time, 0)

    return Math.ceil((remainingProgress / 100) * totalEstimatedTime)
  }, [currentProgress])

  if (estimatedMinutes <= 0) return null

  return (
    <div className="flex items-center justify-center gap-1">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>예상 완료까지 약 {estimatedMinutes}분</span>
    </div>
  )
})

WizardProgress.displayName = 'WizardProgress'