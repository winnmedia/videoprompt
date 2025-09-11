'use client';

import React, { useState } from 'react';
import { StoryInput, StoryTemplate } from '@/entities/scenario';
import { Button } from '@/shared/ui';
import { TemplateSelector } from './TemplateSelector';

interface StoryInputFormProps {
  storyInput: StoryInput;
  onInputChange: (field: keyof StoryInput, value: any) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  errorType: 'client' | 'server' | 'network' | null;
  retryCount: number;
  onRetry: () => void;
  customTone: string;
  setCustomTone: (value: string) => void;
  showCustomToneInput: boolean;
  setShowCustomToneInput: (value: boolean) => void;
  customGenre: string;
  setCustomGenre: (value: string) => void;
  showCustomGenreInput: boolean;
  setShowCustomGenreInput: (value: boolean) => void;
  onTemplateSelect: (template: StoryTemplate) => void;
  onSaveAsTemplate: (storyInput: StoryInput) => void;
}

// 옵션 상수들
const toneOptions = [
  '친근한',
  '전문적인',
  '감성적인',
  '유머러스한',
  '진중한',
  '트렌디한',
  '따뜻한',
  '강렬한',
];

const genreOptions = [
  '다큐멘터리',
  '광고',
  '뮤직비디오',
  '숏폼',
  '브이로그',
  '튜토리얼',
  '인터뷰',
  '리뷰',
];

const formatOptions = ['16:9', '9:16', '1:1', '4:3'];

const tempoOptions = ['빠르게', '보통', '느리게'];

const intensityOptions = ['강하게', '보통', '부드럽게'];

const developmentOptions = [
  '훅-몰입-반전-떡밥',
  '클래식 기승전결', 
  '귀납법',
  '연역법',
  '다큐(인터뷰식)',
  '픽사스토리'
];

export function StoryInputForm({
  storyInput,
  onInputChange,
  onSubmit,
  loading,
  error,
  errorType,
  retryCount,
  onRetry,
  customTone,
  setCustomTone,
  showCustomToneInput,
  setShowCustomToneInput,
  customGenre,
  setCustomGenre,
  showCustomGenreInput,
  setShowCustomGenreInput,
  onTemplateSelect,
  onSaveAsTemplate
}: StoryInputFormProps) {
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const handleToneRemove = (toneToRemove: string) => {
    const newTones = storyInput.toneAndManner.filter(tone => tone !== toneToRemove);
    onInputChange('toneAndManner', newTones);
  };

  const handleCustomToneAdd = () => {
    if (customTone.trim() && !storyInput.toneAndManner.includes(customTone.trim())) {
      onInputChange('toneAndManner', [...storyInput.toneAndManner, customTone.trim()]);
      setCustomTone('');
      setShowCustomToneInput(false);
    }
  };

  const handleCustomGenreSet = () => {
    if (customGenre.trim()) {
      onInputChange('genre', customGenre.trim());
      setCustomGenre('');
      setShowCustomGenreInput(false);
    }
  };

  // 필수 입력값 검증
  const isFormValid = () => {
    return (
      storyInput.title.trim() !== '' &&
      storyInput.oneLineStory.trim() !== '' &&
      storyInput.toneAndManner.length > 0 &&
      storyInput.genre.trim() !== '' &&
      storyInput.target.trim() !== '' &&
      storyInput.duration.trim() !== '' &&
      storyInput.format.trim() !== '' &&
      storyInput.tempo.trim() !== '' &&
      storyInput.developmentMethod.trim() !== '' &&
      storyInput.developmentIntensity.trim() !== ''
    );
  };

  return (
    <div className="card p-4 sm:p-6" aria-busy={loading} aria-live="polite">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">스토리 입력</h2>
        <Button
          onClick={() => setShowTemplateSelector(true)}
          variant="secondary"
          className="text-sm"
        >
          템플릿 선택
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 기본 정보 */}
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">제목</label>
            <input
              type="text"
              value={storyInput.title}
              onChange={(e) => onInputChange('title', e.target.value)}
              className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="시나리오 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">
              한 줄 스토리
            </label>
            <textarea
              value={storyInput.oneLineStory}
              onChange={(e) => onInputChange('oneLineStory', e.target.value)}
              rows={3}
              className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="스토리의 핵심을 한 줄로 요약하세요"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">타겟</label>
            <input
              type="text"
              value={storyInput.target}
              onChange={(e) => onInputChange('target', e.target.value)}
              className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="타겟 시청자"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">분량</label>
            <input
              type="text"
              value={storyInput.duration}
              onChange={(e) => onInputChange('duration', e.target.value)}
              className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="예: 30초, 60초, 90초"
            />
          </div>
        </div>

        {/* 스타일 및 전개 */}
        <div className="space-y-4">
          <div>
            <label className="mb-3 block text-sm font-medium text-gray-900">
              톤앤매너 (다중 선택)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {toneOptions.map((tone) => (
                <label key={tone} className="flex cursor-pointer items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={storyInput.toneAndManner.includes(tone)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onInputChange('toneAndManner', [
                          ...storyInput.toneAndManner,
                          tone,
                        ]);
                      } else {
                        onInputChange(
                          'toneAndManner',
                          storyInput.toneAndManner.filter((t) => t !== tone),
                        );
                      }
                    }}
                    className="text-primary border-border focus:ring-primary h-4 w-4 rounded focus:ring-2 focus:ring-offset-2"
                  />
                  <span className="text-sm text-gray-900">{tone}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => setShowCustomToneInput(true)}
                className="flex cursor-pointer items-center space-x-2 text-brand-600 hover:text-brand-700"
              >
                <div className="h-4 w-4 rounded border-2 border-brand-600 flex items-center justify-center">
                  <span className="text-xs">+</span>
                </div>
                <span className="text-sm">기타 추가</span>
              </button>
            </div>
            
            {/* 선택된 톤앤매너 태그 표시 */}
            {storyInput.toneAndManner.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {storyInput.toneAndManner.map((tone) => (
                    <span 
                      key={tone}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800"
                    >
                      {tone}
                      <button
                        type="button"
                        onClick={() => handleToneRemove(tone)}
                        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-200 hover:text-brand-500 focus:bg-brand-500 focus:text-white focus:outline-none"
                      >
                        <span className="sr-only">Remove {tone}</span>
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 커스텀 톤앤매너 입력 */}
            {showCustomToneInput && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="새로운 톤앤매너를 입력하세요"
                  className="flex-1 rounded-lg border-2 border-brand-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomToneAdd();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleCustomToneAdd}
                  className="px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomToneInput(false);
                    setCustomTone('');
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">장르</label>
              {showCustomGenreInput ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="새로운 장르를 입력하세요"
                      className="flex-1 rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomGenreSet();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomGenreInput(false);
                        setCustomGenre('');
                      }}
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomGenreSet}
                      disabled={!customGenre.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      추가
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={storyInput.genre === customGenre ? '기타' : storyInput.genre}
                  onChange={(e) => {
                    if (e.target.value === '기타') {
                      setShowCustomGenreInput(true);
                    } else {
                      onInputChange('genre', e.target.value);
                    }
                  }}
                  className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="">장르를 선택하세요</option>
                  {genreOptions.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                  <option value="기타">기타 (직접 입력)</option>
                </select>
              )}
              {storyInput.genre && !genreOptions.includes(storyInput.genre) && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                    커스텀: {storyInput.genre}
                    <button
                      type="button"
                      onClick={() => onInputChange('genre', '')}
                      className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-400 hover:bg-brand-200 hover:text-brand-500 focus:bg-brand-500 focus:text-white focus:outline-none"
                    >
                      <span className="sr-only">Remove custom genre</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomGenreInput(false);
                      setCustomGenre('');
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 underline"
                  >
                    다른 장르 선택
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">포맷</label>
              <select
                value={storyInput.format}
                onChange={(e) => onInputChange('format', e.target.value)}
                className="w-full rounded-lg border-2 border-brand-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">포맷을 선택하세요</option>
                {formatOptions.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">템포</label>
              <div className="space-y-2">
                {tempoOptions.map((tempo) => (
                  <label key={tempo} className="flex cursor-pointer items-center space-x-2">
                    <input
                      type="radio"
                      name="tempo"
                      value={tempo}
                      checked={storyInput.tempo === tempo}
                      onChange={(e) => onInputChange('tempo', e.target.value)}
                      className="text-primary border-border focus:ring-primary h-4 w-4 focus:ring-2 focus:ring-offset-2"
                    />
                    <span className="text-sm text-gray-900">{tempo}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                전개 강도
              </label>
              <div className="space-y-2">
                {intensityOptions.map((intensity) => (
                  <label
                    key={intensity}
                    className="flex cursor-pointer items-center space-x-2"
                  >
                    <input
                      type="radio"
                      name="intensity"
                      value={intensity}
                      checked={storyInput.developmentIntensity === intensity}
                      onChange={(e) =>
                        onInputChange('developmentIntensity', e.target.value)
                      }
                      className="text-primary border-border focus:ring-primary h-4 w-4 focus:ring-2 focus:ring-offset-2"
                    />
                    <span className="text-sm text-gray-900">{intensity}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900">전개 방식</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {developmentOptions.map((method) => {
                const selected = storyInput.developmentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onInputChange('developmentMethod', method)}
                    className={`rounded-md border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selected
                        ? 'border-brand-500 bg-primary-50 shadow'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                    aria-pressed={selected ? 'true' : 'false'}
                  >
                    <div className="font-medium text-gray-900">{method}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      {method === '훅-몰입-반전-떡밥' && '시작에 강한 주목→빠른 몰입→반전→후속 기대'}
                      {method === '클래식 기승전결' && '기-승-전-결의 안정적 구조'}
                      {method === '귀납법' && '사례를 모아 결론에 도달'}
                      {method === '연역법' && '결론을 먼저 제시하고 근거로 전개'}
                      {method === '다큐(인터뷰식)' && '인터뷰/내레이션 중심의 전개'}
                      {method === '픽사스토리' && '옛날 옛적에→매일→그러던 어느 날→때문에→결국'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 선택된 옵션 미리보기 */}
      {(storyInput.toneAndManner.length > 0 ||
        storyInput.genre ||
        storyInput.tempo ||
        storyInput.developmentMethod ||
        storyInput.developmentIntensity) && (
        <div className="mt-6 rounded-lg border border-brand-200 bg-primary-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-primary-800">선택된 설정 미리보기</h3>
          <div className="grid grid-cols-1 gap-2 text-sm text-primary-700 sm:grid-cols-2">
            {storyInput.toneAndManner.length > 0 && (
              <div>
                <span className="font-medium">톤앤매너:</span>{' '}
                {storyInput.toneAndManner.join(', ')}
              </div>
            )}
            {storyInput.genre && (
              <div>
                <span className="font-medium">장르:</span> {storyInput.genre}
              </div>
            )}
            {storyInput.tempo && (
              <div>
                <span className="font-medium">템포:</span> {storyInput.tempo}
              </div>
            )}
            {storyInput.developmentMethod && (
              <div>
                <span className="font-medium">전개 방식:</span> {storyInput.developmentMethod}
              </div>
            )}
            {storyInput.developmentIntensity && (
              <div>
                <span className="font-medium">전개 강도:</span> {storyInput.developmentIntensity}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">오류가 발생했습니다</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              {errorType === 'server' && retryCount < 3 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-red-100 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                  >
                    다시 시도 ({retryCount}/3)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {!isFormValid() && '모든 필드를 입력해주세요.'}
        </div>
        <Button
          onClick={onSubmit}
          disabled={!isFormValid() || loading}
          size="lg"
          className="min-w-[120px]"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              생성 중...
            </div>
          ) : (
            '4단계 스토리 생성'
          )}
        </Button>
      </div>

      {/* 템플릿 선택 모달 */}
      <TemplateSelector
        isVisible={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={onTemplateSelect}
        onSaveAsTemplate={onSaveAsTemplate}
        currentStoryInput={storyInput}
      />
    </div>
  );
}