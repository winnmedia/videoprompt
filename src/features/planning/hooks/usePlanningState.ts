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
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
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

  // 데이터 로딩 함수 (통합 API 호출로 중복 호출 방지)
  const loadPlanningData = async () => {
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

    // 이미 로딩 중이거나 최근에 로딩했다면 중단
    if (loading || (now - lastLoadTime < CACHE_DURATION)) {
      console.log('⚠️ Planning 데이터 로딩 건너뜀 (캐시된 데이터 사용)');
      return;
    }

    setLoading(true);
    try {
      // 단일 통합 API 호출로 모든 데이터를 한 번에 가져옴
      const response = await safeFetch('/api/planning/dashboard');

      if (response.ok) {
        const dashboardData = await response.json();
        const data = dashboardData.data;

        // 시나리오 데이터 설정
        const scenarios: ScenarioItem[] = data.scenarios?.map((s: any) => ({
          id: s.id,
          title: s.title,
          version: s.version || 'V1',
          author: s.author || 'AI Generated',
          updatedAt: s.updatedAt,
          hasFourStep: s.hasFourStep || false,
          hasTwelveShot: s.hasTwelveShot || false,
          pdfUrl: s.pdfUrl
        })) || [];
        setScenarioItems(scenarios);

        // 프롬프트 데이터 설정
        const prompts: PromptItem[] = data.prompts?.map((p: any) => ({
          id: p.id,
          scenarioTitle: p.scenarioTitle || 'Unknown',
          version: p.version || 'V1',
          keywordCount: p.keywordCount || 0,
          shotCount: p.segmentCount || 1,
          quality: p.quality || 'standard',
          createdAt: p.createdAt,
          jsonUrl: p.jsonUrl || `/api/planning/prompt/${p.id}.json`
        })) || [];
        setPromptItems(prompts);

        // 비디오 데이터 설정
        const videos: VideoItem[] = data.videos?.map((v: any) => ({
          id: v.id,
          title: v.title || 'Untitled Video',
          prompt: v.prompt || '',
          provider: v.provider || 'unknown',
          duration: v.duration || 10,
          aspectRatio: v.aspectRatio || '16:9',
          status: v.status || 'queued',
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          createdAt: v.createdAt,
          completedAt: v.completedAt,
          jobId: v.jobId
        })) || [];
        setVideoItems(videos);

        // 이미지 자산은 빈 배열로 설정
        setImageItems([]);

        console.log(`✅ Planning Dashboard 데이터 로딩 완료:`, data.summary);

        // 로딩 시간 업데이트
        setLastLoadTime(now);
      } else {
        console.error('Dashboard API 응답 실패:', response.status);
        throw new Error(`Dashboard API 호출 실패: ${response.status}`);
      }

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