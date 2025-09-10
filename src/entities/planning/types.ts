/**
 * Planning 엔티티 타입 정의
 * FSD Architecture - Domain Layer
 */

export interface PlanningItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'draft' | 'completed' | 'in-progress';
  type: 'scenario' | 'video' | 'image';
}

export interface VideoItem {
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

export interface ScenarioItem {
  id: string;
  title: string;
  version: string;
  author: string;
  updatedAt: string;
  hasFourStep: boolean;
  hasTwelveShot: boolean;
  pdfUrl?: string;
}

export interface PromptItem {
  id: string;
  scenarioTitle: string;
  version: string;
  keywordCount: number;
  shotCount: number;
  quality: 'standard' | 'premium';
  createdAt: string;
  jsonUrl?: string;
}

export interface ImageAsset {
  id: string;
  title: string;
  filename: string;
  fileSize: number;
  dimensions: string;
  format: string;
  createdAt: string;
  tags?: string[];
  url?: string;
}

export interface PlanningState {
  activeTab: 'scenario' | 'prompt' | 'image' | 'video';
  planningItems: PlanningItem[];
  scenarioItems: ScenarioItem[];
  promptItems: PromptItem[];
  imageItems: ImageAsset[];
  videoItems: VideoItem[];
  loading: boolean;
  selectedVideo: VideoItem | null;
  
  // 필터 상태
  searchTerm: string;
  statusFilter: string;
  typeFilter: string;
  providerFilter: string;
  dateFilter: string;
  sortBy: string;
  
  // 배치 작업 상태
  selectedItems: Set<string>;
  batchMode: boolean;
  showBatchMenu: boolean;
  
  // 편집 상태
  editingItem: PlanningItem | null;
  viewingItem: PlanningItem | null;
  
  // 새 아이템 생성 상태
  showCreateDialog: boolean;
  createItemType: 'scenario' | 'prompt' | 'image' | 'video';
  newItemData: Partial<PlanningItem>;
}