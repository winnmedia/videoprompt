/**
 * Scenario Widget - 통합 버전
 */

import React, { useState } from 'react';

export interface ScenarioFormData {
  title: string;
  content: string;
  genre: string;
  tone: string;
  targetDuration: number;
}

export interface ScenarioFormProps {
  onSubmit?: (data: ScenarioFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<ScenarioFormData>;
  className?: string;
}

export const ScenarioForm: React.FC<ScenarioFormProps> = ({
  onSubmit,
  isLoading = false,
  initialData = {},
  className = ''
}) => {
  const [formData, setFormData] = useState<ScenarioFormData>({
    title: initialData.title || '',
    content: initialData.content || '',
    genre: initialData.genre || 'drama',
    tone: initialData.tone || 'neutral',
    targetDuration: initialData.targetDuration || 60
  });

  const genres = [
    { value: 'drama', label: '드라마' },
    { value: 'comedy', label: '코미디' },
    { value: 'thriller', label: '스릴러' },
    { value: 'horror', label: '호러' },
    { value: 'action', label: '액션' },
    { value: 'romance', label: '로맨스' },
    { value: 'scifi', label: 'SF' },
    { value: 'fantasy', label: '판타지' }
  ];

  const tones = [
    { value: 'serious', label: '진지한' },
    { value: 'neutral', label: '중립적' },
    { value: 'light', label: '가벼운' },
    { value: 'humorous', label: '유머러스' },
    { value: 'dark', label: '어두운' },
    { value: 'inspiring', label: '감동적' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;
    onSubmit?.(formData);
  };

  const updateField = (field: keyof ScenarioFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          시나리오 제목
        </label>
        <input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="시나리오 제목을 입력하세요"
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
          시나리오 내용
        </label>
        <textarea
          id="content"
          value={formData.content}
          onChange={(e) => updateField('content', e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="시나리오의 기본 스토리를 입력하세요"
          required
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
            장르
          </label>
          <select
            id="genre"
            value={formData.genre}
            onChange={(e) => updateField('genre', e.target.value)}
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
          <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
            톤앤매너
          </label>
          <select
            id="tone"
            value={formData.tone}
            onChange={(e) => updateField('tone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            {tones.map((tone) => (
              <option key={tone.value} value={tone.value}>
                {tone.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
            목표 길이 (초)
          </label>
          <input
            id="duration"
            type="number"
            value={formData.targetDuration}
            onChange={(e) => updateField('targetDuration', Number(e.target.value))}
            min="10"
            max="600"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.title.trim() || !formData.content.trim()}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? '시나리오 생성 중...' : '시나리오 생성'}
      </button>
    </form>
  );
};

export interface Scene {
  id: string;
  title: string;
  description: string;
  duration: number;
  location: string;
  characters: string[];
  dialogue: string;
}

export interface ScenarioViewerProps {
  title: string;
  description: string;
  scenes: Scene[];
  totalDuration: number;
  className?: string;
}

export const ScenarioViewer: React.FC<ScenarioViewerProps> = ({
  title,
  description,
  scenes,
  totalDuration,
  className = ''
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{description}</p>
        <div className="text-sm text-gray-500">
          총 {scenes.length}개 씬 • {totalDuration}초
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">씬 구성</h3>
        {scenes.map((scene, index) => (
          <div key={scene.id} className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white text-sm font-bold rounded-full">
                  {index + 1}
                </span>
                <div>
                  <h4 className="font-semibold text-gray-900">{scene.title}</h4>
                  <p className="text-sm text-gray-500">{scene.location} • {scene.duration}초</p>
                </div>
              </div>
            </div>

            <p className="text-gray-700 mb-3">{scene.description}</p>

            {scene.characters.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium text-gray-600">등장인물: </span>
                <span className="text-sm text-gray-700">{scene.characters.join(', ')}</span>
              </div>
            )}

            {scene.dialogue && (
              <div className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                <span className="text-sm font-medium text-gray-600">대사: </span>
                <p className="text-sm text-gray-700 italic">"{scene.dialogue}"</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};