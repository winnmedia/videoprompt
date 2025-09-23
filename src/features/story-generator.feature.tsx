/**
 * Story Generator Feature - 완전 통합 버전
 */

import React, { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import {
  Story,
  StoryGenerateRequest,
  StoryGenerateResponse,
  StoryGenre,
  selectStories,
  selectCurrentStory,
  selectGenerateStatus,
  selectGenerateProgress,
  selectStoryError,
  startGenerateStory,
  generateStorySuccess,
  generateStoryFailure,
  setGenerateProgress,
  resetProgress,
  addStory,
} from '@/entities/story';

// ===== API =====
export class StoryGeneratorApi {
  private static baseUrl = '/api/story';

  static async generateStory(request: StoryGenerateRequest): Promise<StoryGenerateResponse> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'generate', ...request }),
    });

    if (!response.ok) {
      throw new Error('스토리 생성 실패');
    }

    const data = await response.json();
    return data.story;
  }
}

// ===== HOOKS =====
export function useStoryGenerator() {
  const dispatch = useAppDispatch();

  const stories = useAppSelector(selectStories);
  const currentStory = useAppSelector(selectCurrentStory);
  const generateStatus = useAppSelector(selectGenerateStatus);
  const progress = useAppSelector(selectGenerateProgress);
  const error = useAppSelector(selectStoryError);

  const generateStory = useCallback(async (request: StoryGenerateRequest) => {
    try {
      dispatch(startGenerateStory());

      // 진행률 시뮬레이션
      const progressSteps = [0, 25, 50, 75, 100];
      let currentStep = 0;

      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length - 1) {
          currentStep++;
          dispatch(setGenerateProgress(progressSteps[currentStep]));
        }
      }, 500);

      const response = await StoryGeneratorApi.generateStory(request);

      clearInterval(progressInterval);
      dispatch(setGenerateProgress(100));

      const completedStory: Story = {
        id: `story_${Date.now()}`,
        title: response.title,
        summary: `${response.genre} 장르의 스토리`,
        genre: response.genre,
        status: 'draft',
        totalDuration: response.totalDuration,
        chapters: response.chapters,
        userId: 'default-user',
        metadata: response.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch(generateStorySuccess(completedStory));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '스토리 생성 중 오류가 발생했습니다.';
      dispatch(generateStoryFailure(errorMessage));
    }
  }, [dispatch]);

  const resetGenerateProgress = useCallback(() => {
    dispatch(resetProgress());
  }, [dispatch]);

  return {
    stories,
    currentStory,
    generateStatus,
    progress,
    error,
    generateStory,
    resetProgress: resetGenerateProgress,
    isGenerating: generateStatus === 'loading',
    canGenerate: generateStatus !== 'loading',
  };
}

// ===== COMPONENTS =====
interface StoryInputProps {
  onGenerate: (request: StoryGenerateRequest) => void;
  isLoading?: boolean;
  className?: string;
}

export const StoryInput: React.FC<StoryInputProps> = ({ onGenerate, isLoading = false, className = '' }) => {
  const [formData, setFormData] = React.useState<StoryGenerateRequest>({
    title: '',
    genre: 'drama',
    content: '',
    tone: 'neutral',
    targetDuration: 60,
    keywords: [],
  });

  const genres: { value: StoryGenre; label: string }[] = [
    { value: 'drama', label: '드라마' },
    { value: 'comedy', label: '코미디' },
    { value: 'thriller', label: '스릴러' },
    { value: 'horror', label: '호러' },
    { value: 'action', label: '액션' },
    { value: 'romance', label: '로맨스' },
    { value: 'scifi', label: 'SF' },
    { value: 'fantasy', label: '판타지' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;
    onGenerate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          스토리 제목
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="스토리 제목을 입력하세요"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
          장르
        </label>
        <select
          id="genre"
          value={formData.genre}
          onChange={(e) => setFormData({ ...formData, genre: e.target.value as StoryGenre })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          {genres.map((genre) => (
            <option key={genre.value} value={genre.value}>
              {genre.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
          스토리 개요
        </label>
        <textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="스토리의 기본 개요를 입력하세요"
          required
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.title.trim() || !formData.content.trim()}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '스토리 생성 중...' : '스토리 생성'}
      </button>
    </form>
  );
};

interface StoryOutputProps {
  story?: Story | null;
  className?: string;
}

export const StoryOutput: React.FC<StoryOutputProps> = ({ story, className = '' }) => {
  if (!story) {
    return (
      <div className={`text-center text-gray-500 ${className}`}>
        아직 생성된 스토리가 없습니다.
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">{story.title}</h2>
        <p className="text-gray-600">{story.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
            {story.genre}
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {story.metadata.tone}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            총 {story.totalDuration}초
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">4단계 구성</h3>
        <div className="space-y-4">
          {Object.entries(story.chapters).map(([chapterKey, chapter], index) => (
            <div key={chapterKey} className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="mb-2 flex items-start justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-500">{chapter.duration}초</span>
              </div>

              <h4 className="mb-2 text-sm font-semibold text-gray-900">{chapter.title}</h4>
              <p className="mb-3 text-gray-800">{chapter.content}</p>

              {chapter.thumbnailUrl && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-600">썸네일:</span>
                  <img
                    src={chapter.thumbnailUrl}
                    alt={chapter.title}
                    className="mt-1 h-20 w-32 rounded object-cover"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="mb-2 text-sm font-semibold text-gray-700">키워드</h4>
        <div className="flex flex-wrap gap-2">
          {story.metadata.keywords.map((keyword, index) => (
            <span
              key={index}
              className="rounded-full bg-white px-3 py-1 text-xs text-gray-600 shadow-sm"
            >
              {keyword}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          생성일: {new Date(story.metadata.generatedAt).toLocaleString('ko-KR')}
        </p>
      </div>
    </div>
  );
};