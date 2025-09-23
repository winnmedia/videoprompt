/**
 * Generators Pages - 통합 버전
 * 스토리 생성, 프롬프트 생성, 비디오 생성 페이지 통합
 */

'use client';

import React, { useState } from 'react';
import { useStoryGenerator, StoryInput, StoryOutput } from '@/features';
import { PromptGenerator } from '@/widgets/prompt.widget';

type GeneratorMode = 'story' | 'prompt' | 'video';

export default function GeneratorsPage() {
  const [mode, setMode] = useState<GeneratorMode>('story');
  const {
    currentStory,
    isGenerating,
    generateStory,
    progress,
    error
  } = useStoryGenerator();

  // Mock data for other generators
  const [prompts] = useState([
    {
      id: '1',
      title: '오프닝 샷',
      description: '영상의 첫 번째 장면',
      duration: 10,
      promptText: ''
    }
  ]);

  const [aiModels] = useState([
    {
      id: 'claude',
      name: 'Claude',
      description: 'Anthropic의 AI 모델'
    }
  ]);

  const tabs = [
    { id: 'story', label: '스토리 생성', icon: '📖' },
    { id: 'prompt', label: '프롬프트 생성', icon: '💡' },
    { id: 'video', label: '비디오 생성', icon: '🎬' }
  ];

  const handleShotUpdate = (shotId: string, prompt: string) => {
    console.log('Shot updated:', shotId, prompt);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">AI 생성 도구</h1>
          <p className="text-gray-600">AI를 활용하여 콘텐츠를 생성하세요</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex space-x-4 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id as GeneratorMode)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {mode === 'story' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">스토리 입력</h2>
                  <StoryInput
                    onGenerate={generateStory}
                    isLoading={isGenerating}
                  />

                  {isGenerating && (
                    <div className="mt-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{progress}%</span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
                      <p className="text-red-700">{error}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-4">생성된 스토리</h2>
                  <StoryOutput story={currentStory} />
                </div>
              </div>
            </div>
          )}

          {mode === 'prompt' && (
            <div className="p-6">
              <PromptGenerator
                shots={prompts}
                aiModels={aiModels}
                onShotUpdate={handleShotUpdate}
              />
            </div>
          )}

          {mode === 'video' && (
            <div className="p-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎬</div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  비디오 생성
                </h2>
                <p className="text-gray-600 mb-6">
                  스토리보드를 기반으로 AI 비디오를 생성합니다
                </p>

                <div className="max-w-md mx-auto space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비디오 스타일
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>실사</option>
                      <option>애니메이션</option>
                      <option>일러스트</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      비디오 길이
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>30초</option>
                      <option>60초</option>
                      <option>120초</option>
                    </select>
                  </div>

                  <button className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                    비디오 생성 시작
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}