'use client';

/**
 * 시나리오 생성 폼 위젯
 * UserJourneyMap 3-4단계 구현
 * 제목, 내용, 드롭다운 요소, 전개방식, 강도 선택
 */

import { useState, useCallback } from 'react';
import { Button } from '../../shared/ui';
import {
  type ScenarioGenerationRequest,
  type Genre,
  type Style,
  type Target,
  type StoryStructure,
  type IntensityLevel,
  GENRE_OPTIONS,
  STYLE_OPTIONS,
  TARGET_OPTIONS,
  STRUCTURE_OPTIONS,
  INTENSITY_OPTIONS,
  STRUCTURE_DESCRIPTIONS,
  INTENSITY_DESCRIPTIONS,
  validateScenario,
  calculateScenarioProgress,
} from '../../entities/scenario';

interface ScenarioFormProps {
  onSubmit: (request: ScenarioGenerationRequest) => void;
  isLoading?: boolean;
  initialData?: Partial<ScenarioGenerationRequest>;
  className?: string;
}

export function ScenarioForm({
  onSubmit,
  isLoading = false,
  initialData,
  className = '',
}: ScenarioFormProps) {
  // 폼 상태
  const [formData, setFormData] = useState<ScenarioGenerationRequest>({
    title: initialData?.title || '',
    content: initialData?.content || '',
    genre: initialData?.genre || 'drama',
    style: initialData?.style || 'realistic',
    target: initialData?.target || 'general',
    structure: initialData?.structure || 'traditional',
    intensity: initialData?.intensity || 'medium',
  });

  // 검증 에러
  const [errors, setErrors] = useState<string[]>([]);

  // 진행률 계산
  const progress = calculateScenarioProgress({
    title: formData.title,
    content: formData.content,
    metadata: {
      genre: formData.genre,
      style: formData.style,
      target: formData.target,
      structure: formData.structure,
      intensity: formData.intensity,
      estimatedDuration: 0,
      qualityScore: 0,
      tokens: 0,
      cost: 0,
    }
  });

  // 폼 필드 업데이트
  const updateField = useCallback((field: keyof ScenarioGenerationRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // 실시간 검증
    const updatedData = { ...formData, [field]: value };
    const validationErrors = validateScenario({
      title: updatedData.title,
      content: updatedData.content,
    });
    setErrors(validationErrors);
  }, [formData]);

  // 폼 제출
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateScenario({
      title: formData.title,
      content: formData.content,
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSubmit(formData);
  }, [formData]); // $300 사건 방지: onSubmit 함수를 의존성 배열에서 제거

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`}
      aria-label="시나리오 생성 폼"
    >
      {/* 진행률 표시 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            작성 진행률
          </span>
          <span className="text-sm text-gray-500">
            {progress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`작성 진행률 ${progress}%`}
          />
        </div>
      </div>

      {/* 기본 정보 섹션 */}
      <section aria-labelledby="basic-info-heading">
        <h3 id="basic-info-heading" className="text-lg font-semibold mb-4 text-gray-900">
          기본 정보
        </h3>

        {/* 제목 입력 */}
        <div className="mb-4">
          <label
            htmlFor="scenario-title"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            시나리오 제목 *
          </label>
          <input
            id="scenario-title"
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="예: 꿈을 찾는 소녀"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-describedby="title-help title-error"
            aria-invalid={errors.some(error => error.includes('제목'))}
            disabled={isLoading}
          />
          <div id="title-help" className="mt-1 text-xs text-gray-500">
            {formData.title.length}/100자
          </div>
        </div>

        {/* 내용 입력 */}
        <div className="mb-4">
          <label
            htmlFor="scenario-content"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            시나리오 내용 *
          </label>
          <textarea
            id="scenario-content"
            value={formData.content}
            onChange={(e) => updateField('content', e.target.value)}
            placeholder="시나리오의 기본 아이디어, 줄거리, 주요 캐릭터 등을 자유롭게 작성해주세요..."
            rows={6}
            maxLength={5000}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            aria-describedby="content-help content-error"
            aria-invalid={errors.some(error => error.includes('내용'))}
            disabled={isLoading}
          />
          <div id="content-help" className="mt-1 text-xs text-gray-500">
            {formData.content.length}/5000자 (최소 50자)
          </div>
        </div>
      </section>

      {/* 장르/스타일 섹션 */}
      <section aria-labelledby="genre-style-heading">
        <h3 id="genre-style-heading" className="text-lg font-semibold mb-4 text-gray-900">
          장르 및 스타일
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 장르 선택 */}
          <div>
            <label
              htmlFor="scenario-genre"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              장르
            </label>
            <select
              id="scenario-genre"
              value={formData.genre}
              onChange={(e) => updateField('genre', e.target.value as Genre)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            >
              {GENRE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 스타일 선택 */}
          <div>
            <label
              htmlFor="scenario-style"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              스타일
            </label>
            <select
              id="scenario-style"
              value={formData.style}
              onChange={(e) => updateField('style', e.target.value as Style)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            >
              {STYLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 타겟 선택 */}
          <div>
            <label
              htmlFor="scenario-target"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              타겟 관객
            </label>
            <select
              id="scenario-target"
              value={formData.target}
              onChange={(e) => updateField('target', e.target.value as Target)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            >
              {TARGET_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 스토리 구조 섹션 */}
      <section aria-labelledby="structure-heading">
        <h3 id="structure-heading" className="text-lg font-semibold mb-4 text-gray-900">
          스토리 전개 방식
        </h3>

        <div className="mb-4">
          <label
            htmlFor="scenario-structure"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            구조 선택
          </label>
          <select
            id="scenario-structure"
            value={formData.structure}
            onChange={(e) => updateField('structure', e.target.value as StoryStructure)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-describedby="structure-description"
            disabled={isLoading}
          >
            {STRUCTURE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div id="structure-description" className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
            {STRUCTURE_DESCRIPTIONS[formData.structure]}
          </div>
        </div>
      </section>

      {/* 전개 강도 섹션 */}
      <section aria-labelledby="intensity-heading">
        <h3 id="intensity-heading" className="text-lg font-semibold mb-4 text-gray-900">
          전개 강도 선택
        </h3>

        <div className="mb-4">
          <div className="flex items-center space-x-4 mb-3">
            {INTENSITY_OPTIONS.map(option => (
              <label
                key={option.value}
                className="flex items-center cursor-pointer"
              >
                <input
                  type="radio"
                  name="intensity"
                  value={option.value}
                  checked={formData.intensity === option.value}
                  onChange={(e) => updateField('intensity', e.target.value as IntensityLevel)}
                  className="mr-2 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
            {INTENSITY_DESCRIPTIONS[formData.intensity]}
          </div>
        </div>
      </section>

      {/* 에러 표시 */}
      {errors.length > 0 && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-4"
          role="alert"
          aria-labelledby="form-errors"
        >
          <h4 id="form-errors" className="text-sm font-medium text-red-800 mb-2">
            입력 오류가 있습니다:
          </h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 제출 버튼 */}
      <div className="flex justify-end pt-6 border-t border-gray-200">
        <Button
          type="submit"
          disabled={isLoading || errors.length > 0 || progress < 50}
          className="px-6 py-2"
          aria-describedby="submit-help"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              시나리오 생성 중...
            </>
          ) : (
            '시나리오 생성하기'
          )}
        </Button>
        <div id="submit-help" className="sr-only">
          {progress < 50 ? '기본 정보를 모두 입력해주세요' : '시나리오 생성을 시작합니다'}
        </div>
      </div>
    </form>
  );
}