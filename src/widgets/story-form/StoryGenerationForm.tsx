/**
 * Story Generation Form
 * 4단계 스토리 생성을 위한 폼
 * UserJourneyMap 5단계 구현
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { StoryGenerationParams } from '../../entities/story';

interface StoryGenerationFormProps {
  onGenerate: (params: StoryGenerationParams) => void;
  isGenerating: boolean;
  error?: string | null;
  initialData?: Partial<StoryGenerationParams>;
}

export function StoryGenerationForm({
  onGenerate,
  isGenerating,
  error,
  initialData
}: StoryGenerationFormProps) {
  const [formData, setFormData] = useState<StoryGenerationParams>({
    title: initialData?.title || '',
    synopsis: initialData?.synopsis || '',
    genre: initialData?.genre || 'drama',
    targetAudience: initialData?.targetAudience || 'general',
    tone: initialData?.tone || 'serious',
    creativity: initialData?.creativity || 70,
    intensity: initialData?.intensity || 60,
    pacing: initialData?.pacing || 'medium',
    keyCharacters: initialData?.keyCharacters || [],
    keyThemes: initialData?.keyThemes || [],
    specialRequirements: initialData?.specialRequirements || ''
  });

  const [characterInput, setCharacterInput] = useState('');
  const [themeInput, setThemeInput] = useState('');

  // 폼 데이터 업데이트
  const updateFormData = useCallback(
    <K extends keyof StoryGenerationParams>(
      key: K,
      value: StoryGenerationParams[K]
    ) => {
      setFormData(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  // 캐릭터 추가
  const addCharacter = useCallback(() => {
    if (characterInput.trim() && formData.keyCharacters!.length < 5) {
      updateFormData('keyCharacters', [
        ...(formData.keyCharacters || []),
        characterInput.trim()
      ]);
      setCharacterInput('');
    }
  }, [characterInput, formData.keyCharacters, updateFormData]);

  // 캐릭터 제거
  const removeCharacter = useCallback((index: number) => {
    updateFormData('keyCharacters',
      formData.keyCharacters!.filter((_, i) => i !== index)
    );
  }, [formData.keyCharacters, updateFormData]);

  // 테마 추가
  const addTheme = useCallback(() => {
    if (themeInput.trim() && formData.keyThemes!.length < 5) {
      updateFormData('keyThemes', [
        ...(formData.keyThemes || []),
        themeInput.trim()
      ]);
      setThemeInput('');
    }
  }, [themeInput, formData.keyThemes, updateFormData]);

  // 테마 제거
  const removeTheme = useCallback((index: number) => {
    updateFormData('keyThemes',
      formData.keyThemes!.filter((_, i) => i !== index)
    );
  }, [formData.keyThemes, updateFormData]);

  // 폼 제출
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.synopsis.trim()) {
      onGenerate(formData);
    }
  }, [formData, onGenerate]);

  // 유효성 검사
  const isValid = formData.title.trim().length > 0 &&
                  formData.synopsis.trim().length >= 20;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
      {/* 기본 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          기본 정보
        </h2>

        {/* 제목 */}
        <div>
          <label htmlFor="story-title" className="block text-sm font-medium text-gray-700 mb-2">
            스토리 제목 <span className="text-red-500">*</span>
          </label>
          <input
            id="story-title"
            type="text"
            value={formData.title}
            onChange={(e) => updateFormData('title', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="예: 시간을 되돌리는 사진사"
            maxLength={100}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.title.length}/100자
          </p>
        </div>

        {/* 줄거리 */}
        <div>
          <label htmlFor="story-synopsis" className="block text-sm font-medium text-gray-700 mb-2">
            줄거리 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="story-synopsis"
            value={formData.synopsis}
            onChange={(e) => updateFormData('synopsis', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={4}
            placeholder="스토리의 전반적인 줄거리를 간단히 설명해주세요. (최소 20자 이상)"
            maxLength={500}
            required
          />
          <p className={`text-xs mt-1 ${
            formData.synopsis.length >= 20 ? 'text-green-600' : 'text-gray-500'
          }`}>
            {formData.synopsis.length}/500자 (최소 20자)
          </p>
        </div>
      </div>

      {/* 장르 및 스타일 */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          장르 및 스타일
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 장르 */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
              장르
            </label>
            <select
              id="genre"
              value={formData.genre}
              onChange={(e) => updateFormData('genre', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="drama">드라마</option>
              <option value="action">액션</option>
              <option value="comedy">코미디</option>
              <option value="documentary">다큐멘터리</option>
              <option value="educational">교육</option>
              <option value="thriller">스릴러</option>
              <option value="romance">로맨스</option>
            </select>
          </div>

          {/* 타겟 오디언스 */}
          <div>
            <label htmlFor="target" className="block text-sm font-medium text-gray-700 mb-2">
              타겟 오디언스
            </label>
            <select
              id="target"
              value={formData.targetAudience}
              onChange={(e) => updateFormData('targetAudience', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="general">일반</option>
              <option value="kids">어린이</option>
              <option value="teen">청소년</option>
              <option value="adult">성인</option>
              <option value="senior">시니어</option>
            </select>
          </div>

          {/* 톤 */}
          <div>
            <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">
              톤앤매너
            </label>
            <select
              id="tone"
              value={formData.tone}
              onChange={(e) => updateFormData('tone', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="serious">진지한</option>
              <option value="light">가벼운</option>
              <option value="dramatic">극적인</option>
              <option value="humorous">유머러스</option>
              <option value="mysterious">신비로운</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI 생성 설정 */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          AI 생성 설정
        </h2>

        {/* 창의성 */}
        <div>
          <label htmlFor="creativity" className="block text-sm font-medium text-gray-700 mb-2">
            창의성: {formData.creativity}%
          </label>
          <input
            id="creativity"
            type="range"
            min="0"
            max="100"
            value={formData.creativity}
            onChange={(e) => updateFormData('creativity', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>보수적</span>
            <span>창의적</span>
          </div>
        </div>

        {/* 강도 */}
        <div>
          <label htmlFor="intensity" className="block text-sm font-medium text-gray-700 mb-2">
            감정 강도: {formData.intensity}%
          </label>
          <input
            id="intensity"
            type="range"
            min="0"
            max="100"
            value={formData.intensity}
            onChange={(e) => updateFormData('intensity', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>잔잔한</span>
            <span>강렬한</span>
          </div>
        </div>

        {/* 전개 속도 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            전개 속도
          </label>
          <div className="flex space-x-4">
            {[
              { value: 'slow', label: '느림' },
              { value: 'medium', label: '보통' },
              { value: 'fast', label: '빠름' }
            ].map(option => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  value={option.value}
                  checked={formData.pacing === option.value}
                  onChange={(e) => updateFormData('pacing', e.target.value as any)}
                  className="mr-2"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 상세 설정 */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">
          상세 설정 (선택사항)
        </h2>

        {/* 주요 인물 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            주요 인물 (최대 5명)
          </label>

          <div className="flex space-x-2 mb-3">
            <input
              type="text"
              value={characterInput}
              onChange={(e) => setCharacterInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="인물명 입력"
              maxLength={20}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCharacter())}
            />
            <button
              type="button"
              onClick={addCharacter}
              disabled={!characterInput.trim() || formData.keyCharacters!.length >= 5}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              추가
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {formData.keyCharacters?.map((character, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {character}
                <button
                  type="button"
                  onClick={() => removeCharacter(index)}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 주요 테마 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            주요 테마 (최대 5개)
          </label>

          <div className="flex space-x-2 mb-3">
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="테마 입력 (예: 사랑, 용기, 성장)"
              maxLength={20}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTheme())}
            />
            <button
              type="button"
              onClick={addTheme}
              disabled={!themeInput.trim() || formData.keyThemes!.length >= 5}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              추가
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {formData.keyThemes?.map((theme, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {theme}
                <button
                  type="button"
                  onClick={() => removeTheme(index)}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* 특별 요구사항 */}
        <div>
          <label htmlFor="special-requirements" className="block text-sm font-medium text-gray-700 mb-2">
            특별 요구사항
          </label>
          <textarea
            id="special-requirements"
            value={formData.specialRequirements}
            onChange={(e) => updateFormData('specialRequirements', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="특별히 포함하고 싶은 요소나 제약사항이 있다면 입력하세요."
            maxLength={200}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.specialRequirements?.length || 0}/200자
          </p>
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 제출 버튼 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <button
          type="submit"
          disabled={!isValid || isGenerating}
          className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>4단계 스토리 생성 중...</span>
            </div>
          ) : (
            '4단계 스토리 생성하기'
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          AI가 입력하신 정보를 바탕으로 기승전결 4단계 구조의 스토리를 생성합니다.
        </p>
      </div>
    </form>
  );
}