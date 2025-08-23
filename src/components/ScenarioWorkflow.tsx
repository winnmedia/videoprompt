'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScenarioDeveloper, ScenarioDevelopmentResult } from './ScenarioDeveloper';

interface ScenarioWorkflowProps {
  onVideoCreated?: (jobId: string) => void;
}

export function ScenarioWorkflow({ onVideoCreated }: ScenarioWorkflowProps) {
  const [developmentResult, setDevelopmentResult] = useState<ScenarioDevelopmentResult | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDevelopmentComplete = useCallback((result: ScenarioDevelopmentResult) => {
    setDevelopmentResult(result);
    setError(null);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleGenerateImage = useCallback(async () => {
    if (!developmentResult) return;

    setIsGeneratingImage(true);
    setError(null);

    try {
      const response = await fetch('/api/imagen/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: developmentResult.imagePrompt,
          size: '768x768',
          n: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`작가가 글을 쓰는 중 API 오류: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.ok && result.images && result.images.length > 0) {
        setImagePreview(result.images[0]);
      } else {
        throw new Error(result.error || '작가가 글을 쓰는 데 실패했습니다.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '작가가 글을 쓰는 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [developmentResult]);

  const handleGenerateVideo = useCallback(async () => {
    if (!developmentResult) return;

    setIsGeneratingVideo(true);
    setError(null);

    try {
      const response = await fetch('/api/seedance/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: developmentResult.seedancePrompt,
          aspect_ratio: '16:9',
          duration_seconds: 5,
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        throw new Error(`PD가 영상을 제작하는 중 API 오류: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.ok && result.jobId) {
        setVideoJobId(result.jobId);
        onVideoCreated?.(result.jobId);
      } else {
        throw new Error(result.error || 'PD가 영상을 제작하는 데 실패했습니다.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'PD가 영상을 제작하는 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingVideo(false);
    }
  }, [developmentResult, onVideoCreated]);

  const handleReset = useCallback(() => {
    setDevelopmentResult(null);
    setImagePreview(null);
    setVideoJobId(null);
    setVideoUrl(null);
    setError(null);
  }, []);

  // Seedance 상태 폴링: jobId가 있으면 /api/seedance/status/[id]를 3초 간격으로 조회
  useEffect(() => {
    if (!videoJobId) return;
    let cancelled = false;
    let timer: any;
    const poll = async () => {
      try {
        const res = await fetch(`/api/seedance/status/${encodeURIComponent(videoJobId)}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const url: string | undefined = json?.videoUrl || json?.result?.video_url;
        const status: string = json?.status || 'unknown';
        if (url && /^https?:/.test(url)) {
          setVideoUrl(url);
          return; // stop polling
        }
        if (status === 'failed') {
          setError(json?.error || 'PD가 영상 제작에 실패했습니다.');
          return; // stop
        }
        timer = setTimeout(poll, 3000);
      } catch (e) {
        if (!cancelled) timer = setTimeout(poll, 3000);
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [videoJobId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">🎬 연출가, 작가, PD의 협업 공간</h1>
      {/* 연출가의 연출 단계 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">1단계: 연출가의 연출</h2>
        <p className="text-gray-600 mb-8">
          연출가가 시나리오를 연출하고, 작가가 글을 쓰고, PD가 영상을 제작하는 완벽한 워크플로우를 경험해보세요.
        </p>
        <ScenarioDeveloper
          onDevelopmentComplete={handleDevelopmentComplete}
          onError={handleError}
        />
      </div>

      {/* 연출 중 발생한 문제 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" className="text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* 연출가의 연출 결과 */}
      {developmentResult && (
        <>
          {/* 연출가의 연출 결과 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">연출가의 연출 결과</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-blue-700 mb-2">연출가의 원본 시나리오</h4>
                <p className="text-blue-600 bg-blue-100 p-3 rounded">{developmentResult.originalPrompt}</p>
              </div>
              <div>
                <h4 className="font-medium text-blue-700 mb-2">연출가의 향상된 연출</h4>
                <p className="text-blue-600 bg-blue-100 p-3 rounded">{developmentResult.enhancedPrompt}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">작가용 글쓰기 지시</h4>
                  <p className="text-blue-600 bg-blue-100 p-3 rounded text-sm">{developmentResult.imagePrompt}</p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">PD용 영상 제작 지시</h4>
                  <p className="text-blue-600 bg-blue-100 p-3 rounded text-sm">{developmentResult.seedancePrompt}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2단계: 작가의 글쓰기 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2단계: 작가의 글쓰기</h2>
            <div className="space-y-4">
              <Button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="w-full md:w-auto"
              >
                {isGeneratingImage ? (
                  <>
                    <Icon name="spinner" className="animate-spin mr-2" />
                    작가가 글을 쓰는 중...
                  </>
                ) : (
                  <>
                    <Icon name="image" className="mr-2" />
                    작가에게 글쓰기 부탁하기
                  </>
                )}
              </Button>

              {(imagePreview || isGeneratingImage) && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">작가가 쓴 글</h4>
                  <div className="relative w-full max-w-md aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    {imagePreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="작가가 쓴 글" className="absolute inset-0 w-full h-full object-contain" />
                    )}
                    {isGeneratingImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <div className="flex flex-col items-center gap-2">
                          <Icon name="spinner" className="text-blue-600" />
                          <span className="text-blue-700 text-sm">작가가 글을 쓰는 중...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3단계: PD의 영상 제작 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3단계: PD의 영상 제작</h2>
            <div className="space-y-4">
              <Button
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className="w-full md:w-auto"
              >
                {isGeneratingVideo ? (
                  <>
                    <Icon name="spinner" className="animate-spin mr-2" />
                    PD가 영상을 제작하는 중...
                  </>
                ) : (
                  <>
                    <Icon name="video" className="mr-2" />
                    PD에게 영상 제작 부탁하기
                  </>
                )}
              </Button>

              {(isGeneratingVideo || videoJobId) && (
                <div className="space-y-3">
                  <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden">
                    {videoUrl ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={videoUrl} controls autoPlay playsInline className="absolute inset-0 w-full h-full" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {isGeneratingVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="flex flex-col items-center gap-2">
                              <Icon name="spinner" className="text-white" />
                              <span className="text-white text-sm">PD가 영상을 제작하는 중...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {videoJobId && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon name="check-circle" className="text-green-600" />
                        <span className="text-green-700">PD가 영상 제작 작업을 시작했습니다. 작업 ID: {videoJobId}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 새로운 연출 시작 */}
          <div className="flex justify-center">
            <Button onClick={handleReset} variant="outline">
              <Icon name="refresh-cw" className="mr-2" />
              새로운 연출 시작
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
