/**
 * Content Dashboard Widget Tests
 * TDD 우선 UI 테스트 케이스
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentDashboard } from '../ContentDashboard';

// Redux Provider 모킹
const mockStore = {
  getState: () => ({
    contentManagement: {
      content: {
        scenarios: [
          { id: '1', title: 'Test Scenario', type: 'scenario', createdAt: '2024-01-01', status: 'active' },
        ],
        prompts: [
          { id: '2', title: 'Test Prompt', type: 'prompt', createdAt: '2024-01-02', status: 'active' },
        ],
        images: [],
        videos: [],
      },
      totalCounts: {
        scenarios: 1,
        prompts: 1,
        images: 0,
        videos: 0,
      },
      loading: false,
      error: null,
    },
  }),
  subscribe: jest.fn(),
  dispatch: jest.fn(),
};

const MockProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-provider">{children}</div>
);

describe('ContentDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('올바른 탭 구조로 렌더링되어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 4개 탭 확인
      expect(screen.getByRole('tab', { name: /AI Scenarios/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Prompts/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Images/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Videos/i })).toBeInTheDocument();
    });

    it('통계 카드가 올바르게 표시되어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 각 타입별 개수 확인
      expect(screen.getByText('1')).toBeInTheDocument(); // scenarios count
      expect(screen.getByText('1')).toBeInTheDocument(); // prompts count
      expect(screen.getByText('0')).toBeInTheDocument(); // images count
      expect(screen.getByText('0')).toBeInTheDocument(); // videos count
    });

    it('검색바가 렌더링되어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const searchInput = screen.getByPlaceholderText(/콘텐츠 검색/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('type', 'search');
    });

    it('필터 옵션이 렌더링되어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      expect(screen.getByLabelText(/날짜 범위/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/상태 필터/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/태그 필터/i)).toBeInTheDocument();
    });
  });

  describe('탭 네비게이션', () => {
    it('탭 클릭 시 올바른 콘텐츠가 표시되어야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 초기 상태: AI Scenarios 탭 활성화
      expect(screen.getByRole('tab', { name: /AI Scenarios/i })).toHaveAttribute('aria-selected', 'true');

      // Prompts 탭 클릭
      await user.click(screen.getByRole('tab', { name: /Prompts/i }));

      expect(screen.getByRole('tab', { name: /Prompts/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /AI Scenarios/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('키보드 네비게이션이 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const firstTab = screen.getByRole('tab', { name: /AI Scenarios/i });
      firstTab.focus();

      // Arrow 키로 다음 탭 이동
      await user.keyboard('{ArrowRight}');

      expect(screen.getByRole('tab', { name: /Prompts/i })).toHaveFocus();
    });
  });

  describe('검색 기능', () => {
    it('검색어 입력 시 필터링이 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const searchInput = screen.getByPlaceholderText(/콘텐츠 검색/i);

      await user.type(searchInput, 'Test Scenario');

      await waitFor(() => {
        expect(screen.getByText('Test Scenario')).toBeInTheDocument();
        expect(screen.queryByText('Test Prompt')).not.toBeInTheDocument();
      });
    });

    it('검색어가 디바운스되어야 한다', async () => {
      const user = userEvent.setup();
      const mockSearch = jest.fn();

      render(
        <MockProvider>
          <ContentDashboard onSearch={mockSearch} />
        </MockProvider>
      );

      const searchInput = screen.getByPlaceholderText(/콘텐츠 검색/i);

      await user.type(searchInput, 'test');

      // 디바운스 시간(300ms) 전에는 호출되지 않아야 함
      expect(mockSearch).not.toHaveBeenCalled();

      // 디바운스 시간 후 호출되어야 함
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledWith('test');
      }, { timeout: 400 });
    });
  });

  describe('필터링', () => {
    it('날짜 범위 필터가 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const dateFilter = screen.getByLabelText(/날짜 범위/i);

      await user.click(dateFilter);

      // 날짜 선택 모달이 열려야 함
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('상태 필터가 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const statusFilter = screen.getByLabelText(/상태 필터/i);

      await user.click(statusFilter);

      // 상태 옵션들이 표시되어야 함
      expect(screen.getByRole('option', { name: /활성/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /비활성/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /초안/i })).toBeInTheDocument();
    });

    it('필터 초기화 버튼이 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 필터 적용
      const searchInput = screen.getByPlaceholderText(/콘텐츠 검색/i);
      await user.type(searchInput, 'test');

      // 초기화 버튼 클릭
      const resetButton = screen.getByLabelText(/필터 초기화/i);
      await user.click(resetButton);

      // 검색어가 지워져야 함
      expect(searchInput).toHaveValue('');
    });
  });

  describe('정렬', () => {
    it('정렬 드롭다운이 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const sortButton = screen.getByLabelText(/정렬 옵션/i);

      await user.click(sortButton);

      // 정렬 옵션들이 표시되어야 함
      expect(screen.getByRole('option', { name: /최신순/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /오래된순/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /이름순/i })).toBeInTheDocument();
    });

    it('정렬 옵션 선택 시 콘텐츠가 재정렬되어야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const sortButton = screen.getByLabelText(/정렬 옵션/i);

      await user.click(sortButton);
      await user.click(screen.getByRole('option', { name: /이름순/i }));

      // 정렬이 적용되어야 함 (구체적인 검증은 테스트 데이터에 따라)
      await waitFor(() => {
        expect(screen.getByText(/이름순/i)).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    it('ARIA 레이블이 올바르게 설정되어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 탭리스트 ARIA 속성 확인
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', '콘텐츠 카테고리');

      // 탭패널 ARIA 속성 확인
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toHaveAttribute('aria-labelledby');
    });

    it('키보드 네비게이션이 올바르게 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // Tab 키로 포커스 이동 테스트
      await user.keyboard('{Tab}');
      expect(screen.getByRole('tab', { name: /AI Scenarios/i })).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByPlaceholderText(/콘텐츠 검색/i)).toHaveFocus();
    });

    it('스크린 리더용 라이브 리전이 있어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 검색 결과 안내용 라이브 리전
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('반응형 디자인', () => {
    it('모바일 화면에서 올바르게 표시되어야 한다', () => {
      // 뷰포트 크기 변경
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 모바일에서는 세로 스택 레이아웃이어야 함
      const container = screen.getByTestId('content-dashboard');
      expect(container).toHaveClass('flex-col', 'sm:flex-row');
    });

    it('데스크톱 화면에서 그리드 레이아웃이 작동해야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const statsGrid = screen.getByTestId('stats-grid');
      expect(statsGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });
  });

  describe('로딩 및 에러 상태', () => {
    it('로딩 상태를 올바르게 표시해야 한다', () => {
      const loadingStore = {
        ...mockStore,
        getState: () => ({
          contentManagement: {
            ...mockStore.getState().contentManagement,
            loading: true,
          },
        }),
      };

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/콘텐츠 로딩 중/i)).toBeInTheDocument();
    });

    it('에러 상태를 올바르게 표시해야 한다', () => {
      const errorStore = {
        ...mockStore,
        getState: () => ({
          contentManagement: {
            ...mockStore.getState().contentManagement,
            error: '콘텐츠를 불러올 수 없습니다',
          },
        }),
      };

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/콘텐츠를 불러올 수 없습니다/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /다시 시도/i })).toBeInTheDocument();
    });
  });
});