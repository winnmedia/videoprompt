/**
 * Planning 상태 관리 훅
 * FSD Architecture - Shared Layer Hook
 */

import { useState, useEffect } from 'react';
import type { PlanningState, PlanningItem, VideoItem, ScenarioItem, PromptItem, ImageAsset } from '@/entities/planning';
import { safeFetch } from '@/shared/lib/api-retry';

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

  // 데이터 로딩 함수 (실제 API 호출)
  const loadPlanningData = async () => {
    setLoading(true);
    try {
      // 실제 API 호출로 데이터 로딩
      const [scenariosRes, promptsRes, videosRes] = await Promise.all([
        safeFetch('/api/planning/scenarios'),
        safeFetch('/api/planning/prompt'), 
        safeFetch('/api/planning/videos')
      ]);

      // 시나리오 데이터 처리
      if (scenariosRes.ok) {
        const scenariosData = await scenariosRes.json();
        const scenarios: ScenarioItem[] = scenariosData.scenarios?.map((s: any) => ({
          id: s.id,
          title: s.title,
          version: s.version || 'v1.0',
          author: s.userId || 'User',
          updatedAt: s.updatedAt,
          hasFourStep: !!s.structure4,
          hasTwelveShot: !!s.shots12,
          pdfUrl: s.pdfUrl
        })) || [];
        setScenarioItems(scenarios);
      }

      // 프롬프트 데이터 처리
      if (promptsRes.ok) {
        const promptsData = await promptsRes.json();
        const prompts: PromptItem[] = promptsData.prompts?.map((p: any) => ({
          id: p.id,
          scenarioTitle: p.scenarioId || 'Unknown',
          version: p.version?.toString() || 'v1.0',
          keywordCount: p.metadata?.keywords?.length || 0,
          shotCount: p.timeline?.length || 0,
          quality: p.metadata?.quality || 'standard',
          createdAt: p.createdAt,
          jsonUrl: `/api/planning/prompt/${p.id}.json`
        })) || [];
        setPromptItems(prompts);
      }

      // 비디오 데이터 처리
      if (videosRes.ok) {
        const videosData = await videosRes.json();
        const videos: VideoItem[] = videosData.videos?.map((v: any) => ({
          id: v.id,
          title: v.title || 'Untitled Video',
          prompt: v.prompt || '',
          provider: v.provider,
          duration: v.duration,
          aspectRatio: '16:9', // 기본값
          status: v.status,
          videoUrl: v.url,
          thumbnailUrl: v.thumbnailUrl,
          createdAt: v.createdAt,
          completedAt: v.completedAt,
          jobId: v.jobId
        })) || [];
        setVideoItems(videos);
      }

      // 이미지 자산은 별도 API 없으므로 빈 배열로 설정
      setImageItems([]);
      
    } catch (error) {
      console.error('Planning 데이터 로딩 실패:', error);
      // 에러 발생 시 빈 배열로 초기화
      setScenarioItems([]);
      setPromptItems([]);
      setVideoItems([]);
      setImageItems([]);
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