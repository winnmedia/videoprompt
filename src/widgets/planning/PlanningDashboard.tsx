/**
 * Planning Dashboard Widget
 * FSD Architecture - Widgets Layer
 * Redux Integration - RTK Query + Redux Store
 */

'use client';

import React, { useEffect } from 'react';
import { Button } from '@/shared/ui';
import { getStatusColor, getStatusText, getProviderIcon, formatDate } from '@/shared/lib/planning-utils';

// Redux Store imports
import { useAppSelector, useAppDispatch } from '@/app/store';
import {
  selectActiveTab,
  selectLoading,
  selectError,
  selectScenarios,
  selectPrompts,
  selectVideos,
  selectImages,
  selectLastLoadTime,
  shouldRefreshData,
  setActiveTab,
  setLoading,
  setError,
  setScenarios,
  setPrompts,
  setVideos,
  setImages,
  updateLastLoadTime,
  clearError,
} from '@/entities/planning';

// RTK Query imports
import { useGetPlanningDashboardQuery } from '@/shared/api/api-slice';

export function PlanningDashboard() {
  const dispatch = useAppDispatch();

  // Redux state selectors
  const activeTab = useAppSelector(selectActiveTab);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const scenarioItems = useAppSelector(selectScenarios);
  const promptItems = useAppSelector(selectPrompts);
  const videoItems = useAppSelector(selectVideos);
  const imageItems = useAppSelector(selectImages);
  const lastLoadTime = useAppSelector(selectLastLoadTime);

  // RTK Query for dashboard data
  const {
    data: dashboardData,
    isLoading: isQueryLoading,
    isError: isQueryError,
    error: queryError,
    refetch,
  } = useGetPlanningDashboardQuery(undefined, {
    // 5분마다 자동 refetch
    pollingInterval: 5 * 60 * 1000,
    // 컴포넌트가 focus될 때 refetch
    refetchOnFocus: true,
    // 네트워크 재연결시 refetch
    refetchOnReconnect: true,
    // 5분보다 오래된 데이터만 refetch
    skip: !shouldRefreshData({ planning: { lastLoadTime } } as any),
  });

  // Dashboard 데이터가 로드되면 Redux store 업데이트
  useEffect(() => {
    if (dashboardData) {
      // ScenarioItem 타입으로 변환
      dispatch(setScenarios(dashboardData.scenarios.map(s => ({
        id: s.id,
        title: s.title,
        version: s.metadata?.version || s.version || 'V1',
        author: s.metadata?.author || s.author || 'AI Generated',
        updatedAt: s.updatedAt,
        hasFourStep: s.metadata?.hasFourStep || false,
        hasTwelveShot: s.metadata?.hasTwelveShot || false,
        pdfUrl: s.metadata?.pdfUrl
      }) as any)));

      // PromptItem 타입으로 변환
      dispatch(setPrompts(dashboardData.prompts.map(p => ({
        id: p.id,
        scenarioTitle: p.scenarioTitle,
        version: p.version,
        keywordCount: p.keywordCount,
        shotCount: p.shotCount,
        quality: p.quality,
        createdAt: p.createdAt,
        jsonUrl: p.jsonUrl
      }) as any)));

      // VideoItem 타입으로 변환
      dispatch(setVideos(dashboardData.videos.map(v => ({
        id: v.id,
        title: v.title || 'Untitled Video',
        prompt: v.prompt || '',
        provider: v.provider || 'unknown',
        duration: v.duration || 10,
        aspectRatio: v.aspectRatio || '16:9',
        status: v.status,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        createdAt: v.createdAt,
        completedAt: v.completedAt,
        jobId: v.jobId
      }) as any)));

      // ImageAsset 타입으로 변환
      dispatch(setImages((dashboardData.images || []).map(i => ({
        id: i.id,
        title: i.title,
        url: i.url || '',
        dimensions: i.dimensions || '1920x1080',
        format: i.format || 'jpg',
        fileSize: i.fileSize || 0,
        tags: i.tags || [],
        createdAt: i.createdAt || new Date().toISOString()
      }) as any)));

      dispatch(updateLastLoadTime());
      dispatch(clearError());
    }
  }, [dashboardData, dispatch]);

  // 로딩 및 에러 상태 동기화
  useEffect(() => {
    dispatch(setLoading(isQueryLoading));
  }, [isQueryLoading, dispatch]);

  useEffect(() => {
    if (isQueryError) {
      const errorMessage = queryError && 'data' in queryError
        ? (queryError.data as any)?.message || 'Planning 데이터 로딩에 실패했습니다.'
        : 'Planning 데이터 로딩에 실패했습니다.';
      dispatch(setError(errorMessage));
    }
  }, [isQueryError, queryError, dispatch]);

  // 탭 변경 핸들러
  const handleTabChange = (newTab: 'scenario' | 'prompt' | 'video' | 'image') => {
    dispatch(setActiveTab(newTab));
  };

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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => refetch()}>다시 시도</Button>
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
                    <span className="text-xs text-gray-500 ml-2">{(item.metadata as any)?.version || 'v1'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{(item.metadata as any)?.author || '작성자 미상'}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(item.updatedAt)}</span>
                    <div className="flex gap-1">
                      {(item.metadata as any)?.hasFourStep && <span className="bg-blue-100 text-blue-800 px-1 rounded">4단계</span>}
                      {(item.metadata as any)?.hasTwelveShot && <span className="bg-green-100 text-green-800 px-1 rounded">12샷</span>}
                    </div>
                  </div>
                  {(item.metadata as any)?.pdfUrl && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => window.open((item.metadata as any)?.pdfUrl, '_blank')}
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
                    <span className="text-lg">{getProviderIcon(item.provider || 'unknown')}</span>
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
                    <div>{item.fileSize ? Math.round(item.fileSize / 1024) : 0}KB</div>
                    <div>{item.createdAt ? formatDate(item.createdAt) : '날짜 없음'}</div>
                  </div>
                  {item.tags && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.tags.map((tag: string) => (
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
              onClick={() => handleTabChange(tab.id as any)}
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