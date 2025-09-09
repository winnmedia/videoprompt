'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/ui';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  thumbnailUrl?: string;
  data: any; // 템플릿 데이터 (시나리오, 프롬프트 등)
  isPublic: boolean;
  downloads: number;
  rating: number;
  createdAt: string;
}

const categories = [
  { id: 'all', name: '전체' },
  { id: 'scenario', name: '시나리오 템플릿' },
  { id: 'prompt', name: '프롬프트 템플릿' },
  { id: 'style', name: '스타일 프리셋' },
  { id: 'workflow', name: '워크플로우 템플릿' },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 템플릿 데이터 로드
  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/templates?category=${selectedCategory}&search=${encodeURIComponent(searchTerm)}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setTemplates(data.data);
        }
      }
    } catch (error) {
      console.error('Templates load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      // 템플릿 사용 로직 - 해당 워크플로우로 이동
      const response = await fetch(`/api/templates/use/${template.id}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          // 템플릿 유형에 따라 적절한 페이지로 이동
          if (template.category === 'scenario') {
            window.location.href = `/scenario?template=${template.id}`;
          } else if (template.category === 'prompt') {
            window.location.href = `/prompt-generator?template=${template.id}`;
          } else if (template.category === 'workflow') {
            window.location.href = `/workflow?template=${template.id}`;
          }
        }
      }
    } catch (error) {
      console.error('Use template error:', error);
    }
  };

  const handleSaveAsTemplate = async (templateData: Partial<Template>) => {
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
        credentials: 'include',
      });

      if (response.ok) {
        setShowCreateModal(false);
        loadTemplates();
      }
    } catch (error) {
      console.error('Save template error:', error);
    }
  };

  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="spinner" size="xl" className="mx-auto mb-4" />
          <p className="text-gray-600">템플릿을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">템플릿 라이브러리</h1>
              <p className="mt-2 text-gray-600">사전 제작된 템플릿으로 빠르게 시작하세요</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Icon name="plus" className="mr-2 h-4 w-4" />
              새 템플릿 생성
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 검색 및 필터 */}
        <div className="mb-8 flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          {/* 검색 */}
          <div className="flex-1">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="템플릿 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex space-x-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* 템플릿 그리드 */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="projects" size="xl" className="mx-auto mb-4 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">템플릿이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? '검색 조건에 맞는 템플릿이 없습니다.' : '첫 번째 템플릿을 생성해보세요.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* 템플릿 썸네일 */}
                <div className="aspect-video bg-gray-200 relative">
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="image" size="xl" className="text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-medium">
                      {categories.find(c => c.id === template.category)?.name || template.category}
                    </span>
                  </div>
                </div>

                {/* 템플릿 정보 */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {template.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {template.description}
                  </p>

                  {/* 태그 */}
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {template.tags.length > 3 && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                          +{template.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 통계 */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Icon name="user" className="h-4 w-4 mr-1" />
                      <span>{template.downloads} 사용</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-yellow-400">★</span>
                      <span className="ml-1">{template.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1"
                      size="sm"
                    >
                      사용하기
                    </Button>
                    <Button variant="outline" size="sm">
                      <Icon name="info" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 템플릿 생성 모달 (간단 버전) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">새 템플릿 생성</h3>
            <p className="text-gray-600 text-sm mb-4">
              현재 작업 중인 프로젝트를 템플릿으로 저장할 수 있는 기능은 향후 추가될 예정입니다.
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                취소
              </Button>
              <Button onClick={() => setShowCreateModal(false)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}