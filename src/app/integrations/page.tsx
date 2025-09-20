'use client';

import React, { useState, useMemo } from 'react';
import { IntegrationGrid } from '@/shared/ui';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';
import { logger } from '@/shared/lib/logger';
import {


  videoPlanetIntegrations,
  integrationCategories,
  getIntegrationsByCategory,
  searchIntegrations,
  type VideoPlanetIntegration,} from '@/lib/integrations';

export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);

  // 필터링된 통합 목록
  const filteredIntegrations = useMemo(() => {
    let integrations = videoPlanetIntegrations;

    // 카테고리 필터링
    if (selectedCategory !== 'All') {
      integrations = getIntegrationsByCategory(selectedCategory);
    }

    // 검색 필터링
    if (searchQuery.trim()) {
      integrations = searchIntegrations(searchQuery);
    }

    // 연결된 서비스만 표시
    if (showConnectedOnly) {
      integrations = integrations.filter((integration) => integration.status === 'connected');
    }

    return integrations;
  }, [selectedCategory, searchQuery, showConnectedOnly]);

  // 통계 정보
  const stats = useMemo(() => {
    const total = videoPlanetIntegrations.length;
    const connected = videoPlanetIntegrations.filter((i) => i.status === 'connected').length;
    const pending = videoPlanetIntegrations.filter((i) => i.status === 'pending').length;
    const disconnected = videoPlanetIntegrations.filter((i) => i.status === 'disconnected').length;

    return { total, connected, pending, disconnected };
  }, []);

  // 이벤트 핸들러
  const handleConnect = (id: string) => {
    logger.info('Connecting to:', id);
  };

  const handleDisconnect = (id: string) => {
    logger.info('Disconnecting from:', id);
  };

  const handleConfigure = (id: string) => {
    logger.info('Configuring:', id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">서비스 통합</h1>
              <p className="mt-2 text-lg text-gray-600">
                VideoPlanet과 다양한 서비스를 연결하여 더욱 강력한 영상 제작 경험을 제공합니다.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button size="lg">
                <Icon name="plus" size="sm" className="mr-2" />새 통합 추가
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">전체 서비스</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.connected}</div>
              <div className="text-sm text-gray-500">연결됨</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">연결 중</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.disconnected}</div>
              <div className="text-sm text-gray-500">연결 안됨</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Category Filter */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">카테고리</label>
              <select
                data-testid="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {integrationCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">검색</label>
              <div className="relative">
                <Icon
                  name="search"
                  size="sm"
                  className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400"
                />
                <input
                  data-testid="search-input"
                  type="text"
                  placeholder="서비스 이름이나 설명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Connected Only Toggle */}
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showConnectedOnly}
                  onChange={(e) => setShowConnectedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">연결된 서비스만</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Results Info */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {filteredIntegrations.length}개의 서비스를 찾았습니다
            </div>
            <div className="text-sm text-gray-500">
              {selectedCategory !== 'All' && `카테고리: ${selectedCategory}`}
            </div>
          </div>
        </div>

        {/* Integrations Grid */}
        <IntegrationGrid
          integrations={filteredIntegrations}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onConfigure={handleConfigure}
        />
      </div>
    </div>
  );
}
