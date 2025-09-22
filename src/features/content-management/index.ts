/**
 * Content Management Feature Public API
 * features 레이어 공개 인터페이스
 */

// 비즈니스 로직 훅 내보내기
export { useContentManagement } from './hooks/useContentManagement';
export { useContentStats } from './hooks/useContentStats';

// 재사용 가능한 타입 (features 레이어 전용)
export type {
  ContentManagementHookReturn,
  ContentStatsHookReturn,
} from './types';

/**
 * Hook 반환 타입 정의
 */
interface ContentManagementHookReturn {
  // 데이터
  content: any;
  activeTabContent: any[];
  filteredContent: any[];
  sortedContent: any[];
  selectedItems: string[];
  stats: any;
  totalCounts: Record<string, number>;

  // 상태
  loading: any;
  error: string | null;
  isStale: boolean;
  hasSelection: boolean;
  isAllSelected: boolean;

  // 액션
  fetchContent: (filters?: any, force?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  refreshData: (includeStats?: boolean) => Promise<void>;
  changeTab: (tab: any) => void;
  setFilters: (filters: any) => void;
  resetFilters: () => void;
  setSearch: (search: string) => void;
  setSortConfig: (config: any) => void;
  setPagination: (config: any) => void;
  selectItem: (itemId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  bulkDelete: (itemIds?: string[]) => Promise<any>;
  bulkArchive: (itemIds?: string[]) => Promise<any>;
  bulkActivate: (itemIds?: string[]) => Promise<any>;
  bulkAddTags: (tags: string[], itemIds?: string[]) => Promise<any>;
  bulkRemoveTags: (tags: string[], itemIds?: string[]) => Promise<any>;
  handleRealtimeUpdate: (event: any) => void;
  clearError: () => void;
}

interface ContentStatsHookReturn {
  // 통계 데이터
  stats: any;
  localStats: any;
  typeGrowth: any;
  activitySummary: any;

  // 상태
  loading: boolean;
  wsConnected: boolean;
  isStale: boolean;

  // 액션
  refreshStats: () => void;
  requestTypeStats: (type: any) => void;

  // 유틸리티
  getTotalCount: (type: any) => number;
  getGrowthPercentage: (type: any) => number;
  getTopTags: (limit?: number) => any[];
  getRecentActivity: (limit?: number) => any[];
  getPopularContent: (limit?: number) => any[];
}