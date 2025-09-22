/**
 * Content Management Hook
 * 콘텐츠 관리 비즈니스 로직 훅
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash';
import type { AppDispatch } from '../../../app/store';
import {
  fetchContent,
  fetchStats,
  executeBatchAction,
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
  clearError,
  selectContent,
  selectActiveTabContent,
  selectFilteredContent,
  selectSelectedItems,
  selectStats,
  selectLoading,
  selectError,
  selectIsStale,
  type ContentType,
  type ContentFilters,
  type SortConfig,
  type PaginationConfig,
  type BatchAction,
  type RealtimeEvent,
} from '../../../entities/content-management';

/**
 * 콘텐츠 관리 메인 훅
 */
export function useContentManagement() {
  const dispatch = useDispatch<AppDispatch>();

  // 상태 선택
  const content = useSelector(selectContent);
  const activeTabContent = useSelector(selectActiveTabContent);
  const filteredContent = useSelector(selectFilteredContent);
  const selectedItems = useSelector(selectSelectedItems);
  const stats = useSelector(selectStats);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const isStale = useSelector(selectIsStale);

  /**
   * 콘텐츠 데이터 가져오기
   */
  const fetchContentData = useCallback(
    async (filters?: ContentFilters, force = false) => {
      try {
        await dispatch(fetchContent({ filters, force })).unwrap();
      } catch (error) {
        console.error('콘텐츠 조회 실패:', error);
        throw error;
      }
    },
    [dispatch]
  );

  /**
   * 통계 데이터 가져오기
   */
  const fetchStatsData = useCallback(async () => {
    try {
      await dispatch(fetchStats()).unwrap();
    } catch (error) {
      console.error('통계 조회 실패:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * 디바운스된 검색 함수
   */
  const debouncedSearch = useMemo(
    () =>
      debounce((search: string) => {
        dispatch(setFilters({ search }));
      }, 300),
    [dispatch]
  );

  /**
   * 탭 변경
   */
  const changeTab = useCallback(
    (tab: ContentType) => {
      dispatch(setActiveTab(tab));
    },
    [dispatch]
  );

  /**
   * 필터 적용
   */
  const updateFilters = useCallback(
    (newFilters: Partial<ContentFilters>) => {
      dispatch(setFilters(newFilters));
    },
    [dispatch]
  );

  /**
   * 필터 초기화
   */
  const clearFilters = useCallback(() => {
    dispatch(resetFilters());
  }, [dispatch]);

  /**
   * 정렬 변경
   */
  const changeSortConfig = useCallback(
    (config: SortConfig) => {
      dispatch(setSortConfig(config));
    },
    [dispatch]
  );

  /**
   * 페이지네이션 변경
   */
  const changePagination = useCallback(
    (config: Partial<PaginationConfig>) => {
      dispatch(setPagination(config));
    },
    [dispatch]
  );

  /**
   * 아이템 선택/해제
   */
  const selectItem = useCallback(
    (itemId: string) => {
      dispatch(toggleSelectItem(itemId));
    },
    [dispatch]
  );

  /**
   * 전체 선택/해제
   */
  const selectAll = useCallback(() => {
    dispatch(toggleSelectAll());
  }, [dispatch]);

  /**
   * 선택 해제
   */
  const clearSelections = useCallback(() => {
    dispatch(clearSelection());
  }, [dispatch]);

  /**
   * 배치 작업 실행
   */
  const performBatchAction = useCallback(
    async (action: BatchAction, itemIds?: string[], data?: any) => {
      const idsToProcess = itemIds || selectedItems;

      if (idsToProcess.length === 0) {
        throw new Error('선택된 아이템이 없습니다');
      }

      try {
        const result = await dispatch(
          executeBatchAction({
            action,
            itemIds: idsToProcess,
            data,
          })
        ).unwrap();

        return result;
      } catch (error) {
        console.error('배치 작업 실패:', error);
        throw error;
      }
    },
    [dispatch, selectedItems]
  );

  /**
   * 일괄 삭제
   */
  const bulkDelete = useCallback(
    async (itemIds?: string[]) => {
      return performBatchAction('delete', itemIds);
    },
    [performBatchAction]
  );

  /**
   * 일괄 보관
   */
  const bulkArchive = useCallback(
    async (itemIds?: string[]) => {
      return performBatchAction('archive', itemIds);
    },
    [performBatchAction]
  );

  /**
   * 일괄 활성화
   */
  const bulkActivate = useCallback(
    async (itemIds?: string[]) => {
      return performBatchAction('activate', itemIds);
    },
    [performBatchAction]
  );

  /**
   * 일괄 태그 추가
   */
  const bulkAddTags = useCallback(
    async (tags: string[], itemIds?: string[]) => {
      return performBatchAction('addTags', itemIds, { tags });
    },
    [performBatchAction]
  );

  /**
   * 일괄 태그 제거
   */
  const bulkRemoveTags = useCallback(
    async (tags: string[], itemIds?: string[]) => {
      return performBatchAction('removeTags', itemIds, { tags });
    },
    [performBatchAction]
  );

  /**
   * 실시간 이벤트 처리
   */
  const handleRealtimeUpdate = useCallback(
    (event: RealtimeEvent) => {
      dispatch(handleRealtimeEvent(event));
    },
    [dispatch]
  );

  /**
   * 에러 해제
   */
  const clearErrorState = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  /**
   * 데이터 새로고침
   */
  const refreshData = useCallback(
    async (includeStats = true) => {
      try {
        await fetchContentData(undefined, true);
        if (includeStats) {
          await fetchStatsData();
        }
      } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        throw error;
      }
    },
    [fetchContentData, fetchStatsData]
  );

  /**
   * 초기 데이터 로딩
   */
  useEffect(() => {
    if (!content.scenarios.length && !loading.content) {
      fetchContentData();
      fetchStatsData();
    }
  }, [content.scenarios.length, loading.content, fetchContentData, fetchStatsData]);

  /**
   * 필터 변경 시 자동 적용
   */
  useEffect(() => {
    dispatch(applyFilters());
  }, [dispatch, content]);

  /**
   * 페이지 포커스 시 stale 데이터 새로고침
   */
  useEffect(() => {
    const handleFocus = () => {
      if (isStale && !loading.content) {
        fetchContentData(undefined, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isStale, loading.content, fetchContentData]);

  /**
   * 계산된 값들
   */
  const totalCounts = useMemo(() => {
    return {
      scenarios: content.scenarios.length,
      prompts: content.prompts.length,
      images: content.images.length,
      videos: content.videos.length,
    };
  }, [content]);

  const hasSelection = selectedItems.length > 0;

  const isAllSelected = useMemo(() => {
    return activeTabContent.length > 0 && selectedItems.length === activeTabContent.length;
  }, [activeTabContent.length, selectedItems.length]);

  const sortedContent = useMemo(() => {
    return [...filteredContent]; // 이미 slice에서 정렬됨
  }, [filteredContent]);

  return {
    // 데이터
    content,
    activeTabContent,
    filteredContent,
    sortedContent,
    selectedItems,
    stats,
    totalCounts,

    // 상태
    loading,
    error,
    isStale,
    hasSelection,
    isAllSelected,

    // 액션
    fetchContent: fetchContentData,
    fetchStats: fetchStatsData,
    refreshData,

    // 탭 관리
    changeTab,

    // 필터링
    setFilters: updateFilters,
    resetFilters: clearFilters,
    setSearch: debouncedSearch,

    // 정렬
    setSortConfig: changeSortConfig,

    // 페이지네이션
    setPagination: changePagination,

    // 선택 관리
    selectItem,
    selectAll,
    clearSelection: clearSelections,

    // 배치 작업
    bulkDelete,
    bulkArchive,
    bulkActivate,
    bulkAddTags,
    bulkRemoveTags,

    // 실시간 업데이트
    handleRealtimeUpdate,

    // 유틸리티
    clearError: clearErrorState,
  };
}