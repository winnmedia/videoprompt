/**
 * 위저드 내비게이션 컴포넌트
 * FSD: widgets/planning 레이어
 */

export interface WizardNavigationProps {
  currentStep: number
  totalSteps: number
  onPrev?: () => void
  onNext?: () => void
  canPrev?: boolean
  canNext?: boolean
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true
}: WizardNavigationProps) {
  return (
    <div className="flex justify-between items-center">
      <button
        onClick={onPrev}
        disabled={!canPrev || currentStep === 1}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        이전
      </button>

      <span className="text-sm text-gray-500">
        {currentStep} / {totalSteps}
      </span>

      <button
        onClick={onNext}
        disabled={!canNext || currentStep === totalSteps}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        다음
      </button>
    </div>
  )
}