'use client';

import { useState } from 'react';
import { useAppSelector } from '@/shared/hooks';
import { selectAllStories } from '@/entities/story';
import { Card, Button } from '@/shared/ui';

/**
 * 비디오 생성 페이지 컴포넌트
 *
 * FSD 아키텍처:
 * - page-components: 페이지별 컴포넌트 조립 및 비즈니스 로직 연결
 * - Redux store에서 스토리 데이터를 가져와 영상 생성 워크플로우 제공
 *
 * 기능:
 * - 생성된 스토리 목록 표시
 * - 스토리 선택 및 영상 생성 설정
 * - 영상 생성 진행도 표시
 * - 생성된 영상 다운로드 및 공유
 */
export function VideoGeneratorPage() {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [videoStyle, setVideoStyle] = useState<string>('modern');
  const [isGenerating, setIsGenerating] = useState(false);

  const stories = useAppSelector(selectAllStories);

  const handleStorySelect = (storyId: string) => {
    setSelectedStoryId(storyId);
  };

  const handleGenerateVideo = async () => {
    if (!selectedStoryId) return;

    setIsGenerating(true);

    // TODO: 실제 비디오 생성 API 호출
    try {
      console.log('비디오 생성 시작:', { storyId: selectedStoryId, style: videoStyle });
      // 시뮬레이션을 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('비디오 생성 완료');
    } catch (error) {
      console.error('비디오 생성 오류:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="container mx-auto px-4 py-12">
        {/* 페이지 헤더 */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">AI 비디오 생성</span>
          </h1>
          <p className="text-gray-400 text-lg">
            스토리를 실제 영상으로 변환합니다
          </p>
        </div>

        {stories.length === 0 ? (
          /* 스토리가 없는 경우 */
          <div className="max-w-6xl mx-auto">
            <div className="glass-card p-8">
              <div className="text-center py-16">
                <svg
                  className="w-24 h-24 mx-auto mb-6 text-purple-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-white mb-4">
                  비디오 생성 준비
                </h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  스토리를 먼저 생성한 후 비디오로 변환할 수 있습니다.
                </p>
                <Button
                  onClick={() => window.location.href = '/story-generator'}
                  variant="primary"
                  size="lg"
                >
                  스토리 생성하기
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* 스토리가 있는 경우 */
          <div className="max-w-6xl mx-auto">
            {/* 스토리 선택 섹션 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">
                1. 영상으로 만들 스토리를 선택하세요
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stories.map((story) => (
                  <Card
                    key={story.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedStoryId === story.id
                        ? 'ring-2 ring-neon-green bg-white-5'
                        : 'hover:bg-white-5'
                    }`}
                    onClick={() => handleStorySelect(story.id)}
                  >
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {story.title || '제목 없음'}
                      </h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                        {story.metadata.theme || story.summary || '내용 없음'}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>
                          {story.createdAt ? new Date(story.createdAt).toLocaleDateString() : '날짜 없음'}
                        </span>
                        <span className={`px-2 py-1 rounded-full ${
                          story.status === 'published' ? 'bg-green-500/20 text-green-400' :
                          story.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {story.status}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* 스타일 설정 섹션 */}
            {selectedStoryId && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">
                  2. 영상 스타일을 선택하세요
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'modern', name: '모던', description: '깔끔하고 현대적인 스타일' },
                    { id: 'vintage', name: '빈티지', description: '클래식하고 감성적인 스타일' },
                    { id: 'dynamic', name: '다이나믹', description: '역동적이고 에너지 넘치는 스타일' },
                    { id: 'minimal', name: '미니멀', description: '단순하고 절제된 스타일' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setVideoStyle(style.id)}
                      className={`p-4 rounded-lg border transition-all duration-200 text-left ${
                        videoStyle === style.id
                          ? 'bg-neon-purple/20 border-neon-purple text-white'
                          : 'bg-white-5 border-white-20 text-gray-300 hover:border-white-30'
                      }`}
                    >
                      <div className="font-semibold mb-1">{style.name}</div>
                      <div className="text-xs text-gray-400">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 생성 버튼 */}
            {selectedStoryId && (
              <div className="text-center">
                <Button
                  onClick={handleGenerateVideo}
                  variant="primary"
                  size="lg"
                  disabled={isGenerating}
                  className="px-12 py-4"
                >
                  {isGenerating ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>영상 생성 중...</span>
                    </div>
                  ) : (
                    '영상 생성 시작'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 프로세스 안내 */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-6 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-4">01</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              스토리 선택
            </h3>
            <p className="text-gray-400">
              생성된 스토리 중 영상으로 만들 스토리를 선택합니다
            </p>
          </div>
          <div className="glass-card p-6 text-center">
            <div className="text-3xl font-bold text-cyan-400 mb-4">02</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              스타일 설정
            </h3>
            <p className="text-gray-400">
              영상의 비주얼 스타일과 효과를 설정합니다
            </p>
          </div>
          <div className="glass-card p-6 text-center">
            <div className="text-3xl font-bold text-pink-400 mb-4">03</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              영상 생성
            </h3>
            <p className="text-gray-400">
              AI가 자동으로 영상을 생성합니다 (3-5분 소요)
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}