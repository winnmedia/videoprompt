/**
 * Contents Page - 통합 버전
 * 모든 콘텐츠 관리 기능을 단일 페이지로 통합
 */

'use client';

import React, { useState } from 'react';
import { ContentTabs, ContentGrid, EmptyState, ContentType } from '@/widgets/content-manager.widget';

export default function ContentsPage() {
  const [activeTab, setActiveTab] = useState<ContentType>('all');
  const [contents] = useState([
    {
      id: '1',
      title: 'Sample Story',
      type: 'stories' as ContentType,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: '2',
      title: 'Sample Scenario',
      type: 'scenarios' as ContentType,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02'
    }
  ]);

  const filteredContents = activeTab === 'all'
    ? contents
    : contents.filter(item => item.type === activeTab);

  const handleItemClick = (item: any) => {
    console.log('Content clicked:', item);
    // Handle navigation to content detail
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">콘텐츠 관리</h1>
          <p className="text-gray-600 mt-2">생성된 모든 콘텐츠를 관리하세요</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <ContentTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          <div className="p-6">
            <ContentGrid
              items={filteredContents}
              onItemClick={handleItemClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}