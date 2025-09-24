/**
 * 4단계 스토리 생성 페이지
 * UserJourneyMap 5-6단계 완전 구현
 * 시나리오에서 스토리로 변환하거나 새로운 스토리 생성
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { StoryGenerationForm, FourActStoryEditor } from '@/widgets/story-form';
import { createFourActStory, type StoryGenerationParams } from '@/entities/story';
import { type ScenarioGenerationResponse } from '@/entities/scenario';

type ViewMode = 'create' | 'edit';

export default function StoryGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, loginAsGuest } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('create');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStory, setCurrentStory] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // URL에서 시나리오 데이터 확인 (시나리오에서 변환된 경우)
  const scenarioData = searchParams.get('from-scenario');
  const scenarioParams = searchParams.get('scenario-data');

  useEffect(() => {
    // 인증되지 않은 사용자는 게스트 로그인
    if (!isAuthenticated) {
      loginAsGuest().catch(console.error);
    }
  }, [isAuthenticated]); // $300 사건 방지: loginAsGuest 함수를 의존성 배열에서 제거

  // 4단계 스토리 생성 핸들러
  const handleStoryGeneration = useCallback(async (params: StoryGenerationParams) => {
    if (!user) {
      setError('사용자 인증이 필요합니다.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 현재는 클라이언트에서 기본 구조만 생성 (Phase 8.2에서 AI 연동 완성 예정)
      const newStory = createFourActStory(params, user.id);

      // TODO: 실제 AI 생성 로직으로 대체 예정
      // 각 Act에 임시 내용 추가 (demo용)
      const enhancedStory = {
        ...newStory,
        acts: {
          setup: {
            ...newStory.acts.setup,
            content: `${params.title}의 시작입니다. ${params.synopsis.slice(0, 100)}... 주요 등장인물들이 등장하고 기본적인 설정이 이루어집니다.`,
            keyEvents: ['주인공 등장', '배경 소개', '초기 갈등 제시'],
          },
          development: {
            ...newStory.acts.development,
            content: `갈등이 점차 복잡해집니다. ${params.synopsis}의 핵심 문제들이 드러나기 시작하며, 등장인물들 사이의 관계가 깊어집니다.`,
            keyEvents: ['갈등 심화', '새로운 문제 등장', '관계 발전'],
          },
          climax: {
            ...newStory.acts.climax,
            content: `${params.title}의 절정입니다. 모든 갈등이 정점에 달하고, 주인공은 중요한 결정을 내려야 합니다.`,
            keyEvents: ['최고 긴장감', '결정적 순간', '전환점'],
          },
          resolution: {
            ...newStory.acts.resolution,
            content: `모든 갈등이 해결되고 새로운 균형이 이루어집니다. ${params.title}의 메시지가 전달되며 이야기가 마무리됩니다.`,
            keyEvents: ['갈등 해결', '결론', '여운'],
          }
        },
        status: 'inProgress' as const,
      };

      setCurrentStory(enhancedStory);
      setViewMode('edit');

    } catch (err) {
      console.error('스토리 생성 실패:', err);
      setError(err instanceof Error ? err.message : '스토리 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  // 스토리 업데이트 핸들러
  const handleStoryUpdate = useCallback((updatedStory: any) => {
    setCurrentStory(updatedStory);
  }, []);

  // 다음 단계로 진행 (12단계 숏트 생성)
  const handleNext = useCallback(() => {
    if (currentStory) {
      const storyData = encodeURIComponent(JSON.stringify(currentStory));
      router.push(`/shots?story=${storyData}`);
    }
  }, [currentStory]); // $300 사건 방지: router 함수를 의존성 배열에서 제거

  // 새 스토리 생성
  const handleNewStory = useCallback(() => {
    setCurrentStory(null);
    setViewMode('create');
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {viewMode === 'create' ? '스토리 생성' : '4단계 스토리 편집'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {viewMode === 'create'
                  ? '4단계 구조로 완성된 스토리를 만들어보세요'
                  : '기승전결 4단계 구조로 스토리를 편집하세요'
                }
              </p>
            </div>

            {viewMode === 'edit' && (
              <div className="flex space-x-3">
                <button
                  onClick={handleNewStory}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  새 스토리 만들기
                </button>
                <button
                  onClick={() => router.push('/scenario')}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  시나리오로 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'create' ? (
          // 스토리 생성 폼
          <div>
            {scenarioData && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-blue-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-blue-800">
                    시나리오에서 변환된 스토리입니다. 아래 정보를 확인하고 수정한 후 생성하세요.
                  </p>
                </div>
              </div>
            )}

            <StoryGenerationForm
              onGenerate={handleStoryGeneration}
              isGenerating={isGenerating}
              error={error}
              initialData={scenarioParams ? JSON.parse(scenarioParams) : undefined}
            />
          </div>
        ) : (
          // 4단계 스토리 편집기
          currentStory && (
            <FourActStoryEditor
              story={currentStory}
              onStoryUpdate={handleStoryUpdate}
              onNext={handleNext}
            />
          )
        )}

        {/* 로딩 상태 */}
        {isGenerating && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  4단계 스토리 생성 중...
                </h3>
                <p className="text-sm text-gray-600">
                  AI가 기승전결 구조로 스토리를 생성하고 있습니다.<br/>
                  잠시만 기다려주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 모달 */}
        {error && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  생성 실패
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}