/**
 * Content Management Redux Slice
 * 콘텐츠 관리 전역 상태 관리
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type {
  Content,
  ContentFilters,
  SortConfig,
  PaginationConfig,
  ContentStats,
  BatchAction,
  BatchActionResult,
  RealtimeEvent,
  ContentType,
} from '../model/types';
import { DEFAULT_FILTERS, DEFAULT_SORT, DEFAULT_PAGINATION } from '../model/types';

/**
 * 슬라이스 상태 인터페이스
 */
interface ContentManagementState {
  // 콘텐츠 데이터
  content: {
    scenarios: Content[];
    prompts: Content[];
    images: Content[];
    videos: Content[];
  };

  // 필터링된 결과
  filteredContent: Content[];

  // 선택된 아이템들
  selectedItems: string[];

  // 현재 활성 탭
  activeTab: ContentType;

  // 필터 설정
  filters: ContentFilters;

  // 정렬 설정
  sortConfig: SortConfig;

  // 페이지네이션
  pagination: PaginationConfig;

  // 통계 데이터
  stats: ContentStats | null;

  // 로딩 상태
  loading: {
    content: boolean;
    stats: boolean;
    batchAction: boolean;
  };

  // 에러 상태
  error: string | null;

  // 캐시 관리
  cache: {
    lastFetch: number | null;
    staleTime: number; // 5분
  };

  // 실시간 연결 상태
  websocket: {
    connected: boolean;
    reconnectCount: number;
  };
}

/**
 * 초기 상태
 */
const initialState: ContentManagementState = {
  content: {
    scenarios: [],
    prompts: [],
    images: [],
    videos: [],
  },
  filteredContent: [],
  selectedItems: [],
  activeTab: 'scenario',
  filters: DEFAULT_FILTERS,
  sortConfig: DEFAULT_SORT,
  pagination: DEFAULT_PAGINATION,
  stats: null,
  loading: {
    content: false,
    stats: false,
    batchAction: false,
  },
  error: null,
  cache: {
    lastFetch: null,
    staleTime: 5 * 60 * 1000, // 5분
  },
  websocket: {
    connected: false,
    reconnectCount: 0,
  },
};

/**
 * 비동기 액션들
 */

// 콘텐츠 목록 조회
export const fetchContent = createAsyncThunk(
  'contentManagement/fetchContent',
  async (params: { filters?: ContentFilters; force?: boolean } = {}) => {
    const { filters = {}, force = false } = params;

    // 캐시 검사 ($300 사건 방지)
    const now = Date.now();
    const lastFetch = JSON.parse(localStorage.getItem('content-cache-time') || '0');

    if (!force && now - lastFetch < 60000) { // 1분 내 중복 호출 방지
      const cached = localStorage.getItem('content-cache');
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const queryParams = new URLSearchParams();

    if (filters.type) queryParams.append('type', filters.type);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.tags?.length) queryParams.append('tags', filters.tags.join(','));
    if (filters.dateRange) {
      queryParams.append('startDate', filters.dateRange.start);
      queryParams.append('endDate', filters.dateRange.end);
    }

    const response = await fetch(`/api/planning/content?${queryParams}`);

    if (!response.ok) {
      throw new Error(`콘텐츠 조회 실패: ${response.status}`);
    }

    const data = await response.json();

    // 캐시 저장
    localStorage.setItem('content-cache', JSON.stringify(data));
    localStorage.setItem('content-cache-time', JSON.stringify(now));

    return data;
  },
  {
    condition: (params, { getState }) => {
      const state = getState() as { contentManagement: ContentManagementState };

      // 이미 로딩 중이면 중복 요청 방지
      if (state.contentManagement.loading.content) {
        return false;
      }

      // force가 false이고 캐시가 유효하면 요청 스킵
      if (!params?.force && state.contentManagement.cache.lastFetch) {
        const isStale = Date.now() - state.contentManagement.cache.lastFetch > state.contentManagement.cache.staleTime;
        if (!isStale) {
          return false;
        }
      }

      return true;
    },
  }
);

// 통계 데이터 조회
export const fetchStats = createAsyncThunk(
  'contentManagement/fetchStats',
  async () => {
    const response = await fetch('/api/planning/stats');

    if (!response.ok) {
      throw new Error(`통계 조회 실패: ${response.status}`);
    }

    return response.json();
  }
);

// 배치 작업 실행
export const executeBatchAction = createAsyncThunk(
  'contentManagement/executeBatchAction',
  async (params: { action: BatchAction; itemIds: string[]; data?: any }) => {
    const { action, itemIds, data } = params;

    const response = await fetch('/api/planning/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        itemIds,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`배치 작업 실패: ${response.status}`);
    }

    return response.json() as Promise<BatchActionResult>;
  }
);

/**
 * 슬라이스 생성
 */
const contentManagementSlice = createSlice({
  name: 'contentManagement',
  initialState,
  reducers: {
    // 활성 탭 변경
    setActiveTab: (state, action: PayloadAction<ContentType>) => {
      state.activeTab = action.payload;
      state.selectedItems = []; // 탭 변경 시 선택 초기화
    },

    // 필터 설정
    setFilters: (state, action: PayloadAction<ContentFilters>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // 필터 변경 시 첫 페이지로
    },

    // 필터 초기화
    resetFilters: (state) => {
      state.filters = DEFAULT_FILTERS;
      state.pagination.page = 1;
    },

    // 정렬 설정
    setSortConfig: (state, action: PayloadAction<SortConfig>) => {
      state.sortConfig = action.payload;
    },

    // 페이지네이션 설정
    setPagination: (state, action: PayloadAction<Partial<PaginationConfig>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    // 아이템 선택/해제
    toggleSelectItem: (state, action: PayloadAction<string>) => {
      const itemId = action.payload;
      const index = state.selectedItems.indexOf(itemId);

      if (index > -1) {
        state.selectedItems.splice(index, 1);
      } else {
        state.selectedItems.push(itemId);
      }
    },

    // 모든 아이템 선택/해제
    toggleSelectAll: (state) => {
      const currentTabContent = state.content[`${state.activeTab}s` as keyof typeof state.content] as Content[];

      if (state.selectedItems.length === currentTabContent.length) {
        state.selectedItems = [];
      } else {
        state.selectedItems = currentTabContent.map(item => item.id);
      }
    },

    // 선택 초기화
    clearSelection: (state) => {
      state.selectedItems = [];
    },

    // 콘텐츠 필터링 (로컬)
    applyFilters: (state) => {
      const allContent = [
        ...state.content.scenarios,
        ...state.content.prompts,
        ...state.content.images,
        ...state.content.videos,
      ];

      let filtered = allContent;

      // 타입 필터
      if (state.filters.type) {
        filtered = filtered.filter(item => item.type === state.filters.type);
      }

      // 상태 필터
      if (state.filters.status) {
        filtered = filtered.filter(item => item.status === state.filters.status);
      }

      // 검색어 필터
      if (state.filters.search) {
        const searchLower = state.filters.search.toLowerCase();
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // 태그 필터
      if (state.filters.tags?.length) {
        filtered = filtered.filter(item =>
          state.filters.tags!.some(tag => item.tags.includes(tag))
        );
      }

      // 날짜 필터
      if (state.filters.dateRange) {
        const { start, end } = state.filters.dateRange;
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.createdAt);
          return itemDate >= new Date(start) && itemDate <= new Date(end);
        });
      }

      // 정렬
      filtered.sort((a, b) => {
        const { field, direction } = state.sortConfig;
        let aValue: any = a[field as keyof Content];
        let bValue: any = b[field as keyof Content];

        // 통계 필드 처리
        if (field === 'views' || field === 'likes' || field === 'uses') {
          aValue = (a as any).stats?.[field] || 0;
          bValue = (b as any).stats?.[field] || 0;
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
      });

      state.filteredContent = filtered;
    },

    // 실시간 이벤트 처리
    handleRealtimeEvent: (state, action: PayloadAction<RealtimeEvent>) => {
      const event = action.payload;

      switch (event.type) {
        case 'content_created':
          const newContent = event.data as Content;
          const contentArray = state.content[`${newContent.type}s` as keyof typeof state.content] as Content[];
          contentArray.unshift(newContent);
          break;

        case 'content_updated':
          const updatedContent = event.data as Content;
          const updateArray = state.content[`${updatedContent.type}s` as keyof typeof state.content] as Content[];
          const updateIndex = updateArray.findIndex(item => item.id === updatedContent.id);
          if (updateIndex > -1) {
            updateArray[updateIndex] = updatedContent;
          }
          break;

        case 'content_deleted':
          const deletedContent = event.data as Content;
          const deleteArray = state.content[`${deletedContent.type}s` as keyof typeof state.content] as Content[];
          const deleteIndex = deleteArray.findIndex(item => item.id === deletedContent.id);
          if (deleteIndex > -1) {
            deleteArray.splice(deleteIndex, 1);
          }
          break;

        case 'stats_updated':
          state.stats = event.data as ContentStats;
          break;
      }
    },

    // WebSocket 연결 상태 업데이트
    setWebSocketStatus: (state, action: PayloadAction<{ connected: boolean; reconnectCount?: number }>) => {
      state.websocket.connected = action.payload.connected;
      if (action.payload.reconnectCount !== undefined) {
        state.websocket.reconnectCount = action.payload.reconnectCount;
      }
    },

    // 에러 상태 초기화
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchContent
    builder
      .addCase(fetchContent.pending, (state) => {
        state.loading.content = true;
        state.error = null;
      })
      .addCase(fetchContent.fulfilled, (state, action) => {
        state.loading.content = false;

        // 타입별로 콘텐츠 분류
        const { scenarios, prompts, images, videos } = action.payload;

        state.content = {
          scenarios: scenarios || [],
          prompts: prompts || [],
          images: images || [],
          videos: videos || [],
        };

        state.cache.lastFetch = Date.now();
      })
      .addCase(fetchContent.rejected, (state, action) => {
        state.loading.content = false;
        state.error = action.error.message || '콘텐츠 조회에 실패했습니다';
      });

    // fetchStats
    builder
      .addCase(fetchStats.pending, (state) => {
        state.loading.stats = true;
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.loading.stats = false;
        state.stats = action.payload;
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.loading.stats = false;
        state.error = action.error.message || '통계 조회에 실패했습니다';
      });

    // executeBatchAction
    builder
      .addCase(executeBatchAction.pending, (state) => {
        state.loading.batchAction = true;
        state.error = null;
      })
      .addCase(executeBatchAction.fulfilled, (state, action) => {
        state.loading.batchAction = false;
        state.selectedItems = []; // 작업 완료 후 선택 초기화

        // 성공한 아이템들에 대해 상태 업데이트 (낙관적 업데이트)
        const { success } = action.payload;
        // 구체적인 업데이트 로직은 액션 타입에 따라 구현
      })
      .addCase(executeBatchAction.rejected, (state, action) => {
        state.loading.batchAction = false;
        state.error = action.error.message || '배치 작업에 실패했습니다';
      });
  },
});

/**
 * 액션 및 리듀서 내보내기
 */
export const {
  setActiveTab,
  setFilters,
  resetFilters,
  setSortConfig,
  setPagination,
  toggleSelectItem,
  toggleSelectAll,
  clearSelection,
  applyFilters,
  handleRealtimeEvent,
  setWebSocketStatus,
  clearError,
} = contentManagementSlice.actions;

export default contentManagementSlice.reducer;

/**
 * 셀렉터들
 */
export const selectContent = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.content;

export const selectActiveTabContent = (state: { contentManagement: ContentManagementState }) => {
  const { activeTab, content } = state.contentManagement;
  return content[`${activeTab}s` as keyof typeof content] as Content[];
};

export const selectFilteredContent = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.filteredContent;

export const selectSelectedItems = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.selectedItems;

export const selectStats = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.stats;

export const selectLoading = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.loading;

export const selectError = (state: { contentManagement: ContentManagementState }) =>
  state.contentManagement.error;

export const selectIsStale = (state: { contentManagement: ContentManagementState }) => {
  const { lastFetch, staleTime } = state.contentManagement.cache;
  if (!lastFetch) return true;
  return Date.now() - lastFetch > staleTime;
};