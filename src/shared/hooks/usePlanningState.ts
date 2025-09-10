/**
 * Planning 상태 관리 훅
 * FSD Architecture - Shared Layer Hook
 */

import { useState, useEffect } from 'react';
import type { PlanningState, PlanningItem, VideoItem, ScenarioItem, PromptItem, ImageAsset } from '@/entities/planning';

export function usePlanningState() {
  const [activeTab, setActiveTab] = useState<'scenario' | 'prompt' | 'image' | 'video'>('scenario');
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [scenarioItems, setScenarioItems] = useState<ScenarioItem[]>([]);
  const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageAsset[]>([]);
  const [videoItems, setVideoItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);

  // 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');

  // 배치 작업 상태
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [showBatchMenu, setShowBatchMenu] = useState(false);

  // 편집 상태
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [viewingItem, setViewingItem] = useState<PlanningItem | null>(null);

  // 새 아이템 생성 상태
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createItemType, setCreateItemType] = useState<'scenario' | 'prompt' | 'image' | 'video'>('scenario');
  const [newItemData, setNewItemData] = useState<Partial<PlanningItem>>({});

  // 데이터 로딩 함수
  const loadPlanningData = async () => {
    setLoading(true);
    try {
      // Mock 데이터 로딩 로직 (실제 API 호출로 대체 예정)
      const sampleScenarios: ScenarioItem[] = [
        {
          id: 'sc-1',
          title: 'E-commerce 상품 소개',
          version: 'v1.2',
          author: 'Marketing Team',
          updatedAt: new Date().toISOString(),
          hasFourStep: true,
          hasTwelveShot: true,
          pdfUrl: '/api/planning/export/sc-1.pdf'
        },
        {
          id: 'sc-2', 
          title: '브랜드 스토리텔링',
          version: 'v2.0',
          author: 'Creative Team',
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          hasFourStep: false,
          hasTwelveShot: true
        }
      ];

      const samplePrompts: PromptItem[] = [
        {
          id: 'pr-1',
          scenarioTitle: 'E-commerce 상품 소개',
          version: 'v1.2',
          keywordCount: 15,
          shotCount: 12,
          quality: 'premium',
          createdAt: new Date().toISOString(),
          jsonUrl: '/api/planning/prompt/pr-1.json'
        }
      ];

      const sampleVideos: VideoItem[] = [
        {
          id: 'vid-1',
          title: 'E-commerce 상품 소개 - 메인',
          prompt: '고품질 상품 소개 영상을 위한 프롬프트...',
          provider: 'seedance',
          duration: 30,
          aspectRatio: '16:9',
          status: 'completed',
          videoUrl: '/videos/sample-1.mp4',
          thumbnailUrl: '/thumbnails/sample-1.jpg',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          jobId: 'job-123'
        }
      ];

      const sampleImages: ImageAsset[] = [
        {
          id: 'img-1',
          title: '상품 이미지 A',
          filename: 'product-a.jpg',
          fileSize: 245760,
          dimensions: '1920x1080',
          format: 'JPG',
          createdAt: new Date().toISOString(),
          tags: ['product', 'e-commerce'],
          url: '/images/product-a.jpg'
        }
      ];

      setScenarioItems(sampleScenarios);
      setPromptItems(samplePrompts);
      setVideoItems(sampleVideos);
      setImageItems(sampleImages);
      
    } catch (error) {
      console.error('Planning 데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 초기 데이터 로딩
  useEffect(() => {
    loadPlanningData();
  }, []);

  // 상태와 액션을 반환
  return {
    // 상태
    activeTab,
    planningItems,
    scenarioItems,
    promptItems,
    imageItems,
    videoItems,
    loading,
    selectedVideo,
    searchTerm,
    statusFilter,
    typeFilter,
    providerFilter,
    dateFilter,
    sortBy,
    selectedItems,
    batchMode,
    showBatchMenu,
    editingItem,
    viewingItem,
    showCreateDialog,
    createItemType,
    newItemData,

    // 액션
    setActiveTab,
    setPlanningItems,
    setScenarioItems,
    setPromptItems,
    setImageItems,
    setVideoItems,
    setLoading,
    setSelectedVideo,
    setSearchTerm,
    setStatusFilter,
    setTypeFilter,
    setProviderFilter,
    setDateFilter,
    setSortBy,
    setSelectedItems,
    setBatchMode,
    setShowBatchMenu,
    setEditingItem,
    setViewingItem,
    setShowCreateDialog,
    setCreateItemType,
    setNewItemData,
    loadPlanningData,
  };
}