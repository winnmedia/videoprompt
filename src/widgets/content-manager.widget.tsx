/**
 * Content Manager Widget - 통합 버전
 */

import React, { useState } from 'react';

export type ContentType = 'all' | 'stories' | 'scenarios' | 'storyboards' | 'prompts';

export interface ContentTabsProps {
  activeTab: ContentType;
  onTabChange: (tab: ContentType) => void;
  className?: string;
}

export const ContentTabs: React.FC<ContentTabsProps> = ({
  activeTab,
  onTabChange,
  className = ''
}) => {
  const tabs: { id: ContentType; label: string }[] = [
    { id: 'all', label: '전체' },
    { id: 'stories', label: '스토리' },
    { id: 'scenarios', label: '시나리오' },
    { id: 'storyboards', label: '스토리보드' },
    { id: 'prompts', label: '프롬프트' }
  ];

  return (
    <div className={`flex space-x-4 border-b border-gray-200 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  createdAt: string;
  updatedAt: string;
}

export interface ContentGridProps {
  items: ContentItem[];
  onItemClick?: (item: ContentItem) => void;
  className?: string;
}

export const ContentGrid: React.FC<ContentGridProps> = ({
  items,
  onItemClick,
  className = ''
}) => {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick?.(item)}
          className="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow"
        >
          <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span className="capitalize">{item.type}</span>
            <span>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export interface EmptyStateProps {
  message?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message = '콘텐츠가 없습니다.',
  className = ''
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-gray-400 text-6xl mb-4">📄</div>
      <p className="text-gray-500 text-lg">{message}</p>
    </div>
  );
};