'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { FormContainer } from '@/widgets/story-form';
import { useStoryGenerator } from '@/features';
import { StoryGenerateRequest } from '@/entities/story';

/**
 * 스토리 생성 페이지 컴포넌트
 *
 * FSD 아키텍처:
 * - page-components: 페이지별 컴포넌트 조립 및 비즈니스 로직 연결
 * - widgets/story-form의 FormContainer와 features/story-generator 훅 연동
 * - API 호출과 상태 관리를 통한 완전한 스토리 생성 워크플로우 제공
 *
 * 기능:
 * - 4단계 폼을 통한 스토리 생성 요청 수집
 * - Redux를 통한 전역 상태 관리
 * - 생성 완료 후 콘텐츠 페이지로 자동 이동
 * - 에러 처리 및 로딩 상태 관리
 */
export function StoryGeneratorPage() {
  const router = useRouter();
  const {
    generateStory,
    isGenerating,
    progress,
    error,
    resetProgress
  } = useStoryGenerator();

  const handleSubmit = useCallback(async (formData: {
    purpose: string;
    target: string;
    message: string;
    tone: string;
  }) => {
    try {
      // 폼 데이터를 StoryGenerateRequest 형식으로 변환
      const request: StoryGenerateRequest = {
        genre: 'drama', // 기본값, 실제로는 폼에서 받아야 함
        tone: formData.tone,
        theme: formData.purpose,
        message: formData.message,
        keywords: [] // 기본값, 실제로는 폼에서 받아야 함
      };

      // 진행도 초기화
      resetProgress();

      // 스토리 생성 API 호출
      const result = await generateStory(request);

      if (result) {
        console.log('스토리 생성 완료:', result);
        // 생성 완료 후 콘텐츠 페이지로 이동
        router.push('/contents');
      }
    } catch (error) {
      console.error('스토리 생성 오류:', error);
      // 에러는 Redux state를 통해 FormContainer에서 표시됨
    }
  }, [generateStory, resetProgress, router]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="container mx-auto px-4 py-12">
        {/* 페이지 헤더 */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">AI 스토리 생성</span>
          </h1>
          <p className="text-gray-400 text-lg">
            간단한 4단계로 AI 영상 스토리를 만들어보세요
          </p>

          {/* 로딩 상태 표시 */}
          {isGenerating && (
            <div className="mt-6 p-4 bg-white-5 border border-neon-green rounded-lg">
              <div className="flex items-center justify-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-neon-green"></div>
                <span className="text-neon-green">AI가 스토리를 생성하는 중... {progress}%</span>
              </div>
              <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-neon-green h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 에러 상태 표시 */}
          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400">⚠️ {error}</p>
            </div>
          )}
        </div>

        {/* 폼 컨테이너 */}
        <div className="max-w-4xl mx-auto">
          <FormContainer
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}