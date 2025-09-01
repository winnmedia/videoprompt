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
  codec?: string;
  version?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  refPromptTitle?: string;
  createdAt: string;
  completedAt?: string;
  jobId?: string;
}

interface ScenarioItem {
  id: string;
  title: string;
  version: string;
  author: string;
  updatedAt: string;
  hasFourStep: boolean;
  hasTwelveShot: boolean;
  pdfUrl?: string;
}

interface PromptItem {
  id: string;
  scenarioTitle: string;
  version: string;
  keywordCount: number;
  segmentCount: number;
  updatedAt: string;
}

interface ImageAsset {
  id: string;
  type: '콘티' | '인서트';
  tags: string[];
  resolution: string;
  uploader: string;
  uploadedAt: string;
  url?: string;
}

export default function PlanningPage() {
  const [activeTab, setActiveTab] = useState<'scenario' | 'prompt' | 'image' | 'video'>('scenario');
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [scenarioItems, setScenarioItems] = useState<ScenarioItem[]>([]);
  const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageAsset[]>([]);
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
    status: 'draft',
  });

  // 샘플 데이터 로드 → 서버 연동으로 대체(MVP: 시나리오/프롬프트/영상 목록)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [scRes, vaRes, prRes] = await Promise.all([
          fetch('/api/planning/scenarios'),
          fetch('/api/planning/video-assets'),
          fetch('/api/planning/prompt'),
        ]);
        const scJson = scRes.ok ? await scRes.json() : { ok: false };
        const vaJson = vaRes.ok ? await vaRes.json() : { ok: false };
        const prJson = prRes.ok ? await prRes.json() : { ok: false };
        if (scJson?.ok && Array.isArray(scJson.data)) {
          setScenarioItems(scJson.data);
        }
        if (vaJson?.ok && Array.isArray(vaJson.data)) {
          setVideoItems(vaJson.data);
        }
        if (prJson?.ok && Array.isArray(prJson.data)) {
          const mapped = prJson.data.map((p: any) => ({
            id: p.id,
            scenarioTitle: p.metadata?.title || '시나리오',
            version: `V${p.version}`,
            keywordCount: Array.isArray(p.metadata?.keywords) ? p.metadata.keywords.length : 0,
            segmentCount: Array.isArray(p.timeline) ? p.timeline.length : 0,
            updatedAt: p.createdAt,
          }));
          setPromptItems(mapped);
        }
        if (!scJson?.ok || !vaJson?.ok) {
          loadSampleData();
        }
      } catch {
        loadSampleData();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSampleData = () => {
    const sampleScenarios: ScenarioItem[] = [
      {
        id: 's1',
        title: '마법의 숲 시나리오',
        version: 'V3',
        author: '홍길동',
        updatedAt: '2024-01-16T11:20:00Z',
        hasFourStep: true,
        hasTwelveShot: true,
        pdfUrl: '#',
      },
      {
        id: 's2',
        title: '산맥 위의 일몰 시나리오',
        version: 'V1',
        author: '이영희',
        updatedAt: '2024-01-15T09:05:00Z',
        hasFourStep: true,
        hasTwelveShot: false,
      },
    ];

    const samplePrompts: PromptItem[] = [
      {
        id: 'p1',
        scenarioTitle: '마법의 숲 시나리오',
        version: 'V3',
        keywordCount: 12,
        segmentCount: 8,
        updatedAt: '2024-01-16T12:00:00Z',
      },
      {
        id: 'p2',
        scenarioTitle: '산맥 위의 일몰 시나리오',
        version: 'V1',
        keywordCount: 9,
        segmentCount: 6,
        updatedAt: '2024-01-15T10:10:00Z',
      },
    ];

    const sampleImages: ImageAsset[] = [
      {
        id: 'img1',
        type: '콘티',
        tags: ['숲', '밤', '버섯'],
        resolution: '1920x1080',
        uploader: '홍길동',
        uploadedAt: '2024-01-14T08:45:00Z',
      },
      {
        id: 'img2',
        type: '인서트',
        tags: ['산맥', '일몰'],
        resolution: '1080x1920',
        uploader: '이영희',
        uploadedAt: '2024-01-13T14:20:00Z',
      },
    ];

    const sampleVideos: VideoItem[] = [
      {
        id: 'v1',
        title: '산맥 위의 일몰',
        prompt: 'a beautiful sunset over mountains',
        provider: 'seedance',
        duration: 5,
        aspectRatio: '16:9',
        codec: 'H.264',
        version: 'V1',
        status: 'completed',
        refPromptTitle: '산맥 일몰 프롬프트',
        videoUrl: 'https://example.com/video1.mp4',
        thumbnailUrl:
          'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIHZpZXdCb3g9IjAgMCAxNjAgOTAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRjZCMzU7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRjc5MzFFO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkQyM0Y7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDxjaXJjbGUgY3g9IjEyMCIgY3k9IjIwIiByPSIxNSIgZmlsbD0iI0ZGRDIzRiIvPgogIDxwb2x5Z29uIHBvaW50cz0iMTYsNjMgNDgsMzYgODAsNTQgMTEyLDQ2IDE0NCw2MyIgZmlsbD0iIzJEMzc0OCIvPgogIDx0ZXh0IHg9IjgwIiB5PSI3NSIgZmlsbD0id2hpdGUiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+5LiA6Ie06rO8PC90ZXh0Pgo8L3N2Zz4=',
        createdAt: '2024-01-15T10:30:00Z',
        completedAt: '2024-01-15T10:35:00Z',
        jobId: 'cgt-20250825112943-ckpns',
      },
      {
        id: 'v2',
        title: '바다 파도',
        prompt: 'a deep blue ocean with waves',
        provider: 'seedance',
        duration: 8,
        aspectRatio: '9:16',
        codec: 'H.265',
        version: 'V2',
        status: 'completed',
        refPromptTitle: '바다 파도 프롬프트',
        videoUrl: 'https://example.com/video2.mp4',
        thumbnailUrl:
          'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5MCIgaGVpZ2h0PSIxNjAiIHZpZXdCb3g9IjAgMCA5MCAxNjAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJiZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMzMTgyQ0U7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdHlsZT0ic3RvcC1jb2xvcjojNDI5OUUxO3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2M0IzRUQ7c3RvcC1vcGFjaXR5OjEiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDxyZWN0IHg9IjAiIHk9Ijk2IiB3aWR0aD0iOTAiIGhlaWdodD0iNjQiIGZpbGw9IiMzMTgyQ0UiLz4KICA8dGV4dCB4PSI0NSIgeT0iMTQwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7rs7TsnbQ8L3RleHQ+Cjwvc3ZnPg==',
        createdAt: '2024-01-14T15:45:00Z',
        completedAt: '2024-01-14T15:53:00Z',
        jobId: 'cgt-20250825112952-pb2rp',
      },
    ];

    setScenarioItems(sampleScenarios);
    setPromptItems(samplePrompts);
    setImageItems(sampleImages);
    setVideoItems(sampleVideos);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in-progress':
        return 'text-blue-600 bg-blue-100';
      case 'draft':
        return 'text-gray-600 bg-gray-100';
      case 'queued':
        return 'text-yellow-600 bg-yellow-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'in-progress':
        return '진행중';
      case 'draft':
        return '초안';
      case 'queued':
        return '대기중';
      case 'processing':
        return '처리중';
      case 'failed':
        return '실패';
      default:
        return status;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'seedance':
        return 'Video';
      case 'veo3':
        return 'Video';
      case 'mock':
        return 'Mock';
      default:
        return 'Video';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      setPlanningItems((prev) =>
        prev.map((item) => (item.id === editingItem.id ? editingItem : item)),
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
      status: 'draft',
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
        createdAt: new Date().toISOString(),
      };

      setPlanningItems((prev) => [newPlanningItem, ...prev]);
      setCreateMode(false);
      setNewItem({
        title: '',
        description: '',
        type: 'scenario',
        status: 'draft',
      });
    }
  };

  const handleCancelCreate = () => {
    setCreateMode(false);
    setNewItem({
      title: '',
      description: '',
      type: 'scenario',
      status: 'draft',
    });
  };

  // 기획안 삭제 핸들러
  const handleDelete = (itemId: string) => {
    if (confirm('정말로 이 기획안을 삭제하시겠습니까?')) {
      setPlanningItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  // 필터링된 기획안 목록 계산
  const filteredPlanningItems = planningItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo size="lg" />
            <nav className="hidden items-center space-x-8 md:flex">
              <a href="/" className="font-medium text-gray-700 hover:text-primary-600">
                홈
              </a>
              <a href="/wizard" className="font-medium text-gray-700 hover:text-primary-600">
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">기획안 관리</h1>
          <p className="mt-2 text-gray-600">AI로 생성된 기획안과 영상을 관리하고 확인하세요</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" role="tablist">
            <button
              data-testid="tab-scenario"
              onClick={() => setActiveTab('scenario')}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === 'scenario'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              AI 시나리오 ({scenarioItems.length})
            </button>
            <button
              data-testid="tab-prompt"
              onClick={() => setActiveTab('prompt')}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === 'prompt'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              프롬프트 ({promptItems.length})
            </button>
            <button
              data-testid="tab-image"
              onClick={() => setActiveTab('image')}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === 'image'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              이미지 ({imageItems.length})
            </button>
            <button
              data-testid="tab-video"
              onClick={() => setActiveTab('video')}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === 'video'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              영상 ({videoItems.length})
            </button>
          </nav>
        </div>

        {/* AI 시나리오 탭 */}
        {activeTab === 'scenario' && (
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">AI 시나리오</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      제목
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      버전
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      작성자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      업데이트
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      4단계/12숏
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {scenarioItems.map((s) => (
                    <tr key={s.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{s.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{s.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{s.author}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(s.updatedAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {s.hasFourStep ? 'Y' : 'N'} / {s.hasTwelveShot ? 'Y' : 'N'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {s.pdfUrl && (
                          <a
                            href={s.pdfUrl}
                            className="text-sm text-primary-600 hover:text-primary-800"
                          >
                            PDF 다운로드
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scenarioItems.length === 0 && (
                <div className="p-6 text-center text-gray-500">시나리오가 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* 프롬프트 탭 */}
        {activeTab === 'prompt' && (
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">프롬프트</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      참조 시나리오
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      버전
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      키워드 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      세그먼트 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      업데이트
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {promptItems.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{p.scenarioTitle}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.keywordCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{p.segmentCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{formatDate(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {promptItems.length === 0 && (
                <div className="p-6 text-center text-gray-500">프롬프트가 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* 이미지 탭 */}
        {activeTab === 'image' && (
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-medium text-gray-900">이미지</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      타입
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      태그
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      해상도
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      업로더
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      업로드일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {imageItems.map((img) => (
                    <tr key={img.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{img.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{img.tags.join(', ')}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{img.resolution}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{img.uploader}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(img.uploadedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {imageItems.length === 0 && (
                <div className="p-6 text-center text-gray-500">이미지가 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* 영상 탭 */}
        {activeTab === 'video' && (
          <div className="space-y-8">
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-medium text-gray-900">영상</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        버전
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        제목
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        길이
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        코덱
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        상태
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        제공자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        참조 프롬프트
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        생성시간
                      </th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {videoItems.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-700">{v.version || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{v.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{v.duration}s</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{v.codec || '-'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(v.status)}`}
                          >
                            {getStatusText(v.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{v.provider}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {v.refPromptTitle || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(v.createdAt)}
                        </td>
                        <td className="space-x-2 px-6 py-4 text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedVideo(v)}>
                            보기
                          </Button>
                          <a
                            href={`/feedback?videoId=${v.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-secondary-300 bg-transparent px-3 text-xs text-secondary-700 hover:bg-secondary-50"
                          >
                            피드백
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadVideo(v)}
                            disabled={!v.videoUrl || v.status !== 'completed'}
                          >
                            다운로드
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {videoItems.length === 0 && (
                  <div className="p-6 text-center text-gray-500">영상이 없습니다</div>
                )}
              </div>
            </div>

            {/* 선택된 영상 상세/플레이어 */}
            <div className="rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-medium text-gray-900">영상 플레이어</h2>
              </div>
              <div className="p-6">
                {selectedVideo ? (
                  <div className="space-y-4">
                    <div className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                      {selectedVideo.videoUrl ? (
                        selectedVideo.videoUrl.startsWith('data:image/svg+xml') ? (
                          <img
                            src={selectedVideo.videoUrl}
                            alt={selectedVideo.title}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <video
                            controls
                            className="h-full w-full"
                            poster={selectedVideo.thumbnailUrl}
                          >
                            <source src={selectedVideo.videoUrl} type="video/mp4" />
                            브라우저가 비디오를 지원하지 않습니다.
                          </video>
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-500">
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
                          <span className="ml-2">
                            {getProviderIcon(selectedVideo.provider)} {selectedVideo.provider}
                          </span>
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
                          <span
                            className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(selectedVideo.status)}`}
                          >
                            {getStatusText(selectedVideo.status)}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-500">
                        <p>생성일: {formatDate(selectedVideo.createdAt)}</p>
                        {selectedVideo.completedAt && (
                          <p>완료일: {formatDate(selectedVideo.completedAt)}</p>
                        )}
                        {selectedVideo.jobId && <p>작업 ID: {selectedVideo.jobId}</p>}
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleDownloadVideo(selectedVideo)}
                          disabled={!selectedVideo.videoUrl || selectedVideo.status !== 'completed'}
                          className="flex-1"
                        >
                          다운로드
                        </Button>
                        <a
                          href={`/feedback?videoId=${selectedVideo.id}`}
                          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-secondary-300 bg-transparent text-secondary-700 hover:bg-secondary-50"
                        >
                          피드백으로 이동
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-500">
                    <Icon name="video" size="xl" className="mx-auto mb-4" />
                    <p>위 표에서 영상을 선택하세요</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 편집 모달 */}
        {editMode && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">기획안 편집</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    value={editingItem.description}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, description: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">상태</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, status: e.target.value as any })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">초안</option>
                    <option value="in-progress">진행중</option>
                    <option value="completed">완료</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelEdit}>
                  취소
                </Button>
                <Button onClick={handleSaveEdit}>저장</Button>
              </div>
            </div>
          </div>
        )}

        {/* 보기 모달 */}
        {viewMode && viewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6">
              <div className="mb-4 flex items-start justify-between">
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
                  <span
                    className={`ml-2 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(viewingItem.status)}`}
                  >
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-2xl rounded-lg bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">새 기획안 생성</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="기획안 제목을 입력하세요"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="기획안에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">타입</label>
                    <select
                      value={newItem.type}
                      onChange={(e) => setNewItem({ ...newItem, type: e.target.value as any })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="scenario">시나리오</option>
                      <option value="video">영상</option>
                      <option value="image">이미지</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">상태</label>
                    <select
                      value={newItem.status}
                      onChange={(e) => setNewItem({ ...newItem, status: e.target.value as any })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">초안</option>
                      <option value="in-progress">진행중</option>
                      <option value="completed">완료</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelCreate}>
                  취소
                </Button>
                <Button onClick={handleSaveNew} disabled={!newItem.title || !newItem.description}>
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
