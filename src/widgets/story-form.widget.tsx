/**
 * Story Form Widget - 통합 버전
 */

import React, { useState } from 'react';

export interface FormContainerProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormContainer: React.FC<FormContainerProps> = ({
  title,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {title && (
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
};

export interface StoryFormProps {
  onSubmit?: (data: any) => void;
  isLoading?: boolean;
  className?: string;
}

export const StoryForm: React.FC<StoryFormProps> = ({
  onSubmit,
  isLoading = false,
  className = ''
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    genre: 'drama'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          제목
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="스토리 제목을 입력하세요"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          내용
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="스토리 내용을 입력하세요"
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !formData.title.trim()}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '생성 중...' : '스토리 생성'}
      </button>
    </form>
  );
};