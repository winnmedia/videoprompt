/**
 * 파이프라인 진행 상황 추적 컴포넌트
 * FSD widgets 레이어 - 복합 UI 블록
 *
 * 기능:
 * 1. Story → Scenario → Prompt → Video 단계별 진행 상황 표시
 * 2. 현재 ProjectID 및 진행률 시각화
 * 3. 각 단계별 상태 및 에러 표시
 * 4. 단계 간 이동 및 재시작 기능
 */

import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/shared/lib/redux-hooks';
import {
  selectPipelineState,
  selectCurrentStep,
  selectPipelineProgress,
  selectPipelineErrors,
  selectProjectId,
  selectPipelineProgressPercentage
} from '@/entities/pipeline/store/pipeline-slice';

/**
 * 파이프라인 단계 정보
 */
const PIPELINE_STEPS = [
  {
    key: 'story',
    label: '스토리 생성',
    description: '4단계 스토리 구조 생성',
    icon: '📖',
    color: 'blue'
  },
  {
    key: 'scenario',
    label: '시나리오 작성',
    description: '세부 시나리오 및 연출 노트',
    icon: '🎬',
    color: 'green'
  },
  {
    key: 'prompt',
    label: '프롬프트 최적화',
    description: 'AI 영상 생성용 프롬프트',
    icon: '✨',
    color: 'purple'
  },
  {
    key: 'video',
    label: '영상 생성',
    description: 'AI 기반 영상 렌더링',
    icon: '🎥',
    color: 'red'
  }
] as const;

/**
 * 단계별 상태 표시 컴포넌트
 */
interface StepIndicatorProps {
  step: typeof PIPELINE_STEPS[number];
  isCompleted: boolean;
  isCurrent: boolean;
  hasError: boolean;
  stepId?: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  isCompleted,
  isCurrent,
  hasError,
  stepId
}) => {
  const getStepStatusClass = () => {
    if (hasError) return 'bg-red-100 border-red-300 text-red-700';
    if (isCompleted) return 'bg-green-100 border-green-300 text-green-700';
    if (isCurrent) return 'bg-blue-100 border-blue-300 text-blue-700 animate-pulse';
    return 'bg-gray-100 border-gray-300 text-gray-500';
  };

  const getStatusIcon = () => {
    if (hasError) return '❌';
    if (isCompleted) return '✅';
    if (isCurrent) return '🔄';
    return '⏳';
  };

  return (
    <div className={`relative flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-300 ${getStepStatusClass()}`}>
      {/* 단계 아이콘 */}
      <div className="text-3xl mb-2">
        {step.icon}
      </div>

      {/* 상태 아이콘 */}
      <div className="absolute top-1 right-1 text-sm">
        {getStatusIcon()}
      </div>

      {/* 단계 정보 */}
      <div className="text-center">
        <h3 className="font-semibold text-sm mb-1">
          {step.label}
        </h3>
        <p className="text-xs opacity-80">
          {step.description}
        </p>

        {/* 단계 ID 표시 (완료된 경우) */}
        {stepId && isCompleted && (
          <div className="mt-2 px-2 py-1 bg-white/50 rounded text-xs font-mono">
            ID: {stepId.slice(0, 8)}...
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 진행률 바 컴포넌트
 */
interface ProgressBarProps {
  progress: number;
  hasError: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, hasError }) => {
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${
          hasError ? 'bg-red-500' : 'bg-blue-500'
        }`}
        style={{ width: `${progress}%` }}
      >
        {/* 진행률 애니메이션 */}
        {progress > 0 && progress < 100 && (
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-full" />
        )}
      </div>
    </div>
  );
};

/**
 * 에러 표시 컴포넌트
 */
interface ErrorDisplayProps {
  errors: Array<{
    step: string;
    message: string;
    timestamp: string;
  }>;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors }) => {
  if (errors.length === 0) return null;

  return (
    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <h4 className="text-red-700 font-semibold text-sm mb-2 flex items-center">
        ⚠️ 오류 발생 ({errors.length}건)
      </h4>
      <div className="space-y-2">
        {errors.slice(-3).map((error, index) => (
          <div key={index} className="text-xs text-red-600 bg-white/50 p-2 rounded">
            <div className="font-semibold">{error.step} 단계:</div>
            <div>{error.message}</div>
            <div className="text-gray-500 mt-1">
              {new Date(error.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 프로젝트 정보 표시
 */
interface ProjectInfoProps {
  projectId: string | null;
  correlationId: string | null;
  progress: number;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({ projectId, correlationId, progress }) => {
  if (!projectId) return null;

  return (
    <div className="bg-gray-50 p-3 rounded-lg mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-gray-700">
          🗂️ 프로젝트 정보
        </h3>
        <span className="text-xs text-gray-500">
          진행률: {Math.round(progress)}%
        </span>
      </div>

      <div className="space-y-1 text-xs font-mono text-gray-600">
        <div>
          <span className="text-gray-500">Project:</span> {projectId.slice(0, 12)}...
        </div>
        {correlationId && (
          <div>
            <span className="text-gray-500">Session:</span> {correlationId.slice(-12)}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 메인 파이프라인 추적 컴포넌트
 */
export const PipelineProgressTracker: React.FC = () => {
  const pipelineState = useSelector(selectPipelineState);
  const currentStep = useSelector(selectCurrentStep);
  const progress = useSelector(selectPipelineProgress);
  const errors = useSelector(selectPipelineErrors);
  const projectId = useSelector(selectProjectId);
  const progressPercentage = useSelector(selectPipelineProgressPercentage);

  const hasErrors = errors.length > 0;

  // 프로젝트가 없으면 표시하지 않음
  if (!projectId) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="text-blue-600 mb-2">🚀</div>
        <p className="text-blue-700 text-sm">
          새 프로젝트를 시작하려면 스토리 생성을 클릭하세요
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          🎯 파이프라인 진행 상황
        </h2>
        <div className="text-sm text-gray-500">
          {currentStep} 단계
        </div>
      </div>

      {/* 프로젝트 정보 */}
      <ProjectInfo
        projectId={projectId}
        correlationId={pipelineState.correlationId}
        progress={progressPercentage}
      />

      {/* 진행률 바 */}
      <ProgressBar progress={progressPercentage} hasError={hasErrors} />

      {/* 단계별 진행 상황 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {PIPELINE_STEPS.map((step) => {
          const stepProgress = progress[step.key as keyof typeof progress];
          const stepErrors = errors.filter(error => error.step === step.key);

          return (
            <StepIndicator
              key={step.key}
              step={step}
              isCompleted={stepProgress.completed}
              isCurrent={currentStep === step.key}
              hasError={stepErrors.length > 0}
              stepId={stepProgress.id}
            />
          );
        })}
      </div>

      {/* 연결선 (데스크톱에서만 표시) */}
      <div className="hidden lg:block relative -mt-8 mb-4">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300 transform -translate-y-1/2 -z-10">
          {/* 진행된 부분은 파란색으로 표시 */}
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(progressPercentage / 100) * 75}%` }}
          />
        </div>
      </div>

      {/* 에러 표시 */}
      <ErrorDisplay errors={errors} />

      {/* 상태 정보 */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div>
          상태: {pipelineState.status === 'idle' ? '대기' :
                pipelineState.status === 'processing' ? '처리 중' :
                pipelineState.status === 'completed' ? '완료' : '실패'}
        </div>
        {pipelineState.metadata.lastUpdated && (
          <div>
            마지막 업데이트: {new Date(pipelineState.metadata.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PipelineProgressTracker;