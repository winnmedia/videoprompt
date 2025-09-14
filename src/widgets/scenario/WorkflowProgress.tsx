'use client';

import React from 'react';
import { WorkflowStep, WORKFLOW_STEPS, STEP_CONFIG } from '@/entities/scenario';

interface WorkflowProgressProps {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  onStepClick?: (step: WorkflowStep) => void;
  className?: string;
}

/**
 * 시나리오 워크플로우 진행 상황을 표시하는 컴포넌트
 *
 * 접근성:
 * - 각 단계가 버튼 또는 리스트 아이템으로 구성
 * - 현재 단계와 완료된 단계를 스크린 리더가 인식
 * - 키보드 네비게이션 지원
 */
export function WorkflowProgress({
  currentStep,
  completedSteps,
  onStepClick,
  className = ''
}: WorkflowProgressProps) {
  const steps = [
    WORKFLOW_STEPS.STORY_INPUT,
    WORKFLOW_STEPS.STORY_REVIEW,
    WORKFLOW_STEPS.SHOTS_GENERATION,
    WORKFLOW_STEPS.EXPORT,
  ];

  const getStepStatus = (step: WorkflowStep) => {
    if (completedSteps.includes(step)) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (step: WorkflowStep, status: string) => {
    if (status === 'completed') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
          <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    }

    if (status === 'current') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand-500 bg-white">
          <div className="h-3 w-3 rounded-full bg-brand-500" />
        </div>
      );
    }

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
        <span className="text-sm font-medium text-gray-500">{step}</span>
      </div>
    );
  };

  return (
    <nav
      className={`mb-8 ${className}`}
      aria-label="진행 단계"
      role="navigation"
    >
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const status = getStepStatus(step);
            const config = STEP_CONFIG[step];
            const isClickable = onStepClick && (status === 'completed' || status === 'current');

            const stepElement = (
              <div className="flex flex-col items-center text-center">
                {getStepIcon(step, status)}
                <div className="mt-2">
                  <p
                    className={`text-sm font-medium ${
                      status === 'current'
                        ? 'text-brand-600'
                        : status === 'completed'
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {step}단계
                  </p>
                  <p
                    className={`text-xs ${
                      status === 'current'
                        ? 'text-brand-600'
                        : status === 'completed'
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {config.title}
                  </p>
                </div>
              </div>
            );

            return (
              <React.Fragment key={step}>
                {isClickable ? (
                  <button
                    onClick={() => onStepClick(step)}
                    className={`group flex flex-col items-center text-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-md p-2 ${
                      status === 'current' ? 'cursor-default' : 'hover:bg-gray-50'
                    }`}
                    aria-current={status === 'current' ? 'step' : undefined}
                    aria-label={`${step}단계: ${config.title}${
                      status === 'completed' ? ' (완료)' : status === 'current' ? ' (현재)' : ''
                    }`}
                  >
                    {stepElement}
                  </button>
                ) : (
                  <div
                    key={step}
                    aria-current={status === 'current' ? 'step' : undefined}
                    aria-label={`${step}단계: ${config.title}${
                      status === 'completed' ? ' (완료)' : status === 'current' ? ' (현재)' : ' (예정)'
                    }`}
                  >
                    {stepElement}
                  </div>
                )}

                {/* 단계 간 연결선 */}
                {index < steps.length - 1 && (
                  <div
                    className="flex-1 h-px mx-4"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full w-full ${
                        completedSteps.includes(step) && completedSteps.includes(steps[index + 1])
                          ? 'bg-green-500'
                          : completedSteps.includes(step) || step === currentStep
                          ? 'bg-brand-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 현재 단계 설명 */}
      <div className="mt-4 text-center">
        <p className="text-gray-600 text-sm">
          {STEP_CONFIG[currentStep].description}
        </p>
      </div>
    </nav>
  );
}