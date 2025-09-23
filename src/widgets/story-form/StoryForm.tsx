/**
 * StoryForm 컴포넌트 - 스토리 생성 폼
 * FSD 아키텍처 준수
 */

import React from 'react';
import { StoryInput } from '@/features/story-generator';
import { StoryGenerateRequest } from '@/entities/story';

interface StoryFormProps {
  onSubmit: (request: StoryGenerateRequest) => void;
  isLoading?: boolean;
  className?: string;
}

export const StoryForm: React.FC<StoryFormProps> = ({
  onSubmit,
  isLoading = false,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        새 스토리 생성
      </h2>

      <StoryInput
        onGenerate={onSubmit}
        isLoading={isLoading}
      />
    </div>
  );
};