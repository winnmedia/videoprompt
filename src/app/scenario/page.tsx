'use client';

/**
 * 시나리오 생성 페이지
 * UserJourneyMap 3-4단계 완전 구현
 * 제목, 내용, 드롭다운 요소, 전개방식, 강도 선택
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ScenarioForm } from '@/widgets/scenario';
import { useScenarioGeneration } from '@/features/scenario.feature';
import { useAuth } from '@/features/auth';
import type {
  ScenarioGenerationRequest,
  ScenarioGenerationResponse,
} from '@/entities/scenario';

export default function ScenarioPage() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScenario, setGeneratedScenario] = useState<ScenarioGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { generateScenario } = useScenarioGeneration();
  const { user, isAuthenticated, loginAsGuest } = useAuth();

  // 시나리오 생성 핸들러
  const handleScenarioGeneration = useCallback(async (request: ScenarioGenerationRequest) => {
    // 인증되지 않은 사용자는 게스트 로그인을 먼저 진행
    if (!isAuthenticated || !user) {
      try {
        await loginAsGuest();
      } catch (error) {
        setError('게스트 로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedScenario(null);

    try {
      const userId = user?.id || 'guest_fallback';
      const response = await generateScenario(request, userId);
      setGeneratedScenario(response);
    } catch (err) {
      console.error('시나리오 생성 실패:', err);
      setError(err instanceof Error ? err.message : '시나리오 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, [generateScenario, isAuthenticated, user]); // $300 사건 방지: loginAsGuest 함수를 의존성 배열에서 제거

  // 새 시나리오 생성
  const handleNewScenario = useCallback(() => {
    setGeneratedScenario(null);
    setError(null);
  }, []);

  // 시나리오 재생성
  const handleRegenerate = useCallback(async () => {
    if (!generatedScenario) return;

    const originalRequest: ScenarioGenerationRequest = {
      title: generatedScenario.scenario.title,
      content: generatedScenario.scenario.content,
      genre: generatedScenario.scenario.metadata.genre,
      style: generatedScenario.scenario.metadata.style,
      target: generatedScenario.scenario.metadata.target,
      structure: generatedScenario.scenario.metadata.structure,
      intensity: generatedScenario.scenario.metadata.intensity,
    };

    await handleScenarioGeneration(originalRequest);
  }, [generatedScenario]); // $300 사건 방지: handleScenarioGeneration 함수를 의존성 배열에서 제거

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 페이지 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                시나리오 생성
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                AI를 활용하여 창의적이고 매력적인 시나리오를 생성해보세요
              </p>
            </div>
            {generatedScenario && (
              <button
                onClick={handleNewScenario}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                새 시나리오 만들기
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 시나리오 생성 폼 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  시나리오 정보 입력
                </h2>
                <p className="text-sm text-gray-600">
                  아래 정보를 입력하여 맞춤형 시나리오를 생성하세요
                </p>
              </div>

              <ScenarioForm
                onSubmit={handleScenarioGeneration}
                isLoading={isGenerating}
                className="space-y-6"
              />
            </div>
          </div>

          {/* 결과 영역 */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {/* 로딩 상태 */}
              {isGenerating && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      시나리오 생성 중...
                    </h3>
                    <p className="text-sm text-gray-600">
                      AI가 당신의 아이디어를 바탕으로 시나리오를 작성하고 있습니다.
                      잠시만 기다려주세요.
                    </p>
                  </div>
                </div>
              )}

              {/* 에러 상태 */}
              {error && !isGenerating && (
                <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="ml-3 text-lg font-medium text-red-800">
                      생성 실패
                    </h3>
                  </div>
                  <p className="text-sm text-red-700 mb-4">
                    {error}
                  </p>
                  <button
                    onClick={() => setError(null)}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {/* 생성된 시나리오 */}
              {generatedScenario && !isGenerating && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                  {/* 시나리오 헤더 */}
                  <div className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {generatedScenario.scenario.title}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          품질: {generatedScenario.scenario.metadata.qualityScore}점
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {generatedScenario.scenario.metadata.estimatedDuration}분
                        </span>
                      </div>
                    </div>

                    {/* 메타데이터 */}
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">장르:</span> {generatedScenario.scenario.metadata.genre}
                      </div>
                      <div>
                        <span className="font-medium">구조:</span> {generatedScenario.scenario.metadata.structure}
                      </div>
                      <div>
                        <span className="font-medium">스타일:</span> {generatedScenario.scenario.metadata.style}
                      </div>
                      <div>
                        <span className="font-medium">강도:</span> {generatedScenario.scenario.metadata.intensity}
                      </div>
                    </div>
                  </div>

                  {/* 시나리오 내용 */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-3">
                      시나리오 내용
                    </h4>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {generatedScenario.scenario.content}
                      </div>
                    </div>
                  </div>

                  {/* 피드백 */}
                  {generatedScenario.feedback.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3">
                        AI 피드백
                      </h4>
                      <ul className="space-y-2">
                        {generatedScenario.feedback.map((feedback, index) => (
                          <li key={index} className="flex items-start">
                            <svg className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-700">{feedback}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 개선 제안 */}
                  {generatedScenario.suggestions.length > 0 && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-3">
                        개선 제안
                      </h4>
                      <ul className="space-y-2">
                        {generatedScenario.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start">
                            <svg className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-700">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex space-x-3">
                      <button
                        onClick={handleRegenerate}
                        disabled={isGenerating}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        재생성
                      </button>
                      <button
                        onClick={() => {
                          // TODO: 시나리오 저장 로직
                          alert('시나리오가 저장되었습니다.');
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        저장하기
                      </button>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          // 시나리오 데이터와 함께 스토리 생성 페이지로 이동
                          const storyParams = {
                            title: generatedScenario.scenario.title,
                            synopsis: generatedScenario.scenario.content.slice(0, 500),
                            genre: generatedScenario.scenario.metadata.genre === 'drama' ? 'drama' :
                                   generatedScenario.scenario.metadata.genre === 'comedy' ? 'comedy' :
                                   generatedScenario.scenario.metadata.genre === 'thriller' ? 'thriller' :
                                   generatedScenario.scenario.metadata.genre === 'horror' ? 'thriller' :
                                   generatedScenario.scenario.metadata.genre === 'romance' ? 'romance' : 'drama',
                            targetAudience: generatedScenario.scenario.metadata.target === 'children' ? 'kids' :
                                          generatedScenario.scenario.metadata.target === 'teens' ? 'teen' :
                                          generatedScenario.scenario.metadata.target === 'adults' ? 'adult' :
                                          generatedScenario.scenario.metadata.target === 'seniors' ? 'senior' : 'general',
                            tone: generatedScenario.scenario.metadata.style === 'dramatic' ? 'dramatic' :
                                  generatedScenario.scenario.metadata.style === 'comedic' ? 'humorous' :
                                  generatedScenario.scenario.metadata.style === 'realistic' ? 'serious' : 'serious',
                            creativity: 70,
                            intensity: generatedScenario.scenario.metadata.intensity === 'high' ? 80 :
                                     generatedScenario.scenario.metadata.intensity === 'medium' ? 60 : 40,
                            pacing: 'medium'
                          };

                          const queryParams = new URLSearchParams({
                            'from-scenario': 'true',
                            'scenario-data': JSON.stringify(storyParams)
                          });

                          router.push(`/story-generator?${queryParams.toString()}`);
                        }}
                        className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        4단계 스토리로 변환
                      </button>
                    </div>
                  </div>

                  {/* 비용 정보 */}
                  <div className="bg-gray-50 rounded-md p-3">
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>생성 비용: ${generatedScenario.scenario.metadata.cost.toFixed(4)}</span>
                      <span>토큰 사용량: {generatedScenario.scenario.metadata.tokens}</span>
                      <span>생성 시간: {new Date(generatedScenario.scenario.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 초기 안내 */}
              {!generatedScenario && !isGenerating && !error && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      시나리오 생성 준비
                    </h3>
                    <p className="text-sm text-gray-600">
                      왼쪽 폼을 작성하여 AI 기반 시나리오 생성을 시작하세요.
                      당신의 아이디어가 완성된 시나리오로 탄생합니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}