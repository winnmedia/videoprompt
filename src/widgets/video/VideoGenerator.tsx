/**
 * 영상 생성기 위젯
 * UserJourneyMap 15-16단계 - 프롬프트 기반 AI 영상 생성
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { PromptEngineering, AIVideoModel } from '../../entities/prompt';
import type { VideoGenerationSettings } from '../../entities/video';
import { useVideoGeneration } from '../../features/video-generation/use-video-generation';

interface VideoGeneratorProps {
  prompts: PromptEngineering[];
  userId: string;
  onVideoGenerated: (jobId: string) => void;
  className?: string;
}

interface GenerationState {
  selectedPromptId: string;
  selectedModel: AIVideoModel;
  settings: VideoGenerationSettings;
  showAdvancedSettings: boolean;
}

export function VideoGenerator({
  prompts,
  userId,
  onVideoGenerated,
  className = '',
}: VideoGeneratorProps) {
  const {
    generateVideo,
    isGenerating,
    error,
    clearError,
    jobs,
  } = useVideoGeneration(userId);

  const [state, setState] = useState<GenerationState>({
    selectedPromptId: prompts[0]?.id || '',
    selectedModel: 'runway-gen3',
    settings: {
      quality: '1080p',
      format: 'mp4',
      aspectRatio: '16:9',
      fps: 24,
      duration: 5,
      modelSpecificSettings: {},
      enableUpscaling: false,
      enableStabilization: true,
      enableNoiseReduction: true,
      includeWatermark: false,
      outputDescription: '',
    },
    showAdvancedSettings: false,
  });

  const selectedPrompt = prompts.find(p => p.id === state.selectedPromptId);
  const modelOptimization = selectedPrompt?.modelOptimizations[state.selectedModel];

  // 예상 비용 계산
  const estimatedCost = useMemo(() => {
    if (!modelOptimization) return 0;
    return modelOptimization.estimatedCost;
  }, [modelOptimization]);

  /**
   * 영상 생성 실행
   */
  const handleGenerateVideo = useCallback(async () => {
    if (!selectedPrompt || !modelOptimization) {
      alert('프롬프트를 선택해주세요.');
      return;
    }

    try {
      const job = await generateVideo(
        selectedPrompt,
        selectedPrompt.sourceStoryboard,
        state.selectedModel,
        state.settings
      );

      onVideoGenerated(job.id);
    } catch (error) {
      console.error('영상 생성 실패:', error);
    }
  }, [
    selectedPrompt,
    modelOptimization,
    state.selectedModel,
    state.settings,
    generateVideo,
    onVideoGenerated,
  ]);

  /**
   * 설정 업데이트
   */
  const updateSettings = useCallback((updates: Partial<VideoGenerationSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  if (prompts.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <p>생성된 프롬프트가 없습니다.</p>
          <p className="text-sm">먼저 프롬프트를 생성해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          AI 영상 생성
        </h2>
        <div className="text-sm text-gray-500">
          {prompts.length}개 프롬프트 사용 가능
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-700">{error}</p>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 프롬프트 선택 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            프롬프트 선택
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                isSelected={state.selectedPromptId === prompt.id}
                onSelect={() => setState(prev => ({ ...prev, selectedPromptId: prompt.id }))}
              />
            ))}
          </div>
        </div>

        {/* 생성 설정 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            생성 설정
          </h3>

          {/* AI 모델 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 모델
            </label>
            <select
              value={state.selectedModel}
              onChange={(e) => setState(prev => ({
                ...prev,
                selectedModel: e.target.value as AIVideoModel
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {selectedPrompt && Object.keys(selectedPrompt.modelOptimizations).map((model) => (
                <option key={model} value={model}>
                  {getModelDisplayName(model as AIVideoModel)}
                </option>
              ))}
            </select>
          </div>

          {/* 기본 설정 */}
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  품질
                </label>
                <select
                  value={state.settings.quality}
                  onChange={(e) => updateSettings({ quality: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                  <option value="4K">4K</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  화면비
                </label>
                <select
                  value={state.settings.aspectRatio}
                  onChange={(e) => updateSettings({ aspectRatio: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="16:9">16:9 (가로)</option>
                  <option value="9:16">9:16 (세로)</option>
                  <option value="1:1">1:1 (정사각)</option>
                  <option value="4:3">4:3 (클래식)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FPS
                </label>
                <select
                  value={state.settings.fps}
                  onChange={(e) => updateSettings({ fps: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시간 (초)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={state.settings.duration}
                  onChange={(e) => updateSettings({ duration: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 고급 설정 토글 */}
          <button
            onClick={() => setState(prev => ({
              ...prev,
              showAdvancedSettings: !prev.showAdvancedSettings
            }))}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 mb-4"
          >
            <span>고급 설정</span>
            <svg
              className={`w-4 h-4 transform transition-transform ${
                state.showAdvancedSettings ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 고급 설정 */}
          {state.showAdvancedSettings && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg mb-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={state.settings.enableUpscaling}
                    onChange={(e) => updateSettings({ enableUpscaling: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">업스케일링 활성화</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={state.settings.enableStabilization}
                    onChange={(e) => updateSettings({ enableStabilization: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">영상 안정화</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={state.settings.enableNoiseReduction}
                    onChange={(e) => updateSettings({ enableNoiseReduction: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">노이즈 감소</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  출력 설명 (선택사항)
                </label>
                <input
                  type="text"
                  value={state.settings.outputDescription}
                  onChange={(e) => updateSettings({ outputDescription: e.target.value })}
                  placeholder="영상에 대한 설명을 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* 프롬프트 미리보기 */}
          {modelOptimization && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">사용될 프롬프트</h4>
              <p className="text-sm text-gray-700 mb-2">
                {modelOptimization.prompt}
              </p>
              {modelOptimization.negativePrompt && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">네거티브: </span>
                  <span className="text-xs text-gray-600">
                    {modelOptimization.negativePrompt}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 text-sm">
                <span className="text-gray-600">품질 예측: {modelOptimization.qualityPrediction.overallScore}/100</span>
                <span className="text-gray-600">토큰: {modelOptimization.tokenCount}</span>
              </div>
            </div>
          )}

          {/* 비용 및 생성 버튼 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <span>예상 비용: </span>
              <span className="font-semibold text-gray-900">
                ${estimatedCost.toFixed(3)}
              </span>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={!selectedPrompt || !modelOptimization || isGenerating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isGenerating ? '생성 중...' : '영상 생성'}
            </button>
          </div>
        </div>
      </div>

      {/* 최근 생성 작업 */}
      {jobs.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            최근 생성 작업
          </h3>
          <div className="space-y-2">
            {jobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Shot #{job.promptEngineering.sourceShot.globalOrder}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {job.selectedModel}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    job.status === 'completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {getStatusText(job.status)}
                  </span>
                  {job.status === 'processing' && (
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full"
                        style={{ width: `${job.progress.percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 프롬프트 카드 컴포넌트
 */
interface PromptCardProps {
  prompt: PromptEngineering;
  isSelected: boolean;
  onSelect: () => void;
}

function PromptCard({ prompt, isSelected, onSelect }: PromptCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className={`w-4 h-4 rounded-full mt-1 ${
          isSelected ? 'bg-blue-600' : 'bg-gray-300'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              Shot #{prompt.sourceShot.globalOrder}
            </span>
            <span className="text-xs text-gray-500">
              {prompt.sourceShot.actType}
            </span>
            <div className={`w-2 h-2 rounded-full ${
              prompt.qualityScore >= 80 ? 'bg-green-500' :
              prompt.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </div>

          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {prompt.sourceShot.title}
          </p>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {Object.keys(prompt.modelOptimizations).length}개 모델
            </span>
            <span>
              품질: {prompt.qualityScore}/100
            </span>
          </div>
        </div>

        {/* 스토리보드 썸네일 */}
        {prompt.sourceStoryboard.imageUrl && (
          <img
            src={prompt.sourceStoryboard.imageUrl}
            alt={`Shot ${prompt.sourceShot.globalOrder} storyboard`}
            className="w-16 h-12 object-cover rounded"
          />
        )}
      </div>
    </div>
  );
}

// 유틸리티 함수들
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

function getStatusText(status: string): string {
  const statusMap = {
    'queued': '대기 중',
    'processing': '생성 중',
    'completed': '완료',
    'failed': '실패',
    'cancelled': '취소됨',
    'timeout': '시간 초과',
  };
  return statusMap[status as keyof typeof statusMap] || status;
}

export default VideoGenerator;