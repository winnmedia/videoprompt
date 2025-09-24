/**
 * 영상 생성 진행률 및 결과 위젯
 * UserJourneyMap 17단계 - 생성 진행률 추적, 결과 확인, 피드백 제공
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { VideoGenerationJob, VideoFeedback } from '../../entities/video';
import type { AIVideoModel } from '../../entities/prompt';
import { useVideoGeneration } from '../../features/video-generation/use-video-generation';

interface VideoProgressProps {
  userId: string;
  jobIds?: string[];
  onRegenerateRequest: (jobId: string, newSettings?: any) => void;
  className?: string;
}

interface ProgressState {
  selectedJobId: string;
  showFeedbackModal: boolean;
  feedbackType: 'quality' | 'regenerate' | 'report';
  playbackSettings: {
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
  };
}

export function VideoProgress({
  userId,
  jobIds = [],
  onRegenerateRequest,
  className = '',
}: VideoProgressProps) {
  const {
    jobs,
    getJobById,
    submitFeedback,
    regenerateVideo,
    cancelJob,
    subscribeToProgress,
    unsubscribeFromProgress,
  } = useVideoGeneration(userId);

  const [state, setState] = useState<ProgressState>({
    selectedJobId: '',
    showFeedbackModal: false,
    feedbackType: 'quality',
    playbackSettings: {
      autoplay: false,
      loop: true,
      muted: true,
    },
  });

  // 표시할 작업들 필터링
  const displayJobs = useMemo(() => {
    const allJobs = jobIds.length > 0
      ? jobs.filter(job => jobIds.includes(job.id))
      : jobs;

    return allJobs.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [jobs, jobIds]);

  const selectedJob = displayJobs.find(job => job.id === state.selectedJobId) || displayJobs[0];

  // 진행 중인 작업들
  const activeJobs = displayJobs.filter(job =>
    job.status === 'queued' || job.status === 'processing'
  );

  // 완료된 작업들
  const completedJobs = displayJobs.filter(job =>
    job.status === 'completed'
  );

  // 전체 진행률 계산
  const overallProgress = useMemo(() => {
    if (displayJobs.length === 0) return 0;

    const totalProgress = displayJobs.reduce((sum, job) => {
      return sum + (job.status === 'completed' ? 100 : job.progress.percentage);
    }, 0);

    return Math.round(totalProgress / displayJobs.length);
  }, [displayJobs]);

  // 실시간 진행률 구독
  useEffect(() => {
    activeJobs.forEach(job => {
      subscribeToProgress(job.id);
    });

    return () => {
      activeJobs.forEach(job => {
        unsubscribeFromProgress(job.id);
      });
    };
  }, [activeJobs, subscribeToProgress, unsubscribeFromProgress]);

  /**
   * 피드백 제출
   */
  const handleSubmitFeedback = useCallback(async (
    jobId: string,
    feedback: Omit<VideoFeedback, 'id' | 'timestamp' | 'userId'>
  ) => {
    try {
      await submitFeedback(jobId, feedback);
      setState(prev => ({ ...prev, showFeedbackModal: false }));
    } catch (error) {
      console.error('피드백 제출 실패:', error);
    }
  }, [submitFeedback]);

  /**
   * 재생성 요청
   */
  const handleRegenerateVideo = useCallback(async (jobId: string) => {
    try {
      const job = getJobById(jobId);
      if (!job) return;

      // TODO: regenerateVideo 함수 시그니처 확인 필요 - string jobId, provider, config 필요
      await regenerateVideo(jobId, 'default-provider', {});
      onRegenerateRequest(jobId);
    } catch (error) {
      console.error('재생성 실패:', error);
    }
  }, [getJobById, regenerateVideo, onRegenerateRequest]);

  if (displayJobs.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p>생성 중인 영상이 없습니다.</p>
          <p className="text-sm">영상 생성을 시작해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg ${className}`}>
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            영상 생성 진행률
          </h2>
          <div className="text-sm text-gray-500">
            {displayJobs.length}개 작업 • {completedJobs.length}개 완료
          </div>
        </div>

        {/* 전체 진행률 */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">전체 진행률</span>
              <span className="text-sm text-gray-600">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {activeJobs.length > 0 && (
            <div className="text-sm text-blue-600 font-medium">
              {activeJobs.length}개 생성 중
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* 작업 목록 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            생성 작업 목록
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {displayJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isSelected={selectedJob?.id === job.id}
                onSelect={() => setState(prev => ({ ...prev, selectedJobId: job.id }))}
                onCancel={() => cancelJob(job.id)}
                onRegenerate={() => handleRegenerateVideo(job.id)}
                onFeedback={() => setState(prev => ({
                  ...prev,
                  selectedJobId: job.id,
                  showFeedbackModal: true,
                  feedbackType: 'quality'
                }))}
              />
            ))}
          </div>
        </div>

        {/* 선택된 작업 상세 */}
        {selectedJob && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              작업 상세 정보
            </h3>

            <JobDetails
              job={selectedJob}
              playbackSettings={state.playbackSettings}
              onPlaybackSettingsChange={(settings) =>
                setState(prev => ({
                  ...prev,
                  playbackSettings: { ...prev.playbackSettings, ...settings }
                }))
              }
              onRegenerate={() => handleRegenerateVideo(selectedJob.id)}
              onFeedback={() => setState(prev => ({
                ...prev,
                showFeedbackModal: true,
                feedbackType: 'quality'
              }))}
            />
          </div>
        )}
      </div>

      {/* 피드백 모달 */}
      {state.showFeedbackModal && selectedJob && (
        <FeedbackModal
          job={selectedJob}
          feedbackType={state.feedbackType}
          onSubmit={(feedback) => handleSubmitFeedback(selectedJob.id, feedback)}
          onClose={() => setState(prev => ({ ...prev, showFeedbackModal: false }))}
          onTypeChange={(type) => setState(prev => ({ ...prev, feedbackType: type }))}
        />
      )}
    </div>
  );
}

/**
 * 작업 카드 컴포넌트
 */
interface JobCardProps {
  job: VideoGenerationJob;
  isSelected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onFeedback: () => void;
}

function JobCard({
  job,
  isSelected,
  onSelect,
  onCancel,
  onRegenerate,
  onFeedback
}: JobCardProps) {
  const statusInfo = getStatusInfo(job.status);

  return (
    <div
      onClick={onSelect}
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${statusInfo.color}`} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                Shot #{job.promptEngineering.sourceShot.globalOrder}
              </span>
              <span className="text-xs text-gray-500">
                {getModelDisplayName(job.selectedModel)}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {job.promptEngineering.sourceShot.title}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            {statusInfo.text}
          </span>
        </div>
      </div>

      {/* 진행률 또는 완료 정보 */}
      {job.status === 'processing' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600">{(job.progress as any).currentPhase || '처리중'}</span>
            <span className="text-xs text-gray-600">{job.progress.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${job.progress.percentage}%` }}
            />
          </div>
          {job.progress.estimatedTimeRemaining && (
            <p className="text-xs text-gray-500 mt-1">
              남은 시간: {Math.ceil(job.progress.estimatedTimeRemaining / 60)}분
            </p>
          )}
        </div>
      )}

      {job.status === 'completed' && (job as any).videoUrl && (
        <div className="mb-3">
          <div className="aspect-video bg-gray-100 rounded overflow-hidden">
            <video
              src={(job as any).videoUrl}
              className="w-full h-full object-cover"
              muted
              controls={false}
              preload="metadata"
            />
          </div>
        </div>
      )}

      {/* 액션 버튼들 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span>${(job as any).cost?.toFixed(3) || '0.000'}</span>
          <span>•</span>
          <span>{(job as any).settings.duration}초</span>
          <span>•</span>
          <span>{(job as any).settings.quality}</span>
        </div>

        <div className="flex items-center space-x-1">
          {job.status === 'processing' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="취소"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {job.status === 'completed' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="재생성"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFeedback();
                }}
                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                title="피드백"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10 0v10a2 2 0 01-2 2H9a2 2 0 01-2-2V8m10 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 작업 상세 정보 컴포넌트
 */
interface JobDetailsProps {
  job: VideoGenerationJob;
  playbackSettings: ProgressState['playbackSettings'];
  onPlaybackSettingsChange: (settings: Partial<ProgressState['playbackSettings']>) => void;
  onRegenerate: () => void;
  onFeedback: () => void;
}

function JobDetails({
  job,
  playbackSettings,
  onPlaybackSettingsChange,
  onRegenerate,
  onFeedback
}: JobDetailsProps) {
  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">기본 정보</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">AI 모델:</span>
            <span className="ml-2 font-medium">{getModelDisplayName(job.selectedModel)}</span>
          </div>
          <div>
            <span className="text-gray-600">품질:</span>
            <span className="ml-2 font-medium">{(job as any).settings.quality}</span>
          </div>
          <div>
            <span className="text-gray-600">시간:</span>
            <span className="ml-2 font-medium">{(job as any).settings.duration}초</span>
          </div>
          <div>
            <span className="text-gray-600">FPS:</span>
            <span className="ml-2 font-medium">{(job as any).settings.fps}</span>
          </div>
          <div>
            <span className="text-gray-600">화면비:</span>
            <span className="ml-2 font-medium">{(job as any).settings.aspectRatio}</span>
          </div>
          <div>
            <span className="text-gray-600">비용:</span>
            <span className="ml-2 font-medium">${(job as any).cost?.toFixed(3) || '0.000'}</span>
          </div>
        </div>
      </div>

      {/* 비디오 플레이어 */}
      {job.status === 'completed' && (job as any).videoUrl && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">생성된 영상</h4>
            <div className="flex items-center space-x-4 text-sm">
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={playbackSettings.autoplay}
                  onChange={(e) => onPlaybackSettingsChange({ autoplay: e.target.checked })}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-600">자동재생</span>
              </label>
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={playbackSettings.loop}
                  onChange={(e) => onPlaybackSettingsChange({ loop: e.target.checked })}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-600">반복</span>
              </label>
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={playbackSettings.muted}
                  onChange={(e) => onPlaybackSettingsChange({ muted: e.target.checked })}
                  className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-600">음소거</span>
              </label>
            </div>
          </div>

          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={(job as any).videoUrl}
              className="w-full h-full"
              controls
              autoPlay={playbackSettings.autoplay}
              loop={playbackSettings.loop}
              muted={playbackSettings.muted}
              preload="metadata"
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            <a
              href={(job as any).videoUrl}
              download={`video_shot_${job.promptEngineering.sourceShot.globalOrder}.mp4`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              다운로드
            </a>

            <div className="flex items-center space-x-2">
              <button
                onClick={onRegenerate}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                재생성
              </button>
              <button
                onClick={onFeedback}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                피드백
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 진행 상태 */}
      {job.status === 'processing' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">생성 진행 중</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">{(job.progress as any).currentPhase || '처리중'}</span>
              <span className="text-sm text-blue-700">{job.progress.percentage}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${job.progress.percentage}%` }}
              />
            </div>
            {job.progress.estimatedTimeRemaining && (
              <p className="text-sm text-blue-600">
                남은 시간: 약 {Math.ceil(job.progress.estimatedTimeRemaining / 60)}분
              </p>
            )}
          </div>
        </div>
      )}

      {/* 에러 정보 */}
      {job.status === 'failed' && job.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">생성 실패</h4>
          <p className="text-sm text-red-700">{job.error.message}</p>
          {job.error.code && (
            <p className="text-xs text-red-600 mt-1">오류 코드: {job.error.code}</p>
          )}
          <button
            onClick={onRegenerate}
            className="mt-3 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 사용된 프롬프트 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">사용된 프롬프트</h4>
        <p className="text-sm text-gray-700 mb-2">
          {job.promptEngineering.modelOptimizations[job.selectedModel]?.prompt}
        </p>
        {job.promptEngineering.modelOptimizations[job.selectedModel]?.negativePrompt && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500">네거티브 프롬프트:</span>
            <p className="text-xs text-gray-600">
              {job.promptEngineering.modelOptimizations[job.selectedModel].negativePrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 피드백 모달 컴포넌트
 */
interface FeedbackModalProps {
  job: VideoGenerationJob;
  feedbackType: 'quality' | 'regenerate' | 'report';
  onSubmit: (feedback: Omit<VideoFeedback, 'id' | 'timestamp' | 'userId'>) => void;
  onClose: () => void;
  onTypeChange: (type: 'quality' | 'regenerate' | 'report') => void;
}

function FeedbackModal({
  job,
  feedbackType,
  onSubmit,
  onClose,
  onTypeChange
}: FeedbackModalProps) {
  const [formData, setFormData] = useState({
    rating: 5,
    qualityScore: 7,
    comment: '',
    tags: [] as string[],
    suggestions: '',
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const feedback = {
      type: feedbackType,
      rating: formData.rating,
      qualityScore: formData.qualityScore,
      comment: formData.comment,
      tags: formData.tags,
      suggestions: formData.suggestions,
    } as unknown as Omit<VideoFeedback, 'id' | 'timestamp' | 'userId'>;

    onSubmit(feedback);
  }, [feedbackType, formData, onSubmit]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-96 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">영상 피드백</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 피드백 타입 선택 */}
          <div className="flex space-x-2 mb-4">
            {['quality', 'regenerate', 'report'].map((type) => (
              <button
                key={type}
                onClick={() => onTypeChange(type as any)}
                className={`px-3 py-1 text-sm rounded ${
                  feedbackType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'quality' ? '품질 평가' :
                 type === 'regenerate' ? '재생성 요청' : '문제 신고'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 전체 평점 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전체 만족도 (1-10)
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={formData.rating}
                onChange={(e) => setFormData(prev => ({ ...prev, rating: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 (매우 불만)</span>
                <span className="font-medium">{formData.rating}</span>
                <span>10 (매우 만족)</span>
              </div>
            </div>

            {/* 품질 점수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                영상 품질 (1-10)
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={formData.qualityScore}
                onChange={(e) => setFormData(prev => ({ ...prev, qualityScore: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 (매우 낮음)</span>
                <span className="font-medium">{formData.qualityScore}</span>
                <span>10 (매우 높음)</span>
              </div>
            </div>

            {/* 코멘트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                세부 의견
              </label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="영상에 대한 의견을 자세히 알려주세요..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 개선 제안 */}
            {feedbackType === 'regenerate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  개선 제안
                </label>
                <textarea
                  value={formData.suggestions}
                  onChange={(e) => setFormData(prev => ({ ...prev, suggestions: e.target.value }))}
                  placeholder="어떤 부분을 개선하면 좋을지 알려주세요..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                피드백 제출
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 유틸리티 함수들
function getStatusInfo(status: string) {
  const statusMap = {
    'queued': {
      text: '대기 중',
      color: 'bg-gray-400',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
    },
    'processing': {
      text: '생성 중',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
    },
    'completed': {
      text: '완료',
      color: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
    },
    'failed': {
      text: '실패',
      color: 'bg-red-500',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
    },
    'cancelled': {
      text: '취소됨',
      color: 'bg-gray-500',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
    },
    'timeout': {
      text: '시간 초과',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
    },
  };

  return statusMap[status as keyof typeof statusMap] || statusMap.queued;
}

function getModelDisplayName(model: AIVideoModel): string {
  const names = {
    'runway-gen3': 'Runway Gen-3',
    'stable-video': 'Stable Video',
    'pika-labs': 'Pika Labs',
    'zeroscope': 'Zeroscope',
    'animatediff': 'AnimateDiff',
    'bytedance-seedream': 'ByteDance Seedream',
  };
  return names[model] || model;
}

export default VideoProgress;