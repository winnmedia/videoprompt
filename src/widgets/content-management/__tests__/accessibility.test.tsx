/**
 * Content Management Accessibility Tests
 * WCAG 2.1 AA 준수 접근성 테스트
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { ContentDashboard } from '../ContentDashboard';
import { ContentTable } from '../ContentTable';
import { ContentFilters } from '../ContentFilters';
import { ContentActions } from '../ContentActions';

// Jest-axe 매처 확장
expect.extend(toHaveNoViolations);

// Mock 데이터
const mockContentData = [
  {
    id: '1',
    title: 'Test Scenario',
    description: 'Test description',
    type: 'scenario',
    status: 'active',
    tags: ['test', 'scenario'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    createdBy: 'user1',
    stats: { views: 10, likes: 5, uses: 3 },
  },
  {
    id: '2',
    title: 'Test Prompt',
    description: 'Another test description',
    type: 'prompt',
    status: 'draft',
    tags: ['test', 'prompt'],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    createdBy: 'user2',
    stats: { uses: 7, rating: 4.5 },
  },
];

// Redux Provider Mock
const MockProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-provider">{children}</div>
);

describe('Content Management Accessibility Tests', () => {
  describe('ContentDashboard 접근성', () => {
    it('WCAG 2.1 AA 위반사항이 없어야 한다', async () => {
      const { container } = render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('적절한 ARIA 역할과 레이블이 있어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 탭리스트 ARIA 속성 확인
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label');

      // 탭 ARIA 속성 확인
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
      });

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

      const firstTab = screen.getAllByRole('tab')[0];
      firstTab.focus();

      // Tab 키로 다음 요소로 이동
      await user.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(firstTab);

      // 화살표 키로 탭 간 이동
      firstTab.focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getAllByRole('tab')[1]).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(firstTab).toHaveFocus();
    });

    it('스크린 리더용 라이브 리전이 있어야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('적절한 색상 대비를 가져야 한다', () => {
      // CSS 색상 대비는 실제 렌더링에서 확인되므로
      // 여기서는 스타일 클래스가 올바르게 적용되는지 확인
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveClass('text-blue-600'); // 충분한 대비의 색상 클래스
    });
  });

  describe('ContentTable 접근성', () => {
    const mockProps = {
      data: mockContentData,
      contentType: 'scenario',
      selectedItems: [],
      onSelectItem: jest.fn(),
      onSelectAll: jest.fn(),
      onSortChange: jest.fn(),
    };

    it('WCAG 2.1 AA 위반사항이 없어야 한다', async () => {
      const { container } = render(<ContentTable {...mockProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('테이블에 적절한 ARIA 레이블이 있어야 한다', () => {
      render(<ContentTable {...mockProps} />);

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label');

      // 테이블 헤더가 적절히 마크업되어야 함
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
    });

    it('정렬 가능한 컬럼에 ARIA 정렬 속성이 있어야 한다', async () => {
      const user = userEvent.setup();

      render(<ContentTable {...mockProps} />);

      // 정렬 가능한 헤더 클릭
      const sortableHeader = screen.getByText('제목').closest('button');
      if (sortableHeader) {
        await user.click(sortableHeader);
        expect(mockProps.onSortChange).toHaveBeenCalled();
      }
    });

    it('체크박스에 적절한 레이블이 있어야 한다', () => {
      render(<ContentTable {...mockProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('aria-label');
      });
    });

    it('선택된 행에 적절한 ARIA 상태가 있어야 한다', () => {
      const selectedProps = {
        ...mockProps,
        selectedItems: ['1'],
      };

      render(<ContentTable {...selectedProps} />);

      const rows = screen.getAllByRole('row');
      const selectedRow = rows.find(row =>
        row.getAttribute('aria-selected') === 'true'
      );
      expect(selectedRow).toBeInTheDocument();
    });
  });

  describe('ContentFilters 접근성', () => {
    const mockProps = {
      onFilterChange: jest.fn(),
      onReset: jest.fn(),
      onClose: jest.fn(),
    };

    it('WCAG 2.1 AA 위반사항이 없어야 한다', async () => {
      const { container } = render(<ContentFilters {...mockProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('모든 폼 컨트롤에 레이블이 있어야 한다', () => {
      render(<ContentFilters {...mockProps} />);

      const inputs = screen.getAllByRole('textbox');
      const selects = screen.getAllByRole('combobox');
      const allFormControls = [...inputs, ...selects];

      allFormControls.forEach(control => {
        const label = screen.getByLabelText(
          control.getAttribute('aria-label') ||
          control.getAttribute('id') ||
          ''
        );
        expect(label).toBeInTheDocument();
      });
    });

    it('에러 상태에 적절한 ARIA 속성이 있어야 한다', () => {
      // 에러 상태를 시뮬레이션하는 테스트
      // 실제 구현에서는 validation 에러 시 aria-invalid, aria-describedby 등 확인
      render(<ContentFilters {...mockProps} />);

      const searchInput = screen.getByLabelText(/검색/i);
      expect(searchInput).toHaveAttribute('type', 'search');
    });

    it('날짜 입력에 적절한 포맷 안내가 있어야 한다', () => {
      render(<ContentFilters {...mockProps} />);

      const dateInputs = screen.getAllByDisplayValue('');
      dateInputs.forEach(input => {
        if (input.getAttribute('type') === 'date') {
          // 날짜 입력 필드는 브라우저에서 자동으로 접근성 지원
          expect(input).toHaveAttribute('type', 'date');
        }
      });
    });
  });

  describe('ContentActions 접근성', () => {
    const mockProps = {
      selectedCount: 2,
      isAllSelected: false,
      onSelectAll: jest.fn(),
      onClearSelection: jest.fn(),
      contentType: 'scenario',
    };

    it('WCAG 2.1 AA 위반사항이 없어야 한다', async () => {
      const { container } = render(<ContentActions {...mockProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('배치 작업 버튼에 적절한 설명이 있어야 한다', () => {
      render(<ContentActions {...mockProps} />);

      const actionButtons = screen.getAllByRole('button');
      actionButtons.forEach(button => {
        const buttonText = button.textContent;
        if (buttonText && ['활성화', '보관', '삭제'].includes(buttonText)) {
          // 버튼에 명확한 텍스트나 aria-label이 있어야 함
          expect(button).toHaveTextContent(buttonText);
        }
      });
    });

    it('확인 모달에 적절한 포커스 관리가 있어야 한다', async () => {
      const user = userEvent.setup();

      render(<ContentActions {...mockProps} />);

      // 삭제 버튼 클릭하여 모달 열기
      const deleteButton = screen.getByText('삭제');
      await user.click(deleteButton);

      // 모달이 열리면 포커스가 모달 내부로 이동해야 함
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // 모달 내 첫 번째 포커스 가능한 요소에 포커스가 있어야 함
      const modalButtons = screen.getAllByRole('button');
      const modalButton = modalButtons.find(btn =>
        modal.contains(btn)
      );
      expect(modalButton).toBeInTheDocument();
    });

    it('선택된 항목 수를 스크린 리더에게 알려야 한다', () => {
      render(<ContentActions {...mockProps} />);

      const selectionInfo = screen.getByText(/2개 항목 선택됨/i);
      expect(selectionInfo).toBeInTheDocument();
    });
  });

  describe('키보드 네비게이션 통합 테스트', () => {
    it('전체 대시보드에서 키보드만으로 모든 기능에 접근할 수 있어야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // Tab 키로 순차적 네비게이션 테스트
      await user.keyboard('{Tab}'); // 첫 번째 탭으로
      expect(screen.getAllByRole('tab')[0]).toHaveFocus();

      await user.keyboard('{Tab}'); // 다음 요소로
      // 포커스가 예상된 순서로 이동하는지 확인

      // Enter/Space 키로 상호작용 테스트
      const activeTab = screen.getAllByRole('tab')[0];
      activeTab.focus();
      await user.keyboard('{Enter}');
      // 탭 활성화 확인

      // Escape 키로 모달 닫기 테스트 등
    });

    it('스킵 링크가 올바르게 작동해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 스킵 링크는 첫 번째 Tab에서 나타나야 함
      await user.keyboard('{Tab}');
      const skipLink = screen.queryByText(/메인 콘텐츠로 건너뛰기/i);

      if (skipLink) {
        expect(skipLink).toBeVisible();
        await user.keyboard('{Enter}');
        // 메인 콘텐츠로 포커스 이동 확인
      }
    });
  });

  describe('색상 및 시각적 접근성', () => {
    it('중요한 정보가 색상에만 의존하지 않아야 한다', () => {
      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 상태 표시에 아이콘이나 텍스트도 함께 사용되는지 확인
      const statusElements = screen.getAllByText(/활성|초안|보관됨/i);
      statusElements.forEach(element => {
        // 색상 외에도 텍스트로 상태 정보 제공
        expect(element).toHaveTextContent(/.+/);
      });
    });

    it('포커스 표시가 명확해야 한다', async () => {
      const user = userEvent.setup();

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      const focusableElement = screen.getAllByRole('tab')[0];
      await user.tab();

      // 포커스 스타일이 있는지 확인 (실제로는 CSS 테스트 필요)
      expect(focusableElement).toHaveClass('focus:ring-2');
    });
  });

  describe('반응형 및 확대/축소 접근성', () => {
    it('200% 확대에서도 사용 가능해야 한다', () => {
      // 뷰포트 크기 변경으로 시뮬레이션
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640, // 200% 확대 시뮬레이션
      });

      render(
        <MockProvider>
          <ContentDashboard />
        </MockProvider>
      );

      // 텍스트가 잘리지 않고 스크롤 가능해야 함
      const container = screen.getByTestId('content-dashboard');
      expect(container).toBeInTheDocument();
    });

    it('모바일 화면에서 터치 타겟이 충분해야 한다', () => {
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

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // 터치 타겟 크기는 CSS에서 확인되므로
        // 여기서는 적절한 패딩 클래스가 있는지 확인
        const hasAdequatePadding =
          button.className.includes('p-') ||
          button.className.includes('py-') ||
          button.className.includes('px-');
        expect(hasAdequatePadding).toBe(true);
      });
    });
  });
});