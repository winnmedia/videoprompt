/**
 * Content Management Hook Tests
 * TDD 우선 테스트 케이스
 */

import { renderHook, act } from '@testing-library/react';
import { useContentManagement } from '../hooks/useContentManagement';

// MSW 모킹
const mockContentData = {
  scenarios: [
    { id: '1', title: 'Test Scenario', type: 'scenario', createdAt: '2024-01-01', status: 'active' },
  ],
  prompts: [
    { id: '2', title: 'Test Prompt', type: 'prompt', createdAt: '2024-01-02', status: 'active' },
  ],
  images: [
    { id: '3', title: 'Test Image', type: 'image', createdAt: '2024-01-03', status: 'active' },
  ],
  videos: [
    { id: '4', title: 'Test Video', type: 'video', createdAt: '2024-01-04', status: 'active' },
  ],
};

describe('useContentManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('초기 상태', () => {
    it('초기 로딩 상태를 올바르게 반환해야 한다', () => {
      const { result } = renderHook(() => useContentManagement());

      expect(result.current.loading).toBe(true);
      expect(result.current.content).toEqual({
        scenarios: [],
        prompts: [],
        images: [],
        videos: [],
      });
      expect(result.current.totalCounts).toEqual({
        scenarios: 0,
        prompts: 0,
        images: 0,
        videos: 0,
      });
    });
  });

  describe('콘텐츠 로딩', () => {
    it('API에서 콘텐츠를 성공적으로 불러와야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        // API 호출 시뮬레이션
        await result.current.fetchContent();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.content.scenarios).toHaveLength(1);
      expect(result.current.content.prompts).toHaveLength(1);
    });

    it('API 오류 시 에러 상태를 올바르게 처리해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      // API 오류 시뮬레이션
      jest.mocked(fetch).mockRejectedValueOnce(new Error('API Error'));

      await act(async () => {
        await result.current.fetchContent();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('필터링', () => {
    it('타입별 필터링이 올바르게 작동해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.setFilters({ type: 'scenario' });
      });

      expect(result.current.filteredContent).toHaveLength(1);
      expect(result.current.filteredContent[0].type).toBe('scenario');
    });

    it('검색어 필터링이 올바르게 작동해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.setFilters({ search: 'Test Scenario' });
      });

      expect(result.current.filteredContent).toHaveLength(1);
      expect(result.current.filteredContent[0].title).toContain('Test Scenario');
    });

    it('날짜 범위 필터링이 올바르게 작동해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.setFilters({
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-02'
          }
        });
      });

      expect(result.current.filteredContent).toHaveLength(2);
    });
  });

  describe('정렬', () => {
    it('생성일 기준 정렬이 올바르게 작동해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.setSortConfig({ field: 'createdAt', direction: 'desc' });
      });

      const sorted = result.current.sortedContent;
      expect(new Date(sorted[0].createdAt).getTime())
        .toBeGreaterThan(new Date(sorted[1].createdAt).getTime());
    });

    it('제목 기준 정렬이 올바르게 작동해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.setSortConfig({ field: 'title', direction: 'asc' });
      });

      const sorted = result.current.sortedContent;
      expect(sorted[0].title.localeCompare(sorted[1].title)).toBeLessThanOrEqual(0);
    });
  });

  describe('배치 작업', () => {
    it('선택된 아이템들을 올바르게 관리해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.selectItems(['1', '2']);
      });

      expect(result.current.selectedItems).toEqual(['1', '2']);
    });

    it('선택된 아이템들을 일괄 삭제할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.selectItems(['1', '2']);
        await result.current.bulkDelete();
      });

      expect(result.current.selectedItems).toEqual([]);
      // 삭제 API 호출 검증
    });

    it('선택된 아이템들에 태그를 일괄 적용할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        result.current.selectItems(['1', '2']);
        await result.current.bulkAddTags(['new-tag']);
      });

      // 태그 적용 API 호출 검증
    });
  });

  describe('실시간 업데이트', () => {
    it('WebSocket 연결 시 실시간으로 업데이트되어야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        // WebSocket 메시지 시뮬레이션
        const mockEvent = {
          type: 'content_created',
          data: { id: '5', title: 'New Content', type: 'scenario' }
        };

        // WebSocket 이벤트 핸들러 호출
        result.current.handleRealtimeUpdate(mockEvent);
      });

      expect(result.current.content.scenarios).toHaveLength(2);
    });
  });

  describe('캐싱 및 성능', () => {
    it('동일한 데이터 요청 시 캐시를 사용해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());
      const fetchSpy = jest.spyOn(global, 'fetch');

      await act(async () => {
        await result.current.fetchContent();
        await result.current.fetchContent(); // 두 번째 호출
      });

      // 첫 번째 호출만 API를 사용해야 함 (캐시 활용)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('데이터가 stale 상태일 때만 재요청해야 한다', async () => {
      const { result } = renderHook(() => useContentManagement());

      await act(async () => {
        await result.current.fetchContent();

        // 5분 후 시뮬레이션
        jest.advanceTimersByTime(5 * 60 * 1000);

        await result.current.fetchContent();
      });

      expect(result.current.isStale).toBe(true);
    });
  });
});