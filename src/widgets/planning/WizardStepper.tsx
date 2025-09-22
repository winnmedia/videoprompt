/**
 * WizardStepper Widget
 *
 * 3-Step Wizard의 진행 단계 표시 컴포넌트
 * CLAUDE.md 준수: FSD widgets 레이어, 접근성 WCAG 2.1 AA, React 19
 */

import { memo, useCallback } from 'react'
import type { WizardStep } from '../../entities/planning'

/**
 * 스테퍼 속성
 */
export interface WizardStepperProps {
  currentStep: WizardStep
  completedSteps: WizardStep[]
  onStepClick?: (step: WizardStep) => void
  disabled?: boolean
  className?: string
}

/**
 * 스텝 정의
 */
const WIZARD_STEPS: {
  key: WizardStep
  label: string
  description: string
  order: number
}[] = [
  {
    key: 'input',
    label: '기본 정보',
    description: '제목, 로그라인, 톤앤매너 설정',
    order: 1,
  },
  {
    key: 'story',
    label: '4단계 스토리',
    description: '스토리 구조 검토 및 수정',
    order: 2,
  },
  {
    key: 'shots',
    label: '12숏 편집',
    description: '숏 편집, 콘티, 내보내기',
    order: 3,
  },
]

/**
 * 스텝 상태 결정
 */
function getStepStatus(
  stepKey: WizardStep,
  currentStep: WizardStep,
  completedSteps: WizardStep[]
): 'completed' | 'current' | 'pending' {
  if (completedSteps.includes(stepKey)) {
    return 'completed'
  }
  if (stepKey === currentStep) {
    return 'current'
  }
  return 'pending'
}

/**
 * 3-Step Wizard 스테퍼 컴포넌트
 */
export const WizardStepper = memo(function WizardStepper({
  currentStep,
  completedSteps,
  onStepClick,
  disabled = false,
  className = '',
}: WizardStepperProps) {
  const handleStepClick = useCallback((step: WizardStep) => {
    if (disabled || !onStepClick) return

    // 완료된 스텝이나 현재 스텝만 클릭 가능
    if (completedSteps.includes(step) || step === currentStep) {
      onStepClick(step)
    }
  }, [disabled, onStepClick, completedSteps, currentStep])

  return (
    <nav
      className={`wizard-stepper ${className}`}
      role="navigation"
      aria-label="위저드 단계"
      data-testid="wizard-stepper"
    >
      <ol className="flex items-center justify-center space-x-8">
        {WIZARD_STEPS.map((step, index) => {
          const status = getStepStatus(step.key, currentStep, completedSteps)
          const isClickable = !disabled && (status === 'completed' || status === 'current')
          const isLast = index === WIZARD_STEPS.length - 1

          return (
            <li key={step.key} className="flex items-center">
              {/* 스텝 버튼 */}
              <button
                type="button"
                onClick={() => handleStepClick(step.key)}
                disabled={!isClickable}
                className={`
                  relative flex flex-col items-center p-4 rounded-lg transition-all duration-200
                  ${isClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}
                  ${status === 'current' ? 'bg-primary-50' : ''}
                `}
                aria-current={status === 'current' ? 'step' : undefined}
                data-testid={`step-${step.key}`}
              >
                {/* 스텝 번호/아이콘 */}
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 transition-all duration-200
                    ${
                      status === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : status === 'current'
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-300 text-gray-500'
                    }
                  `}
                >
                  {status === 'completed' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm font-semibold">{step.order}</span>
                  )}
                </div>

                {/* 스텝 라벨 */}
                <div className="text-center">
                  <h3
                    className={`
                      text-sm font-medium mb-1 transition-colors
                      ${
                        status === 'current'
                          ? 'text-primary-600'
                          : status === 'completed'
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }
                    `}
                  >
                    {step.label}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-24">
                    {step.description}
                  </p>
                </div>

                {/* 현재 스텝 표시 */}
                {status === 'current' && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                    <div className="w-2 h-2 bg-primary-600 rounded-full" />
                  </div>
                )}
              </button>

              {/* 연결선 */}
              {!isLast && (
                <div className="flex-1 h-px mx-4">
                  <div
                    className={`
                      h-full transition-colors duration-200
                      ${
                        completedSteps.includes(step.key) &&
                        completedSteps.includes(WIZARD_STEPS[index + 1].key)
                          ? 'bg-green-300'
                          : 'bg-gray-300'
                      }
                    `}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* 모바일용 간소화된 표시 */}
      <div className="md:hidden mt-4">
        <div className="bg-gray-100 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {WIZARD_STEPS.find(s => s.key === currentStep)?.label}
            </span>
            <span className="text-gray-500">
              {WIZARD_STEPS.findIndex(s => s.key === currentStep) + 1} / {WIZARD_STEPS.length}
            </span>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((WIZARD_STEPS.findIndex(s => s.key === currentStep) + 1) / WIZARD_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  )
})

WizardStepper.displayName = 'WizardStepper'