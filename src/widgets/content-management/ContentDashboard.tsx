/**
 * Content Dashboard Widget
 * 콘텐츠 관리 대시보드 메인 위젯
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ContentTable } from './ContentTable';
import { ContentFilters } from './ContentFilters';
import { ContentActions } from './ContentActions';
import { ContentStats } from './ContentStats';
import { useContentManagement } from '../../features/content-management';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

/**
 * 탭 구성
 */
const TABS = [
  { id: 'scenario', label: 'AI 시나리오', icon: '🎬' },
  { id: 'prompt', label: '프롬프트', icon: '💡' },
  { id: 'image', label: '이미지', icon: '🖼️' },
  { id: 'video', label: '비디오', icon: '🎥' },
] as const;

type TabId = typeof TABS[number]['id'];

/**
 * 콘텐츠 대시보드 메인 컴포넌트
 */
export function ContentDashboard() {
  const {
    activeTabContent,
    filteredContent,
    selectedItems,
    totalCounts,
    loading,
    error,
    hasSelection,
    isAllSelected,
    changeTab,
    selectItem,
    selectAll,
    clearSelection,
    setFilters,
    resetFilters,
    setSortConfig,
    refreshData,
    clearError,
  } = useContentManagement();

  // 로컬 상태
  const [activeTab, setActiveTab] = useState<TabId>('scenario');
  const [showFilters, setShowFilters] = useState(false);

  /**
   * 탭 변경 핸들러
   */
  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
    changeTab(tabId);
    clearSelection();
  }, [changeTab, clearSelection]);

  /**
   * 키보드 네비게이션 핸들러
   */
  const handleTabKeyDown = useCallback((event: React.KeyboardEvent, tabId: TabId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabChange(tabId);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const currentIndex = TABS.findIndex(tab => tab.id === activeTab);
      const nextIndex = (currentIndex + 1) % TABS.length;
      handleTabChange(TABS[nextIndex].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const currentIndex = TABS.findIndex(tab => tab.id === activeTab);
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      handleTabChange(TABS[prevIndex].id);
    }
  }, [activeTab, handleTabChange]);

  /**
   * 새로고침 핸들러
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error('새로고침 실패:', error);
    }
  }, [refreshData]);

  /**
   * 현재 탭 데이터
   */
  const currentTabData = useMemo(() => {
    return filteredContent.filter(item => item.type === activeTab);
  }, [filteredContent, activeTab]);

  /**
   * 통계 카드 데이터
   */
  const statsCards = useMemo(() => {
    return TABS.map(tab => ({
      ...tab,
      count: totalCounts[`${tab.id}s`] || 0,
      isActive: tab.id === activeTab,
    }));
  }, [totalCounts, activeTab]);

  // 로딩 상태
  if (loading.content && !currentTabData.length) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        data-testid="loading-spinner"
      >
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full mx-4">
          <div className="text-center space-y-4">
            <LoadingSpinner size="large" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">
                콘텐츠 로딩 중
              </h2>
              <p className="text-sm text-gray-600">
                콘텐츠 데이터를 불러오고 있습니다...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50" data-testid="content-dashboard">
        {/* 헤더 영역 */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  콘텐츠 관리
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  AI 시나리오, 프롬프트, 이미지, 비디오를 통합 관리하세요
                </p>
              </div>

              <div className="flex items-center space-x-4">
                {/* 새로고침 버튼 */}
                <button
                  onClick={handleRefresh}
                  disabled={loading.content}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  aria-label="콘텐츠 새로고침"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새로고침
                </button>

                {/* 필터 토글 */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    showFilters
                      ? 'border-blue-300 text-blue-700 bg-blue-50'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                  aria-label="필터 토글"
                  aria-expanded={showFilters}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                  필터
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* 통계 카드 섹션 */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ContentStats cards={statsCards} />
        </section>

        {/* 메인 콘텐츠 영역 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* 에러 표시 */}
          {error && (
            <div className="mb-6">
              <ErrorAlert
                title="콘텐츠 로드 오류"
                message={error}
                onRetry={handleRefresh}
                onDismiss={clearError}
              />
            </div>
          )}

          {/* 필터 패널 */}
          {showFilters && (
            <div className="mb-6">
              <ContentFilters
                onFilterChange={setFilters}
                onReset={resetFilters}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )}

          {/* 탭 네비게이션 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* 탭 헤더 */}
            <div className="border-b border-gray-200">
              <nav
                className="flex space-x-8 px-6"
                aria-label="콘텐츠 카테고리"
                role="tablist"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => handleTabChange(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                        {totalCounts[`${tab.id}s`] || 0}
                      </span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* 탭 콘텐츠 */}
            <div
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
              className="p-6"
            >
              {/* 배치 작업 툴바 */}
              {hasSelection && (
                <div className="mb-4">
                  <ContentActions
                    selectedCount={selectedItems.length}
                    isAllSelected={isAllSelected}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    contentType={activeTab}
                  />
                </div>
              )}

              {/* 콘텐츠 테이블 */}
              <ContentTable
                data={currentTabData}
                contentType={activeTab}
                selectedItems={selectedItems}
                onSelectItem={selectItem}
                onSelectAll={selectAll}
                onSortChange={setSortConfig}
                loading={loading.content}
              />

              {/* 빈 상태 */}
              {!loading.content && currentTabData.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">
                    {TABS.find(tab => tab.id === activeTab)?.icon}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {TABS.find(tab => tab.id === activeTab)?.label}이 없습니다
                  </h3>
                  <p className="text-gray-600 mb-6">
                    첫 번째 콘텐츠를 생성해보세요.
                  </p>
                  <button
                    onClick={() => {/* 생성 페이지로 이동 */}}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    새 {TABS.find(tab => tab.id === activeTab)?.label} 생성
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 스크린 리더용 라이브 리전 */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {loading.content && '콘텐츠 로딩 중...'}
          {!loading.content && `${currentTabData.length}개의 ${TABS.find(tab => tab.id === activeTab)?.label} 항목이 있습니다.`}
          {hasSelection && `${selectedItems.length}개 항목이 선택되었습니다.`}
        </div>
      </div>
    </ErrorBoundary>
  );
}