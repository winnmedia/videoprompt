/**
 * Planning Dashboard Widget
 * FSD Architecture - Widgets Layer
 */

'use client';

import React from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';
import { usePlanningState } from '@/shared/hooks/usePlanningState';
import { getStatusColor, getStatusText, getProviderIcon, formatDate } from '@/features/planning/lib/utils';

export function PlanningDashboard() {
  const {
    activeTab,
    scenarioItems,
    promptItems,
    videoItems,
    imageItems,
    loading,
    setActiveTab,
  } = usePlanningState();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scenario':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">시나리오 ({scenarioItems.length})</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scenarioItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                    <span className="text-xs text-gray-500 ml-2">{item.version}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{item.author}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(item.updatedAt)}</span>
                    <div className="flex gap-1">
                      {item.hasFourStep && <span className="bg-blue-100 text-blue-800 px-1 rounded">4단계</span>}
                      {item.hasTwelveShot && <span className="bg-green-100 text-green-800 px-1 rounded">12샷</span>}
                    </div>
                  </div>
                  {item.pdfUrl && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => window.open(item.pdfUrl, '_blank')}
                    >
                      PDF 다운로드
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'prompt':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">프롬프트 ({promptItems.length})</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {promptItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-2">{item.scenarioTitle}</h4>
                  <p className="text-sm text-gray-600 mb-2">버전: {item.version}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>키워드: {item.keywordCount}개</span>
                    <span>샷: {item.shotCount}개</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.quality === 'premium' 
                        ? 'bg-gold-100 text-gold-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.quality === 'premium' ? '프리미엄' : '스탠다드'}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">비디오 ({videoItems.length})</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {videoItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                    <span className="text-lg">{getProviderIcon(item.provider)}</span>
                  </div>
                  <div className={`inline-block px-2 py-1 rounded text-xs mb-2 ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>시간: {item.duration}초 | 비율: {item.aspectRatio}</div>
                    <div>{formatDate(item.createdAt)}</div>
                  </div>
                  {item.status === 'completed' && item.videoUrl && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => window.open(item.videoUrl, '_blank')}
                    >
                      비디오 보기
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">이미지 ({imageItems.length})</h3>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {imageItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h4 className="font-medium text-gray-900 mb-2 truncate">{item.title}</h4>
                  <div className="text-xs text-gray-500 space-y-1 mb-2">
                    <div>{item.dimensions} | {item.format}</div>
                    <div>{Math.round(item.fileSize / 1024)}KB</div>
                    <div>{formatDate(item.createdAt)}</div>
                  </div>
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.map((tag) => (
                        <span key={tag} className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.url && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      이미지 보기
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">기획 관리</h1>
        <p className="text-gray-600">시나리오, 프롬프트, 이미지, 비디오 자산을 관리하세요</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'scenario', label: '시나리오', icon: '📝', count: scenarioItems.length },
            { id: 'prompt', label: '프롬프트', icon: '💡', count: promptItems.length },
            { id: 'video', label: '비디오', icon: '🎬', count: videoItems.length },
            { id: 'image', label: '이미지', icon: '🖼️', count: imageItems.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {renderTabContent()}
    </div>
  );
}