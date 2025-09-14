"use client";
import React from 'react';
import { Container } from '@/shared/ui/Container';
import { Card } from '@/shared/ui/card';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/button';
import { Progress } from '@/shared/ui/Progress';
import { Icon } from '@/shared/ui/Icon';
import { cn } from '@/shared/lib/utils';

export interface ScenarioStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation?: (data: any) => string[] | null;
  optional?: boolean;
}

export interface ScenarioFormWizardProps {
  steps: ScenarioStep[];
  currentStep: number;
  data: Record<string, any>;
  onStepChange: (stepIndex: number) => void;
  onDataChange: (stepId: string, stepData: any) => void;
  onSubmit: (completeData: Record<string, any>) => void;
  isSubmitting?: boolean;
  className?: string;
}

export function ScenarioFormWizard({
  steps,
  currentStep,
  data,
  onStepChange,
  onDataChange,
  onSubmit,
  isSubmitting = false,
  className,
}: ScenarioFormWizardProps) {
  const currentStepData = steps[currentStep];
  const totalSteps = steps.length;
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  // 다음 단계로 갈 수 있는지 검증
  const canGoNext = React.useMemo(() => {
    if (currentStepData.optional) return true;

    const stepData = data[currentStepData.id];
    if (!stepData) return false;

    if (currentStepData.validation) {
      const errors = currentStepData.validation(stepData);
      return !errors || errors.length === 0;
    }

    return true;
  }, [currentStepData, data]);

  // 이전 단계로
  const handlePrevious = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  // 다음 단계로
  const handleNext = () => {
    if (canGoNext && currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  // 완료 처리
  const handleComplete = () => {
    if (canGoNext) {
      onSubmit(data);
    }
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentStep > 0) {
      handlePrevious();
    } else if (e.key === 'ArrowRight' && canGoNext && currentStep < totalSteps - 1) {
      handleNext();
    } else if (e.key === 'Enter' && canGoNext && currentStep === totalSteps - 1) {
      handleComplete();
    }
  };

  return (
    <Container size="lg" className={className}>
      <div className="max-w-4xl mx-auto">
        {/* 프로그레스 헤더 */}
        <div className="mb-8">
          <div className="mb-4">
            <Text variant="muted" size="sm" align="center">
              {currentStep + 1} / {totalSteps} 단계
            </Text>
            <Progress
              value={progressPercentage}
              className="mt-2"
              aria-label={`진행률: ${Math.round(progressPercentage)}%`}
            />
          </div>

          <div className="text-center">
            <Heading level="h1" align="center" className="mb-2">
              {currentStepData.title}
            </Heading>
            <Text variant="muted" size="lg" align="center">
              {currentStepData.description}
            </Text>
          </div>
        </div>

        {/* 스텝 네비게이션 (스크린 리더용) */}
        <nav aria-label="시나리오 작성 단계" className="sr-only">
          <ol>
            {steps.map((step, index) => (
              <li key={step.id}>
                <button
                  onClick={() => onStepChange(index)}
                  aria-current={index === currentStep ? 'step' : undefined}
                  disabled={index > currentStep}
                >
                  {step.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* 메인 콘텐츠 카드 */}
        <Card
          className="p-8 mb-8 min-h-96"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="main"
          aria-labelledby="step-title"
          aria-describedby="step-description"
        >
          <div id="step-title" className="sr-only">
            {currentStepData.title}
          </div>
          <div id="step-description" className="sr-only">
            {currentStepData.description}
          </div>

          {/* 동적 스텝 컴포넌트 */}
          <currentStepData.component
            data={data[currentStepData.id] || {}}
            onChange={(stepData: any) => onDataChange(currentStepData.id, stepData)}
            errors={
              currentStepData.validation
                ? currentStepData.validation(data[currentStepData.id])
                : null
            }
            isActive={true}
          />
        </Card>

        {/* 네비게이션 버튼들 */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            aria-label="이전 단계로 이동"
          >
            <Icon name="arrow-left" className="w-4 h-4 mr-2" />
            이전
          </Button>

          <div className="flex items-center gap-2">
            {/* 스텝 인디케이터 */}
            <div className="flex items-center gap-2" role="tablist" aria-label="단계 표시">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  role="tab"
                  aria-selected={index === currentStep}
                  aria-controls={`step-${index}`}
                  onClick={() => onStepChange(index)}
                  disabled={index > currentStep}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    index < currentStep
                      ? 'bg-success-500'
                      : index === currentStep
                      ? 'bg-primary-500'
                      : 'bg-secondary-300'
                  )}
                  aria-label={`${step.title} ${
                    index < currentStep
                      ? '(완료)'
                      : index === currentStep
                      ? '(현재)'
                      : '(미완료)'
                  }`}
                />
              ))}
            </div>
          </div>

          {currentStep < totalSteps - 1 ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="다음 단계로 이동"
            >
              다음
              <Icon name="arrow-right" className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              variant="success"
              size="lg"
              onClick={handleComplete}
              disabled={!canGoNext}
              loading={isSubmitting}
              aria-label="시나리오 작성 완료"
            >
              {isSubmitting ? (
                <>
                  <Icon name="loader" className="w-4 h-4 mr-2 animate-spin" />
                  처리중...
                </>
              ) : (
                <>
                  완료
                  <Icon name="check" className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* 키보드 단축키 안내 */}
        <div className="mt-6 text-center">
          <Text variant="muted" size="sm">
            키보드 단축키: ← → 화살표로 이동, Enter로 완료
          </Text>
        </div>
      </div>
    </Container>
  );
}