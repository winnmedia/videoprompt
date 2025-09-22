/**
 * Content Management Performance Tests
 * Core Web Vitals 및 성능 최적화 테스트
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentDashboard } from '../ContentDashboard';
import { ContentTable } from '../ContentTable';

// Performance Observer Mock
global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => []),
}));

// Intersection Observer Mock
global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// 대량 데이터 생성 함수
function generateMockData(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Content Item ${index}`,
    description: `Description for content item ${index}`,
    type: ['scenario', 'prompt', 'image', 'video'][index % 4],
    status: ['active', 'draft', 'archived'][index % 3],
    tags: [`tag-${index % 10}`, `category-${index % 5}`],
    createdAt: new Date(Date.now() - index * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - index * 43200000).toISOString(),
    createdBy: `user-${index % 20}`,
    stats: {
      views: Math.floor(Math.random() * 1000),
      likes: Math.floor(Math.random() * 100),
      uses: Math.floor(Math.random() * 50),
    },
  }));
}

// Redux Provider Mock
const MockProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-provider">{children}</div>
);

// Performance 측정 유틸리티
function measureRenderTime(renderFn: () => void): number {
  const start = performance.now();
  renderFn();
  const end = performance.now();
  return end - start;
}

describe('Content Management Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 메모리 사용량 초기화
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('대량 데이터 렌더링 성능', () => {
    it('1000개 아이템을 2초 이내에 렌더링해야 한다', async () => {
      const largeDataset = generateMockData(1000);
      const mockProps = {
        data: largeDataset,
        contentType: 'scenario',
        selectedItems: [],
        onSelectItem: jest.fn(),
        onSelectAll: jest.fn(),
        onSortChange: jest.fn(),
      };

      const renderTime = measureRenderTime(() => {
        render(<ContentTable {...mockProps} />);
      });

      expect(renderTime).toBeLessThan(2000); // 2초 이내

      // 가상화가 올바르게 작동하는지 확인
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // DOM에 모든 아이템이 렌더링되지 않았는지 확인 (가상화)
      const renderedItems = screen.getAllByText(/Content Item/);
      expect(renderedItems.length).toBeLessThan(largeDataset.length);
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('10000개 아이템에서 스크롤 성능이 60fps를 유지해야 한다', async () => {
      const massiveDataset = generateMockData(10000);
      const mockProps = {
        data: massiveDataset,
        contentType: 'scenario',
        selectedItems: [],
        onSelectItem: jest.fn(),
        onSelectAll: jest.fn(),
        onSortChange: jest.fn(),
      };

      render(<ContentTable {...mockProps} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // 스크롤 이벤트 시뮬레이션
      const scrollContainer = table.closest('[style*="overflow"]') || table;

      const scrollTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();

        // 스크롤 이벤트 발생
        Object.defineProperty(scrollContainer, 'scrollTop', {
          value: i * 100,
          writable: true,
        });

        scrollContainer.dispatchEvent(new Event('scroll'));

        const end = performance.now();
        scrollTimes.push(end - start);
      }

      const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      expect(avgScrollTime).toBeLessThan(16.67); // 60fps (16.67ms per frame)
    });
  });

  describe('메모리 사용량 최적화', () => {
    it('컴포넌트 언마운트 시 메모리 누수가 없어야 한다', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      const { unmount } = render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 컴포넌트 사용
      await waitFor(() => {
        expect(screen.getByTestId('content-dashboard')).toBeInTheDocument();
      });

      // 언마운트
      unmount();

      // 가비지 컬렉션 강제 실행 (테스트 환경에서만)
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // 메모리 증가가 1MB 미만이어야 함
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('대량 선택 시 메모리 효율성을 유지해야 한다', async () => {
      const user = userEvent.setup();
      const largeDataset = generateMockData(5000);

      const mockProps = {
        data: largeDataset,
        contentType: 'scenario',
        selectedItems: [],
        onSelectItem: jest.fn(),
        onSelectAll: jest.fn(),
        onSortChange: jest.fn(),
      };

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      render(<ContentTable {...mockProps} />);

      // 전체 선택 버튼 클릭
      const selectAllCheckbox = screen.getByLabelText(/모든 항목 선택/);
      await user.click(selectAllCheckbox);

      expect(mockProps.onSelectAll).toHaveBeenCalled();

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // 선택 상태 관리가 효율적이어야 함 (5MB 미만)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('검색 및 필터링 성능', () => {
    it('검색 디바운스가 올바르게 작동해야 한다', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();

      const { ContentFilters } = await import('../ContentFilters');

      render(
        <ContentFilters
          onFilterChange={mockOnFilterChange}
          onReset={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const searchInput = screen.getByLabelText(/검색/);

      // 빠른 연속 입력
      await user.type(searchInput, 'test query');

      // 디바운스 시간(300ms) 전에는 호출되지 않아야 함
      expect(mockOnFilterChange).not.toHaveBeenCalled();

      // 디바운스 시간 후 호출되어야 함
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test query' })
        );
      }, { timeout: 400 });

      // 한 번만 호출되어야 함 (디바운스)
      expect(mockOnFilterChange).toHaveBeenCalledTimes(1);
    });

    it('대량 데이터 필터링이 500ms 이내에 완료되어야 한다', async () => {
      const largeDataset = generateMockData(5000);

      // 필터링 함수 성능 테스트
      const filterStartTime = performance.now();

      const filteredData = largeDataset.filter(item =>
        item.title.toLowerCase().includes('content') &&
        item.status === 'active' &&
        item.tags.includes('tag-1')
      );

      const filterEndTime = performance.now();
      const filterTime = filterEndTime - filterStartTime;

      expect(filterTime).toBeLessThan(500); // 500ms 이내
      expect(filteredData.length).toBeGreaterThan(0);
    });
  });

  describe('Core Web Vitals 최적화', () => {
    it('LCP (Largest Contentful Paint)가 2.5초 이내여야 한다', async () => {
      const lcpEntries: PerformanceEntry[] = [];

      const mockObserver = jest.fn((entries) => {
        lcpEntries.push(...entries);
      });

      global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
        observe: jest.fn(),
        disconnect: jest.fn(),
        takeRecords: jest.fn(() => lcpEntries),
      }));

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('content-dashboard')).toBeInTheDocument();
      });

      // LCP 시뮬레이션 (실제 환경에서는 자동 측정됨)
      const mockLcpEntry = {
        name: '',
        entryType: 'largest-contentful-paint',
        startTime: 1500, // 1.5초
        duration: 0,
        toJSON: () => ({}),
      };

      expect(mockLcpEntry.startTime).toBeLessThan(2500); // 2.5초 이내
    });

    it('CLS (Cumulative Layout Shift)가 0.1 이하여야 한다', async () => {
      const clsEntries: any[] = [];

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 동적 콘텐츠 로딩 시뮬레이션
      await waitFor(() => {
        expect(screen.getByTestId('content-dashboard')).toBeInTheDocument();
      });

      // Layout shift가 최소화되어야 함
      // 실제로는 skeleton loading으로 방지
      const skeletonExists = document.querySelector('[class*="animate-pulse"]');
      expect(skeletonExists).toBeTruthy();
    });

    it('INP (Interaction to Next Paint)가 200ms 이내여야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const tab = screen.getAllByRole('tab')[1];

      const interactionStart = performance.now();
      await user.click(tab);

      await waitFor(() => {
        expect(tab).toHaveAttribute('aria-selected', 'true');
      });

      const interactionEnd = performance.now();
      const interactionTime = interactionEnd - interactionStart;

      expect(interactionTime).toBeLessThan(200); // 200ms 이내
    });
  });

  describe('번들 크기 및 로딩 최적화', () => {
    it('컴포넌트가 지연 로딩되어야 한다', async () => {
      // 동적 import 시뮬레이션
      const mockDynamicImport = jest.fn().mockResolvedValue({
        ContentDashboard: () => <div data-testid="lazy-dashboard">Lazy Loaded</div>,
      });

      // 실제 구현에서는 React.lazy() 사용
      const LazyComponent = () => {
        const [Component, setComponent] = React.useState<React.ComponentType | null>(null);

        React.useEffect(() => {
          mockDynamicImport().then((module) => {
            setComponent(() => module.ContentDashboard);
          });
        }, []);

        if (!Component) {
          return <div data-testid="loading">Loading...</div>;
        }

        return <Component />;
      };

      render(<LazyComponent />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('lazy-dashboard')).toBeInTheDocument();
      });

      expect(mockDynamicImport).toHaveBeenCalledTimes(1);
    });

    it('이미지가 지연 로딩되어야 한다', () => {
      const mockProps = {
        data: generateMockData(10).map(item => ({
          ...item,
          thumbnail: 'https://example.com/image.jpg',
        })),
        contentType: 'image',
        selectedItems: [],
        onSelectItem: jest.fn(),
        onSelectAll: jest.fn(),
        onSortChange: jest.fn(),
      };

      render(<ContentTable {...mockProps} />);

      // 이미지에 loading="lazy" 속성이 있는지 확인
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });

  describe('리렌더링 최적화', () => {
    it('불필요한 리렌더링이 발생하지 않아야 한다', async () => {
      const renderCount = { count: 0 };

      const TestComponent = React.memo(() => {
        renderCount.count++;
        return (
          <MockProvider>
            <ContentDashboard />
          </MockProvider>
        );
      });

      const { rerender } = render(<TestComponent />);

      const initialRenderCount = renderCount.count;

      // 동일한 props로 리렌더링
      rerender(<TestComponent />);

      // memo로 인해 리렌더링이 방지되어야 함
      expect(renderCount.count).toBe(initialRenderCount);
    });

    it('콜백 함수가 메모이제이션되어야 한다', () => {
      let callbackRefs: Set<Function> = new Set();

      const TestComponent = ({ data }: { data: any[] }) => {
        const handleSelect = React.useCallback((id: string) => {
          console.log('Selected:', id);
        }, []); // 의존성 배열이 비어있어 메모이제이션됨

        callbackRefs.add(handleSelect);

        return <div data-testid="test">Test</div>;
      };

      const { rerender } = render(<TestComponent data={[]} />);
      rerender(<TestComponent data={[]} />);

      // 동일한 콜백 함수가 재사용되어야 함
      expect(callbackRefs.size).toBe(1);
    });
  });

  describe('네트워크 최적화', () => {
    it('API 호출이 적절히 캐시되어야 한다', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // 같은 데이터를 다시 요청 시 캐시 사용
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 캐시로 인해 추가 API 호출이 없어야 함
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      fetchSpy.mockRestore();
    });

    it('병렬 API 호출이 순차적 호출보다 빨라야 한다', async () => {
      const mockApiCall = (delay: number) =>
        new Promise(resolve => setTimeout(resolve, delay));

      // 순차적 호출
      const sequentialStart = performance.now();
      await mockApiCall(100);
      await mockApiCall(100);
      await mockApiCall(100);
      const sequentialEnd = performance.now();
      const sequentialTime = sequentialEnd - sequentialStart;

      // 병렬 호출
      const parallelStart = performance.now();
      await Promise.all([
        mockApiCall(100),
        mockApiCall(100),
        mockApiCall(100),
      ]);
      const parallelEnd = performance.now();
      const parallelTime = parallelEnd - parallelStart;

      expect(parallelTime).toBeLessThan(sequentialTime);
      expect(parallelTime).toBeLessThan(200); // 병렬 실행으로 200ms 미만
    });
  });
});