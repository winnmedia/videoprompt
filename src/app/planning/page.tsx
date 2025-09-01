'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

interface PlanningItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'draft' | 'completed' | 'in-progress';
  type: 'scenario' | 'video' | 'image';
}

interface VideoItem {
  id: string;
  title: string;
  prompt: string;
  provider: 'seedance' | 'veo3' | 'mock';
  duration: number;
  aspectRatio: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  completedAt?: string;
  jobId?: string;
}

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'videos'>('plans');
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  
  // 검색 및 필터링 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // 편집/보기 모드 상태
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [viewingItem, setViewingItem] = useState<PlanningItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  
  // 새 기획안 생성 모드 상태
  const [createMode, setCreateMode] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PlanningItem>>({
    title: '',
    description: '',
    type: 'scenario',
    status: 'draft'
  });

  // 샘플 데이터 로드
  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = () => {
    // 샘플 기획안 데이터
    const samplePlans: PlanningItem[] = [
      {
        id: '1',
        title: '산맥 위의 일몰 영상',
        description: '아름다운 산맥 위로 지는 태양을 담은 5초 영상',
        createdAt: '2024-01-15T10:30:00Z',
        status: 'completed',
        type: 'video'
      },
      {
        id: '2',
        title: '바다 파도 영상',
        description: '깊은 파란 바다의 파도를 담은 8초 영상',
        createdAt: '2024-01-14T15:45:00Z',
        status: 'completed',
        type: 'video'
      },
      {
        id: '3',
        title: '마법의 숲 시나리오',
        description: '빛나는 버섯이 있는 마법의 숲을 배경으로 한 시나리오',
        createdAt: '2024-01-13T09:20:00Z',
        status: 'draft',
        type: 'scenario'
      }
    ];

    // 샘플 영상 데이터
    const sampleVideos: VideoItem[] = [
      {
        id: 'v1',
        title: '산맥 위의 일몰',
        prompt: 'a beautiful sunset over mountains',
        provider: 'seedance',
        duration: 5,
        aspectRatio: '16:9',
        status: 'completed',
        videoUrl: 'https://example.com/video1.mp4',
        thumbnailUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIHZpZXdCb3g9IjAgMCAxNjAgOTAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRjZCMzU7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRjc5MzFFO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkQyM0Y7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjIwIiByPSIxNSIgZmlsbD0iI0ZGRDIzRiIvPgogIDxwb2x5Z29uIHBvaW50cz0iMTYsNjMgNDgsMzYgODAsNTQgMTEyLDQ2IDE0NCw2MyIgZmlsbD0iIzJEMzc0OCIvPgogIDx0ZXh0IHg9IjgwIiB5PSI3NSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5LiA6Ie06rO8PC90ZXh0Pgo8L3N2Zz4=',
        createdAt: '2024-01-15T10:30:00Z',
        completedAt: '2024-01-15T10:35:00Z',
        jobId: 'cgt-20250825112943-ckpns'
      },
      {
        id: 'v2',
        title: '바다 파도',
        prompt: 'a deep blue ocean with waves',
        provider: 'seedance',
        duration: 8,
        aspectRatio: '9:16',
        status: 'completed',
        videoUrl: 'https://example.com/video2.mp4',
        thumbnailUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MCIgaGVpZ2h0PSIxNjAiIHZpZXdCb3g9IjAgMCA5MCAxNjAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzMTgyQ0U7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojNDI5OUUxO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2M0IzRUQ7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDxyZWN0IHg9IjAiIHk9Ijk2IiB3aWR0aD0iOTAiIGhlaWdodD0iNjQiIGZpbGw9IiMzMTgyQ0UiLz4KICA8dGV4dCB4PSI0NSIgeT0iMTQwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7rs7TsnbQ8L3RleHQ+Cjwvc3ZnPg==',
        createdAt: '2024-01-14T15:45:00Z',
        completedAt: '2024-01-14T15:53:00Z',
        jobId: 'cgt-20250825112952-pb2rp'
      },
      {
        id: 'v3',
        title: '마법의 숲',
        prompt: 'a magical forest with glowing mushrooms',
        provider: 'mock',
        duration: 10,
        aspectRatio: '21:9',
        status: 'completed',
        videoUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMTAwIiBoZWlnaHQ9IjkwMCIgdmlld0JveD0iMCAwIDIxMDAgOTAwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMjI1NDNEO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzM4QTE2OTtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojNjhEMzkxO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNiZykiLz4KICA8dGV4dCB4PSIxMDUwIiB5PSI0NTAiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjI3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7kuIDoh7Tqs7w8L3RleHQ+Cjwvc3ZnPg==',
        thumbnailUrl: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMTAiIGhlaWdodD0iOTAiIHZpZXdCb3g9IjAgMCAyMTAgOTAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMyMjU0M0Q7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMzhBMTY5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2OEQzOTE7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDx0ZXh0IHg9IjEwNSIgeT0iNzUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuyYgeyDgTwvdGV4dD4KPC9zdmc+',
        createdAt: '2024-01-13T09:20:00Z',
        completedAt: '2024-01-13T09:20:00Z'
      }
    ];

    setPlanningItems(samplePlans);
    setVideoItems(sampleVideos);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'queued': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '완료';
      case 'in-progress': return '진행중';
      case 'draft': return '초안';
      case 'queued': return '대기중';
      case 'processing': return '처리중';
      case 'failed': return '실패';
      default: return status;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'seedance': return 'Video';
      case 'veo3': return 'Video';
      case 'mock': return 'Mock';
      default: return 'Video';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleVideoSelect = (video: VideoItem) => {
    setSelectedVideo(video);
  };

  const handleDownloadVideo = (video: VideoItem) => {
    if (video.videoUrl) {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `${video.title}.mp4`;
      link.click();
    }
  };

  // 기획안 편집/보기 핸들러
  const handleEdit = (item: PlanningItem) => {
    setEditingItem(item);
    setEditMode(true);
    setViewMode(false);
  };

  const handleView = (item: PlanningItem) => {
    setViewingItem(item);
    setViewMode(true);
    setEditMode(false);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      setPlanningItems(prev => 
        prev.map(item => 
          item.id === editingItem.id ? editingItem : item
        )
      );
      setEditMode(false);
      setEditingItem(null);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingItem(null);
  };

  const handleCloseView = () => {
    setViewMode(false);
    setViewingItem(null);
  };

  // 새 기획안 생성 핸들러
  const handleCreateNew = () => {
    setCreateMode(true);
    setNewItem({
      title: '',
      description: '',
      type: 'scenario',
      status: 'draft'
    });
  };

  const handleSaveNew = () => {
    if (newItem.title && newItem.description) {
      const newPlanningItem: PlanningItem = {
        id: `plan-${Date.now()}`,
        title: newItem.title,
        description: newItem.description,
        type: newItem.type as any,
        status: newItem.status as any,
        createdAt: new Date().toISOString()
      };
      
      setPlanningItems(prev => [newPlanningItem, ...prev]);
      setCreateMode(false);
      setNewItem({
        title: '',
        description: '',
        type: 'scenario',
        status: 'draft'
      });
    }
  };

  const handleCancelCreate = () => {
    setCreateMode(false);
    setNewItem({
      title: '',
      description: '',
      type: 'scenario',
      status: 'draft'
    });
  };

  // 기획안 삭제 핸들러
  const handleDelete = (itemId: string) => {
    if (confirm('정말로 이 기획안을 삭제하시겠습니까?')) {
      setPlanningItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  // 필터링된 기획안 목록 계산
  const filteredPlanningItems = planningItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo size="lg" />
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/" className="text-gray-700 hover:text-primary-600 font-medium">
                홈
              </a>
              <a href="/wizard" className="text-gray-700 hover:text-primary-600 font-medium">
                AI 영상 생성
              </a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={handleCreateNew}>
                새 기획안
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">기획안 관리</h1>
          <p className="mt-2 text-gray-600">AI로 생성된 기획안과 영상을 관리하고 확인하세요</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('plans')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plans'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              기획안 목록 ({planningItems.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'videos'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              영상 수집 ({videoItems.length})
            </button>
          </nav>
        </div>

        {/* 기획안 목록 탭 */}
        {activeTab === 'plans' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-text">기획안 목록</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-text-lighter">
                    총 {filteredPlanningItems.length}개
                  </span>
                  <div className="flex items-center space-x-2">
                    <Button 
                      onClick={() => window.location.href = '/planning/create'}
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      🎬 영상 기획
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCreateNew}
                      className="btn-secondary"
                    >
                      <Icon name="plus" size="sm" />
                      간단 기획안
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* 검색 및 필터링 */}
              <div className="mt-4 space-y-3">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Icon 
                        name="search" 
                        size="sm" 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-lighter"
                      />
                      <input
                        type="text"
                        placeholder="기획안 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-primary pl-10"
                      />
                    </div>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                  >
                    <option value="all">모든 상태</option>
                    <option value="draft">초안</option>
                    <option value="in-progress">진행중</option>
                    <option value="completed">완료</option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                  >
                    <option value="all">모든 타입</option>
                    <option value="scenario">시나리오</option>
                    <option value="video">영상</option>
                    <option value="image">이미지</option>
                  </select>
                </div>
                
                {/* 필터 결과 표시 */}
                {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                  <div className="flex items-center space-x-2 text-sm text-text-light">
                    <span>필터링 결과:</span>
                    {searchTerm && (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                        검색: "{searchTerm}"
                      </span>
                    )}
                    {statusFilter !== 'all' && (
                      <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs">
                        상태: {getStatusText(statusFilter)}
                      </span>
                    )}
                    {typeFilter !== 'all' && (
                      <span className="bg-primary-50 text-primary-500 px-2 py-1 rounded-full text-xs">
                        타입: {typeFilter}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setTypeFilter('all');
                      }}
                      className="text-xs btn-ghost"
                    >
                      필터 초기화
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="divide-y divide-border">
              {filteredPlanningItems.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Icon name="projects" size="xl" className="mx-auto mb-4 text-text-lighter" />
                  <h3 className="text-lg font-medium text-text mb-2">기획안이 없습니다</h3>
                  <p className="text-text-light mb-4">
                    {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' 
                      ? '검색 조건에 맞는 기획안이 없습니다.' 
                      : '새로운 기획안을 생성해보세요.'}
                  </p>
                  {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                    <Button onClick={handleCreateNew} className="btn-primary">
                      첫 기획안 만들기
                    </Button>
                  )}
                </div>
              ) : (
                filteredPlanningItems.map((item) => (
                  <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            item.type === 'video' ? 'bg-primary-50 text-primary-500' :
                            item.type === 'image' ? 'bg-green-100 text-green-600' :
                            'bg-primary-50 text-primary-500'
                          }`}>
                            <Icon 
                              name={item.type === 'video' ? 'video' : item.type === 'image' ? 'image' : 'projects'} 
                              size="sm" 
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-lg font-medium text-text">{item.title}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                {getStatusText(item.status)}
                              </span>
                            </div>
                            <p className="text-sm text-text-light mt-1">{item.description}</p>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-text-lighter">
                              <span className="flex items-center space-x-1">
                                <Icon name="clock" size="sm" />
                                <span>{formatDate(item.createdAt)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Icon name="target" size="sm" />
                                <span>{item.type}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="flex items-center space-x-1 btn-secondary"
                        >
                          <Icon name="edit" size="sm" />
                          <span>편집</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleView(item)}
                          className="flex items-center space-x-1 btn-secondary"
                        >
                          <Icon name="check" size="sm" />
                          <span>보기</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="text-error hover:bg-error/10 border-error/30 hover:border-error/50 flex items-center space-x-1"
                        >
                          <Icon name="delete" size="sm" />
                          <span>삭제</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 영상 수집 탭 */}
        {activeTab === 'videos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 영상 목록 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">생성된 영상</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {videoItems.map((video) => (
                    <div 
                      key={video.id} 
                      className={`px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                        selectedVideo?.id === video.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => handleVideoSelect(video)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <img 
                            src={video.thumbnailUrl} 
                            alt={video.title}
                            className="w-20 h-12 object-cover rounded"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{video.title}</h3>
                          <p className="text-sm text-gray-600">{video.prompt}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>{getProviderIcon(video.provider)} {video.provider}</span>
                            <span>Duration: {video.duration}초</span>
                            <span>Ratio: {video.aspectRatio}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                              {getStatusText(video.status)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadVideo(video);
                            }}
                            disabled={!video.videoUrl || video.status !== 'completed'}
                          >
                            다운로드
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 영상 플레이어 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow sticky top-8">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">영상 플레이어</h2>
                </div>
                <div className="p-6">
                  {selectedVideo ? (
                    <div className="space-y-4">
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        {selectedVideo.videoUrl ? (
                          selectedVideo.videoUrl.startsWith('data:image/svg+xml') ? (
                            <img 
                              src={selectedVideo.videoUrl} 
                              alt={selectedVideo.title}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <video 
                              controls 
                              className="w-full h-full"
                              poster={selectedVideo.thumbnailUrl}
                            >
                              <source src={selectedVideo.videoUrl} type="video/mp4" />
                              브라우저가 비디오를 지원하지 않습니다.
                            </video>
                          )
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                              <Icon name="video" size="xl" className="mx-auto mb-2" />
                              <p>영상 URL이 없습니다</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium text-gray-900">{selectedVideo.title}</h3>
                        <p className="text-sm text-gray-600">{selectedVideo.prompt}</p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">제공자:</span>
                            <span className="ml-2">{getProviderIcon(selectedVideo.provider)} {selectedVideo.provider}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">지속시간:</span>
                            <span className="ml-2">{selectedVideo.duration}초</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">비율:</span>
                            <span className="ml-2">{selectedVideo.aspectRatio}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">상태:</span>
                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedVideo.status)}`}>
                              {getStatusText(selectedVideo.status)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          <p>생성일: {formatDate(selectedVideo.createdAt)}</p>
                          {selectedVideo.completedAt && (
                            <p>완료일: {formatDate(selectedVideo.completedAt)}</p>
                          )}
                          {selectedVideo.jobId && (
                            <p>작업 ID: {selectedVideo.jobId}</p>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => handleDownloadVideo(selectedVideo)}
                            disabled={!selectedVideo.videoUrl || selectedVideo.status !== 'completed'}
                            className="flex-1"
                          >
                            다운로드
                          </Button>
                          <Button variant="outline" className="flex-1">
                            재생성
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">
                      <Icon name="video" size="xl" className="mx-auto mb-4" />
                      <p>왼쪽에서 영상을 선택하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 편집 모달 */}
        {editMode && editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <h2 className="text-xl font-bold mb-4">기획안 편집</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({...editingItem, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    value={editingItem.description}
                    onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({...editingItem, status: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">초안</option>
                    <option value="in-progress">진행중</option>
                    <option value="completed">완료</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={handleCancelEdit}>
                  취소
                </Button>
                <Button onClick={handleSaveEdit}>
                  저장
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 보기 모달 */}
        {viewMode && viewingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">기획안 상세보기</h2>
                <Button variant="outline" size="sm" onClick={handleCloseView}>
                  닫기
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-medium text-gray-700">제목:</span>
                  <p className="mt-1 text-lg">{viewingItem.title}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">설명:</span>
                  <p className="mt-1">{viewingItem.description}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">타입:</span>
                  <p className="mt-1">{viewingItem.type}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">상태:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingItem.status)}`}>
                    {getStatusText(viewingItem.status)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">생성일:</span>
                  <p className="mt-1">{formatDate(viewingItem.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 새 기획안 생성 모달 */}
        {createMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <h2 className="text-xl font-bold mb-4">새 기획안 생성</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="기획안 제목을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="기획안에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">타입</label>
                    <select
                      value={newItem.type}
                      onChange={(e) => setNewItem({...newItem, type: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="scenario">시나리오</option>
                      <option value="video">영상</option>
                      <option value="image">이미지</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
                    <select
                      value={newItem.status}
                      onChange={(e) => setNewItem({...newItem, status: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">초안</option>
                      <option value="in-progress">진행중</option>
                      <option value="completed">완료</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={handleCancelCreate}>
                  취소
                </Button>
                <Button 
                  onClick={handleSaveNew}
                  disabled={!newItem.title || !newItem.description}
                >
                  생성
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
