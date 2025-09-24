/**
 * Shots Page
 * 12단계 숏트 생성 및 관리 페이지
 * UserJourneyMap 7-10단계 구현 (데모 버전)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { generateTwelveShots, type TwelveShot, type ShotBreakdownParams } from '@/entities/shot';
import type { FourActStory } from '@/entities/story';
import { PromptGenerator } from '@/widgets/prompt';
import type { PromptEngineering } from '@/entities/prompt';

export default function ShotsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loginAsGuest } = useAuth();

  const [currentStory, setCurrentStory] = useState<FourActStory | null>(null);
  const [shots, setShots] = useState<TwelveShot[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerationPanel, setShowGenerationPanel] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  // 프롬프트 생성 관련 상태
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptEngineering[]>([]);

  // 인증 및 초기 설정
  useEffect(() => {
    if (!isAuthenticated) {
      loginAsGuest().catch(console.error);
    }

    // URL에서 스토리 데이터 확인
    const storyData = searchParams.get('story');
    if (storyData) {
      try {
        const parsedStory = JSON.parse(decodeURIComponent(storyData));
        setCurrentStory(parsedStory);
      } catch (error) {
        console.error('스토리 데이터 파싱 실패:', error);
        router.push('/story-generator');
      }
    } else {
      // 스토리 데이터가 없으면 스토리 생성 페이지로
      router.push('/story-generator');
    }
  }, [isAuthenticated, searchParams]); // $300 사건 방지: 함수를 의존성 배열에서 제거

  // 12단계 숏트 생성 핸들러
  const handleGenerateShots = useCallback(async () => {
    if (!currentStory || !user) return;

    setIsGenerating(true);
    setError(null);

    try {
      // 스토리에서 Act 데이터 추출
      const params: ShotBreakdownParams = {
        storyId: currentStory.id,
        acts: {
          setup: {
            content: currentStory.acts.setup.content,
            duration: currentStory.acts.setup.duration,
          },
          development: {
            content: currentStory.acts.development.content,
            duration: currentStory.acts.development.duration,
          },
          climax: {
            content: currentStory.acts.climax.content,
            duration: currentStory.acts.climax.duration,
          },
          resolution: {
            content: currentStory.acts.resolution.content,
            duration: currentStory.acts.resolution.duration,
          },
        },
        pacing: currentStory.generationParams?.pacing || 'medium',
        style: currentStory.genre,
        targetDuration: currentStory.totalDuration,
      };

      // 12단계 숏트 생성
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 시뮬레이션
      const generatedShots = generateTwelveShots(params);

      setShots(generatedShots);
      setShowGenerationPanel(false);

    } catch (err) {
      console.error('숏트 생성 실패:', err);
      setError(err instanceof Error ? err.message : '숏트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [currentStory, user]);

  // 콘티 생성 핸들러 (개별)
  const handleGenerateStoryboard = useCallback(async (shotId: string) => {
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;

    const updatedShots = shots.map(s =>
      s.id === shotId
        ? { ...s, storyboard: { ...s.storyboard, status: 'generating' as const } }
        : s
    );
    setShots(updatedShots);

    // 시뮬레이션: 3초 후 완료
    setTimeout(() => {
      setShots(prev => prev.map(s =>
        s.id === shotId
          ? {
              ...s,
              storyboard: {
                status: 'completed' as const,
                imageUrl: `https://picsum.photos/400/300?random=${shotId}`,
                prompt: `${shot.title}: ${shot.description}`,
                generatedAt: new Date().toISOString()
              }
            }
          : s
      ));
    }, 3000);
  }, [shots]);

  // 모든 콘티 일괄 생성
  const handleGenerateAllStoryboards = useCallback(async () => {
    if (shots.length === 0) return;

    const updatedShots = shots.map(s => ({
      ...s,
      storyboard: { ...s.storyboard, status: 'generating' as const }
    }));
    setShots(updatedShots);

    // 시뮬레이션: 각 숏트마다 1초씩 순차적으로 생성
    for (let i = 0; i < shots.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setShots(prev => prev.map((s, index) =>
        index === i
          ? {
              ...s,
              storyboard: {
                status: 'completed' as const,
                imageUrl: `https://picsum.photos/400/300?random=${s.id}`,
                prompt: `${s.title}: ${s.description}`,
                generatedAt: new Date().toISOString()
              }
            }
          : s
      ));
    }
  }, [shots]);

  // 숏트 선택/해제 핸들러
  const toggleShotSelection = useCallback((shotId: string) => {
    setSelectedShotIds(prev =>
      prev.includes(shotId)
        ? prev.filter(id => id !== shotId)
        : [...prev, shotId]
    );
  }, []);

  // 전체 선택/해제
  const toggleSelectAll = useCallback(() => {
    const completedShots = shots.filter(shot => shot.storyboard.status === 'completed');
    if (selectedShotIds.length === completedShots.length) {
      setSelectedShotIds([]);
    } else {
      setSelectedShotIds(completedShots.map(shot => shot.id));
    }
  }, [shots, selectedShotIds.length]);

  // 프롬프트 생성 핸들러
  const handlePromptGeneration = useCallback((prompts: PromptEngineering[]) => {
    setGeneratedPrompts(prompts);
    setShowPromptGenerator(false);
  }, []);

  // 완성도 계산
  const completionPercentage = shots.length === 0 ? 0 :
    Math.round((shots.filter(s => s.storyboard.status === 'completed').length / shots.length) * 100);

  // 완성된 숏트 개수
  const completedShots = shots.filter(shot => shot.storyboard.status === 'completed');

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <div className="text-center">
            <div className="text-red-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setError(null)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                다시 시도
              </button>
              <button
                onClick={() => router.push('/story-generator')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                스토리로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="이전 페이지로 돌아가기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">12단계 숏트</h1>
                {currentStory && (
                  <p className="text-sm text-gray-500">"{currentStory.title}" 기반</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 완성도 표시 */}
              {shots.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>완성도:</span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <span className="font-medium">{completionPercentage}%</span>
                </div>
              )}

              {/* 액션 버튼들 */}
              {shots.length > 0 ? (
                <div className="flex items-center gap-2">
                  {completedShots.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md">
                        <input
                          type="checkbox"
                          checked={selectedShotIds.length === completedShots.length && completedShots.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-600">
                          {selectedShotIds.length}개 선택
                        </span>
                      </div>

                      {selectedShotIds.length > 0 && (
                        <button
                          onClick={() => setShowPromptGenerator(true)}
                          className="px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          프롬프트 생성 ({selectedShotIds.length}개)
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleGenerateAllStoryboards}
                    disabled={isGenerating}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    모든 콘티 생성
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGenerationPanel(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  숏트 생성하기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {shots.length > 0 ? (
          /* 숏트 그리드 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {shots.map((shot) => (
              <div
                key={shot.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
                  selectedShotId === shot.id ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedShotId(shot.id)}
              >
                {/* 숏트 헤더 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {shot.storyboard.status === 'completed' && (
                        <input
                          type="checkbox"
                          checked={selectedShotIds.includes(shot.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleShotSelection(shot.id);
                          }}
                          className="rounded border-gray-300"
                        />
                      )}
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {shot.globalOrder}
                      </span>
                      <h3 className="text-sm font-medium text-gray-900">{shot.title}</h3>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      shot.actType === 'setup' ? 'bg-green-100 text-green-800' :
                      shot.actType === 'development' ? 'bg-yellow-100 text-yellow-800' :
                      shot.actType === 'climax' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {shot.actType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {shot.shotType} · {shot.cameraAngle} · {shot.duration}초
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-2">{shot.description}</p>
                </div>

                {/* 콘티 영역 */}
                <div className="aspect-video bg-gray-100 relative">
                  {shot.storyboard.status === 'completed' && shot.storyboard.imageUrl ? (
                    <img
                      src={shot.storyboard.imageUrl}
                      alt={`${shot.title} 콘티`}
                      className="w-full h-full object-cover rounded-b-lg"
                    />
                  ) : shot.storyboard.status === 'generating' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-600">콘티 생성 중...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateStoryboard(shot.id);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        콘티 생성
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 숏트 생성 안내 */
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              아직 숏트가 생성되지 않았습니다
            </h3>
            <p className="text-gray-500 mb-4">
              4단계 스토리를 12개의 영화적 숏트로 분할해보세요.
            </p>
            <button
              onClick={handleGenerateShots}
              disabled={isGenerating}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  12단계 숏트 생성 중...
                </div>
              ) : (
                '12단계 숏트 생성하기'
              )}
            </button>
          </div>
        )}
      </div>

      {/* 로딩 오버레이 */}
      {isGenerating && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                12단계 숏트 생성 중...
              </h3>
              <p className="text-sm text-gray-600">
                4단계 스토리를 12개의 영화적 숏트로 분할하고 있습니다.<br/>
                잠시만 기다려주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 프롬프트 생성기 */}
      {showPromptGenerator && currentStory && (
        <PromptGenerator
          shots={shots}
          story={currentStory}
          selectedShotIds={selectedShotIds}
          onPromptsGenerated={handlePromptGeneration}
          onClose={() => setShowPromptGenerator(false)}
        />
      )}
    </div>
  );
}