import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import {
  VIDEO_STYLES,
  SPATIAL_CONTEXT,
  CAMERA_SETTINGS,
  type Metadata,
} from '@/types/video-prompt';
import { cn } from '@/shared/lib/utils';

interface MetadataFormProps {
  metadata: Partial<Metadata>;
  onMetadataChange: (metadata: Partial<Metadata>) => void;
  onNext: () => void;
}

interface StyleOption {
  label: string;
  value: string;
  category: string;
}

export const MetadataForm: React.FC<MetadataFormProps> = ({
  metadata,
  onMetadataChange,
  onNext,
}) => {
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // 모든 스타일 옵션을 하나의 배열로 통합
  const allStyleOptions: StyleOption[] = [
    ...VIDEO_STYLES.visual.map((style) => ({
      label: style,
      value: style,
      category: 'Visual Style',
    })),
    ...VIDEO_STYLES.genre.map((style) => ({ label: style, value: style, category: 'Genre' })),
    ...VIDEO_STYLES.mood.map((style) => ({ label: style, value: style, category: 'Mood' })),
    ...VIDEO_STYLES.quality.map((style) => ({ label: style, value: style, category: 'Quality' })),
    ...VIDEO_STYLES.director.map((style) => ({
      label: style,
      value: style,
      category: 'Director Style',
    })),
  ];

  const handleInputChange = (field: keyof Metadata, value: string | string[]) => {
    onMetadataChange({ ...metadata, [field]: value });

    // 에러 제거
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: [] }));
    }
  };

  const handleStyleToggle = (style: string) => {
    const currentStyles = metadata.base_style || [];
    const newStyles = currentStyles.includes(style)
      ? currentStyles.filter((s) => s !== style)
      : [...currentStyles, style];

    handleInputChange('base_style', newStyles);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string[]> = {};

    if (!metadata.prompt_name?.trim()) {
      newErrors.prompt_name = ['프로젝트명을 입력해주세요'];
    }

    if (!metadata.base_style?.length) {
      newErrors.base_style = ['최소 하나의 스타일을 선택해주세요'];
    }

    if (!metadata.room_description?.trim()) {
      newErrors.room_description = ['장면 설명을 입력해주세요'];
    }

    if (!metadata.camera_setup?.trim()) {
      newErrors.camera_setup = ['카메라 설정을 입력해주세요'];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onNext();
    }
  };

  const isFormValid =
    metadata.prompt_name?.trim() &&
    metadata.base_style?.length &&
    metadata.room_description?.trim() &&
    metadata.camera_setup?.trim();

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900">프로젝트 설정 및 메타데이터</h1>
        <p className="text-lg text-gray-600">AI 영상 생성을 위한 기본 설정을 구성해주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 프로젝트명 입력 */}
        <div className="space-y-3">
          <label htmlFor="prompt_name" className="block text-sm font-medium text-gray-700">
            프로젝트명 *
          </label>
          <input
            id="prompt_name"
            data-testid="input-prompt-name"
            aria-label="프로젝트명 *"
            type="text"
            value={metadata.prompt_name || ''}
            onChange={(e) => handleInputChange('prompt_name', e.target.value)}
            placeholder="예: Rooftop Deal Gone Wrong - Full SFX"
            className={cn(
              'w-full rounded-lg border px-4 py-3 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500',
              errors.prompt_name ? 'border-danger-300 focus:ring-danger-500' : 'border-gray-300',
            )}
          />
          {errors.prompt_name && <p className="text-sm text-danger-600">{errors.prompt_name[0]}</p>}
        </div>

        {/* 스타일 선택 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            기본 스타일 선택 * (최소 1개)
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allStyleOptions.map((option) => (
              <div key={option.value} className="relative">
                <input
                  type="checkbox"
                  id={option.value}
                  aria-label={option.label}
                  checked={metadata.base_style?.includes(option.value) || false}
                  onChange={() => handleStyleToggle(option.value)}
                  className="sr-only"
                />
                <label
                  htmlFor={option.value}
                  data-testid={`style-card-${option.value}`}
                  className={cn(
                    'block cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md',
                    metadata.base_style?.includes(option.value)
                      ? 'border-primary-500 bg-primary-50 text-primary-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-xs text-gray-500">{option.category}</div>
                </label>
              </div>
            ))}
          </div>
          {errors.base_style && <p className="text-sm text-danger-600">{errors.base_style[0]}</p>}
          <p className="text-sm text-gray-500">
            선택된 스타일: {metadata.base_style?.length || 0}개
          </p>
        </div>

        {/* 종횡비 선택 */}
        <div className="space-y-3">
          <label htmlFor="aspect_ratio" className="block text-sm font-medium text-gray-700">
            종횡비 (Aspect Ratio)
          </label>
          <select
            id="aspect_ratio"
            data-testid="select-aspect-ratio"
            aria-label="종횡비 (Aspect Ratio)"
            value={metadata.aspect_ratio || '16:9'}
            onChange={(e) => handleInputChange('aspect_ratio', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500"
          >
            <option value="16:9">16:9 (가로형)</option>
            <option value="9:16">9:16 (세로형)</option>
            <option value="21:9">21:9 (울트라와이드)</option>
            <option value="4:3">4:3 (전통형)</option>
            <option value="1:1">1:1 (정사각형)</option>
          </select>
        </div>

        {/* 장면 설명 */}
        <div className="space-y-3">
          <label htmlFor="room_description" className="block text-sm font-medium text-gray-700">
            장면 설명 * (상세한 공간적 배경)
          </label>
          <textarea
            id="room_description"
            data-testid="textarea-room-desc"
            aria-label="장면 설명 * (상세한 공간적 배경)"
            value={metadata.room_description || ''}
            onChange={(e) => handleInputChange('room_description', e.target.value)}
            placeholder="예: 밤중의 어두운 도시 옥상, 비에 젖어 반짝이는 표면. 빨간 불이 깜빡이는 안테나들. 안개 낀 도시 스카이라인이 멀리서 빛나며, 가끔 번개가 장면을 비춥니다."
            rows={4}
            className={cn(
              'w-full resize-none rounded-lg border px-4 py-3 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500',
              errors.room_description
                ? 'border-danger-300 focus:ring-danger-500'
                : 'border-gray-300',
            )}
          />
          {errors.room_description && (
            <p className="text-sm text-danger-600">{errors.room_description[0]}</p>
          )}
        </div>

        {/* 카메라 설정 */}
        <div className="space-y-3">
          <label htmlFor="camera_setup" className="block text-sm font-medium text-gray-700">
            카메라 설정 * (카메라 움직임과 앵글)
          </label>
          <textarea
            id="camera_setup"
            data-testid="textarea-camera-setup"
            aria-label="카메라 설정 * (카메라 움직임과 앵글)"
            value={metadata.camera_setup || ''}
            onChange={(e) => handleInputChange('camera_setup', e.target.value)}
            placeholder="예: 거래 장면을 천천히 돌리면서 시작하고, 액션이 폭발하면서 흔들리는 핸드헬드 스타일로 전환됩니다. 헬리콥터 조명이 위에서 비치는 것으로 끝납니다."
            rows={3}
            className={cn(
              'w-full resize-none rounded-lg border px-4 py-3 transition-colors focus:border-transparent focus:ring-2 focus:ring-primary-500',
              errors.camera_setup ? 'border-danger-300 focus:ring-danger-500' : 'border-gray-300',
            )}
          />
          {errors.camera_setup && (
            <p className="text-sm text-danger-600">{errors.camera_setup[0]}</p>
          )}
        </div>

        {/* 다음 단계 버튼 */}
        <div className="flex justify-end pt-6">
          <Button
            type="submit"
            data-testid="btn-next-step1"
            disabled={!isFormValid}
            className="px-8 py-3 text-lg"
          >
            다음 단계 →
          </Button>
        </div>
      </form>
    </div>
  );
};
